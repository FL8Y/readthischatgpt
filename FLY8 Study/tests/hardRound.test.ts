import { describe, expect, it } from 'vitest';
import { buildHardSession, hardRoundDone, hardRoundQuestions, HARD_PREFIX, HARD_ROUND_MAX } from '../src/core/hardRound';
import { eventId, type QuizSession } from '../src/core/quiz';
import { answerWeight } from '../src/core/grading';
import { estimateMastery } from '../src/core/mastery';
import type { AttemptEvent, Question } from '../src/core/types';

const q = (id: string): Question => ({ id, topicId: 't', stem: id, choices: ['a', 'b'], answerIndex: 0, rationale: 'r' });
const session = (n: number): QuizSession => ({
  id: 'pop-1',
  kind: 'pop',
  folderId: 'f',
  questions: Array.from({ length: n }, (_, i) => q(`q${i}`)),
  createdAt: 0,
});
const ev = (s: QuizSession, i: number, correct: boolean, hinted?: boolean): AttemptEvent => ({
  id: eventId(s.id, `q${i}`),
  questionId: `q${i}`,
  topicId: 't',
  correct,
  at: 1,
  kind: s.kind,
  ...(hinted ? { hinted } : {}),
});

describe('hardRoundQuestions', () => {
  it('returns missed questions, then hinted-correct ones, in session order', () => {
    const s = session(5);
    const events = [ev(s, 0, true), ev(s, 1, false), ev(s, 2, true, true), ev(s, 3, false), ev(s, 4, true)];
    expect(hardRoundQuestions(s, events).map((x) => x.id)).toEqual(['q1', 'q3', 'q2']);
  });

  it('is empty when everything was right without hints', () => {
    const s = session(3);
    expect(hardRoundQuestions(s, [ev(s, 0, true), ev(s, 1, true), ev(s, 2, true)])).toEqual([]);
  });

  it('skips unanswered questions and ignores events from other sessions', () => {
    const s = session(3);
    const other: AttemptEvent = { ...ev(s, 2, false), id: 'other:q2' };
    expect(hardRoundQuestions(s, [ev(s, 0, false), other])).toHaveLength(1);
  });

  it('caps at 5 and prefers missed over hinted', () => {
    const s = session(8);
    const events = [
      ...[0, 1, 2].map((i) => ev(s, i, true, true)),
      ...[3, 4, 5, 6, 7].map((i) => ev(s, i, false)),
    ];
    const out = hardRoundQuestions(s, events);
    expect(out).toHaveLength(HARD_ROUND_MAX);
    expect(out.map((x) => x.id)).toEqual(['q3', 'q4', 'q5', 'q6', 'q7']);
  });

  it('does not double count replayed events', () => {
    const s = session(2);
    const e = ev(s, 0, false);
    expect(hardRoundQuestions(s, [e, e, e])).toHaveLength(1);
  });
});

describe('hard session', () => {
  it('uses kind pop and a hard: prefixed id, so event ids never collide with the original', () => {
    const s = session(3);
    const hs = buildHardSession(s, [s.questions[1]], 5);
    expect(hs.kind).toBe('pop');
    expect(hs.id.startsWith(HARD_PREFIX)).toBe(true);
    expect(eventId(hs.id, 'q1')).not.toBe(eventId(s.id, 'q1'));
    expect(eventId(hs.id, 'q1').startsWith('hard:')).toBe(true);
  });

  it('hardRoundDone turns true once every hard question has a hard event', () => {
    const s = session(3);
    const events = [ev(s, 0, false), ev(s, 1, false), ev(s, 2, true)];
    expect(hardRoundDone(s, events)).toBe(false);
    const hid = buildHardSession(s, [], 0).id;
    const hardEv = (i: number): AttemptEvent => ({ ...ev(s, i, true), id: eventId(hid, `q${i}`) });
    expect(hardRoundDone(s, [...events, hardEv(0)])).toBe(false);
    expect(hardRoundDone(s, [...events, hardEv(0), hardEv(1)])).toBe(true);
    expect(hardRoundDone(session(1), [])).toBe(false);
  });
});

describe('hint weight rule', () => {
  it('a correct hinted answer earns at most half; mastery.ts is untouched and still counts it as correct', () => {
    expect(answerWeight({ correct: true, hinted: true })).toBeLessThanOrEqual(0.5);
    expect(answerWeight({ correct: true })).toBe(1);
    const s = session(1);
    const m = estimateMastery('t', [ev(s, 0, true, true)], 1);
    expect(m.attempts).toBe(1);
  });
});
