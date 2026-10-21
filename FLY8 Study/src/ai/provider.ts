import type { ProviderName, Question, Settings, Topic } from '../core/types';
import { extractJson } from '../core/provenance';
import { pnleExtras } from '../core/questionParse';
import { buildTextRequest, checkResponse, extractReplyText, routedVia } from './transport';
import { runPool, secondOpinion, type CallMeta, type Opinion } from './pool';
import { getManualHandler, ManualCancelled, type ManualOptions } from './manual';

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-sonnet-5-5',
  gemini: 'gemini-2.5-flash',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  groq: 'llama-3.3-70b-versatile',
  custom: '',
  manual: '',
};

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'rate-limit' | 'network' | 'bad-output' | 'server' | 'cancelled',
    /** Extra facts the pool router uses; absent for most errors. */
    readonly info: ProviderErrorInfo = {},
  ) {
    super(message);
  }
}

export interface ProviderErrorInfo {
  status?: number;
  /** From the Retry-After header, in milliseconds. */
  retryAfterMs?: number;
  /** The error body suggests a daily/quota limit rather than a short burst limit. */
  daily?: boolean;
  /** A 400/404/413 whose text points at the model or the size of the request. */
  modelSpecific?: boolean;
}

export function redact(text: string, apiKey: string): string {
  return apiKey ? text.split(apiKey).join('[redacted]') : text;
}

export interface ModelRequest {
  system: string;
  user: string;
}

type Fetch = typeof fetch;

/** Prompts that ask for JSON get the JSON reply checks in manual mode unless the caller says otherwise. */
export function inferExpect(req: ModelRequest): NonNullable<ManualOptions['expect']> {
  return /json/i.test(`${req.system}\n${req.user}`) ? 'json' : 'text';
}

/**
 * Manual mode: hands the request to the registered ManualHost, which shows the copy-paste screen.
 * Shared by callModel, callModelVision and tutorCall. An owner cancel becomes ProviderError('cancelled').
 */
export async function callManual(req: ModelRequest, opts: ManualOptions = {}): Promise<string> {
  const handler = getManualHandler();
  if (!handler) throw new ProviderError('Manual mode is not ready.', 'bad-output');
  try {
    return await handler(req, { ...opts, expect: opts.expect ?? inferExpect(req) });
  } catch (e) {
    if (e instanceof ManualCancelled) throw new ProviderError('Cancelled.', 'cancelled');
    throw e;
  }
}

/** One call, no hidden retries. Callers decide how to retry (bounded). */
export async function callModel(
  settings: Settings,
  req: ModelRequest,
  doFetch: Fetch = fetch,
  manual?: ManualOptions,
): Promise<string> {
  if (settings.pool?.length) {
    return (await runPool(settings, { kind: 'text' }, (e, meta) => callOne(e, req, doFetch, undefined, meta), () => callManual(req, manual))).value;
  }
  if (settings.provider === 'manual') return callManual(req, manual);
  return callOne(settings, req, doFetch);
}

/** A single API call to exactly the given provider (no pool, no fallback). */
export async function callOne(settings: Settings, req: ModelRequest, doFetch: Fetch = fetch, signal?: AbortSignal, meta?: CallMeta): Promise<string> {
  if (settings.provider === 'custom' ? !settings.baseUrl?.trim() : !settings.apiKey.trim()) throw new ProviderError(settings.provider === 'custom' ? 'Add the endpoint address in Settings first.' : 'Add your API key in Settings first.', 'auth');
  const r = buildTextRequest(settings, req);
  let res: Response;
  try {
    res = await doFetch(r.url, { method: 'POST', headers: r.headers, body: JSON.stringify(r.body), signal });
  } catch (e) {
    throw new ProviderError(redact(String(e), settings.apiKey), 'network');
  }
  await checkResponse(res, settings);
  if (meta) meta.routedVia = routedVia(res);

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ProviderError('The provider returned unreadable output.', 'bad-output');
  }
  const text = extractReplyText(settings.provider, data);
  if (!text) throw new ProviderError('The provider returned no text.', 'bad-output');
  return text;
}

/** Same prompt to two different enabled providers; returns both outcomes (used for double-checking). */
export function callSecondOpinion(settings: Settings, req: ModelRequest, doFetch: Fetch = fetch): Promise<Opinion<string>[]> {
  return secondOpinion(settings, { kind: 'text' }, (e, meta) => callOne(e, req, doFetch, undefined, meta));
}

/** Validates model output into questions; anything malformed is dropped, not repaired. */
export function parseQuestions(raw: string, topicId: string, idPrefix: string): Question[] {
  const json = extractJson(raw);
  const list = Array.isArray(json) ? json : (json as any)?.questions;
  if (!Array.isArray(list)) return [];
  const out: Question[] = [];
  for (const q of list) {
    const ok =
      q &&
      typeof q.stem === 'string' &&
      Array.isArray(q.choices) &&
      q.choices.length >= 2 &&
      q.choices.every((c: unknown) => typeof c === 'string') &&
      Number.isInteger(q.answerIndex) &&
      q.answerIndex >= 0 &&
      q.answerIndex < q.choices.length &&
      typeof q.rationale === 'string';
    if (ok) {
      const ex = pnleExtras(q, q.choices.length, q.answerIndex); // old-format items pass through unchanged
      if (ex.drop) continue;
      out.push({
        id: `${idPrefix}-${out.length}`,
        topicId,
        stem: ex.stem,
        choices: q.choices,
        answerIndex: q.answerIndex,
        rationale: ex.rationale,
        ...ex.fields,
      });
    }
  }
  return out;
}

/**
 * Like parseQuestions, but each item names its topic (by title) so results credit the right topic.
 * Items naming an unknown topic are dropped rather than guessed.
 */
export function parseTopicQuestions(raw: string, topics: Topic[], idPrefix: string): Question[] {
  const byTitle = new Map(topics.map((t) => [t.title.trim().toLowerCase(), t.id]));
  const json = extractJson(raw);
  const list = Array.isArray(json) ? json : (json as any)?.questions;
  if (!Array.isArray(list)) return [];
  const out: Question[] = [];
  for (const q of list) {
    const topicId = typeof q?.topic === 'string' ? byTitle.get(q.topic.trim().toLowerCase()) : undefined;
    if (!topicId) continue;
    const one = parseQuestions(JSON.stringify([q]), topicId, `${idPrefix}-${out.length}`);
    if (one[0]) out.push({ ...one[0], id: `${idPrefix}-${out.length}` });
  }
  return out;
}
