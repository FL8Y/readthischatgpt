import { AREAS, type Area, type BankItem } from './schema';
import { isAnswered, summarize, type PracticeSession, type SessionSummary } from './session';
import { accuracyBy } from './curate';
import type { AttemptRecord } from './types2';

export type GridStatus = 'correct' | 'partial' | 'wrong' | 'skipped' | 'flagged';

export interface GridCell {
  itemId: string;
  /** 1-based position in presentation order. */
  number: number;
  /** 'flagged' wins over the outcome; `outcome` always carries the underlying result. */
  status: GridStatus;
  outcome: Exclude<GridStatus, 'flagged'>;
  flagged: boolean;
}

export interface AreaBar { area: Area; percent: number; answered: number; total: number }

export interface ErrorPattern {
  strategy: string;
  missed: number;
  answered: number;
  /** Accuracy (0..100) within this session. */
  percent: number;
  /** True when earlier attempts (>= 4 of them) also sit under 60%. */
  recurring: boolean;
  message: string;
}

export interface ReviewTopic { topic: string; missed: number; noteIds: string[] }

export interface SessionResult {
  percent: number;
  correctCount: number;
  answeredCount: number;
  total: number;
  points: number;
  seconds: number;
  areaBars: AreaBar[];
  patterns: ErrorPattern[];
  review: ReviewTopic[];
  grid: GridCell[];
  missedIds: string[];
}

export const PATTERN_MIN_ANSWERED = 2;
export const PATTERN_BELOW_PERCENT = 60;

/**
 * Build the results report. `attempts` are the learner's earlier attempts (optional): they only
 * mark a pattern as 'recurring'. Pass the session summary if you already computed it.
 */
export function buildResult(
  session: PracticeSession,
  items: readonly BankItem[],
  attempts: readonly AttemptRecord[] = [],
  summary: SessionSummary = summarize(session, items as BankItem[]),
): SessionResult {
  const byId = new Map(items.map((i) => [i.id, i]));
  const areaBars: AreaBar[] = [];
  for (const area of AREAS) {
    const b = summary.byArea[area];
    if (b) areaBars.push({ area, percent: b.percent, answered: b.answered, total: b.total });
  }

  const history = accuracyBy(attempts, (a) => a.strategy);
  const patterns: ErrorPattern[] = [];
  for (const [strategy, b] of Object.entries(summary.byStrategyTag)) {
    if (b.answered < PATTERN_MIN_ANSWERED) continue;
    const percent = b.answered ? (b.credit / b.answered) * 100 : 0;
    if (percent >= PATTERN_BELOW_PERCENT) continue;
    const h = history.get(strategy);
    const recurring = !!h && h.attempts >= 4 && h.accuracy * 100 < PATTERN_BELOW_PERCENT;
    const missed = b.answered - b.correct;
    patterns.push({
      strategy, missed, answered: b.answered, percent, recurring,
      message: `You often miss "${strategy}" items (${missed} of ${b.answered} below full credit${recurring ? ', and earlier sessions show the same' : ''}).`,
    });
  }
  patterns.sort((a, b) => Number(b.recurring) - Number(a.recurring) || b.missed - a.missed || a.strategy.localeCompare(b.strategy));

  const topics = new Map<string, { missed: number; noteIds: Set<string> }>();
  for (const id of summary.missedIds) {
    const it = byId.get(id);
    if (!it) continue;
    const t = topics.get(it.topic) ?? { missed: 0, noteIds: new Set<string>() };
    t.missed++;
    if (it.noteId) t.noteIds.add(it.noteId);
    topics.set(it.topic, t);
  }
  const review: ReviewTopic[] = [...topics.entries()]
    .map(([topic, t]) => ({ topic, missed: t.missed, noteIds: [...t.noteIds].sort() }))
    .sort((a, b) => b.missed - a.missed || a.topic.localeCompare(b.topic));

  const grid: GridCell[] = session.order.map((itemId, k) => {
    const a = session.answers[itemId];
    const flagged = !!a?.flagged;
    let outcome: GridCell['outcome'];
    if (!isAnswered(session, itemId) || !a) outcome = 'skipped';
    else if (a.credit >= 1) outcome = 'correct';
    else if (a.credit > 0) outcome = 'partial';
    else outcome = 'wrong';
    return { itemId, number: k + 1, status: flagged ? 'flagged' : outcome, outcome, flagged };
  });

  return {
    percent: summary.percent,
    correctCount: summary.correctCount,
    answeredCount: summary.answeredCount,
    total: summary.total,
    points: summary.points,
    seconds: summary.seconds,
    areaBars, patterns, review, grid,
    missedIds: [...summary.missedIds],
  };
}
