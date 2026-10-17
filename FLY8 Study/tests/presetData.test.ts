import { describe, expect, it } from 'vitest';
import { PRESET_PACKS, PRESET_WARNINGS } from '../src/presets';
import { parseMarkdownBlocks } from '../src/core/markdownBlocks';
import { slugify } from '../src/core/vault';

describe('bundled preset data', () => {
  const notes = PRESET_PACKS.flatMap((p) => p.notes);

  it('loads every note with no validation warnings', () => {
    expect(PRESET_WARNINGS).toEqual([]);
    expect(PRESET_PACKS.length).toBeGreaterThanOrEqual(14);
    expect(notes.length).toBeGreaterThan(700);
  });

  it('has globally unique ids and titles and no dead [[links]]', () => {
    expect(new Set(notes.map((n) => n.id)).size).toBe(notes.length);
    const titles = new Set(notes.map((n) => slugify(n.title)));
    expect(titles.size).toBe(notes.length);
    const dead: string[] = [];
    for (const n of notes) {
      for (const m of n.body.matchAll(/\[\[([^\]]+)\]\]/g)) {
        const t = m[1].split('|')[0].trim();
        if (!titles.has(slugify(t))) dead.push(`${n.id} -> ${t}`);
      }
    }
    expect(dead).toEqual([]);
  });

  it('parses every note body into blocks and carries no review-center branding', () => {
    for (const n of notes) {
      expect(parseMarkdownBlocks(n.body).length).toBeGreaterThan(0);
      expect(n.body).not.toMatch(/RADTECH|NURSING\*RADTECH|review center/i);
    }
  });
});

import { PRESET_VISUALS } from '../src/presets/visuals';
import { sanitizeSvg } from '../src/visual/svg';

describe('bundles and diagrams', () => {
  const notes = PRESET_PACKS.flatMap((p) => p.notes);
  it('puts every note in exactly one subject pack, in handout order, nothing left over', () => {
    expect(PRESET_PACKS.find((p) => p.id === 'other')).toBeUndefined();
    expect(new Set(notes.map((n) => n.id)).size).toBe(notes.length);
    expect(PRESET_PACKS.map((p) => p.id)).toEqual(expect.arrayContaining(['chn', 'cardio', 'pharm', 'fund', 'psych']));
    for (const p of PRESET_PACKS) expect(p.notes.length).toBeGreaterThan(5);
  });

  it('every bundled diagram belongs to a note, passes the SVG sanitizer, and has a caption', () => {
    const ids = new Set(notes.map((n) => n.id));
    expect(PRESET_VISUALS.length).toBeGreaterThan(60);
    const seen = new Set<string>();
    for (const v of PRESET_VISUALS) {
      expect(ids.has(v.noteId)).toBe(true);
      expect(seen.has(v.noteId)).toBe(false);
      seen.add(v.noteId);
      expect(v.caption.length).toBeGreaterThan(10);
      const r = sanitizeSvg(v.svg);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.viewBox).toMatch(/^0 0 360 \d+$/);
    }
  });
});
