import { describe, expect, it } from 'vitest';
import { buildGraph, extractWikilinks, slugify } from '../src/core/vault';
import { assessTextQuality, chunkText, parseVerification } from '../src/core/provenance';
import { currentStreak, estimateMastery, planOrder, rankFor, totalPoints } from '../src/core/mastery';
import { canTeach, clampDiagnosticCount, completeDiagnostic, isValidPopQuiz } from '../src/core/diagnostic';
import { parseQuestions, parseTopicQuestions, redact } from '../src/ai/provider';
import type { AppState, AttemptEvent, Topic } from '../src/core/types';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 16, 12);
const topic = (id: string, title: string, body = ''): Topic => ({ id, folderId: 'np1', title, body, sourceIds: [] });
const ev = (id: string, topicId: string, correct: boolean, daysAgo = 0): AttemptEvent => ({
  id,
  questionId: `q-${id}`,
  topicId,
  correct,
  at: NOW - daysAgo * DAY,
  kind: 'pop',
});

describe('vault', () => {
  it('extracts wikilinks with aliases and headings, de-duplicated', () => {
    expect(extractWikilinks('See [[Heart Failure]], [[Furosemide|lasix]] and [[Heart Failure#signs]].')).toEqual([
      'Heart Failure',
      'Furosemide',
    ]);
  });

  it('links topics across folders and reports unresolved targets', () => {
    const a = { ...topic('a', 'Heart Failure', 'Treat with [[Furosemide]] and [[Sodium]]'), folderId: 'cardio' };
    const b = { ...topic('b', 'Furosemide'), folderId: 'pharm' };
    const g = buildGraph([a, b]);
    expect(g.edges).toEqual([{ from: 'a', to: 'b' }]);
    expect(g.unresolved).toEqual([{ from: 'a', target: 'Sodium' }]);
  });

  it('resolves links written as an alias', () => {
    const a = topic('a', 'Pharmacology', 'Uses [[HF]]');
    const b = { ...topic('b', 'Heart Failure'), aliases: ['HF'] };
    const g = buildGraph([a, b]);
    expect(g.edges).toEqual([{ from: 'a', to: 'b' }]);
    expect(g.unresolved).toEqual([]);
  });

  it('slugifies accents and punctuation', () => {
    expect(slugify('Étiology & Risk!')).toBe('etiology-risk');
  });
});

describe('provenance', () => {
  it('scores clean prose high and garbled OCR low', () => {
    const clean = 'Heart failure is a clinical syndrome in which the heart cannot pump enough blood to meet demand.';
    const junk = '§§¢¢ xkqz pvtn ///// ~~~~ 1l1l1l 0O0O qqqqqqqq zzzzzz wwwwww ##%%^^ jjjkkk lll';
    expect(assessTextQuality(clean).score).toBeGreaterThan(0.9);
    expect(assessTextQuality(junk).score).toBeLessThan(0.7);
    expect(assessTextQuality('hi').flags).toContain('too-short');
  });

  it('chunks keep text intact and give locations', () => {
    const text = Array.from({ length: 6 }, (_, i) => `Paragraph ${i} ` + 'word '.repeat(60)).join('\n\n');
    const chunks = chunkText(text, 's1', 500);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.loc.startsWith('chars '))).toBe(true);
    expect(chunks.map((c) => c.text).join(' ')).toContain('Paragraph 5');
  });

  it('parses a fenced verification reply and rejects bad shapes', () => {
    const ok = parseVerification('```json\n{"legit":true,"issues":[],"suggestedOrigin":null}\n```');
    expect(ok).toEqual({ legit: true, issues: [], suggestedOrigin: undefined });
    expect(parseVerification('not json')).toBeNull();
    expect(parseVerification('{"legit":"yes"}')).toBeNull();
  });
});

