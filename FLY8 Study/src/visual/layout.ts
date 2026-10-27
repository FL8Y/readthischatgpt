import type { Topic } from '../core/types';
import type { TopicGraph } from '../core/vault';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
}

export interface Layout {
  nodes: LayoutNode[];
  width: number;
  height: number;
  nodeRadius: number;
}

/**
 * Deterministic concentric-ring layout. The best-connected topic sits in the centre; the rest fill
 * rings outward, each ring sized so neighbours never overlap. Same input always gives the same output.
 */
export function layoutGraph(graph: TopicGraph, nodeRadius = 22, gap = 16): Layout {
  const step = nodeRadius * 2 + gap;
  const degree = new Map<string, number>();
  for (const n of graph.nodes) degree.set(n.id, 0);
  for (const e of graph.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const ordered = graph.nodes
    .map((n) => n.id)
    .sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || (a < b ? -1 : a > b ? 1 : 0));

  const placed: { id: string; ring: number; slot: number; inRing: number }[] = [];
  let i = 0;
  if (ordered.length) placed.push({ id: ordered[i++], ring: 0, slot: 0, inRing: 1 });
  for (let ring = 1; i < ordered.length; ring++) {
    const cap = Math.max(1, Math.floor((2 * Math.PI * ring * step) / step)); // = floor(2*pi*ring)
    const take = Math.min(cap, ordered.length - i);
    for (let s = 0; s < take; s++) placed.push({ id: ordered[i++], ring, slot: s, inRing: take });
  }

  const rings = placed.reduce((m, p) => Math.max(m, p.ring), 0);
  const half = rings * step + nodeRadius + gap;
  const size = Math.max(2 * half, 2 * (nodeRadius + gap));
  const cx = size / 2;
  const nodes = placed.map((p) => {
    if (p.ring === 0) return { id: p.id, x: cx, y: cx };
    const angle = -Math.PI / 2 + (2 * Math.PI * p.slot) / p.inRing + p.ring * 0.5;
    return { id: p.id, x: round(cx + p.ring * step * Math.cos(angle)), y: round(cx + p.ring * step * Math.sin(angle)) };
  });
  return { nodes, width: size, height: size, nodeRadius };
}

const round = (n: number) => Math.round(n * 100) / 100;

export type RelationKind = 'mutual' | 'cross-folder' | 'link';

/** Every relation has a colour (UI), a dash pattern, an icon and a text label: never colour alone. */
export const RELATIONS: Record<RelationKind, { label: string; icon: string; dash?: string; meaning: string }> = {
  mutual: { label: 'Two-way', icon: '⇄', meaning: 'Both topics link to each other' },
  'cross-folder': { label: 'Cross-folder', icon: '↗', dash: '6 4', meaning: 'Links to a topic in another folder' },
  link: { label: 'Links to', icon: '→', dash: '2 3', meaning: 'This topic links to the other' },
};

export interface ClassifiedEdge {
  from: string;
  to: string;
  kind: RelationKind;
}

/** Collapses reciprocal links into one 'mutual' edge and marks edges that cross folders. */
export function classifyEdges(graph: TopicGraph, topics: Pick<Topic, 'id' | 'folderId'>[]): ClassifiedEdge[] {
  const folder = new Map(topics.map((t) => [t.id, t.folderId]));
  const has = new Set(graph.edges.map((e) => `${e.from}>${e.to}`));
  const out: ClassifiedEdge[] = [];
  for (const e of graph.edges) {
    const reverse = has.has(`${e.to}>${e.from}`);
    if (reverse && e.from > e.to) continue; // keep one of the pair
    const kind: RelationKind = reverse ? 'mutual' : folder.get(e.from) !== folder.get(e.to) ? 'cross-folder' : 'link';
    out.push({ from: e.from, to: e.to, kind });
  }
  return out;
}
