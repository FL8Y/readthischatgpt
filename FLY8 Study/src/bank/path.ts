// Learning path: a deterministic day-by-day study plan. Pure: callers pass `today` (Manila day key) and the data.
// Same input = same plan. Original rules, no AI:
//   * Time costs: 1.5 min per question; a mock board is a whole day (120 min); notes review = 10 min reading + 10 questions.
//   * Daily load = `minutes` (default 60). A normal day: clear missed questions (cap = 20% of the time, at least 3),
//     every 3rd calendar day a notes review, the rest practice, in blocks of 5 questions.
//   * Area rotation: areas ranked weakest first (readiness percent; unknown = 50, never-answered = 45). The weakest area
//     gets 3 slots per cycle, the second 2, the others 1; the slot is picked by calendar day number, so a day keeps
//     its area when you reopen the app.
//   * Weekly mock board: with an exam date, exactly 7, 14, ... days before it; without one, every 7th calendar day.
//   * Last 2 days before the exam: taper (missed questions + 10 light questions, no new reviews, no mock). Exam day: rest.
//   * Missed-question backlog: due counts per day are carried forward; the daily cap spreads the rest over later days.
//   * Task states: Today (due today, not done), Up next (later days), Needs attention (a past day's task not done),
//     Done. Done is computed from attempts. Past days: pooled questions answered that day; today: by area for practice.
//     Practice done on a later day beyond that day's own plan clears the oldest overdue tasks first.
//   * Catch-up: what is still overdue (question units) is spread over today and later practice days, at most +50% of the
//     daily load per day (so a day never exceeds 1.5x the daily minutes). Anything beyond that is dropped and reported.
//   * Looks back at most 7 days. No exam date -> a rolling 7-day plan. Past exam date -> rolling plan plus a note.
// UNVERIFIED: the minute costs and weights are our guesses, not measured on real learners.
import { areaReadiness, type Band } from './readiness';
import { dayKey, daysBetween } from './clock';
import { AREAS, type Area, type BankItem } from './schema';
import { isDayString, DEFAULT_PATH_MINUTES } from './store';
import type { RequeueMap } from './requeue';
import type { AttemptRecord } from './types2';

export const MIN_PER_QUESTION = 1.5;
export const MOCK_DAY_MINUTES = 120;
export const MOCK_ITEMS = 100;
export const LOOKBACK_DAYS = 7;
export const DISPLAY_DAYS = 14;
export const ROLLING_DAYS = 7;
export const CATCH_UP_SHARE = 0.5;
export const REVIEW_QUESTIONS = 10;
export const REVIEW_READING_MIN = 10;
export const DIAGNOSTIC_MIN = 35;
export const TAPER_QUESTIONS = 10;
const NP: readonly Area[] = AREAS.filter((a) => a !== 'GEN');
const SPECIAL_MODES = new Set(['requeue', 'mock', 'diagnostic']);

export type TaskKind = 'diagnostic' | 'practice' | 'requeue' | 'mock' | 'review' | 'rest';
export type TaskState = 'today' | 'upcoming' | 'attention' | 'done';

export interface PathTask {
  id: string;
  day: string;
  kind: TaskKind;
  area?: Area;
  topics: string[];
  bundle?: string;
  /** Questions to answer (0 for rest). */
  target: number;
  done: number;
  minutes: number;
  title: string;
  state: TaskState;
  /** Extra questions added by the catch-up rule (already inside `target`). */
  catchUp: number;
}

export interface WeakTopic { topic: string; bundle?: string }

export interface AreaInfo {
  area: Area;
  answered: number;
  /** Readiness percent, or null while locked (fewer than 30 answers). */
  percent: number | null;
  band: Band | null;
  bankCount: number;
  weakTopics: WeakTopic[];
}

export interface DayLog {
  /** Practice-type attempts (not requeue, mock or diagnostic) by area. */
  byArea: Partial<Record<Area, number>>;
  byTopic: Record<string, number>;
  practice: number;
  requeue: number;
  mock: Partial<Record<Area, number>>;
  diagnostic: number;
}

