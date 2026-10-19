import { describe, expect, it } from 'vitest';
import { parseMixedQuestions, parseQuestionItem, parseQuestionList } from '../src/core/questionParse';
import { parseModuleQuestions } from '../src/core/quiz';
import { parseQuestions } from '../src/ai/provider';
import { MIXED_KINDS_SHAPE, mixedPopQuizRequest } from '../src/ai/quizPrompts';
import type { AppState, Topic } from '../src/core/types';

const topic = (id: string, title: string): Topic => ({ id, folderId: 'f', title, body: '', sourceIds: [] });
const p = (o: Record<string, unknown>) => parseQuestionItem({ stem: 's', rationale: 'r', ...o }, 't', 'id');

describe('choice items (unchanged rules)', () => {
  it('accepts old-shape items with no kind and with kind choice', () => {
    const old = { stem: 's', choices: ['a', 'b'], answerIndex: 1, rationale: 'r' };
    expect(parseQuestionItem(old, 't', 'x')).toEqual({ id: 'x', topicId: 't', ...old });
    expect(parseQuestionItem({ ...old, kind: 'choice' }, 't', 'x')?.answerIndex).toBe(1);
  });

  it('drops malformed choice items', () => {
    expect(p({ choices: ['a'], answerIndex: 0 })).toBeNull();
    expect(p({ choices: ['a', 'b'], answerIndex: 2 })).toBeNull();
    expect(p({ choices: ['a', 2], answerIndex: 0 })).toBeNull();
    expect(p({ kind: 'weird', choices: ['a', 'b'], answerIndex: 0 })).toBeNull();
    expect(parseQuestionItem(null, 't', 'x')).toBeNull();
  });

  it('matches the original parseQuestions result on choice-only data', () => {
    const raw = JSON.stringify({
      questions: [
        { stem: 'a', choices: ['x', 'y'], answerIndex: 0, rationale: 'r' },
        { stem: 'bad', choices: ['x'], answerIndex: 0, rationale: 'r' },
        { stem: 'b', choices: ['x', 'y', 'z'], answerIndex: 2, rationale: 'r' },
      ],
    });
    expect(parseMixedQuestions(raw, 't', 'pre')).toEqual(parseQuestions(raw, 't', 'pre'));
  });
});

describe('typing', () => {
  it('needs 1-8 non-empty accept strings', () => {
    expect(p({ kind: 'typing', accept: ['a'] })?.accept).toEqual(['a']);
    expect(p({ kind: 'typing', accept: [] })).toBeNull();
    expect(p({ kind: 'typing', accept: [' '] })).toBeNull();
    expect(p({ kind: 'typing', accept: Array(9).fill('a') })).toBeNull();
    expect(p({ kind: 'typing' })).toBeNull();
    expect(p({ kind: 'typing', accept: 'a' })).toBeNull();
  });
});

describe('cloze', () => {
  it('needs blanks count equal to markers, within 1-6', () => {
    expect(p({ kind: 'cloze', stem: 'The ____ pumps.', blanks: [['heart']] })?.blanks).toEqual([['heart']]);
    expect(p({ kind: 'cloze', stem: 'The ____ pumps ____.', blanks: [['heart']] })).toBeNull();
    expect(p({ kind: 'cloze', stem: 'No marker', blanks: [['heart']] })).toBeNull();
    expect(p({ kind: 'cloze', stem: '____', blanks: [[]] })).toBeNull();
    expect(p({ kind: 'cloze', stem: '____', blanks: [['a', 3]] })).toBeNull();
    expect(p({ kind: 'cloze', stem: '____', blanks: [] })).toBeNull();
    expect(p({ kind: 'cloze', stem: '____ '.repeat(7), blanks: Array(7).fill(['a']) })).toBeNull();
    expect(p({ kind: 'cloze', stem: '____ '.repeat(6), blanks: Array(6).fill(['a']) })).not.toBeNull();
  });
});

