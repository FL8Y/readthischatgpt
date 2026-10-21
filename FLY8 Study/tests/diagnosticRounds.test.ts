import { describe, expect, it } from 'vitest';
import type { Area, BankItem, Difficulty, ItemType } from '../src/bank/schema';
import type { AttemptRecord } from '../src/bank/types2';
import { createSession, answerItem } from '../src/bank/session';
import { sataBudget, weak } from '../src/bank/select';
import {
  buildProfile, cleanDx, confidenceFor, emptyDx, finishRound, profileText, rankAreas, recordRound, roundAvailability,
  roundOfSessionId, roundRows, roundSessionId, selectRound1, selectRound2, selectRound3, strategyFamily, unitOf, weakBoostFrom,
  weakBundleIds, weakestStrategies, weakestUnits, type BundleOf, type DxState, type ProfileCtx, type RoundCtx,
} from '../src/bank/diagnosticRounds';
import { buildStudyGuide, rankNotes, type GuideNote } from '../src/core/studyGuide';
import { learnerProfile } from '../src/ai/prompts';
import type { AppState } from '../src/core/types';
import { planSession, planSessionId, hubStats } from '../src/ui/practice/practiceFlow';
import { emptyBankState } from '../src/bank/store';

const AREAS: Area[] = ['NP1', 'NP2', 'NP3', 'NP4', 'NP5'];
const BUNDLES = ['b1', 'b2', 'b3', 'b4'];
const STRATS = ['Maslow: oxygen first', 'ABC: airway first', 'Delegation: stable and routine', 'Safety first: remove the hazard'];
const bundleOf: BundleOf = (i) => (i.noteId ? i.noteId.split('/')[0] : undefined);
const names = { 'NP1-b1': 'Community care', 'NP3-b2': 'Heart and vessels' };

function mk(id: string, area: Area, o: Partial<BankItem> = {}): BankItem {
  return {
    id, v: 2, type: 'single' as ItemType, area, topic: id, vignette: 'v', stem: 's', options: ['a', 'b', 'c', 'd'], answer: [0],
    rationale: 'r', optionRationales: ['', '', '', ''], strategy: STRATS[0], difficulty: 3 as Difficulty,
    source: 'bank', review: 'unreviewed', aiWritten: true, ...o,
  } as BankItem;
}

/** 5 areas x 4 bundles x 10 items; difficulty cycles 1..5; every 7th item is select-all; every 11th is a case item. */
function pool(perBundle = 10): BankItem[] {
  const out: BankItem[] = [];
  let n = 0;
  for (const a of AREAS) {
    for (const b of BUNDLES) {
      for (let k = 0; k < perBundle; k++, n++) {
        out.push(mk(`${a}-${b}-${k}`, a, {
          noteId: `${a}-${b}/note`, difficulty: ((k % 5) + 1) as Difficulty, strategy: STRATS[(k + n) % 4],
          ...(n % 7 === 0 ? { type: 'sata' as ItemType, options: ['a', 'b', 'c', 'd', 'e'], answer: [0, 1], optionRationales: ['', '', '', '', ''] } : {}),
          ...(n % 11 === 0 ? { clusterId: 'case-1' } : {}),
        }));
      }
    }
  }
  return out;
}

const ITEMS = pool(16);
const byId = new Map(ITEMS.map((i) => [i.id, i]));
const ctxOf = (o: Partial<RoundCtx> = {}): RoundCtx => ({ items: ITEMS, attempts: [], seed: 's1', bundleOf, ...o });
const pc: ProfileCtx = { byId, bundleOf, names };

function att(id: string, credit: number, sessionId?: string, at = 1): AttemptRecord {
  const i = byId.get(id) as BankItem;
  return { itemId: id, credit, seconds: 20, at, sessionId, mode: 'diagnostic', area: i.area, topic: i.topic, strategy: i.strategy };
}
const area = (id: string) => (byId.get(id) as BankItem).area;
const unit = (id: string) => unitOf(byId.get(id) as BankItem, bundleOf);
const count = <T>(l: T[], f: (x: T) => boolean) => l.filter(f).length;

