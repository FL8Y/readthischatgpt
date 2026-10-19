/** Timer and clock helpers for exam sessions and live battles. */
export interface TimerInput { totalSeconds: number; startedAt: number | null; pausedAt: number | null; now: number }
/** Remaining seconds. Pausing freezes the clock because pausedAt replaces "now". */
export function remainingSeconds(t: TimerInput): number {
  if (t.startedAt === null || Number.isNaN(t.startedAt)) return t.totalSeconds;
  const elapsed = Math.max(0, Math.floor(((t.pausedAt ?? t.now) - t.startedAt) / 1000));
  return Math.min(t.totalSeconds, Math.max(0, t.totalSeconds - elapsed));
}

/** Server clock skew: add it to the local clock to approximate server time. */
export const computeSkew = (serverNowMs: number, localNowMs: number) => serverNowMs - localNowMs;
export const remainingFromEndsAt = (endsAtMs: number, localNowMs: number, skewMs: number) => Math.max(0, Math.ceil((endsAtMs - (localNowMs + skewMs)) / 1000));

/** Rough exam length: about 50 seconds per question. */
export const estimateMinutes = (questions: number) => Math.ceil((questions * 50) / 60);

export const formatMinutesSeconds = (seconds: number) =>
  !Number.isFinite(seconds) || seconds < 0 ? "--" : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