describe('matching', () => {
  const pairs = (n: number) => Array.from({ length: n }, (_, i) => ({ left: `L${i}`, right: `R${i}` }));
  it('needs 2-8 distinct non-empty pairs', () => {
    expect(p({ kind: 'matching', pairs: pairs(1) })).toBeNull();
    expect(p({ kind: 'matching', pairs: pairs(2) })?.pairs).toHaveLength(2);
    expect(p({ kind: 'matching', pairs: pairs(8) })).not.toBeNull();
    expect(p({ kind: 'matching', pairs: pairs(9) })).toBeNull();
    expect(p({ kind: 'matching', pairs: [{ left: 'a', right: 'x' }, { left: 'b', right: 'X ' }] })).toBeNull();
    expect(p({ kind: 'matching', pairs: [{ left: 'a', right: 'x' }, { left: 'a', right: 'y' }] })).toBeNull();
    expect(p({ kind: 'matching', pairs: [{ left: 'a', right: 'x' }, { left: 'b' }] })).toBeNull();
    expect(p({ kind: 'matching' })).toBeNull();
  });

  it('keeps only left/right on stored pairs', () => {
    const q = p({ kind: 'matching', pairs: [{ left: 'a', right: 'x', extra: 1 }, { left: 'b', right: 'y' }] });
    expect(q?.pairs?.[0]).toEqual({ left: 'a', right: 'x' });
  });
});

describe('ordering', () => {
  it('needs 3-8 distinct non-empty items', () => {
    expect(p({ kind: 'ordering', items: ['a', 'b'] })).toBeNull();
    expect(p({ kind: 'ordering', items: ['a', 'b', 'c'] })?.items).toEqual(['a', 'b', 'c']);
    expect(p({ kind: 'ordering', items: Array.from({ length: 9 }, (_, i) => `i${i}`) })).toBeNull();
    expect(p({ kind: 'ordering', items: ['a', 'B', 'b'] })).toBeNull();
    expect(p({ kind: 'ordering', items: ['a', '', 'c'] })).toBeNull();
  });
});

describe('lists and module parsing', () => {
  it('drops bad items from a mixed list and renumbers ids over kept items', () => {
    const list = [
      { stem: 'a', choices: ['x', 'y'], answerIndex: 0, rationale: 'r' },
      { kind: 'typing', stem: 'b', accept: [], rationale: 'r' },
      { kind: 'typing', stem: 'c', accept: ['ok'], rationale: 'r' },
      'garbage',
    ];
    const out = parseQuestionList(list, 't', 'p');
    expect(out.map((q) => q.id)).toEqual(['p-0', 'p-1']);
    expect(out[1].kind).toBe('typing');
    expect(parseQuestionList('nope', 't', 'p')).toEqual([]);
    expect(parseMixedQuestions('not json', 't', 'p')).toEqual([]);
    expect(parseMixedQuestions('```json\n[{"kind":"ordering","stem":"s","items":["a","b","c"],"rationale":"r"}]\n```', 't', 'p')).toHaveLength(1);
  });

  it('parseModuleQuestions accepts other kinds and drops malformed ones, choice unchanged', () => {
    const topics = [topic('a', 'Alpha'), topic('b', 'Beta')];
    const ch = (t: string) => ({ topic: t, stem: 's', choices: ['x', 'y'], answerIndex: 0, rationale: 'r' });
    const items: unknown[] = [
      ...Array.from({ length: 8 }, () => ch('Alpha')),
      ch('Beta'),
      { topic: 'Beta', kind: 'ordering', stem: 's', items: ['1', '2', '3'], rationale: 'r' },
      { topic: 'Beta', kind: 'ordering', stem: 's', items: ['1'], rationale: 'r' },
      { topic: 'Beta', kind: 'matching', stem: 's', pairs: [{ left: 'a', right: 'b' }], rationale: 'r' },
    ];
    const r = parseModuleQuestions({ questions: items }, topics, 'f', 'mod', 1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.questions).toHaveLength(10);
      expect(r.value.questions.filter((q) => q.kind === 'ordering')).toHaveLength(1);
      expect(r.value.questions.map((q) => q.id)[9]).toBe('mod-9');
    }
  });
});

describe('prompts', () => {
  it('describe the exact JSON shape of every kind', () => {
    for (const k of ['"kind":"choice"', '"kind":"typing"', '"kind":"cloze"', '"kind":"matching"', '"kind":"ordering"']) {
      expect(MIXED_KINDS_SHAPE).toContain(k);
    }
    const state = {
      folders: [], topics: [], sources: [], chunks: [], events: [], diagnosticsDone: [],
      settings: { provider: 'openai', apiKey: '', model: '' },
    } as AppState;
    const req = mixedPopQuizRequest(state, topic('a', 'Alpha'), 3, 0);
    expect(req.system).toContain('"accept"');
    expect(req.user).toContain('Alpha');
  });
});
