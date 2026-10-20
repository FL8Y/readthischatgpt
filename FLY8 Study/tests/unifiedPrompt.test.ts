import { describe, expect, it } from 'vitest';
import { UNIFIED_CORE_SECTIONS, buildUnifiedPrompt, trimNotes, unifiedPromptText, wordCount } from '../src/pnle/unifiedPrompt';
import { MAX_BATCH, SHAPES, clampCount, isShapeId, shapeDef } from '../src/pnle/shapes';
import { PNLE_SYSTEM_PROMPT } from '../src/pnle/systemPrompt';
import { itemContextText, itemQuickAsks } from '../src/pnle/itemContext';
import type { BankItem } from '../src/bank/schema';

const sys = (shape: Parameters<typeof buildUnifiedPrompt>[0]['shape'], count = 5) => buildUnifiedPrompt({ shape, count }).system;

describe('unified prompt: required markers', () => {
  const p = sys('single');
  it('keeps the FLY8 core', () => {
    for (const m of [
      'ONE DECISION', 'TWO STEPS', 'REASONING HIERARCHY', 'Maslow', 'ABC', 'DISTINCT, named error type',
      'right action, wrong time', 'treats the symptom, not the cause', 'over-intervention', 'delegation or action outside scope',
      'skips assessment', 'unsafe but common habit', 'causal chain', 'Flip: if', '"optionRationales"', '"strategy"',
      'Beyond your notes', 'beyondNotes', 'only memorised the note',
    ]) {
      expect(p, m).toContain(m);
    }
    // 11 named distractor error types
    const line = /right action, wrong time;[^\n]*/.exec(p)?.[0] ?? '';
    expect(line.split(';').length).toBe(11);
  });
  it('carries the calibration lessons', () => {
    expect(p).toMatch(/real student could defend/);
    expect(p).toMatch(/compete on cues/);
    expect(p).toMatch(/textbook-classic/);
    expect(p).toMatch(/restate the vignette/);
    expect(p).toMatch(/Label difficulty honestly/);
  });
  it('carries the owner QC gate, Philippine settings and Bloom tag', () => {
    expect(p).toMatch(/QUALITY GATE/);
    expect(p).toMatch(/count is exactly the requested number/);
    expect(p).toMatch(/One defensible answer/);
    expect(p).toMatch(/Key positions are spread/);
    expect(p).toMatch(/No invented dose, citation, law number or URL/);
    expect(p).toMatch(/no real or recalled board item/);
    expect(p).toMatch(/barangay health station/);
    expect(p).toMatch(/PhilHealth/);
    expect(p).toMatch(/"bloom"/);
    expect(p).toMatch(/recall.*apply.*judgment/s);
  });
  it('uses the area names from the research (NP1 is community health)', () => {
    expect(p).toMatch(/NP1 Community Health Nursing/);
    expect(p).toMatch(/NP5 Psychiatric/);
    expect(p).not.toMatch(/Foundation of Professional Nursing Practice/);
  });
  it('asks for JSON only with BankItem v2 names, and the output format comes last before the example', () => {
    expect(p).toMatch(/JSON ONLY/);
    for (const k of ['"id":""', '"v":2', '"type"', '"answer":number[]', '"optionRationales"', '"difficulty"', '"keyFacts"']) expect(p).toContain(k);
    expect(p.indexOf('OUTPUT (JSON ONLY')).toBeGreaterThan(p.indexOf('QUALITY GATE'));
    expect(p.trimEnd().endsWith('}]}')).toBe(true);
  });
  it('core sections are plain strings with no template leftovers', () => {
    for (const s of UNIFIED_CORE_SECTIONS) expect(s).not.toMatch(/\$\{|undefined|\[object/);
  });
});

describe('unified prompt: shape modules', () => {
  const markers: Record<string, RegExp[]> = {
    single: [/SHAPE: SINGLE BEST ANSWER/, /"type":"single"/],
    sata: [/SHAPE: SELECT ALL THAT APPLY/, /"type":"sata"/, /Select all that apply/, /Five or six options/],
    statement: [/STATEMENT I/, /"format":"statement"/, /Both statements are true/, /Neither statement is true/],
    except: [/EXCEPT/, /"format":"except"/, /exactly one is the exception/],
    sequence: [/SHAPE: SEQUENCE/, /"format":"sequence"/, /complete ordering/],
    calc: [/CALCULATION/, /"format":"calc"/, /every number and unit/],
    'case-set': [/CASE SET/, /clusterId/, /clusterSeq/, /"matrix"/, /"cloze"/, /"highlight"/, /rowAnswer/, /blanks/],
  };
  for (const s of SHAPES) {
    it(`${s.id} includes its module and only its module`, () => {
      const p = sys(s.id, 4);
      for (const re of markers[s.id]) expect(p).toMatch(re);
      for (const other of SHAPES.filter((o) => o.id !== s.id)) expect(p).not.toContain(other.module);
    });
  }
  it('clamps counts to the batch cap and shape range', () => {
    expect(clampCount('single', 99)).toBe(MAX_BATCH);
    expect(clampCount('single', 0)).toBe(1);
    expect(clampCount('case-set', 1)).toBe(3);
    expect(clampCount('case-set', 10)).toBe(6);
    expect(clampCount('sata', Number.NaN)).toBe(5);
    expect(buildUnifiedPrompt({ shape: 'single', count: 40 }).user).toMatch(/exactly 10/);
    expect(isShapeId('sata')).toBe(true);
    expect(isShapeId('essay')).toBe(false);
    expect(shapeDef('calc').id).toBe('calc');
  });
});

describe('unified prompt: request block', () => {
  it('contains the request fields and trims notes', () => {
    const long = 'x '.repeat(5000);
    const r = buildUnifiedPrompt({
      shape: 'sata', count: 3, area: 'NP2', topic: 'Preeclampsia', difficulty: 4, setting: 'rural health unit',
      weakness: 'priority and delegation', avoidStems: ['Which action is first for a laboring mother?'],
      notes: [{ id: 'np2-pre', title: 'Preeclampsia', body: long }, { title: 'Eclampsia', body: 'Seizure care basics.' }],
    }).user;
    expect(r).toMatch(/Shape: Select all that apply\. Items: exactly 3/);
    expect(r).toMatch(/Area: NP2/);
    expect(r).toMatch(/Difficulty: 4 of 5/);
    expect(r).toMatch(/rural health unit/);
    expect(r).toMatch(/priority and delegation/);
    expect(r).toMatch(/Do not repeat these existing questions/);
    expect(r).toMatch(/## Preeclampsia \[np2-pre\]/);
    expect(r).toMatch(/Seizure care basics/);
    expect(r.length).toBeLessThan(5000);
  });
  it('trimNotes keeps the total bounded', () => {
    const notes = Array.from({ length: 12 }, (_, i) => ({ title: `T${i}`, body: 'word '.repeat(2000) }));
    const total = trimNotes(notes).reduce((n, x) => n + x.body.length, 0);
    expect(total).toBeLessThan(7500 + 12 * 4);
  });
  it('without notes it says so and falls back to beyondNotes', () => {
    const r = buildUnifiedPrompt({ shape: 'single', count: 2 }).user;
    expect(r).toMatch(/No notes attached/);
    expect(r).toMatch(/mixed \(mostly 2 to 4\)/);
  });
  it('one-message text ends with the JSON-only reminder', () => {
    const t = unifiedPromptText({ shape: 'single', count: 2, topic: 'Shock' });
    expect(t).toMatch(/REQUEST/);
    expect(t.trimEnd().endsWith('Reply with the JSON object only.')).toBe(true);
  });
});

describe('unified prompt: deeper, not longer', () => {
  it('stays within 115% of the old PNLE system prompt for every shape, system and request together', () => {
    const old = wordCount(PNLE_SYSTEM_PROMPT);
    for (const s of SHAPES) {
      const p = buildUnifiedPrompt({ shape: s.id, count: 5 });
      expect(wordCount(`${p.system} ${p.user}`), s.id).toBeLessThanOrEqual(Math.floor(old * 1.15));
    }
  });
});

describe('ask tutor: item context', () => {
  const item = {
    id: 'x', v: 2, type: 'single', area: 'NP3', topic: 'Oxygenation', vignette: 'A client is short of breath.', stem: 'What is first?',
    options: ['Check airway', 'Teach', 'Chart', 'Call'], answer: [0], rationale: 'Airway first because ABC.', optionRationales: ['a', 'b', 'c', 'd'],
    strategy: 'ABC: airway first', difficulty: 3, source: 'bank', review: 'unreviewed', aiWritten: true,
  } as BankItem;
  it('includes the case, stem, options, key, learner answer and rationale', () => {
    const t = itemContextText({ item, selected: [2] });
    for (const m of ['A client is short of breath.', 'What is first?', 'A. Check airway', 'Best answer: A. Check airway', 'Learner chose: C. Chart', 'Airway first because ABC.', 'ABC: airway first']) expect(t).toContain(m);
  });
  it('omits the learner line when unanswered and offers fewer quick asks', () => {
    expect(itemContextText({ item })).not.toContain('Learner chose');
    expect(itemQuickAsks({ item }).length).toBeLessThan(itemQuickAsks({ item, selected: [1] }).length);
  });
  it('handles matrix and cloze answers', () => {
    const m = { ...item, type: 'matrix', options: [], answer: [], rows: ['r1', 'r2'], columns: ['Yes', 'No'], rowAnswer: [0, 1] } as BankItem;
    expect(itemContextText({ item: m, selected: [1, -1] })).toContain('r1 -> No; r2 -> (blank)');
    const c = { ...item, type: 'cloze', options: [], answer: [], blanks: [{ choices: ['p', 'q'], answer: 1 }] } as BankItem;
    expect(itemContextText({ item: c, selected: [0] })).toContain('blank 1: p');
  });
});
