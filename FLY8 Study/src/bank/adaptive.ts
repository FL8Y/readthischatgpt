// Adaptive exam engine. Pure: no React, no clock, no storage. Original formulas, all labelled ESTIMATES.
//
// Model (Rasch / one-parameter logistic, our own simple version):
//   item difficulty 1..5  ->  logit b = (d - 3) * 0.8        (so -1.6 .. +1.6)
//   P(right | theta, b)   =  1 / (1 + e^-(theta - b))
//   theta (ability, per NP area) is clamped to -4..4 and starts at 0 (or at an estimate from earlier attempts).
// Update after each answer (credit 0..1, partial credit allowed):
//   theta' = clamp( theta + step(n) * (credit - P) )          step(n) = max(0.12, 1.5 / (1 + 0.3 n))
//   n = answers already counted in that area. Big early steps, small later steps (shrinks, never below 0.12).
// Next item: the unseen item whose logit is nearest theta, minus a weak-topic bonus (logit units), plus a tiny
//   seeded jitter for ties. A topic may not appear 3 times in a row (cap of 2 consecutive same-topic items).
// Stop rule: at least 25 answers (or the whole pool if smaller), at most 75; between them stop when the 95%
//   half-width of the ability estimate <= 0.75 logits. Half-width = 1.96 * sqrt(sum_area(1/info_a)) / k, where
//   info_a = sum P(1-P) over that area's answers and k = number of areas in play. Also stops if the pool runs out.
// Readiness from theta: expected percent-correct on a reference board mix of difficulty 1..5 weighted
//   10/25/30/25/10 %, then the existing bands (readiness.ts). Locked below 30 answers in the area.
//
// UNVERIFIED: never calibrated on real learners. Item difficulty labels are the writers' labels, not measured.
import { makeRng } from './curate';
import { bandFor, READINESS_FLOOR, type Band } from './readiness';
import { AREAS, type Area, type BankItem } from './schema';
import { createSession, isAnswered, type PracticeSession } from './session';
import type { AttemptRecord } from './types2';

export const THETA_MIN = -4;
export const THETA_MAX = 4;
export const MIN_ITEMS = 25;
export const MAX_ITEMS = 75;
export const CI_STOP_HALFWIDTH = 0.75;
export const MAX_SAME_TOPIC_RUN = 2;
export const DEFAULT_WEAK_BONUS = 0.5;
const NP: readonly Area[] = AREAS.filter((a) => a !== 'GEN');
/** Reference board mix over difficulty 1..5. */
export const REFERENCE_MIX: readonly number[] = [0.1, 0.25, 0.3, 0.25, 0.1];

export const clampTheta = (t: number): number => Math.min(THETA_MAX, Math.max(THETA_MIN, Number.isFinite(t) ? t : 0));
export const difficultyLogit = (d: number): number => (d - 3) * 0.8;
export const pRight = (theta: number, b: number): number => 1 / (1 + Math.exp(-(theta - b)));
export const stepSize = (n: number): number => Math.max(0.12, 1.5 / (1 + 0.3 * Math.max(0, n)));

/** New ability after one answer. `n` = answers already counted in this area (default 0). */
export function updateTheta(theta: number, difficulty: number, credit: number, n = 0): number {
  const c = Math.min(1, Math.max(0, credit));
  return clampTheta(theta + stepSize(n) * (c - pRight(theta, difficultyLogit(difficulty))));
}

// ---------- picking ----------

export interface PickOptions {
  seed: number | string;
  /** Topic -> bonus in logit units (0..~0.6). Items of a weak topic look that much closer to theta. */
  weakBonus?: Readonly<Record<string, number>>;
  /** Topics of the most recent items, oldest first (for the same-topic cap). */
  recentTopics?: readonly string[];
}

/** Weak-topic bonus table from past attempts: topics with >= 3 attempts get bonus * (1 - accuracy). */
export function weakBonusFrom(attempts: readonly AttemptRecord[], bonus = DEFAULT_WEAK_BONUS): Record<string, number> {
  const m = new Map<string, { n: number; c: number }>();
  for (const a of attempts) {
    const e = m.get(a.topic) ?? { n: 0, c: 0 };
    e.n += 1; e.c += a.credit; m.set(a.topic, e);
  }
  const out: Record<string, number> = {};
  for (const [t, e] of m) if (e.n >= 3) out[t] = bonus * (1 - e.c / e.n);
  return out;
}

