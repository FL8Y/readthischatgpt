import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => mem.get(k) ?? null,
    setItem: async (k: string, v: string) => void mem.set(k, v),
  },
}));

import {
  DAY, MIN, dueQueue, formatInterval, newSched, previewDelays, schedule, applyReview, type CardSched, type ReviewEvent,
} from '../src/srs/scheduler';
import { cardsRequest, parseCards, type Card } from '../src/srs/cards';
import { emptySnapshot, parseSnapshot, replayEvents, srsReduce, countDue } from '../src/srs/state';
import { SRS_KEY, countDueCards, dispatchSrs, loadSrs } from '../src/srs/store';
import { emptyState } from '../src/storage';
import type { AttemptEvent, Topic } from '../src/core/types';

const T0 = Date.UTC(2026, 9, 16, 12);
const topic = (id: string, title: string, body = ''): Topic => ({ id, folderId: 'np1', title, body, sourceIds: [] });
const TOPICS = [topic('hf', 'Heart Failure', 'Preload and afterload.'), topic('dm', 'Diabetes')];
const card = (id: string, topicId = 'hf', front = id): Card => ({
  id, topicId, front, back: 'b', sourceTopicTitle: topicId, dismissed: false, edited: false, beyondNotes: false, createdAt: T0,
});
const ev = (id: string, cardId: string, rating: ReviewEvent['rating'], at: number): ReviewEvent => ({ id, cardId, rating, at });

describe('scheduler vectors (fixed time)', () => {
  const fresh = newSched('c', T0);
  it('new card: Again/Hard stay at step 0 (1 min), Good advances to 10 min, Easy graduates to 4 days', () => {
    expect(schedule(fresh, 'again', T0)).toMatchObject({ phase: 'learning', step: 0, due: T0 + MIN });
    expect(schedule(fresh, 'hard', T0)).toMatchObject({ phase: 'learning', step: 0, due: T0 + MIN });
    expect(schedule(fresh, 'good', T0)).toMatchObject({ phase: 'learning', step: 1, due: T0 + 10 * MIN });
    expect(schedule(fresh, 'easy', T0)).toMatchObject({ phase: 'review', intervalDays: 4, due: T0 + 4 * DAY });
  });
  it('Good twice graduates to 1 day', () => {
    const a = schedule(fresh, 'good', T0);
    expect(schedule(a, 'good', T0 + 10 * MIN)).toMatchObject({ phase: 'review', intervalDays: 1, due: T0 + 10 * MIN + DAY, reps: 2 });
  });
  const rev: CardSched = { ...fresh, phase: 'review', intervalDays: 10, ease: 2.5, reps: 5 };
  it('review ratings', () => {
    expect(schedule(rev, 'hard', T0)).toMatchObject({ intervalDays: 12, ease: 2.35 });
    expect(schedule(rev, 'good', T0)).toMatchObject({ intervalDays: 25, ease: 2.5, due: T0 + 25 * DAY });
    expect(schedule(rev, 'easy', T0)).toMatchObject({ intervalDays: 33, ease: 2.65 });
  });
  it('lapse: relearn in 10 min, ease drops, resumes at half the interval', () => {
    const lapsed = schedule(rev, 'again', T0);
    expect(lapsed).toMatchObject({ phase: 'relearning', due: T0 + 10 * MIN, lapses: 1, ease: 2.3, resumeDays: 5 });
    expect(schedule(lapsed, 'again', T0 + 10 * MIN).phase).toBe('relearning');
    expect(schedule(lapsed, 'good', T0 + 10 * MIN)).toMatchObject({ phase: 'review', intervalDays: 5 });
  });
  it('failed cards come back sooner than passed cards', () => {
    const d = previewDelays(rev, T0);
    expect(d.again).toBeLessThan(d.hard);
    expect(d.hard).toBeLessThan(d.good);
    expect(d.good).toBeLessThan(d.easy);
  });
  it('intervals grow on repeated Good and ease never drops below 1.3', () => {
    let s = { ...rev };
    let last = 0;
    for (let i = 0; i < 5; i++) {
      s = schedule(s, 'good', s.due);
      expect(s.intervalDays).toBeGreaterThan(last);
      last = s.intervalDays;
    }
    let low = { ...rev };
    for (let i = 0; i < 20; i++) low = schedule(schedule(low, 'again', T0), 'good', T0);
    expect(low.ease).toBe(1.3);
  });
  it('is deterministic and does not mutate input', () => {
    const copy = JSON.stringify(rev);
    expect(schedule(rev, 'good', T0)).toEqual(schedule(rev, 'good', T0));
    expect(JSON.stringify(rev)).toBe(copy);
  });
  it('applyReview ignores a seen id and a wrong card', () => {
    expect(applyReview(fresh, ev('e1', 'c', 'good', T0), new Set(['e1']))).toBe(fresh);
    expect(applyReview(fresh, ev('e2', 'other', 'good', T0))).toBe(fresh);
  });
  it('formats intervals', () => {
    expect([MIN, 10 * MIN, 3 * 60 * MIN, DAY, 25 * DAY, 60 * DAY].map(formatInterval)).toEqual(['1m', '10m', '3h', '1d', '25d', '2mo']);
  });
});

