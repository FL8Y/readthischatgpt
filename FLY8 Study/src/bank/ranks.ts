// Original rank ladder: 9 tiers, up to 3 stars each. Pure.
import type { AttemptRecord } from './types2';

export interface Tier { n: number; name: string; minAnswered: number; minAccuracy: number }

/** A tier needs both enough answers and a minimum accuracy (0..1) over recent answers. */
export const TIERS: readonly Tier[] = [
  { n: 1, name: 'Orientee', minAnswered: 0, minAccuracy: 0 },
  { n: 2, name: 'Ward Walker', minAnswered: 25, minAccuracy: 0 },
  { n: 3, name: 'Bedside Learner', minAnswered: 75, minAccuracy: 0.45 },
  { n: 4, name: 'Vitals Tracker', minAnswered: 150, minAccuracy: 0.5 },
  { n: 5, name: 'Care Planner', minAnswered: 300, minAccuracy: 0.55 },
  { n: 6, name: 'Ward Anchor', minAnswered: 500, minAccuracy: 0.6 },
  { n: 7, name: 'Clinical Sharp', minAnswered: 800, minAccuracy: 0.65 },
  { n: 8, name: 'Board Contender', minAnswered: 1200, minAccuracy: 0.7 },
  { n: 9, name: 'Board Ready', minAnswered: 2000, minAccuracy: 0.75 },
];

export const STAR_ACCURACY = 0.75; // star 1: accuracy at or above this
export const STAR_STREAK = 7; // star 2: current streak at or above this
export const STAR_FLAWLESS = 3; // star 3: flawless runs at or above this
export const FLAWLESS_MIN_ITEMS = 5;
export const ACCURACY_WINDOW = 100; // most recent answers that feed accuracy

export interface RankStats {
  answered: number;
  /** 0..1 over the recent window. */
  accuracy: number;
  streak: number;
  flawlessRuns: number;
}

export interface TierInfo {
  tier: number;
  name: string;
  stars: 0 | 1 | 2 | 3;
  /** Star conditions met, in order: accuracy, streak, flawless runs. */
  starsMet: [boolean, boolean, boolean];
  next: { tier: number; name: string; answeredNeeded: number; minAccuracy: number } | null;
  /** 0..1 progress of the answered count toward the next tier (1 at the top). */
  progress: number;
}

/** Sessions where every answer earned full credit (at least `minItems` answers). */
export function flawlessRuns(attempts: readonly AttemptRecord[], minItems = FLAWLESS_MIN_ITEMS): number {
  const g = new Map<string, { n: number; ok: boolean }>();
  for (const a of attempts) {
    if (!a.sessionId) continue;
    const e = g.get(a.sessionId) ?? { n: 0, ok: true };
    e.n++;
    if (a.credit < 1) e.ok = false;
    g.set(a.sessionId, e);
  }
  let runs = 0;
  for (const e of g.values()) if (e.ok && e.n >= minItems) runs++;
  return runs;
}

export function recentAccuracy(attempts: readonly AttemptRecord[], window = ACCURACY_WINDOW): number {
  if (!attempts.length) return 0;
  const recent = [...attempts].sort((a, b) => b.at - a.at).slice(0, window);
  return recent.reduce((s, a) => s + a.credit, 0) / recent.length;
}

export function rankStats(attempts: readonly AttemptRecord[], streak: number): RankStats {
  return { answered: attempts.length, accuracy: recentAccuracy(attempts), streak, flawlessRuns: flawlessRuns(attempts) };
}

export function tierFor(stats: RankStats): TierInfo {
  let idx = 0;
  TIERS.forEach((t, i) => {
    if (stats.answered >= t.minAnswered && stats.accuracy >= t.minAccuracy) idx = i;
  });
  const t = TIERS[idx];
  const starsMet: [boolean, boolean, boolean] = [
    stats.answered > 0 && stats.accuracy >= STAR_ACCURACY,
    stats.streak >= STAR_STREAK,
    stats.flawlessRuns >= STAR_FLAWLESS,
  ];
  const stars = starsMet.filter(Boolean).length as 0 | 1 | 2 | 3;
  const nt = TIERS[idx + 1];
  const progress = nt ? Math.min(1, Math.max(0, (stats.answered - t.minAnswered) / (nt.minAnswered - t.minAnswered))) : 1;
  return {
    tier: t.n, name: t.name, stars, starsMet,
    next: nt ? { tier: nt.n, name: nt.name, answeredNeeded: Math.max(0, nt.minAnswered - stats.answered), minAccuracy: nt.minAccuracy } : null,
    progress,
  };
}

export const starsText = (stars: number): string => `${stars} of 3 stars`;
