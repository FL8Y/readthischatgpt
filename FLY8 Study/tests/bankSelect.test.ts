import { describe, expect, it } from 'vitest';
import gold from '../data/bank/gold.v2.json';
import type { Area, BankItem, Difficulty, ItemType } from '../src/bank/schema';
import { answerItem, createSession, finishSession, flagItem, summarize } from '../src/bank/session';
import type { AttemptRecord } from '../src/bank/types2';
import { custom, diagnostic, mock, quick, requeue, smart, weak, type SelectContext } from '../src/bank/select';
import { buildResult } from '../src/bank/results';
import { filterHistory, historySummaryLine, makeHistoryEntry } from '../src/bank/history';
import { areaReadiness, bandFor, masteryTag, readiness, READINESS_FLOOR, OVERALL_LABEL } from '../src/bank/readiness';

const T0 = Date.UTC(2026, 0, 1, 0, 0, 0); // fixed clock; nothing reads Date.now()
const DAY = 86400000;
const AREAS5: Area[] = ['NP1', 'NP2', 'NP3', 'NP4', 'NP5'];

function mk(id: string, area: Area, o: Partial<BankItem> = {}): BankItem {
  return {
    id, v: 2, type: 'single' as ItemType, area, topic: 'a',
    vignette: 'v', stem: 's', options: ['a', 'b', 'c', 'd'], answer: [0], rationale: 'r',
    optionRationales: ['', '', '', ''], strategy: 'ABC: airway first', difficulty: 3 as Difficulty,
    source: 'bank', review: 'unreviewed', aiWritten: true, ...o,
  } as BankItem;
}

function pool(perArea: number): BankItem[] {
  const out: BankItem[] = [];
  for (const a of AREAS5) {
    for (let k = 0; k < perArea; k++) {
      out.push(mk(`${a}-${k}`, a, { difficulty: ((k % 5) + 1) as Difficulty, topic: `${a}-topic-${k % 2 ? 'a' : 'b'}` }));
    }
  }
  return out;
}

const ctxOf = (items: BankItem[], attempts: AttemptRecord[] = [], seed: number | string = 'seed1'): SelectContext =>
  ({ items, attempts, seed });

function att(item: BankItem, credit: number, at: number, extra: Partial<AttemptRecord> = {}): AttemptRecord {
  return { itemId: item.id, credit, seconds: 30, at, area: item.area, topic: item.topic, strategy: item.strategy, ...extra };
}

describe('selectors: determinism and no repeats', () => {
  const items = pool(12);
  it('same seed gives same ids, different seed differs', () => {
    expect(quick(ctxOf(items), 10).ids).toEqual(quick(ctxOf(items), 10).ids);
    expect(quick(ctxOf(items, [], 'a'), 10).ids).not.toEqual(quick(ctxOf(items, [], 'b'), 10).ids);
    expect(smart(ctxOf(items), 15).ids).toEqual(smart(ctxOf(items), 15).ids);
    expect(diagnostic(ctxOf(items)).ids).toEqual(diagnostic(ctxOf(items)).ids);
  });
  it('quick returns n unique ids and no short flag', () => {
    const s = quick(ctxOf(items), 20);
    expect(s.ids).toHaveLength(20);
    expect(new Set(s.ids).size).toBe(20);
    expect(s.short).toBe(false);
  });
  it('short pools return fewer plus the short flag', () => {
    const tiny = pool(2);
    const q = quick(ctxOf(tiny), 50);
    expect(q.ids).toHaveLength(10);
    expect(q.short).toBe(true);
    expect(mock(ctxOf(tiny), 'NP3', 100)).toMatchObject({ short: true, requested: 100 });
    expect(mock(ctxOf(tiny), 'NP3', 100).ids).toHaveLength(2);
    expect(mock(ctxOf(items), 'NP3', 12).short).toBe(false);
  });
  it('mock only draws from the area', () => {
    expect(mock(ctxOf(items), 'NP2', 8).ids.every((id) => id.startsWith('NP2-'))).toBe(true);
  });
  it('caps sata at 12% of the set', () => {
    const mixed = pool(20).map((i, k) => (k % 2 === 0 ? { ...i, type: 'sata' as ItemType } : i));
    const ids = quick(ctxOf(mixed), 25).ids;
    const sata = ids.filter((id) => mixed.find((m) => m.id === id)?.type === 'sata').length;
    expect(sata).toBeLessThanOrEqual(Math.ceil(25 * 0.12));
    expect(ids).toHaveLength(25);
  });
});

