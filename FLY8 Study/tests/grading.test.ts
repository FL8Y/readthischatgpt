import { describe, expect, it } from 'vitest';
import {
  answerWeight,
  describeCorrect,
  gradeAnswer,
  normalizeText,
  presentationOrder,
  shuffleSeeded,
} from '../src/core/grading';
import type { Question } from '../src/core/types';

const base = { id: 'q', topicId: 't', rationale: 'r', choices: [] as string[], answerIndex: 0 };
const choice: Question = { ...base, stem: 's', choices: ['a', 'b', 'c'], answerIndex: 1 };
const typing = (accept: string[]): Question => ({ ...base, kind: 'typing', stem: 's', accept });
const cloze: Question = { ...base, kind: 'cloze', stem: '____ pumps ____', blanks: [['heart', 'the heart'], ['blood']] };
const matching: Question = {
  ...base,
  kind: 'matching',
  stem: 's',
  pairs: [
    { left: 'Na', right: 'Sodium' },
    { left: 'K', right: 'Potassium' },
    { left: 'Ca', right: 'Calcium' },
  ],
};
const ordering: Question = { ...base, kind: 'ordering', stem: 's', items: ['A', 'B', 'C', 'D'] };

describe('choice (old questions without kind)', () => {
  it('grades by index', () => {
    expect(gradeAnswer(choice, 1).correct).toBe(true);
    expect(gradeAnswer(choice, 0).correct).toBe(false);
    expect(gradeAnswer(choice, 'b').correct).toBe(false);
    expect(gradeAnswer(choice, 1.5).correct).toBe(false);
  });
});

describe('typing', () => {
  it('ignores case, accents, punctuation and extra spaces', () => {
    const q = typing(['Café au lait']);
    for (const a of ['cafe au lait', '  CAFÉ   au   lait ', 'Cafe, au lait!']) expect(gradeAnswer(q, a).correct).toBe(true);
    expect(gradeAnswer(q, 'cafe lait').correct).toBe(false);
    expect(normalizeText('  Ñandú-Test.  ')).toBe('nandu test');
  });

  it('accepts any accepted form and rejects empty input', () => {
    const q = typing(['myocardial infarction', 'MI', 'heart attack']);
    expect(gradeAnswer(q, 'mi').correct).toBe(true);
    expect(gradeAnswer(q, 'Heart Attack').correct).toBe(true);
    expect(gradeAnswer(q, '').correct).toBe(false);
    expect(gradeAnswer(q, '   ').correct).toBe(false);
  });

  it('matches pure numbers within tolerance, not near misses', () => {
    const q = typing(['33.33']);
    expect(gradeAnswer(q, '33.3').correct).toBe(true);
    expect(gradeAnswer(q, '33.330').correct).toBe(true);
    expect(gradeAnswer(q, '34').correct).toBe(false);
    expect(gradeAnswer(typing(['0.25']), '0.26').correct).toBe(false);
    expect(gradeAnswer(typing(['5']), '5.0').correct).toBe(true);
    expect(gradeAnswer(typing(['1000']), '1,000').correct).toBe(true);
    expect(gradeAnswer(typing(['0']), '0').correct).toBe(true);
    expect(gradeAnswer(typing(['0']), '0.1').correct).toBe(false);
  });

  it('does not treat numbers with units as numeric shortcuts', () => {
    expect(gradeAnswer(typing(['5 mg']), '5mg').correct).toBe(false);
    expect(gradeAnswer(typing(['5 mg']), '5 MG').correct).toBe(true);
  });

  it('fails safely on a missing accept list or wrong answer type', () => {
    expect(gradeAnswer({ ...typing([]), accept: undefined }, 'x').correct).toBe(false);
    expect(gradeAnswer(typing(['x']), 3).correct).toBe(false);
  });
});

describe('cloze', () => {
  it('grades each blank and reports partial credit', () => {
    expect(gradeAnswer(cloze, ['Heart', 'Blood']).correct).toBe(true);
    const part = gradeAnswer(cloze, ['the heart', 'water']);
    expect(part.correct).toBe(false);
    expect(part.partial).toBeCloseTo(0.5);
    expect(part.detail).toBe('1 of 2 blanks correct');
    expect(gradeAnswer(cloze, ['x', 'y']).partial).toBe(0);
  });

  it('treats missing or non-string blanks as wrong', () => {
    expect(gradeAnswer(cloze, ['heart']).partial).toBeCloseTo(0.5);
    expect(gradeAnswer(cloze, 'heart').correct).toBe(false);
  });
});

