import type { BankItem } from './schema';
import type { AttemptRecord, Selection } from './types2';

/** Deterministic seeded RNG (mulberry32 over an FNV-1a string hash). */
export type Rng = () => number;

export function makeRng(seed: number | string): Rng {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const SATA_CAP = 0.12;

/** Accumulates picks with no repeats, stopping at n and honouring the sata <= 12% mix cap. */
export class Picker {
  readonly out: BankItem[] = [];
  private ids = new Set<string>();
  private sata = 0;
  private cap: number;
  constructor(readonly n: number) { this.cap = Math.max(1, Math.ceil(n * SATA_CAP)); }
  get full(): boolean { return this.out.length >= this.n; }
  /** Add from cands in order, at most `quota` of them. */
  add(cands: readonly BankItem[], quota = this.n): void {
    let c = 0;
    for (const it of cands) {
      if (this.full || c >= quota) break;
      if (this.ids.has(it.id)) continue;
      if (it.type === 'sata') { if (this.sata >= this.cap) continue; this.sata++; }
      this.ids.add(it.id); this.out.push(it); c++;
    }
  }
  selection(): Selection { return makeSelection(this.out.map((i) => i.id), this.n); }
}

export function makeSelection(ids: string[], requested: number): Selection {
  return { ids, requested, short: ids.length < requested };
}

/** Latest attempt per item id. */
export function latestByItem(attempts: readonly AttemptRecord[]): Map<string, AttemptRecord> {
  const m = new Map<string, AttemptRecord>();
  for (const a of attempts) {
    const prev = m.get(a.itemId);
    if (!prev || a.at >= prev.at) m.set(a.itemId, a);
  }
  return m;
}

export interface KeyStat { attempts: number; accuracy: number }

const RECENT_N = 20;

/** Mean credit over the most recent RECENT_N attempts per key. */
export function accuracyBy(attempts: readonly AttemptRecord[], key: (a: AttemptRecord) => string): Map<string, KeyStat> {
  const groups = new Map<string, AttemptRecord[]>();
  for (const a of attempts) {
    const k = key(a);
    const g = groups.get(k);
    if (g) g.push(a); else groups.set(k, [a]);
  }
  const out = new Map<string, KeyStat>();
  for (const [k, g] of groups) {
    const recent = [...g].sort((x, y) => y.at - x.at).slice(0, RECENT_N);
    out.set(k, { attempts: g.length, accuracy: recent.reduce((s, a) => s + a.credit, 0) / recent.length });
  }
  return out;
}

/** Item ids answered in the last `count` sessions (ranked by latest attempt time; needs sessionId). */
export function recentSessionItemIds(attempts: readonly AttemptRecord[], count = 3): Set<string> {
  const last = new Map<string, number>();
  for (const a of attempts) if (a.sessionId) last.set(a.sessionId, Math.max(last.get(a.sessionId) ?? 0, a.at));
  const keep = new Set([...last.entries()].sort((x, y) => y[1] - x[1]).slice(0, count).map(([id]) => id));
  const ids = new Set<string>();
  for (const a of attempts) if (a.sessionId && keep.has(a.sessionId)) ids.add(a.itemId);
  return ids;
}

/** Learner level 1..5: credit-weighted mean difficulty of recent attempts, nudged by accuracy; default 3. */
export function estimateLevel(items: readonly BankItem[], attempts: readonly AttemptRecord[]): number {
  const diff = new Map(items.map((i) => [i.id, i.difficulty as number]));
  const recent = [...attempts].sort((a, b) => b.at - a.at).slice(0, 40).filter((a) => diff.has(a.itemId));
  if (recent.length < 5) return 3;
  let num = 0, den = 0;
  for (const a of recent) { num += a.credit * (diff.get(a.itemId) as number); den += a.credit; }
  if (den === 0) return 1;
  const accuracy = den / recent.length;
  const lvl = num / den + (accuracy - 0.7) * 1.5;
  return Math.min(5, Math.max(1, Math.round(lvl * 10) / 10));
}

export interface SmartContext {
  items: readonly BankItem[];
  attempts: readonly AttemptRecord[];
  seed: number | string;
}

/**
 * Local "smart set": ~40% weak topics, ~30% unseen, the rest around the learner's level,
 * never repeating an item from the last 3 sessions. Fewer ids + short flag if the pool runs out.
 */
export function smartSet(ctx: SmartContext, n: number): Selection {
  const rng = makeRng(ctx.seed);
  const blocked = recentSessionItemIds(ctx.attempts, 3);
  const pool = ctx.items.filter((i) => !blocked.has(i.id));
  const seen = new Set(ctx.attempts.map((a) => a.itemId));
  const topicAcc = accuracyBy(ctx.attempts, (a) => a.topic);
  const level = estimateLevel(ctx.items, ctx.attempts);
  const picker = new Picker(n);
  const acc = (i: BankItem) => (topicAcc.get(i.topic) as KeyStat).accuracy;
  const weakPool = shuffled(pool.filter((i) => topicAcc.has(i.topic) && acc(i) < 0.75), rng).sort((a, b) => acc(a) - acc(b));
  picker.add(weakPool, Math.round(n * 0.4));
  picker.add(shuffled(pool.filter((i) => !seen.has(i.id)), rng), Math.round(n * 0.3));
  picker.add(shuffled(pool.filter((i) => Math.abs(i.difficulty - level) <= 1), rng));
  picker.add(shuffled(pool, rng));
  return picker.selection();
}
