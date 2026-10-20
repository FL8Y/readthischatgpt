/**
 * Gemini question batches: checks a batch of new BankItems before it is saved to data/bank/gemini/.
 * Reuses the app's own item rules (validateItem) and the same near-duplicate test the importer uses, then adds the
 * owner's rules: a real noteId, a crosscheck with two sources, select-all at most 1 in 10, original-wording guards.
 * Pure: no I/O. Never throws.
 */
import { extractPatch } from '../../scripts/gemini/patchCore.mjs';
import { NEAR_DUPLICATE_JACCARD } from '../bank/schema';
import type { BankItem } from '../bank/schema';
import { sataBudget } from '../bank/select';
import { jaccard, stemKey, trigrams, validateItem } from '../bank/validate';

export interface QuestionCrosscheck { sources: string[]; verdict: 'AGREE' | 'FIXED' | 'DOUBT'; doubts?: string[] }
export interface QuestionIssue { code: string; message: string }
export interface QuestionResult { id: string; status: 'ok' | 'rejected'; errors: QuestionIssue[]; warnings: QuestionIssue[] }
export interface QuestionValidation {
  task: string;
  batch: number | null;
  errors: QuestionIssue[];
  results: QuestionResult[];
  /** Items that passed, normalised: Gemini is not a reviewer, so review stays 'unreviewed' and aiWritten true. */
  accepted: BankItem[];
}
export interface QuestionContext {
  /** Every question already in the app (any source). */
  existing: readonly BankItem[];
  /** Ids of every review note, so noteId can be checked. */
  noteIds: ReadonlySet<string>;
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const issue = (code: string, message: string): QuestionIssue => ({ code, message });
const URL_RE = /https?:\/\/\S+/i;
/** Phrases that mean the text came from a workbook, test bank or a recalled board paper. */
const COPY_HINTS = /\b(recalled|board exam|SET[- ]?[567]|workbook|test ?bank|scantron)\b/i;

function checkCrosscheck(cc: unknown, errors: QuestionIssue[], warnings: QuestionIssue[]): void {
  if (!isObj(cc)) return void errors.push(issue('CROSSCHECK_MISSING', 'No "crosscheck". Add { "sources": [textbook with chapter, online link], "verdict": "AGREE|FIXED|DOUBT" }.'));
  const sources = Array.isArray(cc.sources) ? cc.sources.filter(isStr) : [];
  if (sources.length < 2) errors.push(issue('CROSSCHECK_SOURCES', 'The crosscheck needs at least 2 sources: a Reference shelf textbook (with chapter) AND an online link.'));
  else if (!sources.some((s) => URL_RE.test(s))) errors.push(issue('CROSSCHECK_NO_LINK', 'None of the crosscheck sources is a real link (https://...). One must be an online page you opened.'));
  if (!['AGREE', 'FIXED', 'DOUBT'].includes(String(cc.verdict))) errors.push(issue('CROSSCHECK_VERDICT', 'verdict must be AGREE, FIXED or DOUBT.'));
  else if (cc.verdict === 'DOUBT') {
    const d = Array.isArray(cc.doubts) ? cc.doubts.filter(isStr) : [];
    warnings.push(issue('CROSSCHECK_DOUBT', `Gemini is unsure${d.length ? `: ${d.slice(0, 3).join(' | ')}` : ''}. A person should look at this one.`));
  }
}

export function validateQuestionPatch(patch: unknown, ctx: QuestionContext): QuestionValidation {
  const out: QuestionValidation = { task: '', batch: null, errors: [], results: [], accepted: [] };
  try {
    if (!isObj(patch)) return { ...out, errors: [issue('BAD_SHAPE', 'The patch is not a JSON object.')] };
    out.task = typeof patch.task === 'string' ? patch.task : '';
    out.batch = typeof patch.batch === 'number' ? patch.batch : null;
    const rows = Array.isArray(patch.questions) ? patch.questions : [];
    if (!rows.length) return { ...out, errors: [issue('NO_QUESTIONS', 'The patch has no "questions" list. Send { "task", "batch", "questions": [ { "item": {...}, "crosscheck": {...} } ] }.')] };

    const ids = new Set(ctx.existing.map((e) => e.id));
    const seen = new Set<string>();
    const grams = ctx.existing.map((e) => ({ id: e.id, cluster: e.clusterId, g: trigrams(stemKey(e)) }));
    const wrapped = rows.map((r) => (isObj(r) && isObj(r.item) ? r : { item: r, crosscheck: isObj(r) ? r.crosscheck : undefined }));
    let sataRoom = sataBudget(wrapped.length);

    wrapped.forEach((row, i) => {
      const raw = row.item as Obj;
      const errors: QuestionIssue[] = [];
      const warnings: QuestionIssue[] = [];
      const id = isStr(raw.id) ? raw.id : `(question ${i + 1})`;
      // Gemini is not a nurse reviewer: normalise the flags rather than trusting them.
      const item = { ...raw, source: 'bank', review: 'unreviewed', aiWritten: true } as unknown as BankItem;
      const v = validateItem(item);
      v.errors.forEach((m) => errors.push(issue('ITEM_RULE', m)));
      v.warnings.forEach((m) => warnings.push(issue('ITEM_WARN', m)));
      if (isStr(raw.id)) {
        if (ids.has(raw.id) || seen.has(raw.id)) errors.push(issue('ID_TAKEN', `id ${raw.id} already exists.`));
        seen.add(raw.id);
        if (!/^(np[1-5]|gen)-gx-[a-z0-9-]+$/.test(raw.id)) errors.push(issue('ID_FORMAT', 'New question ids must look like np1-gx-0001 (np1..np5 or gen, then -gx-, then letters/digits/hyphens).'));
      }
      if (!isStr(raw.noteId)) errors.push(issue('NOTE_MISSING', 'noteId is required: the id of the note where the learner can read this answer again.'));
      else if (!ctx.noteIds.has(raw.noteId)) errors.push(issue('NOTE_UNKNOWN', `noteId ${raw.noteId} is not a note in the app.`));
      if (item.type === 'sata') {
        if (sataRoom-- <= 0) errors.push(issue('SATA_BUDGET', 'Too many select-all-that-apply items in this batch (at most 1 in every 10).'));
      }
      if (item.type !== 'single' && item.type !== 'sata') errors.push(issue('TYPE_NOT_ALLOWED', `type "${String(item.type)}" is for case sets only; send single or sata.`));
      if (Array.isArray(item.optionRationales) && Array.isArray(item.options) && item.optionRationales.length !== item.options.length) {
        errors.push(issue('OPTION_RATIONALES', 'optionRationales must have one explanation per option.'));
      }
      if (!isStr(item.rationaleSimple)) warnings.push(issue('NO_SIMPLE_RATIONALE', 'rationaleSimple (a 1-2 sentence plain version) is missing.'));
      if (COPY_HINTS.test(`${item.vignette ?? ''} ${item.stem ?? ''} ${(item.options ?? []).join(' ')}`)) {
        errors.push(issue('COPY_SUSPECT', 'The text mentions a board exam, SET paper, workbook or test bank. Questions must be original, not from those.'));
      }
      checkCrosscheck(row.crosscheck, errors, warnings);
      if (!errors.length) {
        const g = trigrams(stemKey(item));
        const dup = grams.find((k) => !(item.clusterId && k.cluster === item.clusterId) && jaccard(g, k.g) > NEAR_DUPLICATE_JACCARD);
        if (dup) errors.push(issue('NEAR_DUPLICATE', `Too similar to ${dup.id}.`));
        else grams.push({ id: item.id, cluster: item.clusterId, g });
      }
      const ok = errors.length === 0;
      out.results.push({ id, status: ok ? 'ok' : 'rejected', errors, warnings });
      if (ok) out.accepted.push(item);
    });
  } catch (e) {
    out.errors.push(issue('INTERNAL', `Validation failed unexpectedly: ${e instanceof Error ? e.message : String(e)}`));
    out.accepted = [];
  }
  return out;
}

/** Reads a whole Gemini reply and validates the first JSON block in it. */
export function checkQuestionReply(text: string, ctx: QuestionContext): QuestionValidation & { readNotes: string[] } {
  const ex = extractPatch(text);
  const readNotes = [...ex.errors, ...ex.warnings].map((x: { message: string }) => x.message);
  if (!ex.patch) return { task: '', batch: null, errors: ex.errors.map((x: { code: string; message: string }) => issue(x.code, x.message)), results: [], accepted: [], readNotes };
  return { ...validateQuestionPatch(ex.patch, ctx), readNotes };
}
