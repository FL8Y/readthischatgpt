import type { Area, BankItem } from './schema';
import { scoreItem, type ScoreOptions } from './score';
import { newTimer, pauseTimer, resumeTimer, stopTimer, type TimerState } from './clock';

export type SessionMode = 'quick' | 'custom' | 'diagnostic' | 'mock' | 'adaptive' | 'weak' | 'requeue' | 'smart' | 'case';
export type RevealMode = 'now' | 'end';

export interface SessionAnswer {
  selected: number[];
  credit: number;
  correct: boolean;
  points: number;
  seconds: number;
  hinted: boolean;
  flagged: boolean;
  /** Option indexes the learner crossed out. */
  struck: number[];
}

export interface PracticeSession {
  id: string;
  mode: SessionMode;
  itemIds: string[];
  /** Presentation order (a permutation of itemIds). */
  order: string[];
  /** Keyed by item id. Flag/strike may exist before an answer (selected = []). */
  answers: Record<string, SessionAnswer>;
  /** Items that have actually been answered (separate from flag/strike-only entries). */
  answeredIds: string[];
  revealMode: RevealMode;
  timer: TimerState;
  cursor: number;
  status: 'active' | 'done';
}

export interface CreateSessionOptions {
  id: string;
  mode: SessionMode;
  itemIds: string[];
  now: number;
  /** Defaults to 'end' for mock, otherwise 'now'. */
  revealMode?: RevealMode;
  limitSeconds?: number;
  /** Custom presentation order (must be a permutation of itemIds). */
  order?: string[];
}

export function createSession(o: CreateSessionOptions): PracticeSession {
  const order = o.order && o.order.length === o.itemIds.length && o.order.every((x) => o.itemIds.includes(x))
    ? [...o.order] : [...o.itemIds];
  return {
    id: o.id,
    mode: o.mode,
    itemIds: [...o.itemIds],
    order,
    answers: {},
    answeredIds: [],
    revealMode: o.revealMode ?? (o.mode === 'mock' ? 'end' : 'now'),
    timer: newTimer(o.now, o.limitSeconds),
    cursor: 0,
    status: 'active',
  };
}

const blank = (): SessionAnswer => ({
  selected: [], credit: 0, correct: false, points: 0, seconds: 0, hinted: false, flagged: false, struck: [],
});

function with_(s: PracticeSession, id: string, patch: Partial<SessionAnswer>, answered?: boolean): PracticeSession {
  if (!s.itemIds.includes(id)) return s;
  const prev = s.answers[id] ?? blank();
  return {
    ...s,
    answers: { ...s.answers, [id]: { ...prev, ...patch } },
    answeredIds: answered && !s.answeredIds.includes(id) ? [...s.answeredIds, id] : s.answeredIds,
  };
}

export function isAnswered(s: PracticeSession, id: string): boolean {
  return s.answeredIds.includes(id);
}

export interface AnswerOptions {
  seconds?: number;
  hinted?: boolean;
}

/**
 * Record an answer. With revealMode 'now' the first answer is locked
 * (feedback is shown immediately); with 'end' it may be changed until the session finishes.
 * Hints are ignored in mock mode.
 */
export function answerItem(
  s: PracticeSession,
  item: BankItem,
  selected: number[],
  opts: AnswerOptions = {},
): PracticeSession {
  if (s.status !== 'active' || !s.itemIds.includes(item.id)) return s;
  if (s.revealMode === 'now' && isAnswered(s, item.id)) return s;
  const so: ScoreOptions = { hinted: opts.hinted, mock: s.mode === 'mock' };
  const sc = scoreItem(item, { selected }, so);
  const hinted = !!opts.hinted && s.mode !== 'mock';
  return with_(s, item.id, {
    selected: [...selected],
    credit: sc.credit,
    correct: sc.correct,
    points: sc.points,
    seconds: Math.max(0, opts.seconds ?? 0),
    hinted,
  }, true);
}

export function flagItem(s: PracticeSession, id: string, flagged = true): PracticeSession {
  return with_(s, id, { flagged });
}

/** Toggle an option as struck out. */
export function strikeOption(s: PracticeSession, id: string, optionIndex: number): PracticeSession {
  const prev = s.answers[id]?.struck ?? [];
  const struck = prev.includes(optionIndex) ? prev.filter((x) => x !== optionIndex) : [...prev, optionIndex].sort((a, b) => a - b);
  return with_(s, id, { struck });
}

export function moveTo(s: PracticeSession, cursor: number): PracticeSession {
  if (s.order.length === 0) return s;
  return { ...s, cursor: Math.min(s.order.length - 1, Math.max(0, Math.floor(cursor))) };
}

export function pauseSession(s: PracticeSession, now: number): PracticeSession {
  return s.status === 'active' ? { ...s, timer: pauseTimer(s.timer, now) } : s;
}

export function resumeSession(s: PracticeSession, now: number): PracticeSession {
  return s.status === 'active' ? { ...s, timer: resumeTimer(s.timer, now) } : s;
}

export function finishSession(s: PracticeSession, now: number): PracticeSession {
  if (s.status === 'done') return s;
  return { ...s, status: 'done', timer: stopTimer(s.timer, now) };
}

export interface Bucket {
  total: number;
  answered: number;
  credit: number; // sum of credits
  correct: number; // items at credit 1
  percent: number; // credit / total * 100
}

export interface SessionSummary {
  /** Score by credit, 0..100 (unanswered count as 0). */
  percent: number;
  correctCount: number;
  answeredCount: number;
  total: number;
  points: number;
  byArea: Partial<Record<Area, Bucket>>;
  byStrategyTag: Record<string, Bucket>;
  /** Items below full credit; unanswered ones count only once the session is done. */
  missedIds: string[];
  seconds: number;
}

const newBucket = (): Bucket => ({ total: 0, answered: 0, credit: 0, correct: 0, percent: 0 });

function addTo(b: Bucket, a: SessionAnswer | undefined, answered: boolean) {
  b.total += 1;
  if (answered && a) {
    b.answered += 1;
    b.credit += a.credit;
    if (a.credit === 1) b.correct += 1;
  }
}

export function summarize(s: PracticeSession, items: BankItem[]): SessionSummary {
  const byId = new Map(items.map((i) => [i.id, i]));
  const byArea: Partial<Record<Area, Bucket>> = {};
  const byStrategyTag: Record<string, Bucket> = {};
  const missedIds: string[] = [];
  let credit = 0, correctCount = 0, points = 0, seconds = 0;
  for (const id of s.order) {
    const a = s.answers[id];
    const answered = isAnswered(s, id);
    if (answered && a) {
      credit += a.credit;
      points += a.points;
      seconds += a.seconds;
      if (a.credit === 1) correctCount += 1;
    }
    if ((answered && a && a.credit < 1) || (!answered && s.status === 'done')) missedIds.push(id);
    const it = byId.get(id);
    if (!it) continue;
    addTo((byArea[it.area] ??= newBucket()), a, answered);
    const tag = it.strategy || 'untagged';
    addTo((byStrategyTag[tag] ??= newBucket()), a, answered);
  }
  const pct = (b: Bucket) => { b.percent = b.total ? (b.credit / b.total) * 100 : 0; };
  Object.values(byArea).forEach((b) => b && pct(b));
  Object.values(byStrategyTag).forEach(pct);
  const total = s.order.length;
  return {
    percent: total ? (credit / total) * 100 : 0,
    correctCount,
    answeredCount: s.answeredIds.length,
    total,
    points,
    byArea,
    byStrategyTag,
    missedIds,
    seconds,
  };
}
