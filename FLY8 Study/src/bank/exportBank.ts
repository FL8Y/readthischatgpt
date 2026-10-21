/**
 * Compact plain-text export of bank questions, for computers (not people). Pure: no I/O.
 *
 * FILE FORMAT "FLY8-BANK v1" (UTF-8 text, one record per line, LF line ends):
 *   line 1        FLY8-BANK v1 count=N
 *   lines 2..N+1  one minified JSON object per question, short keys (see KEY_MAP), defaults omitted
 *   last line     #END n=N sum=XXXXXXXX      (CRC-32 of every earlier line joined with LF, lowercase hex)
 * A missing or wrong #END line means the file was cut off or edited; the importer still keeps the
 * questions that read fine and says so.
 *
 * Omitted when equal to the default: v=2, type "single", source "bank", review "unreviewed", aiWritten true,
 * difficulty 3, and required text/list fields that are empty. Optional fields are omitted only when undefined,
 * so decode(encode(x)) equals x exactly. Unknown extra fields are kept under "_<name>".
 * The "curve-ball" marker is the entry "curveball" inside flags (key "g").
 */
import type { BankItem } from './schema';

export const BANK_MAGIC = 'FLY8-BANK v1';
export const END_PREFIX = '#END';

/** Long field name -> short key. Keep unique; never reuse a key for a different field. */
export const KEY_MAP: Readonly<Record<string, string>> = {
  id: 'i', type: 't', format: 'f', area: 'a', topic: 'p', topicId: 'pi', noteId: 'n', clusterId: 'ci', clusterSeq: 'cs',
  vignette: 'v', stem: 's', options: 'o', answer: 'k', rows: 'r', columns: 'c', rowAnswer: 'ra', blanks: 'b',
  rationale: 'y', rationaleSimple: 'ys', optionRationales: 'or', imageSuggestion: 'im', strategy: 'st', archetype: 'ar',
  difficulty: 'd', bloom: 'bl', keyFacts: 'kf', beyondNotes: 'bn', source: 'so', review: 'rv', aiWritten: 'ai', flags: 'g',
};
const REVERSE: Record<string, string> = Object.fromEntries(Object.entries(KEY_MAP).map(([l, s]) => [s, l]));

/** Fields that must exist on a BankItem; they are dropped when empty and rebuilt on decode. */
const REQUIRED_EMPTY: Record<string, unknown> = { vignette: '', stem: '', options: [], answer: [], rationale: '', optionRationales: [], strategy: '' };
const DEFAULTS: Record<string, unknown> = { v: 2, type: 'single', source: 'bank', review: 'unreviewed', aiWritten: true, difficulty: 3 };

type Obj = Record<string, unknown>;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** CRC-32 of a string's UTF-8 bytes, as 8 lowercase hex digits. */
export function crc32(text: string): string {
  let c: number;
  let crc = 0xffffffff;
  const bytes = new TextEncoder().encode(text);
  for (let i = 0; i < bytes.length; i++) {
    c = (crc ^ bytes[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

/** One item to its compact object (short keys, defaults dropped). */
export function packItem(item: BankItem): Obj {
  const out: Obj = {};
  for (const [k, val] of Object.entries(item as unknown as Obj)) {
    if (val === undefined) continue;
    if (k === 'v') continue;
    if (k in REQUIRED_EMPTY && same(val, REQUIRED_EMPTY[k])) continue;
    if (k in DEFAULTS && val === DEFAULTS[k]) continue;
    out[KEY_MAP[k] ?? `_${k}`] = val;
  }
  return out;
}

/** Inverse of packItem. Returns a plain object; validation is the importer's job. */
export function unpackItem(packed: Obj): Obj {
  const out: Obj = { v: 2 };
  for (const [k, val] of Object.entries(packed)) {
    const long = REVERSE[k] ?? (k.startsWith('_') ? k.slice(1) : k);
    out[long] = val;
  }
  for (const [k, d] of Object.entries(REQUIRED_EMPTY)) if (!(k in out)) out[k] = Array.isArray(d) ? [] : d;
  for (const [k, d] of Object.entries(DEFAULTS)) if (!(k in out)) out[k] = d;
  return out;
}

/** Turns the items into the file text. */
export function encodeBank(items: readonly BankItem[]): string {
  const lines = [`${BANK_MAGIC} count=${items.length}`, ...items.map((i) => JSON.stringify(packItem(i)))];
  const sum = crc32(lines.join('\n'));
  return `${[...lines, `${END_PREFIX} n=${items.length} sum=${sum}`].join('\n')}\n`;
}

export interface DecodeResult {
  /** Plain unvalidated objects, in file order. */
  items: Obj[];
  /** Lines that were not readable JSON objects (1-based line numbers in the file). */
  badLines: number[];
  declaredCount: number | null;
  /** True only when the #END line is present and both its count and checksum match. */
  complete: boolean;
  problems: string[];
}

/** Reads FLY8-BANK text. Never throws. Returns null when the text is not this format. */
export function decodeBank(text: string): DecodeResult | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const head = /^FLY8-BANK v(\d+) count=(\d+)\s*$/.exec((lines[0] ?? '').replace(/^﻿/, ''));
  if (!head) return null;
  const res: DecodeResult = { items: [], badLines: [], declaredCount: Number(head[2]), complete: false, problems: [] };
  if (head[1] !== '1') res.problems.push(`This file is version ${head[1]}; this app reads version 1, so some fields may be missing.`);
  let end = -1;
  for (let i = 1; i < lines.length; i++) if (lines[i].startsWith(END_PREFIX)) end = i;
  const body = end === -1 ? lines.slice(1) : lines.slice(1, end);
  body.forEach((line, k) => {
    if (!line.trim()) return;
    try {
      const o: unknown = JSON.parse(line);
      if (o && typeof o === 'object' && !Array.isArray(o)) res.items.push(unpackItem(o as Obj));
      else res.badLines.push(k + 2);
    } catch {
      res.badLines.push(k + 2);
    }
  });
  if (end === -1) {
    res.problems.push('The end line is missing: the file was cut off. Questions that read fine were kept.');
  } else {
    const m = /^#END n=(\d+) sum=([0-9a-f]{8})\s*$/.exec(lines[end]);
    const sum = crc32(lines.slice(0, end).join('\n'));
    if (!m) res.problems.push('The end line is damaged.');
    else if (m[2] !== sum) res.problems.push('The checksum does not match: the file was changed or damaged after it was exported.');
    else if (Number(m[1]) !== res.items.length + res.badLines.length || res.declaredCount !== Number(m[1])) {
      res.problems.push('The question count does not match the end line.');
    } else res.complete = true;
  }
  if (res.badLines.length) res.problems.push(`${res.badLines.length} line(s) could not be read.`);
  return res;
}

/** Suggested file name, e.g. fly8-questions-20261020-100.txt (date from the clock passed in). */
export function exportFileName(count: number, now: number = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `fly8-questions-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${count}.txt`;
}

export type ExportScope = 'all' | 'mine' | 'topics' | 'generated';

/** Which items an export button covers. `topics` = items whose topic name is ticked. */
export function itemsForExport(
  scope: ExportScope,
  src: { all: readonly BankItem[]; mine: readonly BankItem[]; topics: readonly string[]; generated: readonly BankItem[] },
): BankItem[] {
  if (scope === 'all') return [...src.all];
  if (scope === 'mine') return [...src.mine];
  if (scope === 'generated') return [...src.generated];
  const want = new Set(src.topics.map((t) => t.trim().toLowerCase()));
  return src.all.filter((i) => want.has(i.topic.trim().toLowerCase()));
}
