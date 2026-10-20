// Pure logic behind the Practice hub: mode setup -> selection, resume decision, hub counts,
// history from attempts, bank backup helpers. No React, no storage, no clock (callers pass `now`).
import { AREAS, type Area, type BankItem } from '../../bank/schema';
import {
  createSession, summarize, type PracticeSession, type RevealMode, type SessionMode,
} from '../../bank/session';
import * as pick from '../../bank/select';
import { dueItems, type AttemptRec } from '../../bank/requeue';
import { exportBank, importBank, type BankBackup, type BankState } from '../../bank/store';
import { makeHistoryEntry } from '../../bank/history';
import type { AttemptRecord, CustomFilter, HistoryEntry } from '../../bank/types2';
import {
  rankAreas, roundRows, roundSessionId, selectRound1, selectRound2, selectRound3, weakestStrategies, weakestUnits,
  type BundleOf, type DxState, type RoundCtx, type RoundNo, type WeaknessProfile,
} from '../../bank/diagnosticRounds';

export const QUICK_COUNTS = [10, 25] as const;
export const CUSTOM_COUNTS = [10, 25, 50, 75, 100] as const;
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 120;
export const MOCK_MAX_ITEMS = 100;
export const MOCK_MINUTES = 120;

export interface CustomValues {
  /** Topic names (item.topic) chosen in the tree. Empty = every topic. */
  topics: string[];
  areas: Area[];
  count: number;
  timerOn: boolean;
  minutes: number;
  reveal: RevealMode;
  filters: CustomFilter[];
}

export const defaultCustom = (): CustomValues => ({
  topics: [], areas: [], count: 25, timerOn: false, minutes: 30, reveal: 'now', filters: [],
});

export type StartRequest =
  | { kind: 'quick'; count: number }
  | { kind: 'smart'; count: number }
  | { kind: 'weak'; count: number }
  | { kind: 'requeue' }
  | { kind: 'diagnostic'; round?: RoundNo }
  | { kind: 'mock'; area: Area }
  | { kind: 'case'; sets: number }
  | { kind: 'custom'; values: CustomValues };

export interface PlanContext {
  items: readonly BankItem[];
  attempts: readonly AttemptRecord[];
  seed: number | string;
  flaggedIds?: readonly string[];
  /** Re-queue ids due today (see requeue.dueItems). */
  dueIds?: readonly string[];
  /** Diagnostic rounds: saved rounds, how to find an item's subject bundle, bundle display names. Without bundleOf the old single diagnostic runs. */
  dx?: DxState;
  bundleOf?: BundleOf;
  bundleNames?: Readonly<Record<string, string>>;
  /** Weak-spots mode also uses the saved diagnostic weakness profile. */
  weakBoost?: pick.WeakBoost;
}

export interface Plan {
  mode: SessionMode;
  ids: string[];
  requested: number;
  short: boolean;
  revealMode: RevealMode;
  limitSeconds?: number;
  /** Diagnostic round (1-3). */
  round?: RoundNo;
  /** Plain-language notes about how the set was built (thin pools, uncovered bundles). */
  notes?: string[];
}

export const clampMinutes = (m: number): number =>
  Number.isFinite(m) ? Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(m))) : MIN_MINUTES;

