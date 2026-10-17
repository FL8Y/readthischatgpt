import { describe, expect, it, vi } from 'vitest';
import type { Settings } from '../src/core/types';
import { ProviderError } from '../src/ai/provider';
import { assertBase64Size, classifyFile, MAX_IMPORT_BYTES } from '../src/import/files';
import { describeImportError, prepareImportedNote, titleFromFileName } from '../src/import/pipeline';
import { ImportError } from '../src/import/types';
import type { VisionInput } from '../src/import/types';
import { buildVisionRequest, callModelVision, parseVisionReply } from '../src/import/vision';
import { parseVerification, sanitizeOrigin } from '../src/core/provenance';

const KEY = 'sk-secret-key-123';
const anthropic: Settings = { provider: 'anthropic', apiKey: KEY, model: '' };
const openai: Settings = { provider: 'openai', apiKey: KEY, model: '' };
const png: VisionInput = { kind: 'image', mediaType: 'image/png', base64: 'AAAA' };
const pdf: VisionInput = { kind: 'pdf', mediaType: 'application/pdf', base64: 'BBBB' };

const reply = (status: number, body: unknown = {}) =>
  vi.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300, json: async () => body } as Response);

describe('file classification', () => {
  it('accepts pdf and images by mime or extension', () => {
    expect(classifyFile({ name: 'a.pdf', mimeType: 'application/pdf', size: 10 })).toEqual({ kind: 'pdf', mediaType: 'application/pdf' });
    expect(classifyFile({ name: 'IMG_1.JPG', mimeType: null })).toEqual({ kind: 'image', mediaType: 'image/jpeg' });
    expect(classifyFile({ name: 'x', mimeType: 'image/webp' }).mediaType).toBe('image/webp');
  });

  it('rejects unsupported types', () => {
    expect(() => classifyFile({ name: 'a.docx', mimeType: 'application/msword' })).toThrow(ImportError);
    expect(() => classifyFile({ name: 'a.heic', mimeType: 'image/heic' })).toThrow(/not supported/);
  });

  it('rejects files over the limit, by reported size and by base64 length', () => {
    expect(() => classifyFile({ name: 'a.pdf', size: MAX_IMPORT_BYTES + 1 })).toThrow(/limit/);
    expect(classifyFile({ name: 'a.pdf', size: MAX_IMPORT_BYTES }).kind).toBe('pdf');
    expect(() => assertBase64Size('A'.repeat(Math.ceil(((MAX_IMPORT_BYTES + 10) * 4) / 3)))).toThrow(ImportError);
    expect(() => assertBase64Size('')).toThrow(/empty/);
    expect(() => assertBase64Size('AAAA')).not.toThrow();
  });
});

describe('vision request building', () => {
  it('builds an Anthropic image block', () => {
    const r = buildVisionRequest(anthropic, png);
    expect(r.url).toBe('https://api.anthropic.com/v1/messages');
    expect(r.headers['x-api-key']).toBe(KEY);
    const body = r.body as any;
    expect(body.model).toBe('claude-sonnet-5-5');
    expect(body.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } });
    expect(body.messages[0].content[1].type).toBe('text');
  });

  it('builds an Anthropic document block for PDFs', () => {
    const body = buildVisionRequest(anthropic, pdf).body as any;
    expect(body.messages[0].content[0]).toEqual({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'BBBB' } });
  });

  it('builds an OpenAI image_url data URL', () => {
    const r = buildVisionRequest(openai, png);
    expect(r.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(r.headers.authorization).toBe(`Bearer ${KEY}`);
    const parts = (r.body as any).messages[1].content;
    expect(parts[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } });
  });

  it('refuses PDFs on OpenAI with a clear message, and a missing key', () => {
    expect(() => buildVisionRequest(openai, pdf)).toThrow(/not supported with OpenAI/);
    expect(() => buildVisionRequest({ ...anthropic, apiKey: ' ' }, png)).toThrow(/API key/);
  });
});

describe('vision reply parsing', () => {
  it('joins Anthropic text blocks and detects truncation', () => {
    const ok = parseVisionReply('anthropic', { content: [{ type: 'text', text: '# A' }, { type: 'text', text: 'b' }], stop_reason: 'end_turn' });
    expect(ok).toEqual({ text: '# A\n\nb', truncated: false });
    expect(parseVisionReply('anthropic', { content: [{ type: 'text', text: 'x' }], stop_reason: 'max_tokens' }).truncated).toBe(true);
  });

  it('reads OpenAI choices and detects truncation', () => {
    expect(parseVisionReply('openai', { choices: [{ message: { content: ' hi ' }, finish_reason: 'stop' }] })).toEqual({ text: 'hi', truncated: false });
    expect(parseVisionReply('openai', { choices: [{ message: { content: 'x' }, finish_reason: 'length' }] }).truncated).toBe(true);
  });

  it('throws bad-output on empty or malformed replies', () => {
    expect(() => parseVisionReply('anthropic', { content: [] })).toThrow(ProviderError);
    expect(() => parseVisionReply('openai', {})).toThrow(/no text/);
  });
});

