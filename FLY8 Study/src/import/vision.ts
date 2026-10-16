import type { Settings } from '../core/types';
import { DEFAULT_MODELS, ProviderError, redact } from '../ai/provider';
import type { VisionInput, VisionResult } from './types';

export const TRANSCRIBE_SYSTEM =
  'You transcribe nursing study notes from a photo or PDF into clean Markdown. ' +
  'Copy the content faithfully: keep headings, lists, tables and drug names/doses exactly as written. ' +
  'Write [illegible] where you cannot read something; never guess or fill gaps. ' +
  'Do not add facts, citations, page numbers or URLs that are not visible in the file. ' +
  'Reply with the Markdown only, no commentary.';

export const TRANSCRIBE_USER = 'Transcribe this file into Markdown.';

type Fetch = typeof fetch;

export interface VisionRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Pure: builds the provider-specific request. Throws ProviderError for unsupported combinations. */
export function buildVisionRequest(settings: Settings, input: VisionInput): VisionRequest {
  if (!settings.apiKey.trim()) throw new ProviderError('Add your API key in Settings first.', 'auth');
  const model = settings.model || DEFAULT_MODELS[settings.provider];

  if (settings.provider === 'anthropic') {
    const block =
      input.kind === 'pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.base64 } }
        : { type: 'image', source: { type: 'base64', media_type: input.mediaType, data: input.base64 } };
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: {
        model,
        max_tokens: 8192,
        system: TRANSCRIBE_SYSTEM,
        messages: [{ role: 'user', content: [block, { type: 'text', text: TRANSCRIBE_USER }] }],
      },
    };
  }

  if (input.kind === 'pdf') {
    throw new ProviderError(
      'PDF import is not supported with OpenAI here. Take photos of the pages instead, or switch to Claude in Settings.',
      'bad-output',
    );
  }
  return {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: { authorization: `Bearer ${settings.apiKey}`, 'content-type': 'application/json' },
    body: {
      model,
      messages: [
        { role: 'system', content: TRANSCRIBE_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: TRANSCRIBE_USER },
            { type: 'image_url', image_url: { url: `data:${input.mediaType};base64,${input.base64}` } },
          ],
        },
      ],
    },
  };
}

/** Pure: pulls the Markdown out of a provider reply. */
export function parseVisionReply(provider: Settings['provider'], data: any): VisionResult {
  let text: unknown;
  let truncated = false;
  if (provider === 'anthropic') {
    const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
    text = blocks
      .filter((b) => b?.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n\n');
    truncated = data?.stop_reason === 'max_tokens';
  } else {
    text = data?.choices?.[0]?.message?.content;
    truncated = data?.choices?.[0]?.finish_reason === 'length';
  }
  if (typeof text !== 'string' || !text.trim()) {
    throw new ProviderError('The AI returned no text for that file.', 'bad-output');
  }
  return { text: text.trim(), truncated };
}

/** Thin wrapper: one call, no hidden retries. The key never appears in thrown messages. */
export async function callModelVision(
  settings: Settings,
  input: VisionInput,
  doFetch: Fetch = fetch,
): Promise<VisionResult> {
  const req = buildVisionRequest(settings, input);
  let res: Response;
  try {
    res = await doFetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
  } catch (e) {
    throw new ProviderError(redact(`Could not reach the AI (${String(e)}). Check your connection.`, settings.apiKey), 'network');
  }
  if (res.status === 401 || res.status === 403) throw new ProviderError('The provider rejected your API key.', 'auth');
  if (res.status === 429) throw new ProviderError('Rate limited by the provider. Try again shortly.', 'rate-limit');
  if (res.status === 413) throw new ProviderError('The provider says that file is too large.', 'server');
  if (!res.ok) throw new ProviderError(`Provider error ${res.status}.`, 'server');
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ProviderError('The provider sent a reply that could not be read.', 'bad-output');
  }
  return parseVisionReply(settings.provider, data);
}
