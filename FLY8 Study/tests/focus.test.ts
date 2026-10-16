import { describe, expect, it } from 'vitest';
import { deckSummary, focusLevel, focusQueue, focusScore, scoreAll } from '../src/srs/focus';
import { DAY, newSched, type CardSched, type ReviewEvent } from '../src/srs/scheduler';
import type { AttemptEvent, Topic } from '../src/core/types';

const NOW = Date.UTC(2026, 9, 16, 12);
const sched = (over: Partial<CardSched>): CardSched => ({
  ...newSched('c', NOW),
  phase: 'review',
  intervalDays: 10,
  due: NOW + 5 * DAY,
  ...over,
});
const review = (cardId: string, rating: ReviewEvent['rating'], daysAgo: number, id = `${cardId}-${daysAgo}`): ReviewEvent => ({
  id,
  cardId,
  rating,
  at: NOW - daysAgo * DAY,
});
const card = { id: 'c', topicId: 't' };

describe('focus score', () => {
  it('a healthy card scores low', () => {
    const f = focusScore(card, sched({}), [review('c', 'good', 1)], { mastery: 0.9, attempts: 6 }, NOW);
    expect(f.level).toBe('low');
    expect(f.points).toBeLessThan(FOCUS_LOW_MAX);
  });

  it('adds lapses, a recent miss and a weak topic, and says why', () => {
    const f = focusScore(
      card,
      sched({ lapses: 2, ease: 1.7 }),
      [review('c', 'again', 1)],
      { mastery: 0.2, attempts: 5 },
      NOW,
    );
    expect(f.points).toBeGreaterThanOrEqual(60);
    expect(f.level).toBe('high');
    expect(f.reasons).toEqual(expect.arrayContaining(['forgotten 2 times', 'missed in the last 3 days', 'weak topic']));
  });

  it('ignores an old miss and untested topics', () => {
    const f = focusScore(card, sched({}), [review('c', 'again', 20)], { mastery: 0.1, attempts: 0 }, NOW);
    expect(f.reasons).not.toContain('missed in the last 3 days');
    expect(f.reasons).not.toContain('weak topic');
  });

  it('new cards get a small bump and stay capped at 100', () => {
    const fresh = focusScore(card, newSched('c', NOW), [], undefined, NOW);
    expect(fresh.points).toBe(10);
    const worst = focusScore(
      card,
      sched({ lapses: 9, ease: 1.3, due: NOW - 30 * DAY, intervalDays: 1 }),
      [review('c', 'again', 0)],
      { mastery: 0, attempts: 9 },
      NOW,
    );
    expect(worst.points).toBe(100);
  });

  it('maps points to levels at the thresholds', () => {
    expect([29, 30, 59, 60].map(focusLevel)).toEqual(['low', 'medium', 'medium', 'high']);
  });
});

const FOCUS_LOW_MAX = 30;

describe('focus queue and decks', () => {
  const topics: Topic[] = [
    { id: 't', folderId: 'f', title: 'Heart', body: '', sourceIds: [] },
    { id: 'u', folderId: 'f', title: 'Kidney', body: '', sourceIds: [] },
  ];
  const attempts: AttemptEvent[] = Array.from({ length: 4 }, (_, i) => ({
    id: `a${i}`,
    questionId: `q${i}`,
    topicId: 't',
    correct: false,
    at: NOW,
    kind: 'pop' as const,
  }));
  const cards = [
    { id: 'c1', topicId: 't' },
    { id: 'c2', topicId: 'u' },
  ];
  const sch: Record<string, CardSched> = {
    c1: { ...sched({ lapses: 1 }), cardId: 'c1' },
    c2: { ...sched({}), cardId: 'c2' },
  };

  it('puts the weak topic card first, caps the list and excludes low-focus cards', () => {
    const scores = scoreAll(cards, sch, [], topics, attempts, NOW);
    expect(scores[0].cardId).toBe('c1');
    const q = focusQueue(scores, 10);
    expect(q.map((s) => s.cardId)).toEqual(['c1']);
    expect(focusQueue(scores, 0)).toEqual([]);
  });

  it('is deterministic whatever the input order', () => {
    const a = scoreAll(cards, sch, [], topics, attempts, NOW).map((s) => s.cardId);
    const b = scoreAll([...cards].reverse(), sch, [], topics, attempts, NOW).map((s) => s.cardId);
    expect(a).toEqual(b);
  });

  it('builds Anki-style deck rows with new, learning and due counts', () => {
    const more = [...cards, { id: 'c3', topicId: 't' }, { id: 'c4', topicId: 't' }];
    const s2: Record<string, CardSched> = {
      ...sch,
      c1: { ...sch.c1, due: NOW - DAY },
      c3: { ...newSched('c3', NOW) },
      c4: { ...newSched('c4', NOW), phase: 'learning' },
    };
    const scores = scoreAll(more, s2, [], topics, attempts, NOW);
    const rows = deckSummary(more, s2, topics, scores, NOW);
    expect(rows[0]).toMatchObject({ topicId: 't', total: 3, fresh: 1, learning: 1, due: 1 });
    expect(rows[1]).toMatchObject({ topicId: 'u', total: 1, due: 0 });
  });
});