describe('callModelVision with mocked fetch', () => {
  it('sends the request and returns parsed text', async () => {
    const f = reply(200, { content: [{ type: 'text', text: 'notes' }] });
    const out = await callModelVision(anthropic, png, f as any);
    expect(out.text).toBe('notes');
    expect(f).toHaveBeenCalledTimes(1);
    expect(JSON.parse((f.mock.calls[0][1] as any).body).messages[0].content[0].type).toBe('image');
  });

  it('maps statuses to error kinds', async () => {
    await expect(callModelVision(anthropic, png, reply(401) as any)).rejects.toMatchObject({ kind: 'auth' });
    await expect(callModelVision(anthropic, png, reply(429) as any)).rejects.toMatchObject({ kind: 'rate-limit' });
    await expect(callModelVision(anthropic, png, reply(500) as any)).rejects.toMatchObject({ kind: 'server' });
  });

  it('redacts the key from network errors', async () => {
    const f = vi.fn().mockRejectedValue(new Error(`failed to reach host with ${KEY}`));
    const err = await callModelVision(openai, png, f as any).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.kind).toBe('network');
    expect(err.message).not.toContain(KEY);
    expect(err.message).toContain('[redacted]');
    expect(describeImportError(err)).not.toContain(KEY);
  });

  it('never sends a request for PDFs on OpenAI', async () => {
    const f = reply(200);
    await expect(callModelVision(openai, pdf, f as any)).rejects.toThrow(/OpenAI/);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('pipeline', () => {
  it('flags poor or truncated transcriptions for review', () => {
    const good = 'Heart failure is a clinical syndrome where the heart cannot pump enough blood.\n\nNurses monitor weight daily.';
    expect(prepareImportedNote(good, 's1').verification).toBe('unverified');
    expect(prepareImportedNote(good, 's1').chunks[0].sourceId).toBe('s1');
    const cut = prepareImportedNote(good, 's1', true);
    expect(cut.verification).toBe('needs-review');
    expect(cut.quality.flags).toContain('possibly-truncated');
    expect(prepareImportedNote('#@$% 1234 ^&*( 5678 '.repeat(10), 's2').verification).toBe('needs-review');
  });

  it('describes each failure plainly', () => {
    expect(describeImportError(new ProviderError('Add your API key in Settings first.', 'auth'))).toMatch(/Add your API key/);
    expect(describeImportError(new ProviderError('x', 'auth'))).toMatch(/rejected/);
    expect(describeImportError(new ProviderError('x', 'rate-limit'))).toMatch(/rate limiting/);
    expect(describeImportError(new ProviderError('x', 'network'))).toMatch(/offline/);
    expect(describeImportError(new ImportError('too big', 'too-large'))).toBe('too big');
    expect(describeImportError(new Error('boom'))).toMatch(/Import failed/);
    expect(titleFromFileName('np1_heart-failure.pdf')).toBe('np1 heart failure');
  });
});

describe('source suggestion', () => {
  it('keeps plain family names and drops invented specifics', () => {
    expect(sanitizeOrigin('Medical-surgical nursing textbooks')).toBe('Medical-surgical nursing textbooks');
    expect(sanitizeOrigin('See https://example.com/x')).toBeUndefined();
    expect(sanitizeOrigin('Smith Textbook, p. 214')).toBeUndefined();
    expect(sanitizeOrigin('doi 10.1000/xyz123')).toBeUndefined();
    expect(sanitizeOrigin('ISBN 978-0-00-000000-0')).toBeUndefined();
    expect(sanitizeOrigin('unknown')).toBeUndefined();
    expect(sanitizeOrigin(null)).toBeUndefined();
  });

  it('applies the filter inside parseVerification and keeps issues', () => {
    const r = parseVerification('{"legit":false,"issues":["dose looks wrong",3],"suggestedOrigin":"Lippincott, page 12"}');
    expect(r).toEqual({ legit: false, issues: ['dose looks wrong'], suggestedOrigin: undefined });
  });
});
