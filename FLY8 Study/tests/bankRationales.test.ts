import { describe, expect, it } from 'vitest';
// No @types/node in this project: node built-ins are untyped here on purpose.
// @ts-ignore
import { readdirSync, readFileSync, statSync } from 'node:fs';
// @ts-ignore
import { join, relative } from 'node:path';
import type { BankItem } from '../src/bank/schema';
import { slotLabels } from '../src/bank/provenance';

declare const __dirname: string;
const ROOT = join(__dirname, '..', 'data', 'bank');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir) as string[]) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'review') out.push(...walk(p));
    } else if (name.endsWith('.json') && name !== 'blueprint.json') out.push(p);
  }
  return out.sort();
}

/** How many separate things the learner must be told about: options, matrix rows or cloze blanks. */
function slotCount(i: BankItem): number {
  if (i.type === 'matrix') return i.rows?.length ?? 0;
  if (i.type === 'cloze') return i.blanks?.length ?? 0;
  return i.options.length;
}

describe('every bank question explains every answer slot', () => {
  const all: { file: string; item: BankItem }[] = [];
  for (const f of walk(ROOT)) {
    const arr = JSON.parse(readFileSync(f, 'utf8')) as BankItem[];
    for (const item of arr) all.push({ file: relative(ROOT, f), item });
  }

  it('finds the bank', () => {
    expect(all.length).toBeGreaterThan(700);
  });

  it('has a non-empty optionRationale for every option, row and blank', () => {
    const bad = all
      .filter(({ item }) => {
        const n = slotCount(item);
        const r = item.optionRationales ?? [];
        return n === 0 || r.length !== n || r.some((x) => typeof x !== 'string' || x.trim().length === 0);
      })
      .map(({ file, item }) => `${file}:${item.id} (${item.type}, ${slotCount(item)} slots, ${(item.optionRationales ?? []).length} notes)`);
    expect(bad).toEqual([]);
  });

  it('slotLabels lines up with the notes for every item', () => {
    for (const { item } of all) expect(slotLabels(item).length).toBe(item.optionRationales.length);
  });
});
