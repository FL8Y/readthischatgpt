import type { AppState, Chunk, Folder, Source, Topic } from '../core/types';
import { assessTextQuality, chunkText } from '../core/provenance';
import { slugify } from '../core/vault';
import genFundA from '../../data/presets/gen-fund-a.json';
import genFundB from '../../data/presets/gen-fund-b.json';
import genFundC from '../../data/presets/gen-fund-c.json';
import genPharm from '../../data/presets/gen-pharm.json';
import genPlmar from '../../data/presets/gen-plmar.json';
import np1A from '../../data/presets/np1-a.json';
import np1B from '../../data/presets/np1-b.json';
import np1Chn2 from '../../data/presets/np1-chn2.json';
import np1Comm from '../../data/presets/np1-comm.json';
import np2Ob from '../../data/presets/np2-ob.json';
import np2Pedia from '../../data/presets/np2-pedia.json';
import np3Cardioresp from '../../data/presets/np3-cardioresp.json';
import np3ErdnRenal from '../../data/presets/np3-erdn-renal.json';
import np3Hop from '../../data/presets/np3-hop.json';
import np4Gitendo from '../../data/presets/np4-gitendo.json';
import np4Neurosenses from '../../data/presets/np4-neurosenses.json';
import np4Ortho from '../../data/presets/np4-ortho.json';
import np5A from '../../data/presets/np5-a.json';
import np5B from '../../data/presets/np5-b.json';
import np5PsychC from '../../data/presets/np5-psych-c.json';
import np5PsychD from '../../data/presets/np5-psych-d.json';
import bundlesJson from '../../data/presets/bundles.json';

export const PRESET_DISCLAIMER =
  'AI-written study notes from general nursing knowledge, coverage guided by a review deck outline. Not nurse-reviewed. Check against your textbook and local policy.';

/** GEN = runs through all five exams (fundamentals, pharmacology, laws and management). */
export type PresetArea = 'NP1' | 'NP2' | 'NP3' | 'NP4' | 'NP5' | 'GEN';
const AREAS: PresetArea[] = ['NP1', 'NP2', 'NP3', 'NP4', 'NP5', 'GEN'];

export type PresetPriority = 'high' | 'medium' | 'low';

export interface PresetNote {
  id: string;
  area: PresetArea;
  title: string;
  body: string;
  tags: string[];
  priority: PresetPriority;
  outlineRefs: string[];
  aiWritten: true;
  nurseReviewed: false;
}

export interface PresetPack {
  id: string;
  area: PresetArea;
  blurb: string;
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
      area: AREAS.includes(n.area as PresetArea) ? (n.area as PresetArea) : 'GEN',
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

const ALL_FILES: unknown[] = [genFundA, genFundB, genFundC, genPharm, genPlmar, np1A, np1B, np1Chn2, np1Comm, np2Ob, np2Pedia, np3Cardioresp, np3ErdnRenal, np3Hop, np4Gitendo, np4Neurosenses, np4Ortho, np5A, np5B, np5PsychC, np5PsychD];

interface BundleDef {
  id: string;
  name: string;
  area: PresetArea;
  blurb: string;
  notes: string[];
}

/**
 * Notes are grouped into one pack per subject, the way the review handouts are organised
 * (data/presets/bundles.json lists each subject's notes in handout order). A note missing from the
 * bundle list is kept in an "Other notes" pack rather than dropped.
 */
function buildPacks(): (PresetPack & { warnings: string[] })[] {
  const { notes, warnings } = validatePresetNotes(ALL_FILES.flatMap((f) => (Array.isArray(f) ? (f as unknown[]) : [])));
  const byId = new Map(notes.map((n) => [n.id, n]));
  const used = new Set<string>();
  const packs: (PresetPack & { warnings: string[] })[] = [];
  for (const b of (bundlesJson as { bundles: BundleDef[] }).bundles) {
    const list = b.notes.map((id) => byId.get(id)).filter((n): n is PresetNote => !!n && !used.has(n.id));
    list.forEach((n) => used.add(n.id));
    if (list.length) packs.push({ id: b.id, name: b.name, area: b.area, blurb: b.blurb, folderName: b.name, notes: list, warnings: [] });
  }
  const rest = notes.filter((n) => !used.has(n.id));
  if (rest.length) packs.push({ id: 'other', name: 'Other notes', area: 'GEN', blurb: 'Notes not placed in a subject yet', folderName: 'Other notes', notes: rest, warnings: [] });
  if (packs.length) packs[0].warnings = warnings;
  return packs;
}

const BUILT = buildPacks();
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