/**
 * The next item, or null when the pool is exhausted. Deterministic: the same inputs and seed give the same item.
 * Distance = |logit(difficulty) - theta| - weakBonus[topic]; ties break by a seeded jitter.
 */
export function pickNext(
  pool: readonly BankItem[],
  theta: number,
  seen: ReadonlySet<string> | readonly string[],
  opts: PickOptions,
): BankItem | null {
  const seenSet = seen instanceof Set ? seen : new Set(seen as readonly string[]);
  const rest = pool.filter((i) => !seenSet.has(i.id));
  if (!rest.length) return null;
  const r = opts.recentTopics ?? [];
  const tail = r.slice(-MAX_SAME_TOPIC_RUN);
  const blocked = tail.length === MAX_SAME_TOPIC_RUN && tail.every((t) => t === tail[0]) ? tail[0] : null;
  const allowed = blocked ? rest.filter((i) => i.topic !== blocked) : rest;
  const cands = allowed.length ? allowed : rest;
  const rng = makeRng(`${opts.seed}:${seenSet.size}`);
  let best: BankItem | null = null;
  let bestScore = Infinity;
  for (const it of cands) {
    const score = Math.abs(difficultyLogit(it.difficulty) - theta) - (opts.weakBonus?.[it.topic] ?? 0) + rng() * 1e-6;
    if (score < bestScore) { best = it; bestScore = score; }
  }
  return best;
}

// ---------- state (replayed from answers, so it survives a resume) ----------

export type Scope = Area | 'ALL';

export interface TraceStep {
  itemId: string;
  area: Area;
  topic: string;
  difficulty: number;
  credit: number;
  /** Ability of that item's area after this answer. */
  theta: number;
}

export interface AdaptiveMeta {
  scope: Scope;
  seed: string | number;
  /** Starting ability per NP area (default 0). */
  start: Partial<Record<Area, number>>;
  /** Topic -> weak-topic bonus used for picking. */
  weak?: Record<string, number>;
}

export interface AdaptiveState {
  theta: Partial<Record<Area, number>>;
  n: Partial<Record<Area, number>>;
  info: Partial<Record<Area, number>>;
  trace: TraceStep[];
}

/** A practice session that also carries adaptive settings (extra JSON field survives storage). */
export type AdaptiveSession = PracticeSession & { adaptive?: AdaptiveMeta };

export const isAdaptive = (s: PracticeSession | undefined): s is AdaptiveSession & { adaptive: AdaptiveMeta } =>
  !!s && s.mode === 'adaptive' && !!(s as AdaptiveSession).adaptive;

export function initAdaptive(meta: AdaptiveMeta): AdaptiveState {
  const theta: Partial<Record<Area, number>> = {};
  for (const a of areasOf(meta.scope)) theta[a] = clampTheta(meta.start[a] ?? 0);
  return { theta, n: {}, info: {}, trace: [] };
}

export const areasOf = (scope: Scope): readonly Area[] => (scope === 'ALL' ? NP : [scope]);

/** One answer applied. Pure. */
export function stepAdaptive(st: AdaptiveState, item: BankItem, credit: number): AdaptiveState {
  const a = item.area;
  const before = st.theta[a] ?? 0;
  const n = st.n[a] ?? 0;
  const p = pRight(before, difficultyLogit(item.difficulty));
  const after = updateTheta(before, item.difficulty, credit, n);
  return {
    theta: { ...st.theta, [a]: after },
    n: { ...st.n, [a]: n + 1 },
    info: { ...st.info, [a]: (st.info[a] ?? 0) + p * (1 - p) },
    trace: [...st.trace, { itemId: item.id, area: a, topic: item.topic, difficulty: item.difficulty, credit, theta: after }],
  };
}

/** Rebuild the state from the answered items in presentation order. */
export function replayAdaptive(
  s: AdaptiveSession & { adaptive: AdaptiveMeta },
  byId: ReadonlyMap<string, BankItem>,
): AdaptiveState {
  let st = initAdaptive(s.adaptive);
  for (const id of s.order) {
    const item = byId.get(id);
    const ans = s.answers[id];
    if (!item || !ans || !isAnswered(s, id)) continue;
    st = stepAdaptive(st, item, ans.credit);
  }
  return st;
}

// ---------- stop rule ----------

export interface StopDecision { stop: boolean; reason: 'enough' | 'precise' | 'max' | 'pool' | null; halfWidth: number | null }