/** Turns a start request into the parameters for select.ts and session.createSession. */
export function planSession(req: StartRequest, ctx: PlanContext): Plan {
  const sc: pick.SelectContext = { items: ctx.items, attempts: ctx.attempts, seed: ctx.seed, flaggedIds: ctx.flaggedIds, weakBoost: ctx.weakBoost };
  const done = (mode: SessionMode, sel: { ids: string[]; requested: number; short: boolean }, extra: Partial<Plan> = {}): Plan => ({
    mode, ids: sel.ids, requested: sel.requested, short: sel.short, revealMode: mode === 'mock' ? 'end' : 'now', ...extra,
  });
  switch (req.kind) {
    case 'quick': return done('quick', pick.quick(sc, req.count));
    case 'smart': return done('smart', pick.smart(sc, req.count));
    case 'weak': return done('weak', pick.weak(sc, req.count));
    case 'requeue': {
      const sel = pick.requeue(sc, ctx.dueIds ?? []);
      // Ids that left the bank are not "missing questions": ask for what exists.
      return done('requeue', { ids: sel.ids, requested: sel.ids.length, short: false });
    }
    case 'case': {
      // Test hook: the e2e suite pins one case set so bundled case sets cannot change its outcome.
      const only = (globalThis as { __FLY8_E2E_CLUSTER__?: string }).__FLY8_E2E_CLUSTER__;
      const pool = only ? ctx.items.filter((i) => i.clusterId === only) : ctx.items;
      return done('case', pick.caseStudy({ ...sc, items: pool }, req.sets));
    }
    case 'diagnostic': {
      if (!ctx.bundleOf) return done('diagnostic', pick.diagnostic(sc));
      const round = req.round ?? 1;
      const rc: RoundCtx = { items: ctx.items, attempts: ctx.attempts, seed: ctx.seed, bundleOf: ctx.bundleOf, dx: ctx.dx };
      const pc = { byId: new Map(ctx.items.map((i) => [i.id, i])), bundleOf: ctx.bundleOf, names: ctx.bundleNames ?? {} };
      const sel = round === 1 ? selectRound1(rc)
        : round === 2 ? selectRound2(rc, rankAreas(roundRows(ctx.attempts, ctx.dx, [1]), pc.byId).slice(0, 2).map((a) => a.area))
          : (() => {
            const rows = roundRows(ctx.attempts, ctx.dx, [1, 2]);
            return selectRound3(rc, weakestUnits(rows, pc), weakestStrategies(rows, pc));
          })();
      return done('diagnostic', sel, { round, notes: sel.notes });
    }
    case 'mock': {
      const available = ctx.items.filter((i) => i.area === req.area).length;
      const n = Math.min(MOCK_MAX_ITEMS, Math.max(available, 0));
      return done('mock', pick.mock(sc, req.area, Math.max(n, 1)), { revealMode: 'end', limitSeconds: MOCK_MINUTES * 60 });
    }
    case 'custom': {
      const v = req.values;
      const sel = pick.custom(sc, {
        areas: v.areas.length ? v.areas : undefined,
        topics: v.topics.length ? v.topics : undefined,
        count: v.count,
        filters: v.filters,
      });
      return done('custom', sel, {
        revealMode: v.reveal,
        limitSeconds: v.timerOn ? clampMinutes(v.minutes) * 60 : undefined,
      });
    }
  }
}

/** Session id: `<mode>-<now>`; diagnostic rounds 2 and 3 carry their round (`diagnostic-r2-<now>`). */
export const planSessionId = (plan: Plan, now: number): string => (plan.mode === 'diagnostic' && plan.round ? roundSessionId(plan.round, now) : `${plan.mode}-${now}`);

export function sessionFromPlan(plan: Plan, id: string, now: number): PracticeSession {
  return createSession({
    id, mode: plan.mode, itemIds: plan.ids, now, revealMode: plan.revealMode, limitSeconds: plan.limitSeconds,
  });
}

/** What the hub says when a plan cannot be started or is smaller than asked. */
export function planNotice(plan: Plan, label: string): string | null {
  if (plan.ids.length === 0) return `No questions are available for ${label} yet.`;
  if (plan.short) return `Only ${plan.ids.length} of ${plan.requested} questions are available for ${label}.`;
  return null;
}

// ---------- attempts ----------

