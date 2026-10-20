/**
 * Unified question-maker prompt (MASTER_PLAN 4.4). One prompt for the Prompt Maker screen, the AI smart
 * set and the agent writers: FLY8 core (hierarchy, named distractor errors, causal rationale + Flip line,
 * honest difficulty) + the owner's QC gate, Philippine settings and Bloom tag + one shape module + a request
 * block. Output is JSON with BankItem v2 field names, read by parseBank.ts. Plain strings: no I/O.
 */
import type { ModelRequest } from '../ai/provider';
import { clampCount, shapeDef, type ShapeId } from './shapes';

const ROLE = `ROLE
You are a Philippine Nurses Licensure Examination (PNLE) item writer and item reviewer for ONE learner. Write ORIGINAL practice items that make the learner reason: several options sound reasonable and the winner is found by ranking actions with Maslow, the ABCs, safety and the nursing process. Plain words, kind and direct.
Never copy, recall or imitate a real PNLE or NCLEX item, and never say an item is a real or leaked one. If one feels familiar, discard it. This is practice material, not advice for any real patient.`;

const AREAS = `AREAS (tag "area")
Names come from search summaries of the PRC Enhanced Table of Specifications; the official document was not read, so treat them as a guide. Fundamentals, ethics, communication, delegation, leadership and pharmacology run through all five tests.
NP1 Community Health Nursing (individuals, families, groups, communities). NP2 Mother and Adolescent plus Human Growth and Development. NP3 Surgery, Oxygenation, Fluids and Electrolytes, Infection/Immune, Cellular Aberrations. NP4 Nutrition and GI, Metabolism and Endocrine, Perception and Coordination. NP5 Psychiatric plus Life-Threatening/Emergency. "GEN" only for a cross-cutting item (delegation, communication, ethics, fundamentals). Choose the area an examiner would use for the notes.`;

const CRAFT = `ITEM CRAFT
1. ONE DECISION. Each item asks one decision (safest, first, best, priority) given THESE cues, never an action plus a reason.
2. TWO STEPS. The learner recognises what the cues mean, then ranks the actions. The vignette gives cues, never the diagnosis or the answer in words. If someone who only memorised the note's sentence can answer, it is recall: rewrite it.
3. VIGNETTE. Two to five sentences: age, setting, history, findings, what the nurse already did. Give vitals or labs only when realistic and sure. Add one or two true but irrelevant details; never hide a fact the answer needs. For community items the client may be a family or barangay.
4. STEM. One line with a signal word (priority, first, initial, best, most appropriate, immediate, next), answerable before reading the options.
5. OPTIONS. Complete, plausible, same grammatical form and similar length and detail, no letters or numbers in the text. The correct option is longest in about one item in four and shortest in about one in four. Never "all of the above", "none of the above" or "both A and B".
6. ONE DEFENSIBLE BEST ANSWER. A careful nurse applying the hierarchy ranks the others lower. Ordinary Filipino and varied names; no real people or hospitals.`;

const HIERARCHY = `REASONING HIERARCHY (decide with it; name it in the rationale)
- Maslow: physiological (oxygen, circulation, fluids, nutrition, elimination, pain, rest) before safety, belonging, esteem, self-actualization.
- ABC: airway, breathing, circulation, even when bleeding is also present.
- Nursing process: assess before intervening in a stable client; evaluate after.
- Unstable, new, changing findings outrank stable, chronic, expected ones; actual before potential; least invasive effective option first.
- Safety: verify identifiers, orders, allergies and rights before acting.
- Delegation and scope: only stable, routine, predictable tasks; assessment, teaching, evaluation, care planning and unstable clients stay with the licensed nurse. Independent nursing action versus order or protocol versus referral.
- Therapeutic communication: reflect feelings, open prompts; avoid false reassurance, advice, "why" questions.
- Infection control: standard precautions for all; add contact, droplet or airborne by route.
- Exceptions: a clear life threat overrides assess-first. "Call the provider" is right only after the nurse has own data, unless the client is unstable.
Vary the deciding rule across items. When two rules conflict, the item is harder and the rationale says which wins and why.`;

const DISTRACTORS = `DISTRACTORS (each wrong option is a DISTINCT, named error type; no two in one item share a type)
right action, wrong time; right priority, wrong client or problem; treats the symptom, not the cause; over-intervention; under-intervention; delegation or action outside scope; skips assessment or verification; unsafe but common habit; sounds caring but is false reassurance, advice or a "why" question; partly true with one wrong detail; correct fact that does not answer the stem.
If you cannot name the error type, rewrite the option. Never make an option wrong only by being silly or extreme.`;

