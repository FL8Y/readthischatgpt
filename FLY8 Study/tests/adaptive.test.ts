import { describe, expect, it } from 'vitest';
import type { Area, BankItem, Difficulty } from '../src/bank/schema';
import { answerItem, createSession } from '../src/bank/session';
import { makeRng } from '../src/bank/curate';
import { READINESS_FLOOR } from '../src/bank/readiness';
import {
  CI_STOP_HALFWIDTH, MAX_ITEMS, MIN_ITEMS, THETA_MAX, THETA_MIN, adaptivePool, difficultyLogit, expectedPercent,
  extendAdaptive, halfWidth, initAdaptive, isAdaptive, pRight, pickNext, replayAdaptive, sessionStop, startAdaptive,
  stepAdaptive, stepSize, stopDecision, summarizeAdaptive, thetaFromAttempts, thetaReadiness, updateTheta,
  weakBonusFrom, type AdaptiveMeta, type AdaptiveSession,
} from '../src/bank/adaptive';

function mk(id: string, area: Area, d: number, topic: string): BankItem {
  return {
    id, v: 2, type: 'single', area, topic, vignette: 'v', stem: 's', options: ['a', 'b', 'c', 'd'], answer: [0],
    rationale: 'r', optionRationales: ['', '', '', ''], strategy: 'ABC', difficulty: d as Difficulty,
    source: 'bank', review: 'unreviewed', aiWritten: true,
  } as BankItem;
}

function makePool(area: Area, n: number): BankItem[] {
  return Array.from({ length: n }, (_, k) => mk(`${area}-${k}`, area, (k % 5) + 1, `${area}-t${k % 4}`));
}

type Sess = AdaptiveSession & { adaptive: AdaptiveMeta };

/** Runs a full adaptive exam against a learner of true ability `trueTheta`. */
function simulate(items: BankItem[], scope: 'NP3' | 'ALL', trueTheta: number, seed: string) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const pool = adaptivePool(items, scope);
  const rng = makeRng(`learner:${seed}`);
  let s = startAdaptive(items, { id: 'x', now: 0, scope, seed }) as AdaptiveSession;
  for (let guard = 0; guard < 200; guard++) {
    const id = s.order[s.order.length - 1];
    const it = byId.get(id) as BankItem;
    const right = rng() < pRight(trueTheta, difficultyLogit(it.difficulty));
    s = answerItem(s, it, right ? [0] : [1]) as AdaptiveSession;
    const next = extendAdaptive(s, pool, byId);
    if (next === s) break;
    s = next;
  }
  return { s, byId, pool, st: replayAdaptive(s as Sess, byId) };
}

describe('theta math', () => {
  it('maps difficulty 1..5 to -1.6..+1.6 logits', () => {
    expect([1, 2, 3, 4, 5].map(difficultyLogit).map((x) => Math.round(x * 100) / 100)).toEqual([-1.6, -0.8, 0, 0.8, 1.6]);
  });
  it('right answer raises theta, miss lowers it, partial credit sits between', () => {
    expect(updateTheta(0, 3, 1)).toBeGreaterThan(0);
    expect(updateTheta(0, 3, 0)).toBeLessThan(0);
    expect(updateTheta(0, 3, 0.5)).toBeCloseTo(0, 10);
  });
  it('step shrinks with evidence and never below 0.12', () => {
    expect(stepSize(0)).toBeGreaterThan(stepSize(5));
    expect(stepSize(5)).toBeGreaterThan(stepSize(40));
    expect(stepSize(10000)).toBe(0.12);
  });
  it('clamps theta to -4..4 and survives bad input', () => {
    let t = 3.9;
    for (let i = 0; i < 100; i++) t = updateTheta(t, 5, 1, 0);
    expect(t).toBe(THETA_MAX);
    t = -3.9;
    for (let i = 0; i < 100; i++) t = updateTheta(t, 1, 0, 0);
    expect(t).toBe(THETA_MIN);
    expect(updateTheta(NaN, 3, 1)).toBeGreaterThan(-4);
  });
  it('a hard item answered right moves theta more than an easy one', () => {
    expect(updateTheta(0, 5, 1)).toBeGreaterThan(updateTheta(0, 1, 1));
    expect(updateTheta(0, 1, 0)).toBeLessThan(updateTheta(0, 5, 0));
  });
});

