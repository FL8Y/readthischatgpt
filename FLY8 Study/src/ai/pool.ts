import type { PoolEntry, PoolMode, Settings } from '../core/types';
import { ProviderError } from './provider';
import { providerLabel } from './transport';

/**
 * Provider pool router. Pure apart from the injected runtime (cooldowns, counters) and clock.
 * NOT verified against real services: statuses, Retry-After and error texts are inferred.
 */

export type PoolNeed = { kind: 'text' } | { kind: 'vision'; input: 'image' | 'pdf' };

export interface EntryStats {
  calls: number;
  failures: number;
  cooldowns: number;
}

export interface Answer {
  /** 'manual' when the last-resort copy-paste handled the call. */
  provider: PoolEntry['provider'] | 'manual';
  model: string;
  entryId: string;
  /** Provider name reported by a router such as FreeLLMAPI (X-Routed-Via header). */
  routedVia?: string;
  at: number;
}

export interface PoolRuntime {
  /** entry id -> epoch ms when its cooldown ends */
  cool: Record<string, number>;
  /** entry id -> the key that was rejected (editing the key clears the flag) */
  bad: Record<string, string>;
  stats: Record<string, EntryStats>;
  rr: number;
  last?: Answer;
}

export function createRuntime(): PoolRuntime {
  return { cool: {}, bad: {}, stats: {}, rr: 0 };
}

/** One per app session. */
export const sessionRuntime: PoolRuntime = createRuntime();

export interface PoolEnv {
  now?: () => number;
  rt?: PoolRuntime;
  timeoutMs?: number;
}

export interface CallMeta {
  routedVia?: string;
}

export const DEFAULT_COOLDOWN_MS = 60_000;
export const DAILY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Pool entries, or the legacy single provider migrated into a one-entry list. Manual alone = no entries. */
export function getEntries(settings: Settings): PoolEntry[] {
  if (settings.pool?.length) return settings.pool;
  if (settings.provider === 'manual') return [];
  return [{ id: 'main', provider: settings.provider, apiKey: settings.apiKey, model: settings.model, baseUrl: settings.baseUrl, enabled: true }];
}

/** Keeps provider/apiKey/model mirroring the first entry so older code paths keep working. */
export function withPool(settings: Settings, pool: PoolEntry[]): Settings {
  const first = pool.find((e) => e.enabled) ?? pool[0];
  if (!first) return { ...settings, pool: [], provider: 'manual', apiKey: '', model: '', baseUrl: undefined };
  return { ...settings, pool, provider: first.provider, apiKey: first.apiKey, model: first.model, baseUrl: first.baseUrl };
}

/** Old single-provider settings -> pool settings (idempotent). */
export function migrateToPool(settings: Settings): Settings {
  const s = settings.pool?.length ? settings : withPool(settings, getEntries(settings));
  return { ...s, poolMode: s.poolMode ?? 'fallback', manualLastResort: s.manualLastResort ?? true };
}

/** Model-name heuristic for OpenRouter/Groq: INFERRED, may be out of date. The user picks the model. */
export function looksVisionCapable(model: string): boolean {
  return /vision|(^|[-/_:])vl([-/_:]|$)|llava|pixtral|4o|gpt-4\.1|gpt-5|gemini|claude|llama-4|llama-3\.2-(11|90)b|gemma-3|scout|maverick/i.test(model);
}

export function supportsVision(e: Pick<PoolEntry, 'provider' | 'model'>, input: 'image' | 'pdf'): boolean {
  switch (e.provider) {
    case 'anthropic':
    case 'gemini':
      return true;
    case 'openrouter':
    case 'groq':
      return input === 'image' && looksVisionCapable(e.model);
    default:
      return input === 'image'; // openai, custom (user picks a vision model)
  }
}

export function entrySettings(settings: Settings, e: PoolEntry): Settings {
  return { ...settings, pool: undefined, provider: e.provider, apiKey: e.apiKey, model: e.model, baseUrl: e.baseUrl };
}