/** 95% half-width of the (mean) ability estimate over the areas in play; null if nothing answered. */
export function halfWidth(st: AdaptiveState, scope: Scope): number | null {
  const areas = areasOf(scope);
  let v = 0;
  for (const a of areas) {
    const info = st.info[a] ?? 0;
    if (info <= 0) return null;
    v += 1 / info;
  }
  return (1.96 * Math.sqrt(v)) / areas.length;
}

export function stopDecision(st: AdaptiveState, scope: Scope, poolSize: number): StopDecision {
  const n = st.trace.length;
  const hw = halfWidth(st, scope);
  if (n >= MAX_ITEMS) return { stop: true, reason: 'max', halfWidth: hw };
  if (n >= poolSize) return { stop: true, reason: 'pool', halfWidth: hw };
  const min = Math.min(MIN_ITEMS, poolSize);
  if (n >= min && hw !== null && hw <= CI_STOP_HALFWIDTH) return { stop: true, reason: 'precise', halfWidth: hw };
  return { stop: false, reason: null, halfWidth: hw };
}

// ---------- session helpers ----------

/** Items an adaptive exam can use: single/sata in scope (the player's playable types). */
export function adaptivePool(items: readonly BankItem[], scope: Scope): BankItem[] {
  return items.filter((i) => (i.type === 'single' || i.type === 'sata') && (scope === 'ALL' ? i.area !== 'GEN' : i.area === scope));
}

/** Area to draw from next: in 'ALL' the NP area with the fewest answers that still has unseen items. */
function nextArea(st: AdaptiveState, pool: readonly BankItem[], seen: ReadonlySet<string>, scope: Scope): Area | null {
  const order = areasOf(scope).filter((a) => pool.some((i) => i.area === a && !seen.has(i.id)));
  if (!order.length) return null;
  return order.reduce((best, a) => ((st.n[a] ?? 0) < (st.n[best] ?? 0) ? a : best), order[0]);
}

function choose(
  pool: readonly BankItem[], st: AdaptiveState, meta: AdaptiveMeta, seen: ReadonlySet<string>,
): BankItem | null {
  const area = nextArea(st, pool, seen, meta.scope);
  if (!area) return null;
  const recent = st.trace.filter((t) => t.area === area).map((t) => t.topic);
  return pickNext(pool.filter((i) => i.area === area), st.theta[area] ?? 0, seen, {
    seed: meta.seed, weakBonus: meta.weak, recentTopics: recent,
  });
}

export interface StartAdaptive {
  id: string;
  now: number;
  scope: Scope;
  seed: string | number;
  start?: Partial<Record<Area, number>>;
  weak?: Record<string, number>;
}

/** A new adaptive session with its first item chosen, or null when the pool is empty. Reveal at the end. */
export function startAdaptive(items: readonly BankItem[], o: StartAdaptive): AdaptiveSession | null {
  const pool = adaptivePool(items, o.scope);
  const meta: AdaptiveMeta = { scope: o.scope, seed: o.seed, start: o.start ?? {}, weak: o.weak };
  const first = choose(pool, initAdaptive(meta), meta, new Set());
  if (!first) return null;
  const s = createSession({ id: o.id, mode: 'adaptive', itemIds: [first.id], now: o.now, revealMode: 'end' });
  return { ...s, adaptive: meta };
}

/**
 * After an answer: if every queued item is answered and the stop rule says continue, append the next item.
 * Returns the same object when nothing changes (safe to compare by identity).
 */
export function extendAdaptive(
  s: AdaptiveSession, pool: readonly BankItem[], byId: ReadonlyMap<string, BankItem>,
): AdaptiveSession {
  if (!isAdaptive(s) || s.status !== 'active') return s;
  if (s.order.some((id) => !isAnswered(s, id))) return s;
  const st = replayAdaptive(s, byId);
  if (stopDecision(st, s.adaptive.scope, pool.length).stop) return s;
  const next = choose(pool, st, s.adaptive, new Set(s.order));
  if (!next) return s;
  return { ...s, itemIds: [...s.itemIds, next.id], order: [...s.order, next.id] };
}

/** Why a finished or running exam stops (or null while it continues). */
export function sessionStop(s: AdaptiveSession, pool: readonly BankItem[], byId: ReadonlyMap<string, BankItem>): StopDecision | null {
  if (!isAdaptive(s)) return null;
  const st = replayAdaptive(s, byId);
  const d = stopDecision(st, s.adaptive.scope, pool.length);
  return d.stop ? d : null;
}

// ---------- readiness from theta ----------