/** Round 1 answered with the given area accuracies; returns attempts + a dx that saved the round. */
function round1(acc: Record<string, number>, seed = 'r1') {
  const sel = selectRound1(ctxOf({ seed }));
  const attempts = sel.ids.map((id, k) => att(id, k % 2 === 0 || acc[area(id)] >= 1 ? acc[area(id)] : 0, 'diagnostic-1'));
  const dx = recordRound(undefined, { round: 1, sessionId: 'diagnostic-1', at: 1, itemIds: sel.ids }, buildProfile(attempts, pc, [1], 1));
  return { sel, attempts, dx };
}

describe('round 1', () => {
  it('is 25 questions, 5 per area, no select-all over budget, no case items', () => {
    const s = selectRound1(ctxOf());
    expect(s.ids).toHaveLength(25);
    expect(s.short).toBe(false);
    for (const a of AREAS) expect(count(s.ids, (id) => area(id) === a)).toBe(5);
    expect(count(s.ids, (id) => byId.get(id)?.type === 'sata')).toBeLessThanOrEqual(sataBudget(25));
    expect(s.ids.some((id) => byId.get(id)?.clusterId)).toBe(false);
  });
  it('same seed same ids, different seed differs', () => {
    expect(selectRound1(ctxOf()).ids).toEqual(selectRound1(ctxOf()).ids);
    expect(selectRound1(ctxOf({ seed: 'a' })).ids).not.toEqual(selectRound1(ctxOf({ seed: 'b' })).ids);
  });
  it('a retake never reuses questions saved in rounds 2 or 3', () => {
    const r2ids = selectRound2(ctxOf(), ['NP1', 'NP2']).ids;
    const dx = recordRound(undefined, { round: 2, sessionId: 'diagnostic-r2-1', at: 1, itemIds: r2ids }, buildProfile([], pc, [2], 1));
    const again = selectRound1(ctxOf({ dx, seed: 'retake' }));
    expect(again.ids.filter((id) => r2ids.includes(id))).toEqual([]);
  });
});

