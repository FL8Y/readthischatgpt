import { describe, expect, it } from 'vitest';
import { isStudied, normalizeStudied, studiedLabel, studiedProgress, toggleStudied } from '../src/presets/studied';

describe('studied reducer', () => {
  it('toggles on and off without mutating', () => {
    const a: string[] = [];
    const b = toggleStudied(a, 't1');
    expect(a).toEqual([]);
    expect(b).toEqual(['t1']);
    expect(isStudied(b, 't1')).toBe(true);
    expect(toggleStudied(b, 't1')).toEqual([]);
  });
  it('normalizes bad stored data', () => {
    expect(normalizeStudied('x')).toEqual([]);
    expect(normalizeStudied(['a', 'a', 3, '', 'b'])).toEqual(['a', 'b']);
  });
  it('counts progress only for existing topics', () => {
    const p = studiedProgress(['a', 'gone'], ['a', 'b', 'c']);
    expect(p).toEqual({ done: 1, total: 3 });
    expect(studiedLabel(p)).toBe('Studied 1/3');
  });
});