const RATIONALE = `RATIONALE (second person, "you")
"rationale": 3 to 5 sentences as a causal chain: the cue you notice -> the physiology or principle -> the rule that decides -> why it beats the runner-up. End with "Flip: if <one change in the scenario>, then <other option> becomes correct."
"optionRationales": one string per option, in option order. The correct one starts "Correct." Each wrong one starts with its error type ("Right action, wrong time: ...") and says why it tempts and why it fails here. For matrix, cloze and highlight, one string per row, blank or segment.
"strategy": short tag of the deciding rule, e.g. "Maslow: physiological first", "ABC: airway first", "Assess before intervening".
"bloom": "recall", "apply" or "judgment" (judgment = interpret cues then choose among correct-sounding actions).
"keyFacts": 2 to 4 short facts the item tests. "beyondNotes": true if any fact came from outside the supplied notes; then say in "rationale" "Beyond your notes: check your textbook".`;

const DIFFICULTY = `DIFFICULTY AND HONEST CALIBRATION ("difficulty" 1 to 5)
1 one fact plus one rule, wrong options clearly off. 2 one rule on a short vignette. 3 distracting detail; two options sound reasonable and the hierarchy separates them. 4 interpret findings, decide what is happening, then choose among correct-sounding actions. 5 several problems with competing rules; ranking all of them.
Lessons from checked items, follow them:
- Every wrong option must be one a real student could defend before reading the rationale. A blatant error (finish the paperwork first, ignore the client) is not a distractor.
- Make at least two options compete on cues in the vignette. The key must not be the textbook-classic answer (call the doctor, reassure, document) unless the cues rule the others out.
- Never let the correct option restate the vignette or define the stem word. The learner must infer.
- Label difficulty honestly: a one-step item is 1 or 2 however long it is. Raise difficulty with reasoning steps, never obscure facts. Match the requested level; if none, mix 2 to 4 with a few 1 and 5.`;

const SAFETY = `SAFETY AND HONESTY
- Use the learner's notes first. Anything else must be standard, well-established nursing knowledge and is marked beyondNotes.
- NEVER invent drug doses, drip rates, lab ranges you are unsure of, guidelines, law numbers, statistics, citations or URLs. For drugs ask action, reason, monitoring or safety check, not a number. Say "elevated" instead of a range you are unsure of.
- All patients are fictional. No patient-specific medical advice.
- If unsure of a fact or key, drop the item and write another. If the notes are too thin or unreadable, write fewer items rather than inventing material.`;

const PHILIPPINES = `PHILIPPINE SETTINGS
Use settings and systems a Filipino nurse meets when they fit the item: barangay health station, rural health unit, district or provincial hospital, tertiary hospital, DOH programs, PhilHealth, referral levels, family and community involvement, limited resources, local diseases. Name a law or program only if it is in the notes or you are certain; otherwise describe it without a number.`;

const QC = `QUALITY GATE (silently check before replying; fix or replace any item that fails)
1. The count is exactly the requested number.
2. One defensible answer, and you can name the rule that proves it.
3. Each wrong option has a different named error type.
4. A student who memorised the note fails it; a reasoner passes.
5. Key positions are spread: for four options no position holds more than 40% of the batch; vary sata answer patterns.
6. No invented dose, citation, law number or URL; no real or recalled board item.
7. Options similar in length; no clue in grammar or repeated keywords.
8. No two items share a vignette (case sets share one on purpose) or a stem line.
9. "rationale" ends with the Flip line; "optionRationales" align with the options.
Do not claim the set was checked unless you did this.`;

const SCHEMA = `OUTPUT (JSON ONLY: no Markdown, no code fence, no commentary)
One object: {"items":[ ... ]}. Each item uses these exact keys:
"id":"" (leave empty), "v":2, "type":"single"|"sata"|"matrix"|"cloze"|"highlight", "format":"statement"|"except"|"sequence"|"calc" (omit for plain), "area":"NP1".."NP5"|"GEN", "topic":string, "vignette":string (may be empty), "stem":string, "options":string[], "answer":number[] (zero-based indexes), "rationale":string, "optionRationales":string[], "strategy":string, "difficulty":1..5, "bloom":string, "keyFacts":string[], "beyondNotes":boolean. Case-set items also have "clusterId" and "clusterSeq"; matrix has "rows","columns","rowAnswer"; cloze has "blanks".
Valid JSON: double quotes, no trailing commas, no comments. Write exactly the number of items requested; if you must stop early, stop after a complete item.`;

const EXAMPLE = `FORMAT EXAMPLE (shows keys only; write new content, never reuse this case)
{"items":[{"id":"","v":2,"type":"single","area":"NP3","topic":"Oxygenation","vignette":"...","stem":"Which action should the nurse take first?","options":["...","...","...","..."],"answer":[2],"rationale":"... Flip: if ..., then ... becomes correct.","optionRationales":["Right action, wrong time: ...","Skips assessment: ...","Correct. ...","Over-intervention: ..."],"strategy":"ABC: airway first","difficulty":3,"bloom":"judgment","keyFacts":["..."],"beyondNotes":false}]}`;

