import { applyReview, newSched, type CardSched, type ReviewEvent } from './scheduler';
import type { Card } from './cards';

export interface SrsSnapshot {
  version: 1;
  cards: Card[];
  sched: Record<string, CardSched>;
  /** Append-only review history; ids are unique. */
  events: ReviewEvent[];
}

export type SrsAction =
  | { type: 'addCards'; cards: Card[]; now: number }
  | { type: 'editCard'; id: string; front: string; back: string }
  | { type: 'dismissCard'; id: string }
  | { type: 'review'; event: ReviewEvent };

export const emptySnapshot = (): SrsSnapshot => ({ version: 1, cards: [], sched: {}, events: [] });

/** Pure reducer. A no-op (duplicate event id, unknown card) returns the same snapshot object. */
export function srsReduce(s: SrsSnapshot, a: SrsAction): SrsSnapshot {
  switch (a.type) {
    case 'addCards': {
      const known = new Set(s.cards.map((c) => c.id));
      const fresh = a.cards.filter((c) => !known.has(c.id));
      if (!fresh.length) return s;
      const sched = { ...s.sched };
      for (const c of fresh) sched[c.id] = newSched(c.id, a.now);
      return { ...s, cards: [...s.cards, ...fresh], sched };
    }
    case 'editCard': {
      const front = a.front.trim();
      const back = a.back.trim();
      if (!front || !back || !s.cards.some((c) => c.id === a.id)) return s;
      return { ...s, cards: s.cards.map((c) => (c.id === a.id ? { ...c, front, back, edited: true } : c)) };
    }
    case 'dismissCard':
      if (!s.cards.some((c) => c.id === a.id && !c.dismissed)) return s;
      return { ...s, cards: s.cards.map((c) => (c.id === a.id ? { ...c, dismissed: true } : c)) };
    case 'review': {
      const ev = a.event;
      if (s.events.some((e) => e.id === ev.id)) return s;
      const prev = s.sched[ev.cardId];
      if (!prev) return s;
      return { ...s, sched: { ...s.sched, [ev.cardId]: applyReview(prev, ev) }, events: [...s.events, ev] };
    }
  }
}

/** Rebuilds scheduling purely from cards + events (sorted by time then id), ignoring duplicate ids. */
export function replayEvents(cards: Card[], events: ReviewEvent[]): SrsSnapshot {
  let snap = srsReduce(emptySnapshot(), { type: 'addCards', cards, now: 0 });
  const sorted = [...events].sort((x, y) => x.at - y.at || x.id.localeCompare(y.id));
  for (const event of sorted) snap = srsReduce(snap, { type: 'review', event });
  return snap;
}

export function countDue(s: SrsSnapshot, now: number): number {
  return s.cards.filter((c) => !c.dismissed && (s.sched[c.id]?.due ?? 0) <= now).length;
}

/** Defensive load: anything malformed becomes an empty snapshot rather than a crash. */
export function parseSnapshot(raw: string | null): SrsSnapshot {
  try {
    const o = raw ? JSON.parse(raw) : null;
    if (o && o.version === 1 && Array.isArray(o.cards) && Array.isArray(o.events) && o.sched && typeof o.sched === 'object') {
      return o as SrsSnapshot;
    }
  } catch {
    // corrupt save: start empty rather than brick the tab
  }
  return emptySnapshot();
}
