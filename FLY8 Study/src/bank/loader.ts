import goldJson from '../../data/bank/gold.v2.json';
import bundlesJson from '../../data/presets/bundles.json';
import { PACKS } from './packs.generated';
import type { Area, BankItem } from './schema';
import { validateItem } from './validate';

/** One named list of candidate items (a bundled file, or the user's saved items). */
export interface BankSource {
  name: string;
  items: unknown;
  /** User items may replace an earlier item with the same id. */
  user?: boolean;
}

export interface RejectedItem {
  id: string;
  source: string;
  errors: string[];
}

export interface BankCounts {
  total: number;
  rejected: number;
  duplicates: number;
  byArea: Record<string, number>;
  byType: Record<string, number>;
  bySource: Record<string, number>;
}

export interface Bank {
  items: BankItem[];
  byId: Map<string, BankItem>;
  byArea: Map<Area, BankItem[]>;
  byTopic: Map<string, BankItem[]>;
  byBundle: Map<string, BankItem[]>;
  rejected: RejectedItem[];
  /** Ids dropped because an earlier item already used them. */
  duplicateIds: string[];
  counts: BankCounts;
}

interface BundleDef {
  id: string;
  notes: string[];
}

export function noteToBundleMap(bundles: BundleDef[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const b of bundles) for (const n of b.notes) if (!m.has(n)) m.set(n, b.id);
  return m;
}

const isUserSource = (s: BankItem['source']): boolean => s === 'user-ai' || s === 'user-paste';

function push<K>(m: Map<K, BankItem[]>, k: K, it: BankItem): void {
  const arr = m.get(k);
  if (arr) arr.push(it);
  else m.set(k, [it]);
}

/**
 * Validates and merges sources, in order. Invalid items are rejected (never thrown).
 * Duplicate ids: the first wins, except a later item with source 'user-*' replaces an earlier one.
 */
export function buildBank(sources: BankSource[], bundles: BundleDef[] = bundlesJson.bundles): Bank {
  const byId = new Map<string, BankItem>();
  const order: string[] = [];
  const rejected: RejectedItem[] = [];
  const duplicateIds: string[] = [];

  for (const src of sources) {
    if (!Array.isArray(src.items)) continue;
    for (const raw of src.items as unknown[]) {
      let errors: string[] = [];
      try {
        errors = validateItem(raw as BankItem).errors;
      } catch (e) {
        errors = [`validator threw: ${(e as Error).message}`];
      }
      const rawId = (raw as { id?: unknown } | null)?.id;
      const id = typeof rawId === 'string' ? rawId : '';
      if (errors.length || !id) {
        rejected.push({ id, source: src.name, errors: errors.length ? errors : ['id is required'] });
        continue;
      }
      const item = raw as BankItem;
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, item);
        order.push(id);
      } else if (isUserSource(item.source)) {
        byId.set(id, item);
        duplicateIds.push(id);
      } else {
        duplicateIds.push(id);
      }
    }
  }

  const items = order.map((id) => byId.get(id) as BankItem);
  const noteBundle = noteToBundleMap(bundles);
  const byArea = new Map<Area, BankItem[]>();
  const byTopic = new Map<string, BankItem[]>();
  const byBundle = new Map<string, BankItem[]>();
  const counts: BankCounts = {
    total: items.length, rejected: rejected.length, duplicates: duplicateIds.length,
    byArea: {}, byType: {}, bySource: {},
  };
  for (const it of items) {
    push(byArea, it.area, it);
    push(byTopic, it.topicId ?? it.topic, it);
    const b = it.noteId ? noteBundle.get(it.noteId) : undefined;
    if (b) push(byBundle, b, it);
    counts.byArea[it.area] = (counts.byArea[it.area] ?? 0) + 1;
    counts.byType[it.type] = (counts.byType[it.type] ?? 0) + 1;
    counts.bySource[it.source] = (counts.bySource[it.source] ?? 0) + 1;
  }
  return { items, byId, byArea, byTopic, byBundle, rejected, duplicateIds, counts };
}

/** The bundled files in load order: gold first, then every generated pack. */
export function bundledSources(): BankSource[] {
  return [{ name: 'gold.v2.json', items: goldJson }, ...PACKS.map((p) => ({ name: p.name, items: p.items }))];
}

/** Validated union of bundled items plus the user's saved items. Rebuilt by setUserItems. */
export let BANK: Bank = buildBank(bundledSources());

let userItemsNow: unknown[] = [];

/** Rebuild BANK with the user's items (from store.ts). Returns the new bank. */
export function setUserItems(userItems: unknown[]): Bank {
  userItemsNow = userItems;
  BANK = buildBank([...bundledSources(), { name: 'user', items: userItemsNow, user: true }]);
  return BANK;
}

export function getItem(id: string): BankItem | undefined {
  return BANK.byId.get(id);
}

export const itemsByArea = (a: Area): BankItem[] => BANK.byArea.get(a) ?? [];
export const itemsByTopic = (t: string): BankItem[] => BANK.byTopic.get(t) ?? [];
export const itemsByBundle = (b: string): BankItem[] => BANK.byBundle.get(b) ?? [];
export const bankCounts = (): BankCounts => BANK.counts;
