import type { AppState, Chunk, Folder, Source, Topic } from '../core/types';
import { assessTextQuality, chunkText } from '../core/provenance';
import { slugify } from '../core/vault';
import np1a from '../../data/presets/np1-a.json';
import np1b from '../../data/presets/np1-b.json';
import np5a from '../../data/presets/np5-a.json';
import np5b from '../../data/presets/np5-b.json';

export const PRESET_DISCLAIMER =
  'AI-written study notes from general nursing knowledge, coverage guided by a review deck outline. Not nurse-reviewed. Check against your textbook and local policy.';

export type PresetPriority = 'high' | 'medium' | 'low';

export interface PresetNote {
  id: string;
  area: 'NP1' | 'NP5';
  title: string;
  body: string;
  tags: string[];
  priority: PresetPriority;
  outlineRefs: string[];
  aiWritten: true;
  nurseReviewed: false;
}

export interface PresetPack {
  id: 'np1' | 'np5';
  name: string;
  folderName: string;
  notes: PresetNote[];
}

const isStr = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const strs = (x: unknown) => (Array.isArray(x) ? x.filter(isStr) : []);

/** Keeps well-formed notes only (id, title, body present; ids and titles unique). Never throws. */
export function validatePresetNotes(raw: unknown): { notes: PresetNote[]; warnings: string[] } {
  const warnings: string[] = [];
  const notes: PresetNote[] = [];
  if (!Array.isArray(raw)) return { notes, warnings: ['Preset file is not a list; ignored.'] };
  const ids = new Set<string>();
  const titles = new Set<string>();
  raw.forEach((r, i) => {
    const n = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    if (!isStr(n.id) || !isStr(n.title) || !isStr(n.body)) {
      warnings.push(`Note #${i + 1} dropped: missing id, title or body.`);
      return;
    }
    const id = n.id.trim();
    const title = n.title.trim();
    if (ids.has(id)) return void warnings.push(`Note "${title}" dropped: duplicate id ${id}.`);
    if (titles.has(slugify(title))) return void warnings.push(`Note "${title}" dropped: duplicate title.`);
    ids.add(id);
    titles.add(slugify(title));
    notes.push({
      id,
      area: n.area === 'NP5' ? 'NP5' : 'NP1',
      title,
      body: n.body,
      tags: strs(n.tags),
      priority: n.priority === 'high' || n.priority === 'low' ? n.priority : 'medium',
      outlineRefs: strs(n.outlineRefs),
      aiWritten: true,
      nurseReviewed: false,
    });
  });
  return { notes, warnings };
}

function buildPack(id: PresetPack['id'], name: string, files: unknown[]): PresetPack & { warnings: string[] } {
  const merged = files.flatMap((f) => (Array.isArray(f) ? (f as unknown[]) : []));
  const { notes, warnings } = validatePresetNotes(merged);
  return { id, name, folderName: name.startsWith('NP1') ? 'NP1 Community Health Nursing' : name, notes, warnings };
}

const BUILT = [
  buildPack('np1', 'NP1 Community Health Nursing', [np1a, np1b]),
  buildPack('np5', 'NP5 Psychiatric and Emergency Nursing', [np5a, np5b]),
];
export const PRESET_PACKS: PresetPack[] = BUILT.map(({ warnings: _w, ...p }) => p);
export const PRESET_WARNINGS: string[] = BUILT.flatMap((p) => p.warnings);

export const presetTopicId = (noteId: string) => `preset-${noteId}`;
export const presetSourceId = (packId: string) => `preset-${packId}`;
const presetFolderId = (packId: string) => `preset-folder-${packId}`;

/** Finds the preset note behind a topic id, if it is one. */
export function findPresetNote(topicId: string, packs: PresetPack[] = PRESET_PACKS): PresetNote | undefined {
  for (const p of packs) for (const n of p.notes) if (presetTopicId(n.id) === topicId) return n;
  return undefined;
}

/**
 * Adds the pack's missing topics. Returns a NEW state; returns the same state object when nothing changed.
 * Never overwrites existing topics (edited or not), never touches other folders.
 */
export function installPack(state: AppState, packId: string, onlyIds?: string[], packs: PresetPack[] = PRESET_PACKS): AppState {
  const pack = packs.find((p) => p.id === packId);
  if (!pack) return state;
  const wanted = onlyIds ? new Set(onlyIds) : null;
  const have = new Set(state.topics.map((t) => t.id));
  const folder = state.folders.find((f) => f.id === presetFolderId(pack.id)) ?? state.folders.find((f) => f.name === pack.folderName);
  const folderId = folder?.id ?? presetFolderId(pack.id);
  const titlesInFolder = new Set(state.topics.filter((t) => t.folderId === folderId).map((t) => slugify(t.title)));
  const fresh = pack.notes.filter(
    (n) => (!wanted || wanted.has(n.id)) && !have.has(presetTopicId(n.id)) && !titlesInFolder.has(slugify(n.title)),
  );
  if (!fresh.length) return state;

  const folders: Folder[] = folder ? state.folders : [...state.folders, { id: folderId, name: pack.folderName }];
  const sourceId = presetSourceId(pack.id);
  let sources: Source[] = state.sources;
  if (!sources.some((s) => s.id === sourceId)) {
    sources = [
      ...sources,
      {
        id: sourceId,
        title: `Preset notes: ${pack.name} (AI-written, not nurse-reviewed)`,
        kind: 'preset',
        addedAt: Date.now(),
        quality: assessTextQuality(pack.notes[0]?.body ?? fresh[0].body),
        verification: 'unverified',
        suggestedOrigin: undefined,
      },
    ];
  }
  const topics: Topic[] = fresh.map((n) => ({
    id: presetTopicId(n.id),
    folderId,
    title: n.title,
    body: n.body,
    sourceIds: [sourceId],
  }));
  // Chunk ids must stay unique across notes that share one source.
  const chunks: Chunk[] = fresh.flatMap((n) =>
    chunkText(n.body, `${sourceId}:${n.id}`).map((ch) => ({ ...ch, sourceId })),
  );
  return { ...state, folders, sources, topics: [...state.topics, ...topics], chunks: [...state.chunks, ...chunks] };
}

export function presetStatus(
  state: AppState,
  packs: PresetPack[] = PRESET_PACKS,
): { packId: string; installed: number; total: number }[] {
  const have = new Set(state.topics.map((t) => t.id));
  return packs.map((p) => ({
    packId: p.id,
    installed: p.notes.filter((n) => have.has(presetTopicId(n.id))).length,
    total: p.notes.length,
  }));
}