/** Store attempts -> the shape the selectors use. Attempts whose item left the bank are dropped. */
export function toAttemptRecords(attempts: readonly AttemptRec[], byId: ReadonlyMap<string, BankItem>): AttemptRecord[] {
  const out: AttemptRecord[] = [];
  for (const a of attempts) {
    const it = byId.get(a.itemId);
    if (!it) continue;
    out.push({
      itemId: a.itemId, credit: a.credit, seconds: a.seconds, at: a.t, sessionId: a.sessionId,
      mode: a.mode as SessionMode | undefined, area: it.area, topic: it.topic, strategy: it.strategy,
    });
  }
  return out;
}

// ---------- resume ----------

export type ResumeDecision =
  | { kind: 'none' }
  | { kind: 'resume'; answered: number; total: number }
  | { kind: 'discard'; reason: string };

/** A saved active session resumes only if every question is still in the bank. */
export function resumeDecision(session: PracticeSession | undefined, byId: ReadonlyMap<string, BankItem>): ResumeDecision {
  if (!session || session.status !== 'active') return { kind: 'none' };
  if (session.order.length === 0) return { kind: 'discard', reason: 'The saved session was empty.' };
  const missing = session.order.filter((id) => !byId.has(id)).length;
  if (missing > 0) return { kind: 'discard', reason: `${missing} saved question(s) are no longer in the bank.` };
  return { kind: 'resume', answered: session.answeredIds.length, total: session.order.length };
}

/** The item whose answer changed between two session states (null if none). Used to route to session/answer. */
export function changedAnswerId(prev: PracticeSession | undefined, next: PracticeSession): string | null {
  for (const id of next.answeredIds) {
    const a = next.answers[id];
    const p = prev?.answers[id];
    if (!a) continue;
    if (!prev?.answeredIds.includes(id) || !p || p.selected.join() !== a.selected.join()) return id;
  }
  return null;
}

// ---------- hub ----------

export interface HubStats {
  total: number;
  byArea: Record<string, number>;
  requeueDue: number;
  weakAvailable: boolean;
  diagnosticTaken: boolean;
  seen: number;
}

export function hubStats(
  items: readonly BankItem[], state: BankState, attempts: readonly AttemptRecord[], today: string, profile?: WeaknessProfile,
): HubStats {
  const ids = new Set(items.map((i) => i.id));
  const byArea: Record<string, number> = {};
  for (const i of items) byArea[i.area] = (byArea[i.area] ?? 0) + 1;
  const due = dueItems(state.requeue, today).filter((id) => ids.has(id));
  const seen = new Set(attempts.map((a) => a.itemId)).size;
  return {
    total: items.length,
    byArea,
    requeueDue: due.length,
    weakAvailable: attempts.some((a) => a.credit < 1) || !!profile?.topics.length || !!profile?.strategies.length,
    diagnosticTaken: state.attempts.some((a) => a.mode === 'diagnostic'),
    seen,
  };
}

export const SOURCE_LABEL = 'AI-written, not nurse-reviewed';

/** Mock board button text: how many questions and minutes. */
export function mockSummary(available: number): string {
  const n = Math.min(MOCK_MAX_ITEMS, available);
  if (n === 0) return 'No questions in this area yet';
  return `${n} question${n === 1 ? '' : 's'} · ${MOCK_MINUTES} min${available < MOCK_MAX_ITEMS ? ' · short mock' : ''}`;
}

// ---------- custom setup tree ----------

export interface TreeTopic { name: string; count: number }
export interface TreeBundle { id: string; name: string; count: number; topics: TreeTopic[] }
export interface TreeArea { area: Area; count: number; bundles: TreeBundle[] }

