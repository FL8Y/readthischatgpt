import { describe, expect, it, vi } from 'vitest';
import type { PoolEntry, Settings } from '../src/core/types';
import { callModel, callSecondOpinion, DEFAULT_MODELS, ProviderError } from '../src/ai/provider';
import { buildVisionRequest, callModelVision, parseVisionReply } from '../src/import/vision';
import { tutorCall } from '../src/tutor/call';
import { buildTextRequest, customChatUrl, HTTP_WARNING, isPlainHttp, normalizeBaseUrl } from '../src/ai/transport';
import {
  fetchModels, modelListUrl, parseGeminiModels, parseGroqModels, parseOpenRouterModels, SUGGESTED_MODELS,
} from '../src/ai/models';
import {
  answeredByLabel, cooldownFor, createRuntime, DAILY_COOLDOWN_MS, DEFAULT_COOLDOWN_MS, getEntries, migrateToPool,
  runPool, supportsVision, withPool,
} from '../src/ai/pool';
import { applyImport, buildExport, stripKeys, validateBackup } from '../src/core/backup';
import { emptyState } from '../src/storage';
import { GUIDE_SECTIONS } from '../src/ai/freeAiGuide';

const KEY = 'secret-key-abc';
const base = (provider: Settings['provider'], extra: Partial<Settings> = {}): Settings => ({ provider, apiKey: KEY, model: '', ...extra });
const REQ = { system: 'sys', user: 'hello' };

const res = (status: number, body: unknown = {}, headers: Record<string, string> = {}, text = '') =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => text || JSON.stringify(body),
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  }) as unknown as Response;
const oaiOk = (t = 'hi') => ({ choices: [{ message: { content: t } }] });
const fetchOf = (...rs: Response[]) => {
  const f = vi.fn();
  rs.forEach((r) => f.mockResolvedValueOnce(r));
  f.mockResolvedValue(rs[rs.length - 1]);
  return f;
};