describe('custom', () => {
  const items = pool(12);
  it('filters by area, topic and difficulty band', () => {
    const s = custom(ctxOf(items), { areas: ['NP1'], topics: ['NP1-topic-a'], count: 50, difficultyBand: [2, 4] });
    expect(s.ids.length).toBeGreaterThan(0);
    for (const id of s.ids) {
      const it = items.find((i) => i.id === id) as BankItem;
      expect(it.area).toBe('NP1');
      expect(it.topic).toBe('NP1-topic-a');
      expect(it.difficulty).toBeGreaterThanOrEqual(2);
      expect(it.difficulty).toBeLessThanOrEqual(4);
    }
    expect(s.short).toBe(true);
  });
  it('unseen / missed / flagged filters', () => {
    const a = items[0], b = items[1], c = items[2];
    const attempts = [att(a, 1, T0), att(b, 0, T0), att(c, 0, T0), att(c, 1, T0 + 5)];
    const base = { areas: ['NP1' as Area], count: 100 };
    const unseen = custom({ ...ctxOf(items, attempts), flaggedIds: [] }, { ...base, filters: ['unseen'] }).ids;
    expect(unseen).not.toContain(a.id);
    expect(unseen).not.toContain(b.id);
    expect(custom(ctxOf(items, attempts), { ...base, filters: ['missed'] }).ids).toEqual([b.id]);
    expect(custom({ ...ctxOf(items, attempts), flaggedIds: [c.id] }, { ...base, filters: ['flagged'] }).ids).toEqual([c.id]);
  });
  it('bundle filter matches topicId', () => {
    const withBundle = items.map((i, k) => (k < 3 ? { ...i, topicId: 'bundle-x' } : i));
    expect(custom(ctxOf(withBundle), { bundles: ['bundle-x'], count: 10 }).ids.sort()).toEqual(withBundle.slice(0, 3).map((i) => i.id).sort());
  });
});

describe('diagnostic', () => {
  it('is 25 items, 5 per NP area, no duplicates, spread difficulty', () => {
    const items = pool(15);
    const s = diagnostic(ctxOf(items));
    expect(s.ids).toHaveLength(25);
    expect(s.short).toBe(false);
    expect(new Set(s.ids).size).toBe(25);
    for (const a of AREAS5) {
      const got = s.ids.map((id) => items.find((i) => i.id === id) as BankItem).filter((i) => i.area === a);
      expect(got).toHaveLength(5);
      const ds = got.map((i) => i.difficulty);
      expect(Math.min(...ds)).toBe(1);
      expect(Math.max(...ds)).toBe(5);
    }
  });
  it('works on the real gold bank (20 per area)', () => {
    const real = (Array.isArray(gold) ? gold : (gold as { items: BankItem[] }).items) as BankItem[];
    const s = diagnostic(ctxOf(real));
    expect(s.ids).toHaveLength(25);
    expect(new Set(s.ids).size).toBe(25);
  });
  it('prefers unseen items and flags a thin area as short', () => {
    const items = pool(8);
    const seenIds = items.filter((i) => i.area === 'NP1').slice(0, 3);
    const s = diagnostic(ctxOf(items, seenIds.map((i) => att(i, 1, T0))));
    const np1 = s.ids.filter((id) => id.startsWith('NP1-'));
    expect(np1).toHaveLength(5);
    expect(np1.some((id) => seenIds.some((i) => i.id === id))).toBe(false);
    const thin = diagnostic(ctxOf(pool(3)));
    expect(thin.short).toBe(true);
    expect(thin.ids).toHaveLength(15);
  });
});