export interface PathInput {
  today: string;
  examDate?: string | null;
  minutes?: number;
  areas: readonly AreaInfo[];
  diagnosticTaken: boolean;
  /** Missed-question due counts by day (overdue lumped into today; see requeueByDay). */
  requeueByDay: Readonly<Record<string, number>>;
  log: Readonly<Record<string, DayLog>>;
  /** First day the learner used the app (limits how far back "missed days" go). Default: today. */
  startDay?: string;
}

export interface PathPlan {
  today: string;
  status: 'rolling' | 'exam-far' | 'exam-soon' | 'exam-today' | 'exam-past';
  examDate: string | null;
  daysLeft: number | null;
  countdown: string;
  minutes: number;
  tasks: PathTask[];
  todayTasks: PathTask[];
  upNext: PathTask[];
  attention: PathTask[];
  /** Questions of catch-up dropped because the cap was reached. */
  droppedQuestions: number;
  note: string | null;
}

// ---------- inputs ----------

const dayNum = (d: string): number => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400000);

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

/** Missed-question counts per due day; anything due on or before today counts for today. */
export function requeueByDay(map: RequeueMap, today: string, validIds?: ReadonlySet<string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, e] of Object.entries(map)) {
    if (validIds && !validIds.has(id)) continue;
    const d = e.due <= today ? today : e.due;
    out[d] = (out[d] ?? 0) + 1;
  }
  return out;
}

/** Per-day counts of what was answered, from stored attempts. */
export function buildDayLog(attempts: readonly AttemptRecord[]): Record<string, DayLog> {
  const out: Record<string, DayLog> = {};
  for (const a of attempts) {
    const d = dayKey(a.at);
    const l = (out[d] ??= { byArea: {}, byTopic: {}, practice: 0, requeue: 0, mock: {}, diagnostic: 0 });
    if (a.mode === 'requeue') l.requeue += 1;
    else if (a.mode === 'mock') l.mock[a.area] = (l.mock[a.area] ?? 0) + 1;
    else if (a.mode === 'diagnostic') l.diagnostic += 1;
    else {
      l.practice += 1;
      l.byArea[a.area] = (l.byArea[a.area] ?? 0) + 1;
      l.byTopic[a.topic] = (l.byTopic[a.topic] ?? 0) + 1;
    }
  }
  return out;
}

/** Per-area facts for the planner: readiness, bank size and up to 3 weakest topics (>= 2 attempts, under 75%). */
export function buildAreaInfos(
  items: readonly BankItem[], attempts: readonly AttemptRecord[], now: number,
  bundleOfNote?: (noteId: string) => string | undefined,
): AreaInfo[] {
  return NP.map((area) => {
    const r = areaReadiness(area, items as BankItem[], attempts, now);
    const mine = attempts.filter((a) => a.area === area);
    const acc = new Map<string, { n: number; c: number }>();
    for (const a of mine) {
      const e = acc.get(a.topic) ?? { n: 0, c: 0 };
      e.n += 1; e.c += a.credit; acc.set(a.topic, e);
    }
    const weakTopics = [...acc.entries()]
      .filter(([, e]) => e.n >= 2 && e.c / e.n < 0.75)
      .sort((x, y) => x[1].c / x[1].n - y[1].c / y[1].n || (x[0] < y[0] ? -1 : 1))
      .slice(0, 3)
      .map(([topic]) => {
        const noteId = items.find((i) => i.area === area && i.topic === topic && i.noteId)?.noteId;
        return { topic, bundle: noteId && bundleOfNote ? bundleOfNote(noteId) : undefined };
      });
    return {
      area, answered: mine.length, percent: r.state === 'ready' ? r.percent : null,
      band: r.state === 'ready' ? r.band : null, bankCount: items.filter((i) => i.area === area).length, weakTopics,
    };
  });
}

// ---------- countdown ----------

export function countdownText(today: string, examDate?: string | null): string {
  if (!examDate || !isDayString(examDate)) return 'No exam date set';
  const d = daysBetween(today, examDate);
  if (d < 0) return `Your exam date passed ${-d} day${d === -1 ? '' : 's'} ago`;
  if (d === 0) return 'Exam day is today';
  if (d === 1) return 'Your exam is tomorrow';
  return d >= 14 ? `${d} days to go (about ${Math.round(d / 7)} weeks)` : `${d} days to go`;
}

// ---------- planning ----------

interface Ctx {
  M: number;
  exam: string | null;
  areas: AreaInfo[];
  ranked: AreaInfo[];
  rotation: AreaInfo[];
  diagnosticTaken: boolean;
}

