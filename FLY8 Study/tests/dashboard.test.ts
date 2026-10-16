import { describe, expect, it } from 'vitest';
import { levelProgress, pointsForLevel, rankFor, recommendNext } from '../src/core/mastery';

describe('levelProgress', () => {
  it('starts at level 1 with zero progress', () => {
    const p = levelProgress(0);
    expect(p).toMatchObject({ level: 1, rank: 'Student', into: 0, span: 50, fraction: 0, toNext: 50 });
  });

  it('agrees with rankFor at every level boundary', () => {
    for (let level = 1; level <= 12; level++) {
      const start = pointsForLevel(level);
      expect(rankFor(start).level).toBe(level);
      if (start > 0) expect(rankFor(start - 1).level).toBe(level - 1);
      expect(levelProgress(start).fraction).toBe(0);
    }
  });

  it('reports midway progress', () => {
    const p = levelProgress(75); // level 2 spans 50..200
    expect(p.level).toBe(2);
    expect(p.into).toBe(25);
    expect(p.span).toBe(150);
    expect(p.fraction).toBeCloseTo(25 / 150);
    expect(p.toNext).toBe(125);
  });

  it('clamps negative points', () => {
    expect(levelProgress(-40).level).toBe(1);
  });
});

describe('recommendNext', () => {
  const base = { topicCount: 3, diagnosticsDone: 1, attempts: 5 };
  it('asks for notes first', () => {
    expect(recommendNext({ ...base, topicCount: 0 }).tab).toBe('library');
  });
  it('then the diagnostic', () => {
    expect(recommendNext({ ...base, diagnosticsDone: 0 }).title).toBe('Take the diagnostic');
  });
  it('then the weakest topic', () => {
    expect(recommendNext({ ...base, weakTitle: 'Heart' }).title).toBe('Review Heart');
  });
  it('then a first quiz, then the streak', () => {
    expect(recommendNext({ ...base, attempts: 0 }).title).toBe('Start a quiz');
    expect(recommendNext(base).title).toBe('Keep your streak going');
  });
});

describe('points and hints', () => {
  it('a correct answer that used a hint earns half points', async () => {
    const { totalPoints } = await import('../src/core/mastery');
    const NOW = Date.UTC(2026, 9, 16, 12);
    const ev = (id: string, hinted?: boolean) => ({ id, questionId: id, topicId: 't', correct: true, at: NOW - 5 * 86_400_000, kind: 'pop' as const, hinted });
    expect(totalPoints([ev('a'), ev('b', true)], NOW)).toBe(15);
  });
});
