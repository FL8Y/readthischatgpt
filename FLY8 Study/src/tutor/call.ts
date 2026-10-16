import type { Settings } from '../core/types';
import { DEFAULT_MODELS, ProviderError, redact, type ModelRequest } from '../ai/provider';

export class TutorCancelled extends Error {
  constructor() {
    super('Cancelled.');
  }
}

type Fetch = typeof fetch;

/** Same request shape as callModel, plus an AbortSignal. One call, no hidden retries. */
export async function tutorCall(
  settings: Settings,
  req: ModelRequest,
  signal?: AbortSignal,
  doFetch: Fetch = fetch,
): Promise<string> {
  if (!settings.apiKey.trim()) throw new ProviderError('Add your API key in Settings first.', 'auth');
  if (signal?.aborted) throw new TutorCancelled();
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
    res = await doFetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
  } catch (e) {
    if (signal?.aborted || (e as { name?: string })?.name === 'AbortError') throw new TutorCancelled();
    throw new ProviderError(redact(String(e), settings.apiKey), 'network');
  }
  if (res.status === 401 || res.status === 403) throw new ProviderError('The provider rejected your API key.', 'auth');
  if (res.status === 429) throw new ProviderError('Rate limited by the provider. Try again shortly.', 'rate-limit');
  if (!res.ok) throw new ProviderError(`Provider error ${res.status}.`, 'server');

  let data: any;
  try {
    data = await res.json();
  } catch (e) {
    if (signal?.aborted) throw new TutorCancelled();
    throw new ProviderError('The provider returned unreadable output.', 'bad-output');
  }
  const text: unknown = isAnthropic ? data?.content?.[0]?.text : data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text) throw new ProviderError('The provider returned no text.', 'bad-output');
  return text;
}