const blocks5 = (minutes: number): number => Math.max(0, Math.floor(minutes / MIN_PER_QUESTION / 5) * 5);
export const requeueCap = (M: number): number => Math.max(3, Math.floor((0.2 * M) / MIN_PER_QUESTION));

function rankAreas(areas: readonly AreaInfo[]): AreaInfo[] {
  const score = (a: AreaInfo) => (a.percent !== null ? a.percent : a.answered === 0 ? 45 : 50);
  return areas.filter((a) => a.bankCount > 0).sort((a, b) => score(a) - score(b) || NP.indexOf(a.area) - NP.indexOf(b.area));
}

/** Weakest area 3 slots, second 2, the rest 1: [a0 a1 a2 .. an, a0 a1, a0]. */
function rotationOf(ranked: readonly AreaInfo[]): AreaInfo[] {
  const out: AreaInfo[] = [];
  for (let pass = 0; pass < 3; pass++) ranked.forEach((a, i) => { if ((i === 0 ? 3 : i === 1 ? 2 : 1) > pass) out.push(a); });
  return out;
}

const topicLabel = (t: readonly WeakTopic[]): string => t.map((x) => x.topic).join(', ');

function mk(day: string, kind: TaskKind, p: Partial<PathTask> & { title: string; target: number; minutes: number }): PathTask {
  return { id: `${day}:${kind}${p.area ? `:${p.area}` : ''}`, day, kind, topics: [], done: 0, state: 'upcoming', catchUp: 0, ...p };
}

function practiceTask(day: string, area: AreaInfo, n: number): PathTask {
  const t = area.weakTopics;
  return mk(day, 'practice', {
    area: area.area, topics: t.map((x) => x.topic), target: n, minutes: Math.ceil(n * MIN_PER_QUESTION),
    title: `Practice ${n} questions in ${area.area}${t.length ? ` weak topics: ${topicLabel(t)}` : ''}`,
  });
}

/** Base tasks for one day (no catch-up, no done states). `backlog` is the missed-question queue carried in. */
function baseDay(day: string, offset: number, ctx: Ctx, backlog: number): { tasks: PathTask[]; taken: number } {
  const { M } = ctx;
  const n = dayNum(day);
  const D = ctx.exam ? daysBetween(day, ctx.exam) : null;
  if (D === 0) {
    return { tasks: [mk(day, 'rest', { title: 'Exam day: rest, eat, and trust your preparation', target: 0, minutes: 0 })], taken: 0 };
  }
  const tasks: PathTask[] = [];
  const area = ctx.rotation.length ? ctx.rotation[n % ctx.rotation.length] : undefined;
  const taper = D !== null && D <= 2;
  const mockDay = !taper && ctx.ranked.length > 0 && (D !== null ? D >= 7 && D % 7 === 0 : n % 7 === 6);
  if (mockDay) {
    const a = ctx.ranked[Math.floor(n / 7) % ctx.ranked.length];
    const count = Math.min(MOCK_ITEMS, a.bankCount);
    tasks.push(mk(day, 'mock', { area: a.area, target: count, minutes: MOCK_DAY_MINUTES, title: `Weekly mock board (${a.area})` }));
    return { tasks, taken: 0 };
  }
  let used = 0;
  if (offset === 0 && !ctx.diagnosticTaken && ctx.ranked.length > 0) {
    tasks.push(mk(day, 'diagnostic', { target: 25, minutes: DIAGNOSTIC_MIN, title: 'Take the 25-question placement check' }));
    used += DIAGNOSTIC_MIN;
  }
  const taken = Math.min(backlog, requeueCap(M));
  if (taken > 0) {
    tasks.push(mk(day, 'requeue', { target: taken, minutes: Math.ceil(taken * MIN_PER_QUESTION), title: `Clear ${taken} missed question${taken === 1 ? '' : 's'}` }));
    used += Math.ceil(taken * MIN_PER_QUESTION);
  }
  if (!area) return { tasks, taken };
  if (taper) {
    tasks.push(practiceTask(day, area, TAPER_QUESTIONS));
    return { tasks, taken };
  }
  const reviewMins = REVIEW_READING_MIN + Math.ceil(REVIEW_QUESTIONS * MIN_PER_QUESTION);
  if (n % 3 === 0 && M >= 45 && used + reviewMins <= M) {
    const focus = area.weakTopics[0];
    const label = focus?.bundle ?? focus?.topic ?? `${area.area} notes`;
    const mins = reviewMins;
    tasks.push(mk(day, 'review', {
      area: area.area, topics: focus ? [focus.topic] : [], bundle: focus?.bundle, target: REVIEW_QUESTIONS, minutes: mins,
      title: `Review notes: ${label}`,
    }));
    used += mins;
  }
  const q = blocks5(M - used);
  if (q >= 5) tasks.push(practiceTask(day, area, q));
  return { tasks, taken };
}

