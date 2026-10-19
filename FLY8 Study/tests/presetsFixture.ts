import type { AppState } from '../src/core/types';

/** Plain state for tests; avoids importing storage.ts (AsyncStorage). */
export function emptyStateForTest(): AppState {
  return {
    folders: [{ id: 'np1', name: 'NP1 Nursing' }],
    topics: [],
    sources: [],
    chunks: [],
    events: [],
    diagnosticsDone: [],
    settings: { provider: 'manual', apiKey: '', model: 'manual' },
  };
}
