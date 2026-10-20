/**
 * Pure force-directed layout (d3-force style) with cluster gravity, a spatial-grid approximation for
 * big graphs and alpha cooling so the simulation settles. No React, no timers: the UI calls step().
 * Deterministic for a given seed and input.
 */
export interface SimNode {
  id: string;
  /** Cluster index (0..groups-1). Members are pulled together. */
  group: number;
  /** Optional start position (e.g. kept from an earlier layout). */
  x?: number;
  y?: number;
}

export interface SimOptions {
  seed: number;
  /** Rest length of a link. */
  linkDistance: number;
  /** Repulsion strength (bigger pushes nodes further apart). */
  repel: number;
  linkStrength: number;
  centerStrength: number;
  clusterStrength: number;
  /** Multiplier on the pull of links that join two different clusters (keeps bundles readable). */
  crossLink: number;
  velocityDecay: number;
  alphaMin: number;
  /** Ticks needed to cool from 1 to alphaMin. */
  coolTicks: number;
  maxSpeed: number;
  /** At or below this many nodes repulsion is exact (all pairs); above it a grid with a cut-off is used. */
  exactBelow: number;
}

export const DEFAULT_SIM: SimOptions = {
  seed: 7,
  linkDistance: 40,
  repel: 36,
  linkStrength: 1,
  centerStrength: 0.025,
  clusterStrength: 0.2,
  crossLink: 0.25,
  velocityDecay: 0.6,
  alphaMin: 0.005,
  coolTicks: 300,
  maxSpeed: 60,
  exactBelow: 90,
};

