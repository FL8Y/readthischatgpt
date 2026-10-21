import { describe, expect, it } from 'vitest';
import {
  CATCH_UP_SHARE, MIN_PER_QUESTION, addDays, buildAreaInfos, buildDayLog, buildPath, countdownText, dayMinutes,
  launchFor, requeueByDay, requeueCap, type AreaInfo, type DayLog, type PathInput, type PathPlan,
} from '../src/bank/path';
import {
  BankPersistence, bankReducer, emptyBankState, exportBank, importBank, isDayString, type KV,
} from '../src/bank/store';
import { dayKey } from '../src/bank/clock';
import type { Area, BankItem, Difficulty } from '../src/bank/schema';
import type { AttemptRecord } from '../src/bank/types2';

const TODAY = '2026-03-10';
const NP: Area[] = ['NP1', 'NP2', 'NP3', 'NP4', 'NP5'];

function areas(over: Partial<Record<Area, Partial<AreaInfo>>> = {}): AreaInfo[] {
  return NP.map((area, i) => ({
    area, answered: 40, percent: 50 + i * 10, band: 'building' as const, bankCount: 200, weakTopics: [], ...over[area],
  }));
}

function input(o: Partial<PathInput> = {}): PathInput {
  return { today: TODAY, areas: areas(), diagnosticTaken: true, requeueByDay: {}, log: {}, ...o };
}

const emptyLog = (): DayLog => ({ byArea: {}, byTopic: {}, practice: 0, requeue: 0, mock: {}, diagnostic: 0 });
const practiced = (n: number, area: Area = 'NP1'): DayLog => ({ ...emptyLog(), practice: n, byArea: { [area]: n } });
const dayTasks = (p: PathPlan, d: string) => p.tasks.filter((t) => t.day === d);

describe('countdown text', () => {
  it('covers none, far, near, tomorrow, today, past and bad input', () => {
    expect(countdownText(TODAY)).toBe('No exam date set');
    expect(countdownText(TODAY, 'nonsense')).toBe('No exam date set');
    expect(countdownText(TODAY, '2026-03-11')).toBe('Your exam is tomorrow');
    expect(countdownText(TODAY, TODAY)).toBe('Exam day is today');
    expect(countdownText(TODAY, '2026-03-17')).toBe('7 days to go');
    expect(countdownText(TODAY, '2026-05-09')).toBe('60 days to go (about 9 weeks)');
    expect(countdownText(TODAY, '2026-03-09')).toBe('Your exam date passed 1 day ago');
    expect(countdownText(TODAY, '2026-03-05')).toBe('Your exam date passed 5 days ago');
  });
});

describe('rolling plan (no exam date)', () => {
  const plan = buildPath(input());
  it('covers 7 days from today with one weekly mock', () => {
    expect(plan.status).toBe('rolling');
    expect(plan.countdown).toBe('No exam date set');
    const days = new Set(plan.tasks.map((t) => t.day));
    expect(days.size).toBe(7);
    expect(plan.tasks.filter((t) => t.kind === 'mock')).toHaveLength(1);
    expect(plan.todayTasks.length).toBeGreaterThan(0);
  });
  it('is deterministic', () => {
    expect(buildPath(input())).toEqual(plan);
  });
  it('no day exceeds the daily minutes and tasks use the documented titles', () => {
    for (const d of new Set(plan.tasks.map((t) => t.day))) {
      const mock = dayTasks(plan, d).some((t) => t.kind === 'mock');
      expect(dayMinutes(plan, d)).toBeLessThanOrEqual(mock ? 120 : 60);
    }
    expect(plan.tasks.some((t) => /^Practice \d+ questions in NP\d/.test(t.title))).toBe(true);
    expect(plan.tasks.some((t) => /^Weekly mock board \(NP\d\)$/.test(t.title))).toBe(true);
    expect(plan.tasks.some((t) => /^Review notes: /.test(t.title))).toBe(true);
  });
  it('weak topics are named in the practice title', () => {
    const p = buildPath(input({ areas: areas({ NP1: { percent: 20, weakTopics: [{ topic: 'Triage' }, { topic: 'Burns' }] } }) }));
    expect(p.tasks.some((t) => t.title.endsWith('in NP1 weak topics: Triage, Burns'))).toBe(true);
  });
  it('the weakest area gets the most days', () => {
    const count = (a: Area) => buildPath(input({ areas: areas({ NP4: { percent: 10 } }) })).tasks.filter((t) => t.kind === 'practice' && t.area === a).length;
    expect(count('NP4')).toBeGreaterThanOrEqual(count('NP2'));
  });
  it('a bigger daily budget gives more questions', () => {
    const q = (m: number) => buildPath(input({ minutes: m })).todayTasks.filter((t) => t.kind === 'practice').reduce((s, t) => s + t.target, 0);
    expect(q(120)).toBeGreaterThan(q(30));
  });
});

