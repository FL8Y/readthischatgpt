import type { AppState, Topic } from '../core/types';
import { extractJson } from '../core/provenance';
import { learnerProfile } from '../ai/prompts';
import type { ModelRequest } from '../ai/provider';
import type { Diagram, Lesson } from './types';

const MAX_TEXT = 6000;
const MAX_LIST = 12;
const MAX_ITEM = 400;
const MAX_CODE = 20_000;

const LESSON_SHAPE =
  'Write "explanation" (Markdown) in this order: the mechanism (why it happens), the decision rule (what the nurse does first and why), the exam trap (wrong habit). ' +
  'Keep a fact only if an exam question could test it. keyFacts are cues that trigger a decision; each examTrap names the wrong habit and the correct move. ' +
  "Learner's notes first; anything NOT in them goes in a section starting with the line \"AI-added, check against your textbook:\". " +
  'Never invent doses, lab ranges or claims; say if unsure. ' +
  'Omit "mnemonic" and "diagram" unless good. ' +
  'svg: basic shapes and text only, with a viewBox; no scripts, links or images. ' +
  'Reply with JSON only (no prose outside it): {"explanation":string,' +
  '"mnemonic":{"text":string,"rationale":string},"keyFacts":string[],"examTraps":string[],' +
  '"relatedTopics":string[] (related topic titles, no brackets),' +
  '"diagram":{"kind":"svg"|"mermaid","code":string,"caption":string}}';

/** Prompt for a rich lesson. Only call this for a folder where canTeach() is true. */
export function lessonPrompt(state: AppState, topic: Topic, now: number): ModelRequest {
  const others = state.topics.filter((t) => t.id !== topic.id).map((t) => t.title);
  return {
    system: `${learnerProfile(state, now)}\n${LESSON_SHAPE}`,
    user:
      `Teach "${topic.title}". Learner's notes (build on these):\n${topic.body.slice(0, 2500)}\n\n` +
      (others.length ? `Existing topics you may list in relatedTopics: ${others.slice(0, 60).join('; ')}.` : ''),
  };
}

const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = str(x, MAX_ITEM);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= MAX_LIST) break;
  }
  return out;
}

function parseDiagram(v: any): Diagram | undefined {
  if (!v || (v.kind !== 'svg' && v.kind !== 'mermaid')) return undefined;
  const code = str(v.code, MAX_CODE);
  const caption = str(v.caption, MAX_ITEM);
  return code && caption ? { kind: v.kind, code, caption } : undefined;
}

/** True when the explanation carries the AI-added marker the prompt asks for. */
export function hasAiAdded(markdown: string): boolean {
  return /ai-added/i.test(markdown);
}

/**
 * Parses model output into a Lesson. Malformed parts are dropped; returns null only when there is
 * no usable explanation at all. Never throws. Mnemonics and diagrams are always the model's own
 * additions, so they flag the lesson as AI-added.
 */
export function parseLesson(raw: string, topicId: string, now: number): Lesson | null {
  let json: any;
  try {
    json = extractJson(raw);
  } catch {
    return null;
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const explanation = str(json.explanation, MAX_TEXT);
  if (!explanation) return null;
  const mt = str(json.mnemonic?.text, MAX_ITEM);
  const mr = str(json.mnemonic?.rationale, MAX_ITEM);
  const diagram = parseDiagram(json.diagram);
  const related = strList(json.relatedTopics)
    .map((t) => t.replace(/^\[\[|\]\]$/g, '').trim())
    .filter(Boolean);
  return {
    topicId,
    explanation,
    mnemonic: mt && mr ? { text: mt, rationale: mr } : undefined,
    keyFacts: strList(json.keyFacts),
    examTraps: strList(json.examTraps),
    relatedTopics: related,
    diagram,
    aiAdded: hasAiAdded(explanation) || !!(mt && mr) || !!diagram,
    generatedAt: now,
  };
}

export type MdBlock = { kind: 'h' | 'p' | 'li'; text: string };

/** Minimal Markdown to blocks (headings, bullets, paragraphs). [[Links]] show as plain titles. */
export function mdBlocks(md: string): MdBlock[] {
  const out: MdBlock[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const line = raw
      .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_m, t: string, a?: string) => (a || t).trim())
      .replace(/[*_`]{1,3}/g, '')
      .trim();
    if (!line) continue;
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    const li = /^[-•]\s+(.*)$/.exec(line) ?? /^\d+[.)]\s+(.*)$/.exec(line);
    if (h) out.push({ kind: 'h', text: h[1] });
    else if (li) out.push({ kind: 'li', text: li[1] });
    else out.push({ kind: 'p', text: line });
  }
  return out;
}

/** Related titles matched to real topics (case-insensitive); unmatched ones have no topicId. */
export function resolveRelated(lesson: Lesson, topics: Topic[]): { title: string; topicId?: string }[] {
  const byTitle = new Map(topics.map((t) => [t.title.trim().toLowerCase(), t.id]));
  return lesson.relatedTopics.map((title) => ({ title, topicId: byTitle.get(title.toLowerCase()) }));
}
