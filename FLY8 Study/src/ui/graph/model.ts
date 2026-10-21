import { buildGraph, slugify } from '../../core/vault';
import { estimateMastery } from '../../core/mastery';
import type { AttemptEvent, Folder, Topic } from '../../core/types';

export interface GNode {
  id: string;
  title: string;
  /** Bundle = the topic's folder id. */
  group: string;
  ghost: boolean;
  degree: number;
  /** 0..1, or null when there are no attempts yet (and always for ghosts). */
  mastery: number | null;
  r: number;
}

export interface GroupInfo {
  id: string;
  name: string;
  count: number;
}

export interface GraphModel {
  nodes: GNode[];
  index: Map<string, number>;
  edges: [number, number][];
  adj: number[][];
  groups: GroupInfo[];
}

export const nodeRadius = (degree: number, ghost: boolean) => (ghost ? 3.5 : Math.min(15, 4.5 + 2 * Math.sqrt(degree)));

/**
 * Concept graph for the map. Bundles are folders (the preset packs are one folder each). Unresolved
 * [[links]] become ghost nodes, capped at `maxGhosts` (most-referenced first) to keep big libraries fast.
 */
export function buildGraphModel(
  topics: Topic[],
  folders: Pick<Folder, 'id' | 'name'>[],
  events: AttemptEvent[],
  now: number,
  maxGhosts = 120,
): GraphModel {
  const g = buildGraph(topics);
  const byTopic = new Map<string, AttemptEvent[]>();
  for (const e of events) {
    const list = byTopic.get(e.topicId);
    if (list) list.push(e);
    else byTopic.set(e.topicId, [e]);
  }
  const folderOf = new Map(topics.map((t) => [t.id, t.folderId]));
  const nodes: GNode[] = g.nodes.map((n) => {
    const evs = byTopic.get(n.id);
    return { id: n.id, title: n.title, group: folderOf.get(n.id) ?? '', ghost: false, degree: 0, mastery: evs ? estimateMastery(n.id, evs, now).mastery : null, r: 0 };
  });
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const edges: [number, number][] = g.edges.map((e) => [index.get(e.from) as number, index.get(e.to) as number]);

  const ghosts = new Map<string, { title: string; from: Set<number> }>();
  for (const u of g.unresolved) {
    const key = slugify(u.target) || u.target;
    const entry = ghosts.get(key) ?? { title: u.target, from: new Set<number>() };
    entry.from.add(index.get(u.from) as number);
    ghosts.set(key, entry);
  }
  const keep = [...ghosts.entries()].sort((a, b) => b[1].from.size - a[1].from.size || (a[0] < b[0] ? -1 : 1)).slice(0, maxGhosts);
  for (const [key, gh] of keep) {
    const at = nodes.length;
    const first = Math.min(...gh.from);
    nodes.push({ id: `ghost:${key}`, title: gh.title, group: nodes[first].group, ghost: true, degree: 0, mastery: null, r: 0 });
    index.set(`ghost:${key}`, at);
    for (const f of gh.from) edges.push([f, at]);
  }

  const adj: number[][] = nodes.map(() => []);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  nodes.forEach((n, i) => {
    n.degree = adj[i].length;
    n.r = nodeRadius(n.degree, n.ghost);
  });

  const counts = new Map<string, number>();
  for (const n of nodes) if (!n.ghost) counts.set(n.group, (counts.get(n.group) ?? 0) + 1);
  const names = new Map(folders.map((f) => [f.id, f.name]));
  const groups: GroupInfo[] = [...counts.entries()]
    .map(([id, count]) => ({ id, name: names.get(id) ?? 'Notes', count }))
    .sort((a, b) => b.count - a.count || (a.id < b.id ? -1 : 1));
  return { nodes, index, edges, adj, groups };
}

/** The node plus everything one link away (what Obsidian keeps bright when you select a node). */
export function neighbourSet(model: Pick<GraphModel, 'adj'>, i: number): Set<number> {
  const s = new Set<number>();
  if (i < 0 || i >= model.adj.length) return s;
  s.add(i);
  for (const j of model.adj[i]) s.add(j);
  return s;
}

/** Breadth-first set of nodes within `depth` links of `i` (Obsidian "local graph"). */
export function localSet(model: Pick<GraphModel, 'adj'>, i: number, depth: number): Set<number> {
  const seen = new Set<number>();
  if (i < 0 || i >= model.adj.length) return seen;
  seen.add(i);
  let frontier = [i];
  for (let d = 0; d < Math.max(0, depth) && frontier.length; d++) {
    const next: number[] = [];
    for (const u of frontier) for (const v of model.adj[u]) if (!seen.has(v)) { seen.add(v); next.push(v); }
    frontier = next;
  }
  return seen;
}

export interface VisibleOpts {
  hiddenGroups: ReadonlySet<string>;
  local: ReadonlySet<number> | null;
  showGhosts: boolean;
}

/** Node indexes to show: bundle filter, then local-graph limit, then ghosts. Order follows the model. */
export function visibleNodes(model: GraphModel, o: VisibleOpts): number[] {
  const out: number[] = [];
  model.nodes.forEach((n, i) => {
    if (o.hiddenGroups.has(n.group)) return;
    if (n.ghost && !o.showGhosts) return;
    if (o.local && !o.local.has(i)) return;
    out.push(i);
  });
  return out;
}

/** Case-insensitive title search; real notes before ghosts, then alphabetical. */
export function searchMatches(model: GraphModel, query: string): number[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: number[] = [];
  model.nodes.forEach((n, i) => {
    if (n.title.toLowerCase().includes(q)) hits.push(i);
  });
  return hits.sort((a, b) => Number(model.nodes[a].ghost) - Number(model.nodes[b].ghost) || (model.nodes[a].title < model.nodes[b].title ? -1 : 1));
}
