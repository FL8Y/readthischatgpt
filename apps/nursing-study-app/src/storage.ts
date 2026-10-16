import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from './core/types';
import { DEFAULT_MODELS } from './ai/provider';

const KEY = 'nursing-study-app/state/v1';

export function emptyState(): AppState {
  return {
    folders: [{ id: 'np1', name: 'NP1 Nursing' }],
    topics: [],
    sources: [],
    chunks: [],
    events: [],
    diagnosticsDone: [],
    settings: { provider: 'anthropic', apiKey: '', model: DEFAULT_MODELS.anthropic },
  };
}

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return { ...emptyState(), ...(JSON.parse(raw) as Partial<AppState>) };
  } catch {
    // fall through to a fresh state; a corrupt save must not brick the app
  }
  return emptyState();
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

/** Export for backup: everything except the API key. */
export function exportJson(state: AppState): string {
  return JSON.stringify({ ...state, settings: { ...state.settings, apiKey: '' } }, null, 2);
}
