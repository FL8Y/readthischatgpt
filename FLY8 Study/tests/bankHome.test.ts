import { describe, expect, it } from 'vitest';
import { buildHomeSummary } from '../src/bank/home';
import { TIERS, flawlessRuns, tierFor } from '../src/bank/ranks';
import { MILESTONES, computeStreak, goalProgress, milestoneInfo } from '../src/bank/streak';
import {
  areaAccuracy, formatWhen, gridCounts, pathFor, readinessText, topicStats, trendDays, trendGeometry,
} from '../src/bank/statsData';
import type { BankItem } from '../src/bank/schema';
import type { AttemptRecord } from '../src/bank/types2';

const DAY = 86400000;
// 2026-10-19 00:00 Manila = 2026-10-18T16:00:00Z
const MANILA_MIDNIGHT = Date.parse('2026-10-18T16:00:00Z');
const TODAY = '2026-10-19';
const at = (daysAgo: number, hourManila = 12) => MANILA_MIDNIGHT - daysAgo * DAY + hourManila * 3600000;

function att(p: Partial<AttemptRecord> & { at: number }): AttemptRecord {
  return { itemId: 'i1', credit: 1, seconds: 20, area: 'NP1', topic: 'T', strategy: 'ABCs', ...p };
}
function item(id: string, topic = 'T', area: BankItem['area'] = 'NP1'): BankItem {
  return {
    id, v: 2, type: 'single', area, topic, vignette: 'v', stem: 's', options: ['a', 'b', 'c', 'd'], answer: [0],
    rationale: 'x'.repeat(50), optionRationales: [], strategy: 'ABCs', difficulty: 3, source: 'gold', review: 'unreviewed', aiWritten: true,
  };
}

describe('streak', () => {
  it('is 0 with no attempts', () => {
    expect(computeStreak([], TODAY)).toMatchObject({ current: 0, longest: 0, activeToday: false, lastDay: null });
  });

  it('counts consecutive Manila days including today', () => {
    const a = [att({ at: at(0) }), att({ at: at(1) }), att({ at: at(2) })];
    const s = computeStreak(a, TODAY);
    expect(s.current).toBe(3);
    expect(s.activeToday).toBe(true);
    expect(s.milestone).toBe(3);
    expect(s.nextMilestone).toBe(7);
    expect(s.toNextMilestone).toBe(4);
  });

  it('stays alive when only yesterday is active, and resets after a missed day', () => {
    expect(computeStreak([att({ at: at(1) }), att({ at: at(2) })], TODAY)).toMatchObject({ current: 2, activeToday: false });
    expect(computeStreak([att({ at: at(2) }), att({ at: at(3) })], TODAY).current).toBe(0);
  });

  it('splits days at Manila midnight, not UTC midnight', () => {
    // 23:30 Manila on Oct 18 and 00:30 Manila on Oct 19 are different days, 1 hour apart.
    const a = [att({ at: MANILA_MIDNIGHT - 30 * 60000 }), att({ at: MANILA_MIDNIGHT + 30 * 60000 })];
    expect(computeStreak(a, TODAY).current).toBe(2);
    // 07:59 and 08:01 Manila fall on the same UTC date boundary issue: both Oct 19 in Manila.
    const b = [att({ at: MANILA_MIDNIGHT + 1000 }), att({ at: MANILA_MIDNIGHT + 23 * 3600000 })];
    expect(computeStreak(b, TODAY).current).toBe(1);
  });

  it('tracks the longest run across a gap', () => {
    const a = [10, 9, 8, 7, 6, 1, 0].map((d) => att({ at: at(d) }));
    const s = computeStreak(a, TODAY);
    expect(s.current).toBe(2);
    expect(s.longest).toBe(5);
  });

  it('ignores attempts after today for the longest run', () => {
    expect(computeStreak([att({ at: at(-3) })], TODAY)).toMatchObject({ current: 0, longest: 0 });
  });

  it('milestones at 3/7/14/30/60/100/365', () => {
    expect(MILESTONES).toEqual([3, 7, 14, 30, 60, 100, 365]);
    expect(milestoneInfo(0)).toEqual({ milestone: null, next: 3, toNext: 3 });
    expect(milestoneInfo(2).milestone).toBeNull();
    expect(milestoneInfo(3).milestone).toBe(3);
    expect(milestoneInfo(13)).toEqual({ milestone: 7, next: 14, toNext: 1 });
    expect(milestoneInfo(100)).toEqual({ milestone: 100, next: 365, toNext: 265 });
    expect(milestoneInfo(400)).toEqual({ milestone: 365, next: null, toNext: 0 });
  });

  it('tracks the daily goal', () => {
    const a = [att({ at: at(0) }), att({ at: at(0, 13) }), att({ at: at(1) })];
    expect(goalProgress(a, TODAY, { perDay: 4 })).toEqual({ answered: 2, goal: 4, fraction: 0.5, met: false, remaining: 2 });
    expect(goalProgress(a, TODAY, { perDay: 2 }).met).toBe(true);
    expect(goalProgress([], TODAY, { perDay: 0 }).goal).toBe(10);
  });
});

