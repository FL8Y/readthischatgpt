// Manila-day streak and daily goal over stored attempts. Pure: callers pass `today` (a Manila dayKey).
import { dayKey, daysBetween } from './clock';
import type { AttemptRecord } from './types2';

export const MILESTONES: readonly number[] = [3, 7, 14, 30, 60, 100, 365];
export const DEFAULT_GOAL_PER_DAY = 10;

export interface StreakInfo {
  /** Days in a row ending today (or yesterday, if today has no answer yet). */
  current: number;
  longest: number;
  /** True once today has at least one answer. */
  activeToday: boolean;
  /** Latest Manila day with an answer, or null. */
  lastDay: string | null;
  /** Highest milestone reached by the current streak, or null. */
  milestone: number | null;
  /** Next milestone to reach, or null after 365. */
  nextMilestone: number | null;
  /** Days left to the next milestone (0 when none). */
  toNextMilestone: number;
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

/** Manila days that have at least one answer. */
export function activeDays(attempts: readonly AttemptRecord[]): Set<string> {
  const s = new Set<string>();
  for (const a of attempts) s.add(dayKey(a.at));
  return s;
}

export function answeredOn(attempts: readonly AttemptRecord[], day: string): number {
  let n = 0;
  for (const a of attempts) if (dayKey(a.at) === day) n++;
  return n;
}

export function milestoneInfo(streak: number): { milestone: number | null; next: number | null; toNext: number } {
  let milestone: number | null = null;
  for (const m of MILESTONES) if (streak >= m) milestone = m;
  const next = MILESTONES.find((m) => m > streak) ?? null;
  return { milestone, next, toNext: next === null ? 0 : next - streak };
}

/**
 * A day counts if it has >= 1 answer. The streak is alive if today or yesterday is active
 * (so it does not read 0 in the morning before the first answer); a missed full day resets it.
 */
export function computeStreak(attempts: readonly AttemptRecord[], today: string): StreakInfo {
  const days = activeDays(attempts);
  const activeToday = days.has(today);
  let current = 0;
  let cursor = activeToday ? today : addDays(today, -1);
  while (days.has(cursor)) { current++; cursor = addDays(cursor, -1); }

  const sorted = [...days].filter((d) => daysBetween(d, today) >= 0).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev !== null && daysBetween(prev, d) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }
  longest = Math.max(longest, current);
  const m = milestoneInfo(current);
  return {
    current, longest, activeToday,
    lastDay: sorted.length ? sorted[sorted.length - 1] : null,
    milestone: m.milestone, nextMilestone: m.next, toNextMilestone: m.toNext,
  };
}

export interface GoalProgress { answered: number; goal: number; fraction: number; met: boolean; remaining: number }

const cleanGoal = (perDay: number): number => Math.max(1, Math.floor(perDay) || DEFAULT_GOAL_PER_DAY);

export function goalProgress(attempts: readonly AttemptRecord[], today: string, goal: { perDay: number }): GoalProgress {
  const g = cleanGoal(goal.perDay);
  const answered = answeredOn(attempts, today);
  return { answered, goal: g, fraction: Math.min(1, answered / g), met: answered >= g, remaining: Math.max(0, g - answered) };
}

/** Last `span` days (newest last) with answer counts and whether each met the goal. */
export function goalDays(attempts: readonly AttemptRecord[], today: string, goal: { perDay: number }, span = 7): { day: string; answered: number; met: boolean }[] {
  const g = cleanGoal(goal.perDay);
  const out: { day: string; answered: number; met: boolean }[] = [];
  for (let k = span - 1; k >= 0; k--) {
    const day = addDays(today, -k);
    const answered = answeredOn(attempts, day);
    out.push({ day, answered, met: answered >= g });
  }
  return out;
}
