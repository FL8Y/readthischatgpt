import type { Area, BankItem } from './schema';
import type { AttemptRecord } from './types2';

/** Readiness stays hidden until this many answered items exist in an area. */
export const READINESS_FLOOR = 30;
export const HALF_LIFE_DAYS = 14;
export const BAND_EDGES = { approaching: 60, onTrack: 75 } as const;
export const NO_AREA_BELOW = 60;
export const OVERALL_LABEL = 'practice estimate, not a pass prediction';
const DAY_MS = 86400000;

export type Band = 'building' | 'approaching' | 'on track';

/** building < 60, approaching 60..74.99, on track >= 75 (lower edges inclusive). */
export function bandFor(percent: number): Band {
  if (percent >= BAND_EDGES.onTrack) return 'on track';
  if (percent >= BAND_EDGES.approaching) return 'approaching';
  return 'building';
}

export type AreaReadiness =
  | { state: 'locked'; area: Area; answered: number; needed: number }
  | { state: 'ready'; area: Area; answered: number; percent: number; band: Band };

export interface OverallReadiness {
  /** 'locked' until at least one NP area is unlocked. */
  state: 'locked' | 'ready';
  label: typeof OVERALL_LABEL;
  percent: number | null;
  band: Band | null;
  /** True when every unlocked area is at or above 60%. */
  noAreaBelow60: boolean;
  unlockedAreas: Area[];
  lockedAreas: Area[];
  areas: AreaReadiness[];
}

const NP_AREAS: readonly Area[] = ['NP1', 'NP2', 'NP3', 'NP4', 'NP5'];

/**
 * Recency-weighted accuracy (half-life 14 days) blended with item difficulty.
 * 60% plain recency-weighted credit; 40% difficulty-weighted credit (difficulty 1 counts 0.8, 5 counts 1.6),
 * so strong results on hard items lift the estimate and misses on easy items hurt it.
 */
export function areaReadiness(
  area: Area,
  items: readonly BankItem[],
  attempts: readonly AttemptRecord[],
  now: number,
): AreaReadiness {
  const diff = new Map(items.map((i) => [i.id, i.difficulty as number]));
  const mine = attempts.filter((a) => a.area === area);
  if (mine.length < READINESS_FLOOR) return { state: 'locked', area, answered: mine.length, needed: READINESS_FLOOR };
  let w = 0, wc = 0, dw = 0, dwc = 0;
  for (const a of mine) {
    const age = Math.max(0, now - a.at) / DAY_MS;
    const r = Math.pow(0.5, age / HALF_LIFE_DAYS);
    const d = diff.get(a.itemId) ?? 3;
    const dm = 0.6 + 0.2 * d;
    w += r; wc += r * a.credit;
    dw += r * dm; dwc += r * dm * a.credit;
  }
  const percent = 100 * (0.6 * (wc / w) + 0.4 * (dwc / dw));
  return { state: 'ready', area, answered: mine.length, percent, band: bandFor(percent) };
}

export function readiness(items: readonly BankItem[], attempts: readonly AttemptRecord[], now: number): OverallReadiness {
  const areas = NP_AREAS.map((a) => areaReadiness(a, items, attempts, now));
  const ready = areas.filter((a): a is Extract<AreaReadiness, { state: 'ready' }> => a.state === 'ready');
  const lockedAreas = areas.filter((a) => a.state === 'locked').map((a) => a.area);
  if (ready.length === 0) {
    return { state: 'locked', label: OVERALL_LABEL, percent: null, band: null, noAreaBelow60: false, unlockedAreas: [], lockedAreas, areas };
  }
  const percent = ready.reduce((s, a) => s + a.percent, 0) / ready.length;
  const noAreaBelow60 = ready.every((a) => a.percent >= NO_AREA_BELOW);
  let band = bandFor(percent);
  // 'on track' needs every unlocked area at 60% or better.
  if (band === 'on track' && !noAreaBelow60) band = 'approaching';
  return { state: 'ready', label: OVERALL_LABEL, percent, band, noAreaBelow60, unlockedAreas: ready.map((a) => a.area), lockedAreas, areas };
}

export type MasteryTag = 'learning' | 'reviewing' | 'mastered';

/** Auto mastery from the last N attempts on a topic (N = 5): <3 attempts or <60% learning, >=85% over 5 mastered. */
export function masteryTag(topicAttempts: readonly AttemptRecord[], lastN = 5): MasteryTag {
  const recent = [...topicAttempts].sort((a, b) => b.at - a.at).slice(0, lastN);
  if (recent.length < 3) return 'learning';
  const acc = recent.reduce((s, a) => s + a.credit, 0) / recent.length;
  if (recent.length >= lastN && acc >= 0.85) return 'mastered';
  if (acc >= 0.6) return 'reviewing';
  return 'learning';
}