/** area > bundle > topic with counts. Topics with no bundle go under "Other topics". */
export function buildTree(
  items: readonly BankItem[],
  noteBundle: ReadonlyMap<string, string>,
  bundleNames: Readonly<Record<string, string>>,
): TreeArea[] {
  const out: TreeArea[] = [];
  for (const area of AREAS) {
    const inArea = items.filter((i) => i.area === area);
    if (!inArea.length) continue;
    const bundles = new Map<string, Map<string, number>>();
    for (const it of inArea) {
      const b = (it.noteId && noteBundle.get(it.noteId)) || '_other';
      const m = bundles.get(b) ?? new Map<string, number>();
      m.set(it.topic, (m.get(it.topic) ?? 0) + 1);
      bundles.set(b, m);
    }
    out.push({
      area,
      count: inArea.length,
      bundles: [...bundles.entries()]
        .map(([id, m]) => ({
          id,
          name: id === '_other' ? 'Other topics' : bundleNames[id] ?? id,
          count: [...m.values()].reduce((a, b) => a + b, 0),
          topics: [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => (a.id === '_other' ? 1 : b.id === '_other' ? -1 : a.name.localeCompare(b.name))),
    });
  }
  return out;
}

export function toggleAll(selected: readonly string[], names: readonly string[]): string[] {
  const all = names.every((n) => selected.includes(n));
  return all ? selected.filter((n) => !names.includes(n)) : [...new Set([...selected, ...names])];
}

/** Questions that match the current custom choices (an upper bound; the session may hold fewer). */
export function customPoolSize(
  items: readonly BankItem[],
  attempts: readonly AttemptRecord[],
  flaggedIds: readonly string[],
  v: CustomValues,
): number {
  const p = pick.custom({ items, attempts, seed: 'count', flaggedIds }, {
    topics: v.topics.length ? v.topics : undefined, areas: v.areas.length ? v.areas : undefined,
    count: items.length || 1, filters: v.filters,
  });
  return p.ids.length;
}

// ---------- diagnostic ----------

export type Level = 'Needs work' | 'Building' | 'Strong';
export const levelFor = (percent: number): Level => (percent < 50 ? 'Needs work' : percent < 75 ? 'Building' : 'Strong');

// ---------- history ----------

/** One entry per session: finished ones from attempts, plus the saved session (active or just done). */
export function historyFromState(state: BankState, items: readonly BankItem[]): HistoryEntry[] {
  const groups = new Map<string, AttemptRec[]>();
  for (const a of state.attempts) {
    if (!a.sessionId) continue;
    const g = groups.get(a.sessionId) ?? [];
    g.push(a);
    groups.set(a.sessionId, g);
  }
  const entries = new Map<string, HistoryEntry>();
  for (const [id, g] of groups) {
    const credit = g.reduce((s, a) => s + a.credit, 0);
    entries.set(id, {
      id, mode: (g[0].mode as SessionMode) ?? 'custom', at: Math.max(...g.map((a) => a.t)), status: 'done',
      percent: (credit / g.length) * 100, total: g.length, answered: g.length,
      correct: g.filter((a) => a.credit >= 1).length, seconds: g.reduce((s, a) => s + a.seconds, 0),
    });
  }
  const s = state.session;
  if (s) {
    const at = s.timer.endedAt ?? s.timer.pausedAt ?? s.timer.startedAt;
    entries.set(s.id, makeHistoryEntry(s, summarize(s, items as BankItem[]), at));
  }
  return [...entries.values()].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}

// ---------- backup ----------

/** Adds the bank state to an export string under extras.bank. Returns the input unchanged if it is not a JSON object. */
export function attachBank(exportJson: string, state: BankState): string {
  try {
    const data = JSON.parse(exportJson) as Record<string, unknown>;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return exportJson;
    const extras = (data.extras && typeof data.extras === 'object' ? data.extras : {}) as Record<string, unknown>;
    const bank: BankBackup = exportBank(state);
    return JSON.stringify({ ...data, extras: { ...extras, bank } }, null, 2);
  } catch {
    return exportJson;
  }
}

/** Bank state from validateBackup().extras, or undefined when the backup has none (old backups). */
export function bankFromExtras(extras: unknown): BankState | undefined {
  if (!extras || typeof extras !== 'object') return undefined;
  const raw = (extras as Record<string, unknown>).bank;
  if (!raw || typeof raw !== 'object') return undefined;
  return importBank(raw);
}
