/**
 * Bank validator (MASTER_PLAN section 6, gate 1). Pure functions, no I/O.
 * validateItem: per-item rules. validateFile: item rules plus file-level gates.
 * validateBank: cross-file gates (unique ids, near-duplicate stems).
 */
import {
  CLOZE_MIN_CHOICES,
  HIGHLIGHT_MIN_OPTIONS,
  KEY_SHARE_MAX,
  KEY_SHARE_MIN,
  KEY_SPREAD_MIN_ITEMS,
  LONGEST_CORRECT_MAX_SHARE,
  MATRIX_MAX_COLUMNS,
  MATRIX_MIN_COLUMNS,
  MATRIX_MIN_ROWS,
  MAX_OPTION_LENGTH_RATIO,
  MIN_RATIONALE_CHARS,
  NEAR_DUPLICATE_JACCARD,
  SATA_MAX_OPTIONS,
  SATA_MIN_ANSWERS,
  SATA_MIN_OPTIONS,
  SINGLE_OPTION_COUNT,
  isArea,
  isCaseOnlyType,
  isDifficulty,
  isFormat,
  isItemType,
  isReviewLevel,
  isSource,
} from './schema';
import type { BankItem } from './schema';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface DuplicatePair {
  a: string;
  b: string;
  score: number;
}

export interface BankValidationResult extends ValidationResult {
  duplicatePairs: DuplicatePair[];
}

/** Longest-is-correct rule only counts files with at least this many single items (avoids noise on tiny fixtures). */
export const LONGEST_RULE_MIN_ITEMS = 10;

