import { describe, it, expect } from 'vitest';
import type { BankItem } from '../src/bank/schema';
import { scoreItem, scoreCaseSet } from '../src/bank/score';
import {
  createSession, answerItem, flagItem, strikeOption, moveTo, pauseSession, resumeSession,
  finishSession, summarize,
} from '../src/bank/session';
import {
  newTimer, remainingSeconds, pauseTimer, resumeTimer, formatClock, dayKey, streakAfter, streakNow, daysBetween,
} from '../src/bank/clock';

function mk(p: Partial<BankItem> & { id: string }): BankItem {
  return {
    v: 2, type: 'single', area: 'NP1', topic: 't', vignette: 'v', stem: 's',
    options: ['a', 'b', 'c', 'd'], answer: [1], rationale: 'r', optionRationales: [],
    strategy: 'ABCs', difficulty: 2, source: 'gold', review: 'unreviewed', aiWritten: true, ...p,
  };
}
const single = mk({ id: 's1' });
const sata = mk({ id: 'sa1', type: 'sata', options: ['a', 'b', 'c', 'd', 'e'], answer: [0, 2, 3] });
const highlight = mk({ id: 'h1', type: 'highlight', options: ['a', 'b', 'c', 'd'], answer: [1, 2] });
const matrix = mk({ id: 'm1', type: 'matrix', rows: ['r1', 'r2', 'r3', 'r4'], columns: ['x', 'y'], rowAnswer: [0, 1, 1, 0], options: [], answer: [] });
const cloze = mk({
  id: 'c1', type: 'cloze', options: [], answer: [],
  blanks: [{ choices: ['p', 'q'], answer: 0 }, { choices: ['p', 'q', 'r'], answer: 2 }],
});

describe('scoreItem', () => {
  it('single is 1 or 0', () => {
    expect(scoreItem(single, { selected: [1] })).toMatchObject({ credit: 1, correct: true, points: 10 });
    expect(scoreItem(single, { selected: [0] })).toMatchObject({ credit: 0, correct: false, points: 0 });
    expect(scoreItem(single, { selected: [] }).credit).toBe(0);
  });
  it('sata: +1 right, -1 wrong, floor 0, / number correct', () => {
    expect(scoreItem(sata, { selected: [0, 2, 3] }).credit).toBe(1);
    expect(scoreItem(sata, { selected: [0, 2] }).credit).toBeCloseTo(2 / 3);
    expect(scoreItem(sata, { selected: [0, 2, 1] }).credit).toBeCloseTo(1 / 3);
    expect(scoreItem(sata, { selected: [0, 1, 4] }).credit).toBe(0); // 1 - 2 floored
    expect(scoreItem(sata, { selected: [0, 2, 3, 1] }).credit).toBeCloseTo(2 / 3);
    expect(scoreItem(sata, { selected: [0, 0, 2] }).credit).toBeCloseTo(2 / 3); // duplicates ignored
    expect(scoreItem(sata, { selected: [0, 2] }).points).toBe(7);
    expect(scoreItem(sata, { selected: [0, 2] }).correct).toBe(false);
  });
  it('highlight uses the same rule as sata', () => {
    expect(scoreItem(highlight, { selected: [1] }).credit).toBe(0.5);
    expect(scoreItem(highlight, { selected: [1, 2, 0] }).credit).toBe(0.5);
    expect(scoreItem(highlight, { selected: [1, 2] }).correct).toBe(true);
  });
  it('matrix: rows correct / total rows', () => {
    expect(scoreItem(matrix, { selected: [0, 1, 1, 0] }).credit).toBe(1);
    expect(scoreItem(matrix, { selected: [0, 1, 0, 1] }).credit).toBe(0.5);
    expect(scoreItem(matrix, { selected: [0, -1, 1] }).credit).toBe(0.5);
    expect(scoreItem(matrix, { selected: [] }).credit).toBe(0);
    expect(scoreItem(matrix, { selected: [0, 1, 1, 0] }).detail).toEqual({ correctPicks: 4, wrongPicks: 0, total: 4 });
  });
  it('cloze: blanks correct / total', () => {
    expect(scoreItem(cloze, { selected: [0, 2] }).credit).toBe(1);
    expect(scoreItem(cloze, { selected: [0, 1] })).toMatchObject({ credit: 0.5, points: 5 });
    expect(scoreItem(cloze, { selected: [1, 1] }).credit).toBe(0);
  });
  it('hint halves points, never credit', () => {
    const r = scoreItem(single, { selected: [1] }, { hinted: true });
    expect(r.credit).toBe(1);
    expect(r.correct).toBe(true);
    expect(r.points).toBe(5);
  });
  it('no hints in mock mode: flag ignored', () => {
    expect(scoreItem(single, { selected: [1] }, { hinted: true, mock: true }).points).toBe(10);
  });
});

