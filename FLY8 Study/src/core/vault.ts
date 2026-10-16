import type { Topic } from './types';

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Extracts targets of [[Target]] and [[Target|alias]] links, in order, de-duplicated. */
export function extractWikilinks(markdown: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
    const target = m[1].trim();
    if (target && !out.includes(target)) out.push(target);
  }
  return out;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface TopicGraph {
  nodes: { id: string; title: string }[];
  edges: GraphEdge[];
  /** Link targets that match no topic yet (candidates for new topics). */
  unresolved: { from: string; target: string }[];
}

/** Builds the concept graph from wikilinks. Links resolve by title or slug, across all folders. */
export function buildGraph(topics: Topic[]): TopicGraph {
  const bySlug = new Map<string, Topic>();
  for (const t of topics) bySlug.set(slugify(t.title), t);
  for (const t of topics) for (const a of t.aliases ?? []) if (!bySlug.has(slugify(a))) bySlug.set(slugify(a), t);
  const edges: GraphEdge[] = [];
  const unresolved: TopicGraph['unresolved'] = [];
  const seen = new Set<string>();
  for (const t of topics) {
    for (const target of extractWikilinks(t.body)) {
      const hit = bySlug.get(slugify(target));
      if (!hit) {
        unresolved.push({ from: t.id, target });
      } else if (hit.id !== t.id) {
        const key = `${t.id}>${hit.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push({ from: t.id, to: hit.id });
        }
      }
    }
  }
  return { nodes: topics.map((t) => ({ id: t.id, title: t.title })), edges, unresolved };
}

export function backlinks(graph: TopicGraph, topicId: string): string[] {
  return graph.edges.filter((e) => e.to === topicId).map((e) => e.from);
}

/** Obsidian-compatible note: frontmatter + body. */
export function toObsidianNote(topic: Topic, folderName: string, sourceTitles: string[]): string {
  const fm = [
    '---',
    `title: ${JSON.stringify(topic.title)}`,
    `folder: ${JSON.stringify(folderName)}`,
    `sources: ${JSON.stringify(sourceTitles)}`,
    '---',
    '',
  ];
  return fm.join('\n') + topic.body.trim() + '\n';
}
