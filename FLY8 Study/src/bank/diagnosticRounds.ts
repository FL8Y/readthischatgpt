// Optional 3-round diagnostic: pure selection + weakness profile. No React, no storage, no clock (callers pass `now`).
//   Round 1  broad check: 5 per NP area (existing select.diagnostic, 25 questions)
//   Round 2  drill-down on the 2 weakest areas (default 20): every subject bundle of those areas gets a question where it can
//   Round 3  pinpoint: the 4-5 weakest bundles x 3 questions, plus the 2 weakest strategy families (default 20)
// The "unit" of a topic is its SUBJECT BUNDLE (item.noteId -> bundle). item.topic is nearly unique per item in the bundled
// bank (about 1 question per topic), so it cannot carry a 3-question probe. Items without a bundle share '<AREA>:other'.
// Strategies are grouped into families ("Maslow: ..." and "Maslow: oxygen first" are one family).
import type { Area, BankItem } from './schema';
import { latestByItem, makeRng, shuffled, type Rng } from './curate';
import { capSata, diagnostic, DIAGNOSTIC_MIX, sataBudget, solo, type WeakBoost } from './select';
import type { PracticeSession } from './session';
import type { AttemptRecord, Selection } from './types2';

export type RoundNo = 1 | 2 | 3;
export const ROUND_COUNT: Record<RoundNo, number> = { 1: 25, 2: 20, 3: 20 };
export const ROUND_TITLE: Record<RoundNo, string> = { 1: 'Round 1: broad check', 2: 'Round 2: drill down', 3: 'Round 3: pinpoint' };
export const WEAK_BELOW = 75;
export const PER_UNIT_R3 = 3;
export const MAX_UNITS_R3 = 5;

// ---------- saved state (lives in AppState.dx so it survives restarts and backups) ----------

export type Confidence = 'low' | 'medium' | 'higher';
export interface DxRoundRecord { round: RoundNo; sessionId: string; at: number; itemIds: string[] }
export interface WeakEntry { key: string; label: string; percent: number; answered: number; confidence: Confidence }
export interface WeaknessProfile {
  at: number;
  rounds: RoundNo[];
  answered: number;
  areas: { area: Area; percent: number; answered: number }[];
  /** Weakest subject bundles first (only those under WEAK_BELOW percent). */
  topics: WeakEntry[];
  /** Weakest strategy families first (needs 2+ answers; only those under WEAK_BELOW percent). */
  strategies: WeakEntry[];
}
export interface DxState { rounds: Partial<Record<'1' | '2' | '3', DxRoundRecord>>; profile?: WeaknessProfile }

export const emptyDx = (): DxState => ({ rounds: {} });
export const roundDone = (dx: DxState | undefined, r: RoundNo): boolean => !!dx?.rounds[String(r) as '1'];

/** Honest label for how much evidence is behind a number: fewer than 3 questions low, 3-4 medium, 5+ higher. */
export const confidenceFor = (n: number): Confidence => (n < 3 ? 'low' : n < 5 ? 'medium' : 'higher');
export const CONFIDENCE_TEXT: Record<Confidence, string> = {
  low: 'low confidence: very few questions', medium: 'medium confidence', higher: 'higher confidence',
};

/** Round 2 and 3 sessions carry their round in the id (`diagnostic-r2-...`); the old `diagnostic-...` id is Round 1. */
export const roundSessionId = (round: RoundNo, now: number): string => (round === 1 ? `diagnostic-${now}` : `diagnostic-r${round}-${now}`);
export function roundOfSessionId(id: string): RoundNo {
  const m = /^diagnostic-r([23])-/.exec(id);
  return m ? (Number(m[1]) as RoundNo) : 1;
}

/** Round 2 opens after Round 1; Round 3 opens after Round 2 or can be started anyway once Round 1 exists. */
export function roundAvailability(dx: DxState | undefined): Record<RoundNo, { open: boolean; anyway: boolean }> {
  const r1 = roundDone(dx, 1);
  const r2 = roundDone(dx, 2);
  return { 1: { open: true, anyway: false }, 2: { open: r1, anyway: false }, 3: { open: r1, anyway: r1 && !r2 } };
}