describe('due queue', () => {
  const att = (topicId: string, correct: boolean, i: number): AttemptEvent => ({ id: `a${topicId}${i}`, questionId: 'q', topicId, correct, at: T0, kind: 'pop' });
  it('only due cards; weak topic first; learning cards ahead of review', () => {
    const cards = [card('a', 'hf'), card('b', 'dm'), card('c', 'hf'), card('future', 'dm')];
    const sched: Record<string, CardSched> = {
      a: { ...newSched('a', T0), phase: 'review', intervalDays: 5, due: T0 },
      b: { ...newSched('b', T0), phase: 'review', intervalDays: 5, due: T0 },
      c: { ...newSched('c', T0), phase: 'learning', due: T0 - MIN },
      future: { ...newSched('future', T0), phase: 'review', intervalDays: 5, due: T0 + DAY },
    };
    // diabetes is weak (all wrong), heart failure is strong (all right)
    const attempts = [...[0, 1, 2, 3].map((i) => att('dm', false, i)), ...[0, 1, 2, 3].map((i) => att('hf', true, i))];
    const q = dueQueue(cards, sched, TOPICS, attempts, T0);
    expect(q.map((x) => x.cardId)).toEqual(['c', 'b', 'a']);
    // flip the evidence and the order of the two review cards flips
    const flipped = [...[0, 1, 2, 3].map((i) => att('hf', false, i)), ...[0, 1, 2, 3].map((i) => att('dm', true, i))];
    expect(dueQueue(cards, sched, TOPICS, flipped, T0).map((x) => x.cardId)).toEqual(['c', 'a', 'b']);
  });
  it('is deterministic and caps new cards', () => {
    const cards = Array.from({ length: 30 }, (_, i) => card(`n${String(i).padStart(2, '0')}`));
    const a = dueQueue(cards, {}, TOPICS, [], T0, 5);
    expect(a).toHaveLength(5);
    expect(dueQueue(cards, {}, TOPICS, [], T0, 5)).toEqual(a);
  });
});

describe('parseCards', () => {
  const opts = { topicId: 'hf', idPrefix: 'p', now: T0 };
  it('drops malformed, dedupes by normalized front, caps, flags beyond-notes', () => {
    const raw = JSON.stringify({
      cards: [
        { front: 'What is preload?', back: 'Stretch before contraction', beyondNotes: false },
        { front: 'what is  PRELOAD', back: 'dup', beyondNotes: false },
        { front: 'No back' },
        { front: '', back: 'x' },
        null,
        { front: 'Define afterload', back: 'Resistance' },
        { front: 'Third', back: 'c', beyondNotes: false },
      ],
    });
    const out = parseCards(raw, TOPICS, { ...opts, cap: 3 });
    expect(out.map((c) => c.front)).toEqual(['What is preload?', 'Define afterload', 'Third']);
    expect(out.map((c) => c.beyondNotes)).toEqual([false, true, false]);
    expect(out[0]).toMatchObject({ topicId: 'hf', sourceTopicTitle: 'Heart Failure', dismissed: false, edited: false });
    expect(new Set(out.map((c) => c.id)).size).toBe(3);
    expect(parseCards(raw, TOPICS, { ...opts, cap: 1 })).toHaveLength(1);
  });
  it('skips fronts that already exist, unknown topics, and non-JSON', () => {
    const raw = '```json\n[{"front":"Known","back":"x"},{"front":"Other","back":"y","topic":"Nope"},{"front":"Ok","back":"z","topic":"diabetes"}]\n```';
    const out = parseCards(raw, TOPICS, { ...opts, existing: [{ front: 'known' }] });
    expect(out.map((c) => [c.front, c.topicId])).toEqual([['Ok', 'dm']]);
    expect(parseCards('nonsense', TOPICS, opts)).toEqual([]);
  });
  it('cardsRequest carries the learner profile, the notes and a bounded count', () => {
    const st = { ...emptyState(), topics: TOPICS };
    const r = cardsRequest(st, TOPICS[0], 999, T0);
    expect(r.system).toContain('Topic mastery:');
    expect(r.system).toContain('beyondNotes');
    expect(r.user).toContain('Write 20 flashcards');
    expect(r.user).toContain('Preload and afterload.');
  });
});

