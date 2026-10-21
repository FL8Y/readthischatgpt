import type { ProviderName } from '../core/types';
import { authHeaders, GEMINI_BASE, normalizeBaseUrl } from './transport';
import { ProviderError, redact } from './provider';

/**
 * Starter model ids per provider. MAY BE OUT OF DATE: providers rename and retire models often.
 * Use "Fetch available models" in the app for the current list. Free-tier availability and limits
 * are reported by the providers and change; check the provider page.
 */
export const SUGGESTED_MODELS: Record<Exclude<ProviderName, 'manual' | 'custom'>, string[]> = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
  openrouter: ['meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free', 'google/gemma-3-27b-it:free'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  openai: ['gpt-4.1-mini', 'gpt-4.1'],
  anthropic: ['claude-sonnet-5-5'],
};

export interface ProviderInfo {
  name: Exclude<ProviderName, 'manual'>;
  title: string;
  blurb: string;
  keyHint: string;
  keyPlaceholder: string;
}

/** Descriptions shown on the provider cards. */
export const PROVIDER_INFO: ProviderInfo[] = [
  { name: 'gemini', title: 'Gemini', blurb: 'Good starting point, free tier on eligible models.', keyHint: 'Get a key: Google AI Studio (aistudio.google.com), "Get API key".', keyPlaceholder: 'AIza...' },
  { name: 'openrouter', title: 'OpenRouter', blurb: 'One key, many models, some free.', keyHint: 'Get a key: OpenRouter (openrouter.ai), Keys page.', keyPlaceholder: 'sk-or-...' },
  { name: 'groq', title: 'Groq', blurb: 'Very fast, free tier with limits.', keyHint: 'Get a key: GroqCloud console (console.groq.com), API Keys.', keyPlaceholder: 'gsk_...' },
  { name: 'anthropic', title: 'Claude API', blurb: 'Paid by usage. Reads photos and PDFs.', keyHint: 'Get a key: Anthropic Console (console.anthropic.com).', keyPlaceholder: 'sk-ant-...' },
  { name: 'openai', title: 'ChatGPT API', blurb: 'Paid by usage, billed apart from ChatGPT chat plans.', keyHint: 'Get a key: OpenAI platform (platform.openai.com).', keyPlaceholder: 'sk-...' },
  { name: 'custom', title: 'Custom', blurb: 'Any OpenAI-compatible address: FreeLLMAPI, Ollama, LM Studio.', keyHint: 'Key is optional for servers on your own network.', keyPlaceholder: 'optional' },
];

export const LIMITS_NOTE = 'Free-tier limits are reported by the providers and change, so check the provider page.';

/** ---- model-list parsing (pure) ---- */

export interface ModelSuggestion {
  id: string;
  label: string;
  /** Free to use according to the list (OpenRouter), if known. */
  free?: boolean;
  /** The list says it accepts images, if known. */
  vision?: boolean;
}

/** Gemini: GET /v1beta/models. Keeps models that support generateContent. */
export function parseGeminiModels(data: any): ModelSuggestion[] {
  const list: any[] = Array.isArray(data?.models) ? data.models : [];
  return list
    .filter((m) => typeof m?.name === 'string' && Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => ({ id: String(m.name).replace(/^models\//, ''), label: typeof m.displayName === 'string' ? m.displayName : String(m.name) }))
    .filter((m) => m.id);
}

/** OpenRouter: GET /api/v1/models. Free only = prompt and completion price both "0". */
export function parseOpenRouterModels(data: any): ModelSuggestion[] {
  const list: any[] = Array.isArray(data?.data) ? data.data : [];
  return list
    .filter((m) => typeof m?.id === 'string' && Number(m?.pricing?.prompt) === 0 && Number(m?.pricing?.completion) === 0 && m?.pricing?.prompt !== undefined && m?.pricing?.completion !== undefined)
    .map((m) => ({
      id: m.id as string,
      label: typeof m.name === 'string' ? m.name : m.id,
      free: true,
      vision: Array.isArray(m?.architecture?.input_modalities) ? m.architecture.input_modalities.includes('image') : undefined,
    }));
}

/** Groq (OpenAI style): GET /openai/v1/models. Drops models flagged inactive. */
export function parseGroqModels(data: any): ModelSuggestion[] {
  const list: any[] = Array.isArray(data?.data) ? data.data : [];
  return list
    .filter((m) => typeof m?.id === 'string' && m.active !== false)
    .map((m) => ({ id: m.id as string, label: m.id as string }));
}

/** Any OpenAI-style list (custom endpoints). */
export function parseOpenAiStyleModels(data: any): ModelSuggestion[] {
  const list: any[] = Array.isArray(data?.data) ? data.data : [];
  return list.filter((m) => typeof m?.id === 'string').map((m) => ({ id: m.id as string, label: m.id as string }));
}

export function parseModelList(provider: ProviderName, data: unknown): ModelSuggestion[] {
  switch (provider) {
    case 'gemini':
      return parseGeminiModels(data);
    case 'openrouter':
      return parseOpenRouterModels(data);
    case 'groq':
      return parseGroqModels(data);
    case 'custom':
    case 'openai':
      return parseOpenAiStyleModels(data);
    default:
      return [];
  }
}

export function modelListUrl(provider: ProviderName, baseUrl?: string): string | undefined {
  switch (provider) {
    case 'gemini':
      return `${GEMINI_BASE}/models?pageSize=200`;
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/models';
    case 'groq':
      return 'https://api.groq.com/openai/v1/models';
    case 'openai':
      return 'https://api.openai.com/v1/models';
    case 'custom': {
      const b = normalizeBaseUrl(baseUrl);
      return b ? `${b}/models` : undefined;
    }
    default:
      return undefined;
  }
}

/** Calls the provider's model-list endpoint with the pasted key. Friendly errors, key never echoed. */
export async function fetchModels(
  s: { provider: ProviderName; apiKey: string; baseUrl?: string },
  doFetch: typeof fetch = fetch,
): Promise<ModelSuggestion[]> {
  const url = modelListUrl(s.provider, s.baseUrl);
  if (!url) throw new ProviderError('This provider has no model list.', 'bad-output');
  if (s.provider !== 'custom' && s.provider !== 'openrouter' && !s.apiKey.trim()) throw new ProviderError('Paste your key first.', 'auth');
  let res: Response;
  try {
    const headers = { ...authHeaders({ provider: s.provider, apiKey: s.apiKey, model: '', baseUrl: s.baseUrl }) };
    delete headers['content-type'];
    if (!s.apiKey.trim()) delete (headers as Record<string, string>).authorization;
    res = await doFetch(url, { method: 'GET', headers });
  } catch (e) {
    throw new ProviderError(redact(`Could not reach the provider (${String(e)}).`, s.apiKey), 'network');
  }
  if (res.status === 401 || res.status === 403) throw new ProviderError('The provider rejected this key.', 'auth');
  if (res.status === 400 && s.provider === 'gemini') throw new ProviderError('The provider rejected this key.', 'auth');
  if (res.status === 429) throw new ProviderError('Limit reached. Wait a while and try again.', 'rate-limit');
  if (!res.ok) throw new ProviderError(`Provider error ${res.status}.`, 'server');
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ProviderError('The model list could not be read.', 'bad-output');
  }
  return parseModelList(s.provider, data);
}