describe('pickNext', () => {
  const pool = makePool('NP3', 40);
  it('picks the item nearest theta', () => {
    expect(pickNext(pool, 1.6, [], { seed: 1 })?.difficulty).toBe(5);
    expect(pickNext(pool, -1.6, [], { seed: 1 })?.difficulty).toBe(1);
    expect(pickNext(pool, 0, [], { seed: 1 })?.difficulty).toBe(3);
  });
  it('is deterministic for a seed and never returns a seen item', () => {
    expect(pickNext(pool, 0.3, [], { seed: 'k' })?.id).toBe(pickNext(pool, 0.3, [], { seed: 'k' })?.id);
    const seen = new Set<string>();
    for (let i = 0; i < pool.length; i++) {
      const it = pickNext(pool, 0.2, seen, { seed: 'k' }) as BankItem;
      expect(seen.has(it.id)).toBe(false);
      seen.add(it.id);
    }
    expect(pickNext(pool, 0.2, seen, { seed: 'k' })).toBeNull();
  });
  it('different seeds can break ties differently', () => {
    const ids = new Set(Array.from({ length: 12 }, (_, i) => pickNext(pool, 0, [], { seed: `s${i}` })?.id));
    expect(ids.size).toBeGreaterThan(1);
  });
  it('weak-topic bonus pulls toward the weak topic', () => {
    const p = [mk('a', 'NP3', 3, 'strong'), mk('b', 'NP3', 4, 'weak')];
    expect(pickNext(p, 0, [], { seed: 1 })?.id).toBe('a');
    expect(pickNext(p, 0, [], { seed: 1, weakBonus: { weak: 0.9 } })?.id).toBe('b');
  });
  it('never gives 3 in a row from one topic while others exist', () => {
    const p = [mk('a', 'NP3', 3, 'x'), mk('b', 'NP3', 3, 'x'), mk('c', 'NP3', 3, 'x'), mk('d', 'NP3', 5, 'y')];
    expect(pickNext(p, 0, ['a', 'b'], { seed: 1, recentTopics: ['x', 'x'] })?.id).toBe('d');
    expect(pickNext([p[2]], 0, ['a', 'b'], { seed: 1, recentTopics: ['x', 'x'] })?.id).toBe('c');
  });
  it('weakBonusFrom needs 3 attempts and scales with misses', () => {
    const at = (topic: string, credit: number) => ({ itemId: 'i', credit, seconds: 1, at: 0, area: 'NP3' as Area, topic, strategy: '' });
    const b = weakBonusFrom([at('t', 0), at('t', 0), at('t', 1), at('u', 0), at('u', 0)]);
    expect(b.t).toBeCloseTo((0.5 * 2) / 3, 6);
    expect(b.u).toBeUndefined();
  });
});

