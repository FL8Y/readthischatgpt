import { describe, expect, it } from 'vitest';
import { BANK, buildBank, getItem, setUserItems, bankCounts, itemsByArea } from '../src/bank/loader';
import { PACKS } from '../src/bank/packs.generated';
import {
  BANK_EXTRA_KEYS, BankPersistence, BankStore, bankReducer, emptyBankState, exportBank, importBank,
  masteryOf, shardArray, answeredOnDay, KEY_SESSION, keyAttempts, type BankState, type KV,
} from '../src/bank/store';
import { applyAnswer, dueItems, nextDue, weakItems, type AttemptRec } from '../src/bank/requeue';
import { createSession } from '../src/bank/session';
import { dayKey } from '../src/bank/clock';
import type { BankItem } from '../src/bank/schema';

class MemKV implements KV {
  data = new Map<string, string>();
  writes: string[] = [];
  async getItem(k: string) { return this.data.get(k) ?? null; }
  async setItem(k: string, v: string) { this.data.set(k, v); this.writes.push(k); }
  async removeItem(k: string) { this.data.delete(k); }
}

const GOLD = BANK.items.filter((i) => i.type === 'single');
const item0 = GOLD[0];
const correctOf = (it: BankItem) => it.answer;
const wrongOf = (it: BankItem) => [it.options.findIndex((_, i) => !it.answer.includes(i))];
const T0 = Date.parse('2026-03-10T02:00:00Z'); // Manila 10:00 on 2026-03-10

function started(ids: string[], mode: 'quick' | 'mock' = 'quick'): BankState {
  return bankReducer(emptyBankState(), {
    type: 'session/start', session: createSession({ id: 's1', mode, itemIds: ids, now: T0 }),
  });
}

describe('loader', () => {
  it('loads gold plus the bundled pack files with nothing rejected', () => {
    expect(Array.isArray(PACKS)).toBe(true);
    expect(BANK.items.length).toBeGreaterThanOrEqual(100);
    expect(BANK.rejected).toEqual([]);
    expect(getItem(item0.id)).toBe(item0);
    expect(itemsByArea('NP1').length).toBeGreaterThan(0);
    expect(bankCounts().total).toBe(BANK.items.length);
  });

  it('rejects invalid items without throwing and dedupes by id', () => {
    const bad = { ...item0, id: 'bad-1', options: ['only one'] } as BankItem;
    const dup = { ...item0, stem: 'a changed copy of the stem that should lose' } as BankItem;
    const userDup = { ...item0, source: 'user-ai' as const, stem: 'user version replaces it' };
    const b = buildBank([
      { name: 'a', items: [item0, bad, null, 5, { nope: true }] },
      { name: 'b', items: [dup] },
      { name: 'notarray', items: 'x' },
    ], []);
    expect(b.items.map((i) => i.id)).toEqual([item0.id]);
    expect(b.rejected.length).toBe(4);
    expect(b.duplicateIds).toEqual([item0.id]);
    expect(b.byId.get(item0.id)?.stem).toBe(item0.stem);
    const b2 = buildBank([{ name: 'a', items: [item0] }, { name: 'u', items: [userDup], user: true }], []);
    expect(b2.byId.get(item0.id)?.stem).toBe('user version replaces it');
    expect(b2.items.length).toBe(1);
  });

  it('indexes by bundle through noteId', () => {
    const withNote = { ...item0, id: 'n-1', noteId: 'np1-chn-basics' } as BankItem;
    const b = buildBank([{ name: 'a', items: [withNote] }], [{ id: 'chn', notes: ['np1-chn-basics'] }]);
    expect(b.byBundle.get('chn')?.map((i) => i.id)).toEqual(['n-1']);
  });

  it('setUserItems adds valid user items to BANK', () => {
    const u = { ...item0, id: 'u-abc12345', source: 'user-paste' as const };
    const nb = setUserItems([u, { id: 'junk' }]);
    expect(nb.byId.has('u-abc12345')).toBe(true);
    expect(nb.rejected.length).toBe(1);
    setUserItems([]);
    expect(getItem('u-abc12345')).toBeUndefined();
  });
});