describe('matching and ordering use canonical ids', () => {
  it('matching: identity is right, a swap is partial', () => {
    expect(gradeAnswer(matching, [0, 1, 2]).correct).toBe(true);
    const swap = gradeAnswer(matching, [1, 0, 2]);
    expect(swap.correct).toBe(false);
    expect(swap.partial).toBeCloseTo(1 / 3);
  });

  it('ordering: exact order is right, reversed is wrong with partial', () => {
    expect(gradeAnswer(ordering, [0, 1, 2, 3]).correct).toBe(true);
    const rev = gradeAnswer(ordering, [3, 2, 1, 0]);
    expect(rev.correct).toBe(false);
    expect(rev.partial).toBe(0);
    expect(gradeAnswer(ordering, [0, 1, 3, 2]).partial).toBeCloseTo(0.5);
  });

  it('grading never depends on the display shuffle', () => {
    for (const seed of ['a', 'b', 'session:q1', 42]) {
      const shown = presentationOrder(4, seed); // what the learner sees: canonical ids in shuffled order
      // A learner who puts items in correct order picks canonical ids 0..3 regardless of how they were shown.
      const learnerSorted = [...shown].sort((x, y) => x - y);
      expect(gradeAnswer(ordering, learnerSorted).correct).toBe(true);
      // Submitting the display order itself (never the right answer) is graded wrong, since it is not canonical order.
      expect(gradeAnswer(ordering, shown).correct).toBe(false);
    }
  });

  it('rejects malformed answers', () => {
    expect(gradeAnswer(matching, 'x').correct).toBe(false);
    expect(gradeAnswer(ordering, [0.5, 1, 2, 3]).correct).toBe(false);
    expect(gradeAnswer(ordering, []).correct).toBe(false);
    expect(gradeAnswer(ordering, []).partial).toBe(0);
  });
});

describe('seeded shuffle', () => {
  it('is deterministic, a permutation, and does not mutate input', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffleSeeded(src, 'seed');
    expect(shuffleSeeded(src, 'seed')).toEqual(a);
    expect([...a].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('different seeds give different orders (for some seed)', () => {
    const src = Array.from({ length: 8 }, (_, i) => i);
    const seen = new Set(['x', 'y', 'z', 'w', 'v'].map((s) => shuffleSeeded(src, s).join()));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('presentationOrder is never the identity for n > 1', () => {
    for (let n = 2; n <= 8; n++) {
      for (let k = 0; k < 40; k++) {
        const o = presentationOrder(n, `s${k}`);
        expect([...o].sort()).toEqual(Array.from({ length: n }, (_, i) => i).sort());
        expect(o.every((v, i) => v === i)).toBe(false);
      }
    }
    expect(presentationOrder(1, 'x')).toEqual([0]);
    expect(presentationOrder(0, 'x')).toEqual([]);
  });
});

describe('answerWeight (hint rule)', () => {
  it('wrong earns nothing, correct full, hinted correct at most half', () => {
    expect(answerWeight({ correct: false })).toBe(0);
    expect(answerWeight({ correct: false, hinted: true })).toBe(0);
    expect(answerWeight({ correct: true })).toBe(1);
    expect(answerWeight({ correct: true, hinted: false })).toBe(1);
    expect(answerWeight({ correct: true, hinted: true })).toBeLessThanOrEqual(0.5);
  });
});

describe('describeCorrect', () => {
  it('describes every kind', () => {
    expect(describeCorrect(choice)).toBe('b');
    expect(describeCorrect(typing(['x', 'y']))).toBe('x / y');
    expect(describeCorrect(cloze)).toContain('1. heart / the heart');
    expect(describeCorrect(matching)).toContain('Na = Sodium');
    expect(describeCorrect(ordering)).toBe('1. A; 2. B; 3. C; 4. D');
  });
});
