import type { PoolEntry, Settings } from '../core/types';
import { fetchModels, SUGGESTED_MODELS, type ModelSuggestion } from './models';
import { callOne, ProviderError } from './provider';
import { getEntries, withPool } from './pool';

/**
 * "Paste your free keys" flow: key detection, default model choice, test run and pool building.
 * Pure apart from the injected fetch. NOT verified against real services (shapes and model names are inferred).
 */

export type QuickProvider = 'gemini' | 'groq' | 'openrouter';
export const QUICK_ORDER: QuickProvider[] = ['gemini', 'groq', 'openrouter'];
export const QUICK_TITLES: Record<QuickProvider, string> = { gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter' };
export const quickId = (p: QuickProvider) => `quick-${p}`;

export interface DetectedKeys {
  gemini?: string;
  groq?: string;
  openrouter?: string;
  /** Key-looking pieces that were not usable (truncated, extra copies, other services). */
  unknown: string[];
}

const GEMINI_MIN = 39; // "AIza" + 35 characters
const GROQ_MIN = 36; // "gsk_" + 32+
const OPENROUTER_MIN = 36; // "sk-or-" + 30+
const MAX_KEY = 200;

/** Finds keys by shape in one pasted blob. Never returns a truncated key. */
export function detectKeys(text: string): DetectedKeys {
  const out: DetectedKeys = { unknown: [] };
  const seen = new Set<string>();
  const addUnknown = (t: string) => {
    if (!out.unknown.includes(t)) out.unknown.push(t);
  };
  // Letters, digits, '_' and '-' make up keys; everything else (spaces, quotes, colons, commas, '=') separates.
  for (const tok of text.split(/[^A-Za-z0-9_-]+/)) {
    if (!tok || seen.has(tok)) continue;
    seen.add(tok);
    if (tok.startsWith('AIza')) {
      if (tok.length >= GEMINI_MIN && tok.length <= MAX_KEY && !out.gemini) out.gemini = tok;
      else addUnknown(tok);
    } else if (tok.startsWith('gsk_')) {
      if (tok.length >= GROQ_MIN && tok.length <= MAX_KEY && !out.groq) out.groq = tok;
      else addUnknown(tok);
    } else if (tok.startsWith('sk-or-')) {
      if (tok.length >= OPENROUTER_MIN && tok.length <= MAX_KEY && !out.openrouter) out.openrouter = tok;
      else addUnknown(tok);
    } else if (/^sk-/.test(tok) || (tok.length >= 24 && /\d/.test(tok) && /[A-Za-z]/.test(tok))) {
      addUnknown(tok); // OpenAI/Anthropic style or some other long secret
    }
  }
  return out;
}

const verOf = (id: string): number => {
  const m = id.match(/(\d+)(?:[.-](\d+))?/);
  return m ? Number(m[1]) + (m[2] ? Number(m[2]) / 100 : 0) : 0;
};

/** Default model from a fetched list; falls back to the suggested default when the list is empty or has no match. */
export function pickDefaultModel(provider: QuickProvider, list: ModelSuggestion[] | undefined): string {
  const fallback = SUGGESTED_MODELS[provider][0];
  const ids = (list ?? []).map((m) => m.id);
  if (!ids.length) return fallback;
  let best: string | undefined;
  if (provider === 'gemini') {
    const flash = ids.filter((i) => /^gemini-/.test(i) && /flash/.test(i) && !/image|tts|audio|live|native|embed|exp|preview|thinking|8b|vision|robotics|computer/.test(i));
    const full = flash.filter((i) => !/lite/.test(i));
    const pool = full.length ? full : flash;
    best = [...pool].sort((a, b) => verOf(b) - verOf(a) || a.length - b.length)[0];
  } else if (provider === 'groq') {
    const ll = ids.filter((i) => /llama-3/.test(i) && /versatile|instant/.test(i) && !/guard|tool-use|vision|whisper|preview/.test(i));
    const rank = (i: string) => (/versatile/.test(i) ? 2 : 1);
    best = [...ll].sort((a, b) => rank(b) - rank(a) || verOf(b) - verOf(a))[0];
  } else {
    const free = ids.filter((i) => /:free$/.test(i) && !/guard|embed|image|audio|vision|-vl|lyria/.test(i));
    const size = (i: string) => Number(i.match(/(\d+(?:\.\d+)?)b\b/i)?.[1] ?? 0);
    const score = (i: string) => (/instruct|chat/.test(i) ? 1000 : 0) + size(i);
    best = [...free].sort((a, b) => score(b) - score(a))[0];
  }
  return best ?? fallback;
}

export type QuickStatus = 'ok' | 'bad-key' | 'rate-limit' | 'offline' | 'other';
export interface QuickResult {
  ok: boolean;
  status: QuickStatus;
  model: string;
  message: string;
}

export const QUICK_MESSAGES: Record<QuickStatus, string> = {
  ok: 'Works.',
  'bad-key': 'This key was rejected. Check you copied all of it.',
  'rate-limit': 'Saved. The key is real but its free limit is used up right now; the app uses it again when it recovers.',
  offline: 'Could not reach the service. Check your internet connection.',
  other: 'The service answered with an error. Try again in a minute.',
};

function statusOf(e: unknown): QuickStatus {
  const kind = e instanceof ProviderError ? e.kind : 'network';
  return kind === 'auth' ? 'bad-key' : kind === 'rate-limit' ? 'rate-limit' : kind === 'network' ? 'offline' : 'other';
}

/** Per provider with a key: list models, choose, then run one tiny test call. Never throws; never echoes a key. */
export async function quickSetup(args: {
  keys: Partial<Record<QuickProvider, string>>;
  doFetch?: typeof fetch;
}): Promise<Partial<Record<QuickProvider, QuickResult>>> {
  const doFetch = args.doFetch ?? fetch;
  const out: Partial<Record<QuickProvider, QuickResult>> = {};
  await Promise.all(
    QUICK_ORDER.map(async (provider) => {
      const apiKey = args.keys[provider]?.trim();
      if (!apiKey) return;
      let list: ModelSuggestion[] | undefined;
      try {
        list = await fetchModels({ provider, apiKey }, doFetch);
      } catch (e) {
        const st = statusOf(e);
        if (st === 'bad-key' || st === 'offline') {
          out[provider] = { ok: false, status: st, model: '', message: QUICK_MESSAGES[st] };
          return;
        }
        list = undefined; // list failed for another reason: use the suggested model
      }
      const model = pickDefaultModel(provider, list);
      try {
        await callOne({ provider, apiKey, model } as Settings, { system: 'Reply with the single word OK.', user: 'ok' }, doFetch);
        out[provider] = { ok: true, status: 'ok', model, message: QUICK_MESSAGES.ok };
      } catch (e) {
        const st = statusOf(e);
        out[provider] = { ok: false, status: st, model, message: QUICK_MESSAGES[st] };
      }
    }),
  );
  return out;
}

/**
 * Pool with [gemini, groq, openrouter] (only those that passed), fallback mode, manual last resort on.
 * Existing entries that were not made by quick setup (and do not reuse the same key) stay after them.
 */
export function buildPoolSettings(
  results: Partial<Record<QuickProvider, QuickResult>>,
  keys: Partial<Record<QuickProvider, string>>,
  existing: Settings,
): Settings {
  const quick: PoolEntry[] = [];
  for (const p of QUICK_ORDER) {
    const r = results[p];
    const key = keys[p]?.trim();
    // A rate-limited key is a real key: keep it (the pool cools it down and retries later).
    if ((r?.ok || (r?.status === 'rate-limit' && r.model)) && key) quick.push({ id: quickId(p), provider: p, apiKey: key, model: r.model, enabled: true });
  }
  if (!quick.length) return existing;
  const usedKeys = new Set(quick.map((e) => e.apiKey));
  const rest = getEntries(existing).filter((e) => !e.id.startsWith('quick-') && !(e.apiKey && usedKeys.has(e.apiKey)));
  return { ...withPool(existing, [...quick, ...rest]), poolMode: 'fallback', manualLastResort: true, aiChosen: true };
}