const norm = (s: unknown): string => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const isNonEmpty = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0;
const isIntIn = (n: unknown, lo: number, hiExclusive: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= lo && n < hiExclusive;

/** True for "all of the above", "none of the above", "both A and B" style options. */
export function isBannedOption(text: string): boolean {
  const t = norm(text).replace(/[.!"'`]/g, '').trim();
  return (
    /^(all|none) of (the|these) (above|following)\b/.test(t) ||
    /^(all|none) of (them|these|those)$/.test(t) ||
    /^(a|b|c|d|e|f) ?(and|&) ?(a|b|c|d|e|f)$/.test(t) ||
    /^both [a-f] and [a-f]\b/.test(t)
  );
}

function numbersIn(s: string): string[] {
  return (s.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(parseFloat(n)));
}

function checkOptionBasics(item: BankItem, errors: string[], warnings: string[]): void {
  const opts = item.options;
  for (let i = 0; i < opts.length; i++) {
    if (!isNonEmpty(opts[i])) errors.push(`option ${i} is empty`);
    else if (isBannedOption(opts[i])) errors.push(`option ${i} is a banned all/none/both-style option: "${opts[i]}"`);
  }
  const seen = new Set<string>();
  for (const o of opts) {
    const k = norm(o);
    if (k && seen.has(k)) {
      errors.push(`duplicate option text: "${o}"`);
      break;
    }
    seen.add(k);
  }
  if (item.type === 'single' || item.type === 'sata') {
    if (!Array.isArray(item.optionRationales) || item.optionRationales.length !== opts.length) {
      errors.push(
        `optionRationales count ${Array.isArray(item.optionRationales) ? item.optionRationales.length : 'missing'} must equal options count ${opts.length}`,
      );
    } else if (item.optionRationales.some((r) => !isNonEmpty(r))) {
      warnings.push('some optionRationales entries are empty');
    }
  }
  if (item.type === 'single') {
    const lens = opts.map((o) => String(o).trim().length).filter((n) => n > 0);
    if (lens.length >= 2) {
      const ratio = Math.max(...lens) / Math.min(...lens);
      if (ratio > MAX_OPTION_LENGTH_RATIO) {
        errors.push(`option length ratio ${ratio.toFixed(1)} exceeds ${MAX_OPTION_LENGTH_RATIO}x`);
      }
    }
  }
}

function checkTypeShape(item: BankItem, errors: string[], warnings: string[]): void {
  const { type, options, answer } = item;
  if (!Array.isArray(options)) {
    errors.push('options must be an array');
    return;
  }
  if (!Array.isArray(answer)) {
    errors.push('answer must be an array');
    return;
  }
  if (type === 'single') {
    if (options.length !== SINGLE_OPTION_COUNT) errors.push(`single needs ${SINGLE_OPTION_COUNT} options, has ${options.length}`);
    if (answer.length !== 1) errors.push(`single answer must have exactly 1 index, has ${answer.length}`);
    else if (!isIntIn(answer[0], 0, options.length)) errors.push(`single answer index ${answer[0]} out of range`);
  } else if (type === 'sata') {
    if (options.length < SATA_MIN_OPTIONS || options.length > SATA_MAX_OPTIONS) {
      errors.push(`sata needs ${SATA_MIN_OPTIONS}-${SATA_MAX_OPTIONS} options, has ${options.length}`);
    }
    if (answer.length < SATA_MIN_ANSWERS) errors.push(`sata needs at least ${SATA_MIN_ANSWERS} correct indexes`);
    if (answer.some((a) => !isIntIn(a, 0, options.length))) errors.push('sata answer index out of range');
    if (new Set(answer).size !== answer.length) errors.push('sata answer has duplicate indexes');
    if (answer.length >= options.length) errors.push('sata cannot mark every option correct');
  } else if (type === 'highlight') {
    if (options.length < HIGHLIGHT_MIN_OPTIONS) errors.push(`highlight needs at least ${HIGHLIGHT_MIN_OPTIONS} segments`);
    if (answer.length < 1) errors.push('highlight needs at least 1 correct segment');
    if (answer.some((a) => !isIntIn(a, 0, options.length))) errors.push('highlight answer index out of range');
    if (new Set(answer).size !== answer.length) errors.push('highlight answer has duplicate indexes');
    if (answer.length >= options.length) errors.push('highlight cannot mark every segment correct');
  } else if (type === 'matrix') {
    const { rows, columns, rowAnswer } = item;
    if (!Array.isArray(rows) || rows.length < MATRIX_MIN_ROWS) errors.push(`matrix needs at least ${MATRIX_MIN_ROWS} rows`);
    if (!Array.isArray(columns) || columns.length < MATRIX_MIN_COLUMNS || columns.length > MATRIX_MAX_COLUMNS) {
      errors.push(`matrix needs ${MATRIX_MIN_COLUMNS}-${MATRIX_MAX_COLUMNS} columns`);
    }
    if (!Array.isArray(rowAnswer) || !Array.isArray(rows) || rowAnswer.length !== rows.length) {
      errors.push('matrix rowAnswer must have one entry per row');
    } else if (Array.isArray(columns) && rowAnswer.some((c) => !isIntIn(c, 0, columns.length))) {
      errors.push('matrix rowAnswer column index out of range');
    }
    if (Array.isArray(rows) && rows.some((r) => !isNonEmpty(r))) errors.push('matrix has an empty row');
    if (Array.isArray(columns) && columns.some((c) => !isNonEmpty(c))) errors.push('matrix has an empty column');
    if (options.length || answer.length) warnings.push('matrix should leave options and answer empty');
  } else if (type === 'cloze') {
    const { blanks } = item;
    if (!Array.isArray(blanks) || blanks.length < 1) errors.push('cloze needs at least 1 blank');
    else {
      blanks.forEach((b, i) => {
        if (!b || !Array.isArray(b.choices) || b.choices.length < CLOZE_MIN_CHOICES) {
          errors.push(`cloze blank ${i} needs at least ${CLOZE_MIN_CHOICES} choices`);
        } else {
          if (!isIntIn(b.answer, 0, b.choices.length)) errors.push(`cloze blank ${i} answer out of range`);
          if (b.choices.some((c) => !isNonEmpty(c))) errors.push(`cloze blank ${i} has an empty choice`);
          if (new Set(b.choices.map(norm)).size !== b.choices.length) errors.push(`cloze blank ${i} has duplicate choices`);
        }
      });
    }
    if (options.length || answer.length) warnings.push('cloze should leave options and answer empty');
  }
}

/** Per-item rules for all five types. */
export function validateItem(item: BankItem): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const it = item as Partial<BankItem> | null;
  if (!it || typeof it !== 'object') return { ok: false, errors: ['item is not an object'], warnings };

  if (!isNonEmpty(it.id)) errors.push('id is required');
  if (it.v !== 2) errors.push('v must be 2');
  if (!isItemType(it.type)) {
    errors.push(`unknown type "${String(it.type)}"`);
    return { ok: false, errors, warnings };
  }
  if (!isArea(it.area)) errors.push(`area "${String(it.area)}" is not NP1..NP5 or GEN`);
  if (it.format !== undefined && !isFormat(it.format)) errors.push(`unknown format "${String(it.format)}"`);
  if (it.format && it.format !== 'standard' && it.type !== 'single') errors.push('format applies to single items only');
  if (!isNonEmpty(it.topic)) errors.push('topic is required');
  if (typeof it.vignette !== 'string') errors.push('vignette must be a string (may be empty)');
  if (!isNonEmpty(it.stem)) errors.push('stem is required');
  if (!isDifficulty(it.difficulty)) errors.push('difficulty must be 1..5');
  if (!isSource(it.source)) errors.push(`unknown source "${String(it.source)}"`);
  if (!isReviewLevel(it.review)) errors.push(`unknown review "${String(it.review)}"`);
  if (typeof it.aiWritten !== 'boolean') errors.push('aiWritten must be boolean');
  if (!isNonEmpty(it.strategy)) errors.push('strategy is required');
  if (!isNonEmpty(it.rationale)) errors.push('rationale is required');
  else if (it.rationale.trim().length < MIN_RATIONALE_CHARS) {
    errors.push(`rationale shorter than ${MIN_RATIONALE_CHARS} chars`);
  }
  if (it.clusterId !== undefined && !isNonEmpty(it.clusterId)) errors.push('clusterId must be non-empty when present');
  if (it.clusterId && it.clusterSeq === undefined) warnings.push('clusterId set without clusterSeq');
  if (it.clusterSeq !== undefined && !it.clusterId) errors.push('clusterSeq set without clusterId');
  if (isCaseOnlyType(it.type) && !it.clusterId) warnings.push(`${it.type} items belong inside a case set (no clusterId)`);
  if (it.type === 'sata' && it.format) warnings.push('sata with a format tag is unusual');

  const full = it as BankItem;
  if (!Array.isArray(full.options)) {
    errors.push('options must be an array');
    return { ok: false, errors, warnings };
  }
  checkTypeShape(full, errors, warnings);
  if (Array.isArray(full.options) && full.options.length) checkOptionBasics(full, errors, warnings);

  if (it.format === 'calc' && isNonEmpty(it.rationale)) {
    const allowed = new Set(
      numbersIn(`${it.vignette ?? ''} ${it.stem ?? ''} ${full.options.join(' ')}`),
    );
    const missing = [...new Set(numbersIn(it.rationale))].filter((n) => !allowed.has(n));
    if (missing.length) {
      errors.push(`calc rationale uses numbers not in vignette/stem/options: ${missing.join(', ')}`);
    }
  }
  if (!Array.isArray(it.keyFacts) || it.keyFacts.length === 0) warnings.push('keyFacts missing');
  return { ok: errors.length === 0, errors, warnings };
}

/** Normalised key used for duplicate-stem detection. */
export function stemKey(item: BankItem): string {
  return norm(`${item.vignette ?? ''} ${item.stem ?? ''}`);
}

/** Word trigram shingles of a normalised text. */
export function trigrams(text: string): Set<string> {
  const words = norm(text).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean);
  const out = new Set<string>();
  if (words.length < 3) {
    if (words.length) out.add(words.join(' '));
    return out;
  }
  for (let i = 0; i + 2 < words.length; i++) out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (big.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** File-level gates plus every item's own rules (errors are prefixed with the item id). */
export function validateFile(items: BankItem[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(items)) return { ok: false, errors: ['file must be an array of items'], warnings };

  const ids = new Set<string>();
  const stems = new Map<string, string>();
  for (const item of items) {
    const label = item && typeof item === 'object' && isNonEmpty(item.id) ? item.id : '(no id)';
    const r = validateItem(item);
    r.errors.forEach((e) => errors.push(`${label}: ${e}`));
    r.warnings.forEach((w) => warnings.push(`${label}: ${w}`));
    if (!item || typeof item !== 'object') continue;
    if (isNonEmpty(item.id)) {
      if (ids.has(item.id)) errors.push(`${label}: duplicate id in file`);
      ids.add(item.id);
    }
    const key = stemKey(item);
    if (key) {
      const prev = stems.get(key);
      if (prev !== undefined) errors.push(`${label}: duplicate stem of ${prev}`);
      else stems.set(key, label);
    }
  }

  const singles = items.filter(
    (i) => i && i.type === 'single' && Array.isArray(i.options) && Array.isArray(i.answer) && i.answer.length === 1,
  );
  if (singles.length >= LONGEST_RULE_MIN_ITEMS) {
    let longest = 0;
    for (const s of singles) {
      const lens = s.options.map((o) => String(o).length);
      const max = Math.max(...lens);
      if (lens[s.answer[0]] === max && lens.filter((l) => l === max).length === 1) longest++;
    }
    const share = longest / singles.length;
    if (share > LONGEST_CORRECT_MAX_SHARE) {
      errors.push(
        `correct option is strictly the longest in ${(share * 100).toFixed(0)}% of single items (max ${LONGEST_CORRECT_MAX_SHARE * 100}%)`,
      );
    }
  }
  if (singles.length >= KEY_SPREAD_MIN_ITEMS) {
    const counts = [0, 0, 0, 0];
    for (const s of singles) if (s.answer[0] >= 0 && s.answer[0] < 4) counts[s.answer[0]]++;
    counts.forEach((c, i) => {
      const share = c / singles.length;
      if (share < KEY_SHARE_MIN || share > KEY_SHARE_MAX) {
        errors.push(
          `key position ${'ABCD'[i]} share ${(share * 100).toFixed(0)}% outside ${KEY_SHARE_MIN * 100}-${KEY_SHARE_MAX * 100}%`,
        );
      }
    });
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Cross-file gates: unique ids and near-duplicate stems (word-trigram Jaccard above the threshold). */
export function validateBank(allItems: BankItem[], threshold: number = NEAR_DUPLICATE_JACCARD): BankValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const duplicatePairs: DuplicatePair[] = [];
  const seen = new Set<string>();
  for (const it of allItems) {
    if (seen.has(it.id)) errors.push(`duplicate id across bank: ${it.id}`);
    seen.add(it.id);
  }
  const sets = allItems.map((it) => trigrams(stemKey(it)));
  const postings = new Map<string, number[]>();
  for (let i = 0; i < allItems.length; i++) {
    const candidates = new Set<number>();
    for (const g of sets[i]) {
      const list = postings.get(g);
      if (list) for (const j of list) candidates.add(j);
    }
    for (const j of candidates) {
      const a = allItems[i];
      const b = allItems[j];
      if (a.id === b.id) continue;
      if (a.clusterId && a.clusterId === b.clusterId) continue; // case-set items share a vignette on purpose
      const score = jaccard(sets[i], sets[j]);
      if (score > threshold) {
        duplicatePairs.push({ a: b.id, b: a.id, score: Math.round(score * 1000) / 1000 });
        errors.push(`near-duplicate stems ${b.id} / ${a.id} (Jaccard ${score.toFixed(2)})`);
      }
    }
    for (const g of sets[i]) {
      const list = postings.get(g);
      if (list) list.push(i);
      else postings.set(g, [i]);
    }
  }
  return { ok: errors.length === 0, errors, warnings, duplicatePairs };
}
