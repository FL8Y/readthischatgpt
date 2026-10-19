// Timer and Manila day helpers. Pure: every function takes `now` explicitly.

export interface TimerState {
  /** Total allowed seconds; undefined = untimed. */
  limitSeconds?: number;
  startedAt: number;
  /** Milliseconds spent paused so far (closed pauses only). */
  pausedMs: number;
  paused: boolean;
  /** When the current pause began (only while paused). */
  pausedAt?: number;
  /** Set when the session finished; freezes the clock. */
  endedAt?: number;
}

export function newTimer(startedAt: number, limitSeconds?: number): TimerState {
  const t: TimerState = { startedAt, pausedMs: 0, paused: false };
  if (limitSeconds !== undefined) t.limitSeconds = limitSeconds;
  return t;
}

/** Milliseconds of active (not paused) time. */
export function elapsedMs(timer: TimerState, now: number): number {
  const end = timer.endedAt ?? (timer.paused && timer.pausedAt !== undefined ? timer.pausedAt : now);
  const pausedOpen = timer.endedAt !== undefined && timer.paused && timer.pausedAt !== undefined
    ? timer.endedAt - timer.pausedAt : 0;
  return Math.max(0, end - timer.startedAt - timer.pausedMs - pausedOpen);
}

export function elapsedSeconds(timer: TimerState, now: number): number {
  return Math.floor(elapsedMs(timer, now) / 1000);
}

/** Whole seconds left (rounded up), never below 0. null when untimed. */
export function remainingSeconds(timer: TimerState, now: number): number | null {
  if (timer.limitSeconds === undefined) return null;
  return Math.max(0, Math.ceil(timer.limitSeconds - elapsedMs(timer, now) / 1000));
}

export function pauseTimer(timer: TimerState, now: number): TimerState {
  if (timer.paused || timer.endedAt !== undefined) return timer;
  return { ...timer, paused: true, pausedAt: now };
}

export function resumeTimer(timer: TimerState, now: number): TimerState {
  if (!timer.paused || timer.pausedAt === undefined) return timer;
  const { pausedAt, ...rest } = timer;
  return { ...rest, paused: false, pausedMs: timer.pausedMs + Math.max(0, now - pausedAt) };
}

export function stopTimer(timer: TimerState, now: number): TimerState {
  if (timer.endedAt !== undefined) return timer;
  return { ...timer, endedAt: now };
}

/** 'H:MM:SS' for an hour or more, otherwise 'M:SS'. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

const MANILA_OFFSET_MS = 8 * 3600 * 1000; // Asia/Manila is UTC+8 all year, no DST

/** 'YYYY-MM-DD' for the Manila calendar day containing `ms`. */
export function dayKey(ms: number): string {
  return new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whole days from dayKey a to dayKey b (b later = positive). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/**
 * Streak length after studying on `today`.
 * prevStreak = streak recorded as of lastDayKey (null/0 = none).
 * Same day: unchanged (min 1). Next day: +1. Gap or none: restart at 1.
 */
export function streakAfter(prevStreak: number, lastDayKey: string | null, today: string): number {
  if (!lastDayKey || prevStreak <= 0) return 1;
  const gap = daysBetween(lastDayKey, today);
  if (gap === 0) return Math.max(1, prevStreak);
  if (gap === 1) return prevStreak + 1;
  return 1;
}

/** Streak as shown today without studying: lapses to 0 if a full day was missed. */
export function streakNow(prevStreak: number, lastDayKey: string | null, today: string): number {
  if (!lastDayKey) return 0;
  return daysBetween(lastDayKey, today) <= 1 ? prevStreak : 0;
}
