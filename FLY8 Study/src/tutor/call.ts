import type { Settings } from '../core/types';
import { callManual, ProviderError, redact, type ModelRequest } from '../ai/provider';
import { runPool, type CallMeta } from '../ai/pool';
import { buildTextRequest, checkResponse, extractReplyText, routedVia } from '../ai/transport';

export class TutorCancelled extends Error {
  constructor() {
    super('Cancelled.');
  }
}

type Fetch = typeof fetch;

async function manualTutor(req: ModelRequest, signal?: AbortSignal): Promise<string> {
  try {
    return await callManual(req, { purpose: 'Tutor question', expect: 'text', signal });
  } catch (e) {
    if (signal?.aborted || (e instanceof ProviderError && e.kind === 'cancelled')) throw new TutorCancelled();
    throw e;
  }
}

/** Same request shape as callModel, plus an AbortSignal. One call per provider, no hidden retries unless a pool is set. */
export async function tutorCall(
  settings: Settings,
  req: ModelRequest,
  signal?: AbortSignal,
  doFetch: Fetch = fetch,
): Promise<string> {
  if (signal?.aborted) throw new TutorCancelled();
  if (settings.pool?.length) {
    return (await runPool(settings, { kind: 'text' }, (e, meta) => tutorOne(e, req, signal, doFetch, meta), () => manualTutor(req, signal))).value;
  }
  if (settings.provider === 'manual') return manualTutor(req, signal);
  return tutorOne(settings, req, signal, doFetch);
}

async function tutorOne(settings: Settings, req: ModelRequest, signal: AbortSignal | undefined, doFetch: Fetch, meta?: CallMeta): Promise<string> {
  if (settings.provider === 'custom' ? !settings.baseUrl?.trim() : !settings.apiKey.trim()) {
    throw new ProviderError(settings.provider === 'custom' ? 'Add the endpoint address in Settings first.' : 'Add your API key in Settings first.', 'auth');
  }
  const r = buildTextRequest(settings, req);
  let res: Response;
  try {
    res = await doFetch(r.url, { method: 'POST', headers: r.headers, body: JSON.stringify(r.body), signal });
  } catch (e) {
    if (signal?.aborted || (e as { name?: string })?.name === 'AbortError') throw new TutorCancelled();
    throw new ProviderError(redact(String(e), settings.apiKey), 'network');
  }
  await checkResponse(res, settings);
  if (meta) meta.routedVia = routedVia(res);

  let data: any;
  try {
    data = await res.json();
  } catch (e) {
    if (signal?.aborted) throw new TutorCancelled();
    throw new ProviderError('The provider returned unreadable output.', 'bad-output');
  }
  const text = extractReplyText(settings.provider, data);
  if (!text) throw new ProviderError('The provider returned no text.', 'bad-output');
  return text;
}