describe('round 2', () => {
  const two: Area[] = ['NP3', 'NP5'];
  it('is 20 questions, 10 in each of the two areas, deterministic by seed', () => {
    const s = selectRound2(ctxOf(), two);
    expect(s.ids).toHaveLength(20);
    expect(s.short).toBe(false);
    expect(count(s.ids, (id) => area(id) === 'NP3')).toBe(10);
    expect(count(s.ids, (id) => area(id) === 'NP5')).toBe(10);
    expect(new Set(s.ids).size).toBe(20);
    expect(selectRound2(ctxOf(), two).ids).toEqual(s.ids);
    expect(selectRound2(ctxOf({ seed: 'zzz' }), two).ids).not.toEqual(s.ids);
  });
  it('covers every subject bundle of the two areas at least once', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const s = selectRound2(ctxOf({ seed }), two);
      for (const a of two) {
        const units = new Set(s.ids.filter((id) => area(id) === a).map(unit));
        expect(units.size).toBe(4);
      }
    }
  });
  it('uses the 60/30/10 difficulty mix (rank thirds of the area pool: 6 hard, 3 medium, 1 easy per 10)', () => {
    const s = selectRound2(ctxOf(), ['NP2', 'NP4']);
    for (const a of ['NP2', 'NP4'] as Area[]) {
      const ds = s.ids.filter((id) => area(id) === a).map((id) => (byId.get(id) as BankItem).difficulty);
      expect(count(ds, (d) => d >= 4)).toBeGreaterThanOrEqual(5);
      expect(count(ds, (d) => d <= 2)).toBeLessThanOrEqual(3);
      expect(Math.max(...ds)).toBe(5);
    }
  });
  it('prefers unseen questions and never repeats round 1 questions', () => {
    const r1 = round1({ NP1: 1, NP2: 1, NP3: 0, NP4: 1, NP5: 0 });
    const seenNow = ITEMS.filter((i) => i.area === 'NP3' && !i.clusterId && Number(i.id.split('-')[2]) < 6).map((i) => att(i.id, 1, 'x'));
    const s = selectRound2(ctxOf({ dx: r1.dx, attempts: [...r1.attempts, ...seenNow] }), two);
    expect(s.ids.filter((id) => r1.sel.ids.includes(id))).toEqual([]);
    const seenIds = new Set(seenNow.map((a) => a.itemId));
    expect(s.ids.filter((id) => seenIds.has(id))).toEqual([]);
  });
  it('keeps select-all within 1 per 10 and drops case items', () => {
    const s = selectRound2(ctxOf(), two);
    expect(count(s.ids, (id) => byId.get(id)?.type === 'sata')).toBeLessThanOrEqual(sataBudget(20));
    expect(s.ids.some((id) => byId.get(id)?.clusterId)).toBe(false);
    const allSata = ITEMS.map((i) => (i.area === 'NP3' || i.area === 'NP5' ? { ...i, type: 'sata' as ItemType } : i));
    const t = selectRound2(ctxOf({ items: allSata }), two);
    expect(count(t.ids, (id) => allSata.find((i) => i.id === id)?.type === 'sata')).toBeLessThanOrEqual(2);
    expect(t.short).toBe(true);
  });
  it('falls back and says so when a pool is thin', () => {
    const thin = ITEMS.filter((i) => i.area !== 'NP3' || i.id.endsWith('-0') || i.id.endsWith('-1'));
    const s = selectRound2(ctxOf({ items: thin }), ['NP3', 'NP5']);
    expect(s.short).toBe(true);
    expect(s.ids.length).toBeLessThan(20);
    expect(s.ids.length).toBeGreaterThan(8);
    expect(s.notes.join(' ')).toMatch(/Only \d+ of 20/);
  });
  it('says when there are more bundles than questions', () => {
    const many = ITEMS.map((i) => (i.area === 'NP3' ? { ...i, noteId: `${i.id}/n` } : i));
    const s = selectRound2(ctxOf({ items: many }), ['NP3', 'NP5']);
    expect(s.notes.join(' ')).toMatch(/NP3 has \d+ subject bundles but only 10/);
  });
});

describe('weak ranking', () => {
  it('ranks areas lowest first with ties by more answers then name', () => {
    const rows = [
      ...['NP1-b1-0', 'NP1-b1-1'].map((id) => ({ itemId: id, credit: 0.5 })),
      ...['NP2-b1-0', 'NP2-b1-1'].map((id) => ({ itemId: id, credit: 0.5 })),
      { itemId: 'NP3-b1-0', credit: 0.5 }, { itemId: 'NP3-b1-1', credit: 0.5 }, { itemId: 'NP3-b1-2', credit: 0.5 },
      { itemId: 'NP4-b1-0', credit: 1 },
    ];
    expect(rankAreas(rows, byId).map((a) => a.area)).toEqual(['NP3', 'NP1', 'NP2', 'NP4']);
  });
  it('ranks units, ties break on more answers then label, and a retaken item counts once (last answer)', () => {
    const rows = [
      { itemId: 'NP1-b1-0', credit: 0 }, { itemId: 'NP1-b1-1', credit: 0 },
      { itemId: 'NP2-b2-0', credit: 0 },
      { itemId: 'NP3-b3-0', credit: 1 }, { itemId: 'NP3-b3-0', credit: 0 },
    ];
    // NP3-b3: the retaken item counts once, with its last answer (0). NP2-b2 and NP3-b3 tie on 0% over 1 answer, so the label decides.
    expect(weakestUnits(rows, pc)).toEqual(['NP1-b1', 'NP2-b2', 'NP3-b3']);
    expect(weakestUnits(rows, pc, 2)).toHaveLength(2);
  });
  it('weakest strategies need 2+ answers and at least one miss', () => {
    const rows = [
      { itemId: ITEMS.find((i) => i.strategy === STRATS[0])?.id as string, credit: 0 },
      { itemId: ITEMS.filter((i) => i.strategy === STRATS[0])[1].id, credit: 0 },
      { itemId: ITEMS.find((i) => i.strategy === STRATS[1])?.id as string, credit: 0 },
      ...ITEMS.filter((i) => i.strategy === STRATS[2]).slice(0, 3).map((i) => ({ itemId: i.id, credit: 1 })),
    ];
    expect(weakestStrategies(rows, pc)).toEqual(['maslow']);
  });
});