describe('simulated learners', () => {
  const items = makePool('NP3', 120);
  it('a strong learner ends higher than a weak one', () => {
    const strong = simulate(items, 'NP3', 1.5, 'a');
    const weak = simulate(items, 'NP3', -1.5, 'a');
    expect(strong.st.theta.NP3 as number).toBeGreaterThan((weak.st.theta.NP3 as number) + 1);
  });
  it('averaged over seeds, estimates track true ability within a logit', () => {
    for (const truth of [-1, 0, 1]) {
      let sum = 0;
      for (let k = 0; k < 8; k++) sum += simulate(items, 'NP3', truth, `m${k}`).st.theta.NP3 as number;
      expect(Math.abs(sum / 8 - truth)).toBeLessThan(1);
    }
  });
  it('no item repeats and the length stays within 25..75', () => {
    const r = simulate(items, 'NP3', 0.5, 'len');
    expect(new Set(r.s.order).size).toBe(r.s.order.length);
    expect(r.s.order.length).toBeGreaterThanOrEqual(MIN_ITEMS);
    expect(r.s.order.length).toBeLessThanOrEqual(MAX_ITEMS);
  });
  it('same seed + same learner = same exam', () => {
    expect(simulate(items, 'NP3', 0.2, 'rep').s.order).toEqual(simulate(items, 'NP3', 0.2, 'rep').s.order);
  });
  it('a small pool stops when exhausted', () => {
    const r = simulate(makePool('NP3', 10), 'NP3', 0, 'small');
    expect(r.s.order.length).toBe(10);
    expect(sessionStop(r.s, r.pool, r.byId)?.reason).toBe('pool');
  });
  it('all-areas scope balances areas and stops within bounds', () => {
    const all = (['NP1', 'NP2', 'NP3', 'NP4', 'NP5'] as Area[]).flatMap((a) => makePool(a, 40));
    const byId = new Map(all.map((i) => [i.id, i]));
    const pool = adaptivePool(all, 'ALL');
    let s = startAdaptive(all, { id: 'y', now: 0, scope: 'ALL', seed: 'all' }) as AdaptiveSession;
    const rng = makeRng('allL');
    for (let g = 0; g < 200; g++) {
      const it = byId.get(s.order[s.order.length - 1]) as BankItem;
      s = answerItem(s, it, rng() < 0.6 ? [0] : [1]) as AdaptiveSession;
      const n = extendAdaptive(s, pool, byId);
      if (n === s) break;
      s = n;
    }
    const st = replayAdaptive(s as Sess, byId);
    expect(s.order.length).toBeGreaterThanOrEqual(MIN_ITEMS);
    expect(s.order.length).toBeLessThanOrEqual(MAX_ITEMS);
    const counts = Object.values(st.n) as number[];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
});

describe('stop rule', () => {
  const it3 = mk('z', 'NP3', 3, 't');
  const fresh = () => initAdaptive({ scope: 'NP3', seed: 1, start: {} });
  it('does not stop before 25 answers, stops at 75 at the latest', () => {
    let st = fresh();
    for (let i = 0; i < 24; i++) st = stepAdaptive(st, it3, i % 2);
    expect(stopDecision(st, 'NP3', 500).stop).toBe(false);
    for (let i = 24; i < 75; i++) st = stepAdaptive(st, mk(`q${i}`, 'NP3', 1, 't'), 1);
    expect(stopDecision(st, 'NP3', 500)).toMatchObject({ stop: true, reason: 'max' });
  });
  it('stops once the interval is small after the minimum', () => {
    let st = fresh();
    for (let i = 0; i < 40; i++) st = stepAdaptive(st, it3, i % 2);
    expect(halfWidth(st, 'NP3') as number).toBeLessThanOrEqual(CI_STOP_HALFWIDTH);
    expect(stopDecision(st, 'NP3', 500)).toMatchObject({ stop: true, reason: 'precise' });
  });
  it('halfWidth is null with no answers', () => {
    expect(halfWidth(fresh(), 'NP3')).toBeNull();
  });
});

describe('resume and session shape', () => {
  const items = makePool('NP3', 60);
  const byId = new Map(items.map((i) => [i.id, i]));
  const pool = adaptivePool(items, 'NP3');
  it('starts with one item, reveal at end, and keeps the adaptive meta through JSON', () => {
    const s = startAdaptive(items, { id: 'r', now: 5, scope: 'NP3', seed: 's' }) as AdaptiveSession;
    expect(s.mode).toBe('adaptive');
    expect(s.revealMode).toBe('end');
    expect(s.order).toHaveLength(1);
    expect(isAdaptive(JSON.parse(JSON.stringify(s)) as AdaptiveSession)).toBe(true);
  });
  it('extend waits until every queued item is answered and is idempotent', () => {
    const s = startAdaptive(items, { id: 'r', now: 5, scope: 'NP3', seed: 's' }) as AdaptiveSession;
    expect(extendAdaptive(s, pool, byId)).toBe(s);
    const a = answerItem(s, byId.get(s.order[0]) as BankItem, [0]) as AdaptiveSession;
    const e = extendAdaptive(a, pool, byId);
    expect(e.order).toHaveLength(2);
    expect(extendAdaptive(e, pool, byId)).toBe(e);
  });
  it('replay of a resumed session gives the same theta', () => {
    const s = simulate(items, 'NP3', 0.7, 'resume');
    const again = replayAdaptive(JSON.parse(JSON.stringify(s.s)) as Sess, byId);
    expect(again.theta).toEqual(s.st.theta);
    expect(again.trace.length).toBe(s.s.answeredIds.length);
  });
  it('returns null for an empty scope', () => {
    expect(startAdaptive(items, { id: 'e', now: 0, scope: 'NP1', seed: 's' })).toBeNull();
  });
  it('plain session without adaptive meta is untouched', () => {
    const plain = createSession({ id: 'p', mode: 'quick', itemIds: [items[0].id], now: 0 });
    expect(extendAdaptive(plain, pool, byId)).toBe(plain);
  });
});

describe('theta readiness', () => {
  it('stays locked below 30 answers', () => {
    expect(thetaReadiness(3, READINESS_FLOOR - 1)).toEqual({ state: 'locked', answered: 29, needed: 30 });
  });
  it('uses the existing bands and rises with theta', () => {
    expect(thetaReadiness(-1.5, 30)).toMatchObject({ state: 'ready', band: 'building' });
    expect(thetaReadiness(0.7, 30)).toMatchObject({ state: 'ready', band: 'approaching' });
    expect(thetaReadiness(2.5, 30)).toMatchObject({ state: 'ready', band: 'on track' });
    expect(expectedPercent(2.5)).toBeGreaterThan(expectedPercent(0.7));
  });
  it('thetaFromAttempts replays chronologically', () => {
    const items = makePool('NP3', 10);
    const byId = new Map(items.map((i) => [i.id, i]));
    const at = (i: number, credit: number) => ({ itemId: items[i].id, credit, seconds: 1, at: i, area: 'NP3' as Area, topic: 't', strategy: '' });
    const good = thetaFromAttempts(byId, [0, 1, 2, 3, 4, 5].map((i) => at(i, 1)));
    const bad = thetaFromAttempts(byId, [0, 1, 2, 3, 4, 5].map((i) => at(i, 0)));
    expect(good.theta.NP3 as number).toBeGreaterThan(bad.theta.NP3 as number);
    expect(good.n.NP3).toBe(6);
  });
});

describe('plain-words summary', () => {
  it('describes a climbing exam without claiming a pass', () => {
    let st = initAdaptive({ scope: 'NP3', seed: 1, start: {} });
    for (let i = 0; i < 30; i++) st = stepAdaptive(st, mk(`c${i}`, 'NP3', 3, 't'), 1);
    const sum = summarizeAdaptive(st, 'NP3');
    expect(sum.trend).toBe('climbing');
    expect(sum.lines.join(' ')).toMatch(/not a pass prediction/);
    expect(sum.areas[0].readiness.state).toBe('ready');
  });
  it('handles an empty exam', () => {
    const sum = summarizeAdaptive(initAdaptive({ scope: 'ALL', seed: 1, start: {} }), 'ALL');
    expect(sum.answered).toBe(0);
    expect(sum.lines[0]).toMatch(/No questions/);
  });
});
