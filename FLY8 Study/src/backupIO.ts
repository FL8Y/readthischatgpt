import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from './core/types';
import { buildExport, EXTRA_KEYS, pickExtras, type Extras } from './core/backup';
import { LESSON_KEY } from './lesson/store';
import { TUTOR_KEY } from './tutor/store';
import { asyncStorageKV, BankPersistence, emptyBankState, type BankState, type BankStore } from './bank/store';
import { attachBank, bankFromExtras } from './ui/practice/practiceFlow';

type PlainKey = Exclude<(typeof EXTRA_KEYS)[number], 'bank'>;

const STORAGE_KEY: Record<PlainKey, string> = {
  lessons: LESSON_KEY,
  tutor: TUTOR_KEY,
};
const PLAIN_KEYS = EXTRA_KEYS.filter((k): k is PlainKey => k !== 'bank');

/** The running bank store (set by BankProvider) so an import updates the screen as well as storage. */
let liveStore: BankStore | null = null;
export function registerBankStore(s: BankStore | null): void {
  liveStore = s;
}

/** Reads lessons and tutor chat from device storage. A corrupt entry is skipped. */
export async function readExtras(): Promise<Extras> {
  const found: Record<string, unknown> = {};
  for (const k of PLAIN_KEYS) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY[k]);
      if (raw) found[k] = JSON.parse(raw);
    } catch {
      // skip unreadable entry
    }
  }
  return pickExtras(found);
}

async function currentBank(): Promise<BankState> {
  if (liveStore) return liveStore.state;
  try {
    return await new BankPersistence(await asyncStorageKV()).load();
  } catch {
    return emptyBankState();
  }
}

export async function exportAll(state: AppState): Promise<string> {
  return attachBank(buildExport(state, await readExtras()), await currentBank());
}

/** Writes imported extras back. Only keys present in the backup are replaced; an old backup leaves the bank alone. */
export async function writeExtras(extras: Extras): Promise<void> {
  for (const k of PLAIN_KEYS) {
    const v = extras[k];
    if (v !== undefined) await AsyncStorage.setItem(STORAGE_KEY[k], JSON.stringify(v));
  }
  const bank = bankFromExtras(extras);
  if (!bank) return;
  if (liveStore) {
    await liveStore.dispatch({ type: 'state/replace', state: bank });
    return;
  }
  await new BankPersistence(await asyncStorageKV()).saveBank(bank);
}
