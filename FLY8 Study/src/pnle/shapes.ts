/**
 * Question shapes for the unified question-maker prompt (MASTER_PLAN 4.4). Each shape is one short module
 * that the prompt builder appends on demand. Pure data: no I/O.
 */
export type ShapeId = 'single' | 'sata' | 'statement' | 'except' | 'sequence' | 'calc' | 'case-set';

export interface ShapeDef {
  id: ShapeId;
  label: string;
  /** One line for the picker. */
  blurb: string;
  /** Prompt module text: what to write and which fields to set. */
  module: string;
  /** Smallest and largest item count one request may ask for. */
  min: number;
  max: number;
}

export const MAX_BATCH = 10;

const SINGLE = `SHAPE: SINGLE BEST ANSWER
"type":"single". Exactly four options, "answer":[i] with one index. Leave "format" out.`;

const SATA = `SHAPE: SELECT ALL THAT APPLY
"type":"sata". Five or six options, "answer" lists every correct index (at least two, never all). The stem ends "Select all that apply." Each option stands alone and is judged true or false by one rule; no option depends on another. "optionRationales" has one entry per option. Partial credit is given, so do not hide a correct option behind vague wording.`;

const STATEMENT = `SHAPE: STATEMENT I / STATEMENT II
"type":"single", "format":"statement". Put both statements in "stem" as "Statement I: ... Statement II: ...". The four options are always, in this order: "Both statements are true", "Only Statement I is true", "Only Statement II is true", "Neither statement is true". Judge each statement alone and make the pair mixed across the batch, not always both true. Do not link them by "because" unless asked to test cause.`;

const EXCEPT = `SHAPE: EXCEPT / LEAST APPROPRIATE
"type":"single", "format":"except". The stem says EXCEPT or LEAST in capitals. Three options are true or appropriate and exactly one is the exception; "answer" is the exception. State in "rationale" why each of the three others is acceptable. Use sparingly and never double negatives.`;

const SEQUENCE = `SHAPE: SEQUENCE
"type":"single", "format":"sequence". Ask the learner to rank actions or events in order. Each option is one complete ordering of the same 4 steps written as "1) ... 2) ... 3) ... 4) ..." with the steps spelled out, never letters. Exactly one ordering follows the hierarchy or the evidence-based order; the others swap steps in ways real students do. Use only sequences with one defensible order.`;

const CALC = `SHAPE: CALCULATION
"type":"single", "format":"calc". Use only if every number and unit needed is written in the vignette or stem. Give the formula in "rationale" using only those numbers and the final result. Options are four numeric answers with units; the wrong ones come from real slips (wrong unit conversion, forgot to divide, used the wrong weight). No drug doses from memory: all values come from the item itself. If you cannot make it exact, write another shape.`;

const CASE_SET = `SHAPE: CASE SET (ONE vignette, 3 to 6 linked items)
Write ONE shared "vignette" and repeat it word for word in every item. Give every item the same "clusterId" (any short label such as "A") and "clusterSeq" 1, 2, 3... in order. Each item tests a different decision (cue recognition, priority, intervention, evaluation, teaching) and must be answerable alone. Mix types where the case allows:
- "single" and "sata" as above.
- "matrix": "rows" (2 to 5 findings or actions), "columns" (2 to 5 labels, e.g. Indicated / Contraindicated / Non-essential), "rowAnswer" (the right column index for each row); "options" and "answer" are [].
- "cloze": "stem" has one "____" per blank; "blanks":[{"choices":[2 to 4 words],"answer":i}]; "options" and "answer" are [].
- "highlight": "options" are the 4 to 8 segments of the record in order; "answer" lists the segments that matter for the stem; "stem" says "Select the findings that...".
For matrix, cloze and highlight "optionRationales" explains each row, blank or segment in order. "count" is the number of items in the set.`;

export const SHAPES: readonly ShapeDef[] = [
  { id: 'single', label: 'Single best answer', blurb: 'Four options, one best answer', module: SINGLE, min: 1, max: MAX_BATCH },
  { id: 'sata', label: 'Select all that apply', blurb: 'Five or six options, pick every correct one', module: SATA, min: 1, max: MAX_BATCH },
  { id: 'statement', label: 'Statement I and II', blurb: 'Judge two statements', module: STATEMENT, min: 1, max: MAX_BATCH },
  { id: 'except', label: 'EXCEPT / least appropriate', blurb: 'Find the one that does not belong', module: EXCEPT, min: 1, max: MAX_BATCH },
  { id: 'sequence', label: 'Put in order', blurb: 'Which order is correct', module: SEQUENCE, min: 1, max: MAX_BATCH },
  { id: 'calc', label: 'Calculation', blurb: 'Numbers are all given in the question', module: CALC, min: 1, max: MAX_BATCH },
  { id: 'case-set', label: 'Case set', blurb: 'One case, 3 to 6 linked questions', module: CASE_SET, min: 3, max: 6 },
];

export function isShapeId(x: unknown): x is ShapeId {
  return typeof x === 'string' && SHAPES.some((s) => s.id === x);
}

export function shapeDef(id: ShapeId): ShapeDef {
  return SHAPES.find((s) => s.id === id) ?? SHAPES[0];
}

/** Clamps a requested count into the shape's range (and the batch cap). */
export function clampCount(shape: ShapeId, n: number): number {
  const def = shapeDef(shape);
  const v = Math.round(Number.isFinite(n) ? n : 5);
  return Math.max(def.min, Math.min(def.max, Math.min(MAX_BATCH, v)));
}