describe('reducer', () => {
  it('records attempt, mastery and re-queue on a wrong then right answer', () => {
    let s = started([item0.id]);
    s = bankReducer(s, { type: 'session/answer', item: item0, selected: wrongOf(item0), now: T0 });
    expect(s.attempts).toHaveLength(1);
    expect(s.attempts[0].credit).toBe(0);
    expect(s.requeue[item0.id]).toEqual({ stage: 0, due: '2026-03-11' });
    expect(masteryOf(s, item0.id)).toBe('learning');
    const again = bankReducer(s, { type: 'session/answer', item: item0, selected: correctOf(item0), now: T0 });
    expect(again).toBe(s); // locked after first answer in reveal-now mode
  });

  it('mastery climbs with consecutive full credit and respects override', () => {
    let s = emptyBankState();
    for (let i = 0; i < 3; i++) {
      s = bankReducer(s, { type: 'session/start', session: createSession({ id: `s${i}`, mode: 'quick', itemIds: [item0.id], now: T0 }) });
      s = bankReducer(s, { type: 'session/answer', item: item0, selected: correctOf(item0), now: T0 + i });
      expect(masteryOf(s, item0.id)).toBe(i === 0 ? 'reviewing' : i === 1 ? 'reviewing' : 'mastered');
    }
    s = bankReducer(s, { type: 'mastery/override', id: item0.id, level: 'learning' });
    expect(masteryOf(s, item0.id)).toBe('learning');
    s = bankReducer(s, { type: 'mastery/override', id: item0.id, level: null });
    expect(masteryOf(s, item0.id)).toBe('mastered');
  });

  it('mock sessions record attempts only on finish', () => {
    let s = started([item0.id], 'mock');
    s = bankReducer(s, { type: 'session/answer', item: item0, selected: wrongOf(item0), now: T0 });
    s = bankReducer(s, { type: 'session/answer', item: item0, selected: correctOf(item0), now: T0 }); // change allowed
    expect(s.attempts).toHaveLength(0);
    s = bankReducer(s, { type: 'session/finish', now: T0 + 5000 });
    expect(s.attempts).toHaveLength(1);
    expect(s.attempts[0].correct).toBe(true);
    expect(s.session?.status).toBe('done');
  });

  it('flags, notes, struck, reports, goal, user items', () => {
    let s = emptyBankState();
    s = bankReducer(s, { type: 'flag/set', id: 'a', flagged: true });
    expect(s.flags).toEqual({ a: true });
    s = bankReducer(s, { type: 'flag/set', id: 'a', flagged: false });
    expect(s.flags).toEqual({});
    s = bankReducer(s, { type: 'item/note', id: 'a', note: 'hi' });
    s = bankReducer(s, { type: 'item/struck', id: 'a', struck: [1, 2] });
    expect(s.itemNotes.a).toEqual({ note: 'hi', struck: [1, 2] });
    s = bankReducer(s, { type: 'report/add', id: 'r1', itemId: 'a', text: 'typo', now: T0 });
    s = bankReducer(s, { type: 'report/resolve', id: 'r1' });
    expect(s.reports[0].resolved).toBe(true);
    s = bankReducer(s, { type: 'goal/set', goal: 35.4 });
    expect(s.dailyGoal).toBe(35);
    s = bankReducer(s, { type: 'userItems/add', items: [{ ...item0, id: 'u-1' } as BankItem] });
    s = bankReducer(s, { type: 'userItems/add', items: [{ ...item0, id: 'u-1', stem: 'new' } as BankItem] });
    expect(s.userItems).toHaveLength(1);
    s = bankReducer(s, { type: 'userItems/remove', id: 'u-1' });
    expect(s.userItems).toHaveLength(0);
  });

  it('export then import round trips (without the session)', () => {
    let s = started([item0.id]);
    s = bankReducer(s, { type: 'session/answer', item: item0, selected: wrongOf(item0), now: T0 });
    s = bankReducer(s, { type: 'flag/set', id: item0.id, flagged: true });
    const back = importBank(JSON.parse(JSON.stringify(exportBank(s))));
    expect(back.attempts).toEqual(s.attempts);
    expect(back.requeue).toEqual(s.requeue);
    expect(back.flags).toEqual(s.flags);
    expect(back.session).toBeUndefined();
    expect(importBank('garbage')).toEqual(emptyBankState());
    expect(BANK_EXTRA_KEYS).toEqual(['bank']);
  });

  it('counts answers per Manila day', () => {
    let s = started([item0.id]);
    s = bankReducer(s, { type: 'session/answer', item: item0, selected: correctOf(item0), now: T0 });
    expect(answeredOnDay(s, '2026-03-10')).toBe(1);
    expect(answeredOnDay(s, '2026-03-11')).toBe(0);
  });
});

