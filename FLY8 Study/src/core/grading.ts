import type { AttemptEvent, Question, QuestionKind } from './types';

/**
 * Learner answer per kind:
 *  choice   -> chosen index into q.choices
 *  typing   -> the typed text
 *  cloze    -> typed text per blank, in blank order
 *  matching -> for each left item i (canonical order), the CANONICAL index of the right item picked
 *  ordering -> the CANONICAL item indices in the order the learner placed them
 * Matching/ordering answers are canonical ids, never display positions, so shuffling cannot change a grade.
 */
export type Answer = number | string | string[] | number[];

export interface Grade {
  correct: boolean;
  /** 0..1 share right, set for multi-part kinds (cloze, matching, ordering). */
  partial?: number;
  detail: string;
}

/** Numeric answers match within this relative tolerance (0.5%), so 33.3 matches 33.33 but 0.25 does not match 0.26. */
export const NUMERIC_TOLERANCE = 0.005;

export const kindOf = (q: Pick<Question, 'kind'>): QuestionKind => q.kind ?? 'choice';

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NUM = /^[-+]?(\d+(\.\d+)?|\.\d+)$/;
const parseNum = (s: string): number | null => {
  const t = s.trim().replace(/(\d),(?=\d{3}(\D|$))/g, '$1');
  return NUM.test(t) ? Number(t) : null;
};

/** One typed value against one accepted value. */
export function textMatches(given: string, accepted: string): boolean {
  const a = parseNum(given);
  const b = parseNum(accepted);
  if (a !== null && b !== null) return Math.abs(a - b) <= Math.max(1e-9, NUMERIC_TOLERANCE * Math.abs(b));
  const ng = normalizeText(given);
  return ng !== '' && ng === normalizeText(accepted);
}

const anyMatch = (given: string, accepted: readonly string[]) => accepted.some((x) => textMatches(given, x));

const bad = (detail: string): Grade => ({ correct: false, detail });

function share(right: number, total: number, noun: string): Grade {
  const partial = total === 0 ? 0 : right / total;
  return { correct: total > 0 && right === total, partial, detail: `${right} of ${total} ${noun} correct` };
}

const isIntArray = (a: unknown): a is number[] => Array.isArray(a) && a.every((x) => Number.isInteger(x));

/** Pure and deterministic. Malformed answers or malformed questions grade as wrong, never throw. */
export function gradeAnswer(q: Question, answer: Answer): Grade {
  switch (kindOf(q)) {
    case 'typing': {
      if (typeof answer !== 'string' || !q.accept?.length) return bad('No typed answer.');
      return anyMatch(answer, q.accept) ? { correct: true, detail: 'Matches an accepted answer' } : bad('Does not match an accepted answer');
    }
    case 'cloze': {
      if (!q.blanks?.length || !Array.isArray(answer)) return bad('No answers given.');
      const given = answer as unknown[];
      const right = q.blanks.filter((acc, i) => typeof given[i] === 'string' && anyMatch(given[i] as string, acc)).length;
      return share(right, q.blanks.length, 'blanks');
    }
    case 'matching': {
      const n = q.pairs?.length ?? 0;
      if (!n || !isIntArray(answer)) return bad('No matches given.');
      let right = 0;
      for (let i = 0; i < n; i++) if (answer[i] === i) right++;
      return share(right, n, 'matches');
    }
    case 'ordering': {
      const n = q.items?.length ?? 0;
      if (!n || !isIntArray(answer)) return bad('No order given.');
      let right = 0;
      for (let i = 0; i < n; i++) if (answer[i] === i) right++;
      return share(right, n, 'positions');
    }
    default: {
      if (typeof answer !== 'number' || !Number.isInteger(answer)) return bad('No choice made.');
      const correct = answer === q.answerIndex;
      return { correct, detail: correct ? 'Correct choice' : 'Wrong choice' };
    }
  }
}

/** Plain-text correct answer, for showing after a check. */
export function describeCorrect(q: Question): string {
  switch (kindOf(q)) {
    case 'typing':
      return (q.accept ?? []).join(' / ');
    case 'cloze':
      return (q.blanks ?? []).map((b, i) => `${i + 1}. ${b.join(' / ')}`).join('; ');
    case 'matching':
      return (q.pairs ?? []).map((p) => `${p.left} = ${p.right}`).join('; ');
    case 'ordering':
      return (q.items ?? []).map((x, i) => `${i + 1}. ${x}`).join('; ');
    default:
      return q.choices[q.answerIndex] ?? '';
  }
}

function hashSeed(seed: string | number): number {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic Fisher-Yates shuffle (mulberry32 over an FNV-1a seed). Returns a new array. */
export function shuffleSeeded<T>(items: readonly T[], seed: string | number): T[] {
  const out = items.slice();
  let a = hashSeed(seed);
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Display order for n canonical items: a seeded permutation of 0..n-1 that is never the identity (for n > 1),
 * so an ordering question is never shown already solved.
 */
export function presentationOrder(n: number, seed: string | number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  const out = shuffleSeeded(idx, seed);
  if (n > 1 && out.every((v, i) => v === i)) out.push(out.shift() as number);
  return out;
}

/** Share of full credit an answer earns: 0 if wrong, 1 if right, 0.5 at most if right after a hint. */
export function answerWeight(event: Pick<AttemptEvent, 'correct' | 'hinted'>): number {
  if (!event.correct) return 0;
  return event.hinted ? 0.5 : 1;
}