describe('mastery', () => {
  it('starts neutral with zero confidence', () => {
    const m = estimateMastery('a', [], NOW);
    expect(m.mastery).toBe(0.5);
    expect(m.confidence).toBe(0);
  });

  it('does not double count replayed events', () => {
    const once = estimateMastery('a', [ev('1', 'a', true)], NOW);
    const twice = estimateMastery('a', [ev('1', 'a', true), ev('1', 'a', true)], NOW);
    expect(twice).toEqual(once);
  });

  it('a recent failure outweighs an old success', () => {
    const m = estimateMastery('a', [ev('1', 'a', true, 60), ev('2', 'a', false, 0)], NOW);
    expect(m.mastery).toBeLessThan(0.5);
  });

  it('orders weakest first, deterministically', () => {
    const topics = [topic('a', 'Alpha'), topic('b', 'Beta'), topic('c', 'Gamma')];
    const events = [ev('1', 'a', true), ev('2', 'a', true), ev('3', 'b', false), ev('4', 'b', false)];
    const order = planOrder(topics, events, NOW).map((p) => p.topicId);
    expect(order).toEqual(['b', 'c', 'a']);
    expect(planOrder(topics, [...events].reverse(), NOW).map((p) => p.topicId)).toEqual(order);
  });

  it('streaks count consecutive days and survive until a day is missed', () => {
    const events = [ev('1', 'a', true, 0), ev('2', 'a', true, 1), ev('3', 'a', true, 2), ev('4', 'a', true, 5)];
    expect(currentStreak(events, NOW)).toBe(3);
    expect(currentStreak([ev('x', 'a', true, 1)], NOW)).toBe(1);
    expect(currentStreak([ev('x', 'a', true, 3)], NOW)).toBe(0);
  });

  it('awards points once per event and ranks rise with points', () => {
    const events = [ev('1', 'a', true), ev('1', 'a', true), ev('2', 'a', false)];
    expect(totalPoints(events, NOW)).toBe(15);
    expect(rankFor(0).level).toBe(1);
    expect(rankFor(5000).level).toBeGreaterThan(rankFor(500).level);
  });
});

describe('diagnostic gate', () => {
  it('clamps counts to 1..50', () => {
    expect(clampDiagnosticCount(0)).toBe(1);
    expect(clampDiagnosticCount(80)).toBe(50);
    expect(clampDiagnosticCount(NaN)).toBe(1);
  });

  it('keeps lessons locked until the diagnostic is completed', () => {
    const s = { diagnosticsDone: [] } as unknown as AppState;
    expect(canTeach(s, 'np1')).toBe(false);
    expect(canTeach(completeDiagnostic(s, 'np1'), 'np1')).toBe(true);
  });

  it('pop quizzes allow 1..5 questions only', () => {
    const q = (n: number) => Array.from({ length: n }, () => ({}) as never);
    expect(isValidPopQuiz(q(0))).toBe(false);
    expect(isValidPopQuiz(q(5))).toBe(true);
    expect(isValidPopQuiz(q(6))).toBe(false);
  });
});

describe('provider helpers', () => {
  it('keeps valid questions and drops malformed ones', () => {
    const raw = JSON.stringify({
      questions: [
        { stem: 'Q1', choices: ['a', 'b'], answerIndex: 1, rationale: 'r' },
        { stem: 'bad', choices: ['a', 'b'], answerIndex: 9, rationale: 'r' },
        { stem: 'no rationale', choices: ['a', 'b'], answerIndex: 0 },
      ],
    });
    const qs = parseQuestions(raw, 't1', 'p');
    expect(qs).toHaveLength(1);
    expect(qs[0]).toMatchObject({ id: 'p-0', topicId: 't1', answerIndex: 1 });
  });

  it('redacts the key from error text', () => {
    expect(redact('failed with sk-secret123 in url', 'sk-secret123')).toBe('failed with [redacted] in url');
  });

  it('credits diagnostic questions to the topic they name and drops unknown topics', () => {
    const topics = [topic('a', 'Heart Failure'), topic('b', 'Diabetes')];
    const raw = JSON.stringify({
      questions: [
        { topic: 'diabetes', stem: 'Q1', choices: ['x', 'y'], answerIndex: 0, rationale: 'r' },
        { topic: 'Heart Failure', stem: 'Q2', choices: ['x', 'y'], answerIndex: 1, rationale: 'r' },
        { topic: 'Made Up', stem: 'Q3', choices: ['x', 'y'], answerIndex: 1, rationale: 'r' },
      ],
    });
    const qs = parseTopicQuestions(raw, topics, 'dx');
    expect(qs.map((q) => q.topicId)).toEqual(['b', 'a']);
    expect(qs.map((q) => q.id)).toEqual(['dx-0', 'dx-1']);
  });
});
