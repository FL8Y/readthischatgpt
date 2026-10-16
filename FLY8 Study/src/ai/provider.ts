import type { ProviderName, Question, Settings, Topic } from '../core/types';
import { extractJson } from '../core/provenance';

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-sonnet-5-5',
};

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'rate-limit' | 'network' | 'bad-output' | 'server',
  ) {
    super(message);
  }
}

export function redact(text: string, apiKey: string): string {
  return apiKey ? text.split(apiKey).join('[redacted]') : text;
}

export interface ModelRequest {
  system: string;
  user: string;
}

type Fetch = typeof fetch;

/** One call, no hidden retries. Callers decide how to retry (bounded). */
export async function callModel(settings: Settings, req: ModelRequest, doFetch: Fetch = fetch): Promise<string> {
  if (!settings.apiKey.trim()) throw new ProviderError('Add your API key in Settings first.', 'auth');
  const model = settings.model || DEFAULT_MODELS[settings.provider];
  const isAnthropic = settings.provider === 'anthropic';
  const url = isAnthropic ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/chat/completions';
  const headers: Record<string, string> = isAnthropic
    ? { 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
    : { authorization: `Bearer ${settings.apiKey}`, 'content-type': 'application/json' };
  const body = isAnthropic
    ? { model, max_tokens: 4096, system: req.system, messages: [{ role: 'user', content: req.user }] }
    : {
        model,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
      };

  let res: Response;
  try {
    res = await doFetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (e) {
    throw new ProviderError(redact(String(e), settings.apiKey), 'network');
  }
  if (res.status === 401 || res.status === 403) throw new ProviderError('The provider rejected your API key.', 'auth');
  if (res.status === 429) throw new ProviderError('Rate limited by the provider. Try again shortly.', 'rate-limit');
  if (!res.ok) throw new ProviderError(`Provider error ${res.status}.`, 'server');

  const data = (await res.json()) as any;
  const text: unknown = isAnthropic ? data?.content?.[0]?.text : data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text) throw new ProviderError('The provider returned no text.', 'bad-output');
  return text;
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
      out.push({
        id: `${idPrefix}-${out.length}`,
        topicId,
        stem: q.stem,
        choices: q.choices,
        answerIndex: q.answerIndex,
        rationale: q.rationale,
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
