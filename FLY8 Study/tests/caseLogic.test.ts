import { describe, expect, it } from 'vitest';
import type { BankItem } from '../src/bank/schema';
import { answerItem, createSession } from '../src/bank/session';
import { custom, mock, quick, caseStudy, type SelectContext } from '../src/bank/select';
import { planSession } from '../src/ui/practice/practiceFlow';
import {
  caseSetResult, clozeSource, clusterAnswered, clusterAt, clusterItems, emptyResponse, groupClusters, isComplete,
  partVerdicts, setSlot, slotsOf, splitCloze, togglePick, caseProgressText, bloomSummary,
} from '../src/ui/practice/caseLogic';
import { canSubmit, isPlayable } from '../src/ui/practice/playerLogic';

function mk(id: string, o: Partial<BankItem> = {}): BankItem {
  return {
    id, v: 2, type: 'single', area: 'NP1', topic: 't', vignette: 'v', stem: 's', options: ['a', 'b', 'c', 'd'], answer: [0],
    rationale: 'r', optionRationales: ['', '', '', ''], strategy: 'ABC', difficulty: 3, source: 'bank', review: 'unreviewed',
    aiWritten: true, ...o,
  } as BankItem;
}
const matrix = (id: string, o: Partial<BankItem> = {}) =>
  mk(id, { type: 'matrix', options: [], answer: [], optionRationales: [], rows: ['r1', 'r2', 'r3'], columns: ['up', 'down'], rowAnswer: [0, 1, 0], ...o });
const cloze = (id: string, o: Partial<BankItem> = {}) =>
  mk(id, { type: 'cloze', options: [], answer: [], optionRationales: [], stem: 'Give {{1}} now and monitor {{2}}.', blanks: [{ choices: ['oxygen', 'food'], answer: 0 }, { choices: ['pulse', 'mood'], answer: 0 }], ...o });
const highlight = (id: string, o: Partial<BankItem> = {}) =>
  mk(id, { type: 'highlight', options: ['s1', 's2', 's3'], answer: [1], optionRationales: [], ...o });

describe('response shaping', () => {
  it('empty responses and slot padding', () => {
    expect(emptyResponse(matrix('m'))).toEqual([-1, -1, -1]);
    expect(emptyResponse(cloze('c'))).toEqual([-1, -1]);
    expect(emptyResponse(highlight('h'))).toEqual([]);
    expect(slotsOf(matrix('m'), [1])).toEqual([1, -1, -1]);
  });
  it('setSlot ignores out-of-range values', () => {
    const m = matrix('m');
    expect(setSlot(m, [], 1, 1)).toEqual([-1, 1, -1]);
    expect(setSlot(m, [0, 0, 0], 0, 2)).toEqual([0, 0, 0]); // column 2 does not exist
    expect(setSlot(m, [], 5, 0)).toEqual([-1, -1, -1]);
    expect(setSlot(cloze('c'), [], 1, 1)).toEqual([-1, 1]);
  });
  it('togglePick keeps sorted and bounded', () => {
    expect(togglePick([2], 0, 3)).toEqual([0, 2]);
    expect(togglePick([0, 2], 2, 3)).toEqual([0]);
    expect(togglePick([0], 9, 3)).toEqual([0]);
  });
  it('completeness per type', () => {
    expect(isComplete(matrix('m'), [0, 1, -1])).toBe(false);
    expect(isComplete(matrix('m'), [0, 1, 0])).toBe(true);
    expect(isComplete(matrix('m'), [0, 1, 2])).toBe(false);
    expect(isComplete(cloze('c'), [0, -1])).toBe(false);
    expect(isComplete(cloze('c'), [1, 1])).toBe(true);
    expect(isComplete(highlight('h'), [])).toBe(false);
    expect(isComplete(highlight('h'), [0])).toBe(true);
    expect(canSubmit(matrix('m'), [0, 1, 0], false)).toBe(true);
    expect(canSubmit(matrix('m'), [0, 1, 0], true)).toBe(false);
    expect(isPlayable(matrix('m'))).toBe(true);
  });
  it('part verdicts', () => {
    expect(partVerdicts(matrix('m'), [0, 0, -1])).toEqual(['correct', 'wrong', 'blank']);
    expect(partVerdicts(cloze('c'), [0, 1])).toEqual(['correct', 'wrong']);
  });
});

describe('cloze text', () => {
  it('splits at markers in order', () => {
    const p = splitCloze('Give {{1}} now and monitor [2].', 2);
    expect(p.map((x) => (x.kind === 'blank' ? `#${x.index}` : x.text))).toEqual(['Give ', '#0', ' now and monitor ', '#1', '.']);
  });
  it('keeps extra markers as text and appends unmatched blanks', () => {
    expect(splitCloze('a ___ b ___ c', 1).map((x) => (x.kind === 'blank' ? '#' : x.text))).toEqual(['a ', '#', ' b ', '____', ' c']);
    expect(splitCloze('no markers', 2).filter((x) => x.kind === 'blank')).toHaveLength(2);
  });
  it('finds the source field', () => {
    expect(clozeSource(cloze('c'))).toBe('stem');
    expect(clozeSource(cloze('c', { stem: 'plain', vignette: 'The client is {{1}} and {{2}}.' }))).toBe('vignette');
  });
});

