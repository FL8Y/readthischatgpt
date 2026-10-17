import AsyncStorage from '@react-native-async-storage/async-storage';
import { countDue, emptySnapshot, parseSnapshot, srsReduce, type SrsAction, type SrsSnapshot } from './state';

export const SRS_KEY = 'nursing-study-app/srs/v1';
export { countDue, emptySnapshot, srsReduce };
export type { SrsAction, SrsSnapshot };

export async function loadSrs(): Promise<SrsSnapshot> {
  try {
    return parseSnapshot(await AsyncStorage.getItem(SRS_KEY));
  } catch {
    return emptySnapshot();
  }
}

let tail: Promise<void> = Promise.resolve();

/**
 * Atomic whole-snapshot write (one setItem). Writes are chained so an older snapshot can never
 * land after a newer one. Call immediately on every rating.
 */
export function saveSrs(snap: SrsSnapshot): Promise<void> {
  const json = JSON.stringify(snap);
  tail = tail.catch(() => undefined).then(() => AsyncStorage.setItem(SRS_KEY, json));
  return tail;
}

/** Reduce, persist, return. The returned snapshot is what the UI should show. */
export async function dispatchSrs(snap: SrsSnapshot, action: SrsAction): Promise<SrsSnapshot> {
  const next = srsReduce(snap, action);
  if (next !== snap) await saveSrs(next);
  return next;
}

/** For the Home dashboard: how many cards are due right now. 0 on any storage failure. */
export async function countDueCards(now: number): Promise<number> {
  return countDue(await loadSrs(), now);
}
