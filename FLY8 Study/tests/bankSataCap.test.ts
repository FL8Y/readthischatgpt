import { describe, expect, it } from 'vitest';
import { BANK } from '../src/bank/loader';
import type { BankItem } from '../src/bank/schema';
import { capSata, custom, mock, quick, sataBudget, smart, weak, diagnostic } from '../src/bank/select';

const items: readonly BankItem[] = BANK.items;
const sataIn = (ids: readonly string[]) => ids.filter((id) => items.find((i: BankItem) => i.id === id)?.type === 'sata').length;

describe('select-all cap: at most 1 per 10 questions', () => {
  it('budget is floor(n/10)', () => {
    expect([5, 10, 19, 20, 25, 50].map(sataBudget)).toEqual([0, 1, 1, 2, 2, 5]);
  });
  it('capSata keeps non-select-all items and trims extra select-all items', () => {
    const out = capSata(items, 10);
    expect(out.filter((i) => i.type === 'sata').length).toBe(1);
    expect(out.length).toBe(items.filter((i) => i.type !== 'sata').length + 1);
  });
  it.each(['a', 'b', 'c', 'd', 'e', 'f'])('quick/custom/mock/weak/smart sets stay under the cap (seed %s)', (seed) => {
    const ctx = { items, attempts: [], seed };
    for (const n of [10, 20, 30]) {
      expect(sataIn(quick(ctx, n).ids)).toBeLessThanOrEqual(sataBudget(n));
      expect(sataIn(custom(ctx, { count: n }).ids)).toBeLessThanOrEqual(sataBudget(n));
      expect(sataIn(smart(ctx, n).ids)).toBeLessThanOrEqual(sataBudget(n));
    }
    expect(sataIn(mock(ctx, 'NP3', 25).ids)).toBeLessThanOrEqual(sataBudget(25));
    expect(sataIn(diagnostic(ctx).ids)).toBeLessThanOrEqual(sataBudget(25));
    expect(sataIn(weak({ ...ctx, attempts: [] }, 10).ids)).toBeLessThanOrEqual(1);
  });
});