describe('strategy families and confidence', () => {
  it('groups related strategy phrases', () => {
    expect(strategyFamily('Maslow: oxygen first').key).toBe('maslow');
    expect(strategyFamily('Maslow: physiological needs first').key).toBe('maslow');
    expect(strategyFamily('ABCs: airway').label).toBe('ABC');
    expect(strategyFamily('Airway first').key).toBe('abc');
    expect(strategyFamily('Delegate routine, stable tasks only').label).toBe('Delegation');
    expect(strategyFamily('Brand new idea: x').label).toBe('Brand new idea');
  });
  it('confidence is low under 3, medium 3-4, higher 5+', () => {
    expect([0, 1, 2].map(confidenceFor)).toEqual(['low', 'low', 'low']);
    expect([3, 4].map(confidenceFor)).toEqual(['medium', 'medium']);
    expect([5, 6, 20].map(confidenceFor)).toEqual(['higher', 'higher', 'higher']);
  });
});

describe('round 3', () => {
  const units = ['NP1-b1', 'NP2-b2', 'NP3-b3', 'NP4-b4', 'NP5-b1'];
  it('takes 3 per weak bundle and fills the rest from the 2 weak strategy families', () => {
    const s = selectRound3(ctxOf(), units, ['maslow', 'abc']);
    expect(s.ids).toHaveLength(20);
    for (const u of units) expect(count(s.ids, (id) => unit(id) === u)).toBeGreaterThanOrEqual(3);
    expect(count(s.ids, (id) => ['maslow', 'abc'].includes(strategyFamily((byId.get(id) as BankItem).strategy).key))).toBeGreaterThanOrEqual(5);
    expect(new Set(s.ids).size).toBe(20);
    expect(s.ids.some((id) => byId.get(id)?.clusterId)).toBe(false);
    expect(count(s.ids, (id) => byId.get(id)?.type === 'sata')).toBeLessThanOrEqual(2);
  });
  it('is deterministic by seed', () => {
    expect(selectRound3(ctxOf(), units, ['maslow']).ids).toEqual(selectRound3(ctxOf(), units, ['maslow']).ids);
    expect(selectRound3(ctxOf({ seed: 'q' }), units, ['maslow']).ids).not.toEqual(selectRound3(ctxOf(), units, ['maslow']).ids);
  });
  it('goes unseen first, then missed; skips questions already answered right in earlier rounds', () => {
    const inUnit = ITEMS.filter((i) => unit(i.id) === 'NP1-b1' && !i.clusterId && i.type !== 'sata').map((i) => i.id);
    const right = inUnit.slice(0, 4);
    const missed = inUnit.slice(4, 6);
    const attempts = [...right.map((id) => att(id, 1, 'diagnostic-1')), ...missed.map((id) => att(id, 0, 'diagnostic-1'))];
    const dx = recordRound(undefined, { round: 1, sessionId: 'diagnostic-1', at: 1, itemIds: [...right, ...missed] }, buildProfile(attempts, pc, [1], 1));
    const s = selectRound3(ctxOf({ attempts, dx }), ['NP1-b1'], [], 3);
    expect(s.ids).toHaveLength(3);
    for (const id of right) expect(s.ids).not.toContain(id);
    for (const id of missed) expect(s.ids).not.toContain(id); // unseen items are plentiful, so missed ones wait
    const small = ITEMS.filter((i) => unit(i.id) !== 'NP1-b1' || [...right, ...missed].includes(i.id) || i.id === inUnit[6]);
    const t = selectRound3(ctxOf({ items: small, attempts, dx }), ['NP1-b1'], [], 3);
    expect(t.ids).toContain(inUnit[6]);
    for (const id of missed) expect(t.ids).toContain(id);
    for (const id of right) expect(t.ids).not.toContain(id);
  });
  it('is short with a note when little is available', () => {
    const few = ITEMS.filter((i) => unit(i.id) === 'NP1-b1' && !i.clusterId).slice(0, 5);
    const s = selectRound3(ctxOf({ items: few }), ['NP1-b1'], ['maslow']);
    expect(s.short).toBe(true);
    expect(s.ids.length).toBeLessThanOrEqual(5);
    expect(s.notes.join(' ')).toMatch(/Only \d+ of 20/);
  });
});

