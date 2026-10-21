import { describe, expect, it } from 'vitest';
import type { BankItem } from '../src/bank/schema';
import { answerItem, createSession, finishSession, flagItem, pauseSession, strikeOption } from '../src/bank/session';
import {
  buildReport, canGoPrevious, canJumpTo, canSubmit, dropStruck, isLocked, isTimeUp, mapCells, mapCounts,
  optionLetter, optionVerdict, pointsText, progressText, reviewBadge, selectHint, showsFeedback, timerView,
  toggleSelection, verdictFor,
} from '../src/ui/practice/playerLogic';

const base: BankItem = {
  id: 'a', v: 2, type: 'single', area: 'NP3', topic: 'T', vignette: 'v', stem: 's',
  options: ['1', '2', '3', '4'], answer: [1], rationale: 'r'.repeat(50), optionRationales: ['a', 'b', 'c', 'd'],
  strategy: 'ABCs', difficulty: 2, source: 'bank', review: 'ai-checked', aiWritten: true,
};
const sata: BankItem = { ...base, id: 'b', type: 'sata', options: ['1', '2', '3', '4', '5', '6'], answer: [0, 2, 5] };
const t0 = 1_000_000;
const mk = (mode: 'quick' | 'mock', limit?: number) => createSession({ id: 's', mode, itemIds: ['a', 'b'], now: t0, limitSeconds: limit });