/** Builds the plan. Deterministic. */
export function buildPath(input: PathInput): PathPlan {
  const M = Math.max(15, input.minutes ?? DEFAULT_PATH_MINUTES);
  const today = input.today;
  const examValid = !!input.examDate && isDayString(input.examDate);
  const exam = examValid ? (input.examDate as string) : null;
  const daysLeft = exam ? daysBetween(today, exam) : null;
  const usableExam = exam !== null && (daysLeft as number) >= 0 ? exam : null;
  const ranked = rankAreas(input.areas);
  const ctx: Ctx = { M, exam: usableExam, areas: [...input.areas], ranked, rotation: rotationOf(ranked), diagnosticTaken: input.diagnosticTaken };

  const start = input.startDay && isDayString(input.startDay) && input.startDay < today ? input.startDay : today;
  const firstDay = daysBetween(start, today) > LOOKBACK_DAYS ? addDays(today, -LOOKBACK_DAYS) : start;
  const span = usableExam ? Math.min(DISPLAY_DAYS, (daysLeft as number) + 1) : ROLLING_DAYS;
  const lastOffset = span - 1;

  // base tasks
  const days: { day: string; offset: number; tasks: PathTask[] }[] = [];
  for (let off = daysBetween(today, firstDay); off <= lastOffset; off++) {
    days.push({ day: addDays(today, off), offset: off, tasks: [] });
  }
  let backlog = 0;
  for (const d of days) {
    if (d.offset < 0) { d.tasks = baseDay(d.day, d.offset, ctx, 0).tasks.filter((t) => t.kind !== 'requeue' && t.kind !== 'diagnostic'); continue; }
    backlog += input.requeueByDay[d.day] ?? 0;
    const r = baseDay(d.day, d.offset, ctx, backlog);
    d.tasks = r.tasks;
    backlog -= r.taken;
  }

  // done (pass 1) and surplus
  const surplusByDay: Record<string, number> = {};
  for (const d of days) {
    const log = input.log[d.day];
    let pool = log?.practice ?? 0;
    const isToday = d.offset === 0;
    for (const t of d.tasks) {
      if (t.kind === 'requeue') t.done = isToday ? log?.requeue ?? 0 : 0;
      else if (t.kind === 'diagnostic') t.done = log?.diagnostic ?? 0;
      else if (t.kind === 'mock') t.done = !t.area || !log ? 0 : isToday ? log.mock[t.area] ?? 0 : Object.values(log.mock).reduce((x, y) => x + (y ?? 0), 0);
      else if (t.kind === 'review' || t.kind === 'practice') {
        const avail = isToday && t.area
          ? Math.min(pool, t.kind === 'review' ? sumTopics(log, t.topics, t.area) : log?.byArea[t.area] ?? 0)
          : pool;
        t.done = Math.min(t.target, Math.max(0, avail));
        pool -= t.done;
      }
    }
    surplusByDay[d.day] = Math.max(0, pool);
  }

  const complete = (t: PathTask): boolean => (t.kind === 'rest' ? false : t.kind === 'mock' ? t.done >= Math.ceil(t.target * 0.8) : t.done >= t.target);

  // pass 2: later surplus clears the oldest overdue question tasks
  const overdue = days.filter((d) => d.offset < 0).flatMap((d) => d.tasks).filter((t) => (t.kind === 'practice' || t.kind === 'review') && !complete(t));
  const later = days.filter((d) => d.offset >= 0).map((d) => d.day);
  for (const t of overdue) {
    for (const ld of later) {
      const avail = surplusByDay[ld] ?? 0;
      if (avail <= 0) continue;
      const take = Math.min(avail, t.target - t.done);
      t.done += take;
      surplusByDay[ld] = avail - take;
      if (t.done >= t.target) break;
    }
  }

  // catch-up
  let shortfall = overdue.reduce((s, t) => s + Math.max(0, t.target - t.done), 0);
  const cap = Math.floor((CATCH_UP_SHARE * M) / MIN_PER_QUESTION);
  const eligible = days.filter((d) => d.offset >= 0 && d.tasks.some((t) => t.kind === 'practice') && !d.tasks.some((t) => t.kind === 'mock'));
  const taperDay = (day: string) => usableExam !== null && daysBetween(day, usableExam) <= 2;
  const el = eligible.filter((d) => !taperDay(d.day));
  let left = el.length;
  let dropped = 0;
  for (const d of el) {
    if (shortfall <= 0) break;
    const add = Math.min(cap, Math.ceil(shortfall / left));
    left -= 1;
    const t = d.tasks.find((x) => x.kind === 'practice') as PathTask;
    t.target += add; t.catchUp = add; t.minutes = Math.ceil(t.target * MIN_PER_QUESTION);
    t.title = `${t.title.replace(/^Practice \d+/, `Practice ${t.target}`)} (includes ${add} catch-up)`;
    shortfall -= add;
  }
  if (shortfall > 0) dropped = shortfall;

  // states
  const tasks: PathTask[] = [];
  for (const d of days) {
    for (const t of d.tasks) {
      const fin = complete(t);
      t.state = fin ? 'done' : d.offset < 0 ? 'attention' : d.offset === 0 ? 'today' : 'upcoming';
      if (t.kind === 'rest') t.state = d.offset === 0 ? 'today' : 'upcoming';
      tasks.push(t);
    }
  }

  const status: PathPlan['status'] = daysLeft === null ? 'rolling'
    : daysLeft < 0 ? 'exam-past' : daysLeft === 0 ? 'exam-today' : daysLeft <= 14 ? 'exam-soon' : 'exam-far';
  const noQuestions = ranked.length === 0;
  const note = status === 'exam-past' ? 'Your exam date has passed. Set a new date, or keep this rolling week.'
    : noQuestions ? 'No questions in the bank yet, so there is nothing to schedule.'
      : dropped > 0 ? `Too much to catch up: ${dropped} questions were dropped from the plan to keep days under 1.5x your usual load.`
        : null;
  return {
    today, status, examDate: exam, daysLeft, countdown: countdownText(today, exam), minutes: M, tasks,
    todayTasks: tasks.filter((t) => t.day === today),
    upNext: tasks.filter((t) => t.state === 'upcoming'),
    attention: tasks.filter((t) => t.state === 'attention'),
    droppedQuestions: dropped, note,
  };
}

