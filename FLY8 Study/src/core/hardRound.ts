import type { AttemptEvent, Question } from './types';
import { dedupeEvents } from './mastery';
import { eventId, type QuizSession } from './quiz';

export const HARD_ROUND_MAX = 5;
export const HARD_PREFIX = 'hard:';

export const hardSessionId = (sessionId: string) => `${HARD_PREFIX}${sessionId}`;

/**
 * Questions of a finished pop/module session that were missed or answered with a hint, for one optional
 * follow-up round. Missed first, then hinted-but-correct, each in session order; capped at 5.
 * Unanswered questions are not "hard", just unseen.
 */
export function hardRoundQuestions(session: QuizSession, events: AttemptEvent[]): Question[] {
  const byId = new Map(dedupeEvents(events).map((e) => [e.id, e]));
  const missed: Question[] = [];
  const hinted: Question[] = [];
  for (const q of session.questions) {
    const e = byId.get(eventId(session.id, q.id));
    if (!e) continue;
    if (!e.correct) missed.push(q);
    else if (e.hinted) hinted.push(q);
  }
  return [...missed, ...hinted].slice(0, HARD_ROUND_MAX);
}

/** The follow-up session: kind 'pop', id prefixed `hard:` so its events never collide with the original's. */
export function buildHardSession(session: QuizSession, questions: Question[], now: number): QuizSession {
  return { id: hardSessionId(session.id), kind: 'pop', folderId: session.folderId, questions, createdAt: now };
}

/** True once every question of the hard round has a recorded answer. */
export function hardRoundDone(session: QuizSession, events: AttemptEvent[]): boolean {
  const hard = hardRoundQuestions(session, events);
  if (hard.length === 0) return false;
  const seen = new Set(events.map((e) => e.id));
  const hid = hardSessionId(session.id);
  return hard.every((q) => seen.has(eventId(hid, q.id)));
}
