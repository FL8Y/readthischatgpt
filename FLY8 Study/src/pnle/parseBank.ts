/**
 * Reads a pasted (or pool) reply to the unified question-maker prompt and turns it into BankItem v2.
 * Tolerant of code fences, chatter around the JSON, trailing commas, a wrapping object and a cut-off
 * reply (complete items are kept). Every item goes through validateItem; near-duplicates of the existing
 * bank are rejected. Never throws. Pure: no I/O.
 */
import { hash8 } from '../bank/adapters';
import { NEAR_DUPLICATE_JACCARD, isItemType } from '../bank/schema';
import type { Area, BankItem, Bloom, Difficulty, ItemSource, ItemType } from '../bank/schema';
import { jaccard, stemKey, trigrams, validateItem } from '../bank/validate';

export interface ParseBankOptions {
  /** 'user-ai' when the reply came through the free-key pool, 'user-paste' for a pasted reply (default). */
  source?: Extract<ItemSource, 'user-ai' | 'user-paste'>;
  /** Items already in the bank, for the near-duplicate check. */
  existing?: readonly BankItem[];
  /** Used when the model leaves a field out. */
  defaults?: { area?: Area; topic?: string; noteId?: string; difficulty?: Difficulty };
}

export interface RejectedReplyItem {
  index: number;
  errors: string[];
  /** Short label for the preview list. */
  title: string;
}

export interface ParseBankResult {
  valid: BankItem[];
  rejected: RejectedReplyItem[];
  /** Non-blocking notes per valid item, same order as `valid`. */
  warnings: string[][];
  /** Reply-level notes (cut off, not JSON, key positions lopsided). */
  notes: string[];
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown): string => (typeof x === 'string' ? x.trim() : typeof x === 'number' ? String(x) : '');
const strArr = (x: unknown): string[] => (Array.isArray(x) ? x.map(str) : []);

// ---------- JSON extraction ----------

/** Removes commas that sit directly before a closing bracket, outside strings. */
export function stripTrailingCommas(text: string): string {
  let out = '';
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      out += ch;
      if (ch === '\\') out += text[++i] ?? '';
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
    } else if (ch === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === '}' || text[j] === ']') continue;
      out += ch;
    } else out += ch;
  }
  return out;
}

const normalizeQuotes = (s: string): string => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

/** Index of the bracket that closes the one at `start`, or -1 when the text ends first. */
function matchClose(text: string, start: number): number {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(stripTrailingCommas(text));
  } catch {
    return undefined;
  }
}

/** Complete top-level objects inside the array that starts at `arrStart` (used for a cut-off reply). */
function salvageObjects(text: string, arrStart: number): unknown[] {
  const out: unknown[] = [];
  let i = arrStart + 1;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const close = matchClose(text, open);
    if (close < 0) break;
    const v = tryParse(text.slice(open, close + 1));
    if (v !== undefined) out.push(v);
    i = close + 1;
  }
  return out;
}

const LIST_KEYS = ['items', 'questions', 'data', 'results', 'quiz'];

function listFrom(v: unknown): unknown[] | null {
  if (Array.isArray(v)) return v;
  if (isObj(v)) {
    for (const k of LIST_KEYS) if (Array.isArray(v[k])) return v[k] as unknown[];
    if (typeof v.stem === 'string') return [v];
    for (const val of Object.values(v)) if (Array.isArray(val) && val.length && isObj(val[0])) return val;
  }
  return null;
}

