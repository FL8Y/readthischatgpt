/** Pure resolver: which note should "Read this in your notes" open for a question? No UI, no storage. */
import { presetTopicId } from '../presets';

export interface NoteTopicRef {
  id: string;
  title: string;
}

export interface NoteLinkOptions {
  /** note id -> bundle id (see noteToBundleMap). */
  noteBundle?: ReadonlyMap<string, string>;
  /** bundle id -> display name. */
  bundleNames?: Readonly<Record<string, string>>;
  /** Title of a ready-made note that may not be installed yet. */
  noteTitle?: (noteId: string) => string | undefined;
}

export type NoteLink =
  /** The note is in the learner's topics: open it. `byTitle` = found by topic name, not by noteId. */
  | { kind: 'note'; topicId: string; title: string; bundle?: string; byTitle: boolean }
  /** The question points at a ready-made note that is not installed in this app yet. */
  | { kind: 'missing'; title: string; bundle?: string }
  | { kind: 'none' };

const MIN_MATCH = 5;
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function bundleOf(noteId: string | undefined, o: NoteLinkOptions): string | undefined {
  if (!noteId) return undefined;
  const b = o.noteBundle?.get(noteId);
  return b ? o.bundleNames?.[b] ?? b : undefined;
}

const stripPreset = (topicId: string): string => (topicId.startsWith('preset-') ? topicId.slice('preset-'.length) : topicId);

/** Find a topic whose title equals, contains or is contained in the question's topic name. */
export function findTopicByName(name: string, topics: readonly NoteTopicRef[]): NoteTopicRef | undefined {
  const n = norm(name);
  if (n.length < MIN_MATCH) return undefined;
  const exact = topics.find((t) => norm(t.title) === n);
  if (exact) return exact;
  return topics.find((t) => {
    const tt = norm(t.title);
    return tt.length >= MIN_MATCH && (tt.includes(n) || n.includes(tt));
  });
}

export function resolveNoteLink(
  item: { noteId?: string; topic: string },
  topics: readonly NoteTopicRef[],
  opts: NoteLinkOptions = {},
): NoteLink {
  const { noteId } = item;
  if (noteId) {
    const hit = topics.find((t) => t.id === presetTopicId(noteId)) ?? topics.find((t) => t.id === noteId);
    if (hit) return { kind: 'note', topicId: hit.id, title: hit.title, bundle: bundleOf(noteId, opts), byTitle: false };
  }
  const byName = findTopicByName(item.topic, topics);
  if (byName) return { kind: 'note', topicId: byName.id, title: byName.title, bundle: bundleOf(noteId ?? stripPreset(byName.id), opts), byTitle: true };
  if (noteId) {
    const title = opts.noteTitle?.(noteId);
    if (title) return { kind: 'missing', title, bundle: bundleOf(noteId, opts) };
  }
  return { kind: 'none' };
}
