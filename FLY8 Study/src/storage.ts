import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from './core/types';
import { DEFAULT_MODELS } from './ai/provider';
import { stripKeys } from './core/backup';
import { joinState, shardMeta, splitState } from './core/shards';

const KEY = 'nursing-study-app/state/v1';

export function emptyState(): AppState {
  return {
    folders: [{ id: 'np1', name: 'NP1 Nursing' }],
    topics: [],
    sources: [],
    chunks: [],
    events: [],
    diagnosticsDone: [],
    settings: { provider: 'manual', apiKey: '', model: DEFAULT_MODELS.manual },
  };
}

const partKey = (kind: 'topics' | 'chunks', i: number) => `${KEY}/${kind}/${i}`;
const partKeys = (kind: 'topics' | 'chunks', n: number) => Array.from({ length: n }, (_, i) => partKey(kind, i));
let savedParts = { topics: 0, chunks: 0 };

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const main = JSON.parse(raw);
      const meta = shardMeta(main);
      if (!meta) return { ...emptyState(), ...(main as Partial<AppState>) }; // older single-value save
      const got = await AsyncStorage.multiGet([...partKeys('topics', meta.topics), ...partKeys('chunks', meta.chunks)]);
      const vals = got.map(([, v]) => v);
      savedParts = { ...meta };
      return {
        ...emptyState(),
        ...joinState(main, vals.slice(0, meta.topics), vals.slice(meta.topics)),
      };
    }
  } catch {
    // fall through to a fresh state; a corrupt save must not brick the app
  }
  return emptyState();
}

export async function saveState(state: AppState): Promise<void> {
  const { main, topics, chunks } = splitState(state);
  const pairs: [string, string][] = [
    ...topics.map((v, i): [string, string] => [partKey('topics', i), v]),
    ...chunks.map((v, i): [string, string] => [partKey('chunks', i), v]),
  ];
  if (pairs.length) await AsyncStorage.multiSet(pairs);
  await AsyncStorage.setItem(KEY, main); // main last, so a half-finished save keeps the old view
  const stale = [
    ...partKeys('topics', savedParts.topics).slice(topics.length),
    ...partKeys('chunks', savedParts.chunks).slice(chunks.length),
  ];
  savedParts = { topics: topics.length, chunks: chunks.length };
  if (stale.length) await AsyncStorage.multiRemove(stale);
}

/** Export for backup: everything except the API key. */
export function exportJson(state: AppState): string {
  return JSON.stringify({ ...state, settings: stripKeys(state.settings) }, null, 2);
}
