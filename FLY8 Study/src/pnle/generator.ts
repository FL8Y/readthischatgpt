/**
 * Multi-topic question generator plan: style mix, batches and app-aware prompts (note excerpts + digest of the
 * bank). Pure: no I/O. Each batch is a complete prompt that stays inside BATCH_WORD_CAP words.
 */
import type { BankItem } from '../bank/schema';
import { composeManualPrompt } from '../ai/manual';
import type { ModelRequest } from '../ai/provider';
import { MAX_BATCH } from './shapes';
import { bankDigest, countWords, noteExcerpt } from './noteExcerpt';
import { buildUnifiedPrompt } from './unifiedPrompt';

export type Style = 'single' | 'sata' | 'matrix' | 'cloze' | 'highlight' | 'curveball';
export const STYLES: readonly { id: Style; label: string; blurb: string }[] = [
  { id: 'single', label: 'Single best answer', blurb: 'Four options, one best' },
  { id: 'sata', label: 'Select all that apply', blurb: 'Keep to about 1 in 10' },
  { id: 'matrix', label: 'Matrix', blurb: 'Rows against columns' },
  { id: 'cloze', label: 'Fill the blanks', blurb: 'Pick the word for each blank' },
  { id: 'highlight', label: 'Highlight', blurb: 'Select the important parts' },
  { id: 'curveball', label: 'Curve-ball', blurb: 'The usual rule does not apply' },
];
/** Percent shares. Select-all stays near 10. */
export type StyleMix = Record<Style, number>;
export const DEFAULT_MIX: StyleMix = { single: 60, sata: 10, matrix: 8, cloze: 6, highlight: 6, curveball: 10 };

export const BATCH_WORD_CAP = 3300;
export const BATCH_TOPICS = 4;
export const NOTES_WORDS_PER_BATCH = 800;
export const MIN_CASE_ITEMS = 3;

export interface TopicPick {
  name: string;
  /** Note body to excerpt (omit when the note is not installed). */
  body?: string;
  noteId?: string;
  area?: string;
  /** Questions wanted for this topic. */
  count: number;
}

export interface GeneratorSpec {
  topics: TopicPick[];
  mix: StyleMix;
  difficulty: number | 'mixed';
  setting?: string;
  weakness?: string;
  existing: readonly BankItem[];
}

/** Largest-remainder split of `total` by percent weights. */
export function allocateStyles(total: number, mix: StyleMix): Record<Style, number> {
  const out = {} as Record<Style, number>;
  const sum = STYLES.reduce((a, s) => a + Math.max(0, mix[s.id] || 0), 0) || 1;
  const rem: { id: Style; r: number }[] = [];
  let used = 0;
  for (const s of STYLES) {
    const exact = (Math.max(0, mix[s.id] || 0) / sum) * total;
    out[s.id] = Math.floor(exact);
    used += out[s.id];
    rem.push({ id: s.id, r: exact - out[s.id] });
  }
  rem.sort((a, b) => b.r - a.r);
  for (let i = 0; used < total; i++, used++) out[rem[i % rem.length].id]++;
  return out;
}

/** An evenly spread deck of style tokens, so every batch gets a similar mix. */
function deck(alloc: Record<Style, number>): Style[] {
  const keyed: { s: Style; k: number }[] = [];
  for (const s of STYLES) for (let j = 0; j < alloc[s.id]; j++) keyed.push({ s: s.id, k: (j + 0.5) / alloc[s.id] });
  return keyed.sort((a, b) => a.k - b.k || STYLES.findIndex((x) => x.id === a.s) - STYLES.findIndex((x) => x.id === b.s)).map((x) => x.s);
}

/** Matrix, cloze and highlight need a shared case: fewer than 3 of them in a batch turn into single items. */
export function normalizeBatchStyles(counts: Record<Style, number>): Record<Style, number> {
  const c = { ...counts };
  const caseN = c.matrix + c.cloze + c.highlight;
  if (caseN > 0 && caseN < MIN_CASE_ITEMS) {
    c.single += caseN;
    c.matrix = c.cloze = c.highlight = 0;
  }
  return c;
}

const MIXED_MODULE = `SHAPE: MIXED STYLES (follow the STYLE PLAN in the request exactly)
"single": "type":"single", four options, "answer":[i]. "sata": "type":"sata", five or six options, "answer" lists every correct index (two or more, never all), stem ends "Select all that apply." Partial credit is given, so each option stands alone.
"curveball": "type":"single" or "sata" with "flags":["curveball"]. The learner's usual rule of thumb (call the provider, reassure, ABC) looks right but the cues make another option best; the rationale names the rule that wins and why. Still one defensible answer, never a trick.
"matrix", "cloze" and "highlight" items go together in ONE case set: one shared "vignette" repeated word for word in each of them, one "clusterId" label, "clusterSeq" 1, 2, 3... Singles in the plan stay standalone.
- "matrix": "rows" (2 to 5), "columns" (2 to 5 labels), "rowAnswer" (right column index per row); "options" and "answer" are [].
- "cloze": "stem" has one "____" per blank; "blanks":[{"choices":[2 to 4 words],"answer":i}]; "options" and "answer" are [].
- "highlight": "options" are 4 to 8 record segments in order; "answer" lists the ones that matter; the stem says "Select the findings that...".
For matrix, cloze and highlight "optionRationales" explains each row, blank or segment in order. Vary the deciding rule across items.`;