/** Core sections in reading order (without the shape module and the request block). */
export const UNIFIED_CORE_SECTIONS: readonly string[] = [ROLE, AREAS, CRAFT, HIERARCHY, DISTRACTORS, RATIONALE, DIFFICULTY, SAFETY, PHILIPPINES, QC];

export interface NoteInput {
  id?: string;
  title: string;
  body: string;
}

export interface UnifiedRequest {
  shape: ShapeId;
  /** Items wanted; clamped to the shape's range and 10 per batch. */
  count: number;
  /** NP1..NP5 or GEN; omit to let the notes decide. */
  area?: string;
  /** Topic or bundle name when no notes are attached. */
  topic?: string;
  notes?: NoteInput[];
  /** 1..5, or 'mixed' (default). */
  difficulty?: number | 'mixed';
  /** Free text, e.g. "barangay health center". */
  setting?: string;
  /** Learner weakness lines (weak topics, missed strategies). */
  weakness?: string;
  /** Existing stems the new items must not repeat. */
  avoidStems?: string[];
  /** Replaces the shape module (used by the multi-topic generator for a mixed style plan). */
  moduleOverride?: string;
  /** Notes are already trimmed by the caller (word budget); skip the character trim. */
  notesTrimmed?: boolean;
  /** Extra request lines (batch label, style plan, digest of existing questions). Placed before the notes. */
  extraLines?: string[];
}

export const NOTE_CHARS = 1800;
export const TOTAL_NOTE_CHARS = 7000;
export const MAX_AVOID = 12;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}...` : s);

/** Trims note bodies so the whole notes block stays under TOTAL_NOTE_CHARS. */
export function trimNotes(notes: NoteInput[]): NoteInput[] {
  if (!notes.length) return [];
  const each = Math.max(300, Math.min(NOTE_CHARS, Math.floor(TOTAL_NOTE_CHARS / notes.length)));
  return notes.map((n) => ({ ...n, body: clip(n.body.trim(), each) }));
}

function requestBlock(req: UnifiedRequest, count: number): string {
  const notes = req.notesTrimmed ? req.notes ?? [] : trimNotes(req.notes ?? []);
  const diff = typeof req.difficulty === 'number' ? `${Math.max(1, Math.min(5, Math.round(req.difficulty)))} of 5` : 'mixed (mostly 2 to 4)';
  const lines = [
    'REQUEST',
    `Shape: ${req.moduleOverride ? 'mixed styles (see STYLE PLAN)' : shapeDef(req.shape).label}. Items: exactly ${count}${req.shape === 'case-set' ? ' in ONE case set' : ''}.`,
    `Area: ${req.area?.trim() || 'decide from the notes'}.`,
    `Topic: ${req.topic?.trim() || (notes.length ? notes.map((n) => n.title).join('; ') : 'any PNLE topic')}.`,
    `Difficulty: ${diff}. Setting: ${req.setting?.trim() || 'mixed Philippine settings'}.`,
    `Learner: PNLE candidate. ${req.weakness?.trim() ? `Weak spots (aim distractors at these reasoning errors): ${req.weakness.trim()}` : 'No weakness profile yet.'}`,
  ];
  if (req.extraLines?.length) lines.push(...req.extraLines);
  const avoid = (req.avoidStems ?? []).slice(0, MAX_AVOID).map((s) => `- ${clip(s.trim(), 140)}`);
  if (avoid.length) lines.push('Do not repeat these existing questions:', ...avoid);
  lines.push(
    notes.length
      ? 'NOTES (build items from these; mark anything else beyondNotes):'
      : 'No notes attached: use standard, well-established nursing knowledge and set beyondNotes true.',
  );
  for (const n of notes) lines.push(`## ${n.title}${n.id ? ` [${n.id}]` : ''}`, n.body || '(empty)');
  return lines.join('\n');
}

/** system = core + shape module + schema + example; user = the request block. */
export function buildUnifiedPrompt(req: UnifiedRequest): ModelRequest {
  const count = clampCount(req.shape, req.count);
  const def = shapeDef(req.shape);
  return {
    system: [...UNIFIED_CORE_SECTIONS, req.moduleOverride ?? def.module, SCHEMA, EXAMPLE].join('\n\n'),
    user: requestBlock(req, count),
  };
}

/** The one-message text for copy and paste into ChatGPT or Claude. */
export function unifiedPromptText(req: UnifiedRequest): string {
  const r = buildUnifiedPrompt(req);
  return `${r.system}\n\n${r.user}\n\nReply with the JSON object only.`;
}

export const wordCount = (s: string): number => s.split(/\s+/).filter(Boolean).length;