/** Finds the list of raw items in a reply. `cutOff` is true when the reply ended inside the list. */
export function extractItems(reply: string): { list: unknown[]; cutOff: boolean } | null {
  const text = normalizeQuotes(String(reply ?? ''));
  const blocks: string[] = [];
  const re = /```[a-zA-Z]*\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) blocks.push(m[1]);
  // An unclosed fence (cut-off reply) still counts.
  const open = /```[a-zA-Z]*\s*([\s\S]*)$/.exec(text);
  if (open && !blocks.length) blocks.push(open[1]);
  for (const body of [...blocks, text]) {
    const start = body.search(/[[{]/);
    if (start < 0) continue;
    const close = matchClose(body, start);
    if (close >= 0) {
      const list = listFrom(tryParse(body.slice(start, close + 1)));
      if (list) return { list, cutOff: false };
    }
    // Cut off or damaged: look for the items array and keep every complete object in it.
    const key = /"(?:items|questions|data|results)"\s*:\s*\[/.exec(body);
    const arrStart = key ? key.index + key[0].length - 1 : body[start] === '[' ? start : -1;
    if (arrStart >= 0) {
      const list = salvageObjects(body, arrStart);
      if (list.length) return { list, cutOff: close < 0 };
    }
  }
  return null;
}

// ---------- mapping ----------

const AREA_WORDS: Record<string, Area> = { any: 'GEN', gen: 'GEN', general: 'GEN', np1: 'NP1', np2: 'NP2', np3: 'NP3', np4: 'NP4', np5: 'NP5' };

function toArea(x: unknown, fallback: Area): Area {
  const k = str(x).toLowerCase().replace(/[\s_-]/g, '');
  return AREA_WORDS[k] ?? fallback;
}

function toDifficulty(x: unknown, fallback: Difficulty): Difficulty {
  const n = Math.round(Number(x));
  return n >= 1 && n <= 5 ? (n as Difficulty) : fallback;
}

function toBloom(x: unknown): Bloom | undefined {
  const s = str(x).toLowerCase();
  if (s === 'recall' || s === 'remember') return 'recall';
  if (s === 'apply' || s === 'application' || s === 'understand') return 'apply';
  if (s === 'judgment' || s === 'judgement' || s === 'analyze' || s === 'analyse' || s === 'evaluate') return 'judgment';
  return undefined;
}

/** Accepts [1], 1, "B", "A, C", [ "A" ] and turns them into zero-based indexes. */
function toAnswer(x: unknown): number[] {
  const one = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isInteger(v)) return v;
    const s = str(v);
    if (/^\d+$/.test(s)) return Number(s);
    const m = /^\(?([A-Fa-f])\)?[.)]?$/.exec(s);
    return m ? m[1].toUpperCase().charCodeAt(0) - 65 : null;
  };
  const parts = Array.isArray(x) ? x : typeof x === 'string' ? x.split(/[,;\s]+/).filter(Boolean) : x === undefined ? [] : [x];
  return parts.map(one).filter((n): n is number => n !== null);
}

const FORMAT_OK = new Set(['except', 'statement', 'sequence', 'calc']);

/** Builds one candidate BankItem (not yet validated) from a raw reply object. */
export function mapRawItem(raw: unknown, source: ItemSource, d: NonNullable<ParseBankOptions['defaults']>): BankItem | null {
  if (!isObj(raw)) return null;
  const options = strArr(raw.options ?? raw.choices);
  const answer = toAnswer(raw.answer ?? raw.answerIndex);
  const rows = raw.rows !== undefined ? strArr(raw.rows) : undefined;
  const columns = raw.columns !== undefined ? strArr(raw.columns) : undefined;
  const blanks = Array.isArray(raw.blanks)
    ? raw.blanks.map((b) => ({ choices: strArr(isObj(b) ? b.choices : []), answer: isObj(b) && typeof b.answer === 'number' ? b.answer : -1 }))
    : undefined;
  const typeRaw = str(raw.type).toLowerCase();
  let type: ItemType;
  if (isItemType(typeRaw)) type = typeRaw;
  else if (rows) type = 'matrix';
  else if (blanks) type = 'cloze';
  else type = answer.length > 1 ? 'sata' : 'single';

  const vignette = str(raw.vignette);
  const stem = str(raw.stem ?? raw.question);
  const format = str(raw.format).toLowerCase();
  const clusterLabel = str(raw.clusterId);
  const item: BankItem = {
    id: `u-${hash8(`${vignette}|${stem}|${options.join('|')}|${(rows ?? []).join('|')}`)}`,
    v: 2,
    type,
    area: toArea(raw.area, d.area ?? 'GEN'),
    topic: str(raw.topic) || d.topic || '',
    vignette,
    stem,
    options,
    answer,
    rationale: str(raw.rationale),
    optionRationales: strArr(raw.optionRationales),
    strategy: str(raw.strategy),
    difficulty: toDifficulty(raw.difficulty, d.difficulty ?? 3),
    source,
    review: 'unreviewed',
    aiWritten: true,
  };
  if (FORMAT_OK.has(format) && type === 'single') item.format = format as BankItem['format'];
  if (d.noteId) item.noteId = d.noteId;
  const bloom = toBloom(raw.bloom);
  if (bloom) item.bloom = bloom;
  const keyFacts = strArr(raw.keyFacts).filter(Boolean);
  if (keyFacts.length) item.keyFacts = keyFacts;
  if (typeof raw.beyondNotes === 'boolean') item.beyondNotes = raw.beyondNotes;
  if (rows) item.rows = rows;
  if (columns) item.columns = columns;
  if (Array.isArray(raw.rowAnswer)) item.rowAnswer = (raw.rowAnswer as unknown[]).map(Number);
  if (blanks) item.blanks = blanks;
  if (clusterLabel) {
    item.clusterId = clusterLabel;
    const seq = Number(raw.clusterSeq);
    if (Number.isInteger(seq) && seq > 0) item.clusterSeq = seq;
  }
  return item;
}

