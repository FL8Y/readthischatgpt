import { describe, expect, it } from 'vitest';
import type { PoolEntry, Settings } from '../src/core/types';
import { SUGGESTED_MODELS } from '../src/ai/models';
import { buildPoolSettings, detectKeys, pickDefaultModel, quickSetup, type QuickResult } from '../src/ai/quickSetup';
import { buildExport } from '../src/core/backup';
import { emptyState } from '../src/storage';

const G = 'AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q'; // 39 chars
const R = 'gsk_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6';
const O = 'sk-or-v1-' + 'ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12';
const m = (...ids: string[]) => ids.map((id) => ({ id, label: id }));

describe('detectKeys', () => {
  it('finds all three in a messy labelled paste with quotes and commas', () => {
    const d = detectKeys(`Gemini: "${G}",\n  groq=${R}\r\n\nOpenRouter -> '${O}'\n`);
    expect(d).toMatchObject({ gemini: G, groq: R, openrouter: O });
    expect(d.unknown).toEqual([]);
  });
  it('takes keys in any order on one line and ignores duplicates', () => {
    const d = detectKeys(`${O} ${G} ${G} ${R} ${R}`);
    expect([d.gemini, d.groq, d.openrouter]).toEqual([G, R, O]);
    expect(d.unknown).toEqual([]);
  });
  it('accepts a plain sk-or- key', () => {
    const k = 'sk-or-' + 'x9Y8z7W6v5U4t3S2r1Q0p9O8n7M6l5K4';
    expect(detectKeys(k).openrouter).toBe(k);
  });
  it('never returns a truncated key', () => {
    const d = detectKeys(`${G.slice(0, 20)} ${R.slice(0, 10)} ${O.slice(0, 15)}`);
    expect(d.gemini).toBeUndefined();
    expect(d.groq).toBeUndefined();
    expect(d.openrouter).toBeUndefined();
    expect(d.unknown).toHaveLength(3);
  });
  it('does not take an OpenAI-style sk- key as OpenRouter', () => {
    const k = 'sk-proj-' + 'abcDEF123456abcDEF123456abcDEF123456';
    const d = detectKeys(`${k}\n${R}`);
    expect(d.openrouter).toBeUndefined();
    expect(d.groq).toBe(R);
    expect(d.unknown).toContain(k);
  });
  it('empty or prose-only text finds nothing', () => {
    expect(detectKeys('')).toEqual({ unknown: [] });
    expect(detectKeys('here are my keys for the app, thanks')).toEqual({ unknown: [] });
  });
  it('a second different key for the same provider goes to unknown, first wins', () => {
    const G2 = 'AIza' + 'Z'.repeat(35);
    const d = detectKeys(`${G} ${G2}`);
    expect(d.gemini).toBe(G);
    expect(d.unknown).toEqual([G2]);
  });
});

describe('pickDefaultModel', () => {
  it('gemini: newest plain flash, skipping lite, image, tts, preview', () => {
    const list = m('gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-image', 'gemini-2.5-flash-preview-tts', 'text-embedding-004');
    expect(pickDefaultModel('gemini', list)).toBe('gemini-2.5-flash');
  });
  it('gemini: uses a lite flash when nothing else qualifies', () => {
    expect(pickDefaultModel('gemini', m('gemini-2.5-pro', 'gemini-2.0-flash-lite'))).toBe('gemini-2.0-flash-lite');
  });
  it('groq: prefers llama 3.x versatile over instant, newest first', () => {
    const list = m('llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'whisper-large-v3', 'llama-guard-3-8b', 'gemma2-9b-it');
    expect(pickDefaultModel('groq', list)).toBe('llama-3.3-70b-versatile');
    expect(pickDefaultModel('groq', m('whisper-large-v3', 'llama-3.1-8b-instant'))).toBe('llama-3.1-8b-instant');
  });
  it('openrouter: free instruct and larger first', () => {
    const list = m('openai/gpt-4o', 'meta-llama/llama-3.2-3b-instruct:free', 'meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free', 'some/model-7b:free');
    expect(pickDefaultModel('openrouter', list)).toBe('meta-llama/llama-3.3-70b-instruct:free');
  });
  it('falls back to the suggested default for empty, undefined or unmatched lists', () => {
    for (const p of ['gemini', 'groq', 'openrouter'] as const) {
      expect(pickDefaultModel(p, [])).toBe(SUGGESTED_MODELS[p][0]);
      expect(pickDefaultModel(p, undefined)).toBe(SUGGESTED_MODELS[p][0]);
      expect(pickDefaultModel(p, m('totally-unrelated'))).toBe(SUGGESTED_MODELS[p][0]);
    }
  });
});

const ok = (m1: string): QuickResult => ({ ok: true, status: 'ok', model: m1, message: 'Works.' });
const bad: QuickResult = { ok: false, status: 'bad-key', model: '', message: 'x' };
const baseSettings: Settings = { provider: 'manual', apiKey: '', model: '' };
const ent = (id: string, provider: PoolEntry['provider'], apiKey: string): PoolEntry => ({ id, provider, apiKey, model: 'm', enabled: true });

describe('buildPoolSettings', () => {
  it('orders gemini, groq, openrouter and skips failed ones', () => {
    const s = buildPoolSettings({ openrouter: ok('o'), gemini: ok('g'), groq: bad }, { gemini: G, groq: R, openrouter: O }, baseSettings);
    expect(s.pool!.map((e) => e.provider)).toEqual(['gemini', 'openrouter']);
    expect(s.poolMode).toBe('fallback');
    expect(s.manualLastResort).toBe(true);
    expect(s.provider).toBe('gemini');
    expect(s.apiKey).toBe(G);
    expect(s.aiChosen).toBe(true);
  });
  it('keeps a rate-limited key (it is real; the pool will cool it down)', () => {
    const limited: QuickResult = { ok: false, status: 'rate-limit', model: 'gm', message: 'x' };
    const s = buildPoolSettings({ gemini: limited, groq: bad }, { gemini: G, groq: R }, baseSettings);
    expect(s.pool!.map((e) => e.provider)).toEqual(['gemini']);
    expect(s.pool![0].model).toBe('gm');
  });
  it('keeps existing non-quick entries after, replaces old quick ones, drops same-key duplicates', () => {
    const existing: Settings = {
      ...baseSettings,
      pool: [ent('quick-groq', 'groq', 'old'), ent('mine', 'openai', 'sk-mine'), ent('dup', 'gemini', G)],
    };
    const s = buildPoolSettings({ gemini: ok('g'), groq: ok('r') }, { gemini: G, groq: R }, existing);
    expect(s.pool!.map((e) => e.id)).toEqual(['quick-gemini', 'quick-groq', 'mine']);
    expect(s.pool![1].apiKey).toBe(R);
  });
  it('changes nothing when no key passed', () => {
    expect(buildPoolSettings({ gemini: bad }, { gemini: G }, baseSettings)).toBe(baseSettings);
  });
  it('keeps a legacy single provider after the quick entries', () => {
    const s = buildPoolSettings({ groq: ok('r') }, { groq: R }, { provider: 'openai', apiKey: 'sk-x', model: 'gpt' });
    expect(s.pool!.map((e) => e.provider)).toEqual(['groq', 'openai']);
  });
});

const jres = (status: number, body: unknown = {}) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => body, text: async () => JSON.stringify(body), headers: { get: () => null } }) as unknown as Response;

