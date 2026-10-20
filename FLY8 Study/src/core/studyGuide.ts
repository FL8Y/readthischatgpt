/**
 * Study Guide: orders notes from easiest to hardest so a learner does not start with the hardest topic.
 * Pure and offline. The ranking is a plain weighted sum of signals you can read below; nothing is learned or hidden.
 *
 * Difficulty score, 0 (easiest) to 100 (hardest), is a weighted average of the signals that are available:
 *   tier       50%  hand-set tier of the note's subject bundle (BUNDLE_TIERS, 1..9, reasons in TIER_REASON)
 *   length     15%  word count of the note, capped at 1000 words
 *   density    10%  numbers, ALL-CAPS abbreviations and table rows per 100 words (facts to memorise)
 *   dependsOn  10%  how many other notes it links to with [[wikilinks]] (capped at 10): more prerequisites, harder
 *   foundation  5%  how many notes link TO it (capped at 10): widely linked notes are foundations, so they LOWER the score
 *   bank       10%  mean difficulty (1..5) of question-bank items tied to the note, else to its bundle; skipped if unknown
 * When a signal is unavailable its weight is shared out over the others, so the score stays on the same 0..100 scale.
 * A note's rank is its score; ties break on title then id, so identical input always gives identical order.
 */
import { extractWikilinks, slugify } from './vault';

export type Stage = 1 | 2 | 3;

/**
 * Hand-set tier per subject bundle (1 = learn first, 9 = learn last). Stage 1 = tiers 1-3, Stage 2 = 4-6, Stage 3 = 7-9.
 * Bundle ids are the ids in data/presets/bundles.json.
 */
export const BUNDLE_TIERS: Record<string, number> = {
  fund: 1, //     Fundamentals: the vocabulary every other subject uses (vital signs, hygiene, safety, nursing process)
  chn: 2, //      Community health: prevention, programs, family nursing; mostly concepts and lists, little physiology
  plmar: 3, //    Laws, leadership, management, research: recall-heavy but no body systems to understand
  comm: 3, //     Communicable diseases: cause, spread, signs, control; builds on chn and fundamentals
  ob: 4, //       Maternal care: a normal body process with a clear timeline (pregnancy to postpartum) before complications
  pedia: 4, //    Child growth and common illnesses: steady milestones, familiar to most learners
  senses: 5, //   Eye and ear: small, self-contained organ systems
  ortho: 5, //    Bones, joints and traction: mechanical, easy to picture
  periop: 5, //   Before, during and after surgery: a process with a fixed order
  pharm: 6, //    Drug classes: needs body-system knowledge first, so it comes after the basics
  gi: 6, //       Digestive system: familiar body process, moderate complexity
  hema: 6, //     Blood disorders: short bundle, builds on basic physiology
  psych: 6, //    Mental health: concept- and communication-heavy rather than physiology-heavy
  respi: 7, //    Oxygenation: ABC priority, acid-base ideas
  onco: 7, //     Cancer: many treatments and side effects layered on tissue biology
  endo: 7, //     Hormones: feedback loops and many look-alike conditions
  burns: 7, //    Burns: fluid shifts and emergency care in one topic
  neuro: 8, //    Nervous system: abstract anatomy, many look-alike emergencies
  fer: 8, //      Fluids, electrolytes, kidneys: numbers, balance and cause-and-effect chains
  cardio: 8, //   Heart and circulation: physiology, rhythms and many drugs together
  emerg: 9, //    Emergency, disaster and critical care: integrates everything under time pressure
};

export const TIER_REASON =
  'Order used: fundamentals, community health, laws and communicable disease, then maternal and child, then single-system topics (eyes/ears, bones, surgery), ' +
  'then drugs, digestion, blood and mental health, then oxygenation, cancer, hormones and burns, then nerves, fluids/kidney and heart, and emergency care last. ' +
  'It is a study-order guess from how much each subject leans on the earlier ones. It is not an official PNLE order and not nurse-reviewed.';

export const DEFAULT_TIER = 5;

export const WEIGHTS = { tier: 0.5, length: 0.15, density: 0.1, dependsOn: 0.1, foundation: 0.05, bank: 0.1 } as const;
export type SignalName = keyof typeof WEIGHTS;

export const stageOfTier = (tier: number): Stage => (tier <= 3 ? 1 : tier <= 6 ? 2 : 3);
export const bundleTier = (bundleId: string): number => BUNDLE_TIERS[bundleId] ?? DEFAULT_TIER;
export const bundleStage = (bundleId: string): Stage => stageOfTier(bundleTier(bundleId));

export const STAGE_INFO: Record<Stage, { title: string; blurb: string }> = {
  1: { title: 'Stage 1: Foundations', blurb: 'Words and ideas everything else uses. Start with the Beginner\'s Eye tab.' },
  2: { title: 'Stage 2: Core', blurb: 'Everyday nursing topics built on Stage 1.' },
  3: { title: 'Stage 3: Advanced', blurb: 'Body systems that lean on many earlier ideas, and emergencies.' },
};

export interface GuideNote {
  /** Topic id in the app (for presets: `preset-<noteId>`). */
  id: string;
  /** Note id used by the question bank (`noteId`). Optional. */
  noteId?: string;
  title: string;
  bundleId: string;
  body: string;
}

