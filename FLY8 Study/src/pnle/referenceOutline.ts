import outlineJson from '../../data/pnle/reference/anki-deck-outline.json';

/**
 * Headings-only outline of the owner's own review deck, used as a COVERAGE REFERENCE for preset
 * topics, the Topic Builder prompt and tutor discussion. It contains no card text.
 * Area mapping is INFERRED: Community Health Nursing -> NP1, Psychiatric + Emergency & Disaster -> NP5.
 */
export type OutlineArea = 'NP1' | 'NP5';

export interface OutlineEntry {
  area: OutlineArea;
  /** Full path below the branch root, e.g. "CHN, PHC / COPAR / Phases of COPAR". */
  path: string;
  label: string;
  depth: number;
  cards: number;
}

interface RawBranch {
  area: string;
  root: string;
  items: { path: string; label: string; depth: number; cards: number }[];
}

const STOP = new Set(['and', 'the', 'of', 'for', 'in', 'to', 'a', 'an', 'vs', 'with', 'nursing', 'part']);

export const OUTLINE: OutlineEntry[] = (outlineJson.branches as RawBranch[]).flatMap((b) =>
  b.items.map((i) => ({ area: b.area as OutlineArea, path: i.path, label: i.label, depth: i.depth, cards: i.cards })),
);

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w));

export function outlineFor(area: OutlineArea): OutlineEntry[] {
  return OUTLINE.filter((e) => e.area === area);
}

/** Broad headings (depth 1-2) for an area, most card-heavy first, ties by path. */
export function broadHeadings(area: OutlineArea, limit = 40): string[] {
  return outlineFor(area)
    .filter((e) => e.depth >= 1 && e.depth <= 2)
    .sort((a, b) => b.cards - a.cards || a.path.localeCompare(b.path))
    .slice(0, limit)
    .map((e) => e.path.replace(/^[^/]+\/\s*/, ''));
}

/**
 * Outline headings related to a topic title (shared words in the path). Falls back to the broad
 * headings of the area, or of both areas when the area is unknown.
 */
export function relatedOutline(topic: string, area?: string, limit = 40): string[] {
  const a = area?.toUpperCase().match(/NP[15]/)?.[0] as OutlineArea | undefined;
  const pool = a ? outlineFor(a) : OUTLINE;
  const tw = new Set(words(topic));
  const scored = pool
    .map((e) => ({ e, hits: words(e.path).filter((w) => tw.has(w)).length }))
    .filter((x) => x.hits > 0)
    .sort((x, y) => y.hits - x.hits || y.e.depth - x.e.depth || x.e.path.localeCompare(y.e.path));
  if (scored.length) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const { e } of scored) {
      const p = e.path.replace(/^[^/]+\/\s*/, '');
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
      if (out.length >= limit) break;
    }
    return out;
  }
  return a ? broadHeadings(a, limit) : [...broadHeadings('NP1', limit / 2), ...broadHeadings('NP5', limit / 2)];
}
