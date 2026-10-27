import { describe, expect, it } from 'vitest';
import bundlesJson from '../data/presets/bundles.json';
import {
  BUNDLE_TIERS,
  START_HERE_COUNT,
  WEIGHTS,
  bankDifficulty,
  buildStudyGuide,
  bundleStage,
  density,
  isDone,
  rankNotes,
  stageOfTier,
  type GuideNote,
} from '../src/core/studyGuide';
import { PRESET_PACKS, presetTopicId } from '../src/presets';

const note = (id: string, title: string, bundleId: string, body = 'Plain text.', noteId?: string): GuideNote => ({ id, title, bundleId, body, noteId });

describe('tier map', () => {
  it('covers every one of the 21 bundles and nothing else', () => {
    const ids = bundlesJson.bundles.map((b) => b.id).sort();
    expect(ids.length).toBe(21);
    expect(Object.keys(BUNDLE_TIERS).sort()).toEqual(ids);
  });
  it('puts fundamentals first, community health next, emergency care last', () => {
    const t = BUNDLE_TIERS;
    expect(Math.min(...Object.values(t))).toBe(t.fund);
    expect(t.chn).toBeGreaterThan(t.fund);
    expect(Math.max(...Object.values(t))).toBe(t.emerg);
    for (const hard of ['cardio', 'neuro', 'fer', 'emerg']) expect(t[hard]).toBeGreaterThan(t.chn);
  });
  it('maps tiers to three stages', () => {
    expect([1, 3, 4, 6, 7, 9].map(stageOfTier)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(bundleStage('fund')).toBe(1);
    expect(bundleStage('emerg')).toBe(3);
    expect(bundleStage('unknown-bundle')).toBe(2);
  });
  it('weights add up to 1', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe('rankNotes', () => {
  const notes = [
    note('t-cardio', 'Heart Failure', 'cardio'),
    note('t-fund', 'Vital Signs', 'fund'),
    note('t-chn', 'Primary Health Care', 'chn'),
    note('t-emerg', 'Triage', 'emerg'),
  ];
  it('orders easiest to hardest by subject tier when other signals are equal', () => {
    expect(rankNotes(notes).map((n) => n.id)).toEqual(['t-fund', 't-chn', 't-cardio', 't-emerg']);
  });
  it('is deterministic whatever the input order, and ties break on title', () => {
    const a = rankNotes([note('2', 'B note', 'chn'), note('1', 'A note', 'chn')]);
    const b = rankNotes([note('1', 'A note', 'chn'), note('2', 'B note', 'chn')]);
    expect(a.map((n) => n.id)).toEqual(['1', '2']);
    expect(b.map((n) => n.id)).toEqual(['1', '2']);
  });
  it('scores stay within 0..100 and carry a stage and label', () => {
    for (const n of rankNotes(notes)) {
      expect(n.score).toBeGreaterThanOrEqual(0);
      expect(n.score).toBeLessThanOrEqual(100);
      expect([1, 2, 3]).toContain(n.stage);
      expect(['Easy', 'Medium', 'Hard']).toContain(n.label);
    }
    expect(rankNotes(notes)[0].label).toBe('Easy');
    expect(rankNotes(notes)[3].label).not.toBe('Easy');
  });
  it('longer, denser notes rank harder inside one subject', () => {
    const short = note('s', 'Short', 'chn', 'A short plain note about washing hands before meals.');
    const long = note('l', 'Long', 'chn', Array.from({ length: 900 }, (_, i) => (i % 5 === 0 ? 'BP 120 mmHg' : 'word')).join(' '));
    const r = rankNotes([long, short]);
    expect(r.map((n) => n.id)).toEqual(['s', 'l']);
    expect(r[1].parts.length).toBeGreaterThan(r[0].parts.length!);
  });
  it('notes that many others link to count as foundations (easier); notes that link out to many count as harder', () => {
    const hub = note('hub', 'Hub Topic', 'chn', 'The hub.');
    const leaf = note('leaf', 'Leaf Topic', 'chn', 'The leaf.');
    const others = Array.from({ length: 6 }, (_, i) => note(`o${i}`, `Other ${i}`, 'chn', 'See [[Hub Topic]].'));
    const dependent = note('dep', 'Dependent', 'chn', 'Builds on [[Hub Topic]], [[Other 0]], [[Other 1]], [[Other 2]], [[Leaf Topic]].');
    const r = Object.fromEntries(rankNotes([hub, leaf, dependent, ...others]).map((n) => [n.id, n]));
    expect(r.hub.parts.foundation).toBeLessThan(r.leaf.parts.foundation!);
    expect(r.dep.parts.dependsOn).toBeGreaterThan(r.leaf.parts.dependsOn!);
  });
  it('uses bank difficulty by note, falls back to bundle, and skips the signal when unknown', () => {
    const a = note('a', 'A', 'chn', 'x', 'n-a');
    const b = note('b', 'B', 'chn', 'x', 'n-b');
    const c = note('c', 'C', 'chn', 'x', 'n-c');
    const r = Object.fromEntries(rankNotes([a, b, c], { byNote: { 'n-a': 1, 'n-b': 5 }, byBundle: { chn: 3 } }).map((n) => [n.id, n]));
    expect(r.a.score).toBeLessThan(r.c.score);
    expect(r.c.score).toBeLessThan(r.b.score);
    expect(r.c.parts.bank).toBe(50);
    expect(rankNotes([a])[0].parts.bank).toBeUndefined();
  });
});

describe('density and bank difficulty', () => {
  it('counts numbers, abbreviations and table rows per 100 words', () => {
    expect(density('plain words only here')).toBe(0);
    expect(density('BP is 120 and PHN is 15')).toBeGreaterThan(density('blood pressure is normal and nurses are calm'));
  });
  it('averages item difficulty by note and by bundle and ignores bad values', () => {
    const r = bankDifficulty(
      [
        { noteId: 'a', difficulty: 2 },
        { noteId: 'a', difficulty: 4 },
        { noteId: 'b', difficulty: 5 },
        { noteId: 'a', difficulty: 9 },
        { difficulty: 3 },
      ],
      (id) => (id === 'a' ? 'chn' : id === 'b' ? 'comm' : undefined),
    );
    expect(r.byNote).toEqual({ a: 3, b: 5 });
    expect(r.byBundle).toEqual({ chn: 3, comm: 5 });
  });
});

describe('buildStudyGuide', () => {
  const ranked = rankNotes([
    ...Array.from({ length: 4 }, (_, i) => note(`f${i}`, `Fund ${i}`, 'fund')),
    ...Array.from({ length: 4 }, (_, i) => note(`c${i}`, `Chn ${i}`, 'chn')),
    ...Array.from({ length: 3 }, (_, i) => note(`h${i}`, `Heart ${i}`, 'cardio')),
    note('p0', 'Pedia 0', 'pedia'),
  ]);
  it('starts with the first 5 easy topics not yet studied', () => {
    const g = buildStudyGuide(ranked, []);
    expect(g.startHere.length).toBe(START_HERE_COUNT);
    expect(g.startHere.every((n) => n.stage === 1)).toBe(true);
    const g2 = buildStudyGuide(ranked, ['f0', 'f1', 'f2', 'f3']);
    expect(g2.startHere.map((n) => n.id)).toEqual(expect.not.arrayContaining(['f0', 'f1', 'f2', 'f3']));
    expect(g2.startHere.length).toBe(5);
  });
  it('moves on to later stages only when earlier ones are done', () => {
    const doneStage1 = ranked.filter((n) => n.stage === 1).map((n) => n.id);
    const g = buildStudyGuide(ranked, doneStage1);
    expect(g.startHere[0].stage).toBe(2);
  });
  it('reports per-stage progress from studied marks and from answers', () => {
    const g = buildStudyGuide(ranked, ['f0'], { f1: { attempts: 3, mastery: 0.8 }, f2: { attempts: 1, mastery: 0.9 }, h0: { attempts: 4, mastery: 0.4 } });
    const s1 = g.stages[0];
    expect(s1.total).toBe(8);
    expect(s1.done).toBe(2); // f0 studied, f1 answered well (3 answers, 80%); f2 has only 1 answer
    expect(s1.tested).toBe(2);
    expect(s1.avgMastery).toBeCloseTo(0.85, 5);
    const s3 = g.stages[2];
    expect(s3.done).toBe(0);
    expect(s3.avgMastery).toBeCloseTo(0.4, 5);
    expect(g.stages[1].avgMastery).toBeNull();
    expect(g.stages.map((s) => s.stage)).toEqual([1, 2, 3]);
  });
  it('isDone needs studied, or at least 2 answers at 70% or better', () => {
    expect(isDone('x', new Set(['x']), {})).toBe(true);
    expect(isDone('x', new Set(), { x: { attempts: 2, mastery: 0.7 } })).toBe(true);
    expect(isDone('x', new Set(), { x: { attempts: 1, mastery: 0.95 } })).toBe(false);
    expect(isDone('x', new Set(), { x: { attempts: 5, mastery: 0.5 } })).toBe(false);
  });
});

describe('with the real bundled notes', () => {
  const notes: GuideNote[] = PRESET_PACKS.flatMap((p) => p.notes.map((n) => ({ id: presetTopicId(n.id), noteId: n.id, title: n.title, bundleId: p.id, body: n.body })));
  const ranked = rankNotes(notes);
  it('ranks every note once, with fundamentals before emergency care and no hard topic in the first 100', () => {
    expect(ranked.length).toBe(notes.length);
    expect(new Set(ranked.map((n) => n.id)).size).toBe(notes.length);
    const first = ranked.slice(0, 100);
    expect(first.every((n) => n.stage === 1)).toBe(true);
    const mean = (b: string) => {
      const xs = ranked.filter((n) => n.bundleId === b).map((n) => n.score);
      return xs.reduce((a, c) => a + c, 0) / xs.length;
    };
    expect(mean('fund')).toBeLessThan(mean('chn'));
    expect(mean('chn')).toBeLessThan(mean('cardio'));
    expect(mean('cardio')).toBeLessThan(mean('emerg'));
  });
});
