// Pure helpers for the practice player (no React): what is selectable, letters, map states, timer text, feedback rules.
import type { BankItem, ReviewLevel } from '../../bank/schema';
import { formatClock, elapsedSeconds, remainingSeconds } from '../../bank/clock';
import { isAnswered, type PracticeSession, type SessionAnswer } from '../../bank/session';
import { caseHint, isComplete } from './caseLogic';

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const LOW_TIME_SECONDS = 60;

export const optionLetter = (i: number): string => LETTERS[i] ?? String(i + 1);

export const isMultiPick = (item: BankItem): boolean => item.type === 'sata';

/** Every item type has a UI: single/sata option rows, matrix/cloze/highlight through caseLogic + CaseSet. */
export const isPlayable = (item: BankItem): boolean => ['single', 'sata', 'matrix', 'cloze', 'highlight'].includes(item.type);

/** True for the types drawn as lettered option rows (strike-out applies). */
export const usesOptionRows = (item: BankItem): boolean => item.type === 'single' || item.type === 'sata';

export function selectHint(item: BankItem): string {
  if (!usesOptionRows(item)) return caseHint(item);
  return isMultiPick(item) ? 'Select all that apply' : 'Choose one answer';
}

export const answerOf = (s: PracticeSession, id: string): SessionAnswer | undefined => s.answers[id];

export const struckOf = (s: PracticeSession, id: string): number[] => s.answers[id]?.struck ?? [];

/** A struck-out option cannot be picked. */
export function isSelectable(item: BankItem, struck: number[], idx: number, locked: boolean): boolean {
  return !locked && idx >= 0 && idx < item.options.length && !struck.includes(idx);
}

/** Next draft selection after tapping an option. Single replaces; sata toggles. Struck/locked taps change nothing. */
export function toggleSelection(item: BankItem, selected: number[], idx: number, struck: number[], locked = false): number[] {
  if (!isSelectable(item, struck, idx, locked)) return selected;
  if (!isMultiPick(item)) return [idx];
  return selected.includes(idx) ? selected.filter((x) => x !== idx) : [...selected, idx].sort((a, b) => a - b);
}

/** Striking an option removes it from the draft pick. */
export function dropStruck(selected: number[], struck: number[]): number[] {
  return selected.filter((x) => !struck.includes(x));
}

/** Answers lock when feedback is immediate; with reveal at end they stay editable until the session finishes. */
export function isLocked(s: PracticeSession, id: string): boolean {
  if (s.status === 'done') return true;
  return s.revealMode === 'now' && isAnswered(s, id);
}

export function showsFeedback(s: PracticeSession, id: string): boolean {
  return s.revealMode === 'now' && isAnswered(s, id);
}

export function canSubmit(item: BankItem, selected: number[], locked: boolean): boolean {
  if (locked) return false;
  return isComplete(item, selected);
}

export const canGoPrevious = (s: PracticeSession): boolean => s.mode !== 'mock' && s.cursor > 0;
export const isLastQuestion = (s: PracticeSession): boolean => s.cursor >= s.order.length - 1;
/** Mock mode cannot revisit earlier questions, so the map only jumps forward there. */
export const canJumpTo = (s: PracticeSession, target: number): boolean =>
  target >= 0 && target < s.order.length && (s.mode !== 'mock' || target >= s.cursor);

export type OptionVerdict = 'neutral' | 'correct' | 'missed' | 'wrong';

/** Per-option result after feedback: correct (picked right), missed (right but not picked), wrong (picked wrong). */
export function optionVerdict(item: BankItem, selected: number[], idx: number): OptionVerdict {
  const right = item.answer.includes(idx);
  const picked = selected.includes(idx);
  if (right) return picked ? 'correct' : 'missed';
  return picked ? 'wrong' : 'neutral';
}

export const VERDICT_WORD: Record<OptionVerdict, string> = {
  neutral: '', correct: 'Correct', missed: 'Correct answer (not chosen)', wrong: 'Not correct',
};

export function verdictFor(a: SessionAnswer | undefined): { word: string; tone: 'success' | 'warning' | 'danger' } {
  if (!a || a.credit <= 0) return { word: 'Not correct', tone: 'danger' };
  if (a.credit >= 1) return { word: 'Correct', tone: 'success' };
  return { word: 'Partly correct', tone: 'warning' };
}

