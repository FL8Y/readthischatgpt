import { describe, expect, it } from 'vitest';
import { BANK } from '../src/bank/loader';
import { answerItem, createSession } from '../src/bank/session';
import { bankReducer, emptyBankState, importBank, type BankState } from '../src/bank/store';
import { buildExport, validateBackup } from '../src/core/backup';
import {
  attachBank, bankFromExtras, buildTree, changedAnswerId, clampMinutes, defaultCustom, historyFromState, hubStats, levelFor,
  mockSummary, planNotice, planSession, resumeDecision, sessionFromPlan, toAttemptRecords, toggleAll,
  type PlanContext,
} from '../src/ui/practice/practiceFlow';

const items = BANK.items;
const byId = BANK.byId;
const T0 = Date.parse('2026-03-10T02:00:00Z');
const ctx = (over: Partial<PlanContext> = {}): PlanContext => ({ items, attempts: [], seed: 'x', ...over });
const single = items.find((i) => i.type === 'single')!;

function emptyApp() {
  return {
    folders: [], topics: [], sources: [], chunks: [], events: [], diagnosticsDone: [],
    settings: { provider: 'manual' as const, model: 'm', apiKey: '' },
  };
}

describe('mode setup -> selection params', () => {
  it('quick and smart return the requested count, reveal now, no timer', () => {
    for (const kind of ['quick', 'smart'] as const) {
      const p = planSession({ kind, count: 10 }, ctx());
      expect(p.mode).toBe(kind);
      expect(p.ids).toHaveLength(10);
      expect(p.revealMode).toBe('now');
      expect(p.limitSeconds).toBeUndefined();
    }
  });

  it('diagnostic is 25 items, 5 per NP area, with per-question feedback', () => {
    const p = planSession({ kind: 'diagnostic' }, ctx());
    expect(p.mode).toBe('diagnostic');
    expect(p.revealMode).toBe('now');
    expect(p.ids.length).toBe(25);
    const areas = p.ids.map((id) => byId.get(id)!.area);
    for (const a of ['NP1', 'NP2', 'NP3', 'NP4', 'NP5']) expect(areas.filter((x) => x === a)).toHaveLength(5);
  });

  it('mock is one area, reveal at end, 120 minutes, capped at 100', () => {
    const p = planSession({ kind: 'mock', area: 'NP3' }, ctx());
    expect(p.mode).toBe('mock');
    expect(p.revealMode).toBe('end');
    expect(p.limitSeconds).toBe(7200);
    expect(p.ids.every((id) => byId.get(id)!.area === 'NP3')).toBe(true);
    const available = items.filter((i) => i.area === 'NP3').length;
    expect(p.ids.length).toBe(Math.min(100, available));
  });

  it('mock is short when the area has fewer than 100 items', () => {
    const few = items.filter((i) => i.area === 'NP1').slice(0, 7);
    const p = planSession({ kind: 'mock', area: 'NP1' }, ctx({ items: few }));
    expect(p.ids).toHaveLength(7);
    expect(mockSummary(7)).toContain('short mock');
    expect(mockSummary(150)).not.toContain('short mock');
    expect(mockSummary(0)).toMatch(/No questions/);
  });

  it('custom carries topics, timer minutes (clamped) and reveal timing', () => {
    const topic = single.topic;
    const v = { ...defaultCustom(), topics: [topic], count: 10, timerOn: true, minutes: 500, reveal: 'end' as const };
    const p = planSession({ kind: 'custom', values: v }, ctx());
    expect(p.mode).toBe('custom');
    expect(p.revealMode).toBe('end');
    expect(p.limitSeconds).toBe(120 * 60);
    expect(p.ids.length).toBeGreaterThan(0);
    expect(p.ids.every((id) => byId.get(id)!.topic === topic)).toBe(true);
    expect(clampMinutes(1)).toBe(5);
    expect(clampMinutes(NaN)).toBe(5);
    const off = planSession({ kind: 'custom', values: { ...v, timerOn: false } }, ctx());
    expect(off.limitSeconds).toBeUndefined();
  });

  it('custom filters: unseen drops answered items, flagged keeps only flagged', () => {
    const attempts = toAttemptRecords([{ itemId: single.id, t: T0, credit: 1, correct: true, selected: single.answer, seconds: 5 }], byId);
    const unseen = planSession({ kind: 'custom', values: { ...defaultCustom(), count: 100, filters: ['unseen'] } }, ctx({ attempts }));
    expect(unseen.ids).not.toContain(single.id);
    const flagged = planSession(
      { kind: 'custom', values: { ...defaultCustom(), count: 100, filters: ['flagged'] } },
      ctx({ flaggedIds: [single.id] }),
    );
    expect(flagged.ids).toEqual([single.id]);
  });

  it('requeue uses exactly the due ids; weak needs evidence; notices explain empty or short plans', () => {
    const p = planSession({ kind: 'requeue' }, ctx({ dueIds: [single.id, 'gone'] }));
    expect(p.ids).toEqual([single.id]);
    const w = planSession({ kind: 'weak', count: 10 }, ctx());
    expect(w.ids).toEqual([]);
    expect(planNotice(w, 'Weak spots')).toMatch(/No questions/);
    expect(planNotice(p, 'x')).toBeNull();
    expect(planNotice({ ...p, short: true, requested: 5 }, 'x')).toMatch(/Only 1 of 5/);
  });

  it('sessionFromPlan applies reveal mode and the timer limit', () => {
    const p = planSession({ kind: 'mock', area: 'NP2' }, ctx());
    const s = sessionFromPlan(p, 'mock-1', T0);
    expect(s.revealMode).toBe('end');
    expect(s.timer.limitSeconds).toBe(7200);
    expect(s.order).toEqual(p.ids);
  });
});