describe('quickSetup', () => {
  it('reports mixed success per provider and only for provided keys', async () => {
    const seen: string[] = [];
    const f = (async (url: string, init?: any) => {
      seen.push(String(url));
      const u = String(url);
      if (u.includes('generativelanguage') && u.includes('/models?')) return jres(200, { models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] });
      if (u.includes('generativelanguage')) return jres(200, { candidates: [{ content: { parts: [{ text: 'OK' }] } }] });
      if (u.includes('groq.com') && u.endsWith('/models')) return jres(401, {});
      if (u.includes('groq.com')) return jres(401, {});
      if (u.includes('openrouter.ai') && u.endsWith('/models')) return jres(200, { data: [{ id: 'meta-llama/llama-3.3-70b-instruct:free', pricing: { prompt: '0', completion: '0' } }] });
      if (u.includes('openrouter.ai')) return jres(429, { error: { message: 'limit' } });
      return jres(500);
    }) as unknown as typeof fetch;
    const r = await quickSetup({ keys: { gemini: G, groq: R, openrouter: O }, doFetch: f });
    expect(r.gemini).toMatchObject({ ok: true, status: 'ok', model: 'gemini-2.5-flash' });
    expect(r.groq).toMatchObject({ ok: false, status: 'bad-key' });
    expect(r.openrouter).toMatchObject({ ok: false, status: 'rate-limit', model: 'meta-llama/llama-3.3-70b-instruct:free' });
    const none = await quickSetup({ keys: {}, doFetch: f });
    expect(none).toEqual({});
    for (const x of Object.values(r)) expect(JSON.stringify(x)).not.toMatch(/AIza|gsk_|sk-or/);
  });
  it('reports no network and falls back to the suggested model when only the list call fails', async () => {
    const down = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const r1 = await quickSetup({ keys: { groq: R }, doFetch: down });
    expect(r1.groq).toMatchObject({ ok: false, status: 'offline' });
    const f = (async (url: string) => {
      const u = String(url);
      if (u.endsWith('/models')) return jres(500);
      return jres(200, { choices: [{ message: { content: 'OK' } }] });
    }) as unknown as typeof fetch;
    const r2 = await quickSetup({ keys: { groq: R }, doFetch: f });
    expect(r2.groq).toMatchObject({ ok: true, model: SUGGESTED_MODELS.groq[0] });
  });
});

describe('keys in backups', () => {
  it('quick-setup keys never reach the export', () => {
    const st = emptyState();
    st.settings = buildPoolSettings({ gemini: ok('g'), groq: ok('r'), openrouter: ok('o') }, { gemini: G, groq: R, openrouter: O }, st.settings);
    expect(st.settings.pool).toHaveLength(3);
    const text = buildExport(st, {});
    for (const k of [G, R, O]) expect(text).not.toContain(k);
  });
});