describe('exam date cases', () => {
  it('far exam: shows 14 days, mocks only a whole number of weeks before the exam', () => {
    const exam = addDays(TODAY, 60);
    const p = buildPath(input({ examDate: exam }));
    expect(p.status).toBe('exam-far');
    expect(new Set(p.tasks.map((t) => t.day)).size).toBe(14);
    for (const t of p.tasks.filter((x) => x.kind === 'mock')) {
      const D = Math.round((Date.parse(exam) - Date.parse(t.day)) / 86400000);
      expect(D % 7).toBe(0);
    }
  });
  it('exam in 5 days: ends with taper days and an exam-day rest, no mock, nothing after', () => {
    const exam = addDays(TODAY, 5);
    const p = buildPath(input({ examDate: exam }));
    expect(p.status).toBe('exam-soon');
    expect(p.tasks.filter((t) => t.kind === 'mock')).toHaveLength(0);
    expect(dayTasks(p, exam).map((t) => t.kind)).toEqual(['rest']);
    expect(p.tasks.every((t) => t.day <= exam)).toBe(true);
    for (const d of [addDays(exam, -1), addDays(exam, -2)]) {
      const prac = dayTasks(p, d).filter((t) => t.kind === 'practice');
      expect(prac[0].target).toBe(10);
      expect(dayTasks(p, d).some((t) => t.kind === 'review')).toBe(false);
    }
  });
  it('exam in exactly 7 days puts a mock today', () => {
    const p = buildPath(input({ examDate: addDays(TODAY, 7) }));
    expect(p.todayTasks.map((t) => t.kind)).toEqual(['mock']);
  });
  it('exam today: a single rest task', () => {
    const p = buildPath(input({ examDate: TODAY }));
    expect(p.status).toBe('exam-today');
    expect(p.tasks.map((t) => t.kind)).toEqual(['rest']);
    expect(p.countdown).toBe('Exam day is today');
  });
  it('exam in the past: rolling week plus a note', () => {
    const p = buildPath(input({ examDate: '2026-03-01' }));
    expect(p.status).toBe('exam-past');
    expect(p.tasks.length).toBeGreaterThan(0);
    expect(p.note).toMatch(/passed/);
    expect(p.countdown).toMatch(/passed 9 days ago/);
  });
  it('an invalid exam date is ignored', () => {
    const p = buildPath(input({ examDate: '2026-13-45' }));
    expect(p.status).toBe('rolling');
    expect(p.examDate).toBeNull();
  });
});

