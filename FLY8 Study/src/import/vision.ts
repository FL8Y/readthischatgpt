import type { Settings } from '../core/types';
import { callManual, ProviderError, redact } from '../ai/provider';
import { looksVisionCapable, runPool, type CallMeta } from '../ai/pool';
import { authHeaders, chatUrl, checkResponse, modelFor, providerLabel, routedVia } from '../ai/transport';
import type { VisionInput, VisionResult } from './types';

export const TRANSCRIBE_SYSTEM =
  'You transcribe nursing study notes from a photo or PDF into clean Markdown. ' +
  'Copy the content faithfully: keep headings, lists, tables and drug names/doses exactly as written. ' +
  'Write [illegible] where you cannot read something; never guess or fill gaps. ' +
  'Do not add facts, citations, page numbers or URLs that are not visible in the file. ' +
  'Reply with the Markdown only, no commentary.';

export const TRANSCRIBE_USER = 'Transcribe this file into Markdown.';

/** Manual mode: the owner attaches the file in the chat app themselves (the app cannot send files). */
export const TRANSCRIBE_MANUAL_USER =
  'ATTACH THE PHOTO(S) OR PDF in this chat now (use the + or paperclip button), then send this message. ' +
  'Transcribe the attached file into Markdown. If you attach several photos, transcribe them in order.';

type Fetch = typeof fetch;

export interface VisionRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Pure: builds the provider-specific request. Throws ProviderError for unsupported combinations. */
export function buildVisionRequest(settings: Settings, input: VisionInput): VisionRequest {
  if (settings.provider === 'custom' ? !settings.baseUrl?.trim() : !settings.apiKey.trim()) {
    throw new ProviderError(settings.provider === 'custom' ? 'Add the endpoint address in Settings first.' : 'Add your API key in Settings first.', 'auth');
  }
  const model = modelFor(settings);
  const p = settings.provider;
  if ((p === 'openrouter' || p === 'groq') && !looksVisionCapable(model)) {
    throw new ProviderError(
      `The model "${model}" does not look like a vision model. Pick a vision model for ${providerLabel(p)} in Settings, or use manual mode and attach the photo in your chat app.`,
      'bad-output',
    );
  }

  if (p === 'gemini') {
    // Images and PDF both go as inlineData.
    return {
      url: chatUrl(settings),
      headers: authHeaders(settings),
      body: {
        systemInstruction: { parts: [{ text: TRANSCRIBE_SYSTEM }] },
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: input.mediaType, data: input.base64 } }, { text: TRANSCRIBE_USER }] }],
        generationConfig: { maxOutputTokens: 8192 },
      },
    };
  }

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
      `PDF import is not supported with ${providerLabel(p)} here. Take photos of the pages instead, or switch to Claude or Gemini in Settings.`,
      'bad-output',
    );
  }
  return {
    url: chatUrl(settings),
    headers: authHeaders(settings),
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
  } else if (provider === 'gemini') {
    const parts: any[] = Array.isArray(data?.candidates?.[0]?.content?.parts) ? data.candidates[0].content.parts : [];
    text = parts.filter((x) => typeof x?.text === 'string').map((x) => x.text).join('');
    truncated = data?.candidates?.[0]?.finishReason === 'MAX_TOKENS';
  } else {
    text = data?.choices?.[0]?.message?.content;
    truncated = data?.choices?.[0]?.finish_reason === 'length';
  }
  if (typeof text !== 'string' || !text.trim()) {
    throw new ProviderError('The AI returned no text for that file.', 'bad-output');
  }
  return { text: text.trim(), truncated };
}

/** Thin wrapper: one call, no hidden retries unless a provider pool is set. The key never appears in thrown messages. */
export async function callModelVision(
  settings: Settings,
  input: VisionInput,
  doFetch: Fetch = fetch,
): Promise<VisionResult> {
  const manual = async (): Promise<VisionResult> => {
    const label = input.kind === 'pdf' ? 'PDF' : 'photo';
    const text = await callManual(
      { system: TRANSCRIBE_SYSTEM, user: TRANSCRIBE_MANUAL_USER },
      { purpose: `Transcribe a ${label} (attach it in the chat app)`, expect: 'markdown' },
    );
    return { text: text.trim(), truncated: false };
  };
  if (settings.pool?.length) {
    const need = { kind: 'vision', input: input.kind === 'pdf' ? 'pdf' : 'image' } as const;
    return (await runPool(settings, need, (e, meta) => callVisionOne(e, input, doFetch, meta), manual)).value;
  }
  if (settings.provider === 'manual') return manual();
  return callVisionOne(settings, input, doFetch);
}

async function callVisionOne(settings: Settings, input: VisionInput, doFetch: Fetch, meta?: CallMeta): Promise<VisionResult> {
  const req = buildVisionRequest(settings, input);
  let res: Response;
  try {
    res = await doFetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
  } catch (e) {
    throw new ProviderError(redact(`Could not reach the AI (${String(e)}). Check your connection.`, settings.apiKey), 'network');
  }
  const p = settings.provider;
  if ((p === 'openrouter' || p === 'groq' || p === 'custom') && (res.status === 400 || res.status === 404 || res.status === 422)) {
    throw new ProviderError(
      `${providerLabel(p)} would not accept the image. The chosen model is probably not a vision model: pick a vision model in Settings, or use manual mode.`,
      'server',
      { status: res.status, modelSpecific: true },
    );
  }
  if (res.status === 413) throw new ProviderError('The provider says that file is too large.', 'server', { status: 413 });
  await checkResponse(res, settings);
  if (meta) meta.routedVia = routedVia(res);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ProviderError('The provider sent a reply that could not be read.', 'bad-output');
  }
  return parseVisionReply(settings.provider, data);
}