describe('weak, requeue, smart', () => {
  const items = pool(12);
  it('weak puts the failing topic first and returns nothing without evidence', () => {
    expect(weak(ctxOf(items), 10).ids).toEqual([]);
    expect(weak(ctxOf(items), 10).short).toBe(true);
    const badTopic = items.filter((i) => i.topic === 'NP2-topic-a');
    const attempts = [
      ...badTopic.slice(0, 4).map((i) => att(i, 0, T0)),
      ...items.filter((i) => i.topic === 'NP3-topic-a').slice(0, 4).map((i) => att(i, 1, T0)),
    ];
    const ids = weak(ctxOf(items, attempts), 5).ids;
    expect(ids).toHaveLength(5);
    expect(ids.every((id) => items.find((i) => i.id === id)?.topic === 'NP2-topic-a')).toBe(true);
  });
  it('weak also surfaces a weak strategy tag', () => {
    const odd = items.map((i, k) => (k % 3 === 0 ? { ...i, strategy: 'Maslow: physiological first' } : i));
    const failing = odd.filter((i) => i.strategy === 'Maslow: physiological first').slice(0, 6);
    const ids = weak(ctxOf(odd, failing.map((i) => att(i, 0, T0))), 8).ids;
    expect(ids.some((id) => odd.find((i) => i.id === id)?.strategy === 'Maslow: physiological first')).toBe(true);
  });
  it('requeue keeps order, drops unknown and duplicate ids', () => {
    const s = requeue(ctxOf(items), ['NP1-3', 'ghost', 'NP1-1', 'NP1-3']);
    expect(s.ids).toEqual(['NP1-3', 'NP1-1']);
    expect(s.short).toBe(true);
    expect(requeue(ctxOf(items), ['NP1-0']).short).toBe(false);
  });
  it('smart never repeats items from the last 3 sessions', () => {
    const attempts: AttemptRecord[] = [];
    const lastFour = ['s1', 's2', 's3', 's4'];
    lastFour.forEach((sid, k) => {
      items.slice(k * 5, k * 5 + 5).forEach((i) => attempts.push(att(i, 0.5, T0 + k * DAY, { sessionId: sid })));
    });
    const blocked = new Set(attempts.filter((a) => a.sessionId !== 's1').map((a) => a.itemId));
    const s = smart(ctxOf(items, attempts), 20);
    expect(s.ids).toHaveLength(20);
    expect(new Set(s.ids).size).toBe(20);
    expect(s.ids.some((id) => blocked.has(id))).toBe(false);
  });
  it('smart mixes weak topics and unseen items, and is short when the pool is exhausted', () => {
    const attempts = items.filter((i) => i.topic === 'NP4-topic-a').map((i) => att(i, 0, T0, { sessionId: 'old1' }));
    const s = smart(ctxOf(items, attempts, 'x'), 20);
    const weakCount = s.ids.filter((id) => items.find((i) => i.id === id)?.topic === 'NP4-topic-a').length;
    expect(weakCount).toBeLessThanOrEqual(0); // those were in a recent session so blocked
    const attempts2 = items.filter((i) => i.topic === 'NP4-topic-a').map((i) => att(i, 0, T0 - 9 * DAY)); // no sessionId: not blocked
    const s2 = smart(ctxOf(items, attempts2, 'x'), 20);
    const weak2 = s2.ids.filter((id) => items.find((i) => i.id === id)?.topic === 'NP4-topic-a').length;
    expect(weak2).toBeGreaterThanOrEqual(Math.min(6, Math.round(20 * 0.4)));
    const all = items.map((i) => att(i, 1, T0, { sessionId: 'only' }));
    const blockedAll = smart(ctxOf(items, all), 10);
    expect(blockedAll.ids).toEqual([]);
    expect(blockedAll.short).toBe(true);
  });
});