describe('resume decision', () => {
  const s = createSession({ id: 's', mode: 'quick', itemIds: [single.id], now: T0 });
  it('resumes an active session whose items all exist', () => {
    expect(resumeDecision(s, byId)).toEqual({ kind: 'resume', answered: 0, total: 1 });
  });
  it('ignores done or missing sessions and discards when items left the bank', () => {
    expect(resumeDecision(undefined, byId).kind).toBe('none');
    expect(resumeDecision({ ...s, status: 'done' }, byId).kind).toBe('none');
    expect(resumeDecision({ ...s, order: ['gone'], itemIds: ['gone'] }, byId).kind).toBe('discard');
    expect(resumeDecision({ ...s, order: [], itemIds: [] }, byId).kind).toBe('discard');
  });
  it('detects which answer changed so the store records the attempt', () => {
    const next = answerItem(s, single, single.answer);
    expect(changedAnswerId(s, next)).toBe(single.id);
    expect(changedAnswerId(next, next)).toBeNull();
  });
});

describe('hub stats, tree, history, levels', () => {
  it('counts the bank and the due re-queue', () => {
    const st: BankState = { ...emptyBankState(), requeue: { [single.id]: { stage: 0, due: '2026-03-10' }, gone: { stage: 0, due: '2026-03-10' } } };
    const h = hubStats(items, st, [], '2026-03-10');
    expect(h.total).toBe(items.length);
    expect(h.requeueDue).toBe(1);
    expect(h.weakAvailable).toBe(false);
    expect(h.diagnosticTaken).toBe(false);
  });

  it('builds an area > bundle > topic tree whose counts add up', () => {
    const tree = buildTree(items, new Map(), {});
    expect(tree.reduce((n, a) => n + a.count, 0)).toBe(items.length);
    for (const a of tree) {
      expect(a.bundles.reduce((n, b) => n + b.count, 0)).toBe(a.count);
      for (const b of a.bundles) expect(b.topics.reduce((n, t) => n + t.count, 0)).toBe(b.count);
    }
    expect(toggleAll([], ['a', 'b'])).toEqual(['a', 'b']);
    expect(toggleAll(['a', 'b', 'c'], ['a', 'b'])).toEqual(['c']);
  });

  it('levels by percent', () => {
    expect([levelFor(10), levelFor(60), levelFor(90)]).toEqual(['Needs work', 'Building', 'Strong']);
  });

  it('history groups attempts by session and includes the saved session', () => {
    let st = bankReducer(emptyBankState(), {
      type: 'session/start', session: createSession({ id: 's1', mode: 'quick', itemIds: [single.id], now: T0 }),
    });
    st = bankReducer(st, { type: 'session/answer', item: single, selected: single.answer, now: T0 });
    const h = historyFromState(st, items);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ id: 's1', mode: 'quick', status: 'active', answered: 1, correct: 1 });
    const fin = bankReducer(st, { type: 'session/finish', now: T0 + 1000 });
    expect(historyFromState(fin, items)[0].status).toBe('done');
    expect(hubStats(items, fin, toAttemptRecords(fin.attempts, byId), '2026-03-10').seen).toBe(1);
  });
});

describe('backup with bank state', () => {
  const answered = (): BankState => {
    let st = bankReducer(emptyBankState(), {
      type: 'session/start', session: createSession({ id: 's1', mode: 'quick', itemIds: [single.id], now: T0 }),
    });
    st = bankReducer(st, { type: 'session/answer', item: single, selected: [(single.answer[0] + 1) % 4], now: T0 });
    st = bankReducer(st, { type: 'flag/set', id: single.id, flagged: true });
    return bankReducer(st, { type: 'goal/set', goal: 30 });
  };

  it('round-trips attempts, flags, mastery and re-queue through export and import', () => {
    const st = answered();
    const text = attachBank(buildExport(emptyApp(), {}), st);
    const r = validateBackup(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const back = bankFromExtras(r.extras);
    expect(back).toBeDefined();
    const { session: _s, ...expected } = st;
    expect(back).toEqual(importBank({ state: expected }));
    expect(back!.attempts).toHaveLength(1);
    expect(back!.flags[single.id]).toBe(true);
    expect(back!.dailyGoal).toBe(30);
    expect(back!.requeue[single.id]).toBeDefined();
    expect(back!.session).toBeUndefined();
  });

  it('keeps lessons and tutor extras next to the bank', () => {
    const text = attachBank(buildExport(emptyApp(), { lessons: { a: 1 }, tutor: { m: [] } }), answered());
    const r = validateBackup(text);
    expect(r.ok && r.extras.lessons).toEqual({ a: 1 });
    expect(r.ok && r.extras.tutor).toEqual({ m: [] });
  });

  it('an old backup (no bank) still imports and leaves the bank untouched', () => {
    const old = JSON.stringify({ ...emptyApp(), extras: { lessons: { a: 1 }, srs: { cards: [] } } });
    const r = validateBackup(old);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(bankFromExtras(r.extras)).toBeUndefined();
    const older = validateBackup(JSON.stringify(emptyApp()));
    expect(older.ok && bankFromExtras(older.extras)).toBeFalsy();
  });

  it('a malformed bank extra imports as an empty bank instead of throwing', () => {
    const text = JSON.stringify({ ...emptyApp(), extras: { bank: { v: 1, state: { attempts: 'nope', flags: 5 } } } });
    const r = validateBackup(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(bankFromExtras(r.extras)).toEqual(emptyBankState());
  });

  it('attachBank leaves non-object input alone', () => {
    expect(attachBank('not json', emptyBankState())).toBe('not json');
  });
});