export interface RankedNote extends GuideNote {
  /** 0 (easiest) .. 100 (hardest). */
  score: number;
  stage: Stage;
  /** Each signal's own 0..100 value (undefined = not available). */
  parts: Partial<Record<SignalName, number>>;
  /** Plain label: Easy / Medium / Hard (thirds of the whole range 0-100 by fixed cut-offs). */
  label: 'Easy' | 'Medium' | 'Hard';
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const words = (s: string) => (s.match(/\S+/g) ?? []).length;

/** Facts to memorise per 100 words: digits groups, ALL-CAPS abbreviations (2+ letters), table rows. */
export function density(body: string): number {
  const w = Math.max(1, words(body));
  const nums = (body.match(/\d+(?:[.,]\d+)?/g) ?? []).length;
  const caps = (body.match(/\b[A-Z]{2,}\b/g) ?? []).length;
  const rows = (body.match(/^\s*\|.*\|\s*$/gm) ?? []).length;
  return ((nums + caps + rows) / w) * 100;
}

/** Mean bank difficulty (1..5) by note id and by bundle id. */
export function bankDifficulty(
  items: { noteId?: string; difficulty: number }[],
  bundleOfNote: (noteId: string) => string | undefined,
): { byNote: Record<string, number>; byBundle: Record<string, number> } {
  const n = new Map<string, number[]>();
  const b = new Map<string, number[]>();
  for (const it of items) {
    if (!it.noteId || !(it.difficulty >= 1 && it.difficulty <= 5)) continue;
    (n.get(it.noteId) ?? n.set(it.noteId, []).get(it.noteId)!).push(it.difficulty);
    const bid = bundleOfNote(it.noteId);
    if (bid) (b.get(bid) ?? b.set(bid, []).get(bid)!).push(it.difficulty);
  }
  const mean = (m: Map<string, number[]>) => Object.fromEntries([...m].map(([k, v]) => [k, v.reduce((x, y) => x + y, 0) / v.length]));
  return { byNote: mean(n), byBundle: mean(b) };
}

const labelOf = (score: number): RankedNote['label'] => (score < 40 ? 'Easy' : score < 62 ? 'Medium' : 'Hard');

export function rankNotes(
  notes: GuideNote[],
  bank: { byNote?: Record<string, number>; byBundle?: Record<string, number> } = {},
): RankedNote[] {
  const bySlug = new Map(notes.map((n) => [slugify(n.title), n.id] as const));
  const out = new Map<string, Set<string>>();
  const inn = new Map<string, Set<string>>();
  for (const n of notes) {
    for (const t of extractWikilinks(n.body)) {
      const to = bySlug.get(slugify(t));
      if (!to || to === n.id) continue;
      (out.get(n.id) ?? out.set(n.id, new Set()).get(n.id)!).add(to);
      (inn.get(to) ?? inn.set(to, new Set()).get(to)!).add(n.id);
    }
  }
  const ranked = notes.map((n) => {
    const tier = bundleTier(n.bundleId);
    const parts: Partial<Record<SignalName, number>> = {
      tier: ((tier - 1) / 8) * 100,
      length: clamp01(words(n.body) / 1000) * 100,
      density: clamp01(density(n.body) / 12) * 100,
      dependsOn: clamp01((out.get(n.id)?.size ?? 0) / 10) * 100,
      // widely linked notes are foundations, so a high in-degree means an EASIER note
      foundation: (1 - clamp01((inn.get(n.id)?.size ?? 0) / 10)) * 100,
    };
    const bd = (n.noteId ? bank.byNote?.[n.noteId] : undefined) ?? bank.byBundle?.[n.bundleId];
    if (bd !== undefined) parts.bank = ((bd - 1) / 4) * 100;
    let sum = 0;
    let wsum = 0;
    for (const k of Object.keys(parts) as SignalName[]) {
      sum += (parts[k] as number) * WEIGHTS[k];
      wsum += WEIGHTS[k];
    }
    const score = Math.round((sum / wsum) * 10) / 10;
    return { ...n, score, stage: stageOfTier(tier), parts, label: labelOf(score) } as RankedNote;
  });
  return ranked.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

export interface TopicProgress {
  attempts: number;
  /** 0..1 */
  mastery: number;
}

/** A topic counts as done when the learner marked it studied, or answered at least 2 questions at 70% mastery or better. */
export function isDone(id: string, studied: ReadonlySet<string>, progress: Record<string, TopicProgress | undefined>): boolean {
  const p = progress[id];
  return studied.has(id) || (!!p && p.attempts >= 2 && p.mastery >= 0.7);
}

export interface StageSummary {
  stage: Stage;
  title: string;
  blurb: string;
  topics: RankedNote[];
  done: number;
  total: number;
  /** Mean mastery over topics with at least one answer; null when none were answered. */
  avgMastery: number | null;
  tested: number;
}

export interface StudyGuide {
  startHere: RankedNote[];
  stages: StageSummary[];
}

export const START_HERE_COUNT = 5;

export function buildStudyGuide(
  ranked: RankedNote[],
  studied: string[],
  progress: Record<string, TopicProgress | undefined> = {},
): StudyGuide {
  const st = new Set(studied);
  // Start here: easiest topics that are not done yet. Never skip ahead to a later stage while an earlier one has undone topics.
  const todo = ranked.filter((n) => !isDone(n.id, st, progress));
  const startHere = [...todo].sort((a, b) => a.stage - b.stage || a.score - b.score || a.title.localeCompare(b.title)).slice(0, START_HERE_COUNT);
  const stages = ([1, 2, 3] as Stage[]).map((stage) => {
    const topics = ranked.filter((n) => n.stage === stage);
    const tested = topics.filter((n) => (progress[n.id]?.attempts ?? 0) > 0);
    return {
      stage,
      ...STAGE_INFO[stage],
      topics,
      done: topics.filter((n) => isDone(n.id, st, progress)).length,
      total: topics.length,
      avgMastery: tested.length ? tested.reduce((a, n) => a + (progress[n.id]?.mastery ?? 0), 0) / tested.length : null,
      tested: tested.length,
    };
  });
  return { startHere, stages };
}
