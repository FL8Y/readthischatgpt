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
  /** Diagnostic weakness profile as miss rates (0..1). Optional: raises matching items in weak(). */
  weakBoost?: WeakBoost;
}

/** Miss rates from the saved diagnostic weakness profile, keyed by subject bundle id and by strategy family key. */
export interface WeakBoost {
  /** Item -> its unit key (subject bundle id, or 'NP1:other'). */
  unitOf: (item: BankItem) => string;
  /** Item -> its strategy family key. */
  familyOf: (item: BankItem) => string;
  units: ReadonlyMap<string, number>;
  strategies: ReadonlyMap<string, number>;
}

/** Owner rule: select-all-that-apply is rare, at most 1 per 10 questions in any normal session. */
export const SATA_PER = 10;
export const sataBudget = (n: number): number => Math.floor(n / SATA_PER);

/** Case-study items (clusterId) belong to Case study mode; general sessions use standalone questions only. */
export const solo = <T extends BankItem>(items: readonly T[]): T[] => items.filter((i) => !i.clusterId);

/** Keeps every non-SATA item and only as many SATA items (first ones in the given order) as the budget allows. */
export function capSata<T extends BankItem>(ordered: readonly T[], n: number): T[] {
  let room = sataBudget(n);
  return ordered.filter((i) => (i.type !== 'sata' ? true : room-- > 0));
}

export const DIAGNOSTIC_AREAS: readonly Area[] = ['NP1', 'NP2', 'NP3', 'NP4', 'NP5'];
export const DIAGNOSTIC_PER_AREA = 5;

export function quick(ctx: SelectContext, n: number): Selection {
  const picker = new ClusterPicker(n, ctx.items);
  picker.add(capSata(shuffled(solo(ctx.items), makeRng(ctx.seed)), n));
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
  const pool = solo(ctx.items).filter((i) => {
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
  picker.add(capSata(shuffled(pool, makeRng(ctx.seed)), o.count));
  return picker.selection();
}

/** Owner rule: the diagnostic is hard on purpose. Of 25 questions, 15 hardest (60%), 8 medium (30%), 2 easy (10%). */
export const DIAGNOSTIC_MIX = { hard: 0.6, medium: 0.3, easy: 0.1 } as const;

/** Per-area (hard, medium, easy) counts for the 5 areas, summing to 15 / 8 / 2. The two areas that get an easy item rotate by seed. */
export function diagnosticSplit(rng: () => number): { hard: number; medium: number; easy: number }[] {
  const easyAt = new Set(shuffled([0, 1, 2, 3, 4], rng).slice(0, 2));
  return [0, 1, 2, 3, 4].map((k) => (easyAt.has(k) ? { hard: 3, medium: 1, easy: 1 } : { hard: 3, medium: 2, easy: 0 }));
}

/**
 * Diagnostic: 5 items per NP area (25 total), 60% hardest available, 30% medium, 10% easy, no repeats.
 * "Hard" means the highest difficulty labels in that area's pool, whatever they are. Prefers items the learner has
 * not seen; a thin area returns what it has.
 */
export function diagnostic(ctx: SelectContext): Selection {
  const rng = makeRng(ctx.seed);
  const seen = new Set(ctx.attempts.map((a) => a.itemId));
  const split = diagnosticSplit(rng);
  const ids: string[] = [];
  DIAGNOSTIC_AREAS.forEach((area, ai) => {
    const inArea = solo(ctx.items).filter((i) => i.area === area);
    const fresh = inArea.filter((i) => !seen.has(i.id));
    const noSata = (l: BankItem[]) => l.filter((i) => i.type !== 'sata');
    const base = fresh.length >= DIAGNOSTIC_PER_AREA ? fresh : inArea;
    // Select-all items are rare: only used in a thin area that has too few other items.
    const pool = noSata(base).length >= DIAGNOSTIC_PER_AREA ? noSata(base) : base;
    // Shuffle first so ties in difficulty break by seed, then stable-sort hardest first.
    const sorted = shuffled(pool, rng).sort((a, b) => b.difficulty - a.difficulty);
    if (sorted.length <= DIAGNOSTIC_PER_AREA) { ids.push(...sorted.map((i) => i.id)); return; }
    const { hard, medium, easy } = split[ai];
    const hardPick = sorted.slice(0, hard);
    const rest = sorted.slice(hard);
    const easyPick = easy ? rest.slice(rest.length - easy) : [];
    const mid = rest.slice(0, rest.length - easy);
    const start = Math.max(0, Math.floor((mid.length - medium) / 2));
    ids.push(...[...hardPick, ...mid.slice(start, start + medium), ...easyPick].map((i) => i.id));
  });
  const unique = [...new Set(ids)];
  return makeSelection(shuffled(unique, rng), DIAGNOSTIC_AREAS.length * DIAGNOSTIC_PER_AREA);
}

/** Mock board for one area. Short mock (all available) when the area has fewer than `count`. */
export function mock(ctx: SelectContext, area: Area, count: number): Selection {
  const pool = solo(ctx.items).filter((i) => i.area === area);
  const picker = new ClusterPicker(count, ctx.items);
  picker.add(capSata(shuffled(pool, makeRng(ctx.seed)), count));
  return picker.selection();
}

/** Weak-spot set: items from topics and strategy tags with the lowest recent accuracy. */
export function weak(ctx: SelectContext, n: number): Selection {
  const rng = makeRng(ctx.seed);
  const topicAcc = accuracyBy(ctx.attempts, (a) => a.topic);
  const stratAcc = accuracyBy(ctx.attempts, (a) => a.strategy);
  const latest = latestByItem(ctx.attempts);
  const miss = (m: Map<string, KeyStat>, k: string) => (m.has(k) ? 1 - (m.get(k) as KeyStat).accuracy : 0);
  const scored = solo(ctx.items).map((i) => {
    const last = latest.get(i.id);
    // Topic weakness counts most; strategy weakness next; an item missed last time gets a bump.
    let score = miss(topicAcc, i.topic) * 0.6 + miss(stratAcc, i.strategy) * 0.3 + (last && last.credit < 1 ? 0.1 : 0);
    // Diagnostic weakness profile: weak subject bundles and weak strategies count too.
    const b = ctx.weakBoost;
    if (b) score += (b.units.get(b.unitOf(i)) ?? 0) * 0.5 + (b.strategies.get(b.familyOf(i)) ?? 0) * 0.25;
    return { i, score, jitter: rng() };
  });
  const evidence = scored.filter((s) => s.score > 0);
  evidence.sort((a, b) => b.score - a.score || a.jitter - b.jitter);
  const picker = new Picker(n);
  picker.add(capSata(evidence.map((s) => s.i), n));
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
  // Only a budgeted handful of select-all items may enter the pool, so the set can never exceed 1 per 10.
  const rng = makeRng(`${ctx.seed}:sata`);
  const base = solo(ctx.items);
  const sata = shuffled(base.filter((i) => i.type === 'sata'), rng).slice(0, sataBudget(n));
  const items = [...base.filter((i) => i.type !== 'sata'), ...sata];
  return smartSet({ items, attempts: ctx.attempts, seed: ctx.seed }, n);
}
