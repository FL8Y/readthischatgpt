import { SHARD_BYTES } from '../core/shards';
import type { BankItem } from './schema';
import { answerItem, finishSession, isAnswered, type PracticeSession } from './session';
import { dayKey } from './clock';
import { applyAnswer, type AttemptRec, type RequeueMap } from './requeue';

// ---------- state ----------

export type MasteryLevel = 'learning' | 'reviewing' | 'mastered';
export const MASTERY_LEVELS: readonly MasteryLevel[] = ['learning', 'reviewing', 'mastered'];

export interface MasteryRec {
  /** Consecutive full-credit answers (a miss resets to 0). */
  run: number;
  /** The learner's own choice; wins over the automatic level. */
  override?: MasteryLevel;
}

export interface ItemNote {
  note?: string;
  struck?: number[];
}

export interface ProblemReport {
  id: string;
  itemId: string;
  text: string;
  at: number;
  resolved: boolean;
}

export interface BankState {
  attempts: AttemptRec[];
  flags: Record<string, true>;
  itemNotes: Record<string, ItemNote>;
  mastery: Record<string, MasteryRec>;
  reports: ProblemReport[];
  userItems: BankItem[];
  /** Questions per day the learner wants to answer. */
  dailyGoal: number;
  requeue: RequeueMap;
  /** Learner's board exam day, 'YYYY-MM-DD' (optional; the learning path is a rolling week without it). */
  examDate?: string;
  /** Study minutes per day for the learning path (optional; default 60). */
  pathMinutes?: number;
  /** The one active (or just finished) practice session. */
  session?: PracticeSession;
}

export const DEFAULT_DAILY_GOAL = 20;
export const DEFAULT_PATH_MINUTES = 60;
export const MIN_PATH_MINUTES = 15;
export const MAX_PATH_MINUTES = 240;

