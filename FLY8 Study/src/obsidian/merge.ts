import type { AppState, Source, Topic } from '../core/types';
import { assessTextQuality, chunkText } from '../core/provenance';
import { slugify } from '../core/vault';
import type { MergePlan, Outcome, ParsedNote, PlanItem } from './types';

export const DEFAULT_FOLDER = 'Obsidian import';
export const SOURCE_URI_PREFIX = 'obsidian:';

type PlanInput = Pick<AppState, 'topics' | 'folders' | 'sources'>;

export interface PlanOptions {
  /** note.path -> existing topic id, from AI suggestions the user accepted. */
  forced?: Record<string, string>;
}

/** Lowercase, punctuation-free, single-spaced: used only to compare paragraphs. */
export function normalizeParagraph(p: string): string {
  return p
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => normalizeParagraph(p));
}

const words = (s: string) => new Set(normalizeParagraph(s).split(' ').filter((w) => w.length > 2));

function jaccard(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export const sourceIdFor = (path: string) => `obs-s-${slugify(path).slice(0, 40)}-${hash(path)}`;

interface Work {
  id: string;
  title: string;
  body: string;
}

/**
 * Builds a PREVIEW plan. Pure and deterministic: it changes nothing. A note matches an existing topic
 * by an earlier import of the same file, an accepted AI suggestion, then title slug or alias.
 */
export function planMerge(state: PlanInput, notes: ParsedNote[], opts: PlanOptions = {}): MergePlan {
  const work = new Map<string, Work>(state.topics.map((t) => [t.id, { id: t.id, title: t.title, body: t.body }]));
  const bySlug = new Map<string, string>();
  for (const t of state.topics) if (!bySlug.has(slugify(t.title))) bySlug.set(slugify(t.title), t.id);
  for (const t of state.topics) for (const a of t.aliases ?? []) if (!bySlug.has(slugify(a))) bySlug.set(slugify(a), t.id);
  const topicBySource = new Map<string, string>();
  for (const t of state.topics) for (const sid of t.sourceIds) topicBySource.set(sid, t.id);
  const priorTopic = new Map<string, string>();
  for (const s of state.sources) {
    const tid = topicBySource.get(s.id);
    if (s.uri?.startsWith(SOURCE_URI_PREFIX) && tid) priorTopic.set(s.uri.slice(SOURCE_URI_PREFIX.length), tid);
  }
  const usedIds = new Set(work.keys());
  const uniqueId = (base: string) => {
    let id = base;
    for (let i = 2; usedIds.has(id); i++) id = `${base}-${i}`;
    usedIds.add(id);
    return id;
  };
  const register = (id: string, title: string, body: string) => {
    work.set(id, { id, title, body });
    if (!bySlug.has(slugify(title))) bySlug.set(slugify(title), id);
  };

  const items: PlanItem[] = [];
  for (const note of notes) {
    const folderName = note.folder || DEFAULT_FOLDER;
    const base = { id: note.path, note, folderName, addParagraphs: [] as string[] };
    let targetId: string | undefined;
    let viaAi = false;
    let viaPrior = false;
    const prior = priorTopic.get(note.path);
    if (prior && work.has(prior)) {
      targetId = prior;
      viaPrior = true;
    } else if (opts.forced?.[note.path] && work.has(opts.forced[note.path])) {
      targetId = opts.forced[note.path];
      viaAi = true;
    } else {
      for (const name of [note.title, ...note.aliases]) {
        const hit = bySlug.get(slugify(name));
        if (hit) {
          targetId = hit;
          break;
        }
      }
    }

    if (!targetId) {
      const id = uniqueId(`obs-${slugify(note.title) || 'note'}`);
      register(id, note.title, note.body);
      items.push({ ...base, outcome: 'new', newTopicId: id, newTitle: note.title, reason: 'No topic with this title yet.' });
      continue;
    }

    const target = work.get(targetId)!;
    const have = new Set(splitParagraphs(target.body).map(normalizeParagraph));
    const incoming = splitParagraphs(note.body);
    const add: string[] = [];
    const addNorm = new Set<string>();
    for (const p of incoming) {
      const n = normalizeParagraph(p);
      if (!have.has(n) && !addNorm.has(n)) {
        add.push(p);
        addNorm.add(n);
      }
    }
    const common = { targetId, targetTitle: target.title, viaAi: viaAi || undefined };
    if (!add.length) {
      items.push({ ...base, ...common, outcome: 'identical', reason: 'Everything in this note is already in your topic.' });
      continue;
    }
    const overlap = incoming.length - add.length;
    const substantial = normalizeParagraph(target.body).length >= 40 && normalizeParagraph(note.body).length >= 40;
    const conflict = !viaPrior && overlap === 0 && substantial && jaccard(target.body, note.body) < 0.2;
    if (conflict) {
      const twinTitle = `${note.title} (Obsidian)`;
      const twinId = bySlug.get(slugify(twinTitle));
      if (twinId && work.has(twinId)) {
        const twin = work.get(twinId)!;
        const twinHave = new Set(splitParagraphs(twin.body).map(normalizeParagraph));
        const twinAdd = incoming.filter((p) => !twinHave.has(normalizeParagraph(p)));
        if (!twinAdd.length) {
          items.push({ ...base, ...common, targetId: twinId, targetTitle: twin.title, outcome: 'identical', reason: 'Already saved as a separate Obsidian copy.' });
        } else {
          twin.body = `${twin.body}\n\n${twinAdd.join('\n\n')}`;
          items.push({ ...base, ...common, targetId: twinId, targetTitle: twin.title, addParagraphs: twinAdd, outcome: 'conflict', newTopicId: twinId, newTitle: twinTitle, reason: 'Same title, different content: updating the separate Obsidian copy.' });
        }
      } else {
        const id = uniqueId(`obs-${slugify(twinTitle)}`);
        register(id, twinTitle, note.body);
        items.push({ ...base, ...common, targetId: undefined, outcome: 'conflict', newTopicId: id, newTitle: twinTitle, reason: `Same title as "${target.title}" but very different content. Both are kept; your topic is untouched.` });
      }
      continue;
    }
    target.body = `${target.body}\n\n${add.join('\n\n')}`;
    items.push({ ...base, ...common, outcome: 'merge', addParagraphs: add, reason: `Adds ${add.length} new paragraph${add.length === 1 ? '' : 's'} to "${target.title}". Nothing is overwritten.` });
  }

  const counts: Record<Outcome, number> = { new: 0, merge: 0, identical: 0, conflict: 0 };
  for (const i of items) counts[i.outcome]++;

  const known = new Set<string>(bySlug.keys());
  for (const n of notes) for (const a of n.aliases) known.add(slugify(a));
  const unresolved: MergePlan['unresolved'] = [];
  const seen = new Set<string>();
  for (const n of notes) {
    for (const l of n.links) {
      const key = `${n.title}>${slugify(l.target)}`;
      if (known.has(slugify(l.target)) || seen.has(key)) continue;
      seen.add(key);
      unresolved.push({ from: n.title, target: l.target });
    }
  }
  return { items, counts, unresolved };
}

/** Applies the enabled items of a plan. Existing text is only ever appended to, never changed or removed. */
export function applyPlan(state: AppState, plan: MergePlan, enabled?: ReadonlySet<string>, now = Date.now()): AppState {
  const folders = [...state.folders];
  const sources = [...state.sources];
  const chunks = [...state.chunks];
  const topics: Topic[] = state.topics.map((t) => ({ ...t, sourceIds: [...t.sourceIds] }));

  const folderIdFor = (name: string): string => {
    const hit = folders.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (hit) return hit.id;
    const id = `obs-f-${slugify(name) || 'import'}`;
    folders.push({ id, name });
    return id;
  };

  for (const item of plan.items) {
    if (item.outcome === 'identical' || (enabled && !enabled.has(item.id))) continue;
    const { note } = item;
    const sid = sourceIdFor(note.path);
    if (!sources.some((s) => s.id === sid)) {
      const source: Source = {
        id: sid,
        title: `Obsidian: ${note.path}`,
        kind: 'file',
        uri: `${SOURCE_URI_PREFIX}${note.path}`,
        addedAt: now,
        quality: assessTextQuality(note.body),
        verification: 'unverified',
      };
      if (item.outcome === 'conflict') {
        source.issues = [`Same title as another topic but different content. Saved separately as "${item.newTitle}" for you to compare.`];
      }
      sources.push(source);
      chunks.push(...chunkText(note.body, sid));
    }
    const append = (t: Topic) => {
      const block = `## Merged from Obsidian: ${note.path}\n\n${item.addParagraphs.join('\n\n')}`;
      t.body = `${t.body.replace(/\s+$/, '')}\n\n${block}`;
      if (!t.sourceIds.includes(sid)) t.sourceIds.push(sid);
      addAliases(t);
    };
    const addAliases = (t: Topic) => {
      const have = new Set([t.title, ...(t.aliases ?? [])].map(slugify));
      const fresh = note.aliases.filter((a) => a.trim() && !have.has(slugify(a)));
      if (fresh.length) t.aliases = [...(t.aliases ?? []), ...fresh];
    };
    const create = (id: string, title: string) => {
      if (topics.some((t) => t.id === id)) return;
      topics.push({
        id,
        folderId: folderIdFor(item.folderName),
        title,
        body: note.body,
        sourceIds: [sid],
        ...(note.aliases.length ? { aliases: note.aliases } : {}),
      });
    };
    const target = item.targetId ? topics.find((t) => t.id === item.targetId) : undefined;
    if (item.outcome === 'new') {
      create(item.newTopicId!, item.newTitle ?? note.title);
    } else if (item.outcome === 'merge') {
      if (target) append(target);
      else create(`obs-${slugify(note.title) || 'note'}`, note.title);
    } else if (target && item.addParagraphs.length) {
      append(target); // conflict into an existing Obsidian copy
    } else if (!target) {
      create(item.newTopicId!, item.newTitle ?? `${note.title} (Obsidian)`);
    }
  }
  return { ...state, folders, sources, chunks, topics };
}