export function recordRound(dx: DxState | undefined, rec: DxRoundRecord, profile: WeaknessProfile): DxState {
  return { rounds: { ...(dx?.rounds ?? {}), [String(rec.round)]: rec }, profile };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
/** Tolerant read of saved/imported data. Anything malformed is dropped; never throws. */
export function cleanDx(raw: unknown): DxState | undefined {
  if (!isObj(raw)) return undefined;
  const out = emptyDx();
  const rounds = isObj(raw.rounds) ? raw.rounds : {};
  for (const k of ['1', '2', '3'] as const) {
    const r = rounds[k];
    if (isObj(r) && typeof r.sessionId === 'string' && typeof r.at === 'number' && Array.isArray(r.itemIds)) {
      out.rounds[k] = { round: Number(k) as RoundNo, sessionId: r.sessionId, at: r.at, itemIds: r.itemIds.filter((x): x is string => typeof x === 'string') };
    }
  }
  const p = raw.profile;
  if (isObj(p) && Array.isArray(p.areas) && Array.isArray(p.topics) && Array.isArray(p.strategies) && typeof p.at === 'number') {
    out.profile = p as unknown as WeaknessProfile;
  }
  return Object.keys(out.rounds).length || out.profile ? out : undefined;
}

// ---------- units and strategy families ----------

export type BundleOf = (item: BankItem) => string | undefined;
export const unitOf = (i: BankItem, bundleOf: BundleOf): string => bundleOf(i) ?? `${i.area}:other`;

const FAMILIES: [RegExp, string][] = [
  [/^(abc|airway|breathing)/, 'ABC'], [/^maslow/, 'Maslow'], [/^unstable/, 'Unstable before stable'],
  [/^safety/, 'Safety'], [/^delegat/, 'Delegation'], [/^scope/, 'Scope of practice'],
  [/^(therapeutic|communication)/, 'Therapeutic communication'], [/^(teach|evaluate teach|.?needs further)/, 'Teaching evaluation'],
  [/^assess/, 'Assess before acting'], [/^nursing process/, 'Nursing process'], [/^negative stem/, 'Negative stem'],
  [/^triage/, 'Triage'], [/^least invasive/, 'Least invasive first'], [/^(ethic|autonomy)/, 'Ethics'], [/^infect/, 'Infection control'],
];

/** "Maslow: oxygen first" and "Maslow: physiological needs first" are one family. Unknown strategies use their own first phrase. */
export function strategyFamily(strategy: string): { key: string; label: string } {
  const s = strategy.trim().toLowerCase();
  for (const [re, label] of FAMILIES) if (re.test(s)) return { key: label.toLowerCase(), label };
  const head = strategy.split(/[:/(,=]/)[0].trim().slice(0, 40) || 'Other';
  const label = head.charAt(0).toUpperCase() + head.slice(1);
  return { key: label.toLowerCase(), label };
}
export const familyKey = (i: BankItem): string => strategyFamily(i.strategy).key;

export function unitLabel(unit: string, names: Readonly<Record<string, string>>): string {
  if (names[unit]) return names[unit];
  const m = /^(NP\d|GEN):other$/.exec(unit);
  return m ? `Other ${m[1]} topics` : unit;
}

// ---------- selection ----------

export interface RoundCtx {
  items: readonly BankItem[];
  attempts: readonly AttemptRecord[];
  seed: number | string;
  bundleOf: BundleOf;
  dx?: DxState;
}
export interface RoundSelection extends Selection { notes: string[] }

/** Ids in the OTHER rounds' saved sets: never repeated, so a retake is a fresh set. */
function otherRoundIds(dx: DxState | undefined, round: RoundNo): Set<string> {
  const out = new Set<string>();
  for (const k of ['1', '2', '3'] as const) if (Number(k) !== round) for (const id of dx?.rounds[k]?.itemIds ?? []) out.add(id);
  return out;
}

/** Collects picks without repeats and keeps select-all items within the 1-per-10 budget. */
class Take {
  ids: string[] = [];
  private set = new Set<string>();
  private room: number;
  constructor(count: number) { this.room = sataBudget(count); }
  has(id: string): boolean { return this.set.has(id); }
  add(i: BankItem): boolean {
    if (this.set.has(i.id)) return false;
    if (i.type === 'sata') { if (this.room <= 0) return false; this.room--; }
    this.set.add(i.id); this.ids.push(i.id);
    return true;
  }
}

const result = (take: Take, count: number, rng: Rng, notes: string[], items: readonly BankItem[]): RoundSelection => {
  const byId = new Map(items.map((i) => [i.id, i]));
  // Safety net: capSata keeps the first allowed select-all items; Take already enforces it, so this is normally a no-op.
  const kept = capSata(take.ids.map((id) => byId.get(id) as BankItem), count).map((i) => i.id);
  if (kept.length < take.ids.length) notes.push('Some select-all questions were dropped to keep them rare.');
  const ids = shuffled(kept, rng);
  const short = ids.length < count;
  if (short) notes.unshift(`Only ${ids.length} of ${count} questions were available.`);
  return { ids, requested: count, short, notes };
};

/** Round 1: the existing broad diagnostic, minus anything saved in Round 2 or 3. */
export function selectRound1(ctx: RoundCtx): RoundSelection {
  const skip = otherRoundIds(ctx.dx, 1);
  const sel = diagnostic({ items: ctx.items.filter((i) => !skip.has(i.id)), attempts: ctx.attempts, seed: ctx.seed });
  return { ...sel, notes: sel.short ? [`Only ${sel.ids.length} of ${sel.requested} questions were available.`] : [] };
}

/** Round 2 area ranking: lowest accuracy first; ties by more answers, then area name. */
export function rankAreas(rows: readonly AttemptRow[], byId: ReadonlyMap<string, BankItem>): { area: Area; percent: number; answered: number }[] {
  const g = new Map<Area, { n: number; c: number }>();
  for (const r of latestRows(rows)) {
    const it = byId.get(r.itemId);
    if (!it) continue;
    const a = g.get(it.area) ?? { n: 0, c: 0 };
    a.n++; a.c += r.credit; g.set(it.area, a);
  }
  return [...g].map(([area, a]) => ({ area, percent: (a.c / a.n) * 100, answered: a.n }))
    .sort((x, y) => x.percent - y.percent || y.answered - x.answered || x.area.localeCompare(y.area));
}

type Band = 'hard' | 'medium' | 'easy';
const BANDS: Band[] = ['hard', 'medium', 'easy'];

/** Round 2: drill into `areas` (the 2 weakest). Every bundle in each area gets a question first, then the 60/30/10 difficulty mix is filled. */
export function selectRound2(ctx: RoundCtx, areas: readonly Area[], count: number = ROUND_COUNT[2]): RoundSelection {
  const rng = makeRng(`${ctx.seed}:r2`);
  const skip = otherRoundIds(ctx.dx, 2);
  const seen = new Set(ctx.attempts.map((a) => a.itemId));
  const take = new Take(count);
  const notes: string[] = [];
  const picked = areas.slice(0, 2);
  picked.forEach((area, k) => {
    const quota = Math.floor(count / picked.length) + (k < count % picked.length ? 1 : 0);
    const pool = shuffled(solo(ctx.items).filter((i) => i.area === area && !skip.has(i.id)), rng).sort((a, b) => b.difficulty - a.difficulty);
    const third = Math.ceil(pool.length / 3);
    const bandOf = (i: BankItem): Band => { const r = pool.indexOf(i); return r < third ? 'hard' : r < third * 2 ? 'medium' : 'easy'; };
    const hard = Math.round(quota * DIAGNOSTIC_MIX.hard);
    const easy = Math.round(quota * DIAGNOSTIC_MIX.easy);
    const need: Record<Band, number> = { hard, medium: quota - hard - easy, easy };
    // sata last, unseen before seen; sort is stable so the seeded shuffle breaks ties.
    const pref = (l: BankItem[]) => [...l].sort((a, b) => Number(a.type === 'sata') - Number(b.type === 'sata') || Number(seen.has(a.id)) - Number(seen.has(b.id)));
    let got = 0;
    const grab = (i: BankItem) => { if (got < quota && take.add(i)) { got++; need[bandOf(i)]--; return true; } return false; };
    const units = shuffled([...new Set(pool.map((i) => unitOf(i, ctx.bundleOf)))], rng);
    if (units.length > quota) notes.push(`${area} has ${units.length} subject bundles but only ${quota} questions, so some bundles are not covered.`);
    for (const u of units.slice(0, quota)) {
      const cands = pref(pool.filter((i) => unitOf(i, ctx.bundleOf) === u)).sort((a, b) => Number(a.type === 'sata') - Number(b.type === 'sata') || Number(seen.has(a.id)) - Number(seen.has(b.id)) || need[bandOf(b)] - need[bandOf(a)]);
      for (const c of cands) if (grab(c)) break;
    }
    for (const b of BANDS) for (const c of pref(pool.filter((i) => bandOf(i) === b))) { if (need[b] <= 0 || got >= quota) break; grab(c); }
    for (const c of pref(pool)) { if (got >= quota) break; grab(c); }
  });
  return result(take, count, rng, notes, ctx.items);
}

/** Round 3: 3 questions on each weak bundle, then the weak strategy families. Unseen first, then items missed before. */
export function selectRound3(
  ctx: RoundCtx, weakUnits: readonly string[], weakStrategies: readonly string[], count: number = ROUND_COUNT[3],
): RoundSelection {
  const rng = makeRng(`${ctx.seed}:r3`);
  const latest = latestByItem(ctx.attempts);
  const earlier = new Set<string>();
  for (const r of Object.values(ctx.dx?.rounds ?? {})) for (const id of r?.itemIds ?? []) earlier.add(id);
  const notes: string[] = [];
  const base = solo(ctx.items);
  // tier 0 unseen, 1 missed last time, 2 answered right before (last resort; never one that was in an earlier round)
  const tier = (i: BankItem) => { const l = latest.get(i.id); return !l ? 0 : l.credit < 1 ? 1 : 2; };
  const order = (l: BankItem[]) => shuffled(l, rng).sort((a, b) => tier(a) - tier(b) || Number(a.type === 'sata') - Number(b.type === 'sata'));
  const usable = (i: BankItem) => tier(i) < 2 || !earlier.has(i.id);
  const take = new Take(count);
  const units = weakUnits.slice(0, MAX_UNITS_R3);
  const fams = weakStrategies.slice(0, 2);
  const unitPools = units.map((u) => order(base.filter((i) => unitOf(i, ctx.bundleOf) === u && usable(i))));
  const famPools = fams.map((f) => order(base.filter((i) => familyKey(i) === f && usable(i))));
  const stratSlots = Math.max(0, count - PER_UNIT_R3 * units.length);
  const pullFrom = (pool: BankItem[], n: number) => { let c = 0; for (const i of pool) { if (c >= n || take.ids.length >= count) break; if (take.add(i)) c++; } return c; };
  unitPools.forEach((p) => pullFrom(p, PER_UNIT_R3));
  famPools.forEach((p, k) => pullFrom(p, Math.floor(stratSlots / fams.length) + (k < stratSlots % fams.length ? 1 : 0)));
  // A thin pool borrows from the other weak pools before giving up.
  [...unitPools, ...famPools].forEach((p) => pullFrom(p, count));
  if (take.ids.length && units.length < 4) notes.push('Fewer than 4 weak bundles were found, so more questions come from the weak strategies.');
  return result(take, count, rng, notes, ctx.items);
}

// ---------- weakness profile ----------

export interface AttemptRow { itemId: string; credit: number }
/** Last answer per item (a retaken item counts once). */
export function latestRows(rows: readonly AttemptRow[]): AttemptRow[] {
  const m = new Map<string, AttemptRow>();
  for (const r of rows) m.set(r.itemId, r);
  return [...m.values()];
}

interface Agg { key: string; label: string; n: number; c: number; percent: number }
function group(rows: readonly AttemptRow[], byId: ReadonlyMap<string, BankItem>, keyOf: (i: BankItem) => { key: string; label: string }): Agg[] {
  const g = new Map<string, Agg>();
  for (const r of latestRows(rows)) {
    const it = byId.get(r.itemId);
    if (!it) continue;
    const k = keyOf(it);
    const a = g.get(k.key) ?? { ...k, n: 0, c: 0, percent: 0 };
    a.n++; a.c += r.credit; g.set(k.key, a);
  }
  return [...g.values()].map((a) => ({ ...a, percent: (a.c / a.n) * 100 }));
}
/** Lowest accuracy first; ties go to the group with more answers (stronger evidence), then label, then key. */
const weakest = (a: Agg, b: Agg) => a.percent - b.percent || b.n - a.n || a.label.localeCompare(b.label) || a.key.localeCompare(b.key);
const entry = (a: Agg): WeakEntry => ({ key: a.key, label: a.label, percent: Math.round(a.percent * 10) / 10, answered: a.n, confidence: confidenceFor(a.n) });

export interface ProfileCtx { byId: ReadonlyMap<string, BankItem>; bundleOf: BundleOf; names: Readonly<Record<string, string>> }
const unitKey = (c: ProfileCtx) => (i: BankItem) => { const u = unitOf(i, c.bundleOf); return { key: u, label: unitLabel(u, c.names) }; };

/** Weakest bundles (keys) by accuracy, for picking Round 3. Includes bundles with a single answer. */
export function weakestUnits(rows: readonly AttemptRow[], c: ProfileCtx, limit = MAX_UNITS_R3): string[] {
  return group(rows, c.byId, unitKey(c)).sort(weakest).slice(0, limit).map((a) => a.key);
}
/** Weakest strategy families (keys): 2+ answers and at least one miss. */
export function weakestStrategies(rows: readonly AttemptRow[], c: ProfileCtx, limit = 2): string[] {
  return group(rows, c.byId, (i) => strategyFamily(i.strategy)).filter((a) => a.n >= 2 && a.percent < 100).sort(weakest).slice(0, limit).map((a) => a.key);
}

export function buildProfile(rows: readonly AttemptRow[], c: ProfileCtx, rounds: readonly RoundNo[], now: number): WeaknessProfile {
  const areas = rankAreas(rows, c.byId).map((a) => ({ ...a, percent: Math.round(a.percent * 10) / 10 }));
  const topics = group(rows, c.byId, unitKey(c)).filter((a) => a.percent < WEAK_BELOW).sort(weakest).slice(0, 8).map(entry);
  const strategies = group(rows, c.byId, (i) => strategyFamily(i.strategy)).filter((a) => a.n >= 2 && a.percent < WEAK_BELOW)
    .sort(weakest).slice(0, 5).map(entry);
  return { at: now, rounds: [...rounds].sort(), answered: latestRows(rows).filter((r) => c.byId.has(r.itemId)).length, areas, topics, strategies };
}

/** Rows for the saved sessions of the given rounds (a retaken round only counts its latest session). Later rounds come last. */
export function roundRows(attempts: readonly AttemptRecord[], dx: DxState | undefined, rounds: readonly RoundNo[]): AttemptRow[] {
  const rows: AttemptRow[] = [];
  for (const r of [...rounds].sort()) {
    const sid = dx?.rounds[String(r) as '1']?.sessionId;
    if (sid) for (const a of attempts) if (a.sessionId === sid) rows.push({ itemId: a.itemId, credit: a.credit });
  }
  return rows;
}

/**
 * Save a finished diagnostic session as its round and rebuild the profile from every saved round.
 * Reads the finished session's answers directly (not from stored attempts) so it never depends on a store update landing first.
 * Returns the old state when nothing was answered.
 */
export function finishRound(dx: DxState | undefined, session: PracticeSession, attempts: readonly AttemptRecord[], c: ProfileCtx, now: number): DxState | undefined {
  if (!session.answeredIds.length) return dx;
  const round = roundOfSessionId(session.id);
  const rounds = { ...(dx?.rounds ?? {}), [String(round)]: { round, sessionId: session.id, at: now, itemIds: [...session.order] } };
  const rows: AttemptRow[] = [];
  for (const r of ([1, 2, 3] as RoundNo[])) {
    const rec = rounds[String(r) as '1'];
    if (!rec) continue;
    if (rec.sessionId === session.id) for (const id of session.answeredIds) rows.push({ itemId: id, credit: session.answers[id]?.credit ?? 0 });
    else for (const a of attempts) if (a.sessionId === rec.sessionId) rows.push({ itemId: a.itemId, credit: a.credit });
  }
  const done = ([1, 2, 3] as RoundNo[]).filter((r) => rounds[String(r) as '1']);
  return { rounds, profile: buildProfile(rows, c, done, now) };
}

// ---------- what the profile feeds ----------

/** Miss rates for Weak-spots practice (select.weak). */
export function weakBoostFrom(p: WeaknessProfile | undefined, bundleOf: BundleOf): WeakBoost | undefined {
  if (!p || (!p.topics.length && !p.strategies.length)) return undefined;
  const rate = (e: WeakEntry): [string, number] => [e.key, Math.min(1, Math.max(0, 1 - e.percent / 100))];
  return { unitOf: (i) => unitOf(i, bundleOf), familyOf: familyKey, units: new Map(p.topics.map(rate)), strategies: new Map(p.strategies.map(rate)) };
}
/** Weak subject bundle ids, weakest first (Study Guide promotion). */
export const weakBundleIds = (p: WeaknessProfile | undefined): string[] => (p?.topics ?? []).map((t) => t.key).filter((k) => !k.includes(':other'));

/** Plain text for the AI learner profile. Says how sure each number is. */
export function profileText(p: WeaknessProfile | undefined): string {
  if (!p || (!p.topics.length && !p.strategies.length)) return '';
  const f = (e: WeakEntry) => `${e.label} ${Math.round(e.percent)}% of ${e.answered} (${e.confidence} confidence)`;
  const parts = [`Diagnostic weak spots from ${p.answered} practice questions (not a pass prediction):`];
  if (p.topics.length) parts.push(`Weak subjects, weakest first: ${p.topics.map(f).join('; ')}.`);
  if (p.strategies.length) parts.push(`Weak reasoning strategies: ${p.strategies.map(f).join('; ')}.`);
  return parts.join(' ');
}