describe('states and completion', () => {
  it('today is Today until its questions are answered, later days are Up next', () => {
    const p = buildPath(input());
    expect(p.todayTasks.every((t) => t.state === 'today')).toBe(true);
    expect(p.upNext.every((t) => t.day > TODAY)).toBe(true);
    expect(p.attention).toHaveLength(0);
  });
  it('answering the target makes a practice task Done', () => {
    const base = buildPath(input());
    const task = base.todayTasks.find((t) => t.kind === 'practice');
    if (!task || !task.area) throw new Error('no practice task today');
    const done = buildPath(input({ log: { [TODAY]: practiced(task.target, task.area) } }));
    expect(done.todayTasks.find((t) => t.id === task.id)?.state).toBe('done');
    const half = buildPath(input({ log: { [TODAY]: practiced(Math.floor(task.target / 2), task.area) } }));
    expect(half.todayTasks.find((t) => t.id === task.id)).toMatchObject({ state: 'today' });
    expect(half.todayTasks.find((t) => t.id === task.id)?.done).toBe(Math.floor(task.target / 2));
  });
  it('practising the wrong area does not finish today\'s area task', () => {
    const base = buildPath(input());
    const task = base.todayTasks.find((t) => t.kind === 'practice');
    if (!task || !task.area) throw new Error('no practice task today');
    const other = NP.find((a) => a !== task.area) as Area;
    const p = buildPath(input({ log: { [TODAY]: practiced(task.target, other) } }));
    expect(p.todayTasks.find((t) => t.id === task.id)?.state).toBe('today');
  });
  it('the diagnostic is offered once and is done by 25 answers', () => {
    const p = buildPath(input({ diagnosticTaken: false }));
    expect(p.todayTasks[0].kind).toBe('diagnostic');
    const d = buildPath(input({ diagnosticTaken: false, log: { [TODAY]: { ...emptyLog(), diagnostic: 25 } } }));
    expect(d.todayTasks[0].state).toBe('done');
    expect(buildPath(input()).tasks.some((t) => t.kind === 'diagnostic')).toBe(false);
  });
  it('a missed-question task is Done when cleared', () => {
    const p = buildPath(input({ requeueByDay: { [TODAY]: 5 } }));
    const t = p.todayTasks.find((x) => x.kind === 'requeue');
    expect(t).toMatchObject({ target: 5, state: 'today', title: 'Clear 5 missed questions' });
    const cleared = buildPath(input({ requeueByDay: { [TODAY]: 0 }, log: { [TODAY]: { ...emptyLog(), requeue: 5 } } }));
    expect(cleared.todayTasks.find((x) => x.kind === 'requeue')).toBeUndefined();
  });
  it('mock is done at 80% of its questions', () => {
    const exam = addDays(TODAY, 7);
    const p = buildPath(input({ examDate: exam }));
    const m = p.todayTasks[0];
    const done = buildPath(input({ examDate: exam, log: { [TODAY]: { ...emptyLog(), mock: { [m.area as Area]: Math.ceil(m.target * 0.8) } } } }));
    expect(done.todayTasks[0].state).toBe('done');
  });
});

describe('missed days and catch-up', () => {
  const start = addDays(TODAY, -3);
  const missed = buildPath(input({ startDay: start }));
  it('unfinished past tasks need attention', () => {
    expect(missed.attention.length).toBeGreaterThan(0);
    expect(missed.attention.every((t) => t.day < TODAY)).toBe(true);
    expect(missed.attention.every((t) => t.kind !== 'requeue' && t.kind !== 'diagnostic')).toBe(true);
  });
  it('catch-up redistributes questions and no day goes over 1.5x the daily load', () => {
    const added = missed.tasks.filter((t) => t.catchUp > 0);
    expect(added.length).toBeGreaterThan(0);
    const cap = Math.floor((CATCH_UP_SHARE * 60) / MIN_PER_QUESTION);
    for (const t of added) expect(t.catchUp).toBeLessThanOrEqual(cap);
    for (const d of new Set(missed.tasks.map((t) => t.day))) {
      if (d >= TODAY && !dayTasks(missed, d).some((t) => t.kind === 'mock')) expect(dayMinutes(missed, d)).toBeLessThanOrEqual(90 + 1);
    }
    expect(missed.todayTasks.find((t) => t.kind === 'practice')?.title).toMatch(/includes \d+ catch-up/);
  });
  it('catch-up questions never exceed what was missed', () => {
    const owed = missed.attention.filter((t) => t.kind === 'practice' || t.kind === 'review').reduce((s, t) => s + (t.target - t.done), 0);
    const extra = missed.tasks.reduce((s, t) => s + t.catchUp, 0) + missed.droppedQuestions;
    expect(extra).toBe(owed);
  });
  it('extra work done today clears the oldest overdue task first', () => {
    const today = missed.todayTasks.find((t) => t.kind === 'practice');
    if (!today || !today.area) throw new Error('no practice task');
    const oldest = missed.attention[0];
    const bonus = oldest.target;
    const p = buildPath(input({ startDay: start, log: { [TODAY]: practiced(today.target - today.catchUp + bonus, today.area) } }));
    expect(p.tasks.find((t) => t.id === oldest.id)?.state).toBe('done');
  });
  it('a past day that was studied is Done, not overdue', () => {
    const y = addDays(TODAY, -1);
    const p = buildPath(input({ startDay: y, log: { [y]: practiced(100) } }));
    expect(p.attention).toHaveLength(0);
    expect(dayTasks(p, y).every((t) => t.state === 'done')).toBe(true);
  });
  it('huge backlog is trimmed and reported, never over 1.5x', () => {
    const p = buildPath(input({ startDay: addDays(TODAY, -30), examDate: addDays(TODAY, 3) }));
    for (const d of new Set(p.tasks.map((t) => t.day))) {
      if (d >= TODAY && !dayTasks(p, d).some((t) => t.kind === 'mock')) expect(dayMinutes(p, d)).toBeLessThanOrEqual(91);
    }
    expect(p.droppedQuestions).toBeGreaterThanOrEqual(0);
  });
  it('the look-back is capped at 7 days', () => {
    const p = buildPath(input({ startDay: addDays(TODAY, -40) }));
    expect(Math.min(...p.tasks.map((t) => t.day === TODAY ? 0 : Date.parse(t.day) / 86400000 - Date.parse(TODAY) / 86400000))).toBe(-7);
  });
});