function sumTopics(log: DayLog | undefined, topics: readonly string[], area: Area): number {
  if (!log) return 0;
  if (!topics.length) return log.byArea[area] ?? 0;
  return topics.reduce((s, t) => s + (log.byTopic[t] ?? 0), 0);
}

/** Total planned minutes for a day's tasks. */
export const dayMinutes = (plan: PathPlan, day: string): number =>
  plan.tasks.filter((t) => t.day === day).reduce((s, t) => s + t.minutes, 0);

/** Short label for a day relative to today: 'Today', 'Tomorrow', 'Yesterday' or the date. */
export function dayLabel(today: string, day: string): string {
  const d = daysBetween(today, day);
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : day;
}

// ---------- launching a task ----------

export type Launch =
  | { kind: 'diagnostic' }
  | { kind: 'requeue' }
  | { kind: 'mock'; area: Area }
  | { kind: 'practice'; area: Area; topics: string[]; count: number }
  | null;

/** What session a task starts. Rest tasks and finished tasks start nothing. */
export function launchFor(t: PathTask): Launch {
  if (t.state === 'done') return null;
  switch (t.kind) {
    case 'diagnostic': return { kind: 'diagnostic' };
    case 'requeue': return { kind: 'requeue' };
    case 'mock': return t.area ? { kind: 'mock', area: t.area } : null;
    case 'practice':
    case 'review':
      return t.area ? { kind: 'practice', area: t.area, topics: t.topics, count: Math.max(5, t.target - t.done) } : null;
    default: return null;
  }
}
