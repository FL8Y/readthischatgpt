/**
 * Spaced-repetition scheduler.
 *
 * Algorithm : "SM-2-lite", scheduler version 1 (SCHEDULER_VERSION). A simplified SM-2 with Anki-style
 *             learning steps. It is NOT FSRS and NOT parity with AnkiDroid's scheduler.
 * Source    : SM-2 by Piotr Wozniak (SuperMemo, 1990). The algorithm is published and unpatented;
 *             this is an independent re-implementation, no code copied. The FSRS-5 reference file in
 *             the research folder was read as evidence only (ADR-004).
 * Behaviour : new cards walk through LEARNING_STEPS_MIN (1 min, 10 min); Good on the last step
 *             graduates to 1 day, Easy graduates to 4 days. In review, Good multiplies the interval by
 *             the ease (start 2.5), Hard by 1.2, Easy by ease*1.3; Again is a lapse: ease -0.2
 *             (floor 1.3), the card enters relearning (10 min) and returns with half its old interval.
 * Limits    : no fuzz, no per-user parameter fitting, no leech handling, no calendar-day boundary
 *             (intervals are whole days from the review moment), no retrievability model. Fine for one
 *             learner; not validated against real retention data.
 * Purity    : no clocks, no randomness, no I/O. `now` / `event.at` are always parameters.
 */
import type { AttemptEvent, Topic } from '../core/types';
import { estimateMastery } from '../core/mastery';

export const SCHEDULER_VERSION = 1;
export const MIN = 60_000;
export const DAY = 86_400_000;
export const LEARNING_STEPS_MIN = [1, 10] as const;
export const RELEARN_STEP_MIN = 10;
export const START_EASE = 2.5;
export const MIN_EASE = 1.3;
export const GRADUATE_DAYS = 1;
export const EASY_GRADUATE_DAYS = 4;

export const RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type Rating = (typeof RATINGS)[number];
export type CardPhase = 'new' | 'learning' | 'review' | 'relearning';

export interface CardSched {
  cardId: string;
  phase: CardPhase;
  /** Epoch ms when the card is next due. */
  due: number;
  /** Review interval in days (0 until graduated). */
  intervalDays: number;
  ease: number;
  /** Index into the learning steps while learning. */
  step: number;
  reps: number;
  lapses: number;
  lastReviewAt?: number;
  /** Interval to resume with after relearning. */
  resumeDays?: number;
}

export interface ReviewEvent {
  /** Unique id: replaying the same event never double counts or reschedules. */
  id: string;
  cardId: string;
  rating: Rating;
  at: number;
}

export function newSched(cardId: string, now: number): CardSched {
  return { cardId, phase: 'new', due: now, intervalDays: 0, ease: START_EASE, step: 0, reps: 0, lapses: 0 };
}

const clampEase = (e: number) => Math.max(MIN_EASE, Math.round(e * 100) / 100);