/** True for a real calendar day written 'YYYY-MM-DD'. */
export function isDayString(x: unknown): x is string {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const t = Date.parse(`${x}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === x;
}
/** Three right in a row = mastered; one or two = reviewing. */
export const MASTERED_RUN = 3;

export function emptyBankState(): BankState {
  return {
    attempts: [], flags: {}, itemNotes: {}, mastery: {}, reports: [], userItems: [],
    dailyGoal: DEFAULT_DAILY_GOAL, requeue: {},
  };
}

export function autoMastery(run: number): MasteryLevel {
  return run >= MASTERED_RUN ? 'mastered' : run >= 1 ? 'reviewing' : 'learning';
}

/** Level shown for an item: the override if set, else derived from the run. */
export function masteryOf(state: BankState, id: string): MasteryLevel {
  const m = state.mastery[id];
  return m?.override ?? autoMastery(m?.run ?? 0);
}

export function answeredOnDay(state: BankState, day: string): number {
  let n = 0;
  for (let i = state.attempts.length - 1; i >= 0; i--) {
    const d = dayKey(state.attempts[i].t);
    if (d === day) n += 1;
    else if (d < day) break;
  }
  return n;
}

// ---------- reducer ----------

export type BankAction =
  | { type: 'session/start'; session: PracticeSession }
  /** Replace the session with a version changed by session.ts helpers (flag, strike, move, pause). */
  | { type: 'session/update'; session: PracticeSession }
  | { type: 'session/answer'; item: BankItem; selected: number[]; now: number; seconds?: number; hinted?: boolean }
  | { type: 'session/finish'; now: number }
  | { type: 'session/clear' }
  | { type: 'flag/set'; id: string; flagged: boolean }
  | { type: 'item/note'; id: string; note: string }
  | { type: 'item/struck'; id: string; struck: number[] }
  | { type: 'mastery/override'; id: string; level: MasteryLevel | null }
  | { type: 'report/add'; id: string; itemId: string; text: string; now: number }
  | { type: 'report/resolve'; id: string }
  | { type: 'userItems/add'; items: BankItem[] }
  | { type: 'userItems/remove'; id: string }
  | { type: 'goal/set'; goal: number }
  /** Set (or clear with null) the exam date. An invalid date string is ignored. */
  | { type: 'exam/set'; date: string | null }
  | { type: 'path/minutes'; minutes: number }
  | { type: 'state/replace'; state: BankState };

function recordAttempt(state: BankState, rec: AttemptRec): BankState {
  const prev = state.mastery[rec.itemId];
  const run = rec.credit >= 1 ? (prev?.run ?? 0) + 1 : 0;
  const mastery = { ...state.mastery, [rec.itemId]: { ...prev, run } };
  return {
    ...state,
    attempts: [...state.attempts, rec],
    mastery,
    requeue: applyAnswer(state.requeue, rec.itemId, rec.credit, dayKey(rec.t)),
  };
}

function omit<T>(rec: Record<string, T>, id: string): Record<string, T> {
  const { [id]: _gone, ...rest } = rec;
  return rest;
}

export function bankReducer(state: BankState, a: BankAction): BankState {
  switch (a.type) {
    case 'session/start':
      return { ...state, session: a.session };
    case 'session/update':
      return { ...state, session: a.session };
    case 'session/clear': {
      const { session: _s, ...rest } = state;
      return rest;
    }
    case 'session/answer': {
      const s = state.session;
      if (!s || s.status !== 'active') return state;
      const next = answerItem(s, a.item, a.selected, { seconds: a.seconds, hinted: a.hinted });
      if (next === s) return state;
      const withSession = { ...state, session: next };
      // Reveal-at-end sessions (mock) are recorded once, when finished.
      if (s.revealMode === 'end') return withSession;
      const ans = next.answers[a.item.id];
      return recordAttempt(withSession, {
        itemId: a.item.id, t: a.now, credit: ans.credit, correct: ans.credit >= 1, selected: ans.selected,
        seconds: ans.seconds, hinted: ans.hinted || undefined, sessionId: s.id, mode: s.mode,
      });
    }
    case 'session/finish': {
      const s = state.session;
      if (!s || s.status === 'done') return state;
      const done = finishSession(s, a.now);
      let out: BankState = { ...state, session: done };
      if (s.revealMode === 'end') {
        for (const id of done.order) {
          const ans = done.answers[id];
          if (!ans || !isAnswered(done, id)) continue;
          out = recordAttempt(out, {
            itemId: id, t: a.now, credit: ans.credit, correct: ans.credit >= 1, selected: ans.selected,
            seconds: ans.seconds, hinted: ans.hinted || undefined, sessionId: s.id, mode: s.mode,
          });
        }
      }
      return out;
    }
    case 'flag/set':
      return { ...state, flags: a.flagged ? { ...state.flags, [a.id]: true } : omit(state.flags, a.id) };
    case 'item/note':
      return { ...state, itemNotes: { ...state.itemNotes, [a.id]: { ...state.itemNotes[a.id], note: a.note } } };
    case 'item/struck':
      return { ...state, itemNotes: { ...state.itemNotes, [a.id]: { ...state.itemNotes[a.id], struck: [...a.struck] } } };
    case 'mastery/override': {
      const prev = state.mastery[a.id] ?? { run: 0 };
      const { override: _o, ...base } = prev;
      return { ...state, mastery: { ...state.mastery, [a.id]: a.level ? { ...base, override: a.level } : base } };
    }
    case 'report/add':
      return { ...state, reports: [...state.reports, { id: a.id, itemId: a.itemId, text: a.text, at: a.now, resolved: false }] };
    case 'report/resolve':
      return { ...state, reports: state.reports.map((r) => (r.id === a.id ? { ...r, resolved: true } : r)) };
    case 'userItems/add': {
      const ids = new Set(a.items.map((i) => i.id));
      return { ...state, userItems: [...state.userItems.filter((i) => !ids.has(i.id)), ...a.items] };
    }
    case 'userItems/remove':
      return { ...state, userItems: state.userItems.filter((i) => i.id !== a.id) };
    case 'goal/set':
      return { ...state, dailyGoal: Math.max(1, Math.min(500, Math.round(a.goal) || DEFAULT_DAILY_GOAL)) };
    case 'exam/set': {
      if (a.date === null) {
        if (state.examDate === undefined) return state;
        const { examDate: _e, ...rest } = state;
        return rest;
      }
      return isDayString(a.date) && a.date !== state.examDate ? { ...state, examDate: a.date } : state;
    }
    case 'path/minutes': {
      if (!Number.isFinite(a.minutes)) return state;
      const m = Math.min(MAX_PATH_MINUTES, Math.max(MIN_PATH_MINUTES, Math.round(a.minutes)));
      return m === state.pathMinutes ? state : { ...state, pathMinutes: m };
    }
    case 'state/replace':
      return a.state;
    default:
      return state;
  }
}

// ---------- backup ----------

/** Logical backup key for src/backupIO.ts (the integrator wires readBankExtra/writeBankExtra). */
export const BANK_EXTRA_KEYS = ['bank'] as const;
export const BANK_BACKUP_VERSION = 1;

export interface BankBackup {
  v: number;
  state: Omit<BankState, 'session'>;
}

export function exportBank(state: BankState): BankBackup {
  const { session: _s, ...rest } = state;
  return { v: BANK_BACKUP_VERSION, state: rest };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

function isAttempt(x: unknown): x is AttemptRec {
  return isObj(x) && typeof x.itemId === 'string' && typeof x.t === 'number' && typeof x.credit === 'number'
    && Array.isArray(x.selected);
}

/** Tolerant import: unknown or malformed parts fall back to empty. Never throws. */
export function importBank(raw: unknown): BankState {
  const out = emptyBankState();
  const s = isObj(raw) && isObj(raw.state) ? raw.state : isObj(raw) ? raw : {};
  if (Array.isArray(s.attempts)) out.attempts = s.attempts.filter(isAttempt).map((a) => ({ ...a, correct: a.credit >= 1 }));
  if (isObj(s.flags)) for (const k of Object.keys(s.flags)) if (s.flags[k]) out.flags[k] = true;
  if (isObj(s.itemNotes)) out.itemNotes = s.itemNotes as Record<string, ItemNote>;
  if (isObj(s.mastery)) {
    for (const [k, v] of Object.entries(s.mastery)) {
      if (!isObj(v) || typeof v.run !== 'number') continue;
      const o = (MASTERY_LEVELS as readonly unknown[]).includes(v.override) ? (v.override as MasteryLevel) : undefined;
      out.mastery[k] = o ? { run: v.run, override: o } : { run: v.run };
    }
  }
  if (Array.isArray(s.reports)) out.reports = s.reports.filter((r) => isObj(r) && typeof r.id === 'string') as ProblemReport[];
  if (Array.isArray(s.userItems)) out.userItems = s.userItems.filter((i) => isObj(i) && typeof i.id === 'string') as BankItem[];
  if (typeof s.dailyGoal === 'number' && s.dailyGoal >= 1) out.dailyGoal = Math.min(500, Math.round(s.dailyGoal));
  if (isDayString(s.examDate)) out.examDate = s.examDate;
  if (typeof s.pathMinutes === 'number' && Number.isFinite(s.pathMinutes)) {
    out.pathMinutes = Math.min(MAX_PATH_MINUTES, Math.max(MIN_PATH_MINUTES, Math.round(s.pathMinutes)));
  }
  if (isObj(s.requeue)) {
    for (const [k, v] of Object.entries(s.requeue)) {
      if (isObj(v) && typeof v.stage === 'number' && typeof v.due === 'string') out.requeue[k] = { stage: v.stage, due: v.due };
    }
  }
  return out;
}

// ---------- persistence (sharded, key-value injected so tests need no AsyncStorage) ----------

export interface KV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const BANK_PREFIX = 'fly8.bank.v1.';
export const KEY_MAIN = `${BANK_PREFIX}main`;
export const KEY_SESSION = `${BANK_PREFIX}session`;
export const keyAttempts = (n: number): string => `${BANK_PREFIX}attempts.${n}`;
export const keyUserItems = (n: number): string => `${BANK_PREFIX}userItems.${n}`;

/** Storage keys other than shard keys; the integrator can use BANK_PREFIX to find them all. */
export const BANK_STORAGE_KEYS = [KEY_MAIN, KEY_SESSION] as const;

/** Splits an array into JSON strings, each under SHARD_BYTES (one oversize element still gets its own shard). */
export function shardArray<T>(items: T[], limit: number = SHARD_BYTES): string[] {
  const out: string[] = [];
  let cur: T[] = [];
  let size = 0;
  for (const it of items) {
    const s = JSON.stringify(it).length + 1;
    if (cur.length && size + s > limit) {
      out.push(JSON.stringify(cur));
      cur = [];
      size = 0;
    }
    cur.push(it);
    size += s;
  }
  if (cur.length) out.push(JSON.stringify(cur));
  return out;
}

interface MainRecord {
  v: 1;
  flags: BankState['flags'];
  itemNotes: BankState['itemNotes'];
  mastery: BankState['mastery'];
  reports: BankState['reports'];
  dailyGoal: number;
  requeue: BankState['requeue'];
  examDate?: string;
  pathMinutes?: number;
  shards: { attempts: number; userItems: number };
}

/** Lazily binds AsyncStorage so importing this file never needs the native module. */
export async function asyncStorageKV(): Promise<KV> {
  const mod = await import('@react-native-async-storage/async-storage');
  return mod.default as unknown as KV;
}

/**
 * Persists a BankState. Keeps a cache of what it last wrote, so each save only writes
 * shards whose text changed (attempts are append-only: normally just the last shard).
 */
export class BankPersistence {
  private written = new Map<string, string>();
  private counts = { attempts: 0, userItems: 0 };

  constructor(private kv: KV) {}

  private async put(key: string, value: string): Promise<void> {
    if (this.written.get(key) === value) return;
    await this.kv.setItem(key, value);
    this.written.set(key, value);
  }

  private async putShards(keyOf: (n: number) => string, parts: string[], prevCount: number): Promise<void> {
    for (let i = 0; i < parts.length; i++) await this.put(keyOf(i), parts[i]);
    for (let i = parts.length; i < prevCount; i++) {
      await this.kv.removeItem(keyOf(i));
      this.written.delete(keyOf(i));
    }
  }

  /** Cheap per-answer save: only the active session, under one key. */
  async saveSession(session: PracticeSession | undefined): Promise<void> {
    if (!session) {
      await this.kv.removeItem(KEY_SESSION);
      this.written.delete(KEY_SESSION);
      return;
    }
    await this.put(KEY_SESSION, JSON.stringify(session));
  }

  /** Saves everything except the session. Pass the previous state to skip untouched parts. */
  async saveBank(state: BankState, prev?: BankState): Promise<void> {
    if (!prev || prev.attempts !== state.attempts) {
      const parts = shardArray(state.attempts);
      await this.putShards(keyAttempts, parts, this.counts.attempts);
      this.counts.attempts = parts.length;
    }
    if (!prev || prev.userItems !== state.userItems) {
      const parts = shardArray(state.userItems);
      await this.putShards(keyUserItems, parts, this.counts.userItems);
      this.counts.userItems = parts.length;
    }
    const main: MainRecord = {
      v: 1, flags: state.flags, itemNotes: state.itemNotes, mastery: state.mastery, reports: state.reports,
      dailyGoal: state.dailyGoal, requeue: state.requeue, shards: { ...this.counts },
      ...(state.examDate ? { examDate: state.examDate } : {}),
      ...(state.pathMinutes ? { pathMinutes: state.pathMinutes } : {}),
    };
    await this.put(KEY_MAIN, JSON.stringify(main));
  }

  /** Saves what changed between prev and next: session first (cheap), then the rest. */
  async saveDiff(prev: BankState, next: BankState): Promise<void> {
    if (prev.session !== next.session) await this.saveSession(next.session);
    if (
      prev.attempts !== next.attempts || prev.userItems !== next.userItems || prev.flags !== next.flags
      || prev.itemNotes !== next.itemNotes || prev.mastery !== next.mastery || prev.reports !== next.reports
      || prev.dailyGoal !== next.dailyGoal || prev.requeue !== next.requeue
      || prev.examDate !== next.examDate || prev.pathMinutes !== next.pathMinutes
    ) await this.saveBank(next, prev);
  }

  /** Loads the saved state. Missing or corrupt parts fall back to empty. */
  async load(): Promise<BankState> {
    const state = emptyBankState();
    let main: Partial<MainRecord> = {};
    try {
      const raw = await this.kv.getItem(KEY_MAIN);
      if (raw) main = JSON.parse(raw) as Partial<MainRecord>;
    } catch {
      main = {};
    }
    const readShards = async <T>(keyOf: (n: number) => string, count: number): Promise<T[]> => {
      const out: T[] = [];
      for (let i = 0; i < count; i++) {
        try {
          const raw = await this.kv.getItem(keyOf(i));
          if (raw) {
            out.push(...(JSON.parse(raw) as T[]));
            this.written.set(keyOf(i), raw);
          }
        } catch {
          // skip a corrupt shard
        }
      }
      return out;
    };
    const nA = Number(main.shards?.attempts) || 0;
    const nU = Number(main.shards?.userItems) || 0;
    this.counts = { attempts: nA, userItems: nU };
    const merged = importBank({
      attempts: await readShards<AttemptRec>(keyAttempts, nA),
      userItems: await readShards<BankItem>(keyUserItems, nU),
      flags: main.flags, itemNotes: main.itemNotes, mastery: main.mastery, reports: main.reports,
      dailyGoal: main.dailyGoal, requeue: main.requeue, examDate: main.examDate, pathMinutes: main.pathMinutes,
    });
    Object.assign(state, merged);
    try {
      const raw = await this.kv.getItem(KEY_SESSION);
      if (raw) {
        const s = JSON.parse(raw) as PracticeSession;
        if (isObj(s) && typeof s.id === 'string' && Array.isArray(s.order)) {
          state.session = s;
          this.written.set(KEY_SESSION, raw);
        }
      }
    } catch {
      // ignore a corrupt saved session
    }
    return state;
  }
}

/**
 * Convenience wrapper: holds the state, applies actions through the reducer, and persists the diff
 * (the session is written first, so a kill right after an answer never loses it).
 */
export class BankStore {
  state: BankState = emptyBankState();
  private listeners = new Set<(s: BankState) => void>();

  constructor(private persistence: BankPersistence) {}

  async init(): Promise<BankState> {
    this.state = await this.persistence.load();
    return this.state;
  }

  subscribe(fn: (s: BankState) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  async dispatch(action: BankAction): Promise<BankState> {
    const prev = this.state;
    const next = bankReducer(prev, action);
    if (next === prev) return prev;
    this.state = next;
    this.listeners.forEach((l) => l(next));
    await this.persistence.saveDiff(prev, next);
    return next;
  }
}