describe('profile', () => {
  const rows = [
    ...Array.from({ length: 5 }, (_, k) => ({ itemId: `NP1-b1-${k}`, credit: k === 0 ? 1 : 0 })), // 20% over 5
    ...Array.from({ length: 2 }, (_, k) => ({ itemId: `NP2-b2-${k}`, credit: 0 })), // 0% over 2
    ...Array.from({ length: 4 }, (_, k) => ({ itemId: `NP3-b3-${k}`, credit: 1 })), // strong
  ];
  const p = buildProfile(rows, pc, [2, 1], 99);
  it('ranks weak subjects with accuracy, count and confidence; strong ones are left out', () => {
    expect(p.topics.map((t) => t.key)).toEqual(['NP2-b2', 'NP1-b1']);
    expect(p.topics[0]).toMatchObject({ percent: 0, answered: 2, confidence: 'low' });
    expect(p.topics[1]).toMatchObject({ percent: 20, answered: 5, confidence: 'higher', label: 'Community care' });
    expect(p.rounds).toEqual([1, 2]);
    expect(p.answered).toBe(11);
  });
  it('uses a readable label for items without a bundle', () => {
    const lone = mk('lone', 'NP4', { noteId: undefined });
    const m = new Map([...byId, ['lone', lone]]);
    const q = buildProfile([{ itemId: 'lone', credit: 0 }], { ...pc, byId: m }, [1], 1);
    expect(q.topics[0].label).toBe('Other NP4 topics');
    expect(weakBundleIds(q)).toEqual([]);
  });
  it('profile text states confidence and is not a prediction', () => {
    const t = profileText(p);
    expect(t).toMatch(/Community care 20% of 5 \(higher confidence\)/);
    expect(t).toMatch(/not a pass prediction/);
    expect(profileText(undefined)).toBe('');
    expect(profileText({ ...p, topics: [], strategies: [] })).toBe('');
  });
  it('feeds the AI learner profile text', () => {
    const state = { topics: [], events: [], dx: { rounds: {}, profile: p } } as unknown as AppState;
    expect(learnerProfile(state, 0)).toMatch(/Diagnostic weak spots/);
    expect(learnerProfile({ ...state, dx: undefined } as AppState, 0)).not.toMatch(/Diagnostic/);
  });
  it('feeds Weak spots practice', () => {
    const boost = weakBoostFrom(p, bundleOf);
    expect(boost).toBeDefined();
    const solo = ITEMS.filter((i) => !i.clusterId);
    expect(weak({ items: solo, attempts: [], seed: 1 }, 10).ids).toEqual([]);
    const s = weak({ items: solo, attempts: [], seed: 1, weakBoost: boost }, 10);
    expect(s.ids.length).toBe(10);
    expect(s.ids.every((id) => ['NP1-b1', 'NP2-b2'].includes(unit(id)) || (boost?.strategies.size ?? 0) > 0)).toBe(true);
    expect(weakBoostFrom(undefined, bundleOf)).toBeUndefined();
  });
});

