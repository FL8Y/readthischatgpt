import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map<string, string>();
  return {
    default: {
      getItem: async (k: string) => mem.get(k) ?? null,
      setItem: async (k: string, v: string) => void mem.set(k, v),
      multiGet: async (ks: string[]) => ks.map((k) => [k, mem.get(k) ?? null]),
      multiSet: async (ps: [string, string][]) => void ps.forEach(([k, v]) => mem.set(k, v)),
      multiRemove: async (ks: string[]) => void ks.forEach((k) => mem.delete(k)),
    },
  };
});

import {
  composeManualPrompt,
  getManualHandler,
  joinManualParts,
  ManualCancelled,
  setManualHandler,
  validateManualReply,
} from '../src/ai/manual';
import { defaultPerPart, generateInParts, splitBlueprint, splitCount, withAvoid } from '../src/ai/batch';
import { callModel, ProviderError } from '../src/ai/provider';
import { callModelVision, TRANSCRIBE_SYSTEM } from '../src/import/vision';
import { TutorCancelled, tutorCall } from '../src/tutor/call';
import { emptyState, loadState, saveState } from '../src/storage';
import type { Settings } from '../src/core/types';

const manual: Settings = { provider: 'manual', apiKey: '', model: '' };
const anthropic: Settings = { provider: 'anthropic', apiKey: 'sk-ant-secret', model: '' };
const req = { system: 'You are a PNLE tutor. RULE-ALPHA', user: 'Write 3 questions on fluids. TASK-BETA' };

afterEach(() => setManualHandler(null));

describe('composeManualPrompt', () => {
  it('has the three sections and keeps the original system and user text', () => {
    const p = composeManualPrompt(req, { expect: 'json' });
    expect(p).toContain('=== ROLE AND RULES ===');
    expect(p).toContain('=== TASK ===');
    expect(p).toContain('=== OUTPUT FORMAT ===');
    expect(p).toContain('RULE-ALPHA');
    expect(p).toContain('TASK-BETA');
    expect(p.indexOf('RULE-ALPHA')).toBeLessThan(p.indexOf('TASK-BETA'));
    expect(p).toMatch(/exactly the number of items/);
  });
  it('differs for json and markdown output', () => {
    expect(composeManualPrompt(req, { expect: 'json' })).toMatch(/```json fenced code block/);
    const md = composeManualPrompt(req, { expect: 'markdown' });
    expect(md).not.toMatch(/```json/);
    expect(md).toMatch(/ONLY the Markdown/);
  });
  it('adds the parts hint', () => {
    expect(composeManualPrompt(req, { partsHint: 'Part 2 of 4: write exactly 10.' })).toContain('Part 2 of 4');
  });
});

describe('validateManualReply', () => {
  it('accepts a fenced json block', () => {
    const r = validateManualReply('```json\n[{"a":1}]\n```', 'json');
    expect(r).toEqual({ ok: true, text: '[{"a":1}]' });
  });
  it('strips chatter around json without touching the content', () => {
    const inner = '{"questions":[{"stem":"Take care, {x}"}]}';
    const r = validateManualReply(`Sure! Here you go:\n\`\`\`json\n${inner}\n\`\`\`\nHope that helps.`, 'json');
    expect(r.ok).toBe(true);
    expect(r.text).toBe(inner);
    const bare = validateManualReply(`Here: ${inner} Done.`, 'json');
    expect(bare.ok).toBe(true);
    expect(bare.text).toBe(inner);
  });
  it('gives the cut-off hint for unbalanced json', () => {
    const r = validateManualReply('```json\n[{"stem":"a","choices":["x","y"]},{"stem":"b","choi', 'json');
    expect(r.ok).toBe(false);
    expect(r.hint).toMatch(/cut off/);
    expect(r.hint).toMatch(/continue/);
  });
  it('rejects empty and no-json replies, accepts markdown', () => {
    expect(validateManualReply('   ', 'json').ok).toBe(false);
    expect(validateManualReply('   ', 'markdown').hint).toMatch(/Nothing pasted/);
    const none = validateManualReply('I cannot help with that.', 'json');
    expect(none.ok).toBe(false);
    expect(none.hint).not.toMatch(/cut off/);
    expect(validateManualReply('\n# Notes\n- a\n', 'markdown')).toEqual({ ok: true, text: '# Notes\n- a' });
  });
  it('joins pasted parts: a cut-off json reply plus its continuation validates', () => {
    const first = '```json\n[{"stem":"one"},{"stem":"tw';
    const second = '```json\no"}]\n```';
    expect(validateManualReply(first, 'json').ok).toBe(false);
    const joined = joinManualParts([first, second], 'json');
    expect(validateManualReply(joined, 'json')).toEqual({ ok: true, text: '[{"stem":"one"},{"stem":"two"}]' });
    expect(joinManualParts(['a', ' b '], 'markdown')).toBe('a\n\nb');
  });
});

