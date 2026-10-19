import type { AppState } from './types';

const PROVIDERS: string[] = ['openai', 'anthropic', 'gemini', 'openrouter', 'groq', 'custom', 'manual'];

export interface BackupSummary {
  folders: number;
  topics: number;
  sources: number;
  chunks: number;
  events: number;
}

/** Data kept outside AppState (own storage keys): lessons, tutor chat. An old backup's 'srs' (flashcards) key is ignored on import. */
export interface Extras {
  lessons?: unknown;
  tutor?: unknown;
  /** Practice-bank state (attempts, flags, notes, mastery, re-queue). Old backups have none. */
  bank?: unknown;
}

export const EXTRA_KEYS = ['lessons', 'tutor', 'bank'] as const;

export type BackupResult =
  | { ok: true; state: AppState; summary: BackupSummary; extras: Extras }
  | { ok: false; errors: string[] };

/** Keeps only extras that are JSON objects or arrays; anything else is ignored, not trusted. */
export function pickExtras(raw: unknown): Extras {
  const out: Extras = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const k of EXTRA_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'object' && v !== null) out[k] = v;
  }
  return out;
}

/** Blanks the main key and every pool key. */
export function stripKeys(settings: AppState['settings']): AppState['settings'] {
  return { ...settings, apiKey: '', ...(settings.pool ? { pool: settings.pool.map((e) => ({ ...e, apiKey: '' })) } : {}) };
}

/** Builds export text: study data and extras, never the API key. */
export function buildExport(state: AppState, extras: Extras): string {
  return JSON.stringify({ ...state, settings: stripKeys(state.settings), extras }, null, 2);
}

const ARRAYS = ['folders', 'topics', 'sources', 'chunks', 'events', 'diagnosticsDone'] as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown) => typeof v === 'string';

/**
 * Checks the JSON shape of an export before it may replace app state.
 * Pure: never touches storage. The returned state has an empty API key
 * (exports never contain one); use applyImport to keep the current key.
 */
export function validateBackup(raw: string): BackupResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ['This is not valid JSON. Paste the full export text.'] };
  }
  if (!isObj(data)) return { ok: false, errors: ['The backup must be a JSON object.'] };

  const errors: string[] = [];
  for (const k of ARRAYS) {
    if (!Array.isArray(data[k])) errors.push(`Missing list: ${k}`);
  }
  if (!isObj(data.settings)) errors.push('Missing settings.');
  if (errors.length) return { ok: false, errors };

  const list = (k: (typeof ARRAYS)[number]) => data[k] as unknown[];
  const bad = (name: string, items: unknown[], test: (x: Record<string, unknown>) => boolean) => {
    const i = items.findIndex((x) => !isObj(x) || !test(x));
    if (i >= 0) errors.push(`${name} #${i + 1} is malformed.`);
  };
  bad('Folder', list('folders'), (x) => isStr(x.id) && isStr(x.name));
  bad(
    'Topic',
    list('topics'),
    (x) => isStr(x.id) && isStr(x.folderId) && isStr(x.title) && isStr(x.body) && Array.isArray(x.sourceIds),
  );
  bad('Source', list('sources'), (x) => isStr(x.id) && isStr(x.title) && typeof x.addedAt === 'number');
  bad('Chunk', list('chunks'), (x) => isStr(x.id) && isStr(x.sourceId) && isStr(x.text));
  bad(
    'Attempt',
    list('events'),
    (x) => isStr(x.id) && isStr(x.questionId) && isStr(x.topicId) && typeof x.correct === 'boolean' && typeof x.at === 'number',
  );
  if (!list('diagnosticsDone').every(isStr)) errors.push('diagnosticsDone must be a list of folder ids.');
  const st = data.settings as Record<string, unknown>;
  if (!PROVIDERS.includes(st.provider as string)) errors.push('Settings has an unknown provider.');
  if (!isStr(st.model)) errors.push('Settings has no model.');
  if (errors.length) return { ok: false, errors };

  const { extras: rawExtras, ...core } = data;
  const state = {
    ...(core as unknown as AppState),
    settings: { provider: st.provider as AppState['settings']['provider'], model: st.model as string, apiKey: '' },
  };
  return {
    ok: true,
    state,
    extras: pickExtras(rawExtras),
    summary: {
      folders: state.folders.length,
      topics: state.topics.length,
      sources: state.sources.length,
      chunks: state.chunks.length,
      events: state.events.length,
    },
  };
}

/** Replaces study data with the import but keeps the key already on this phone. */
export function applyImport(current: AppState, imported: AppState): AppState {
  return {
    ...imported,
    settings: {
      ...imported.settings,
      apiKey: current.settings.apiKey,
      aiChosen: current.settings.aiChosen,
      pool: current.settings.pool,
      poolMode: current.settings.poolMode,
      manualLastResort: current.settings.manualLastResort,
    },
  };
}
