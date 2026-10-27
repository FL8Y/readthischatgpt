import { describe, expect, it } from 'vitest';
import type { AttemptEvent, Topic } from '../src/core/types';
import { bundleColors, bundleHues, hslToHex } from '../src/ui/graph/palette';
import { buildGraphModel, localSet, neighbourSet, searchMatches, visibleNodes } from '../src/ui/graph/model';
import { arcPath, buildScene, fitCam, hitTest, labelBudget } from '../src/ui/graph/scene';
import { ForceSim } from '../src/visual/forceLayout';
import { contrast, dark, light } from '../src/ui/tokens';

const T = (id: string, folderId: string, body = ''): Topic => ({ id, folderId, title: id.toUpperCase(), body, sourceIds: [] });
const folders = [{ id: 'f1', name: 'Heart' }, { id: 'f2', name: 'Lungs' }];
// a - b - c - d chain (a links b, b links c, c links d), e isolated in f2, a also links a missing note
const topics = [T('a', 'f1', '[[B]] [[Nothing yet]]'), T('b', 'f1', '[[C]]'), T('c', 'f2', '[[D]]'), T('d', 'f2'), T('e', 'f2', '[[Nothing yet]]')];
const ev = (topicId: string, correct: boolean, i: number): AttemptEvent => ({ id: `e${i}`, topicId, correct, at: 1000 } as AttemptEvent);

describe('bundle colours', () => {
  const ids = Array.from({ length: 24 }, (_, i) => `preset-folder-${i}-${'xyz'.repeat(i % 3)}`);
  it('are distinct hues for 24 bundles', () => {
    const hues = [...bundleHues(ids).values()].sort((a, b) => a - b);
    expect(new Set(hues).size).toBe(24);
    for (let i = 1; i < hues.length; i++) expect(hues[i] - hues[i - 1]).toBeGreaterThanOrEqual(7);
    const cols = [...bundleColors(ids, 'light', light.bg).values()];
    expect(new Set(cols).size).toBe(24);
  });
  it('are stable: same id, same colour, whatever the input order', () => {
    const a = bundleColors(ids, 'dark', dark.bg);
    const b = bundleColors([...ids].reverse(), 'dark', dark.bg);
    for (const id of ids) expect(b.get(id)).toBe(a.get(id));
    expect(bundleColors(ids, 'dark', dark.bg)).toEqual(a);
  });
  it('reach 3:1 contrast against the background in light and dark', () => {
    for (const [scheme, bg] of [['light', light.bg], ['dark', dark.bg]] as const)
      for (const c of bundleColors(ids, scheme, bg).values()) expect(contrast(c, bg)).toBeGreaterThanOrEqual(3);
  });
  it('hslToHex gives valid hex', () => {
    expect(hslToHex(0, 1, 0.5)).toBe('#FF0000');
    expect(hslToHex(120, 1, 0.5)).toBe('#00FF00');
  });
});

describe('graph model', () => {
  const m = buildGraphModel(topics, folders, [ev('a', true, 1), ev('a', true, 2), ev('a', false, 3)], 1000);
  const i = (id: string) => m.index.get(id) as number;

  it('groups by folder, sizes by links, adds one shared ghost for an unresolved link', () => {
    expect(m.groups.map((g) => [g.id, g.count])).toEqual([['f2', 3], ['f1', 2]]);
    expect(m.nodes.filter((n) => n.ghost)).toHaveLength(1);
    const ghost = m.nodes.find((n) => n.ghost)!;
    expect(ghost.degree).toBe(2); // a and e both point at it
    expect(m.nodes[i('b')].r).toBeGreaterThan(m.nodes[i('d')].r); // 2 links vs 1
    expect(ghost.r).toBeLessThan(m.nodes[i('d')].r);
  });
  it('mastery only where there are attempts', () => {
    expect(m.nodes[i('a')].mastery).toBeGreaterThan(0.5);
    expect(m.nodes[i('b')].mastery).toBeNull();
  });
  it('caps ghosts', () => {
    const many = [T('x', 'f1', Array.from({ length: 30 }, (_, k) => `[[Missing ${k}]]`).join(' '))];
    expect(buildGraphModel(many, folders, [], 0, 5).nodes.filter((n) => n.ghost)).toHaveLength(5);
  });
  it('neighbour set = node plus direct links either way', () => {
    const n = neighbourSet(m, i('b'));
    expect([...n].sort()).toEqual([i('a'), i('b'), i('c')].sort());
    expect(neighbourSet(m, -1).size).toBe(0);
  });
  it('local graph grows with depth and ignores bad input', () => {
    expect(localSet(m, i('a'), 0).size).toBe(1);
    expect([...localSet(m, i('a'), 1)].sort()).toEqual([i('a'), i('b'), m.nodes.findIndex((n) => n.ghost)].sort());
    const d2 = localSet(m, i('a'), 2);
    expect(d2.has(i('c'))).toBe(true);
    expect(d2.has(i('d'))).toBe(false);
    expect(localSet(m, i('a'), 3).has(i('d'))).toBe(true);
    expect(localSet(m, 99, 2).size).toBe(0);
  });
  it('filters by bundle, by local set and by ghost switch', () => {
    const all = visibleNodes(m, { hiddenGroups: new Set(), local: null, showGhosts: true });
    expect(all).toHaveLength(m.nodes.length);
    const noGhost = visibleNodes(m, { hiddenGroups: new Set(), local: null, showGhosts: false });
    expect(noGhost.some((x) => m.nodes[x].ghost)).toBe(false);
    const onlyHeart = visibleNodes(m, { hiddenGroups: new Set(['f2']), local: null, showGhosts: true });
    expect(onlyHeart.every((x) => m.nodes[x].group === 'f1')).toBe(true);
    expect(visibleNodes(m, { hiddenGroups: new Set(['f1', 'f2']), local: null, showGhosts: true })).toEqual([]);
    const loc = visibleNodes(m, { hiddenGroups: new Set(), local: localSet(m, i('c'), 1), showGhosts: true });
    expect(loc.map((x) => m.nodes[x].id).sort()).toEqual(['b', 'c', 'd']);
  });
  it('search is case-insensitive, real notes before ghosts', () => {
    expect(searchMatches(m, '').length).toBe(0);
    expect(searchMatches(m, 'b').map((x) => m.nodes[x].id)).toContain('b');
    const hits = searchMatches(m, 'no');
    expect(m.nodes[hits[hits.length - 1]].ghost).toBe(true);
    expect(searchMatches(m, 'zzz')).toEqual([]);
  });
});