describe('missed-question backlog', () => {
  it('caps the daily clearing and carries the rest forward', () => {
    const cap = requeueCap(60);
    expect(cap).toBe(8);
    const p = buildPath(input({ requeueByDay: { [TODAY]: 20 } }));
    const taken = p.tasks.filter((t) => t.kind === 'requeue').map((t) => t.target);
    expect(taken[0]).toBe(8);
    expect(taken.reduce((a, b) => a + b, 0)).toBe(20);
    expect(Math.max(...taken)).toBeLessThanOrEqual(cap);
  });
  it('requeueByDay lumps overdue into today and drops unknown ids', () => {
    const map = { a: { stage: 0, due: '2026-03-01' }, b: { stage: 0, due: TODAY }, c: { stage: 1, due: '2026-03-12' }, d: { stage: 0, due: TODAY } };
    expect(requeueByDay(map, TODAY, new Set(['a', 'b', 'c']))).toEqual({ [TODAY]: 2, '2026-03-12': 1 });
  });
});

describe('edge cases', () => {
  it('an empty bank gives a note and no practice', () => {
    const p = buildPath(input({ areas: areas({ NP1: { bankCount: 0 }, NP2: { bankCount: 0 }, NP3: { bankCount: 0 }, NP4: { bankCount: 0 }, NP5: { bankCount: 0 } }) }));
    expect(p.tasks.filter((t) => t.kind === 'practice' || t.kind === 'mock')).toHaveLength(0);
    expect(p.note).toMatch(/No questions/);
  });
  it('a small budget still plans in blocks of 5 within the minutes', () => {
    const p = buildPath(input({ minutes: 15 }));
    for (const d of new Set(p.tasks.map((t) => t.day))) {
      if (!dayTasks(p, d).some((t) => t.kind === 'mock')) expect(dayMinutes(p, d)).toBeLessThanOrEqual(15);
    }
    expect(p.tasks.filter((t) => t.kind === 'practice').every((t) => t.target % 5 === 0)).toBe(true);
  });
  it('buildDayLog groups attempts by Manila day and mode', () => {
    const at = (mode: string | undefined, area: Area, t: number): AttemptRecord => ({
      itemId: 'i', credit: 1, seconds: 1, at: t, area, topic: 'T', strategy: '', mode: mode as AttemptRecord['mode'],
    });
    const noon = Date.parse('2026-03-10T04:00:00Z');
    const log = buildDayLog([at('quick', 'NP1', noon), at('requeue', 'NP1', noon), at('mock', 'NP2', noon), at('diagnostic', 'NP3', noon)]);
    expect(Object.keys(log)).toEqual([dayKey(noon)]);
    expect(log[TODAY]).toMatchObject({ practice: 1, requeue: 1, diagnostic: 1, mock: { NP2: 1 }, byArea: { NP1: 1 } });
  });
  it('buildAreaInfos lists the weakest topics and locks readiness under 30 answers', () => {
    const mk = (id: string, topic: string): BankItem => ({
      id, v: 2, type: 'single', area: 'NP1', topic, noteId: `n-${topic}`, vignette: '', stem: '', options: [], answer: [0], rationale: '',
      optionRationales: [], strategy: '', difficulty: 3 as Difficulty, source: 'bank', review: 'unreviewed', aiWritten: true,
    });
    const items = [mk('1', 'A'), mk('2', 'B')];
    const at = (id: string, topic: string, credit: number): AttemptRecord => ({ itemId: id, credit, seconds: 1, at: 1, area: 'NP1', topic, strategy: '' });
    const info = buildAreaInfos(items, [at('1', 'A', 0), at('1', 'A', 0), at('2', 'B', 1), at('2', 'B', 1)], 2, (n) => `bundle ${n}`);
    const np1 = info.find((a) => a.area === 'NP1') as AreaInfo;
    expect(np1.percent).toBeNull();
    expect(np1.weakTopics).toEqual([{ topic: 'A', bundle: 'bundle n-A' }]);
    expect(np1.bankCount).toBe(2);
  });
});