/** Small seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRID = 2048; // hash buckets (power of two)

export class ForceSim {
  readonly n: number;
  readonly ids: string[];
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly pinned: Uint8Array;
  readonly group: Int32Array;
  readonly groups: number;
  readonly deg: Int32Array;
  readonly edges: Int32Array; // pairs (a,b)
  opts: SimOptions;
  alpha = 1;
  ticks = 0;
  private head = new Int32Array(GRID);
  private next: Int32Array;
  private cell: Int32Array;

  constructor(nodes: SimNode[], edgeList: [string, string][] = [], opts: Partial<SimOptions> = {}) {
    this.opts = { ...DEFAULT_SIM, ...opts };
    const n = (this.n = nodes.length);
    this.ids = nodes.map((d) => d.id);
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    this.vx = new Float64Array(n);
    this.vy = new Float64Array(n);
    this.pinned = new Uint8Array(n);
    this.group = new Int32Array(n);
    this.deg = new Int32Array(n);
    this.next = new Int32Array(n);
    this.cell = new Int32Array(n);
    let maxG = 0;
    nodes.forEach((d, i) => {
      this.group[i] = Math.max(0, d.group | 0);
      maxG = Math.max(maxG, this.group[i]);
    });
    this.groups = n ? maxG + 1 : 0;

    const index = new Map<string, number>();
    this.ids.forEach((id, i) => index.set(id, i));
    const seen = new Set<string>();
    const pairs: number[] = [];
    for (const [a, b] of edgeList) {
      const i = index.get(a);
      const j = index.get(b);
      if (i === undefined || j === undefined || i === j) continue;
      const key = i < j ? `${i}|${j}` : `${j}|${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(i, j);
      this.deg[i]++;
      this.deg[j]++;
    }
    this.edges = Int32Array.from(pairs);
    this.seedPositions(nodes);
  }

  private seedPositions(nodes: SimNode[]) {
    const { seed, linkDistance: L } = this.opts;
    const rand = rng(seed);
    const members: number[][] = Array.from({ length: this.groups }, () => []);
    nodes.forEach((d, i) => members[this.group[i]].push(i));
    const used = members.filter((m) => m.length).length;
    const ringR = used > 1 ? L * Math.sqrt(this.n) * 0.7 : 0;
    let gi = 0;
    members.forEach((list) => {
      if (!list.length) return;
      const ang = (2 * Math.PI * gi++) / Math.max(1, used);
      const cx = Math.cos(ang) * ringR;
      const cy = Math.sin(ang) * ringR;
      list.forEach((i, k) => {
        const d = nodes[i];
        if (d.x !== undefined && d.y !== undefined && Number.isFinite(d.x) && Number.isFinite(d.y)) {
          this.x[i] = d.x;
          this.y[i] = d.y;
          return;
        }
        // sunflower spiral inside the cluster disc plus a little seeded jitter
        const r = L * 0.6 * Math.sqrt(k + 0.5);
        const a = k * 2.399963 + rand() * 0.4;
        this.x[i] = cx + Math.cos(a) * r + (rand() - 0.5) * 2;
        this.y[i] = cy + Math.sin(a) * r + (rand() - 0.5) * 2;
      });
    });
  }

  get settled(): boolean {
    return this.alpha < this.opts.alphaMin;
  }

  setOptions(o: Partial<SimOptions>) {
    this.opts = { ...this.opts, ...o };
  }

  reheat(alpha = 0.6) {
    this.alpha = Math.max(this.alpha, Math.min(1, alpha));
  }

  pin(i: number, x: number, y: number) {
    if (i < 0 || i >= this.n) return;
    this.pinned[i] = 1;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = 0;
    this.vy[i] = 0;
  }

  unpinAll() {
    this.pinned.fill(0);
  }

  /** Sum of node speeds: ~0 when the layout has come to rest. */
  kinetic(): number {
    let s = 0;
    for (let i = 0; i < this.n; i++) s += Math.abs(this.vx[i]) + Math.abs(this.vy[i]);
    return s;
  }

  bounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    if (!this.n) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < this.n; i++) {
      if (this.x[i] < minX) minX = this.x[i];
      if (this.x[i] > maxX) maxX = this.x[i];
      if (this.y[i] < minY) minY = this.y[i];
      if (this.y[i] > maxY) maxY = this.y[i];
    }
    return { minX, minY, maxX, maxY };
  }

  /** One tick. Returns false (and does nothing) once the simulation has cooled. */
  step(): boolean {
    if (this.settled || !this.n) {
      this.alpha = Math.min(this.alpha, this.opts.alphaMin * 0.99);
      return false;
    }
    const o = this.opts;
    const decay = 1 - Math.pow(o.alphaMin, 1 / Math.max(1, o.coolTicks));
    this.alpha -= this.alpha * decay;
    const a = this.alpha;
    this.forceRepel(a);
    this.forceLinks(a);
    this.forceGroups(a);
    for (let i = 0; i < this.n; i++) {
      this.vx[i] -= this.x[i] * o.centerStrength * a;
      this.vy[i] -= this.y[i] * o.centerStrength * a;
    }
    const keep = o.velocityDecay;
    for (let i = 0; i < this.n; i++) {
      if (this.pinned[i]) {
        this.vx[i] = 0;
        this.vy[i] = 0;
        continue;
      }
      let vx = this.vx[i] * keep;
      let vy = this.vy[i] * keep;
      const sp = Math.hypot(vx, vy);
      if (!Number.isFinite(sp)) {
        vx = 0;
        vy = 0;
        if (!Number.isFinite(this.x[i]) || !Number.isFinite(this.y[i])) {
          this.x[i] = 0;
          this.y[i] = 0;
        }
      } else if (sp > o.maxSpeed) {
        vx *= o.maxSpeed / sp;
        vy *= o.maxSpeed / sp;
      }
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.x[i] += vx;
      this.y[i] += vy;
    }
    this.ticks++;
    return true;
  }

  run(maxTicks: number): number {
    let k = 0;
    while (k < maxTicks && this.step()) k++;
    return k;
  }

  private pushPair(i: number, j: number, k: number, d2cut: number) {
    const x = this.x, y = this.y;
    let dx = x[j] - x[i];
    let dy = y[j] - y[i];
    let d2 = dx * dx + dy * dy;
    if (d2 > d2cut) return;
    if (d2 < 1e-6) {
      dx = (i - j) * 0.01 || 0.01;
      dy = (j - i) * 0.013 || 0.013;
      d2 = dx * dx + dy * dy;
    }
    const w = k / Math.max(d2, 16);
    this.vx[i] -= dx * w;
    this.vy[i] -= dy * w;
    this.vx[j] += dx * w;
    this.vy[j] += dy * w;
  }

  private forceRepel(alpha: number) {
    const o = this.opts;
    const k = o.repel * (o.linkDistance / 30) * alpha * 30; // d3-like magnitude scaled to the link length
    const n = this.n;
    if (n <= o.exactBelow) {
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) this.pushPair(i, j, k, Infinity);
      return;
    }
    const cs = o.linkDistance * 6; // cut-off radius = grid cell size
    const d2cut = cs * cs;
    this.head.fill(-1);
    const hash = (cx: number, cy: number) => ((Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) >>> 0) & (GRID - 1);
    for (let i = 0; i < n; i++) {
      const h = hash(Math.floor(this.x[i] / cs), Math.floor(this.y[i] / cs));
      this.cell[i] = h;
      this.next[i] = this.head[h];
      this.head[h] = i;
    }
    const visited = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(this.x[i] / cs);
      const cy = Math.floor(this.y[i] / cs);
      let seen = 0;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const h = hash(cx + ox, cy + oy);
          let dup = false;
          for (let q = 0; q < seen; q++) if (visited[q] === h) dup = true;
          if (dup) continue;
          visited[seen++] = h;
          for (let j = this.head[h]; j !== -1; j = this.next[j]) if (j > i) this.pushPair(i, j, k, d2cut);
        }
      }
    }
  }

  private forceLinks(alpha: number) {
    const o = this.opts;
    const e = this.edges;
    for (let q = 0; q < e.length; q += 2) {
      const s = e[q], t = e[q + 1];
      let dx = this.x[t] + this.vx[t] - this.x[s] - this.vx[s];
      let dy = this.y[t] + this.vy[t] - this.y[s] - this.vy[s];
      let d = Math.hypot(dx, dy);
      if (d < 1e-6) {
        dx = 0.01;
        dy = 0.01;
        d = Math.hypot(dx, dy);
      }
      const strength = (o.linkStrength / Math.min(this.deg[s], this.deg[t])) * (this.group[s] === this.group[t] ? 1 : o.crossLink);
      const l = ((d - o.linkDistance) / d) * alpha * strength;
      dx *= l;
      dy *= l;
      const b = this.deg[s] / (this.deg[s] + this.deg[t]);
      this.vx[t] -= dx * b;
      this.vy[t] -= dy * b;
      this.vx[s] += dx * (1 - b);
      this.vy[s] += dy * (1 - b);
    }
  }

  /** Cluster gravity (pull members to their centroid) plus separation of overlapping clusters. */
  private forceGroups(alpha: number) {
    const G = this.groups;
    if (G === 0) return;
    const o = this.opts;
    const cx = new Float64Array(G), cy = new Float64Array(G), cnt = new Int32Array(G);
    for (let i = 0; i < this.n; i++) {
      const g = this.group[i];
      cx[g] += this.x[i];
      cy[g] += this.y[i];
      cnt[g]++;
    }
    for (let g = 0; g < G; g++) if (cnt[g]) { cx[g] /= cnt[g]; cy[g] /= cnt[g]; }
    const px = new Float64Array(G), py = new Float64Array(G);
    if (G > 1 && G <= 80) {
      for (let a = 0; a < G; a++) {
        if (!cnt[a]) continue;
        for (let b = a + 1; b < G; b++) {
          if (!cnt[b]) continue;
          let dx = cx[b] - cx[a], dy = cy[b] - cy[a];
          let d = Math.hypot(dx, dy);
          const need = (Math.sqrt(cnt[a]) + Math.sqrt(cnt[b])) * o.linkDistance * 0.8 + o.linkDistance;
          if (d >= need) continue;
          if (d < 1e-6) { dx = 1; dy = 0.5; d = Math.hypot(dx, dy); }
          const push = ((need - d) / d) * 0.5 * alpha;
          px[a] -= dx * push; py[a] -= dy * push;
          px[b] += dx * push; py[b] += dy * push;
        }
      }
    }
    const k = o.clusterStrength * alpha;
    for (let i = 0; i < this.n; i++) {
      const g = this.group[i];
      this.vx[i] += (cx[g] - this.x[i]) * k + px[g];
      this.vy[i] += (cy[g] - this.y[i]) * k + py[g];
    }
  }
}