function stat(rt: PoolRuntime, id: string): EntryStats {
  return (rt.stats[id] ??= { calls: 0, failures: 0, cooldowns: 0 });
}

export function entryLabel(e: PoolEntry): string {
  return e.provider === 'custom' ? 'Custom endpoint' : providerLabel(e.provider);
}

/** Why an entry cannot be used right now, or undefined. */
export function skipReason(e: PoolEntry, need: PoolNeed, rt: PoolRuntime, now: number): string | undefined {
  if (rt.bad[e.id] !== undefined && rt.bad[e.id] === e.apiKey) return 'its key was rejected (edit the key to try again)';
  if ((rt.cool[e.id] ?? 0) > now) return `cooling down for about ${Math.ceil(((rt.cool[e.id] ?? 0) - now) / 60000)} min`;
  if (need.kind === 'vision' && !supportsVision(e, need.input)) return 'this model cannot read files';
  return undefined;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new ProviderError('The provider took too long to answer.', 'network')), ms);
  });
  return Promise.race([p, timeout]).finally(() => t && clearTimeout(t));
}

export function cooldownFor(e: ProviderError): number {
  if (e.info.daily) return DAILY_COOLDOWN_MS;
  return e.info.retryAfterMs ?? DEFAULT_COOLDOWN_MS;
}

function short(e: ProviderError): string {
  return e.message.replace(/\s+/g, ' ').slice(0, 140);
}

/**
 * Tries the enabled entries in order (fallback) or rotating start (spread).
 * `attempt` makes ONE call with the given single-provider settings.
 */
export async function runPool<T>(
  settings: Settings,
  need: PoolNeed,
  attempt: (entry: Settings, meta: CallMeta) => Promise<T>,
  manualFallback?: () => Promise<T>,
  env: PoolEnv = {},
): Promise<{ value: T; by: Answer }> {
  const rt = env.rt ?? sessionRuntime;
  const now = env.now ?? Date.now;
  const mode: PoolMode = settings.poolMode ?? 'fallback';
  const entries = getEntries(settings).filter((e) => e.enabled);
  const notes: string[] = [];
  const eligible: PoolEntry[] = [];
  for (const e of entries) {
    const why = skipReason(e, need, rt, now());
    if (why) notes.push(`${entryLabel(e)} (${e.model || 'default model'}) skipped: ${why}.`);
    else eligible.push(e);
  }
  let order = eligible;
  if (mode === 'spread' && eligible.length > 1) {
    const start = rt.rr % eligible.length;
    order = [...eligible.slice(start), ...eligible.slice(0, start)];
  }
  rt.rr++;

  let tried = 0;
  let lastError: ProviderError | undefined;
  let allRate = true;
  for (const e of order) {
    tried++;
    const label = `${entryLabel(e)} (${e.model || 'default model'})`;
    let failure: ProviderError | undefined;
    for (let n = 1; n <= 2; n++) {
      const st = stat(rt, e.id);
      st.calls++;
      const meta: CallMeta = {};
      try {
        const value = await withTimeout(attempt(entrySettings(settings, e), meta), env.timeoutMs ?? 90_000);
        const by: Answer = { provider: e.provider, model: e.model, entryId: e.id, routedVia: meta.routedVia, at: now() };
        rt.last = by;
        return { value, by };
      } catch (err) {
        if (!(err instanceof ProviderError) || err.kind === 'cancelled') throw err;
        st.failures++;
        failure = err;
        const retryable = err.kind === 'network' || (err.kind === 'server' && (err.info.status ?? 0) >= 500);
        if (retryable && n === 1) continue;
        break;
      }
    }
    const err = failure as ProviderError;
    lastError = err;
    if (err.kind !== 'rate-limit') allRate = false;
    if (err.kind === 'auth') {
      rt.bad[e.id] = e.apiKey;
      notes.push(`${label}: the key was rejected, so it is switched off until you edit it.`);
    } else if (err.kind === 'rate-limit') {
      rt.cool[e.id] = now() + cooldownFor(err);
      stat(rt, e.id).cooldowns++;
      notes.push(`${label}: limit reached, resting ${err.info.daily ? 'for hours' : 'for a while'}.`);
    } else if (err.kind === 'server' && err.info.status === 400 && !err.info.modelSpecific) {
      throw err; // a plain bad request would fail on every provider; show it
    } else {
      notes.push(`${label}: ${short(err)}`);
    }
  }

  if (manualFallback && settings.manualLastResort !== false) {
    const value = await manualFallback();
    const by: Answer = { provider: 'manual', model: '', entryId: 'manual', at: now() };
    rt.last = by;
    return { value, by };
  }
  if (tried === 1 && notes.length === 1 && lastError) throw lastError; // single entry: keep its own message
  if (!entries.length) throw new ProviderError('No AI provider is switched on. Turn one on in Settings, or use manual mode.', 'auth');
  throw new ProviderError(
    `No AI provider could answer. ${notes.join(' ')} Try again later or switch to manual copy-paste mode in Settings.`,
    tried > 0 && allRate ? 'rate-limit' : lastError?.kind ?? 'server',
  );
}

