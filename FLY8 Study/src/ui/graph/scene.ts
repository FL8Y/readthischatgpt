import type { ForceSim } from '../../visual/forceLayout';
import { convexHull, hullPath, type Pt } from '../../visual/hull';
import type { GraphModel } from './model';

export interface Cam {
  /** screen = world * k + (x, y) */
  x: number;
  y: number;
  k: number;
}

export interface SceneInput {
  model: GraphModel;
  /** vis[s] = model index of sim node s. */
  vis: number[];
  sim: ForceSim;
  /** rank[s] = position of sim node s when sorted by link count (0 = most linked). */
  rank: Int32Array;
  cam: Cam;
  w: number;
  h: number;
  /** model index or -1 */
  selected: number;
  neigh: ReadonlySet<number> | null;
  matches: ReadonlySet<number>;
  colorOf: (group: string) => string;
  groupName: (group: string) => string;
}

export interface Bucket {
  key: string;
  color: string;
  body: string;
  dim: string;
  arc: string;
  track: string;
}

export interface Label {
  key: string;
  x: number;
  y: number;
  text: string;
  kind: 'sel' | 'match' | 'node';
}

export interface Scene {
  halos: { key: string; d: string; color: string }[];
  edges: { normal: string; dim: string; hi: string };
  buckets: Bucket[];
  ghost: { bright: string; dim: string };
  marks: { key: string; x: number; y: number; r: number; kind: 'sel' | 'match' }[];
  labels: Label[];
  clusterLabels: { key: string; x: number; y: number; text: string; color: string }[];
  drawnNodes: number;
}

/** Draw radius: never smaller than ~2.4 screen px so a zoomed-out map of ~1000 topics still shows dots. */
export const drawR = (r: number, k: number) => Math.max(r, 2.4 / k);
const f = (n: number) => (Math.round(n * 10) / 10).toString();
export const circlePath = (x: number, y: number, r: number) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;

/** Arc from 12 o'clock clockwise covering `frac` of the circle. */
export function arcPath(x: number, y: number, r: number, frac: number): string {
  if (frac >= 0.999) return circlePath(x, y, r);
  if (frac <= 0.004) return '';
  const a = frac * Math.PI * 2;
  const ex = x + r * Math.sin(a);
  const ey = y - r * Math.cos(a);
  return `M${f(x)} ${f(y - r)}A${f(r)} ${f(r)} 0 ${a > Math.PI ? 1 : 0} 1 ${f(ex)} ${f(ey)}`;
}

