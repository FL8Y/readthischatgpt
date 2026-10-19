import type { Area, BankItem, Difficulty } from './schema';
import {
  Picker, accuracyBy, latestByItem, makeRng, makeSelection, shuffled, smartSet, type KeyStat,
} from './curate';
import type { AttemptRecord, CustomFilter, Selection } from './types2';
import { ClusterPicker, pickCaseSets } from '../ui/practice/caseLogic';

/** Everything a selector needs, as plain data. Same seed + same data = same ids. */
export interface SelectContext {
  items: readonly BankItem[];
  attempts: readonly AttemptRecord[];
  seed: number | string;
  /** Item ids the learner flagged (for the 'flagged' custom filter). */
  flaggedIds?: readonly string[];
}

export const DIAGNOSTIC_AREAS: readonly Area[] = ['NP1', 'NP2', 'NP3', 'NP4', 'NP5'];
export const DIAGNOSTIC_PER_AREA = 5;

export function quick(ctx: SelectContext, n: number): Selection {
  const picker = new ClusterPicker(n, ctx.items);
  picker.add(shuffled(ctx.items, makeRng(ctx.seed)));
  return picker.selection();
}

export interface CustomOptions {
  areas?: readonly Area[];
  /** Bundle ids: matched exactly against item.topicId. */
  bundles?: readonly string[];
  topics?: readonly string[];
  count: number;
  difficultyBand?: [Difficulty, Difficulty];
  filters?: readonly CustomFilter[];
}

export function custom(ctx: SelectContext, o: CustomOptions): Selection {
  const latest = latestByItem(ctx.attempts);
  const flagged = new Set(ctx.flaggedIds ?? []);
  const wantTopic = o.topics?.length ? new Set(o.topics) : null;
  const wantBundle = o.bundles?.length ? new Set(o.bundles) : null;
  const wantArea = o.areas?.length ? new Set<Area>(o.areas) : null;
  const filters = new Set(o.filters ?? []);
  const pool = ctx.items.filter((i) => {
    if (wantArea && !wantArea.has(i.area)) return false;
    if (wantBundle && !(i.topicId && wantBundle.has(i.topicId))) return false;
    if (wantTopic && !wantTopic.has(i.topic)) return false;
    if (o.difficultyBand && (i.difficulty < o.difficultyBand[0] || i.difficulty > o.difficultyBand[1])) return false;
    const last = latest.get(i.id);
    if (filters.has('unseen') && last) return false;
    if (filters.has('missed') && !(last && last.credit < 1)) return false;
    if (filters.has('flagged') && !flagged.has(i.id)) return false;
    return true;
  });
  const picker = new ClusterPicker(o.count, ctx.items);
  picker.add(shuffled(pool, makeRng(ctx.seed)));
  return picker.selection();
}

/**
 * Diagnostic: 5 items per NP area (25 total) spread across the difficulty range, no repeats.
 * Prefers items the learner has not seen; a thin area returns what it has and sets `short`.
 */
export function diagnostic(ctx: SelectContext): Selection {
  const rng = makeRng(ctx.seed);
  const seen = new Set(ctx.attempts.map((a) => a.itemId));
  const ids: string[] = [];
  for (const area of DIAGNOSTIC_AREAS) {
    const inArea = ctx.items.filter((i) => i.area === area);
    const fresh = inArea.filter((i) => !seen.has(i.id));
    const pool = fresh.length >= DIAGNOSTIC_PER_AREA ? fresh : inArea;
    // Shuffle first so ties in difficulty break by seed, then stable-sort by difficulty.
    const sorted = shuffled(pool, rng).sort((a, b) => a.difficulty - b.difficulty);
    if (sorted.length <= DIAGNOSTIC_PER_AREA) { ids.push(...sorted.map((i) => i.id)); continue; }
    for (let k = 0; k < DIAGNOSTIC_PER_AREA; k++) {
      ids.push(sorted[Math.round((k * (sorted.length - 1)) / (DIAGNOSTIC_PER_AREA - 1))].id);
    }
  }
  const unique = [...new Set(ids)];
  return makeSelection(shuffled(unique, rng), DIAGNOSTIC_AREAS.length * DIAGNOSTIC_PER_AREA);
}

/** Mock board for one area. Short mock (all available) when the area has fewer than `count`. */
export function mock(ctx: SelectContext, area: Area, count: number): Selection {
  const pool = ctx.items.filter((i) => i.area === area);
  const picker = new ClusterPicker(count, ctx.items);
  picker.add(shuffled(pool, makeRng(ctx.seed)));
  return picker.selection();
}

/** Weak-spot set: items from topics and strategy tags with the lowest recent accuracy. */
export function weak(ctx: SelectContext, n: number): Selection {
  const rng = makeRng(ctx.seed);
  const topicAcc = accuracyBy(ctx.attempts, (a) => a.topic);
  const stratAcc = accuracyBy(ctx.attempts, (a) => a.strategy);
  const latest = latestByItem(ctx.attempts);
  const miss = (m: Map<string, KeyStat>, k: string) => (m.has(k) ? 1 - (m.get(k) as KeyStat).accuracy : 0);
  const scored = ctx.items.map((i) => {
    const last = latest.get(i.id);
    // Topic weakness counts most; strategy weakness next; an item missed last time gets a bump.
    const score = miss(topicAcc, i.topic) * 0.6 + miss(stratAcc, i.strategy) * 0.3 + (last && last.credit < 1 ? 0.1 : 0);
    return { i, score, jitter: rng() };
  });
  const evidence = scored.filter((s) => s.score > 0);
  evidence.sort((a, b) => b.score - a.score || a.jitter - b.jitter);
  const picker = new Picker(n);
  picker.add(evidence.map((s) => s.i));
  return picker.selection();
}

/** Re-queue session: exactly the due ids that still exist in the bank, original order, no repeats. */
export function requeue(ctx: SelectContext, dueIds: readonly string[]): Selection {
  const have = new Set(ctx.items.map((i) => i.id));
  const ids = [...new Set(dueIds)].filter((id) => have.has(id));
  return makeSelection(ids, new Set(dueIds).size);
}

/** Case-study mode: whole case sets only (never split). */
export function caseStudy(ctx: SelectContext, sets: number): Selection {
  return pickCaseSets(ctx.items, sets, ctx.seed);
}

/** Smart set (local curation). Logic lives in curate.ts. */
export function smart(ctx: SelectContext, n: number): Selection {
  return smartSet({ items: ctx.items, attempts: ctx.attempts, seed: ctx.seed }, n);
}