/** Expected percent-correct on the reference board mix at ability theta. An estimate, not a pass prediction. */
export function expectedPercent(theta: number): number {
  let p = 0;
  REFERENCE_MIX.forEach((w, i) => { p += w * pRight(theta, difficultyLogit(i + 1)); });
  return 100 * p;
}

export type ThetaReadiness =
  | { state: 'locked'; answered: number; needed: number }
  | { state: 'ready'; answered: number; percent: number; band: Band };

/** Same bands as readiness.ts. Locked below 30 answers in the area. */
export function thetaReadiness(theta: number, evidence: number): ThetaReadiness {
  if (evidence < READINESS_FLOOR) return { state: 'locked', answered: evidence, needed: READINESS_FLOOR };
  const percent = expectedPercent(clampTheta(theta));
  return { state: 'ready', answered: evidence, percent, band: bandFor(percent) };
}

/** Ability per NP area from all earlier attempts, oldest first (same update rule). Areas with no attempts are absent. */
export function thetaFromAttempts(
  byId: ReadonlyMap<string, BankItem>, attempts: readonly AttemptRecord[],
): { theta: Partial<Record<Area, number>>; n: Partial<Record<Area, number>> } {
  const theta: Partial<Record<Area, number>> = {};
  const n: Partial<Record<Area, number>> = {};
  const sorted = [...attempts].sort((a, b) => a.at - b.at);
  for (const a of sorted) {
    const it = byId.get(a.itemId);
    if (!it || it.area === 'GEN') continue;
    theta[it.area] = updateTheta(theta[it.area] ?? 0, it.difficulty, a.credit, n[it.area] ?? 0);
    n[it.area] = (n[it.area] ?? 0) + 1;
  }
  return { theta, n };
}

// ---------- plain-words summary ----------

export interface AdaptiveArea {
  area: Area;
  theta: number;
  answered: number;
  levelText: string;
  readiness: ThetaReadiness;
}

export interface AdaptiveSummary {
  answered: number;
  trend: 'climbing' | 'steady' | 'dropping';
  lines: string[];
  areas: AdaptiveArea[];
}

/** theta -> the 1..5 difficulty level it matches (one decimal). */
export const levelOf = (theta: number): number => Math.round(Math.min(5, Math.max(1, theta / 0.8 + 3)) * 10) / 10;

/**
 * Plain-words ability curve. `evidence` = all-time answered count per area (for the readiness lock);
 * defaults to the answers in this exam.
 */
export function summarizeAdaptive(
  st: AdaptiveState, scope: Scope, evidence: Partial<Record<Area, number>> = {},
): AdaptiveSummary {
  const n = st.trace.length;
  const third = Math.max(1, Math.floor(n / 3));
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const early = mean(st.trace.slice(0, third).map((t) => t.theta));
  const late = mean(st.trace.slice(-third).map((t) => t.theta));
  const trend: AdaptiveSummary['trend'] = n < 6 ? 'steady' : late - early > 0.4 ? 'climbing' : late - early < -0.4 ? 'dropping' : 'steady';
  const areas: AdaptiveArea[] = areasOf(scope)
    .filter((a) => (st.n[a] ?? 0) > 0)
    .map((a) => ({
      area: a, theta: st.theta[a] ?? 0, answered: st.n[a] ?? 0, levelText: levelWords(st.theta[a] ?? 0),
      readiness: thetaReadiness(st.theta[a] ?? 0, Math.max(evidence[a] ?? 0, st.n[a] ?? 0)),
    }));
  const lines: string[] = [];
  if (n === 0) lines.push('No questions were answered, so there is no ability estimate yet.');
  else {
    lines.push(`You answered ${n} question${n === 1 ? '' : 's'}. The exam gave you harder questions after right answers and easier ones after misses.`);
    lines.push(trend === 'climbing' ? 'Your level climbed as you went: you handled harder questions later on.'
      : trend === 'dropping' ? 'Your level slipped as you went: the later, harder questions were tougher for you.'
        : 'Your level stayed about the same from start to finish.');
    for (const a of areas) lines.push(`${a.area}: ${a.levelText}.`);
    lines.push('This is a rough estimate from the questions asked, not a pass prediction.');
  }
  return { answered: n, trend, lines, areas };
}

export function levelWords(theta: number): string {
  const l = levelOf(theta);
  const word = l < 2 ? 'easy' : l < 2.7 ? 'fairly easy' : l <= 3.3 ? 'medium' : l <= 4 ? 'fairly hard' : 'hard';
  return `you were holding steady on ${word} questions (about level ${l.toFixed(1)} of 5)`;
}
