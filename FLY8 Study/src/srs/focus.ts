import type { AttemptEvent, Topic } from '../core/types';
import { estimateMastery } from '../core/mastery';
import type { Card } from './cards';
import { DAY, MIN_EASE, START_EASE, isDue, newSched, type CardSched, type ReviewEvent } from './scheduler';

/**
 * Focus points (0-100): how much a card needs the learner's attention right now.
 * Transparent sum, so the app can say why a card is flagged:
 *   lapses            12 each, max 36
 *   missed recently   Again in the last 3 days +20, Hard +8
 *   hard to remember  low ease, up to 15
 *   weak topic        (1 - topic mastery) * 25, only when the topic has quiz evidence
 *   not learned yet   new card +10
 *   overdue           up to 10
 * It never hides a card: it only orders and labels them. Not clinically validated.
 */
export const FOCUS_HIGH = 60;
export const FOCUS_MEDIUM = 30;
export const RECENT_DAYS = 3;

export type FocusLevel = 'high' | 'medium' | 'low';

export interface FocusScore {
  cardId: string;
  topicId: string;
  points: number;
  level: FocusLevel;
  reasons: string[];
}

export const focusLevel = (points: number): FocusLevel => (points >= FOCUS_HIGH ? 'high' : points >= FOCUS_MEDIUM ? 'medium' : 'low');

export function focusScore(
  card: Pick<Card, 'id' | 'topicId'>,
  sched: CardSched | undefined,
  reviews: ReviewEvent[],
  topicStats: { mastery: number; attempts: number } | undefined,
  now: number,
): FocusScore {
  const s = sched ?? newSched(card.id, now);
  const reasons: string[] = [];
  let points = 0;

  if (s.lapses > 0) {
    points += Math.min(36, 12 * s.lapses);
    reasons.push(`forgotten ${s.lapses} time${s.lapses === 1 ? '' : 's'}`);
  }

  const last = reviews
    .filter((e) => e.cardId === card.id)
    .reduce<ReviewEvent | undefined>((a, e) => (!a || e.at > a.at || (e.at === a.at && e.id > a.id) ? e : a), undefined);
  if (last && now - last.at <= RECENT_DAYS * DAY) {
    if (last.rating === 'again') {
      points += 20;
      reasons.push('missed in the last 3 days');
    } else if (last.rating === 'hard') {
      points += 8;
      reasons.push('felt hard recently');
    }
  }

  const easeLoss = Math.max(0, Math.min(1, (START_EASE - s.ease) / (START_EASE - MIN_EASE)));
  if (easeLoss > 0) {
    points += easeLoss * 15;
    if (easeLoss >= 0.3) reasons.push('keeps slipping');
  }

  if (topicStats && topicStats.attempts > 0) {
    const weak = (1 - topicStats.mastery) * 25;
    points += weak;
    if (topicStats.mastery < 0.6) reasons.push('weak topic');
  }

  if (s.phase === 'new') {
    points += 10;
    reasons.push('not learned yet');
  }

  if (isDue(s, now) && s.phase !== 'new') {
    const overdue = Math.min(2, Math.max(0, now - s.due) / DAY / Math.max(1, s.intervalDays));
    points += Math.min(10, overdue * 5);
    if (overdue >= 0.5) reasons.push('overdue');
  }

  const rounded = Math.max(0, Math.min(100, Math.round(points)));
  return { cardId: card.id, topicId: card.topicId, points: rounded, level: focusLevel(rounded), reasons };
}

function topicStatsFor(topics: Topic[], attempts: AttemptEvent[], now: number) {
  const m = new Map<string, { mastery: number; attempts: number }>();
  for (const t of topics) {
    const e = estimateMastery(t.id, attempts, now);
    m.set(t.id, { mastery: e.mastery, attempts: e.attempts });
  }
  return m;
}

/** All live cards scored, highest first (ties: card id). */
export function scoreAll(
  cards: Pick<Card, 'id' | 'topicId'>[],
  sched: Record<string, CardSched | undefined>,
  reviews: ReviewEvent[],
  topics: Topic[],
  attempts: AttemptEvent[],
  now: number,
): FocusScore[] {
  const stats = topicStatsFor(topics, attempts, now);
  return cards
    .map((c) => focusScore(c, sched[c.id], reviews, stats.get(c.topicId), now))
    .sort((a, b) => b.points - a.points || a.cardId.localeCompare(b.cardId));
}

/** The cards to practise now, due or not: medium and high focus only, capped. */
export function focusQueue(scores: FocusScore[], limit = 10): FocusScore[] {
  return scores.filter((s) => s.points >= FOCUS_MEDIUM).slice(0, limit);
}

export interface DeckRow {
  topicId: string;
  title: string;
  total: number;
  fresh: number;
  learning: number;
  due: number;
  /** Highest focus points in this deck. */
  peakFocus: number;
}

/** Anki-style deck list: one row per topic with New / Learning / Due counts. */
export function deckSummary(
  cards: Pick<Card, 'id' | 'topicId'>[],
  sched: Record<string, CardSched | undefined>,
  topics: Topic[],
  scores: FocusScore[],
  now: number,
): DeckRow[] {
  const peak = new Map<string, number>();
  for (const s of scores) peak.set(s.topicId, Math.max(peak.get(s.topicId) ?? 0, s.points));
  return topics
    .map((t) => {
      const mine = cards.filter((c) => c.topicId === t.id);
      let fresh = 0;
      let learning = 0;
      let due = 0;
      for (const c of mine) {
        const s = sched[c.id] ?? newSched(c.id, now);
        if (s.phase === 'new') fresh += 1;
        else if (s.phase === 'learning' || s.phase === 'relearning') learning += 1;
        if (s.phase === 'review' && isDue(s, now)) due += 1;
      }
      return { topicId: t.id, title: t.title, total: mine.length, fresh, learning, due, peakFocus: peak.get(t.id) ?? 0 };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.peakFocus - a.peakFocus || a.title.localeCompare(b.title) || a.topicId.localeCompare(b.topicId));
}
