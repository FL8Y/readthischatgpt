import { describe, expect, it } from 'vitest';
// No @types/node in this project: node built-ins are untyped here on purpose.
// @ts-ignore
import { readdirSync, readFileSync, statSync } from 'node:fs';
// @ts-ignore
import { join, relative } from 'node:path';
import { validateBank, validateFile } from '../src/bank/validate';
import type { BankItem } from '../src/bank/schema';

declare const __dirname: string;
const ROOT = join(__dirname, '..', 'data', 'bank');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir) as string[]) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'review') continue;
      out.push(...walk(p));
    } else if (name.endsWith('.json') && name !== 'blueprint.json') {
      out.push(p);
    }
  }
  return out.sort();
}

const files = walk(ROOT);
const loaded = files.map((f) => ({ name: relative(ROOT, f), items: JSON.parse(readFileSync(f, 'utf8')) as BankItem[] }));

describe('data/bank content gate', () => {
  it('finds at least the migrated gold file', () => {
    expect(loaded.map((l) => l.name)).toContain('gold.v2.json');
  });

  for (const { name, items } of loaded) {
    it(`${name} is an array and passes validateFile`, () => {
      expect(Array.isArray(items)).toBe(true);
      const r = validateFile(items);
      expect(r.errors).toEqual([]);
    });
  }

  it('gold.v2.json holds the 100 migrated gold items', () => {
    const gold = loaded.find((l) => l.name === 'gold.v2.json');
    expect(gold?.items.length).toBe(100);
    expect(gold?.items.every((i) => i.source === 'gold' && i.v === 2 && i.type === 'single')).toBe(true);
  });

  it('whole bank has unique ids and no near-duplicate stems', () => {
    const all = loaded.flatMap((l) => l.items);
    const r = validateBank(all);
    expect(r.errors).toEqual([]);
    expect(r.duplicatePairs).toEqual([]);
  });
});