describe('ranks', () => {
  const base = { answered: 0, accuracy: 0, streak: 0, flawlessRuns: 0 };
  it('has 9 tiers with unique names', () => {
    expect(TIERS).toHaveLength(9);
    expect(new Set(TIERS.map((t) => t.name)).size).toBe(9);
  });
  it('picks the tier by answers and accuracy', () => {
    expect(tierFor(base)).toMatchObject({ tier: 1, name: 'Orientee', stars: 0 });
    expect(tierFor({ ...base, answered: 25 }).tier).toBe(2);
    expect(tierFor({ ...base, answered: 75, accuracy: 0.44 }).tier).toBe(2);
    expect(tierFor({ ...base, answered: 75, accuracy: 0.45 }).tier).toBe(3);
    expect(tierFor({ ...base, answered: 5000, accuracy: 0.5 }).tier).toBe(4);
    expect(tierFor({ ...base, answered: 2000, accuracy: 0.75 })).toMatchObject({ tier: 9, name: 'Board Ready', next: null, progress: 1 });
  });
  it('reports progress to the next tier', () => {
    const t = tierFor({ ...base, answered: 50 });
    expect(t.tier).toBe(2);
    expect(t.next).toMatchObject({ tier: 3, answeredNeeded: 25 });
    expect(t.progress).toBeCloseTo(0.5);
  });
  it('awards stars for accuracy, streak and flawless runs', () => {
    expect(tierFor({ ...base, answered: 30, accuracy: 0.75 }).stars).toBe(1);
    expect(tierFor({ ...base, answered: 30, accuracy: 0.74 }).stars).toBe(0);
    expect(tierFor({ ...base, answered: 30, accuracy: 0.8, streak: 7 }).stars).toBe(2);
    expect(tierFor({ ...base, answered: 30, streak: 6 }).stars).toBe(0);
    expect(tierFor({ answered: 30, accuracy: 0.9, streak: 9, flawlessRuns: 3 })).toMatchObject({ stars: 3, starsMet: [true, true, true] });
    expect(tierFor({ ...base, answered: 30, flawlessRuns: 2 }).stars).toBe(0);
  });
  it('counts flawless runs only for full sessions of 5+', () => {
    const run = (s: string, n: number, bad = false) =>
      Array.from({ length: n }, (_, k) => att({ at: 1000 + k, sessionId: s, credit: bad && k === 0 ? 0.5 : 1 }));
    expect(flawlessRuns([...run('a', 5), ...run('b', 4), ...run('c', 6, true), ...run('d', 8)])).toBe(2);
    expect(flawlessRuns([att({ at: 1 })])).toBe(0);
  });
});