/** How many of the most-linked nodes get a text label at this zoom (zoom in to see more). */
export const labelBudget = (k: number) => Math.max(6, Math.min(80, Math.round(9 * k * k)));
export const shorten = (s: string, n = 24) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function buildScene(inp: SceneInput): Scene {
  const { model, vis, sim, cam, w, h, selected, neigh, matches } = inp;
  const x = sim.x, y = sim.y;
  const m = 30 / cam.k;
  const x0 = -cam.x / cam.k - m, x1 = (w - cam.x) / cam.k + m;
  const y0 = -cam.y / cam.k - m, y1 = (h - cam.y) / cam.k + m;
  const inView = (i: number) => x[i] >= x0 && x[i] <= x1 && y[i] >= y0 && y[i] <= y1;
  const hasSel = selected >= 0 && neigh !== null;
  const hasMatch = !hasSel && matches.size > 0;
  const bright = (mi: number) => (hasSel ? (neigh as ReadonlySet<number>).has(mi) : hasMatch ? matches.has(mi) : true);

  // edges
  let eN = '', eD = '', eH = '';
  const E = sim.edges;
  for (let q = 0; q < E.length; q += 2) {
    const a = E[q], b = E[q + 1];
    if ((x[a] < x0 && x[b] < x0) || (x[a] > x1 && x[b] > x1) || (y[a] < y0 && y[b] < y0) || (y[a] > y1 && y[b] > y1)) continue;
    const seg = `M${f(x[a])} ${f(y[a])}L${f(x[b])} ${f(y[b])}`;
    const ma = vis[a], mb = vis[b];
    if (hasSel && (ma === selected || mb === selected)) eH += seg;
    else if (bright(ma) && bright(mb)) eN += seg;
    else eD += seg;
  }

  // nodes grouped by bundle + halos
  const byGroup = new Map<string, Bucket>();
  const pts = new Map<string, Pt[]>();
  const cen = new Map<string, [number, number, number]>();
  let gB = '', gD = '';
  const marks: Scene['marks'] = [];
  let drawn = 0;
  for (let s = 0; s < vis.length; s++) {
    const mi = vis[s];
    const n = model.nodes[mi];
    const g = n.group;
    const list = pts.get(g);
    if (list) list.push([x[s], y[s]]);
    else pts.set(g, [[x[s], y[s]]]);
    const c = cen.get(g);
    if (c) { c[0] += x[s]; c[1] += y[s]; c[2]++; } else cen.set(g, [x[s], y[s], 1]);
    if (!inView(s)) continue;
    drawn++;
    const br = bright(mi);
    if (n.ghost) {
      if (br) gB += circlePath(x[s], y[s], drawR(n.r, cam.k)); else gD += circlePath(x[s], y[s], drawR(n.r, cam.k));
      continue;
    }
    let b = byGroup.get(g);
    if (!b) {
      b = { key: g, color: inp.colorOf(g), body: '', dim: '', arc: '', track: '' };
      byGroup.set(g, b);
    }
    if (!br) { b.dim += circlePath(x[s], y[s], drawR(n.r, cam.k)); continue; }
    b.body += circlePath(x[s], y[s], drawR(n.r, cam.k));
    if (n.mastery !== null && cam.k >= 0.45) {
      b.track += circlePath(x[s], y[s], drawR(n.r, cam.k) + 2.6);
      b.arc += arcPath(x[s], y[s], drawR(n.r, cam.k) + 2.6, n.mastery);
    }
    if (mi === selected) marks.push({ key: 'sel', x: x[s], y: y[s], r: drawR(n.r, cam.k) + 6, kind: 'sel' });
    else if (hasMatch) marks.push({ key: `m${mi}`, x: x[s], y: y[s], r: drawR(n.r, cam.k) + 5, kind: 'match' });
  }

  const halos: Scene['halos'] = [];
  const clusterLabels: Scene['clusterLabels'] = [];
  for (const [g, list] of pts) {
    halos.push({ key: g, d: hullPath(convexHull(list)), color: inp.colorOf(g) });
    const c = cen.get(g) as [number, number, number];
    if (cam.k < 2.2) clusterLabels.push({ key: g, x: c[0] / c[2], y: c[1] / c[2], text: shorten(inp.groupName(g), 22), color: inp.colorOf(g) });
  }

  // labels: selection, matches, neighbours of the selection, then the most linked nodes
  const labels: Label[] = [];
  const seen = new Set<number>();
  const push = (s: number, kind: Label['kind']) => {
    if (seen.has(s) || !inView(s)) return;
    seen.add(s);
    labels.push({ key: `l${vis[s]}`, x: x[s], y: y[s] + drawR(model.nodes[vis[s]].r, cam.k) + 11 / cam.k, text: shorten(model.nodes[vis[s]].title), kind });
  };
  const budget = labelBudget(cam.k);
  for (let s = 0; s < vis.length; s++) {
    const mi = vis[s];
    if (mi === selected) push(s, 'sel');
    else if (matches.has(mi) && labels.length < 40) push(s, 'match');
  }
  if (hasSel) for (let s = 0; s < vis.length; s++) if (labels.length < 60 && (neigh as ReadonlySet<number>).has(vis[s])) push(s, 'node');
  if (!hasSel && cam.k >= 0.8) for (let s = 0; s < vis.length && labels.length < budget + 40; s++) if (inp.rank[s] < budget && bright(vis[s])) push(s, 'node');

  return {
    halos,
    edges: { normal: eN, dim: eD, hi: eH },
    buckets: [...byGroup.values()],
    ghost: { bright: gB, dim: gD },
    marks,
    labels,
    clusterLabels,
    drawnNodes: drawn,
  };
}

/** Camera that fits the given bounds into a w x h view with padding. */
export function fitCam(b: { minX: number; minY: number; maxX: number; maxY: number }, w: number, h: number, pad = 60): Cam {
  const bw = Math.max(40, b.maxX - b.minX);
  const bh = Math.max(40, b.maxY - b.minY);
  const k = Math.max(0.04, Math.min(3, Math.min((w - pad * 2) / bw, (h - pad * 2) / bh)));
  return { k, x: w / 2 - ((b.minX + b.maxX) / 2) * k, y: h / 2 - ((b.minY + b.maxY) / 2) * k };
}

/** Nearest visible node to a world point within its radius plus a touch margin; returns the sim index or -1. */
export function hitTest(sim: ForceSim, vis: number[], model: GraphModel, wx: number, wy: number, slop: number, k = 1): number {
  let best = -1;
  let bestD = Infinity;
  for (let s = 0; s < vis.length; s++) {
    const d = Math.hypot(sim.x[s] - wx, sim.y[s] - wy) - drawR(model.nodes[vis[s]].r, k);
    if (d <= slop && d < bestD) { best = s; bestD = d; }
  }
  return best;
}