/** The scheduling result of one rating. Pure: depends only on its arguments. */
export function schedule(prev: CardSched, rating: Rating, at: number): CardSched {
  const base: CardSched = { ...prev, reps: prev.reps + 1, lastReviewAt: at };
  const learnDue = (step: number) => at + LEARNING_STEPS_MIN[step] * MIN;
  const graduate = (days: number, ease = prev.ease): CardSched => ({
    ...base,
    phase: 'review',
    step: 0,
    intervalDays: days,
    ease,
    due: at + days * DAY,
    resumeDays: undefined,
  });

  if (prev.phase === 'new' || prev.phase === 'learning') {
    const step = prev.phase === 'new' ? 0 : prev.step;
    if (rating === 'again') return { ...base, phase: 'learning', step: 0, due: learnDue(0) };
    if (rating === 'hard') return { ...base, phase: 'learning', step, due: learnDue(step) };
    if (rating === 'easy') return graduate(EASY_GRADUATE_DAYS);
    const next = step + 1;
    return next >= LEARNING_STEPS_MIN.length
      ? graduate(GRADUATE_DAYS)
      : { ...base, phase: 'learning', step: next, due: learnDue(next) };
  }

  if (prev.phase === 'relearning') {
    const back = Math.max(1, prev.resumeDays ?? 1);
    if (rating === 'again' || rating === 'hard') return { ...base, due: at + RELEARN_STEP_MIN * MIN };
    return graduate(rating === 'easy' ? back + 1 : back);
  }

  // review
  const iv = Math.max(1, prev.intervalDays);
  if (rating === 'again') {
    return {
      ...base,
      phase: 'relearning',
      step: 0,
      lapses: prev.lapses + 1,
      ease: clampEase(prev.ease - 0.2),
      resumeDays: Math.max(1, Math.round(iv * 0.5)),
      due: at + RELEARN_STEP_MIN * MIN,
    };
  }
  const hard = Math.max(iv + 1, Math.round(iv * 1.2));
  const good = Math.max(hard + 1, Math.round(iv * prev.ease));
  const easy = Math.max(good + 1, Math.round(iv * prev.ease * 1.3));
  if (rating === 'hard') return graduate(hard, clampEase(prev.ease - 0.15));
  if (rating === 'good') return graduate(good);
  return graduate(easy, clampEase(prev.ease + 0.15));
}

/** Applies an event. A repeated event id (checked against `seen`) or a mismatched card changes nothing. */
export function applyReview(prev: CardSched, ev: ReviewEvent, seen: ReadonlySet<string> = new Set()): CardSched {
  if (seen.has(ev.id) || ev.cardId !== prev.cardId) return prev;
  return schedule(prev, ev.rating, ev.at);
}

/** Delay until the next showing for each rating, in ms (for the button labels). */
export function previewDelays(prev: CardSched, at: number): Record<Rating, number> {
  const out = {} as Record<Rating, number>;
  for (const r of RATINGS) out[r] = schedule(prev, r, at).due - at;
  return out;
}

export function formatInterval(ms: number): string {
  if (ms < MIN * 59.5) return `${Math.max(1, Math.round(ms / MIN))}m`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}h`;
  const d = Math.round(ms / DAY);
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

export const isDue = (s: CardSched, now: number) => s.due <= now;

export interface QueueItem {
  cardId: string;
  topicId: string;
  priority: number;
}

/**
 * Due queue. Learning/relearning cards (minutes away) come first; the rest are ordered by
 * overdue ratio plus a weak-topic boost from `estimateMastery`. Ties break on due, then id.
 */
export function dueQueue(
  cards: { id: string; topicId: string }[],
  sched: Record<string, CardSched | undefined>,
  topics: Topic[],
  attempts: AttemptEvent[],
  now: number,
  newLimit = 20,
): QueueItem[] {
  const weak = new Map<string, number>();
  for (const t of topics) {
    const m = estimateMastery(t.id, attempts, now);
    weak.set(t.id, ((1 - m.mastery) * (1 + (1 - m.confidence))) / 2);
  }
  const rows = cards.map((c) => {
    const s = sched[c.id] ?? newSched(c.id, now);
    const overdue = Math.min(2, Math.max(0, now - s.due) / DAY / Math.max(1, s.intervalDays));
    const short = s.phase === 'learning' || s.phase === 'relearning' ? 10 : 0;
    const priority = Number((short + overdue + 1.5 * (weak.get(c.topicId) ?? 0.25)).toFixed(6));
    return { item: { cardId: c.id, topicId: c.topicId, priority }, s };
  });
  const due = rows.filter((r) => isDue(r.s, now));
  const by = (a: (typeof due)[number], b: (typeof due)[number]) =>
    b.item.priority - a.item.priority || a.s.due - b.s.due || a.item.cardId.localeCompare(b.item.cardId);
  const fresh = due.filter((r) => r.s.phase === 'new').sort(by).slice(0, newLimit);
  return [...due.filter((r) => r.s.phase !== 'new'), ...fresh].sort(by).map((r) => r.item);
}
