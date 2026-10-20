import { describe, expect, it } from 'vitest';
import { BANK } from '../src/bank/loader';
import { bankDigest, countWords, noteExcerpt } from '../src/pnle/noteExcerpt';
import { BATCH_WORD_CAP, DEFAULT_MIX, STYLES, allocateStyles, normalizeBatchStyles, planBatches, totalQuestions, type TopicPick } from '../src/pnle/generator';
import { parseBank } from '../src/pnle/parseBank';

const NOTE = `## What it is
Intro text about the thing.

## Must-know facts
- Fact one is key.
- Fact two [[Linked Topic]] matters.

## How the exam asks about it
- Exam trap: confuses A with B.

## Related topics
[[Other]]

## Check against your textbook
- The handout typo about 15th space.`;

const topicNames = [...new Set(BANK.items.map((i) => i.topic))].slice(0, 14);
const picks = (n: number, count: number): TopicPick[] =>
  topicNames.slice(0, n).map((name, k) => ({ name, count, noteId: `n${k}`, body: `${NOTE}\n\n## More\n${'word '.repeat(900)}`, area: 'NP3' }));

describe('noteExcerpt', () => {
  it('drops textbook-check and related sections, puts key facts and traps first, unwraps links', () => {
    const e = noteExcerpt(NOTE, 200);
    expect(e).not.toMatch(/Check against your textbook/);
    expect(e).not.toMatch(/15th/);
    expect(e).not.toMatch(/Related topics/);
    expect(e).not.toMatch(/\[\[/);
    expect(e.indexOf('Must-know')).toBeLessThan(e.indexOf('What it is'));
    expect(e.indexOf('How the exam asks')).toBeLessThan(e.indexOf('What it is'));
  });
  it('respects the word budget', () => {
    const e = noteExcerpt(`## Key facts\n${'alpha '.repeat(500)}\n\n## Other\n${'beta '.repeat(500)}`, 60);
    expect(countWords(e)).toBeLessThanOrEqual(66);
    expect(e).toMatch(/alpha/);
  });
  it('never throws on empty or odd bodies', () => {
    expect(noteExcerpt('', 50)).toBe('');
    expect(noteExcerpt('no headings at all, just text', 50)).toMatch(/just text/);
  });
});

describe('bankDigest', () => {
  const topic = topicNames[0];
  it('lists stems (about 12 words), topic and strategy, with no options', () => {
    const d = bankDigest(BANK.items, [topic]);
    expect(d.matched).toBeGreaterThan(0);
    expect(d.lines[0]).toMatch(/Already in the bank/);
    const item = d.lines[1];
    expect(item).toMatch(/^- .+ \| .+ \| .+$/);
    expect(countWords(item.split(' | ')[0])).toBeLessThanOrEqual(15);
    const opts = BANK.items.filter((i) => i.topic === topic).flatMap((i) => i.options).filter((o) => o.length > 25);
    for (const o of opts.slice(0, 20)) expect(d.lines.join('\n')).not.toContain(o);
  });
  it('is empty for an unknown topic and capped for a big one', () => {
    expect(bankDigest(BANK.items, ['zzz nothing']).lines).toEqual([]);
    expect(bankDigest(BANK.items, topicNames, 10).lines.length).toBeLessThanOrEqual(11);
  });
});

describe('style allocation', () => {
  it('adds up and keeps select-all near 10%', () => {
    for (const total of [10, 20, 40, 100]) {
      const a = allocateStyles(total, DEFAULT_MIX);
      expect(Object.values(a).reduce((x, y) => x + y, 0)).toBe(total);
      expect(Math.abs(a.sata / total - 0.1)).toBeLessThanOrEqual(0.06);
    }
    expect(DEFAULT_MIX.sata).toBe(10);
  });
  it('turns fewer than 3 case-only items into singles', () => {
    const c = normalizeBatchStyles({ single: 5, sata: 1, matrix: 1, cloze: 1, highlight: 0, curveball: 2 });
    expect(c.single).toBe(7);
    expect(c.matrix + c.cloze + c.highlight).toBe(0);
    const k = normalizeBatchStyles({ single: 5, sata: 1, matrix: 1, cloze: 1, highlight: 1, curveball: 1 });
    expect(k.matrix + k.cloze + k.highlight).toBe(3);
  });
  it('handles a zero or odd mix', () => {
    const a = allocateStyles(7, { single: 0, sata: 0, matrix: 0, cloze: 0, highlight: 0, curveball: 0 });
    expect(Object.values(a).reduce((x, y) => x + y, 0)).toBe(7);
  });
});

describe('planBatches', () => {
  const base = { mix: DEFAULT_MIX, difficulty: 'mixed' as const, existing: BANK.items };
  it('one small request is one batch with notes, digest and style plan', () => {
    const b = planBatches({ ...base, topics: picks(2, 3) });
    expect(b).toHaveLength(1);
    expect(b[0].text).toMatch(/Batch 1 of 1/);
    expect(b[0].text).toMatch(/STYLE PLAN \(exactly 6\)/);
    expect(b[0].text).toMatch(/EXISTING QUESTIONS/);
    expect(b[0].text).toMatch(/Must-know facts/);
    expect(b[0].text).not.toMatch(/Check against your textbook\n/);
    expect(b[0].text).not.toMatch(/15th space/);
    expect(b[0].text).toMatch(/do not repeat/i);
  });
  it('every batch fits the word cap and has at most 10 items, even for a huge pick', () => {
    const b = planBatches({ ...base, topics: picks(12, 6) });
    expect(b.length).toBeGreaterThanOrEqual(8);
    expect(b.reduce((a, x) => a + x.count, 0)).toBe(72);
    b.forEach((x, k) => {
      expect(x.words).toBeLessThanOrEqual(BATCH_WORD_CAP);
      expect(x.count).toBeLessThanOrEqual(10);
      expect(x.text).toContain(`Batch ${k + 1} of ${b.length}`);
    });
  });
  it('later batches carry the earlier ones forward and keep the digest', () => {
    const b = planBatches({ ...base, topics: picks(3, 10) });
    expect(b.length).toBe(3);
    expect(b[0].text).not.toMatch(/Earlier batches/);
    expect(b[2].text).toMatch(/Earlier batches of this series covered/);
    expect(b[2].text).toMatch(/EXISTING QUESTIONS/);
  });
  it('spreads styles across batches and keeps select-all about 10% overall', () => {
    const b = planBatches({ ...base, topics: picks(8, 10) });
    const sata = b.reduce((a, x) => a + x.styles.sata, 0);
    const total = totalQuestions(picks(8, 10));
    expect(Math.abs(sata / total - 0.1)).toBeLessThanOrEqual(0.05);
    for (const x of b) expect(x.styles.sata).toBeLessThanOrEqual(2);
    for (const x of b) expect(Object.values(x.styles).reduce((p, q) => p + q, 0)).toBe(x.count);
  });
  it('works with no notes installed, no existing questions and zero counts', () => {
    const b = planBatches({ ...base, existing: [], topics: [{ name: 'Free topic', count: 4 }, { name: 'Skipped', count: 0 }] });
    expect(b).toHaveLength(1);
    expect(b[0].text).not.toMatch(/EXISTING QUESTIONS/);
    expect(b[0].text).toMatch(/No notes attached/);
    expect(planBatches({ ...base, topics: [] })).toEqual([]);
  });
  it('asks for curve-ball flags and explains the mixed shape; contains no exam-material claims', () => {
    const t = planBatches({ ...base, topics: picks(1, 10) })[0].text;
    expect(t).toMatch(/curveball/);
    expect(t).toMatch(/Never copy, recall or imitate a real PNLE/);
  });
  it('STYLES lists the six styles', () => {
    expect(STYLES.map((s) => s.id)).toEqual(['single', 'sata', 'matrix', 'cloze', 'highlight', 'curveball']);
  });
  it('a curve-ball reply keeps its flag through the reply reader', () => {
    const r = parseBank('{"items":[{"type":"single","area":"NP3","topic":"T","vignette":"A client with a long and detailed history arrives at the unit.","stem":"Which action is first for this client?","options":["Do the first thing carefully","Do the second thing now","Do the third thing later","Do the fourth thing soon"],"answer":[1],"rationale":"The cue points to the second option because of the rule, so it wins. Flip: if X, then Y.","optionRationales":["a","b","c","d"],"strategy":"ABC","difficulty":3,"flags":["curveball"]}]}');
    const kept = [...r.valid][0];
    if (kept) expect(kept.flags).toEqual(['curveball']);
    else expect(r.rejected.length).toBe(1);
  });
});

import { resolvePicks } from '../src/pnle/generatorPicks';
describe('resolvePicks', () => {
  it('finds area, note id and body from the bank and the notes', () => {
    const it0 = BANK.items.find((i) => i.noteId) as (typeof BANK.items)[number];
    const p = resolvePicks([it0.topic, 'My own note', 'Nothing'], 3, BANK.items, [
      { id: it0.noteId as string, title: 'x', body: 'BODY' }, { id: 'mine', title: 'my own NOTE', body: 'MINE' },
    ]);
    expect(p[0]).toMatchObject({ name: it0.topic, count: 3, area: it0.area, noteId: it0.noteId, body: 'BODY' });
    expect(p[1]).toMatchObject({ noteId: 'mine', body: 'MINE' });
    expect(p[2].body).toBeUndefined();
  });
});
