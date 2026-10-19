import { describe, expect, it } from 'vitest';
import factJson from '../data/pnle/factcheck.json';
import blueprintJson from '../data/bank/blueprint.json';
import bundlesJson from '../data/presets/bundles.json';
import { PRESET_PACKS } from '../src/presets';

type Fact = {
  id: string;
  noteIds: string[];
  keywords: string[];
  claim: string;
  guidance: string;
  severity: string;
};

const presetNotes = new Map<string, { area: string; priority?: string }>();
for (const n of PRESET_PACKS.flatMap((p) => p.notes)) presetNotes.set(n.id, n as { area: string; priority?: string });
const bundles: { id: string; area: string; notes: string[] }[] = bundlesJson.bundles;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fact: any = factJson;
const facts: Fact[] = fact.entries;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bp: any = blueprintJson;
const AREAS = ['NP1', 'NP2', 'NP3', 'NP4', 'NP5'];

describe('data/pnle/factcheck.json', () => {
  it('has scan rules and 40 to 120 entries', () => {
    expect(typeof fact.scanRules.matching).toBe('string');
    expect(fact.scanRules.matching).toMatch(/lowercase/i);
    expect(facts.length).toBeGreaterThanOrEqual(40);
    expect(facts.length).toBeLessThanOrEqual(120);
  });

  it('has unique ids and a valid schema on every entry', () => {
    expect(new Set(facts.map((f) => f.id)).size).toBe(facts.length);
    for (const f of facts) {
      expect(f.id).toMatch(/^[a-z0-9-]+$/);
      expect(Array.isArray(f.noteIds)).toBe(true);
      expect(Array.isArray(f.keywords)).toBe(true);
      expect(f.keywords.length).toBeGreaterThanOrEqual(1);
      if (f.severity !== 'high') expect(f.keywords.length).toBeGreaterThanOrEqual(2);
      expect(typeof f.claim).toBe('string');
      expect(f.claim.length).toBeGreaterThan(20);
      expect(['avoid numbers', 'ask about priority not value', 'flag check textbook', 'do not use']).toContain(f.guidance);
      expect(['high', 'medium', 'low']).toContain(f.severity);
    }
  });

  it('has lowercase, non-empty, unique keywords', () => {
    for (const f of facts) {
      for (const k of f.keywords) {
        expect(k, f.id).toBe(k.toLowerCase());
        expect(k.trim(), f.id).toBe(k);
        expect(k.length, f.id).toBeGreaterThan(1);
      }
      expect(new Set(f.keywords).size, f.id).toBe(f.keywords.length);
    }
  });

  it('contains no URLs', () => {
    expect(JSON.stringify(fact)).not.toMatch(/https?:\/\/|www\.|\.(com|org|gov|ph)\b/i);
  });

  it('only references note ids that exist in the presets', () => {
    for (const f of facts) for (const id of f.noteIds) expect(presetNotes.has(id), `${f.id}: ${id}`).toBe(true);
  });

  it('covers every known problem from the plan', () => {
    const all = JSON.stringify(facts).toLowerCase();
    for (const s of ['ra 10352', 'ao 2007-0012', 'eo 352', 'page 101', 'cyanide', 'tca', 'acetylcysteine', 'hiv', 'antidiab', 'ra 6173', 'e0 2009', 'standard days', 'rule of nines', 'maoi', 'lithium', 'table of specification'])
      expect(all, s).toContain(s);
    expect(facts.some((f) => f.severity === 'high')).toBe(true);
  });
});

describe('data/bank/blueprint.json', () => {
  it('totals 1,500 items = 100 gold + 1,400 new', () => {
    expect(bp.totalItems).toBe(1500);
    expect(bp.goldItems + bp.newItems).toBe(1500);
    expect(Object.values(bp.goldByArea as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(bp.goldItems);
    expect(bp.bundles.reduce((a: number, b: { targetItems: number }) => a + b.targetItems, 0)).toBe(1400);
  });

  it('has a difficulty mix that sums to 100 percent and 1,500 items', () => {
    const d = bp.difficultyMix;
    const lv = ['2', '3', '4', '5'];
    expect(lv.map((k) => d[k].percent)).toEqual([15, 35, 35, 15]);
    expect(lv.reduce((a, k) => a + d[k].percent, 0)).toBe(100);
    expect(lv.reduce((a, k) => a + d[k].items, 0)).toBe(1500);
  });

  it('sets the type caps and case-set plan', () => {
    expect(bp.typeCaps.sataMaxPercent).toBe(12);
    expect(bp.typeCaps.sataMaxItems).toBe(Math.floor(1500 * 0.12));
    expect(bp.typeCaps.ownerShapesMaxPercent).toBe(15);
    expect(bp.typeCaps.ownerShapesMaxItems).toBe(Math.floor(1500 * 0.15));
    expect(bp.caseSets.sets).toBe(40);
    const items = AREAS.reduce((a, k) => a + bp.caseSets.byArea[k].approxItems, 0);
    expect(items).toBe(bp.caseSets.approxItems);
    expect(AREAS.reduce((a, k) => a + bp.caseSets.byArea[k].sets, 0)).toBe(40);
    expect(items).toBeGreaterThanOrEqual(40 * 3);
    expect(items).toBeLessThanOrEqual(40 * 6);
  });

  it('gives every NP area at least 250 items in total and in new items', () => {
    const sum: Record<string, number> = {};
    for (const b of bp.bundles) {
      expect(Object.values(b.byArea as Record<string, number>).reduce((x, y) => x + y, 0), b.bundleId).toBe(b.targetItems);
      for (const [a, n] of Object.entries(b.byArea as Record<string, number>)) {
        expect(AREAS).toContain(a);
        sum[a] = (sum[a] ?? 0) + n;
      }
    }
    for (const a of AREAS) {
      expect(sum[a] + bp.goldByArea[a], a).toBeGreaterThanOrEqual(250);
      expect(sum[a], a).toBeGreaterThanOrEqual(250);
      expect(bp.areaTargets[a].total).toBe(sum[a] + bp.goldByArea[a]);
    }
  });

  it('lists every bundle in bundles.json exactly once with valid note ids', () => {
    const ids = bp.bundles.map((b: { bundleId: string }) => b.bundleId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(bundles.map((b) => b.id).sort());
    for (const row of bp.bundles) {
      const src = bundles.find((b) => b.id === row.bundleId)!;
      const high = src.notes.filter((n) => presetNotes.get(n)?.priority === 'high');
      expect([...row.mustCoverNoteIds].sort()).toEqual([...high].sort());
      expect(row.highNoteCount).toBe(high.length);
      expect(row.noteCount).toBe(src.notes.length);
      expect(row.targetItems).toBeGreaterThanOrEqual(row.highNoteCount);
      for (const n of row.mustCoverNoteIds) expect(presetNotes.has(n), n).toBe(true);
    }
  });
});