describe('manual routing (fake handler, no network)', () => {
  const noFetch = vi.fn(async () => {
    throw new Error('network must not be used');
  });

  it('callModel uses the handler with merged options', async () => {
    const h = vi.fn(async () => 'REPLY');
    setManualHandler(h);
    expect(getManualHandler()).toBe(h);
    const out = await callModel(manual, req, noFetch as any, { purpose: 'P' });
    expect(out).toBe('REPLY');
    expect(h).toHaveBeenCalledWith(req, expect.objectContaining({ purpose: 'P', expect: 'text' }));
    expect(noFetch).not.toHaveBeenCalled();
  });
  it('infers json when the prompt asks for JSON', async () => {
    const h = vi.fn(async () => '[]');
    setManualHandler(h);
    await callModel(manual, { system: 'Reply as JSON.', user: 'x' });
    expect((h.mock.calls[0] as unknown[])[1]).toMatchObject({ expect: 'json' });
  });
  it('throws a clear error without a handler, and maps cancel', async () => {
    await expect(callModel(manual, req)).rejects.toMatchObject({ message: 'Manual mode is not ready.', kind: 'bad-output' });
    setManualHandler(async () => {
      throw new ManualCancelled();
    });
    await expect(callModel(manual, req)).rejects.toMatchObject({ message: 'Cancelled.', kind: 'cancelled' });
  });
  it('callModelVision asks the owner to attach the file and returns Markdown', async () => {
    const h = vi.fn(async () => '  # Page 1\n- a  ');
    setManualHandler(h);
    const out = await callModelVision(manual, { kind: 'image', mediaType: 'image/png', base64: 'AAAA' });
    expect(out).toEqual({ text: '# Page 1\n- a', truncated: false });
    const [r, o] = h.mock.calls[0] as unknown as [typeof req, { expect: string }];
    expect(r.system).toBe(TRANSCRIBE_SYSTEM);
    expect(r.user).toMatch(/ATTACH THE PHOTO/);
    expect(o.expect).toBe('markdown');
    expect(JSON.stringify(h.mock.calls)).not.toContain('AAAA'); // the file itself never goes into the prompt
  });
  it('tutorCall uses the handler and turns cancel into TutorCancelled', async () => {
    setManualHandler(async () => 'tutor says hi');
    expect(await tutorCall(manual, req)).toBe('tutor says hi');
    setManualHandler(async () => {
      throw new ManualCancelled();
    });
    await expect(tutorCall(manual, req)).rejects.toBeInstanceOf(TutorCancelled);
    const ctl = new AbortController();
    ctl.abort();
    await expect(tutorCall(manual, req, ctl.signal)).rejects.toBeInstanceOf(TutorCancelled);
  });
  it('API mode is unchanged: still needs a key and still calls fetch', async () => {
    const h = vi.fn(async () => 'never');
    setManualHandler(h);
    await expect(callModel({ ...anthropic, apiKey: ' ' }, req)).rejects.toMatchObject({ kind: 'auth' });
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ content: [{ text: 'api reply' }] }) }));
    expect(await callModel(anthropic, req, f as any)).toBe('api reply');
    expect(f).toHaveBeenCalledOnce();
    expect(h).not.toHaveBeenCalled();
    expect(new ProviderError('x', 'cancelled').kind).toBe('cancelled');
  });
});

