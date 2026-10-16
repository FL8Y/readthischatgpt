import type { AppState } from './types';

export interface BackupSummary {
  folders: number;
  topics: number;
  sources: number;
  chunks: number;
  events: number;
}

export type BackupResult = { ok: true; state: AppState; summary: BackupSummary } | { ok: false; errors: string[] };

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
  if (st.provider !== 'openai' && st.provider !== 'anthropic') errors.push('Settings has an unknown provider.');
  if (!isStr(st.model)) errors.push('Settings has no model.');
  if (errors.length) return { ok: false, errors };

  const state = {
    ...(data as unknown as AppState),
    settings: { provider: st.provider as AppState['settings']['provider'], model: st.model as string, apiKey: '' },
  };
  return {
    ok: true,
    state,
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
  return { ...imported, settings: { ...imported.settings, apiKey: current.settings.apiKey } };
}