describe('requeue', () => {
  const T = (iso: string) => dayKey(Date.parse(iso));

  it('steps 1, 3, 7, 21 days and graduates', () => {
    let m = applyAnswer({}, 'q', 0, '2026-03-10');
    expect(m.q).toEqual({ stage: 0, due: '2026-03-11' });
    m = applyAnswer(m, 'q', 1, '2026-03-11');
    expect(m.q).toEqual({ stage: 1, due: '2026-03-14' });
    m = applyAnswer(m, 'q', 1, '2026-03-14');
    expect(m.q).toEqual({ stage: 2, due: '2026-03-21' });
    m = applyAnswer(m, 'q', 1, '2026-03-21');
    expect(m.q).toEqual({ stage: 3, due: '2026-04-11' });
    m = applyAnswer(m, 'q', 1, '2026-04-11');
    expect(m.q).toBeUndefined();
  });

  it('a miss resets to 1 day; partial credit counts as a miss; first-try right is not queued', () => {
    let m = applyAnswer({}, 'q', 0, '2026-03-10');
    m = applyAnswer(m, 'q', 1, '2026-03-11');
    m = applyAnswer(m, 'q', 0.5, '2026-03-14');
    expect(m.q).toEqual({ stage: 0, due: '2026-03-15' });
    expect(applyAnswer({}, 'z', 1, '2026-03-10')).toEqual({});
  });

  it('is due across Manila midnight, not UTC midnight', () => {
    // 2026-03-10 23:59 Manila = 15:59Z; 00:01 Manila next day = 16:01Z same UTC date
    const late = T('2026-03-10T15:59:00Z');
    const after = T('2026-03-10T16:01:00Z');
    expect(late).toBe('2026-03-10');
    expect(after).toBe('2026-03-11');
    const m = applyAnswer({}, 'q', 0, late);
    expect(dueItems(m, late)).toEqual([]);
    expect(dueItems(m, after)).toEqual(['q']);
    expect(nextDue(m)).toBe('2026-03-11');
    expect(nextDue({})).toBeNull();
  });

  it('orders due items most overdue first', () => {
    const m = { a: { stage: 0, due: '2026-03-09' }, b: { stage: 1, due: '2026-03-05' }, c: { stage: 0, due: '2026-03-30' } };
    expect(dueItems(m, '2026-03-10')).toEqual(['b', 'a']);
  });

  it('ranks weak items by recent, repeated misses', () => {
    const at = (itemId: string, daysAgo: number, credit: number): AttemptRec => ({
      itemId, t: T0 - daysAgo * 86400000, credit, correct: credit >= 1, selected: [0], seconds: 5,
    });
    const att = [at('old', 60, 0), at('fresh', 0, 0), at('twice', 1, 0), at('twice', 2, 0), at('good', 1, 1)];
    const w = weakItems(att, T0);
    expect(w.map((x) => x.itemId)).toEqual(['twice', 'fresh', 'old']);
    expect(weakItems(att, T0, 1)).toHaveLength(1);
  });
});

