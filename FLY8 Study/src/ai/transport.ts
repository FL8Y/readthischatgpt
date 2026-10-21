import type { ProviderName, Settings } from '../core/types';
import { DEFAULT_MODELS, ProviderError } from './provider';

/** Pure request building / reply parsing for every API provider (manual mode never reaches here). */

export interface HttpRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Providers that speak the OpenAI chat-completions format. */
export function isOpenAiStyle(p: ProviderName): boolean {
  return p === 'openai' || p === 'openrouter' || p === 'groq' || p === 'custom';
}

/**
 * Any OpenAI-compatible endpoint. Trims, drops trailing slashes and a pasted /chat/completions,
 * and adds /v1 when the URL has no version segment (http://host:3001 -> http://host:3001/v1).
 */
export function normalizeBaseUrl(raw: string | undefined): string {
  let u = (raw ?? '').trim().replace(/\/+$/, '');
  u = u.replace(/\/chat\/completions$/i, '').replace(/\/+$/, '');
  if (!u) return '';
  if (!/\/v\d+$/i.test(u)) u += '/v1';
  return u;
}

export function customChatUrl(raw: string | undefined): string {
  const base = normalizeBaseUrl(raw);
  return base ? `${base}/chat/completions` : '';
}

/** True for a plain http:// URL, which Android may block and which sends the key unencrypted. */
export function isPlainHttp(raw: string | undefined): boolean {
  return /^http:\/\//i.test((raw ?? '').trim());
}

export const HTTP_WARNING =
  'This address starts with http:// (not encrypted). It only works on the same Wi-Fi or a network you trust, and your key and notes travel unprotected.';

/** Placeholder shown for the FreeLLMAPI preset. */
export const FREELLMAPI_URL_PLACEHOLDER = 'http://192.168.x.x:3001/v1';

export function providerLabel(p: ProviderName): string {
  return { openai: 'OpenAI', anthropic: 'Claude', gemini: 'Gemini', openrouter: 'OpenRouter', groq: 'Groq', custom: 'Custom endpoint', manual: 'Manual' }[p];
}

export function modelFor(settings: Settings): string {
  return settings.model.trim() || DEFAULT_MODELS[settings.provider];
}

export function authHeaders(settings: Settings): Record<string, string> {
  const key = settings.apiKey;
  switch (settings.provider) {
    case 'anthropic':
      return { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
    case 'gemini':
      return { 'x-goog-api-key': key, 'content-type': 'application/json' };
    case 'openrouter':
      return { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'HTTP-Referer': 'https://fly8.study.local', 'X-Title': 'FLY8 Study' };
    case 'custom':
      return key.trim() ? { authorization: `Bearer ${key}`, 'content-type': 'application/json' } : { 'content-type': 'application/json' };
    default:
      return { authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  }
}

export function chatUrl(settings: Settings): string {
  switch (settings.provider) {
    case 'anthropic':
      return ANTHROPIC_URL;
    case 'openrouter':
      return OPENROUTER_URL;
    case 'groq':
      return GROQ_URL;
    case 'custom':
      return customChatUrl(settings.baseUrl);
    case 'gemini':
      return `${GEMINI_BASE}/models/${encodeURIComponent(modelFor(settings))}:generateContent`;
    default:
      return OPENAI_URL;
  }
}

export function buildTextRequest(settings: Settings, req: { system: string; user: string }): HttpRequest {
  const model = modelFor(settings);
  const url = chatUrl(settings);
  const headers = authHeaders(settings);
  if (settings.provider === 'anthropic') {
    return { url, headers, body: { model, max_tokens: 4096, system: req.system, messages: [{ role: 'user', content: req.user }] } };
  }
  if (settings.provider === 'gemini') {
    return {
      url,
      headers,
      body: {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        generationConfig: { maxOutputTokens: 4096 },
      },
    };
  }
  return {
    url,
    headers,
    body: {
      model,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
    },
  };
}

/** Text of a reply, or undefined if there is none. */
export function extractReplyText(provider: ProviderName, data: any): string | undefined {
  let text: unknown;
  if (provider === 'anthropic') text = data?.content?.[0]?.text;
  else if (provider === 'gemini') {
    const parts: any[] = Array.isArray(data?.candidates?.[0]?.content?.parts) ? data.candidates[0].content.parts : [];
    text = parts.filter((p) => typeof p?.text === 'string').map((p) => p.text).join('');
  } else text = data?.choices?.[0]?.message?.content;
  return typeof text === 'string' && text ? text : undefined;
}

/** Reads the router-reported provider (FreeLLMAPI sends X-Routed-Via). */
export function routedVia(res: Response): string | undefined {
  try {
    const v = res.headers?.get?.('x-routed-via');
    return v && v.trim() ? v.trim().slice(0, 60) : undefined;
  } catch {
    return undefined;
  }
}

function retryAfterMs(res: Response): number | undefined {
  try {
    const v = res.headers?.get?.('retry-after');
    if (!v) return undefined;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.min(n, 24 * 3600) * 1000;
    const d = Date.parse(v);
    return Number.isNaN(d) ? undefined : Math.max(0, d - Date.now());
  } catch {
    return undefined;
  }
}

async function bodyText(res: Response): Promise<string> {
  try {
    return typeof res.text === 'function' ? (await res.text()).slice(0, 2000) : '';
  } catch {
    return '';
  }
}

/** Throws the friendly ProviderError for a non-OK response; returns normally when ok. */
export async function checkResponse(res: Response, settings: Settings): Promise<void> {
  if (res.ok) return;
  const name = settings.provider === 'custom' ? 'The custom endpoint' : providerLabel(settings.provider);
  const info = { status: res.status };
  if (res.status === 401 || res.status === 403) throw new ProviderError(`${name} rejected your API key.`, 'auth', info);
  const body = res.status === 400 || res.status === 404 || res.status === 413 || res.status === 429 ? await bodyText(res) : '';
  if (res.status === 400 && settings.provider === 'gemini' && /API_KEY_INVALID|API key not valid/i.test(body)) {
    throw new ProviderError('Gemini rejected your API key.', 'auth', info);
  }
  if (res.status === 429) {
    throw new ProviderError(`${name} says a rate or daily limit was reached. Wait a while, switch provider, or use manual mode.`, 'rate-limit', {
      ...info,
      retryAfterMs: retryAfterMs(res),
      daily: /daily|per day|quota|exceeded your current/i.test(body),
    });
  }
  const modelSpecific =
    (res.status === 400 || res.status === 404 || res.status === 413) &&
    /model|context|too long|too large|maximum.*token|token.*limit|not found|not supported/i.test(body);
  throw new ProviderError(`Provider error ${res.status}.`, 'server', { ...info, modelSpecific });
}
