import { dayKey, daysBetween } from './clock';

/** One answered question, as stored. credit is 0..1; "correct" means credit 1. */
export interface AttemptRec {
  itemId: string;
  /** Epoch ms. */
  t: number;
  credit: number;
  correct: boolean;
  selected: number[];
  seconds: number;
  hinted?: boolean;
  sessionId?: string;
  mode?: string;
}

/** Days until the missed item returns, by stage. */
export const REQUEUE_DAYS: readonly number[] = [1, 3, 7, 21];

export interface RequeueEntry {
  /** Index into REQUEUE_DAYS of the interval currently waiting. */
  stage: number;
  /** Manila day key the item is due on (or after). */
  due: string;
}

export type RequeueMap = Record<string, RequeueEntry>;

function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

/**
 * Update the re-queue after an answer on Manila day `today`.
 * Miss (credit < 1): stage 0, due in 1 day (also resets an existing entry).
 * Correct on a queued item: next stage; passing the last stage (21 days) removes it.
 * Correct on an item that was never missed: no change.
 */
export function applyAnswer(map: RequeueMap, itemId: string, credit: number, today: string): RequeueMap {
  const cur = map[itemId];
  if (credit < 1) return { ...map, [itemId]: { stage: 0, due: addDays(today, REQUEUE_DAYS[0]) } };
  if (!cur) return map;
  const next = cur.stage + 1;
  if (next >= REQUEUE_DAYS.length) {
    const { [itemId]: _gone, ...rest } = map;
    return rest;
  }
  return { ...map, [itemId]: { stage: next, due: addDays(today, REQUEUE_DAYS[next]) } };
}

/** Ids due on or before `today`, most overdue first (ties by id). */
export function dueItems(map: RequeueMap, today: string): string[] {
  return Object.entries(map)
    .filter(([, e]) => e.due <= today)
    .sort((a, b) => (a[1].due === b[1].due ? (a[0] < b[0] ? -1 : 1) : a[1].due < b[1].due ? -1 : 1))
    .map(([id]) => id);
}

/** Earliest due day key across the queue, or null when it is empty. */
export function nextDue(map: RequeueMap): string | null {
  let best: string | null = null;
  for (const e of Object.values(map)) if (best === null || e.due < best) best = e.due;
  return best;
}

/** Count due today and count still waiting. */
export function requeueCounts(map: RequeueMap, today: string): { due: number; waiting: number } {
  const due = dueItems(map, today).length;
  return { due, waiting: Object.keys(map).length - due };
}

export interface WeakItem {
  itemId: string;
  score: number;
  misses: number;
}

export const WEAK_HALF_LIFE_DAYS = 14;
export const WEAK_RECENT_ATTEMPTS = 5;

/**
 * Rank items by recent misses. Looks at each item's last 5 attempts; a miss weighs (1 - credit),
 * halved every 14 days of age. Full-credit answers add nothing, but they push old misses out of the
 * 5-attempt window, so items answered right lately sink. Items with score 0 are left out. Highest first.
 */
export function weakItems(attempts: AttemptRec[], now: number, limit = 50): WeakItem[] {
  const by = new Map<string, AttemptRec[]>();
  for (const a of attempts) {
    const arr = by.get(a.itemId);
    if (arr) arr.push(a);
    else by.set(a.itemId, [a]);
  }
  const today = dayKey(now);
  const out: WeakItem[] = [];
  for (const [itemId, list] of by) {
    const recent = list.slice().sort((x, y) => x.t - y.t).slice(-WEAK_RECENT_ATTEMPTS);
    let score = 0;
    let misses = 0;
    for (const a of recent) {
      if (a.credit >= 1) continue;
      misses += 1;
      const age = Math.max(0, daysBetween(dayKey(a.t), today));
      score += (1 - a.credit) * Math.pow(0.5, age / WEAK_HALF_LIFE_DAYS);
    }
    if (score > 0) out.push({ itemId, score, misses });
  }
  return out.sort((a, b) => b.score - a.score || (a.itemId < b.itemId ? -1 : 1)).slice(0, limit);
}
