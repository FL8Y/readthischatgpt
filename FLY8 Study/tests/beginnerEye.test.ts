import { describe, expect, it } from 'vitest';
import { PRESET_PACKS, PRESET_WARNINGS, applyBeginnerEye, beginnerEyeCoverage, validatePresetNotes } from '../src/presets';
import { parseMarkdownBlocks } from '../src/core/markdownBlocks';
import beginnerChn from '../data/presets/beginner-eye-chn.json';

const notes = PRESET_PACKS.flatMap((p) => p.notes);
const written = notes.filter((n) => n.beginnerEye);
const words = (s: string) => (s.match(/\S+/g) ?? []).length;

describe("Beginner's Eye loader", () => {
  it('accepts an optional inline beginnerEye string and ignores empty or non-string values', () => {
    const base = { id: 'a', title: 'A', body: 'Body text here.', area: 'NP1' };
    const { notes: out } = validatePresetNotes([
      { ...base, beginnerEye: '  Plain words.  ' },
      { ...base, id: 'b', title: 'B', beginnerEye: '   ' },
      { ...base, id: 'c', title: 'C', beginnerEye: 42 },
      { ...base, id: 'd', title: 'D' },
    ]);
    expect(out.map((n) => n.beginnerEye)).toEqual(['Plain words.', undefined, undefined, undefined]);
  });

  it('overlays fill missing text only and never invent text for other notes', () => {
    const { notes: raw } = validatePresetNotes([
      { id: 'a', title: 'A', body: 'x' },
      { id: 'b', title: 'B', body: 'y', beginnerEye: 'inline wins' },
      { id: 'c', title: 'C', body: 'z' },
    ]);
    const out = applyBeginnerEye(raw, [{ a: 'from file', b: 'overlay loses', zzz: 'orphan' }]);
    expect(out.map((n) => n.beginnerEye)).toEqual(['from file', 'inline wins', undefined]);
  });

  it('every overlay id belongs to a real bundled note', () => {
    const ids = new Set(notes.map((n) => n.id));
    expect(Object.keys(beginnerChn).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('reports coverage that adds up', () => {
    const c = beginnerEyeCoverage();
    expect(c.with + c.without).toBe(notes.length);
    expect(c.with).toBe(written.length);
    expect(c.byPack.find((p) => p.packId === 'chn')).toEqual({ packId: 'chn', with: 73, total: 73 });
  });

  it('keeps loading with no warnings', () => {
    expect(PRESET_WARNINGS).toEqual([]);
  });
});

describe("Beginner's Eye text quality (every written one)", () => {
  it('has the whole community health bundle written', () => {
    expect(written.filter((n) => PRESET_PACKS.find((p) => p.id === 'chn')?.notes.includes(n)).length).toBe(73);
  });

  it.each(written.map((n) => [n.id, n] as const))('%s: size, markup, textbook reminder', (_id, n) => {
    const text = n.beginnerEye as string;
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text.length).toBeLessThan(n.body.length);
    const w = words(text);
    expect(w).toBeGreaterThanOrEqual(80);
    expect(w).toBeLessThanOrEqual(200);
    // Nothing the note renderer cannot show: no HTML, fences, images, tables, wikilinks, or stray emphasis markers.
    expect(text).not.toMatch(/<\/?[a-z][^>]*>/i);
    expect(text).not.toMatch(/```|!\[|\[\[|^\s*\|.*\|\s*$/m);
    for (const line of text.split('\n')) expect((line.match(/\*\*/g) ?? []).length % 2).toBe(0);
    const blocks = parseMarkdownBlocks(text);
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(['heading', 'paragraph', 'bullets', 'numbered']).toContain(b.t);
    // Keeps the textbook reminder, as the last section.
    const headings = blocks.filter((b) => b.t === 'heading');
    const last = headings[headings.length - 1];
    expect(last && last.t === 'heading' && last.spans.map((s) => ('text' in s ? s.text : '')).join('')).toMatch(/check against your textbook/i);
  });

  it.each(written.map((n) => [n.id, n] as const))('%s: no drug dose or amount missing from the source note', (_id, n) => {
    const text = n.beginnerEye as string;
    const norm = (s: string) => s.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ');
    const src = norm(n.body);
    const dose = /(\d+(?:\.\d+)?)\s?(mg|mcg|µg|ug|iu|ml|units?|tbsp|tsp|drops?|grams?|g|liters?|litres?|l)\b/gi;
    const missing: string[] = [];
    for (const m of norm(text).matchAll(dose)) {
      const key = `${m[1]} ${m[2]}`;
      if (!src.includes(key) && !src.includes(`${m[1]}${m[2]}`)) missing.push(m[0]);
    }
    expect(missing).toEqual([]);
  });
});

describe("Beginner's Eye size budget", () => {
  it('stays small per note, so a full library of ~1000 notes adds about 1.4 MB to the app bundle', () => {
    const chars = written.reduce((a, n) => a + (n.beginnerEye as string).length, 0);
    expect(chars / written.length).toBeLessThan(1500);
  });

  it('is never copied into saved state (installed topics and shards stay the same size)', async () => {
    const { installPack } = await import('../src/presets');
    const { emptyStateForTest } = await import('./presetsFixture');
    const next = installPack(emptyStateForTest(), 'chn');
    expect(next.topics.length).toBe(73);
    expect(JSON.stringify(next.topics)).not.toMatch(/beginnerEye|Beginner/);
  });
});