export interface Opinion<T> {
  by: Answer;
  value?: T;
  error?: string;
}

/**
 * Sends the same request to two different usable entries (different providers preferred) and returns both outcomes.
 * No fallback: a failure is reported, not hidden.
 */
export async function secondOpinion<T>(
  settings: Settings,
  need: PoolNeed,
  attempt: (entry: Settings, meta: CallMeta) => Promise<T>,
  env: PoolEnv = {},
): Promise<Opinion<T>[]> {
  const rt = env.rt ?? sessionRuntime;
  const now = env.now ?? Date.now;
  const usable = getEntries(settings).filter((e) => e.enabled && !skipReason(e, need, rt, now()));
  const first = usable[0];
  if (!first) throw new ProviderError('No AI provider is available for a second opinion.', 'auth');
  const second = usable.find((e) => e !== first && e.provider !== first.provider) ?? usable.find((e) => e !== first);
  if (!second) throw new ProviderError('A second opinion needs two different providers switched on in Settings.', 'auth');
  return Promise.all(
    [first, second].map(async (e): Promise<Opinion<T>> => {
      const meta: CallMeta = {};
      stat(rt, e.id).calls++;
      try {
        const value = await withTimeout(attempt(entrySettings(settings, e), meta), env.timeoutMs ?? 90_000);
        return { by: { provider: e.provider, model: e.model, entryId: e.id, routedVia: meta.routedVia, at: now() }, value };
      } catch (err) {
        stat(rt, e.id).failures++;
        return { by: { provider: e.provider, model: e.model, entryId: e.id, at: now() }, error: err instanceof Error ? err.message : 'failed' };
      }
    }),
  );
}

/** "Answered by Groq (llama-...)" label; includes the router's own provider name when given. */
export function answeredByLabel(a: Answer | undefined): string {
  if (!a) return '';
  if (a.provider === 'manual') return 'Answered by manual copy-paste';
  const base = a.provider === 'custom' ? 'Custom endpoint' : providerLabel(a.provider);
  const via = a.routedVia ? ` via ${a.routedVia}` : '';
  return `Answered by ${base}${via}${a.model ? ` (${a.model})` : ''}`;
}

export function poolSnapshot(settings: Settings, rt: PoolRuntime = sessionRuntime, now: number = Date.now()) {
  return getEntries(settings).map((e) => ({
    id: e.id,
    label: `${entryLabel(e)} ${e.model || ''}`.trim(),
    ...stat(rt, e.id),
    status: skipReason(e, { kind: 'text' }, rt, now) ?? (e.enabled ? 'ready' : 'off'),
  }));
}