describe('rounds state', () => {
  it('session ids carry the round; unlocking is sequential with "anyway" for round 3', () => {
    expect(roundOfSessionId(roundSessionId(1, 5))).toBe(1);
    expect(roundOfSessionId(roundSessionId(2, 5))).toBe(2);
    expect(roundOfSessionId(roundSessionId(3, 5))).toBe(3);
    expect(roundOfSessionId('diagnostic-12345')).toBe(1);
    expect(roundAvailability(undefined)).toEqual({ 1: { open: true, anyway: false }, 2: { open: false, anyway: false }, 3: { open: false, anyway: false } });
    const r1 = round1({ NP1: 1, NP2: 1, NP3: 1, NP4: 1, NP5: 1 }).dx;
    expect(roundAvailability(r1)).toEqual({ 1: { open: true, anyway: false }, 2: { open: true, anyway: false }, 3: { open: true, anyway: true } });
    const both = recordRound(r1, { round: 2, sessionId: 'diagnostic-r2-1', at: 2, itemIds: [] }, r1.profile!);
    expect(roundAvailability(both)[3]).toEqual({ open: true, anyway: false });
  });
  it('finishRound saves the round and rebuilds the profile from the finished session and earlier rounds', () => {
    const r1 = round1({ NP1: 0, NP2: 1, NP3: 1, NP4: 1, NP5: 1 });
    const ids = selectRound2(ctxOf({ dx: r1.dx }), ['NP1', 'NP2']).ids;
    let s = createSession({ id: roundSessionId(2, 7), mode: 'diagnostic', itemIds: ids, now: 7 });
    for (const id of ids.slice(0, 6)) s = answerItem(s, byId.get(id) as BankItem, [1]); // wrong answers
    const dx = finishRound(r1.dx, s, r1.attempts, pc, 8) as DxState;
    expect(dx.rounds['2']).toMatchObject({ round: 2, sessionId: s.id, itemIds: s.order });
    expect(dx.rounds['1']?.sessionId).toBe('diagnostic-1');
    expect(dx.profile?.rounds).toEqual([1, 2]);
    expect(dx.profile?.answered).toBe(25 + 6);
    expect(finishRound(r1.dx, createSession({ id: roundSessionId(3, 9), mode: 'diagnostic', itemIds: ids, now: 9 }), r1.attempts, pc, 9)).toBe(r1.dx);
  });
  it('retaking a round replaces its record and drops the old session from the profile', () => {
    const r1 = round1({ NP1: 0, NP2: 0, NP3: 0, NP4: 0, NP5: 0 });
    const ids = selectRound1(ctxOf({ seed: 'second' })).ids;
    let s = createSession({ id: 'diagnostic-999', mode: 'diagnostic', itemIds: ids, now: 9 });
    for (const id of ids) s = answerItem(s, byId.get(id) as BankItem, byId.get(id)?.answer as number[]);
    const dx = finishRound(r1.dx, s, r1.attempts, pc, 10) as DxState;
    expect(dx.rounds['1']?.sessionId).toBe('diagnostic-999');
    expect(dx.profile?.topics).toEqual([]);
  });
  it('roundRows reads only the saved session of each round', () => {
    const r1 = round1({ NP1: 1, NP2: 1, NP3: 1, NP4: 1, NP5: 1 });
    const stray = att('NP1-b1-0', 0, 'diagnostic-old');
    expect(roundRows([...r1.attempts, stray], r1.dx, [1])).toHaveLength(25);
    expect(roundRows(r1.attempts, r1.dx, [2])).toEqual([]);
  });
  it('cleanDx drops malformed data and never throws', () => {
    expect(cleanDx(null)).toBeUndefined();
    expect(cleanDx('x')).toBeUndefined();
    expect(cleanDx({ rounds: { 1: { sessionId: 3 } } })).toBeUndefined();
    const ok = cleanDx({ rounds: { 2: { sessionId: 'a', at: 1, itemIds: ['x', 5] }, 9: {} } });
    expect(ok?.rounds['2']?.itemIds).toEqual(['x']);
    expect(emptyDx()).toEqual({ rounds: {} });
  });
});