const titleOf = (raw: unknown, i: number): string => {
  const o = isObj(raw) ? raw : {};
  const s = str(o.stem) || str(o.question) || str(o.topic);
  return `${i + 1}. ${s ? s.slice(0, 70) : 'unreadable item'}`;
};

/** Gives case-set items a stable cluster id that is the same for every item of that case and unique across replies. */
function assignClusters(items: { item: BankItem | null }[]): void {
  const firstVignette = new Map<string, string>();
  const seqs = new Map<string, number>();
  for (const { item } of items) {
    if (!item?.clusterId) continue;
    if (!firstVignette.has(item.clusterId)) firstVignette.set(item.clusterId, item.vignette);
  }
  for (const { item } of items) {
    if (!item?.clusterId) continue;
    const label = item.clusterId;
    item.clusterId = `uc-${hash8(`${label}|${firstVignette.get(label) ?? ''}`)}`;
    const n = (seqs.get(label) ?? 0) + 1;
    seqs.set(label, n);
    if (item.clusterSeq === undefined) item.clusterSeq = n;
  }
}

/** Parse, map, validate and de-duplicate a reply. Never throws. */
export function parseBank(reply: string, opts: ParseBankOptions = {}): ParseBankResult {
  const out: ParseBankResult = { valid: [], rejected: [], warnings: [], notes: [] };
  try {
    const found = extractItems(reply);
    if (!found) {
      out.notes.push('No JSON list of questions was found in that reply. Copy the whole reply, or ask the AI to answer with JSON only.');
      return out;
    }
    if (found.cutOff) out.notes.push('The reply looks cut off. Complete questions were kept; ask the AI to continue for the rest.');
    const source = opts.source ?? 'user-paste';
    const defaults = opts.defaults ?? {};
    const mapped = found.list.map((raw, index) => ({ raw, index, item: mapRawItem(raw, source, defaults) }));
    assignClusters(mapped);

    const existing = opts.existing ?? [];
    const existingIds = new Set(existing.map((e) => e.id));
    const exGrams = existing.map((e) => ({ id: e.id, cluster: e.clusterId, g: trigrams(stemKey(e)) }));
    const kept: { id: string; cluster?: string; g: Set<string> }[] = [];

    for (const { raw, index, item } of mapped) {
      if (!item) {
        out.rejected.push({ index, errors: ['not a question object'], title: titleOf(raw, index) });
        continue;
      }
      const v = validateItem(item);
      const errors = [...v.errors];
      if (v.ok) {
        const g = trigrams(stemKey(item));
        const dupOf =
          kept.find((k) => k.id === item.id || (!(item.clusterId && k.cluster === item.clusterId) && jaccard(g, k.g) > NEAR_DUPLICATE_JACCARD)) ??
          exGrams.find((k) => k.id === item.id || (!(item.clusterId && k.cluster === item.clusterId) && jaccard(g, k.g) > NEAR_DUPLICATE_JACCARD));
        if (dupOf) errors.push(`near-duplicate of ${dupOf.id}${existingIds.has(dupOf.id) ? ' (already in your bank)' : ' (earlier in this reply)'}`);
        else kept.push({ id: item.id, cluster: item.clusterId, g });
      }
      if (errors.length) out.rejected.push({ index, errors, title: titleOf(raw, index) });
      else {
        out.valid.push(item);
        out.warnings.push(v.warnings);
      }
    }

    const singles = out.valid.filter((i) => i.type === 'single');
    if (singles.length >= 5) {
      const counts = [0, 0, 0, 0];
      for (const s of singles) if (s.answer[0] >= 0 && s.answer[0] < 4) counts[s.answer[0]]++;
      const top = Math.max(...counts);
      if (top / singles.length > 0.6) out.notes.push(`Most correct answers sit in position ${'ABCD'[counts.indexOf(top)]}. Ask for a better spread next time.`);
    }
    const sizes = new Map<string, number>();
    for (const i of out.valid) if (i.clusterId) sizes.set(i.clusterId, (sizes.get(i.clusterId) ?? 0) + 1);
    if ([...sizes.values()].some((n) => n < 3)) out.notes.push('A case set has fewer than 3 valid questions left; it will still be saved.');
  } catch (e) {
    out.notes.push(`Could not read that reply: ${e instanceof Error ? e.message : 'unknown problem'}.`);
  }
  return out;
}
