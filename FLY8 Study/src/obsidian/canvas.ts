import { ImportError } from '../import/types';
import { baseName, parseWikilinks } from './parseNote';
import type { ParsedNote } from './types';

interface CanvasNode {
  id: string;
  type?: string;
  text?: string;
  file?: string;
  url?: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
interface CanvasEdge {
  fromNode: string;
  toNode: string;
  label?: string;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** Parses an Obsidian .canvas file into notes. Throws ImportError with a plain message on bad input. */
export function parseCanvas(input: string | unknown, path = 'canvas.canvas', rootPrefix = ''): ParsedNote[] {
  let data: any = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input.replace(/^﻿/, ''));
    } catch {
      throw new ImportError(`"${path}" is not a valid Obsidian canvas file (the JSON is damaged).`, 'read');
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.nodes)) {
    throw new ImportError(`"${path}" does not look like an Obsidian canvas (no "nodes" list).`, 'read');
  }
  const nodes: CanvasNode[] = [];
  for (const n of data.nodes) {
    if (!n || typeof n !== 'object' || typeof n.id !== 'string') continue;
    nodes.push({
      id: n.id,
      type: str(n.type),
      text: str(n.text),
      file: str(n.file),
      url: str(n.url),
      label: str(n.label),
      x: num(n.x),
      y: num(n.y),
      width: num(n.width),
      height: num(n.height),
    });
  }
  const edges: CanvasEdge[] = (Array.isArray(data.edges) ? data.edges : [])
    .filter((e: any) => e && typeof e.fromNode === 'string' && typeof e.toNode === 'string')
    .map((e: any) => ({ fromNode: e.fromNode, toNode: e.toNode, label: str(e.label) }));

  const groups = nodes.filter((n) => n.type === 'group' && n.label?.trim());
  let dir = path.split('/').slice(0, -1).join('/');
  dir = dir ? `${dir}/` : '';
  if (rootPrefix && dir.startsWith(rootPrefix)) dir = dir.slice(rootPrefix.length);
  const baseFolder = dir.split('/').filter(Boolean).join(' / ');

  const groupOf = (n: CanvasNode): string => {
    const inside = groups
      .filter((g) => n.x >= g.x && n.y >= g.y && n.x + n.width <= g.x + g.width && n.y + n.height <= g.y + g.height)
      .sort((a, b) => a.width * a.height - b.width * b.height)[0];
    return inside ? inside.label!.trim() : '';
  };

  /** Title of a node that can be a topic (text node, or file node pointing at a note). */
  const titleOf = (n: CanvasNode): string | null => {
    if (n.type === 'file' && n.file) return baseName(n.file);
    if (n.type === 'link' || n.type === 'group') return null;
    const first = (n.text ?? '').split('\n').map((l) => l.trim()).find(Boolean);
    return first ? first.replace(/^#+\s*/, '').replace(/\[\[|\]\]/g, '').trim() || null : null;
  };
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const notes: ParsedNote[] = [];
  for (const n of nodes) {
    if (n.type !== 'text' && n.type !== undefined) continue;
    const title = titleOf(n);
    if (!title) continue;
    const lines = (n.text ?? '').split('\n');
    const firstIdx = lines.findIndex((l) => l.trim());
    const rest = lines.slice(firstIdx + 1).join('\n').trim();
    const outgoing: string[] = [];
    const seen = new Set<string>();
    for (const e of edges) {
      if (e.fromNode !== n.id) continue;
      const to = byId.get(e.toNode);
      if (!to || to === n) continue;
      const toTitle = titleOf(to);
      const line = toTitle ? `[[${toTitle}]]` : to.type === 'link' && to.url ? to.url : null;
      if (!line || seen.has(line)) continue;
      seen.add(line);
      outgoing.push(e.label?.trim() ? `- ${e.label.trim()}: ${line}` : `- ${line}`);
    }
    const body = [rest, outgoing.length ? `Links:\n${outgoing.join('\n')}` : ''].filter(Boolean).join('\n\n');
    notes.push({
      path: `${path}#${n.id}`,
      title,
      aliases: [],
      tags: [],
      body,
      links: parseWikilinks(body),
      folder: groupOf(n) || baseFolder,
    });
  }
  return notes;
}
