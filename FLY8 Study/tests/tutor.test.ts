import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => undefined } }));

import {
  BEYOND_LABEL, MAX_HISTORY_MESSAGES, MAX_MESSAGE_CHARS, NOTES_LABEL, appendOnce, capHistory, splitReply, tutorRequest,
  unansweredQuestion, type TutorMessage,
} from '../src/tutor/prompt';
import { TutorCancelled, tutorCall } from '../src/tutor/call';
import { parseChat } from '../src/tutor/store';
import { ProviderError } from '../src/ai/provider';
import { emptyState } from '../src/storage';
import type { Settings, Topic } from '../src/core/types';

const NOW = Date.UTC(2026, 9, 16, 12);
const topic: Topic = { id: 'hf', folderId: 'np1', title: 'Heart Failure', body: 'MY-OWN-NOTES preload text', sourceIds: [] };
const state = { ...emptyState(), topics: [topic] };
const msgs = (n: number, len = 10): TutorMessage[] =>
  Array.from({ length: n }, (_, i) => ({ id: `m${i}`, role: i % 2 ? 'assistant' : 'user', text: `${i}:${'x'.repeat(len)}`, at: NOW }));

describe('tutorRequest', () => {
  it('puts the learner notes in and requires the two labels', () => {
    const r = tutorRequest(state, topic, [], 'What is preload?', NOW);
    expect(r.user).toContain('MY-OWN-NOTES preload text');
    expect(r.user).toContain('What is preload?');
    expect(r.system).toContain(NOTES_LABEL);
    expect(r.system).toContain(BEYOND_LABEL);
    expect(r.system).toContain('Topic mastery:');
  });
  it('works with no topic and says no notes were chosen', () => {
    const r = tutorRequest(state, undefined, [], 'hi', NOW);
    expect(r.user).toContain('No topic selected.');
    expect(r.system).toContain('none were chosen');
  });
  it('caps history length and message size', () => {
    const r = tutorRequest(state, topic, msgs(30, 5000), 'q', NOW);
    expect(r.user).not.toContain('\n0:');
    expect(r.user).toContain('29:');
    expect(r.user.split('\n').filter((l) => /^(Learner|Tutor): /.test(l))).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(capHistory(msgs(30, 5000)).every((m) => m.text.length <= MAX_MESSAGE_CHARS + 1)).toBe(true);
    expect(r.user.length).toBeLessThan(20_000);
  });
  it('clips a huge question and huge notes', () => {
    const big = { ...topic, body: 'n'.repeat(50_000) };
    expect(tutorRequest(state, big, [], 'q'.repeat(50_000), NOW).user.length).toBeLessThan(8_000);
  });
});

describe('reply and retry helpers', () => {
  it('splits svg and mermaid blocks out of the text and keeps the text', () => {
    const parts = splitReply('From your notes:\nHello\n```svg\n<svg/>\n```\nBeyond your notes (check your textbook):\n```mermaid\ngraph TD;A-->B\n```\nbye');
    expect(parts.map((p) => p.kind)).toEqual(['text', 'diagram', 'text', 'diagram', 'text']);
    expect(parts[1]).toMatchObject({ lang: 'svg', text: '<svg/>' });
    expect(parts[3]).toMatchObject({ lang: 'mermaid' });
    expect(parts[0].text).toContain('Hello');
  });
  it('leaves other code fences alone', () => {
    expect(splitReply('```js\nx\n```')).toEqual([{ kind: 'text', text: '```js\nx\n```' }]);
  });
  it('retry does not duplicate the user message', () => {
    const m = msgs(1);
    expect(unansweredQuestion(m)?.id).toBe('m0');
    expect(unansweredQuestion(msgs(2))).toBeUndefined();
    expect(appendOnce(m, m[0])).toBe(m);
  });
  it('parseChat drops bad entries and caps', () => {
    expect(parseChat('nope')).toEqual({ messages: [] });
    const good = msgs(150);
    const out = parseChat(JSON.stringify({ topicId: 'hf', messages: [...good, { id: 1 }, null] }));
    expect(out.messages).toHaveLength(100);
    expect(out.topicId).toBe('hf');
  });
});

describe('tutorCall', () => {
  const settings: Settings = { provider: 'anthropic', apiKey: 'sk-secret-123', model: '' };
  const req = { system: 's', user: 'u' };
  const ok = (text: string) => ({ ok: true, status: 200, json: async () => ({ content: [{ text }] }) }) as unknown as Response;

  it('returns the text and passes the signal and key header', async () => {
    const f = vi.fn(async () => ok('hello'));
    const ctl = new AbortController();
    expect(await tutorCall(settings, req, ctl.signal, f as unknown as typeof fetch)).toBe('hello');
    const init = (f.mock.calls[0] as any)[1];
    expect(init.signal).toBe(ctl.signal);
    expect(init.headers['x-api-key']).toBe('sk-secret-123');
  });
  it('cancels in flight with AbortController (mocked fetch honours the signal)', async () => {
    const f = vi.fn((_u: string, init: RequestInit) =>
      new Promise<Response>((_res, rej) => {
        init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
    );
    const ctl = new AbortController();
    const p = tutorCall(settings, req, ctl.signal, f as unknown as typeof fetch);
    ctl.abort();
    await expect(p).rejects.toBeInstanceOf(TutorCancelled);
  });
  it('does not call fetch when already aborted', async () => {
    const f = vi.fn();
    const ctl = new AbortController();
    ctl.abort();
    await expect(tutorCall(settings, req, ctl.signal, f as unknown as typeof fetch)).rejects.toBeInstanceOf(TutorCancelled);
    expect(f).not.toHaveBeenCalled();
  });
  it('redacts the key from network errors', async () => {
    const f = vi.fn(async () => {
      throw new Error('boom sk-secret-123 boom');
    });
    const err = await tutorCall(settings, req, undefined, f as unknown as typeof fetch).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.kind).toBe('network');
    expect(err.message).not.toContain('sk-secret-123');
    expect(err.message).toContain('[redacted]');
  });
  it('maps auth, rate limit, server and empty replies; requires a key', async () => {
    const status = (n: number) => (async () => ({ ok: false, status: n }) as Response) as unknown as typeof fetch;
    await expect(tutorCall(settings, req, undefined, status(401))).rejects.toMatchObject({ kind: 'auth' });
    await expect(tutorCall(settings, req, undefined, status(429))).rejects.toMatchObject({ kind: 'rate-limit' });
    await expect(tutorCall(settings, req, undefined, status(500))).rejects.toMatchObject({ kind: 'server' });
    await expect(tutorCall(settings, req, undefined, (async () => ok('')) as unknown as typeof fetch)).rejects.toMatchObject({ kind: 'bad-output' });
    await expect(tutorCall({ ...settings, apiKey: ' ' }, req)).rejects.toMatchObject({ kind: 'auth' });
  });
});
