import type { Question, QuestionKind } from './types';
import { normalizeText } from './grading';
import { extractJson } from './provenance';

export const PAIRS_MIN = 2;
export const PAIRS_MAX = 8;
export const ITEMS_MIN = 3;
export const ITEMS_MAX = 8;
export const BLANKS_MIN = 1;
export const BLANKS_MAX = 6;
export const ACCEPT_MAX = 8;
export const BLANK_MARK = '____';

const KINDS: readonly string[] = ['choice', 'typing', 'cloze', 'matching', 'ordering'];

const str = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '';
const strList = (x: unknown, min: number, max: number): x is string[] =>
  Array.isArray(x) && x.length >= min && x.length <= max && x.every(str);
/** True when no two entries are equal after normalisation (a duplicate would make grading ambiguous). */
const allDistinct = (xs: string[]) => new Set(xs.map((x) => normalizeText(x) || x)).size === xs.length;

const PNLE_KEYS = ['vignette', 'strategy', 'area', 'archetype', 'optionRationales', 'reasoning'];
const trimmed = (x: unknown): string | undefined => (typeof x === 'string' && x.trim() !== '' ? x.trim() : undefined);

export type PnleExtras = { drop: true } | { drop: false; stem: string; rationale: string; fields: Partial<Question> };

/**
 * PNLE-style fields of a choice item. Items without any PNLE key come back unchanged (old data keeps working).
 * Display rule (one approach, used everywhere): when a vignette exists the returned `stem` is
 * `vignette + blank line + stem`; the raw vignette is also kept in `fields.vignette`.
 * A PNLE-style item whose correct answer has no rationale (neither `rationale` nor `optionRationales[answerIndex]`) is dropped.
 */
export function pnleExtras(q: any, choiceCount: number, answerIndex: number): PnleExtras {
  const styled = PNLE_KEYS.some((k) => q?.[k] !== undefined && q?.[k] !== null);
  const rationale = typeof q?.rationale === 'string' ? q.rationale : '';
  const stem = typeof q?.stem === 'string' ? q.stem : '';
  if (!styled) return { drop: false, stem, rationale, fields: {} };
  const rawOpts = q.optionRationales;
  const optionRationales =
    Array.isArray(rawOpts) && rawOpts.length === choiceCount && rawOpts.every((x: unknown) => trimmed(x)) ? (rawOpts as string[]) : undefined;
  const correct = trimmed(rationale) ?? trimmed(optionRationales?.[answerIndex]);
  if (!correct) return { drop: true };
  const vignette = trimmed(q.vignette);
  const fields: Partial<Question> = {};
  if (vignette) fields.vignette = vignette;
  const strategy = trimmed(q.strategy);
  if (strategy) fields.strategy = strategy;
  const area = trimmed(q.area);
  if (area) fields.area = area;
  const archetype = trimmed(q.archetype);
  if (archetype) fields.archetype = archetype;
  const reasoning = trimmed(q.reasoning);
  if (reasoning) fields.reasoning = reasoning;
  if (optionRationales) fields.optionRationales = optionRationales;
  const shown = vignette ? (stem.trim() ? `${vignette}\n\n${stem.trim()}` : vignette) : stem;
  return { drop: false, stem: shown, rationale: trimmed(rationale) ? rationale : correct, fields };
}

/**
 * Validates ONE AI question item of any kind. Returns null for anything malformed; never repairs.
 * Items without "kind" (or with "choice") follow the original choice rules exactly.
 */
export function parseQuestionItem(q: any, topicId: string, id: string): Question | null {
  if (!q || typeof q !== 'object' || typeof q.stem !== 'string' || typeof q.rationale !== 'string') return null;
  const kind: QuestionKind = q.kind === undefined ? 'choice' : q.kind;
  if (typeof kind !== 'string' || !KINDS.includes(kind)) return null;
  if (kind !== 'choice' && !str(q.stem)) return null; // choice keeps the original (looser) stem rule
  const base = { id, topicId, stem: q.stem, rationale: q.rationale };
  switch (kind) {
    case 'choice': {
      const ok =
        Array.isArray(q.choices) &&
        q.choices.length >= 2 &&
        q.choices.every((c: unknown) => typeof c === 'string') &&
        Number.isInteger(q.answerIndex) &&
        q.answerIndex >= 0 &&
        q.answerIndex < q.choices.length;
      if (!ok) return null;
      const ex = pnleExtras(q, q.choices.length, q.answerIndex);
      if (ex.drop) return null;
      return { ...base, stem: ex.stem, rationale: ex.rationale, choices: q.choices, answerIndex: q.answerIndex, ...ex.fields };
    }
    case 'typing':
      return strList(q.accept, 1, ACCEPT_MAX) ? { ...base, kind, choices: [], answerIndex: 0, accept: q.accept } : null;
    case 'cloze': {
      const ok =
        Array.isArray(q.blanks) &&
        q.blanks.length >= BLANKS_MIN &&
        q.blanks.length <= BLANKS_MAX &&
        q.blanks.every((b: unknown) => strList(b, 1, ACCEPT_MAX)) &&
        q.stem.split(BLANK_MARK).length - 1 === q.blanks.length;
      return ok ? { ...base, kind, choices: [], answerIndex: 0, blanks: q.blanks } : null;
    }
    case 'matching': {
      const p = q.pairs;
      const ok =
        Array.isArray(p) &&
        p.length >= PAIRS_MIN &&
        p.length <= PAIRS_MAX &&
        p.every((x: any) => x && str(x.left) && str(x.right)) &&
        allDistinct(p.map((x: any) => x.left)) &&
        allDistinct(p.map((x: any) => x.right));
      return ok ? { ...base, kind, choices: [], answerIndex: 0, pairs: p.map((x: any) => ({ left: x.left, right: x.right })) } : null;
    }
    case 'ordering':
      return strList(q.items, ITEMS_MIN, ITEMS_MAX) && allDistinct(q.items)
        ? { ...base, kind, choices: [], answerIndex: 0, items: q.items }
        : null;
  }
  return null;
}

/** Validates a list of AI items for one topic; ids are `${idPrefix}-${n}` over the kept items. */
export function parseQuestionList(list: unknown, topicId: string, idPrefix: string): Question[] {
  if (!Array.isArray(list)) return [];
  const out: Question[] = [];
  for (const q of list) {
    const parsed = parseQuestionItem(q, topicId, `${idPrefix}-${out.length}`);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Raw model text -> mixed-kind questions for one topic. Malformed items are dropped. */
export function parseMixedQuestions(raw: string, topicId: string, idPrefix: string): Question[] {
  const json = extractJson(raw) as any;
  return parseQuestionList(Array.isArray(json) ? json : json?.questions, topicId, idPrefix);
}
