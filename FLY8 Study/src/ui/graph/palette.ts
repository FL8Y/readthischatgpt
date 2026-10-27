import { contrast } from '../tokens';

/**
 * Bundle colour generator. A bundle's hue comes from a hash of its id, so it never changes when
 * other bundles are added or the input order changes; only a clash with an earlier hue nudges it.
 * Lightness is then adjusted per theme until the colour reaches 3:1 contrast against the background.
 */
const fnv = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`.toUpperCase();
}

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

/** Hue (degrees) per id, at least `minGap` apart where the circle allows it. Order independent. */
export function bundleHues(ids: string[]): Map<string, number> {
  const uniq = [...new Set(ids)].sort();
  // greedy placement with spacing <= 360/(2n) always finds a free hue
  const gap = Math.min(20, 360 / (2 * Math.max(1, uniq.length)));
  const used: number[] = [];
  const out = new Map<string, number>();
  for (const id of uniq) {
    let h = fnv(id) % 360;
    for (let tries = 0; tries < 720 && used.some((u) => hueGap(u, h) < gap); tries++) h = (h + 1) % 360;
    used.push(h);
    out.set(id, h);
  }
  return out;
}

export type BundleColors = Map<string, string>;

/** One accessible colour per bundle id for the given theme background (3:1 or better against it). */
export function bundleColors(ids: string[], scheme: 'light' | 'dark', bg: string): BundleColors {
  const hues = bundleHues(ids);
  const out: BundleColors = new Map();
  for (const [id, hue] of hues) {
    const sat = 0.62 + (fnv(id + 's') % 3) * 0.1; // 0.62-0.82
    // three lightness bands (by id hash) tell neighbouring hues apart
    const band = (fnv(id + 'l') % 3) * 0.07;
    let l = scheme === 'dark' ? 0.56 + band : 0.52 - band;
    const step = scheme === 'dark' ? 0.02 : -0.02;
    for (let i = 0; i < 30 && contrast(hslToHex(hue, sat, l), bg) < 3; i++) l += step;
    out.set(id, hslToHex(hue, sat, Math.max(0.05, Math.min(0.95, l))));
  }
  return out;
}

export const GHOST_GROUP = '__none__';