describe('player logic', () => {
  it('letters A-F', () => {
    expect([0, 1, 5].map(optionLetter)).toEqual(['A', 'B', 'F']);
    expect(selectHint(sata)).toBe('Select all that apply');
    expect(selectHint(base)).toBe('Choose one answer');
  });

  it('single replaces, sata toggles, struck and locked do nothing', () => {
    expect(toggleSelection(base, [0], 2, [])).toEqual([2]);
    expect(toggleSelection(sata, [], 2, [])).toEqual([2]);
    expect(toggleSelection(sata, [2], 0, [])).toEqual([0, 2]);
    expect(toggleSelection(sata, [0, 2], 2, [])).toEqual([0]);
    expect(toggleSelection(sata, [0], 3, [3])).toEqual([0]);
    expect(toggleSelection(base, [0], 1, [], true)).toEqual([0]);
    expect(toggleSelection(base, [], 9, [])).toEqual([]);
    expect(dropStruck([0, 2, 3], [2])).toEqual([0, 3]);
  });

  it('canSubmit rules', () => {
    expect(canSubmit(base, [], false)).toBe(false);
    expect(canSubmit(base, [1], false)).toBe(true);
    expect(canSubmit(base, [1, 2], false)).toBe(false);
    expect(canSubmit(sata, [0, 2], false)).toBe(true);
    expect(canSubmit(base, [1], true)).toBe(false);
  });

  it('feedback and locking follow reveal mode', () => {
    let now = mk('quick');
    expect(showsFeedback(now, 'a')).toBe(false);
    now = answerItem(now, base, [1]);
    expect(showsFeedback(now, 'a')).toBe(true);
    expect(isLocked(now, 'a')).toBe(true);
    let end = createSession({ id: 'e', mode: 'quick', itemIds: ['a', 'b'], now: t0, revealMode: 'end' });
    end = answerItem(end, base, [1]);
    expect(showsFeedback(end, 'a')).toBe(false);
    expect(isLocked(end, 'a')).toBe(false);
    expect(isLocked(finishSession(end, t0 + 5), 'a')).toBe(true);
  });

  it('mock mode: no previous, forward-only jumps', () => {
    let mock = mk('mock');
    expect(mock.revealMode).toBe('end');
    mock = { ...mock, cursor: 1 };
    expect(canGoPrevious(mock)).toBe(false);
    expect(canJumpTo(mock, 0)).toBe(false);
    expect(canJumpTo(mock, 1)).toBe(true);
    let q = { ...mk('quick'), cursor: 1 };
    expect(canGoPrevious(q)).toBe(true);
    expect(canJumpTo(q, 0)).toBe(true);
    expect(canJumpTo(q, 5)).toBe(false);
    q = { ...q, cursor: 0 };
    expect(canGoPrevious(q)).toBe(false);
  });

  it('map cells carry glyph and word, flag and strike do not count as answered', () => {
    let s = mk('quick');
    s = flagItem(s, 'b');
    s = strikeOption(s, 'a', 0);
    s = answerItem(s, base, [1]);
    const cells = mapCells(s);
    expect(cells[0]).toMatchObject({ state: 'answered', flagged: false, current: true, glyph: '✓', word: 'Answered' });
    expect(cells[1]).toMatchObject({ state: 'unanswered', flagged: true, word: 'Not answered, flagged' });
    expect(cells[1].glyph).toContain('⚑');
    expect(cells[1].label).toBe('Question 2, Not answered, flagged');
    expect(mapCounts(s)).toEqual({ answered: 1, unanswered: 1, flagged: 1 });
    expect(progressText(s)).toBe('Question 1 of 2');
  });

  it('timer text: elapsed, left, low, over, paused', () => {
    const un = mk('quick');
    expect(timerView(un, t0 + 75_000)).toMatchObject({ text: '1:15', kind: 'elapsed' });
    const timed = mk('quick', 600);
    expect(timerView(timed, t0 + 60_000)).toMatchObject({ text: '9:00', kind: 'left', low: false });
    expect(timerView(timed, t0 + 560_000)).toMatchObject({ text: '0:40', low: true });
    expect(timerView(timed, t0 + 700_000)).toMatchObject({ kind: 'over', label: 'Time is up' });
    expect(isTimeUp(timed, t0 + 599_000)).toBe(false);
    expect(isTimeUp(timed, t0 + 600_000)).toBe(true);
    expect(isTimeUp(un, t0 + 9e9)).toBe(false);
    const p = pauseSession(timed, t0 + 10_000);
    expect(timerView(p, t0 + 900_000)).toMatchObject({ text: '9:50', paused: true });
    expect(isTimeUp(p, t0 + 900_000)).toBe(false);
  });

  it('option verdicts and answer verdict', () => {
    expect(optionVerdict(sata, [0, 1], 0)).toBe('correct');
    expect(optionVerdict(sata, [0, 1], 2)).toBe('missed');
    expect(optionVerdict(sata, [0, 1], 1)).toBe('wrong');
    expect(optionVerdict(sata, [0, 1], 3)).toBe('neutral');
    const s = answerItem(mk('quick'), base, [1]);
    expect(verdictFor(s.answers.a).word).toBe('Correct');
    const w = answerItem(mk('quick'), base, [0]);
    expect(verdictFor(w.answers.a).tone).toBe('danger');
    expect(verdictFor({ ...w.answers.a, credit: 0.5 }).word).toBe('Partly correct');
    expect(pointsText(10, false)).toBe('10 points');
    expect(pointsText(1, true)).toBe('1 point (hint used)');
  });

  it('review badge never says nurse unless nurse-checked', () => {
    expect(reviewBadge(base).text).toBe('AI-written, AI-checked');
    expect(reviewBadge({ ...base, review: 'unreviewed' }).text).toBe('AI-written, not yet checked');
    for (const review of ['unreviewed', 'ai-checked', 'owner-checked'] as const) {
      const t = reviewBadge({ ...base, review }).text.toLowerCase();
      expect(t.includes('checked by a nurse')).toBe(false);
    }
    expect(reviewBadge({ ...base, review: 'nurse-checked' }).text).toBe('Checked by a nurse');
  });

  it('builds a trimmed, capped report', () => {
    const r = buildReport('a', 'incorrect', `  ${'x'.repeat(600)} `, 5);
    expect(r).toMatchObject({ itemId: 'a', kind: 'incorrect', at: 5 });
    expect(r.note.length).toBe(500);
  });
});
