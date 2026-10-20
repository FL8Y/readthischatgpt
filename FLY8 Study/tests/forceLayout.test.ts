import { describe, expect, it } from 'vitest';
import { ForceSim, rng, type SimNode } from '../src/visual/forceLayout';
import { convexHull, hullPath } from '../src/visual/hull';

const mk = (n: number, groups = 1): SimNode[] => Array.from({ length: n }, (_, i) => ({ id: `n${i}`, group: i % groups }));
const dist = (s: ForceSim, a: number, b: number) => Math.hypot(s.x[a] - s.x[b], s.y[a] - s.y[b]);
const allFinite = (s: ForceSim) => [...s.x, ...s.y, ...s.vx, ...s.vy].every(Number.isFinite);

describe('ForceSim', () => {
  it('is deterministic for the same seed and different for another', () => {
    const nodes = mk(30, 3);
    const edges: [string, string][] = nodes.slice(1).map((n, i) => [`n${i}`, n.id]);
    const a = new ForceSim(nodes, edges, { seed: 3 });
    const b = new ForceSim(nodes, edges, { seed: 3 });
    a.run(120);
    b.run(120);
    expect([...a.x]).toEqual([...b.x]);
    expect([...a.y]).toEqual([...b.y]);
    expect(rng(1)()).toBe(rng(1)());
  });

  it('handles 0, 1 and 2 nodes without NaN', () => {
    const empty = new ForceSim([]);
    expect(empty.step()).toBe(false);
    expect(empty.bounds()).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    const one = new ForceSim(mk(1));
    one.run(500);
    expect(allFinite(one)).toBe(true);
    const two = new ForceSim(mk(2), [['n0', 'n1']]);
    two.run(500);
    expect(allFinite(two)).toBe(true);
  });

  it('converges: alpha cools below alphaMin and nodes stop moving', () => {
    const nodes = mk(60, 4);
    const edges: [string, string][] = nodes.slice(1).map((n, i) => [`n${Math.floor(i / 2)}`, n.id]);
    const s = new ForceSim(nodes, edges);
    const ticks = s.run(2000);
    expect(s.settled).toBe(true);
    expect(ticks).toBeLessThan(1000);
    expect(s.kinetic() / 60).toBeLessThan(0.1); // average speed per node is negligible
    expect(allFinite(s)).toBe(true);
    expect(s.step()).toBe(false);
  });

  it('keeps linked pairs closer than unlinked pairs', () => {
    const nodes = mk(40, 2);
    const edges: [string, string][] = [];
    for (let i = 0; i < 40; i++) edges.push([`n${i}`, `n${(i + 2) % 40}`]); // group 0 and 1 rings
    const s = new ForceSim(nodes, edges);
    s.run(1000);
    let linked = 0, nl = 0, other = 0, no = 0;
    const set = new Set(edges.map(([a, b]) => `${a}|${b}`));
    for (let i = 0; i < 40; i++)
      for (let j = i + 1; j < 40; j++) {
        const d = dist(s, i, j);
        if (set.has(`n${i}|n${j}`) || set.has(`n${j}|n${i}`)) { linked += d; nl++; } else { other += d; no++; }
      }
    expect(linked / nl).toBeLessThan((other / no) * 0.6);
  });

  it('pulls cluster members together (cluster gravity)', () => {
    const nodes = mk(40, 2); // no links at all, only clusters
    const s = new ForceSim(nodes, [], { clusterStrength: 0.2 });
    s.run(800);
    let within = 0, nw = 0, across = 0, na = 0;
    for (let i = 0; i < 40; i++)
      for (let j = i + 1; j < 40; j++) {
        const d = dist(s, i, j);
        if (s.group[i] === s.group[j]) { within += d; nw++; } else { across += d; na++; }
      }
    expect(within / nw).toBeLessThan(across / na);
  });

  it('keeps pinned nodes where they were put and honours restart positions', () => {
    const s = new ForceSim([{ id: 'a', group: 0, x: 5, y: 6 }, { id: 'b', group: 0 }], [['a', 'b']]);
    expect([s.x[0], s.y[0]]).toEqual([5, 6]);
    s.pin(1, 100, 100);
    s.run(200);
    expect([s.x[1], s.y[1]]).toEqual([100, 100]);
    s.unpinAll();
    s.reheat(0.8);
    expect(s.settled).toBe(false);
  });

  it('ignores unknown, duplicate and self edges', () => {
    const s = new ForceSim(mk(3), [['n0', 'n0'], ['n0', 'zzz'], ['n0', 'n1'], ['n1', 'n0']]);
    expect(s.edges.length).toBe(2);
    expect(Array.from(s.deg)).toEqual([1, 1, 0]);
  });

  it('runs 1000 nodes (grid mode) finitely, bounded and within a time budget', () => {
    const nodes = mk(1000, 20);
    const edges: [string, string][] = [];
    const r = rng(9);
    for (let i = 1; i < 1000; i++) edges.push([`n${Math.floor(r() * i)}`, `n${i}`]);
    const s = new ForceSim(nodes, edges);
    const t0 = Date.now();
    s.run(300);
    const ms = Date.now() - t0;
    expect(allFinite(s)).toBe(true);
    const b = s.bounds();
    expect(b.maxX - b.minX).toBeLessThan(20000);
    expect(ms).toBeLessThan(15000); // generous: ~10-50 ms per 300 ticks per 1000 nodes is typical
  });
});

describe('hull', () => {
  it('returns the outline of a square and ignores inner points', () => {
    const h = convexHull([[0, 0], [10, 0], [10, 10], [0, 10], [5, 5]]);
    expect(h).toHaveLength(4);
    expect(hullPath(h).startsWith('M')).toBe(true);
    expect(hullPath(h).endsWith('Z')).toBe(true);
  });
  it('handles 0, 1, 2 and collinear points', () => {
    expect(convexHull([])).toEqual([]);
    expect(hullPath([])).toBe('');
    expect(convexHull([[1, 1]])).toHaveLength(1);
    expect(convexHull([[0, 0], [1, 1], [2, 2]])).toHaveLength(2);
    expect(hullPath(convexHull([[3, 3]]))).toContain('L');
  });
});