describe('persistence', () => {
  it('saves the session after every answer under one key and restores it', async () => {
    const kv = new MemKV();
    const store = new BankStore(new BankPersistence(kv));
    await store.init();
    await store.dispatch({ type: 'session/start', session: createSession({ id: 's9', mode: 'quick', itemIds: [GOLD[0].id, GOLD[1].id], now: T0 }) });
    kv.writes = [];
    await store.dispatch({ type: 'session/answer', item: GOLD[0], selected: wrongOf(GOLD[0]), now: T0 });
    expect(kv.writes[0]).toBe(KEY_SESSION);
    const saved = JSON.parse(kv.data.get(KEY_SESSION) as string);
    expect(saved.answeredIds).toEqual([GOLD[0].id]);

    const store2 = new BankStore(new BankPersistence(kv));
    const restored = await store2.init();
    expect(restored.session?.id).toBe('s9');
    expect(restored.session?.answeredIds).toEqual([GOLD[0].id]);
    expect(restored.attempts).toHaveLength(1);
    expect(restored.requeue[GOLD[0].id].due).toBe('2026-03-11');
  });

  it('round trips 3,000 items worth of attempts across shards, each value under 400 KB', async () => {
    const kv = new MemKV();
    const p = new BankPersistence(kv);
    const state = emptyBankState();
    for (let i = 0; i < 3000; i++) {
      for (let k = 0; k < 2; k++) {
        state.attempts.push({ itemId: `np3-${String(i).padStart(4, '0')}`, t: T0 + i * 1000 + k, credit: k ? 1 : 0.5, correct: !!k, selected: [i % 4, (i + 1) % 4], seconds: 30, mode: 'quick', sessionId: 's-synthetic' });
      }
      state.mastery[`np3-${String(i).padStart(4, '0')}`] = { run: i % 4 };
    }
    await p.saveBank(state);
    const shardKeys = [...kv.data.keys()].filter((k) => k.includes('attempts.'));
    expect(shardKeys.length).toBeGreaterThan(1);
    for (const v of kv.data.values()) expect(v.length).toBeLessThanOrEqual(400_000 + 100);
    const loaded = await new BankPersistence(kv).load();
    expect(loaded.attempts).toHaveLength(6000);
    expect(loaded.attempts).toEqual(state.attempts);
    expect(loaded.mastery['np3-0007']).toEqual({ run: 3 });
  });

  it('only rewrites the last attempts shard on append and removes stale shards', async () => {
    const kv = new MemKV();
    const p = new BankPersistence(kv);
    let s = emptyBankState();
    const rec = (i: number): AttemptRec => ({ itemId: `x${i}`, t: i, credit: 0, correct: false, selected: [0], seconds: 1, mode: 'q'.repeat(300) });
    s = { ...s, attempts: Array.from({ length: 3000 }, (_, i) => rec(i)) };
    await p.saveBank(s);
    const n = [...kv.data.keys()].filter((k) => k.includes('attempts.')).length;
    expect(n).toBeGreaterThan(1);
    kv.writes = [];
    const s2 = { ...s, attempts: [...s.attempts, rec(9999)] };
    await p.saveBank(s2, s);
    expect(kv.writes.filter((k) => k.includes('attempts.'))).toEqual([keyAttempts(n - 1)]);
    const s3 = { ...s, attempts: s.attempts.slice(0, 5) };
    await p.saveBank(s3, s2);
    expect([...kv.data.keys()].filter((k) => k.includes('attempts.'))).toEqual([keyAttempts(0)]);
  });

  it('shardArray respects the limit', () => {
    const parts = shardArray(Array.from({ length: 100 }, (_, i) => ({ i, pad: 'x'.repeat(100) })), 1000);
    expect(parts.length).toBeGreaterThan(5);
    for (const part of parts) expect(part.length).toBeLessThan(1200);
    expect(parts.flatMap((x) => JSON.parse(x))).toHaveLength(100);
  });

  it('survives corrupt storage', async () => {
    const kv = new MemKV();
    kv.data.set('fly8.bank.v1.main', '{not json');
    kv.data.set(KEY_SESSION, '{bad');
    const s = await new BankPersistence(kv).load();
    expect(s).toEqual(emptyBankState());
  });
});