describe('scene', () => {
  const m = buildGraphModel(topics, folders, [ev('a', true, 1)], 1000);
  const vis = m.nodes.map((_, k) => k);
  const sim = new ForceSim(m.nodes.map((n, k) => ({ id: n.id, group: m.groups.findIndex((g) => g.id === n.group) < 0 ? 0 : m.groups.findIndex((g) => g.id === n.group), x: k * 30, y: 0 })), m.edges.map(([a, b]) => [m.nodes[a].id, m.nodes[b].id]));
  const rank = Int32Array.from(vis.map((_, k) => k));
  const base = { model: m, vis, sim, rank, cam: { x: 0, y: 0, k: 1 }, w: 800, h: 600, selected: -1, neigh: null, matches: new Set<number>(), colorOf: () => '#123456', groupName: () => 'G' };

  it('draws halos, edges, nodes and ghosts without NaN', () => {
    const s = buildScene(base);
    expect(s.halos.length).toBe(2);
    expect(s.edges.normal).toMatch(/^M/);
    expect(s.buckets.length).toBeGreaterThan(0);
    expect(s.ghost.bright).not.toBe('');
    expect(`${s.edges.normal}${s.buckets.map((b) => b.body + b.arc).join('')}`).not.toMatch(/NaN/);
    expect(s.clusterLabels.length).toBe(2);
  });
  it('selection dims everything outside its neighbours and highlights its edges', () => {
    const sel = m.index.get('b') as number;
    const s = buildScene({ ...base, selected: sel, neigh: neighbourSet(m, sel) });
    expect(s.edges.hi).not.toBe('');
    expect(s.edges.dim).not.toBe('');
    expect(s.buckets.some((b) => b.dim !== '')).toBe(true);
    expect(s.marks.some((x) => x.kind === 'sel')).toBe(true);
    expect(s.labels.some((l) => l.kind === 'sel')).toBe(true);
  });
  it('culls nodes outside the view', () => {
    const s = buildScene({ ...base, cam: { x: -100000, y: 0, k: 1 } });
    expect(s.drawnNodes).toBe(0);
  });
  it('label budget grows with zoom; arcs and fit behave', () => {
    expect(labelBudget(4)).toBeGreaterThan(labelBudget(0.5));
    expect(arcPath(0, 0, 5, 0)).toBe('');
    expect(arcPath(0, 0, 5, 1)).toContain('a');
    expect(arcPath(0, 0, 5, 0.75)).toContain('A5 5 0 1 1');
    const c = fitCam({ minX: -100, maxX: 100, minY: -50, maxY: 50 }, 400, 300);
    expect(c.k).toBeCloseTo(1.4, 1);
    expect(fitCam({ minX: 0, maxX: 0, minY: 0, maxY: 0 }, 400, 300).k).toBeLessThanOrEqual(3);
  });
  it('hit test picks the node under the finger and nothing in empty space', () => {
    expect(hitTest(sim, vis, m, sim.x[2] + 1, sim.y[2] + 1, 4)).toBe(2);
    expect(hitTest(sim, vis, m, 5000, 5000, 4)).toBe(-1);
  });
});
