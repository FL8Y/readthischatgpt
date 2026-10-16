import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from './core/types';
import { buildExport, EXTRA_KEYS, pickExtras, type Extras } from './core/backup';
import { LESSON_KEY } from './lesson/store';
import { SRS_KEY } from './srs/store';
import { TUTOR_KEY } from './tutor/store';

const STORAGE_KEY: Record<(typeof EXTRA_KEYS)[number], string> = {
  lessons: LESSON_KEY,
  srs: SRS_KEY,
  tutor: TUTOR_KEY,
};

/** Reads lessons, flashcards/reviews and tutor chat from device storage. A corrupt entry is skipped. */
export async function readExtras(): Promise<Extras> {
  const found: Record<string, unknown> = {};
  for (const k of EXTRA_KEYS) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY[k]);
      if (raw) found[k] = JSON.parse(raw);
    } catch {
      // skip unreadable entry
    }
  }
  return pickExtras(found);
}

export async function exportAll(state: AppState): Promise<string> {
  return buildExport(state, await readExtras());
}

/** Writes imported extras back. Only keys present in the backup are replaced. */
export async function writeExtras(extras: Extras): Promise<void> {
  for (const k of EXTRA_KEYS) {
    const v = extras[k];
    if (v !== undefined) await AsyncStorage.setItem(STORAGE_KEY[k], JSON.stringify(v));
  }
}