describe('stats data builders', () => {
  it('orders area accuracy weakest first', () => {
    const a = [
      att({ at: 1, area: 'NP1', credit: 1 }), att({ at: 2, area: 'NP1', credit: 1 }),
      att({ at: 3, area: 'NP2', credit: 0 }), att({ at: 4, area: 'NP2', credit: 1 }),
      att({ at: 5, area: 'NP3', credit: 0 }),
    ];
    const r = areaAccuracy(a);
    expect(r.map((x) => x.area)).toEqual(['NP3', 'NP2', 'NP1']);
    expect(r[1]).toMatchObject({ percent: 50, answered: 2 });
  });

  it('builds a 14-day trend with gaps', () => {
    const a = [att({ at: at(0), credit: 1 }), att({ at: at(0, 14), credit: 0 }), att({ at: at(13), credit: 1 }), att({ at: at(20), credit: 0 })];
    const t = trendDays(a, TODAY);
    expect(t).toHaveLength(14);
    expect(t[0]).toMatchObject({ day: '2026-10-06', percent: 100, answered: 1 });
    expect(t[13]).toMatchObject({ day: TODAY, percent: 50, answered: 2 });
    expect(t[5].percent).toBeNull();
  });

  it('plots geometry and breaks runs at empty days', () => {
    const pts = [
      { day: 'a', label: 'a', percent: 0, answered: 1 },
      { day: 'b', label: 'b', percent: 100, answered: 1 },
      { day: 'c', label: 'c', percent: null, answered: 0 },
      { day: 'd', label: 'd', percent: 50, answered: 1 },
    ];
    const g = trendGeometry(pts, 108, 108, 4);
    expect(g.runs).toHaveLength(2);
    expect(g.runs[0][0]).toEqual({ x: 4, y: 104 });
    expect(g.runs[0][1].x).toBeCloseTo(4 + 100 / 3, 5);
    expect(g.runs[0][1].y).toBe(4);
    expect(g.dots).toHaveLength(3);
    expect(pathFor(g.runs[1])).toBe('M104.0 54.0');
    expect(pathFor(g.runs[0])).toMatch(/^M4\.0 104\.0 L/);
  });

  it('counts Correct/Wrong/Unseen per topic from the latest attempt', () => {
    const items = [item('a', 'Heart'), item('b', 'Heart'), item('c', 'Heart'), item('d', 'Lungs', 'NP3')];
    const attempts = [
      att({ itemId: 'a', at: 1, credit: 0 }), att({ itemId: 'a', at: 2, credit: 1 }),
      att({ itemId: 'b', at: 3, credit: 0.5 }),
    ];
    const s = topicStats(attempts, items);
    const heart = s.find((t) => t.topic === 'Heart')!;
    expect(heart).toMatchObject({ correct: 1, wrong: 1, unseen: 1, total: 3, percent: 50 });
    const lungs = s.find((t) => t.topic === 'Lungs')!;
    expect(lungs).toMatchObject({ unseen: 1, percent: null });
    expect(s[0].topic).toBe('Heart');
  });

  it('counts grid statuses, flagged separately', () => {
    const c = gridCounts([
      { status: 'correct', outcome: 'correct' }, { status: 'flagged', outcome: 'wrong' }, { status: 'skipped', outcome: 'skipped' },
    ]);
    expect(c).toEqual({ correct: 1, partial: 0, wrong: 1, skipped: 1, flagged: 1 });
  });

  it('formats Manila time', () => {
    expect(formatWhen(MANILA_MIDNIGHT + 14 * 3600000 + 5 * 60000)).toBe('Oct 19, 2:05 PM');
    expect(formatWhen(MANILA_MIDNIGHT + 30 * 60000)).toBe('Oct 19, 12:30 AM');
  });

  it('explains locked readiness with the 30-answer rule', () => {
    const t = readinessText(undefined);
    expect(t.locked).toBe(true);
    expect(t.detail).toContain('30');
  });
});

describe('buildHomeSummary', () => {
  it('summarises an empty learner', () => {
    const h = buildHomeSummary({ attempts: [], items: [item('a')], today: TODAY, goal: { perDay: 10 }, requeueDue: 0 });
    expect(h).toMatchObject({ answeredToday: 0, goalPerDay: 10, goalMet: false, dueCount: 0, weakestTopics: [] });
    expect(h.streak.current).toBe(0);
    expect(h.rank.name).toBe('Orientee');
    expect(h.readiness.state).toBe('locked');
  });

  it('summarises answers, weak topics and readiness', () => {
    const items = Array.from({ length: 40 }, (_, k) => item(`n${k}`, k < 20 ? 'Heart' : 'Lungs'));
    const attempts: AttemptRecord[] = [];
    items.forEach((it, k) => {
      attempts.push(att({ itemId: it.id, at: at(0, 8) + k * 1000, topic: it.topic, credit: it.topic === 'Heart' ? 1 : 0, sessionId: 's1' }));
    });
    const h = buildHomeSummary({ attempts, items, today: TODAY, goal: { perDay: 30 }, requeueDue: 4 });
    expect(h.answeredToday).toBe(40);
    expect(h.goalMet).toBe(true);
    expect(h.goalFraction).toBe(1);
    expect(h.dueCount).toBe(4);
    expect(h.weakestTopics[0]).toMatchObject({ topic: 'Lungs', percent: 0, seen: 20 });
    expect(h.readiness.state).toBe('ready');
    expect(h.streak.current).toBe(1);
    expect(h.rank.tier).toBe(2);
  });
});
