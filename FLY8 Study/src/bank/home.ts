// Home dashboard summary for the practice loop. Pure.
import { readiness, type OverallReadiness } from './readiness';
import type { Area, BankItem } from './schema';
import { rankStats, tierFor, type TierInfo } from './ranks';
import { computeStreak, goalProgress, answeredOn, type StreakInfo } from './streak';
import { topicStats } from './statsData';
import type { AttemptRecord } from './types2';

export interface WeakTopic { topic: string; area: Area; percent: number; seen: number }

export interface HomeSummary {
  answeredToday: number;
  goalPerDay: number;
  goalFraction: number;
  goalMet: boolean;
  streak: StreakInfo;
  rank: TierInfo;
  readiness: OverallReadiness;
  weakestTopics: WeakTopic[];
  /** Missed items waiting in the re-queue today. */
  dueCount: number;
}

export interface HomeInput {
  attempts: readonly AttemptRecord[];
  items: readonly BankItem[];
  /** Manila dayKey, 'YYYY-MM-DD'. */
  today: string;
  goal: { perDay: number };
  requeueDue: number;
  /** Epoch ms for the readiness decay; defaults to the end of `today` in Manila time. */
  now?: number;
}

export const WEAK_MIN_SEEN = 3;

export function buildHomeSummary(i: HomeInput): HomeSummary {
  const now = i.now ?? Date.parse(`${i.today}T23:59:59+08:00`);
  const streak = computeStreak(i.attempts, i.today);
  const goal = goalProgress(i.attempts, i.today, i.goal);
  const weakest = topicStats(i.attempts, i.items)
    .filter((t) => t.percent !== null && t.correct + t.wrong >= WEAK_MIN_SEEN)
    .slice(0, 3)
    .map((t) => ({ topic: t.topic, area: t.area, percent: t.percent as number, seen: t.correct + t.wrong }));
  return {
    answeredToday: answeredOn(i.attempts, i.today),
    goalPerDay: goal.goal,
    goalFraction: goal.fraction,
    goalMet: goal.met,
    streak,
    rank: tierFor(rankStats(i.attempts, streak.current)),
    readiness: readiness(i.items, i.attempts, now),
    weakestTopics: weakest,
    dueCount: Math.max(0, Math.floor(i.requeueDue) || 0),
  };
}
