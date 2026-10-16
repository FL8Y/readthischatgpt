import type { AppState, Question } from './types';

export const DIAGNOSTIC_MIN = 1;
export const DIAGNOSTIC_MAX = 50;
export const POP_QUIZ_MIN = 1;
export const POP_QUIZ_MAX = 5;

export function clampDiagnosticCount(n: number): number {
  if (!Number.isFinite(n)) return DIAGNOSTIC_MIN;
  return Math.min(DIAGNOSTIC_MAX, Math.max(DIAGNOSTIC_MIN, Math.round(n)));
}

export function isValidPopQuiz(questions: Question[]): boolean {
  return questions.length >= POP_QUIZ_MIN && questions.length <= POP_QUIZ_MAX;
}

/** The diagnostic gate (R-004): lessons for a folder stay locked until its diagnostic is done. */
export function canTeach(state: Pick<AppState, 'diagnosticsDone'>, folderId: string): boolean {
  return state.diagnosticsDone.includes(folderId);
}

export function completeDiagnostic(state: AppState, folderId: string): AppState {
  if (state.diagnosticsDone.includes(folderId)) return state;
  return { ...state, diagnosticsDone: [...state.diagnosticsDone, folderId] };
}

export function scoreAnswer(q: Question, chosenIndex: number): boolean {
  return chosenIndex === q.answerIndex;
}
