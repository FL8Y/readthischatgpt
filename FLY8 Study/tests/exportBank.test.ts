import { describe, expect, it } from 'vitest';
import { BANK_MAGIC, crc32, decodeBank, encodeBank, exportFileName, packItem } from '../src/bank/exportBank';
import { importBank } from '../src/bank/importBank';
import { BANK } from '../src/bank/loader';
import type { BankItem } from '../src/bank/schema';

const sample = (n = 12): BankItem[] => BANK.items.slice(0, n);

describe('FLY8-BANK export', () => {
  it('has the header, one line per item and an END line', () => {
    const items = sample(5);
    const lines = encodeBank(items).trimEnd().split('\n');
    expect(lines[0]).toBe(`${BANK_MAGIC} count=5`);
    expect(lines).toHaveLength(7);
    expect(lines[6]).toMatch(/^#END n=5 sum=[0-9a-f]{8}$/);
    for (const l of lines.slice(1, 6)) expect(() => JSON.parse(l)).not.toThrow();
  });
  it('round-trips real bank items losslessly (every type)', () => {
    const items = BANK.items.filter((i, k) => k % 40 === 0 || i.type !== 'single').slice(0, 60);
    expect(new Set(items.map((i) => i.type)).size).toBeGreaterThan(1);
    const d = decodeBank(encodeBank(items));
    expect(d?.complete).toBe(true);
    expect(d?.items).toEqual(items);
  });
  it('keeps optional empties, unknown fields, unicode and the curve-ball flag', () => {
    const it0 = { ...sample(1)[0], keyFacts: [], rationaleSimple: '', flags: ['curveball'], difficulty: 3, extra: { x: 1 }, vignette: '' } as unknown as BankItem;
    const it1 = { ...sample(2)[1], stem: 'Pasyente na "may sakit" é ☃ \n line', rationaleSimple: 'ok' } as BankItem;
    const d = decodeBank(encodeBank([it0, it1]));
    expect(d?.items).toEqual([it0, it1]);
  });
  it('omits default fields and uses short keys', () => {
    const p = packItem({ ...sample(1)[0], v: 2, type: 'single', source: 'bank', review: 'unreviewed', aiWritten: true, difficulty: 3 });
    for (const k of ['type', 'source', 'review', 'aiWritten', 'difficulty', 'stem', 'so', 'rv', 'ai', 'd', 't']) expect(k in p, k).toBe(false);
    expect('s' in p).toBe(true);
  });
  it('detects a cut-off file, a changed file and a bad count', () => {
    const text = encodeBank(sample(6));
    const lines = text.trimEnd().split('\n');
    const cut = decodeBank(lines.slice(0, 4).join('\n') + '\n' + lines[4].slice(0, 30));
    expect(cut?.complete).toBe(false);
    expect(cut?.problems.join(' ')).toMatch(/cut off/);
    expect(cut?.items.length).toBe(3);
    expect(cut?.badLines).toEqual([5]);
    const edited = decodeBank(text.replace('"y"', '"y2"'));
    expect(edited?.complete).toBe(false);
    expect(edited?.problems.join(' ')).toMatch(/checksum/);
    const noEnd = decodeBank(lines.slice(0, 5).join('\n'));
    expect(noEnd?.complete).toBe(false);
    expect(decodeBank(text.replace('count=6', 'count=7'))?.complete).toBe(false);
  });
  it('is tolerant of CRLF and a BOM; rejects other text', () => {
    const text = encodeBank(sample(3));
    expect(decodeBank('﻿' + text.replace(/\n/g, '\r\n'))?.items).toHaveLength(3);
    expect(decodeBank('hello')).toBeNull();
  });
  it('crc32 matches the known check value', () => {
    expect(crc32('123456789')).toBe('cbf43926');
  });
  it('names the file with date and count', () => {
    expect(exportFileName(7, new Date(2026, 9, 20).getTime())).toBe('fly8-questions-20261020-7.txt');
  });
  it('reports the size of 100 exported items', () => {
    const t = encodeBank(BANK.items.slice(0, 100));
    const kb = new TextEncoder().encode(t).length / 1024;
    console.log(`100 items = ${kb.toFixed(1)} KB (JSON.stringify of the same: ${(JSON.stringify(BANK.items.slice(0, 100)).length / 1024).toFixed(1)} KB)`);
    expect(kb).toBeLessThan(400);
  });
});

describe('importBank', () => {
  const fresh = (items: BankItem[]) => items.map((i, k) => ({ ...i, id: `zz-${k}`, source: 'user-paste' as const, stem: `${i.stem} variant ${k} ${'qwertyuiop'.repeat(k % 3)}` }));
  it('reads the text export, per-item errors, never throws', () => {
    const items = fresh(BANK.items.filter((i) => i.type === 'single').slice(0, 3));
    const lines = encodeBank(items).trimEnd().split('\n');
    lines.splice(2, 0, '{"i":"bad","s":"x"}', 'not json');
    const r = importBank(lines.join('\n'), { existing: [] });
    expect(r.format).toBe('fly8-bank');
    expect(r.valid.length).toBe(3);
    expect(r.rejected.length).toBe(2);
    expect(r.notes.join(' ')).toMatch(/checksum|count/);
    expect(() => importBank('\u0000\u0001 garbage')).not.toThrow();
    expect(importBank('').valid).toEqual([]);
  });
  it('detects duplicates by id and near-duplicate stem', () => {
    const base = BANK.items.find((i) => i.type === 'single') as BankItem;
    const same = importBank(encodeBank([base]), { existing: [base] });
    expect(same.valid).toHaveLength(0);
    expect(same.rejected[0].errors.join(' ')).toMatch(/same id/);
    const near = importBank(encodeBank([{ ...base, id: 'new-id-1' }]), { existing: [base] });
    expect(near.valid).toHaveLength(0);
    expect(near.rejected[0].errors.join(' ')).toMatch(/near-duplicate of /);
    const twice = importBank(encodeBank([{ ...base, id: 'a1' }, { ...base, id: 'a2' }]), { existing: [] });
    expect(twice.valid).toHaveLength(1);
  });
  it('marks imported items as the user\'s own and keeps them valid', () => {
    const r = importBank(encodeBank(fresh(BANK.items.slice(0, 2))), { existing: [] });
    expect(r.valid.every((i) => i.source === 'user-paste')).toBe(true);
  });
  it('accepts a plain .json array of items and the paste-reply format', () => {
    const items = fresh(BANK.items.filter((i) => i.type === 'single').slice(0, 2));
    const j = importBank(JSON.stringify(items), { existing: [] });
    expect(j.format).toBe('json-items');
    expect(j.valid).toHaveLength(2);
    const reply = importBank('Here you go:\n```json\n{"items":[{"type":"single","area":"NP3","topic":"T","stem":"Which action is first?","options":["a thing","b thing","c thing","d thing"],"answer":[0],"rationale":"short"}]}\n```');
    expect(reply.format).toBe('reply');
    expect(reply.valid.length + reply.rejected.length).toBe(1);
  });
});

import { itemsForExport } from '../src/bank/exportBank';
describe('itemsForExport', () => {
  const all = BANK.items.slice(0, 30);
  it('picks the right set per scope', () => {
    const src = { all, mine: all.slice(0, 2), topics: [all[5].topic.toUpperCase()], generated: all.slice(3, 4) };
    expect(itemsForExport('all', src)).toHaveLength(30);
    expect(itemsForExport('mine', src)).toHaveLength(2);
    expect(itemsForExport('generated', src)).toHaveLength(1);
    const t = itemsForExport('topics', src);
    expect(t.length).toBeGreaterThan(0);
    expect(t.every((i) => i.topic === all[5].topic)).toBe(true);
    expect(itemsForExport('topics', { ...src, topics: [] })).toEqual([]);
  });
});
