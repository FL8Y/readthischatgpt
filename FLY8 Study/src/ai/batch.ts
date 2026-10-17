import type { Settings } from '../core/types';
import type { BlueprintItem } from '../core/quiz';

/** Chat apps cut long replies, so manual mode asks for at most this many items per exchange. */
export const MANUAL_PER_PART = 10;

/** Items per exchange: manual mode is capped; API modes make one call (Infinity). */
export function defaultPerPart(settings: Settings): number {
  return settings.provider === 'manual' ? MANUAL_PER_PART : Number.POSITIVE_INFINITY;
}

/** Splits total into balanced part sizes, each <= perPart. splitCount(25, 10) -> [9, 8, 8]. */
export function splitCount(total: number, perPart: number): number[] {
  const t = Math.floor(total);
  if (!Number.isFinite(t) || t <= 0) return [];
  if (!Number.isFinite(perPart) || perPart < 1 || t <= perPart) return [t];
  const parts = Math.ceil(t / Math.floor(perPart));
  const base = Math.floor(t / parts);
  const extra = t % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Splits a module blueprint into per-part sub-blueprints whose sizes match `counts` (fills in order). */
export function splitBlueprint(plan: BlueprintItem[], counts: number[]): BlueprintItem[][] {
  const left = plan.map((b) => ({ ...b }));
  let i = 0;
  return counts.map((n) => {
    const out: BlueprintItem[] = [];
    let need = n;
    while (need > 0 && i < left.length) {
      const take = Math.min(need, left[i].count);
      if (take > 0) out.push({ ...left[i], count: take });
      left[i].count -= take;
      need -= take;
      if (left[i].count === 0) i++;
    }
    return out;
  });
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export interface PartContext {
  /** 0-based part index. */
  index: number;
  parts: number;
  /** Text for ManualOptions.purpose, e.g. "Diagnostic - Part 2 of 4". */
  purpose: string;
  /** Stems already collected; ask() may add them to the prompt as "do not repeat". */
  avoid: string[];
}

export interface PartsResult<T> {
  items: T[];
  partsDone: number;
  parts: number;
  /** Set when a later part failed; items from earlier parts are kept. */
  error?: string;
}

/**
 * Asks for `total` items in parts of at most `perPart`, merging and de-duplicating by normalized stem.
 * Failure policy: if a part fails after at least one part produced items, the earlier items are returned
 * with `error` set (the caller decides whether to use them). If nothing was collected, the error is thrown.
 * Parts run one at a time; no automatic retries.
 */
export async function generateInParts<T extends object>(args: {
  total: number;
  perPart: number;
  label: string;
  ask: (count: number, ctx: PartContext) => Promise<string>;
  parse: (raw: string, ctx: PartContext) => T[];
  /** Dedupe key; defaults to the item's `stem` (or its JSON when it has none). */
  key?: (item: T) => string;
}): Promise<PartsResult<T>> {
  const counts = splitCount(args.total, args.perPart);
  const keyOf = args.key ?? ((t: T) => (typeof (t as { stem?: unknown }).stem === 'string' ? (t as { stem: string }).stem : JSON.stringify(t)));
  const items: T[] = [];
  const seen = new Set<string>();
  let done = 0;
  for (let index = 0; index < counts.length; index++) {
    const ctx: PartContext = {
      index,
      parts: counts.length,
      purpose: counts.length > 1 ? `${args.label} - Part ${index + 1} of ${counts.length}` : args.label,
      avoid: items.map(keyOf),
    };
    try {
      const got = args.parse(await args.ask(counts[index], ctx), ctx);
      for (const it of got) {
        const k = norm(keyOf(it));
        if (k && seen.has(k)) continue;
        seen.add(k);
        items.push(it);
      }
      done++;
    } catch (e) {
      if (!items.length) throw e;
      return { items, partsDone: done, parts: counts.length, error: e instanceof Error ? e.message : 'A later part failed.' };
    }
  }
  return { items, partsDone: done, parts: counts.length };
}

/** Appends a "do not repeat" note for later parts. */
export function withAvoid<R extends { user: string }>(req: R, avoid: string[]): R {
  if (!avoid.length) return req;
  const list = avoid.slice(-30).map((s) => `- ${s.slice(0, 120)}`).join('\n');
  return { ...req, user: `${req.user}\n\nQuestions already written in earlier parts (do not repeat or rephrase these):\n${list}` };
}