describe('batching', () => {
  it('splitCount makes balanced parts', () => {
    expect(splitCount(10, 10)).toEqual([10]);
    expect(splitCount(25, 10)).toEqual([9, 8, 8]);
    expect(splitCount(50, 10)).toEqual([10, 10, 10, 10, 10]);
    expect(splitCount(5, Infinity)).toEqual([5]);
    expect(splitCount(0, 10)).toEqual([]);
    expect(splitCount(11, 10)).toEqual([6, 5]);
  });
  it('defaultPerPart is 10 in manual mode and unlimited for APIs', () => {
    expect(defaultPerPart(manual)).toBe(10);
    expect(defaultPerPart(anthropic)).toBe(Infinity);
  });
  it('splitBlueprint matches the part sizes', () => {
    const plan = [
      { topicId: 'a', title: 'A', count: 7 },
      { topicId: 'b', title: 'B', count: 5 },
    ];
    const subs = splitBlueprint(plan, splitCount(12, 10));
    expect(subs.map((s) => s.reduce((n, b) => n + b.count, 0))).toEqual([6, 6]);
    expect(subs[0]).toEqual([{ topicId: 'a', title: 'A', count: 6 }]);
    expect(subs[1]).toEqual([
      { topicId: 'a', title: 'A', count: 1 },
      { topicId: 'b', title: 'B', count: 5 },
    ]);
  });
  it('generateInParts merges, de-duplicates by normalized stem and labels parts', async () => {
    const purposes: string[] = [];
    const res = await generateInParts({
      total: 12,
      perPart: 6,
      label: 'Quiz',
      ask: async (_k, ctx) => {
        purposes.push(ctx.purpose);
        return ctx.index === 0 ? 'A,B,C' : 'c!,D,E';
      },
      parse: (raw) => raw.split(',').map((stem) => ({ stem })),
    });
    expect(purposes).toEqual(['Quiz - Part 1 of 2', 'Quiz - Part 2 of 2']);
    expect(res.items.map((i) => i.stem)).toEqual(['A', 'B', 'C', 'D', 'E']); // "c!" normalizes to "c"
    expect(res).toMatchObject({ partsDone: 2, parts: 2 });
    expect(res.error).toBeUndefined();
  });
  it('passes earlier stems to later parts via ctx.avoid', async () => {
    const seen: string[][] = [];
    await generateInParts({
      total: 4,
      perPart: 2,
      label: 'Q',
      ask: async (_k, ctx) => (seen.push(ctx.avoid), 'x'),
      parse: (_r, ctx) => [{ stem: `s${ctx.index}` }],
    });
    expect(seen).toEqual([[], ['s0']]);
    expect(withAvoid({ user: 'U' }, ['s0']).user).toMatch(/do not repeat[\s\S]*- s0/);
  });
  it('keeps earlier parts when a later part fails, and throws when nothing was collected', async () => {
    const mk = (failAt: number) =>
      generateInParts({
        total: 4,
        perPart: 2,
        label: 'Q',
        ask: async (_k, ctx) => {
          if (ctx.index === failAt) throw new ProviderError('Cancelled.', 'cancelled');
          return 'x';
        },
        parse: (_r, ctx) => [{ stem: `s${ctx.index}` }, { stem: `t${ctx.index}` }],
      });
    const partial = await mk(1);
    expect(partial.items.map((i) => i.stem)).toEqual(['s0', 't0']);
    expect(partial).toMatchObject({ partsDone: 1, parts: 2, error: 'Cancelled.' });
    await expect(mk(0)).rejects.toMatchObject({ kind: 'cancelled' });
  });
  it('API mode (one part) makes exactly one ask', async () => {
    const ask = vi.fn(async (_k: number) => 'a');
    await generateInParts({ total: 50, perPart: defaultPerPart(anthropic), label: 'Q', ask, parse: () => [{ stem: 'a' }] });
    expect(ask).toHaveBeenCalledOnce();
    expect(ask.mock.calls[0][0]).toBe(50);
  });
});

describe('default provider', () => {
  it('new installs default to manual with no key or model', () => {
    expect(emptyState().settings).toMatchObject({ provider: 'manual', apiKey: '', model: '' });
  });
  it('a saved anthropic state keeps its provider', async () => {
    const s = emptyState();
    s.settings = { provider: 'anthropic', apiKey: 'sk-ant-x', model: 'claude-sonnet-5-5' };
    await saveState(s);
    const back = await loadState();
    expect(back.settings).toEqual(s.settings);
  });
});

describe('sharded save', () => {
  it('round-trips a large library through several storage values', async () => {
    const s = emptyState();
    s.topics = Array.from({ length: 300 }, (_, i) => ({ id: `t${i}`, folderId: 'np1', title: `T${i}`, body: 'z'.repeat(4000), sourceIds: [] }));
    await saveState(s);
    const back = await loadState();
    expect(back.topics).toHaveLength(300);
    expect(back.topics[299].body.length).toBe(4000);
    s.topics = s.topics.slice(0, 10);
    await saveState(s);
    expect((await loadState()).topics).toHaveLength(10);
  });
});
