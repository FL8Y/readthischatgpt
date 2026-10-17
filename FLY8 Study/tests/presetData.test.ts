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
      expect(n.body).not.toMatch(/RADTECH|NURSING\*|review center/i);
    }
  });
});
