import type { AttemptEvent, Topic } from './types';
import { answerWeight } from './grading';

const HALF_LIFE_DAYS = 14;
const DAY_MS = 86_400_000;

export interface MasteryEstimate {
  topicId: string;
  /** Recency-weighted accuracy with a neutral prior, 0..1. */
  mastery: number;
  /** How much evidence backs the estimate, 0..1. Separate from accuracy. */
  confidence: number;
  attempts: number;
}

/** Drops repeated event ids so replays never double count. */
export function dedupeEvents(events: AttemptEvent[]): AttemptEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

export function estimateMastery(topicId: string, events: AttemptEvent[], now: number): MasteryEstimate {
  const mine = dedupeEvents(events).filter((e) => e.topicId === topicId);
  // Beta(1,1) prior: with no evidence the estimate is 0.5 and confidence is 0.
  let right = 1;
  let wrong = 1;
  let weight = 0;
  for (const e of mine) {
    const w = Math.pow(0.5, Math.max(0, now - e.at) / DAY_MS / HALF_LIFE_DAYS);
    weight += w;
    if (e.correct) right += w;
    else wrong += w;
  }
  return {
    topicId,
    mastery: right / (right + wrong),
    confidence: weight / (weight + 4),
    attempts: mine.length,
  };
}

export interface PlanItem {
  topicId: string;
  title: string;
  priority: number;
  reason: string;
}

/**
 * Deterministic teaching order: weakest and least-evidenced topics first.
 * Identical evidence always yields an identical order (ties break on title, then id).
 */
export function planOrder(topics: Topic[], events: AttemptEvent[], now: number): PlanItem[] {
  return topics
    .map((t) => {
      const m = estimateMastery(t.id, events, now);
      const priority = Number(((1 - m.mastery) * (1 + (1 - m.confidence))).toFixed(6));
      const reason =
        m.attempts === 0
          ? 'No evidence yet'
          : `${Math.round(m.mastery * 100)}% estimated mastery from ${m.attempts} attempt(s)`;
      return { topicId: t.id, title: t.title, priority, reason };
    })
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title) || a.topicId.localeCompare(b.topicId));
}

export function weakTopics(topics: Topic[], events: AttemptEvent[], now: number, limit = 5): PlanItem[] {
  return planOrder(topics, events, now)
    .filter((p) => {
      const m = estimateMastery(p.topicId, events, now);
      return m.attempts > 0 && m.mastery < 0.6;
    })
    .slice(0, limit);
}

export const POINTS = { correct: 10, streakDay: 5, topicDone: 20 } as const;

export function dayKey(at: number, tzOffsetMinutes: number): number {
  return Math.floor((at - tzOffsetMinutes * 60_000) / DAY_MS);
}

/** Consecutive study days ending today (or yesterday, so the streak is not lost until a day is missed). */
export function currentStreak(events: AttemptEvent[], now: number, tzOffsetMinutes = 0): number {
  const days = new Set(dedupeEvents(events).map((e) => dayKey(e.at, tzOffsetMinutes)));
  let day = dayKey(now, tzOffsetMinutes);
  if (!days.has(day)) day -= 1;
  let n = 0;
  while (days.has(day)) {
    n += 1;
    day -= 1;
  }
  return n;
}

export function totalPoints(events: AttemptEvent[], now: number, tzOffsetMinutes = 0): number {
  const unique = dedupeEvents(events);
  const correct = Math.round(unique.reduce((n, e) => n + POINTS.correct * answerWeight(e), 0));
  return correct + currentStreak(unique, now, tzOffsetMinutes) * POINTS.streakDay;
}

export const RANKS = ['Student', 'Learner', 'Practitioner', 'Specialist', 'Expert', 'Master'] as const;

export function rankFor(points: number): { rank: (typeof RANKS)[number]; level: number } {
  const level = Math.floor(Math.sqrt(Math.max(0, points) / 50)) + 1;
  return { rank: RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 3))], level };
}

/** Points needed to reach `level` (level 1 starts at 0). Inverse of the formula in rankFor. */
export function pointsForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 50 * (l - 1) * (l - 1);
}

export interface LevelProgress {
  level: number;
  rank: (typeof RANKS)[number];
  /** Points earned inside the current level. */
  into: number;
  /** Points the current level spans. */
  span: number;
  /** 0..1 progress to the next level. */
  fraction: number;
  toNext: number;
}

export function levelProgress(points: number): LevelProgress {
  const p = Math.max(0, points);
  const { rank, level } = rankFor(p);
  const start = pointsForLevel(level);
  const span = pointsForLevel(level + 1) - start;
  const into = p - start;
  return { level, rank, into, span, fraction: Math.min(1, Math.max(0, into / span)), toNext: span - into };
}

export interface NextAction {
  /** Which app tab the action belongs to. */
  tab: 'study' | 'library';
  title: string;
  detail: string;
}

/** Picks one clear next step from simple facts. Pure and deterministic. */
export function recommendNext(input: {
  topicCount: number;
  diagnosticsDone: number;
  attempts: number;
  weakTitle?: string;
}): NextAction {
  if (input.topicCount === 0) {
    return { tab: 'library', title: 'Add your first notes', detail: 'Paste or import notes so there is something to study.' };
  }
  if (input.diagnosticsDone === 0) {
    return { tab: 'study', title: 'Take the diagnostic', detail: 'It decides which topics to teach first.' };
  }
  if (input.weakTitle) {
    return { tab: 'study', title: `Review ${input.weakTitle}`, detail: 'This is your weakest topic right now.' };
  }
  if (input.attempts === 0) {
    return { tab: 'study', title: 'Start a quiz', detail: 'Answer a few questions to build your progress.' };
  }
  return { tab: 'study', title: 'Keep your streak going', detail: 'A short quiz today keeps your streak alive.' };
}