describe('results', () => {
  const items = [
    mk('a1', 'NP1', { strategy: 'Assess before act', noteId: 'n1', topic: 'Pain' }),
    mk('a2', 'NP1', { strategy: 'Assess before act', noteId: 'n1', topic: 'Pain' }),
    mk('a3', 'NP1', { strategy: 'Assess before act', noteId: 'n2', topic: 'Wound' }),
    mk('b1', 'NP2', { strategy: 'Maslow', topic: 'Labor' }),
    mk('b2', 'NP2', { strategy: 'Maslow', topic: 'Labor' }),
    mk('s1', 'NP3', { type: 'sata', options: ['a', 'b', 'c', 'd', 'e'], answer: [0, 1], strategy: 'Maslow', topic: 'Fluids' }),
    mk('x1', 'NP3', { strategy: 'Maslow', topic: 'Fluids' }),
  ];
  function run() {
    let s = createSession({ id: 'sess-1', mode: 'custom', itemIds: items.map((i) => i.id), now: T0 });
    const by = (id: string) => items.find((i) => i.id === id) as BankItem;
    s = answerItem(s, by('a1'), [1]); // wrong
    s = answerItem(s, by('a2'), [2]); // wrong
    s = answerItem(s, by('a3'), [0]); // right
    s = answerItem(s, by('b1'), [0]); // right
    s = answerItem(s, by('b2'), [0]); // right
    s = answerItem(s, by('s1'), [0, 2]); // +1 -1 = 0 credit -> wrong
    s = flagItem(s, 'x1'); // flagged, unanswered
    return finishSession(s, T0 + 1000);
  }
  it('computes percent, area bars, patterns, review list and grid', () => {
    const s = run();
    const r = buildResult(s, items);
    expect(r.total).toBe(7);
    expect(r.areaBars.map((b) => b.area)).toEqual(['NP1', 'NP2', 'NP3']);
    expect(r.areaBars[0].percent).toBeCloseTo((1 / 3) * 100, 5);
    const p = r.patterns.find((x) => x.strategy === 'Assess before act');
    expect(p).toBeDefined();
    expect(p?.message).toContain('Assess before act');
    expect(r.patterns.find((x) => x.strategy === 'Maslow')).toBeUndefined();
    expect(r.review.find((t) => t.topic === 'Pain')).toEqual({ topic: 'Pain', missed: 2, noteIds: ['n1'] });
    expect(r.review.map((t) => t.topic)).toEqual(['Fluids', 'Pain']); // tie on 2 misses -> alphabetical
    expect(r.review.some((t) => t.topic === 'Wound')).toBe(false);
    expect(r.missedIds).toEqual(expect.arrayContaining(['a1', 'a2', 's1', 'x1']));
    expect(r.missedIds).not.toContain('a3');
    const g = Object.fromEntries(r.grid.map((c) => [c.itemId, c.status]));
    expect(g).toMatchObject({ a1: 'wrong', a3: 'correct', x1: 'flagged', b1: 'correct' });
    expect(r.grid.find((c) => c.itemId === 'x1')?.outcome).toBe('skipped');
    expect(r.grid.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('marks partial credit and recurring patterns', () => {
    let s = createSession({ id: 's2', mode: 'quick', itemIds: ['s1'], now: T0 });
    s = answerItem(s, items[5], [0, 1, 2]); // 2 right, 1 wrong -> (2-1)/2 = 0.5
    const r = buildResult(finishSession(s, T0 + 1), items);
    expect(r.grid[0].status).toBe('partial');
    const prior = [0, 1, 2, 3].map((k) => att(items[0], 0, T0 - k * DAY));
    const r2 = buildResult(run(), items, prior);
    expect(r2.patterns.find((x) => x.strategy === 'Assess before act')?.recurring).toBe(true);
  });
  it('agrees with summarize()', () => {
    const s = run();
    expect(buildResult(s, items).percent).toBe(summarize(s, items).percent);
  });
});

describe('history', () => {
  const items = [mk('h1', 'NP1'), mk('h2', 'NP1')];
  const entry = (id: string, mode: 'quick' | 'mock', at: number, pick: number[]) => {
    let s = createSession({ id, mode, itemIds: ['h1', 'h2'], now: at });
    s = answerItem(s, items[0], pick);
    s = finishSession(s, at + 10);
    return makeHistoryEntry(s, summarize(s, items), at + 10);
  };
  it('filters by mode, sorts newest first and summarizes', () => {
    const e = [entry('e1', 'quick', T0, [0]), entry('e2', 'mock', T0 + DAY, [1]), entry('e3', 'quick', T0 + 2 * DAY, [0])];
    expect(filterHistory(e).map((x) => x.id)).toEqual(['e3', 'e2', 'e1']);
    expect(filterHistory(e, { mode: 'quick' }).map((x) => x.id)).toEqual(['e3', 'e1']);
    expect(filterHistory(e, { mode: ['mock', 'quick'] })).toHaveLength(3);
    expect(historySummaryLine(e)).toBe('3 sessions · 3 answered · avg 33% · best 50%');
    expect(historySummaryLine([])).toBe('No sessions yet');
    expect(historySummaryLine([e[0]])).toBe('1 session · 1 answered · avg 50% · best 50%');
  });
});

describe('readiness', () => {
  const items = pool(40);
  const att30 = (area: Area, n: number, credit: number, at = T0) =>
    items.filter((i) => i.area === area).slice(0, n).map((i) => att(i, credit, at));

  it('is locked below 30 answered and unlocks at exactly 30', () => {
    const r29 = areaReadiness('NP1', items, att30('NP1', 29, 1), T0);
    expect(r29).toEqual({ state: 'locked', area: 'NP1', answered: 29, needed: READINESS_FLOOR });
    const r30 = areaReadiness('NP1', items, att30('NP1', 30, 1), T0);
    expect(r30.state).toBe('ready');
    if (r30.state === 'ready') { expect(r30.percent).toBeCloseTo(100, 6); expect(r30.band).toBe('on track'); }
  });
  it('band edges are lower-inclusive: 60 and 75', () => {
    expect(bandFor(59.99)).toBe('building');
    expect(bandFor(60)).toBe('approaching');
    expect(bandFor(74.99)).toBe('approaching');
    expect(bandFor(75)).toBe('on track');
  });
  it('recent answers outweigh old ones (14-day half-life)', () => {
    const oldBad = att30('NP2', 30, 0, T0 - 56 * DAY);
    const newGood = att30('NP2', 30, 1, T0);
    const a = areaReadiness('NP2', items, [...oldBad, ...newGood], T0);
    const b = areaReadiness('NP2', items, [...att30('NP2', 30, 1, T0 - 56 * DAY), ...att30('NP2', 30, 0, T0)], T0);
    if (a.state !== 'ready' || b.state !== 'ready') throw new Error('expected ready');
    expect(a.percent).toBeGreaterThan(90);
    expect(b.percent).toBeLessThan(10);
  });
  it('half-life: a 14-day-old miss weighs half a fresh one', () => {
    const fresh = att30('NP3', 30, 1, T0);
    const stale = items.filter((i) => i.area === 'NP3').slice(30, 40).map((i) => att(i, 0, T0 - 14 * DAY));
    const r = areaReadiness('NP3', items, [...fresh, ...stale], T0);
    if (r.state !== 'ready') throw new Error('expected ready');
    // weights: 30 fresh vs 10 * 0.5 = 5 stale -> about 30/35 = 85.7% (difficulty blend shifts it slightly)
    expect(r.percent).toBeGreaterThan(80);
    expect(r.percent).toBeLessThan(90);
  });
  it('overall: locked with no data, labelled, and flags an area under 60', () => {
    const none = readiness(items, [], T0);
    expect(none.state).toBe('locked');
    expect(none.label).toBe(OVERALL_LABEL);
    expect(none.label).toBe('practice estimate, not a pass prediction');
    expect(none.percent).toBeNull();
    const attempts = [...att30('NP1', 30, 1), ...att30('NP2', 30, 1), ...att30('NP3', 30, 0.5)];
    const o = readiness(items, attempts, T0);
    expect(o.state).toBe('ready');
    expect(o.unlockedAreas).toEqual(['NP1', 'NP2', 'NP3']);
    expect(o.lockedAreas).toEqual(['NP4', 'NP5']);
    expect(o.noAreaBelow60).toBe(false);
    expect(o.percent).toBeCloseTo((100 + 100 + 50) / 3, 4);
    expect(o.band).toBe('approaching'); // 83% average is 'on track' by edge, but one area is under 60: capped
    const good = readiness(items, [...att30('NP1', 30, 1), ...att30('NP2', 30, 0.8)], T0);
    expect(good.noAreaBelow60).toBe(true);
    expect(good.band).toBe('on track');
  });
});

describe('masteryTag', () => {
  const mkA = (credits: number[]) => credits.map((c, k) => ({
    itemId: `i${k}`, credit: c, seconds: 1, at: T0 + k, area: 'NP1' as Area, topic: 't', strategy: 's',
  }));
  it('learning / reviewing / mastered from last-N accuracy', () => {
    expect(masteryTag(mkA([1, 1]))).toBe('learning');
    expect(masteryTag(mkA([1, 1, 1, 1]))).toBe('reviewing');
    expect(masteryTag(mkA([0, 1, 1, 1, 1, 1]))).toBe('mastered'); // only the last 5 count
    expect(masteryTag(mkA([1, 1, 1, 1, 1, 0]))).toBe('reviewing'); // 4/5 = 80%
    expect(masteryTag(mkA([1, 0, 0, 0, 1]))).toBe('learning');
    expect(masteryTag(mkA([1, 1, 0, 0, 1]))).toBe('reviewing'); // 60% edge
  });
});