describe('request shapes', () => {
  it('gemini', () => {
    const r = buildTextRequest(base('gemini', { model: 'gemini-x' }), REQ);
    expect(r.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent');
    expect(r.headers['x-goog-api-key']).toBe(KEY);
    expect(r.body).toEqual({
      systemInstruction: { parts: [{ text: 'sys' }] },
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      generationConfig: { maxOutputTokens: 4096 },
    });
  });
  it('openrouter and groq reuse the OpenAI body with their own url and bearer key', () => {
    const o = buildTextRequest(base('openrouter'), REQ);
    expect(o.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(o.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(o.headers['X-Title']).toBeTruthy();
    expect((o.body as any).messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect((o.body as any).model).toBe(DEFAULT_MODELS.openrouter);
    const g = buildTextRequest(base('groq', { model: 'm1' }), REQ);
    expect(g.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((g.body as any).model).toBe('m1');
    expect(g.headers['X-Title']).toBeUndefined();
  });
  it('default models exist per provider', () => {
    expect(DEFAULT_MODELS.gemini).toMatch(/flash/);
    expect(DEFAULT_MODELS.groq).toMatch(/llama/);
    expect(DEFAULT_MODELS.openrouter).toMatch(/:free$/);
    for (const p of ['gemini', 'openrouter', 'groq'] as const) expect(SUGGESTED_MODELS[p]).toContain(DEFAULT_MODELS[p]);
  });
});

describe('callModel per provider', () => {
  it('parses gemini parts joined', async () => {
    const f = fetchOf(res(200, { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] }));
    expect(await callModel(base('gemini'), REQ, f)).toBe('ab');
    expect(f.mock.calls[0][1].headers['x-goog-api-key']).toBe(KEY);
  });
  it('parses openrouter and groq', async () => {
    expect(await callModel(base('openrouter'), REQ, fetchOf(res(200, oaiOk('x'))))).toBe('x');
    expect(await callModel(base('groq'), REQ, fetchOf(res(200, oaiOk('y'))))).toBe('y');
  });
  it('maps 401/403, 429, 5xx and network errors without leaking the key', async () => {
    for (const p of ['gemini', 'openrouter', 'groq'] as const) {
      await expect(callModel(base(p), REQ, fetchOf(res(401)))).rejects.toMatchObject({ kind: 'auth' });
      await expect(callModel(base(p), REQ, fetchOf(res(403)))).rejects.toMatchObject({ kind: 'auth' });
      await expect(callModel(base(p), REQ, fetchOf(res(429)))).rejects.toMatchObject({ kind: 'rate-limit' });
      await expect(callModel(base(p), REQ, fetchOf(res(500)))).rejects.toMatchObject({ kind: 'server' });
    }
    const boom = vi.fn().mockRejectedValue(new Error(`failed for ${KEY}`));
    const e = await callModel(base('groq'), REQ, boom).catch((x) => x);
    expect(e.kind).toBe('network');
    expect(e.message).not.toContain(KEY);
  });
  it('gemini 400 API_KEY_INVALID is a bad key', async () => {
    const f = fetchOf(res(400, {}, {}, '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}'));
    await expect(callModel(base('gemini'), REQ, f)).rejects.toMatchObject({ kind: 'auth' });
  });
  it('empty reply is bad-output; tutor uses the same routing', async () => {
    await expect(callModel(base('groq'), REQ, fetchOf(res(200, {})))).rejects.toMatchObject({ kind: 'bad-output' });
    expect(await tutorCall(base('gemini'), REQ, undefined, fetchOf(res(200, { candidates: [{ content: { parts: [{ text: 'T' }] } }] })))).toBe('T');
  });
});

describe('vision', () => {
  const img = { kind: 'image', mediaType: 'image/png', base64: 'AAAA' } as const;
  const pdf = { kind: 'pdf', mediaType: 'application/pdf', base64: 'BBBB' } as const;
  it('gemini sends inlineData for image and pdf', () => {
    const r = buildVisionRequest(base('gemini'), pdf);
    const parts = (r.body as any).contents[0].parts;
    expect(parts[0]).toEqual({ inlineData: { mimeType: 'application/pdf', data: 'BBBB' } });
    expect((buildVisionRequest(base('gemini'), img).body as any).contents[0].parts[0].inlineData.mimeType).toBe('image/png');
  });
  it('gemini reply parsing', () => {
    expect(parseVisionReply('gemini', { candidates: [{ content: { parts: [{ text: ' md ' }] }, finishReason: 'MAX_TOKENS' }] })).toEqual({ text: 'md', truncated: true });
  });
  it('groq/openrouter use image_url data URLs for vision models only', () => {
    const r = buildVisionRequest(base('groq', { model: 'meta-llama/llama-4-scout-17b-16e-instruct' }), img);
    expect((r.body as any).messages[1].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } });
    expect(() => buildVisionRequest(base('openrouter', { model: 'meta-llama/llama-3.3-70b-instruct:free' }), img)).toThrow(/vision model/);
    expect(() => buildVisionRequest(base('groq', { model: 'llama-4-scout' }), pdf)).toThrow(/PDF/);
  });
  it('a 400 from a non-vision model becomes a clear message', async () => {
    const e = await callModelVision(base('openrouter', { model: 'x/vision-model' }), img, fetchOf(res(400))).catch((x) => x);
    expect(e).toBeInstanceOf(ProviderError);
    expect(e.message).toMatch(/vision model/);
  });
});

describe('model-list parsers', () => {
  it('gemini keeps generateContent models and strips models/', () => {
    const out = parseGeminiModels({
      models: [
        { name: 'models/gemini-2.5-flash', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
        { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
      ],
    });
    expect(out).toEqual([{ id: 'gemini-2.5-flash', label: 'Gemini Flash' }]);
  });
  it('openrouter keeps only free models', () => {
    const out = parseOpenRouterModels({
      data: [
        { id: 'a/b:free', name: 'AB', pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text', 'image'] } },
        { id: 'c/d', pricing: { prompt: '0.000001', completion: '0.000002' } },
        { id: 'e/f', pricing: { prompt: '0' } },
      ],
    });
    expect(out.map((m) => m.id)).toEqual(['a/b:free']);
    expect(out[0].vision).toBe(true);
  });
  it('groq keeps active models', () => {
    expect(parseGroqModels({ data: [{ id: 'llama-3.1-8b-instant', active: true }, { id: 'old', active: false }, { id: 'w' }] }).map((m) => m.id)).toEqual(['llama-3.1-8b-instant', 'w']);
  });
  it('fetchModels calls the list url with the key and maps errors', async () => {
    const f = fetchOf(res(200, { data: [{ id: 'm1' }] }));
    expect((await fetchModels({ provider: 'groq', apiKey: KEY }, f)).map((m) => m.id)).toEqual(['m1']);
    expect(f.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/models');
    expect(f.mock.calls[0][1].headers.authorization).toBe(`Bearer ${KEY}`);
    await expect(fetchModels({ provider: 'groq', apiKey: KEY }, fetchOf(res(401)))).rejects.toMatchObject({ kind: 'auth' });
    await expect(fetchModels({ provider: 'groq', apiKey: KEY }, fetchOf(res(429)))).rejects.toMatchObject({ kind: 'rate-limit' });
    expect(modelListUrl('gemini')).toContain('/v1beta/models');
  });
});

describe('custom endpoint', () => {
  it('normalizes base urls', () => {
    expect(normalizeBaseUrl('http://192.168.1.2:3001/v1')).toBe('http://192.168.1.2:3001/v1');
    expect(normalizeBaseUrl('http://192.168.1.2:3001/v1/')).toBe('http://192.168.1.2:3001/v1');
    expect(normalizeBaseUrl('http://192.168.1.2:3001')).toBe('http://192.168.1.2:3001/v1');
    expect(normalizeBaseUrl(' https://x.example/api/v1/chat/completions ')).toBe('https://x.example/api/v1');
    expect(normalizeBaseUrl('')).toBe('');
    expect(customChatUrl('http://h:11434')).toBe('http://h:11434/v1/chat/completions');
  });
  it('warns only for plain http', () => {
    expect(isPlainHttp('http://192.168.1.2:3001/v1')).toBe(true);
    expect(isPlainHttp('HTTP://x')).toBe(true);
    expect(isPlainHttp('https://x')).toBe(false);
    expect(isPlainHttp(undefined)).toBe(false);
    expect(HTTP_WARNING).toMatch(/same Wi-Fi/);
  });
  it('key is optional, header only when present, X-Routed-Via is read', async () => {
    const s = base('custom', { apiKey: '', baseUrl: 'http://h:3001', model: 'auto' });
    const f = fetchOf(res(200, oaiOk('ok'), { 'x-routed-via': 'groq' }));
    expect(await callModel(s, REQ, f)).toBe('ok');
    expect(f.mock.calls[0][0]).toBe('http://h:3001/v1/chat/completions');
    expect(f.mock.calls[0][1].headers.authorization).toBeUndefined();
    expect(JSON.parse(f.mock.calls[0][1].body).model).toBe('auto');
    await expect(callModel(base('custom', { apiKey: '' }), REQ, f)).rejects.toMatchObject({ kind: 'auth' });
  });
  it('answered-by label includes the router header', () => {
    const at = 0;
    expect(answeredByLabel({ provider: 'custom', model: 'auto', entryId: 'x', routedVia: 'groq', at })).toBe('Answered by Custom endpoint via groq (auto)');
    expect(answeredByLabel({ provider: 'gemini', model: 'gemini-2.5-flash', entryId: 'x', at })).toBe('Answered by Gemini (gemini-2.5-flash)');
    expect(answeredByLabel({ provider: 'manual', model: '', entryId: 'manual', at })).toMatch(/manual/);
    expect(answeredByLabel(undefined)).toBe('');
  });
});

const entry = (id: string, provider: PoolEntry['provider'], extra: Partial<PoolEntry> = {}): PoolEntry => ({ id, provider, apiKey: `k-${id}`, model: '', enabled: true, ...extra });
const poolSettings = (entries: PoolEntry[], extra: Partial<Settings> = {}): Settings => withPool({ provider: 'manual', apiKey: '', model: '', ...extra }, entries);
const clock = (t = 1_000_000) => {
  let now = t;
  return { now: () => now, advance: (ms: number) => (now += ms) };
};

/** fetch that answers by hostname */
const byHost = (map: Record<string, Response | (() => Response)>) =>
  vi.fn(async (url: string) => {
    const key = Object.keys(map).find((k) => String(url).includes(k));
    if (!key) throw new Error('unexpected ' + url);
    const v = map[key];
    return typeof v === 'function' ? v() : v;
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
const geminiOk = (t: string) => res(200, { candidates: [{ content: { parts: [{ text: t }] } }] });

describe('pool router', () => {
  it('fallback tries entries in order', async () => {
    const rt = createRuntime();
    const s = poolSettings([entry('a', 'groq'), entry('b', 'gemini')]);
    const f = byHost({ groq: res(500), generativelanguage: geminiOk('G') });
    const out = await runPool(s, { kind: 'text' }, (e) => import('../src/ai/provider').then((m) => m.callOne(e, REQ, f as any)), undefined, { rt, now: clock().now });
    expect(out.value).toBe('G');
    expect(out.by.provider).toBe('gemini');
    const order = (f as any).mock.calls.map((c: any[]) => (String(c[0]).includes('groq') ? 'groq' : 'gem'));
    expect(order).toEqual(['groq', 'groq', 'gem']); // one retry on 5xx, then next
  });

  it('429 cools the entry down, uses Retry-After, and cooldown expires', async () => {
    const rt = createRuntime();
    const c = clock();
    const f = byHost({ groq: res(429, {}, { 'retry-after': '30' }), generativelanguage: geminiOk('G') });
    const s = poolSettings([entry('a', 'groq'), entry('b', 'gemini')], { manualLastResort: false });
    const env = { rt, now: c.now };
    const mk = (fx: typeof f) => (e: Settings) => import('../src/ai/provider').then((m) => m.callOne(e, REQ, fx as any));
    const r1 = await runPool(s, { kind: 'text' }, mk(f), undefined, env);
    expect(r1.by.entryId).toBe('b');
    expect(rt.cool.a).toBe(c.now() + 30_000);
    expect(rt.stats.a.cooldowns).toBe(1);
    const groqCalls = () => (f as any).mock.calls.filter((x: any[]) => String(x[0]).includes('groq')).length;
    const before = groqCalls();
    await runPool(s, { kind: 'text' }, mk(f), undefined, env); // skipped while cooling
    expect(groqCalls()).toBe(before);
    c.advance(31_000);
    await runPool(s, { kind: 'text' }, mk(f), undefined, env); // tried again after expiry
    expect(groqCalls()).toBe(before + 1);
  });

  it('cooldown lengths: default 60 s, Retry-After, daily/quota 6 h', async () => {
    const mk = async (r: Response) => {
      const e = await callModel(base('groq'), REQ, fetchOf(r)).catch((x) => x);
      return cooldownFor(e);
    };
    expect(await mk(res(429))).toBe(DEFAULT_COOLDOWN_MS);
    expect(await mk(res(429, {}, { 'retry-after': '12' }))).toBe(12_000);
    expect(await mk(res(429, {}, {}, 'You exceeded your daily quota'))).toBe(DAILY_COOLDOWN_MS);
  });

  it('401 marks the key bad until it is edited', async () => {
    const rt = createRuntime();
    const f = byHost({ groq: res(401), generativelanguage: geminiOk('G') });
    const s = poolSettings([entry('a', 'groq'), entry('b', 'gemini')]);
    const mk = (fx: any) => (e: Settings) => import('../src/ai/provider').then((m) => m.callOne(e, REQ, fx));
    await runPool(s, { kind: 'text' }, mk(f), undefined, { rt });
    expect(rt.bad.a).toBe('k-a');
    const n = (f as any).mock.calls.length;
    await runPool(s, { kind: 'text' }, mk(f), undefined, { rt });
    expect((f as any).mock.calls.length).toBe(n + 1); // groq skipped
    const edited = poolSettings([entry('a', 'groq', { apiKey: 'new' }), entry('b', 'gemini')]);
    await runPool(edited, { kind: 'text' }, mk(f), undefined, { rt });
    expect((f as any).mock.calls.length).toBe(n + 3); // groq tried again, then gemini
  });

  it('400 surfaces unless the error looks model-specific', async () => {
    const mk = (fx: any) => (e: Settings) => import('../src/ai/provider').then((m) => m.callOne(e, REQ, fx));
    const s = poolSettings([entry('a', 'groq'), entry('b', 'gemini')], { manualLastResort: false });
    const plain = byHost({ groq: res(400, {}, {}, 'bad json'), generativelanguage: geminiOk('G') });
    await expect(runPool(s, { kind: 'text' }, mk(plain), undefined, { rt: createRuntime() })).rejects.toMatchObject({ info: { status: 400 } });
    const model = byHost({ groq: res(400, {}, {}, 'model not found'), generativelanguage: geminiOk('G') });
    expect((await runPool(s, { kind: 'text' }, mk(model), undefined, { rt: createRuntime() })).value).toBe('G');
  });

  it('spread mode is fair round-robin', async () => {
    const rt = createRuntime();
    const hits: string[] = [];
    const s = poolSettings([entry('a', 'groq'), entry('b', 'gemini'), entry('c', 'openrouter')], { poolMode: 'spread' });
    for (let i = 0; i < 6; i++) {
      const r = await runPool(s, { kind: 'text' }, async (e) => e.provider, undefined, { rt });
      hits.push(r.value);
    }
    expect(hits).toEqual(['groq', 'gemini', 'openrouter', 'groq', 'gemini', 'openrouter']);
  });

  it('vision only goes to capable entries', async () => {
    const rt = createRuntime();
    const s = poolSettings([entry('a', 'groq', { model: 'llama-3.3-70b-versatile' }), entry('b', 'openai'), entry('c', 'gemini')]);
    const img = await runPool(s, { kind: 'vision', input: 'image' }, async (e) => e.provider, undefined, { rt });
    expect(img.value).toBe('openai'); // groq text model skipped
    const pdf = await runPool(s, { kind: 'vision', input: 'pdf' }, async (e) => e.provider, undefined, { rt });
    expect(pdf.value).toBe('gemini'); // openai cannot do pdf here
    expect(supportsVision({ provider: 'openrouter', model: 'qwen/qwen2.5-vl-72b-instruct:free' }, 'image')).toBe(true);
    expect(supportsVision({ provider: 'groq', model: 'llama-3.1-8b-instant' }, 'image')).toBe(false);
  });

  it('when everything fails, one error explains each entry and suggests manual mode', async () => {
    const mk = (fx: any) => (e: Settings) => import('../src/ai/provider').then((m) => m.callOne(e, REQ, fx));
    const f = byHost({ groq: res(429), generativelanguage: res(503) });
    const s = poolSettings([entry('a', 'groq'), entry('b', 'gemini')], { manualLastResort: false });
    const e = await runPool(s, { kind: 'text' }, mk(f), undefined, { rt: createRuntime() }).catch((x) => x);
    expect(e).toBeInstanceOf(ProviderError);
    expect(e.message).toMatch(/Groq/);
    expect(e.message).toMatch(/Gemini/);
    expect(e.message).toMatch(/manual/i);
    expect(e.message).not.toContain('k-a');
  });

  it('manual copy-paste is the last resort unless switched off', async () => {
    const mk = (fx: any) => (e: Settings) => import('../src/ai/provider').then((m) => m.callOne(e, REQ, fx));
    const f = byHost({ groq: res(500) });
    const manual = vi.fn().mockResolvedValue('from manual');
    const on = poolSettings([entry('a', 'groq')]);
    const r = await runPool(on, { kind: 'text' }, mk(f), manual, { rt: createRuntime() });
    expect(r.value).toBe('from manual');
    expect(r.by.provider).toBe('manual');
    const off = poolSettings([entry('a', 'groq')], { manualLastResort: false });
    await expect(runPool(off, { kind: 'text' }, mk(f), manual, { rt: createRuntime() })).rejects.toMatchObject({ kind: 'server' });
  });

  it('second opinion asks two different providers and reports both', async () => {
    const f = byHost({ groq: res(200, oaiOk('one')), generativelanguage: geminiOk('two') });
    const s = poolSettings([entry('a', 'groq'), entry('b', 'groq'), entry('c', 'gemini')]);
    const out = await callSecondOpinion(s, REQ, f as any);
    expect(out.map((o) => o.value)).toEqual(['one', 'two']);
    await expect(callSecondOpinion(poolSettings([entry('solo', 'groq')]), REQ, f as any)).rejects.toThrow(/two different/);
  });

  it('callModel with a pool routes through the router', async () => {
    const f = byHost({ groq: res(401), generativelanguage: geminiOk('via pool') });
    const s = poolSettings([entry('zz1', 'groq'), entry('zz2', 'gemini')]);
    expect(await callModel(s, REQ, f as any)).toBe('via pool');
  });
});

describe('settings migration and persistence', () => {
  it('legacy single provider migrates into a one-entry list', () => {
    const m = migrateToPool(base('groq', { model: 'm' }));
    expect(m.pool).toHaveLength(1);
    expect(m.pool![0]).toMatchObject({ provider: 'groq', apiKey: KEY, model: 'm', enabled: true });
    expect(m.poolMode).toBe('fallback');
    expect(m.manualLastResort).toBe(true);
    expect(migrateToPool(m)).toEqual(m);
    expect(getEntries(base('manual'))).toEqual([]);
    expect(getEntries(base('groq'))).toHaveLength(1);
  });
  it('backup export strips every key and import keeps the phone pool; new providers validate', () => {
    const st = emptyState();
    st.settings = poolSettings([entry('a', 'groq'), entry('b', 'custom', { baseUrl: 'http://h:3001/v1' })]);
    const text = buildExport(st, {});
    expect(text).not.toContain('k-a');
    expect(text).not.toContain('k-b');
    expect(stripKeys(st.settings).pool!.every((e) => e.apiKey === '')).toBe(true);
    const v = validateBackup(text);
    expect(v.ok).toBe(true);
    if (v.ok) {
      const merged = applyImport(st, v.state);
      expect(merged.settings.pool).toHaveLength(2);
      expect(merged.settings.pool![0].apiKey).toBe('k-a');
    }
    for (const p of ['gemini', 'openrouter', 'groq', 'custom']) {
      const s2 = emptyState();
      s2.settings = { provider: p as Settings['provider'], apiKey: '', model: 'm' };
      expect(validateBackup(buildExport(s2, {})).ok).toBe(true);
    }
  });
});

describe('free AI guide', () => {
  it('has the three options and no invented quota numbers', () => {
    expect(GUIDE_SECTIONS.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    const all = JSON.stringify(GUIDE_SECTIONS);
    expect(all).not.toMatch(/\d+\s*(requests|rpm|rpd|tokens)/i);
    expect(all).toMatch(/3001/);
  });
});
