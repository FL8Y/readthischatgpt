import type { SessionMode, PracticeSession, SessionSummary } from './session';
import type { HistoryEntry } from './types2';

export function makeHistoryEntry(session: PracticeSession, summary: SessionSummary, at: number): HistoryEntry {
  return {
    id: session.id,
    mode: session.mode,
    at,
    status: session.status,
    percent: summary.percent,
    total: summary.total,
    answered: summary.answeredCount,
    correct: summary.correctCount,
    seconds: summary.seconds,
  };
}

export interface HistoryFilter {
  mode?: SessionMode | readonly SessionMode[];
  status?: HistoryEntry['status'];
}

/** Newest first; ties broken by id so the order is stable. */
export function filterHistory(entries: readonly HistoryEntry[], f: HistoryFilter = {}): HistoryEntry[] {
  const modes = f.mode === undefined ? null : new Set<SessionMode>(Array.isArray(f.mode) ? f.mode : [f.mode as SessionMode]);
  return entries
    .filter((e) => (!modes || modes.has(e.mode)) && (!f.status || e.status === f.status))
    .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}

/** e.g. "3 sessions · 41 answered · avg 72% · best 90%". Only finished sessions feed avg and best. */
export function historySummaryLine(entries: readonly HistoryEntry[]): string {
  if (entries.length === 0) return 'No sessions yet';
  const done = entries.filter((e) => e.status === 'done');
  const answered = entries.reduce((s, e) => s + e.answered, 0);
  const noun = entries.length === 1 ? 'session' : 'sessions';
  const parts = [`${entries.length} ${noun}`, `${answered} answered`];
  if (done.length) {
    parts.push(`avg ${Math.round(done.reduce((s, e) => s + e.percent, 0) / done.length)}%`);
    parts.push(`best ${Math.round(Math.max(...done.map((e) => e.percent)))}%`);
  }
  return parts.join(' · ');
}