describe('scoreCaseSet', () => {
  it('sums credits over items', () => {
    const r = scoreCaseSet([single, sata, matrix], [{ selected: [1] }, { selected: [0, 2] }, { selected: [0, 1, 0, 1] }]);
    expect(r.credit).toBeCloseTo((1 + 2 / 3 + 0.5) / 3);
    expect(r.correct).toBe(false);
    expect(r.points).toBe(10 + 7 + 5);
  });
  it('missing responses score 0; perfect set is correct', () => {
    expect(scoreCaseSet([single, cloze], [{ selected: [1] }]).credit).toBe(0.5);
    expect(scoreCaseSet([single, cloze], [{ selected: [1] }, { selected: [0, 2] }]).correct).toBe(true);
    expect(scoreCaseSet([], []).credit).toBe(0);
  });
});

describe('session', () => {
  const items = [single, sata, mk({ id: 's2', area: 'NP3', strategy: 'Maslow', answer: [0] })];
  const base = () => createSession({ id: 'ses1', mode: 'quick', itemIds: items.map((i) => i.id), now: 1000, limitSeconds: 600 });

  it('creates an active, ordered session; mock reveals at end', () => {
    const s = base();
    expect(s).toMatchObject({ status: 'active', cursor: 0, revealMode: 'now', order: ['s1', 'sa1', 's2'] });
    expect(createSession({ id: 'm', mode: 'mock', itemIds: ['a'], now: 0 }).revealMode).toBe('end');
    const o = createSession({ id: 'o', mode: 'custom', itemIds: ['a', 'b'], now: 0, order: ['b', 'a'] });
    expect(o.order).toEqual(['b', 'a']);
    expect(createSession({ id: 'o', mode: 'custom', itemIds: ['a', 'b'], now: 0, order: ['b', 'z'] }).order).toEqual(['a', 'b']);
  });

  it('answers are immutable and scored; now-mode locks the first answer', () => {
    const s0 = base();
    const s1 = answerItem(s0, single, [1], { seconds: 12 });
    expect(s0.answers).toEqual({});
    expect(s1.answers.s1).toMatchObject({ credit: 1, correct: true, seconds: 12, points: 10 });
    const s2 = answerItem(s1, single, [0]);
    expect(s2.answers.s1.credit).toBe(1);
    expect(s2).toBe(s1);
  });

  it('end-mode allows changing answers; mock ignores hints', () => {
    let s = createSession({ id: 'm', mode: 'mock', itemIds: ['s1'], now: 0 });
    s = answerItem(s, single, [0], { hinted: true });
    s = answerItem(s, single, [1], { hinted: true });
    expect(s.answers.s1).toMatchObject({ credit: 1, points: 10, hinted: false });
    expect(s.answeredIds).toEqual(['s1']);
  });

  it('hinted answer halves points in practice mode', () => {
    const s = answerItem(base(), single, [1], { hinted: true });
    expect(s.answers.s1).toMatchObject({ credit: 1, points: 5, hinted: true });
  });

  it('flag and strike toggle without counting as answered', () => {
    let s = flagItem(base(), 's1');
    s = strikeOption(s, 's1', 2);
    s = strikeOption(s, 's1', 0);
    expect(s.answers.s1).toMatchObject({ flagged: true, struck: [0, 2] });
    s = strikeOption(s, 's1', 2);
    expect(s.answers.s1.struck).toEqual([0]);
    expect(s.answeredIds).toEqual([]);
    expect(flagItem(s, 's1', false).answers.s1.flagged).toBe(false);
    expect(flagItem(s, 'nope')).toBe(s);
    // answering later keeps the flag
    expect(answerItem(s, single, [1]).answers.s1.flagged).toBe(true);
  });

  it('moveTo clamps', () => {
    expect(moveTo(base(), 99).cursor).toBe(2);
    expect(moveTo(base(), -4).cursor).toBe(0);
  });

  it('pause stops the clock; finish freezes it and blocks answers', () => {
    let s = base();
    s = pauseSession(s, 11_000);
    expect(remainingSeconds(s.timer, 50_000)).toBe(590);
    s = resumeSession(s, 61_000);
    expect(remainingSeconds(s.timer, 61_000)).toBe(590);
    expect(remainingSeconds(s.timer, 71_000)).toBe(580);
    s = finishSession(s, 81_000);
    expect(s.status).toBe('done');
    expect(remainingSeconds(s.timer, 999_999)).toBe(570);
    expect(answerItem(s, single, [1])).toBe(s);
    expect(finishSession(s, 5)).toBe(s);
  });

  it('summarize: percent by credit, areas, strategies, missed, seconds', () => {
    let s = base();
    s = answerItem(s, single, [1], { seconds: 10 }); // 1
    s = answerItem(s, sata, [0, 2], { seconds: 20 }); // 2/3
    const mid = summarize(s, items);
    expect(mid.missedIds).toEqual(['sa1']); // unanswered s2 not missed yet
    expect(mid.answeredCount).toBe(2);
    s = finishSession(s, 5000);
    const r = summarize(s, items);
    expect(r.percent).toBeCloseTo(((1 + 2 / 3) / 3) * 100);
    expect(r.correctCount).toBe(1);
    expect(r.seconds).toBe(30);
    expect(r.points).toBe(17);
    expect(r.missedIds).toEqual(['sa1', 's2']);
    expect(r.byArea.NP1).toMatchObject({ total: 2, answered: 2, correct: 1 });
    expect(r.byArea.NP1!.percent).toBeCloseTo(((1 + 2 / 3) / 2) * 100);
    expect(r.byArea.NP3).toMatchObject({ total: 1, answered: 0, percent: 0 });
    expect(r.byStrategyTag.ABCs.total).toBe(2);
    expect(r.byStrategyTag.Maslow.total).toBe(1);
  });

  it('JSON round trips and keeps working', () => {
    let s = base();
    s = answerItem(s, sata, [0, 1], { seconds: 3 });
    s = flagItem(s, 's1');
    s = pauseSession(s, 5000);
    const back = JSON.parse(JSON.stringify(s));
    expect(back).toEqual(s);
    const cont = answerItem(resumeSession(back, 6000), single, [1]);
    expect(cont.answers.s1.credit).toBe(1);
    expect(cont.timer.pausedMs).toBe(1000);
    expect(summarize(back, items)).toEqual(summarize(s, items));
  });
});

