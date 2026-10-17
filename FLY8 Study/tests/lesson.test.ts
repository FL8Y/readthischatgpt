import { describe, expect, it } from 'vitest';
import { hasAiAdded, lessonPrompt, mdBlocks, parseLesson, resolveRelated } from '../src/lesson/lesson';
import { parseLessonMap } from '../src/lesson/store';
import { exportVault, safeFilename, vaultAsText } from '../src/lesson/vaultExport';
import { emptyState } from '../src/storage';
import type { AppState, Topic } from '../src/core/types';

const NOW = Date.UTC(2026, 9, 16, 12);
const good = {
  explanation: '## Heart failure\nThe heart cannot pump enough. See [[Diabetes]].\n\nAI-added, check against your textbook: BNP rises.',
  mnemonic: { text: 'LMNOP', rationale: 'Lasix, Morphine, Nitrates, Oxygen, Position' },
  keyFacts: ['Weigh daily', 'Weigh daily', 7, '  '],
  examTraps: ['Confusing left and right sided signs'],
  relatedTopics: ['[[Diabetes]]', 'Renal Anatomy'],
  diagram: { kind: 'svg', code: '<svg viewBox="0 0 10 10"></svg>', caption: 'Heart' },
};

describe('parseLesson', () => {
  it('parses a complete lesson, de-duplicates and strips brackets', () => {
    const l = parseLesson(JSON.stringify(good), 'hf', NOW)!;
    expect(l.topicId).toBe('hf');
    expect(l.keyFacts).toEqual(['Weigh daily']);
    expect(l.relatedTopics).toEqual(['Diabetes', 'Renal Anatomy']);
    expect(l.mnemonic?.text).toBe('LMNOP');
    expect(l.diagram?.kind).toBe('svg');
    expect(l.aiAdded).toBe(true);
  });

  it('accepts JSON wrapped in a code fence', () => {
    expect(parseLesson('```json\n' + JSON.stringify(good) + '\n```', 'hf', NOW)).not.toBeNull();
  });

  it('drops malformed parts but keeps the rest', () => {
    const l = parseLesson(
      JSON.stringify({ explanation: 'Plain notes.', mnemonic: { text: 'x' }, diagram: { kind: 'png', code: 'z', caption: 'c' }, keyFacts: 'nope', relatedTopics: [1, null] }),
      'hf',
      NOW,
    )!;
    expect(l.mnemonic).toBeUndefined();
    expect(l.diagram).toBeUndefined();
    expect(l.keyFacts).toEqual([]);
    expect(l.relatedTopics).toEqual([]);
    expect(l.aiAdded).toBe(false);
  });

  it('returns null for garbage, arrays or missing explanation without throwing', () => {
    for (const raw of ['', 'not json', '[]', '{"keyFacts":["a"]}', '{"explanation":"   "}', 'null']) {
      expect(parseLesson(raw, 'hf', NOW)).toBeNull();
    }
  });

  it('flags the AI-added label', () => {
    expect(hasAiAdded('AI-added, check against your textbook: x')).toBe(true);
    expect(hasAiAdded('only notes')).toBe(false);
  });
});

describe('lesson prompt and helpers', () => {
  const topic: Topic = { id: 'hf', folderId: 'np1', title: 'Heart Failure', body: 'notes', sourceIds: [] };
  const state: AppState = { ...emptyState(), topics: [topic, { ...topic, id: 'dm', title: 'Diabetes' }] };

  it('prompt includes learner profile, strict JSON shape, AI-added rule and related titles', () => {
    const p = lessonPrompt(state, topic, NOW);
    expect(p.system).toContain('nursing-exam tutor');
    expect(p.system).toContain('JSON only');
    expect(p.system).toContain('AI-added, check against your textbook');
    expect(p.user).toContain('Diabetes');
  });

  it('resolves related topics case-insensitively', () => {
    const l = parseLesson(JSON.stringify({ explanation: 'x', relatedTopics: ['diabetes', 'Unknown'] }), 'hf', NOW)!;
    expect(resolveRelated(l, state.topics)).toEqual([{ title: 'diabetes', topicId: 'dm' }, { title: 'Unknown', topicId: undefined }]);
  });

  it('mdBlocks handles headings, bullets and wikilinks', () => {
    expect(mdBlocks('# T\n- a [[B|bee]]\n\ntext **bold**')).toEqual([
      { kind: 'h', text: 'T' },
      { kind: 'li', text: 'a bee' },
      { kind: 'p', text: 'text bold' },
    ]);
  });

  it('tolerates corrupt lesson storage', () => {
    expect(parseLessonMap(null)).toEqual({});
    expect(parseLessonMap('{bad')).toEqual({});
    expect(parseLessonMap('[1]')).toEqual({});
    expect(Object.keys(parseLessonMap('{"hf":{}}'))).toEqual(['hf']);
  });
});

describe('exportVault', () => {
  const state: AppState = {
    ...emptyState(),
    settings: { provider: 'openai', apiKey: 'sk-SECRET-123', model: 'm' },
    sources: [{ id: 's1', title: 'My notes', kind: 'paste', addedAt: 0, quality: { score: 1, flags: [] }, verification: 'unverified' }],
    topics: [
      { id: 'a', folderId: 'np1', title: 'Heart/Failure: *1*', body: 'See [[Diabetes]].', sourceIds: ['s1'] },
      { id: 'b', folderId: 'np1', title: 'heart failure 1', body: 'dup', sourceIds: [] },
      { id: 'c', folderId: 'gone', title: '???', body: 'x', sourceIds: [] },
    ],
  };

  it('sanitizes filenames and de-duplicates', () => {
    expect(safeFilename('a/b\\c:d')).toBe('a b c d');
    expect(safeFilename('...')).toBe('Untitled');
    const files = exportVault(state);
    expect(files.map((f) => f.path)).toEqual(['NP1 Nursing/Heart Failure 1.md', 'NP1 Nursing/heart failure 1 (2).md', 'Unfiled/Untitled.md']);
  });

  it('keeps wikilinks and frontmatter, and never includes the API key', () => {
    const files = exportVault(state);
    expect(files[0].content).toContain('See [[Diabetes]].');
    expect(files[0].content.startsWith('---\n')).toBe(true);
    expect(files[0].content).toContain('"My notes"');
    expect(JSON.stringify(files)).not.toContain('SECRET');
    expect(vaultAsText(files)).not.toContain('sk-');
  });
});