describe('launching tasks', () => {
  it('maps each kind to a session and nothing for done or rest tasks', () => {
    const p = buildPath(input({ diagnosticTaken: false, requeueByDay: { [TODAY]: 3 }, examDate: addDays(TODAY, 6) }));
    expect(launchFor(p.todayTasks.find((t) => t.kind === 'diagnostic') as never)).toEqual({ kind: 'diagnostic' });
    expect(launchFor(p.todayTasks.find((t) => t.kind === 'requeue') as never)).toEqual({ kind: 'requeue' });
    const prac = buildPath(input()).todayTasks.find((t) => t.kind === 'practice');
    expect(prac).toBeDefined();
    expect(launchFor(prac as never)).toMatchObject({ kind: 'practice', area: prac?.area });
    const mockPlan = buildPath(input({ examDate: addDays(TODAY, 7) }));
    expect(launchFor(mockPlan.todayTasks[0])).toMatchObject({ kind: 'mock' });
    expect(launchFor({ ...mockPlan.todayTasks[0], state: 'done' })).toBeNull();
    expect(launchFor(buildPath(input({ examDate: TODAY })).todayTasks[0])).toBeNull();
  });
});

describe('exam date in the bank store', () => {
  it('defaults to none, sets, ignores bad dates, and clears', () => {
    const s0 = emptyBankState();
    expect(s0.examDate).toBeUndefined();
    const s1 = bankReducer(s0, { type: 'exam/set', date: '2026-09-01' });
    expect(s1.examDate).toBe('2026-09-01');
    expect(bankReducer(s1, { type: 'exam/set', date: 'soon' })).toBe(s1);
    expect(bankReducer(s1, { type: 'exam/set', date: '2026-02-30' })).toBe(s1);
    expect(bankReducer(s1, { type: 'exam/set', date: '2026-09-01' })).toBe(s1);
    const s2 = bankReducer(s1, { type: 'exam/set', date: null });
    expect(s2.examDate).toBeUndefined();
    expect('examDate' in s2).toBe(false);
    expect(bankReducer(s0, { type: 'exam/set', date: null })).toBe(s0);
  });
  it('minutes are clamped and stored', () => {
    const s = bankReducer(emptyBankState(), { type: 'path/minutes', minutes: 5 });
    expect(s.pathMinutes).toBe(15);
    expect(bankReducer(s, { type: 'path/minutes', minutes: 9999 }).pathMinutes).toBe(240);
    expect(bankReducer(s, { type: 'path/minutes', minutes: NaN })).toBe(s);
  });
  it('survives backup export/import and rejects a bad imported date', () => {
    let s = bankReducer(emptyBankState(), { type: 'exam/set', date: '2026-09-01' });
    s = bankReducer(s, { type: 'path/minutes', minutes: 90 });
    const back = importBank(JSON.parse(JSON.stringify(exportBank(s))));
    expect(back.examDate).toBe('2026-09-01');
    expect(back.pathMinutes).toBe(90);
    expect(importBank({ state: { examDate: 'garbage' } }).examDate).toBeUndefined();
    expect(importBank({}).examDate).toBeUndefined();
  });
  it('is saved and loaded through persistence', async () => {
    const data = new Map<string, string>();
    const kv: KV = {
      getItem: async (k) => data.get(k) ?? null,
      setItem: async (k, v) => { data.set(k, v); },
      removeItem: async (k) => { data.delete(k); },
    };
    const prev = emptyBankState();
    const next = bankReducer(bankReducer(prev, { type: 'exam/set', date: '2026-09-01' }), { type: 'path/minutes', minutes: 75 });
    await new BankPersistence(kv).saveDiff(prev, next);
    const loaded = await new BankPersistence(kv).load();
    expect(loaded.examDate).toBe('2026-09-01');
    expect(loaded.pathMinutes).toBe(75);
    expect(isDayString('2026-09-01')).toBe(true);
    expect(isDayString('2026-9-1')).toBe(false);
  });
});