export function pointsText(points: number, hinted: boolean): string {
  const p = `${points} ${points === 1 ? 'point' : 'points'}`;
  return hinted ? `${p} (hint used)` : p;
}

/** Honest review label: only nurse-checked items may say so. */
export function reviewBadge(item: BankItem): { text: string; tone: 'neutral' | 'success' } {
  const lvl: ReviewLevel = item.review;
  if (lvl === 'nurse-checked') return { text: 'Checked by a nurse', tone: 'success' };
  if (lvl === 'owner-checked') return { text: 'Checked by you, not by a nurse', tone: 'neutral' };
  if (lvl === 'ai-checked') return { text: item.aiWritten ? 'AI-written, AI-checked' : 'AI-checked', tone: 'neutral' };
  return { text: item.aiWritten ? 'AI-written, not yet checked' : 'Not yet checked', tone: 'neutral' };
}

export type MapState = 'answered' | 'unanswered';
export interface MapCell {
  index: number;
  id: string;
  state: MapState;
  flagged: boolean;
  current: boolean;
  /** Glyph plus word so colour is never the only signal. */
  glyph: string;
  word: string;
  label: string;
}

export function mapCells(s: PracticeSession): MapCell[] {
  return s.order.map((id, index) => {
    const answered = isAnswered(s, id);
    const flagged = !!s.answers[id]?.flagged;
    const state: MapState = answered ? 'answered' : 'unanswered';
    const glyph = (answered ? '✓' : '○') + (flagged ? '⚑' : '');
    const word = (answered ? 'Answered' : 'Not answered') + (flagged ? ', flagged' : '');
    const current = index === s.cursor;
    return { index, id, state, flagged, current, glyph, word, label: `Question ${index + 1}, ${word}${current ? ', current' : ''}` };
  });
}

export function mapCounts(s: PracticeSession): { answered: number; unanswered: number; flagged: number } {
  const cells = mapCells(s);
  const answered = cells.filter((c) => c.state === 'answered').length;
  return { answered, unanswered: cells.length - answered, flagged: cells.filter((c) => c.flagged).length };
}

export interface TimerView {
  text: string;
  kind: 'left' | 'elapsed' | 'over';
  low: boolean;
  paused: boolean;
  /** Words for screen readers. */
  label: string;
}

export function timerView(s: PracticeSession, now: number): TimerView {
  const paused = s.timer.paused;
  const rem = remainingSeconds(s.timer, now);
  if (rem === null) {
    const text = formatClock(elapsedSeconds(s.timer, now));
    return { text, kind: 'elapsed', low: false, paused, label: `${text} elapsed${paused ? ', paused' : ''}` };
  }
  if (rem <= 0) return { text: '0:00', kind: 'over', low: true, paused, label: 'Time is up' };
  const text = formatClock(rem);
  return { text, kind: 'left', low: rem <= LOW_TIME_SECONDS, paused, label: `${text} left${paused ? ', paused' : ''}` };
}

/** True once a timed session has run out (soft: nothing ends automatically). */
export function isTimeUp(s: PracticeSession, now: number): boolean {
  return s.status === 'active' && !s.timer.paused && remainingSeconds(s.timer, now) === 0;
}

export function progressText(s: PracticeSession): string {
  return `Question ${Math.min(s.cursor + 1, s.order.length)} of ${s.order.length}`;
}

/** Seconds to record for an answer: time since the page appeared. */
export function secondsSince(shownAt: number, now: number): number {
  return Math.max(0, Math.round((now - shownAt) / 1000));
}

export type ReportKind = 'unclear' | 'too-long' | 'incorrect' | 'other';
export const REPORT_KINDS: { id: ReportKind; label: string }[] = [
  { id: 'unclear', label: 'Unclear' },
  { id: 'too-long', label: 'Too long' },
  { id: 'incorrect', label: 'Incorrect' },
  { id: 'other', label: 'Other' },
];

export interface ItemReport {
  itemId: string;
  kind: ReportKind;
  note: string;
  at: number;
}

export function buildReport(itemId: string, kind: ReportKind, note: string, at: number): ItemReport {
  return { itemId, kind, note: note.trim().slice(0, 500), at };
}