describe('clusters in a session', () => {
  const set = [mk('a1', { clusterId: 'A', clusterSeq: 1 }), mk('a2', { type: 'sata', options: ['1', '2', '3', '4', '5'], answer: [0, 1], clusterId: 'A', clusterSeq: 2 }),
    matrix('a3', { clusterId: 'A', clusterSeq: 3, bloom: 'apply' }), cloze('a4', { clusterId: 'A', clusterSeq: 4, bloom: 'recall' }),
    highlight('a5', { clusterId: 'A', clusterSeq: 5, bloom: 'judgment' })];
  const all = [mk('solo'), ...set, mk('solo2')];
  const byId = new Map(all.map((i) => [i.id, i]));

  it('finds position and progress text', () => {
    const order = all.map((i) => i.id);
    expect(clusterAt(order, byId, 0)).toBeNull();
    const p = clusterAt(order, byId, 3);
    expect(p).toMatchObject({ clusterId: 'A', start: 1, end: 5, seq: 3, size: 5 });
    expect(caseProgressText(p!)).toBe('Case item 3 of 5');
  });

  it('set result sums credit through score.ts and summarises bloom', () => {
    let s = createSession({ id: 's', mode: 'case', itemIds: set.map((i) => i.id), now: 0 });
    const pick: number[][] = [[0], [0], [0, 1, 0], [0, 1], [1]]; // single ok, sata half (1 of 2), matrix all right, cloze 1 of 2, highlight ok
    set.forEach((it, i) => { s = answerItem(s, it, pick[i]); });
    const p = clusterAt(s.order, byId, 0)!;
    const items = clusterItems(s, byId, p);
    expect(clusterAnswered(s, items)).toBe(true);
    const r = caseSetResult(s, items);
    const expected = (1 + 0.5 + 1 + 0.5 + 1) / 5;
    expect(r.score.credit).toBeCloseTo(expected, 6);
    expect(r.percent).toBe(Math.round(expected * 100));
    expect(r.bloomText).toBe('Recall 0 of 1 · Apply 1 of 1 · Judgment 1 of 1');
  });

  it('unanswered items score 0 and are not counted answered', () => {
    const s = createSession({ id: 's', mode: 'case', itemIds: set.map((i) => i.id), now: 0 });
    const r = caseSetResult(s, set);
    expect(r.answered).toBe(0);
    expect(r.score.credit).toBe(0);
    expect(clusterAnswered(s, set)).toBe(false);
  });

  it('bloom summary omits untagged levels', () => {
    expect(bloomSummary([mk('x'), mk('y', { bloom: 'recall' })], [1, 0])).toEqual([{ level: 'recall', label: 'Recall', correct: 0, total: 1 }]);
  });
});

describe('whole-cluster selection', () => {
  const mkSet = (cid: string, n: number) => Array.from({ length: n }, (_, k) => mk(`${cid}${k + 1}`, { clusterId: cid, clusterSeq: k + 1, topic: `T-${cid}` }));
  const singles = Array.from({ length: 12 }, (_, k) => mk(`s${k}`));
  const items = [...singles, ...mkSet('A', 5), ...mkSet('B', 4), ...mkSet('C', 3)];
  const ctx = (seed: number | string): SelectContext => ({ items, attempts: [], seed });
  const splitCount = (ids: string[]) => ['A', 'B', 'C'].filter((c) => {
    const have = ids.filter((id) => id.startsWith(c)).length;
    const want = items.filter((i) => i.clusterId === c).length;
    return have > 0 && have !== want;
  });

  it('quick never splits a cluster, keeps seq order and counts items toward size', () => {
    for (let seed = 0; seed < 60; seed++) {
      const sel = quick(ctx(seed), 10);
      expect(sel.ids.length).toBeLessThanOrEqual(10);
      expect(new Set(sel.ids).size).toBe(sel.ids.length);
      expect(splitCount(sel.ids)).toEqual([]);
      for (const c of ['A', 'B', 'C']) {
        const at = sel.ids.filter((id) => id.startsWith(c));
        expect(at).toEqual([...at].sort());
        if (at.length) expect(sel.ids.indexOf(at[at.length - 1]) - sel.ids.indexOf(at[0])).toBe(at.length - 1); // contiguous
      }
    }
  });

  it('custom and mock never split either, and a too-big set is skipped', () => {
    for (let seed = 0; seed < 40; seed++) {
      expect(splitCount(custom(ctx(seed), { count: 7 }).ids)).toEqual([]);
      expect(splitCount(mock(ctx(seed), 'NP1', 9).ids)).toEqual([]);
      expect(custom(ctx(seed), { count: 3 }).ids.filter((id) => id.startsWith('A') || id.startsWith('B')).length).toBe(0);
    }
  });

  it('with no clusters it behaves like before (same count, no repeats)', () => {
    const sel = quick({ items: singles, attempts: [], seed: 1 }, 5);
    expect(sel.ids).toHaveLength(5);
    expect(sel.short).toBe(false);
  });

  it('case mode returns whole sets only and flags short', () => {
    const one = caseStudy(ctx(3), 1);
    expect(one.short).toBe(false);
    expect(splitCount(one.ids)).toEqual([]);
    expect(one.ids.length).toBeGreaterThanOrEqual(3);
    const many = caseStudy(ctx(3), 5);
    expect(many.short).toBe(true);
    expect(many.ids).toHaveLength(12);
    expect(caseStudy({ items: singles, attempts: [], seed: 1 }, 1).ids).toEqual([]);
    expect(groupClusters([mk('lone', { clusterId: 'L', clusterSeq: 1 })]).size).toBe(0);
  });

  it('planSession handles the case request', () => {
    const plan = planSession({ kind: 'case', sets: 1 }, { items, attempts: [], seed: 2 });
    expect(plan.mode).toBe('case');
    expect(plan.revealMode).toBe('now');
    expect(plan.ids.length).toBeGreaterThan(0);
  });
});