describe('store reducer', () => {
  const base = srsReduce(emptySnapshot(), { type: 'addCards', cards: [card('c1'), card('c2')], now: T0 });
  it('adds cards once with new scheduling state', () => {
    expect(Object.keys(base.sched)).toEqual(['c1', 'c2']);
    expect(srsReduce(base, { type: 'addCards', cards: [card('c1')], now: T0 })).toBe(base);
  });
  it('review is idempotent by event id', () => {
    const e = ev('e1', 'c1', 'good', T0);
    const once = srsReduce(base, { type: 'review', event: e });
    expect(once.sched.c1.step).toBe(1);
    const twice = srsReduce(once, { type: 'review', event: e });
    expect(twice).toBe(once);
    expect(twice.events).toHaveLength(1);
    expect(twice.sched.c1.reps).toBe(1);
  });
  it('review for an unknown card is ignored', () => {
    expect(srsReduce(base, { type: 'review', event: ev('x', 'nope', 'good', T0) })).toBe(base);
  });
  it('edit marks edited, dismiss removes from due count', () => {
    const edited = srsReduce(base, { type: 'editCard', id: 'c1', front: ' New? ', back: 'A' });
    expect(edited.cards[0]).toMatchObject({ front: 'New?', edited: true });
    expect(srsReduce(base, { type: 'editCard', id: 'c1', front: ' ', back: 'A' })).toBe(base);
    expect(countDue(base, T0)).toBe(2);
    expect(countDue(srsReduce(base, { type: 'dismissCard', id: 'c1' }), T0)).toBe(1);
  });
  it('replay of events (any order, with duplicates) equals incremental application', () => {
    const events = [ev('e1', 'c1', 'good', T0), ev('e2', 'c1', 'good', T0 + 10 * MIN), ev('e3', 'c2', 'again', T0 + 11 * MIN)];
    let inc = base;
    for (const e of events) inc = srsReduce(inc, { type: 'review', event: e });
    const replayed = replayEvents(base.cards, [events[2], events[0], events[1], events[0]]);
    expect(replayed.sched).toEqual(inc.sched);
  });
  it('parseSnapshot survives garbage', () => {
    expect(parseSnapshot('{bad')).toEqual(emptySnapshot());
    expect(parseSnapshot(JSON.stringify({ version: 2 }))).toEqual(emptySnapshot());
    expect(parseSnapshot(JSON.stringify(base))).toEqual(base);
  });
});

describe('persistence (mocked AsyncStorage)', () => {
  beforeEach(() => mem.clear());
  it('a rating is written before dispatchSrs resolves, and survives a reload', async () => {
    let s = await dispatchSrs(emptySnapshot(), { type: 'addCards', cards: [card('c1')], now: T0 });
    s = await dispatchSrs(s, { type: 'review', event: ev('e1', 'c1', 'easy', T0) });
    // "app closed right after rating": read straight from storage with no further calls
    const stored = JSON.parse(mem.get(SRS_KEY)!);
    expect(stored.events).toHaveLength(1);
    expect(stored.sched.c1).toMatchObject({ phase: 'review', intervalDays: 4 });
    expect(await loadSrs()).toEqual(s);
  });
  it('a duplicate event does not write again', async () => {
    let s = await dispatchSrs(emptySnapshot(), { type: 'addCards', cards: [card('c1')], now: T0 });
    s = await dispatchSrs(s, { type: 'review', event: ev('e1', 'c1', 'good', T0) });
    const before = mem.get(SRS_KEY);
    mem.set(SRS_KEY, 'sentinel');
    await dispatchSrs(s, { type: 'review', event: ev('e1', 'c1', 'good', T0) });
    expect(mem.get(SRS_KEY)).toBe('sentinel');
    expect(before).not.toBe('sentinel');
  });
  it('countDueCards counts due, non-dismissed cards and is 0 when nothing is stored', async () => {
    expect(await countDueCards(T0)).toBe(0);
    let s = await dispatchSrs(emptySnapshot(), { type: 'addCards', cards: [card('c1'), card('c2')], now: T0 });
    s = await dispatchSrs(s, { type: 'review', event: ev('e1', 'c1', 'easy', T0) });
    expect(await countDueCards(T0)).toBe(1);
    expect(await countDueCards(T0 + 5 * DAY)).toBe(2);
  });
  it('a corrupt save loads as empty', async () => {
    mem.set(SRS_KEY, '{oops');
    expect(await loadSrs()).toEqual(emptySnapshot());
  });
});