describe('study guide promotion', () => {
  const note = (id: string, bundleId: string, body = 'word '.repeat(50)): GuideNote => ({ id, title: id, bundleId, body });
  // fund = tier 1 (stage 1), chn = tier 2 (stage 1), ob = tier 4 (stage 2), cardio = tier 8 (stage 3)
  const notes = [note('f1', 'fund'), note('f2', 'fund'), note('c1', 'chn'), note('o1', 'ob'), note('o2', 'ob'), note('k1', 'cardio')];
  const ranked = rankNotes(notes);
  it('without weak spots the order is by stage then easiness', () => {
    const g = buildStudyGuide(ranked, []);
    expect(g.startHere.map((n) => n.stage)).toEqual([...g.startHere.map((n) => n.stage)].sort());
  });
  it('promotes weak bundles inside the current stage', () => {
    const base = buildStudyGuide(ranked, []).startHere.map((n) => n.id);
    const g = buildStudyGuide(ranked, [], {}, ['chn']);
    expect(g.startHere[0].bundleId).toBe('chn');
    expect(g.startHere.map((n) => n.id).sort()).toEqual(base.slice().sort());
    expect(g.weakBundles).toEqual(['chn']);
  });
  it('never puts a later stage ahead of an unfinished lower stage', () => {
    const g = buildStudyGuide(ranked, [], {}, ['cardio', 'ob']);
    const stages = g.startHere.map((n) => n.stage);
    expect(stages).toEqual([...stages].sort());
    expect(g.startHere[0].stage).toBe(1);
    // once stage 1 is done, the weak stage-2 bundle leads stage 2
    const done = buildStudyGuide(ranked, ['f1', 'f2', 'c1'], {}, ['ob']);
    expect(done.startHere[0].bundleId).toBe('ob');
    const done2 = buildStudyGuide(ranked, ['f1', 'f2', 'c1'], {}, ['cardio']);
    expect(done2.startHere[0].stage).toBe(2);
  });
});

describe('planSession for diagnostic rounds', () => {
  const base = { items: ITEMS, attempts: [] as AttemptRecord[], seed: 'p', bundleOf, bundleNames: names };
  it('without round context the old single diagnostic runs; with it round 1 is the same size', () => {
    const old = planSession({ kind: 'diagnostic' }, { items: ITEMS, attempts: [], seed: 'p' });
    expect(old.ids).toHaveLength(25);
    expect(old.round).toBeUndefined();
    const r1 = planSession({ kind: 'diagnostic', round: 1 }, base);
    expect(r1).toMatchObject({ mode: 'diagnostic', round: 1, requested: 25, short: false });
    expect(planSessionId(r1, 5)).toBe('diagnostic-5');
  });
  it('round 2 drills the two weakest areas of round 1 and its session id carries the round', () => {
    const r1 = round1({ NP1: 1, NP2: 1, NP3: 0, NP4: 1, NP5: 0.2 });
    const p = planSession({ kind: 'diagnostic', round: 2 }, { ...base, attempts: r1.attempts, dx: r1.dx });
    expect(new Set(p.ids.map(area))).toEqual(new Set(['NP3', 'NP5']));
    expect(p.round).toBe(2);
    expect(planSessionId(p, 9)).toBe('diagnostic-r2-9');
    expect(p.ids.filter((id) => r1.sel.ids.includes(id))).toEqual([]);
  });
  it('round 3 can start after round 1 only and reports short when it cannot fill', () => {
    const r1 = round1({ NP1: 0, NP2: 0, NP3: 1, NP4: 1, NP5: 1 });
    const p = planSession({ kind: 'diagnostic', round: 3 }, { ...base, attempts: r1.attempts, dx: r1.dx });
    expect(p.round).toBe(3);
    expect(p.ids.length).toBeGreaterThan(0);
  });
  it('the hub counts a saved weak profile as weak-spot evidence', () => {
    const profile = buildProfile([{ itemId: 'NP1-b1-0', credit: 0 }], pc, [1], 1);
    expect(hubStats(ITEMS, emptyBankState(), [], 'd', undefined).weakAvailable).toBe(false);
    expect(hubStats(ITEMS, emptyBankState(), [], 'd', profile).weakAvailable).toBe(true);
  });
});
