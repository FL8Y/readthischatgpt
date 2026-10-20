/**
 * Reads a file or pasted text and turns it into validated BankItems. Pure: no I/O. Never throws.
 * Accepts (1) the FLY8-BANK text export, (2) a plain .json array (or {"items":[...]}) of full v2 items, and
 * (3) anything the paste-reply reader understands (an AI reply). Every item goes through validateItem;
 * duplicates are caught by id and by near-duplicate stem against the bank and earlier items in the same file.
 */
import { NEAR_DUPLICATE_JACCARD } from './schema';
import type { BankItem } from './schema';
import { jaccard, stemKey, trigrams, validateItem } from './validate';
import { parseBank, stripTrailingCommas, type ParseBankOptions, type ParseBankResult } from '../pnle/parseBank';
import { decodeBank } from './exportBank';

export interface ImportOptions {
  existing?: readonly BankItem[];
  /** Used by the paste-reply reader when the AI leaves a field out. */
  defaults?: ParseBankOptions['defaults'];
}
export interface ImportResult extends ParseBankResult {
  format: 'fly8-bank' | 'json-items' | 'reply' | 'unknown';
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);
const isFullItem = (x: unknown): boolean => isObj(x) && x.v === 2 && typeof x.id === 'string' && x.id !== '';

function tryJsonList(text: string): unknown[] | null {
  const t = text.trim().replace(/^﻿/, '');
  if (!t.startsWith('[') && !t.startsWith('{')) return null;
  try {
    const j: unknown = JSON.parse(stripTrailingCommas(t));
    if (Array.isArray(j)) return j;
    if (isObj(j) && Array.isArray(j.items)) return j.items;
  } catch {
    /* fall through to the paste-reply reader */
  }
  return null;
}

const titleOf = (raw: unknown, i: number): string => {
  const s = isObj(raw) && typeof raw.stem === 'string' ? raw.stem : '';
  return `${i + 1}. ${s ? s.slice(0, 70) : 'unreadable item'}`;
};

/** Validates plain objects as full items; marks them as the user's own so they can live in the user bank. */
function checkFullItems(list: unknown[], opts: ImportOptions, out: ImportResult): void {
  const existing = opts.existing ?? [];
  const ids = new Set(existing.map((e) => e.id));
  const grams = existing.map((e) => ({ id: e.id, cluster: e.clusterId, g: trigrams(stemKey(e)) }));
  list.forEach((raw, index) => {
    if (!isObj(raw)) return void out.rejected.push({ index, errors: ['not a question object'], title: titleOf(raw, index) });
    const item = { ...raw } as unknown as BankItem;
    if (item.source !== 'user-ai' && item.source !== 'user-paste') item.source = 'user-paste';
    let v;
    try {
      v = validateItem(item);
    } catch (e) {
      v = { ok: false, errors: [`validator threw: ${(e as Error).message}`], warnings: [] as string[] };
    }
    const errors = [...v.errors];
    if (typeof item.id !== 'string' || !item.id) errors.push('id is required');
    else if (ids.has(item.id)) errors.push('already in your bank (same id)');
    if (!errors.length) {
      const g = trigrams(stemKey(item));
      const dup = grams.find((k) => !(item.clusterId && k.cluster === item.clusterId) && jaccard(g, k.g) > NEAR_DUPLICATE_JACCARD);
      if (dup) errors.push(`near-duplicate of ${dup.id}`);
      else grams.push({ id: item.id, cluster: item.clusterId, g });
    }
    if (errors.length) return void out.rejected.push({ index, errors, title: titleOf(raw, index) });
    ids.add(item.id);
    out.valid.push(item);
    out.warnings.push(v.warnings);
  });
}

export function importBank(text: string, opts: ImportOptions = {}): ImportResult {
  const out: ImportResult = { valid: [], rejected: [], warnings: [], notes: [], format: 'unknown' };
  try {
    const dec = decodeBank(text);
    if (dec) {
      out.format = 'fly8-bank';
      out.notes.push(...dec.problems);
      checkFullItems(dec.items, opts, out);
      dec.badLines.forEach((line) => out.rejected.push({ index: line - 2, errors: [`line ${line} is not readable`], title: `line ${line}` }));
      return out;
    }
    const list = tryJsonList(text);
    if (list && list.length && list.every(isFullItem)) {
      out.format = 'json-items';
      checkFullItems(list, opts, out);
      return out;
    }
    const r = parseBank(text, { source: 'user-paste', existing: opts.existing, defaults: opts.defaults });
    return { ...r, format: r.valid.length || r.rejected.length ? 'reply' : 'unknown' };
  } catch (e) {
    out.notes.push(`Could not read that file: ${e instanceof Error ? e.message : 'unknown problem'}.`);
    return out;
  }
}