const VARIETY_LINE = 'Vary the type mix, vignette settings and deciding rules; never reuse a trap, cue pattern or answer idea from the existing list.';

export interface GeneratedBatch {
  index: number;
  total: number;
  count: number;
  topics: string[];
  styles: Record<Style, number>;
  request: ModelRequest;
  /** The full copy-paste text. */
  text: string;
  words: number;
}

interface Slot {
  pick: TopicPick;
  n: number;
}

/** Splits the spec into batches of at most MAX_BATCH items and BATCH_TOPICS topics each. */
function slotBatches(topics: TopicPick[]): Slot[][] {
  const batches: Slot[][] = [];
  let cur: Slot[] = [];
  let items = 0;
  for (const pick of topics) {
    let left = Math.max(0, Math.round(pick.count));
    while (left > 0) {
      if (items >= MAX_BATCH || cur.length >= BATCH_TOPICS) {
        batches.push(cur);
        cur = [];
        items = 0;
      }
      const take = Math.min(left, MAX_BATCH - items);
      cur.push({ pick, n: take });
      items += take;
      left -= take;
    }
  }
  if (cur.length) batches.push(cur);
  return batches;
}

const planLine = (c: Record<Style, number>): string =>
  STYLES.filter((s) => c[s.id] > 0).map((s) => `${c[s.id]} ${s.label.toLowerCase()}`).join(', ');

/** Total questions asked for in a spec. */
export const totalQuestions = (topics: readonly TopicPick[]): number => topics.reduce((a, t) => a + Math.max(0, Math.round(t.count)), 0);

/** Builds every batch prompt. Each is re-trimmed (notes first, then digest) until it fits BATCH_WORD_CAP. */
export function planBatches(spec: GeneratorSpec): GeneratedBatch[] {
  const slots = slotBatches(spec.topics.filter((t) => t.count > 0));
  const total = totalQuestions(spec.topics);
  const tokens = deck(allocateStyles(total, spec.mix));
  let cursor = 0;
  const done: string[] = [];
  return slots.map((batch, index) => {
    const count = batch.reduce((a, s) => a + s.n, 0);
    const raw = { single: 0, sata: 0, matrix: 0, cloze: 0, highlight: 0, curveball: 0 } as Record<Style, number>;
    for (const st of tokens.slice(cursor, cursor + count)) raw[st]++;
    cursor += count;
    const styles = normalizeBatchStyles(raw);
    const names = [...new Set(batch.map((s) => s.pick.name))];
    const picks = [...new Map(batch.map((s) => [s.pick.name, s.pick])).values()];
    const lines = (notesWords: number, digestLines: number): GeneratedBatch['request'] => {
      const each = Math.max(60, Math.floor(notesWords / picks.length));
      const notes = picks
        .filter((p) => p.body)
        .map((p) => ({ id: p.noteId, title: p.name, body: noteExcerpt(p.body ?? '', each) }));
      const dg = bankDigest(spec.existing, names, digestLines);
      const extra = [
        `Batch ${index + 1} of ${slots.length}. Items per topic: ${batch.map((s) => `${s.pick.name} x${s.n}`).join('; ')}.`,
        `STYLE PLAN (exactly ${count}): ${planLine(styles)}.`,
        ...(done.length ? [`Earlier batches of this series covered: ${done.join(' | ')}. Take different angles and traps from them.`] : []),
        ...(dg.lines.length ? ['EXISTING QUESTIONS (do not repeat these or their traps):', ...dg.lines] : []),
        VARIETY_LINE,
      ];
      return buildUnifiedPrompt({
        shape: 'single', count, topic: names.join('; '), area: picks.find((p) => p.area)?.area, notes, notesTrimmed: true,
        difficulty: spec.difficulty, setting: spec.setting, weakness: spec.weakness, moduleOverride: MIXED_MODULE, extraLines: extra,
      });
    };
    let nw = NOTES_WORDS_PER_BATCH;
    let dl = 18;
    let request = lines(nw, dl);
    let text = composeManualPrompt(request, { expect: 'json' });
    while (countWords(text) > BATCH_WORD_CAP && (nw > 120 || dl > 0)) {
      if (nw > 120) nw = Math.max(120, nw - 150);
      else dl = Math.max(0, dl - 4);
      request = lines(nw, dl);
      text = composeManualPrompt(request, { expect: 'json' });
    }
    done.push(`${names.join(', ')} (${planLine(styles)})`);
    return { index, total: slots.length, count, topics: names, styles, request, text, words: countWords(text) };
  });
}