describe('timer', () => {
  it('counts down, rounds up, floors at 0, untimed is null', () => {
    const t = newTimer(0, 60);
    expect(remainingSeconds(t, 0)).toBe(60);
    expect(remainingSeconds(t, 500)).toBe(60);
    expect(remainingSeconds(t, 1500)).toBe(59);
    expect(remainingSeconds(t, 61_000)).toBe(0);
    expect(remainingSeconds(newTimer(0), 5000)).toBeNull();
  });
  it('multiple pauses accumulate', () => {
    let t = newTimer(0, 100);
    t = pauseTimer(t, 10_000);
    t = pauseTimer(t, 12_000); // no-op while paused
    t = resumeTimer(t, 20_000);
    t = resumeTimer(t, 21_000); // no-op
    t = pauseTimer(t, 30_000);
    t = resumeTimer(t, 35_000);
    expect(t.pausedMs).toBe(15_000);
    expect(remainingSeconds(t, 45_000)).toBe(70); // 45 - 15 = 30s elapsed
  });
  it('formatClock', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3725.9)).toBe('1:02:05');
    expect(formatClock(-3)).toBe('0:00');
  });
});

describe('Manila day key and streaks', () => {
  const at = (iso: string) => Date.parse(iso);
  it('rolls over at 16:00 UTC (midnight in Manila)', () => {
    expect(dayKey(at('2026-03-10T15:59:59Z'))).toBe('2026-03-10');
    expect(dayKey(at('2026-03-10T16:00:00Z'))).toBe('2026-03-11');
    expect(dayKey(at('2026-12-31T16:00:00Z'))).toBe('2027-01-01');
    expect(dayKey(at('2026-03-10T00:00:00Z'))).toBe('2026-03-10');
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
    expect(daysBetween('2026-03-05', '2026-03-05')).toBe(0);
  });
  it('streak continues across Manila midnight, not UTC midnight', () => {
    const d1 = dayKey(at('2026-03-10T15:59:00Z'));
    const sameDay = dayKey(at('2026-03-10T10:00:00Z'));
    const next = dayKey(at('2026-03-10T16:00:00Z'));
    expect(streakAfter(3, d1, sameDay)).toBe(3);
    expect(streakAfter(3, d1, next)).toBe(4);
    expect(streakAfter(3, d1, '2026-03-13')).toBe(1);
    expect(streakAfter(0, null, next)).toBe(1);
    expect(streakAfter(5, '2026-02-28', '2026-03-01')).toBe(6);
  });
  it('streakNow lapses after a missed day', () => {
    expect(streakNow(4, '2026-03-10', '2026-03-11')).toBe(4);
    expect(streakNow(4, '2026-03-10', '2026-03-12')).toBe(0);
    expect(streakNow(0, null, '2026-03-12')).toBe(0);
  });
});
