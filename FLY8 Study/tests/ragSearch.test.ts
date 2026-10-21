import { describe, expect, it } from 'vitest';
import { chunkTopic, formatHits, retrieve, tokenize } from '../src/rag/search';
import { tutorRequest, TOPIC_PASSAGE_CHARS } from '../src/tutor/prompt';
import { emptyState } from '../src/storage';
import type { Topic } from '../src/core/types';

const T = (id: string, title: string, body: string): Topic => ({ id, folderId: 'f', title, body, sourceIds: [] });
const dengue = T('dengue', 'Dengue Fever', '## What it is\nA viral illness spread by Aedes mosquitoes.\n\n## Danger signs\nThe fever falls but the child gets severe abdominal pain, persistent vomiting and bleeding. Watch for shock.\n\n## Exam traps\nFalling fever in the critical phase is a warning, not improvement.');
const tb = T('tb', 'Tuberculosis', '## What it is\nAn airborne infection caused by Mycobacterium tuberculosis.\n\n## Treatment\nDOTS uses a fixed combination of drugs taken for six months under observation.');
const hf = T('hf', 'Heart Failure', '## Main problem\nThe heart cannot pump enough blood. Preload and afterload rise.\n\n## Nursing interventions\nPosition upright, give oxygen as ordered, weigh daily.');
const all = [dengue, tb, hf];

describe('tokenize / chunkTopic', () => {
  it('lowercases, drops stop words, stems lightly', () => {
    expect(tokenize('The Patients were vomiting and bleeding')).toEqual(['vomit', 'bleed']);
    expect(tokenize('[[Dengue]] 40 degrees')).toEqual(['dengue', '40', 'degree']);
  });
  it('splits at ## headings and long sections at paragraph breaks', () => {
    const c = chunkTopic(dengue);
    expect(c.map((x) => x.heading)).toEqual(['What it is', 'Danger signs', 'Exam traps']);
    const long = chunkTopic(T('x', 'X', `## Big\n${Array.from({ length: 30 }, (_, i) => `Paragraph ${i} ${'word '.repeat(30)}`).join('\n')}`));
    expect(long.length).toBeGreaterThan(2);
    expect(long.every((x) => x.text.length < 1200)).toBe(true);
  });
  it('never throws on bad bodies', () => {
    expect(() => chunkTopic({ id: 'a', title: 'A', body: undefined as unknown as string })).not.toThrow();
    expect(retrieve([{ id: 'a', title: 'A', body: null as unknown as string }], 'anything')).toEqual([]);
  });
});

describe('retrieve', () => {
  it('finds the right note and heading for a question', () => {
    const h = retrieve(all, 'why is a falling fever dangerous in dengue?');
    expect(h[0].topicId).toBe('dengue');
    expect(['Exam traps', 'Danger signs']).toContain(h[0].heading);
    expect(retrieve(all, 'how long is DOTS treatment')[0].topicId).toBe('tb');
  });
  it('returns nothing for chit-chat or words not in any note', () => {
    expect(retrieve(all, 'hi')).toEqual([]);
    expect(retrieve(all, 'quantum chromodynamics lagrangian')).toEqual([]);
  });
  it('formatHits respects the budget and labels each passage', () => {
    const out = formatHits(retrieve(all, 'fever vomiting bleeding shock'), 300);
    expect(out.length).toBeLessThan(400);
    expect(out).toContain('[Dengue Fever >');
  });
});

describe('tutorRequest with retrieval', () => {
  const state = { ...emptyState(), topics: all };
  it('sends only matching passages when no topic is chosen', () => {
    const r = tutorRequest(state, undefined, [], 'what does DOTS involve for tuberculosis?', 0);
    expect(r.user).toContain('Passages from the learner');
    expect(r.user).toContain('DOTS uses a fixed combination');
    expect(r.user).not.toContain('Preload and afterload');
    expect(r.system).not.toContain('none matched');
  });
  it('sends passages instead of a whole long note, plus related ones from other notes', () => {
    const huge = T('big', 'Big Note', `## A\n${'filler text about nothing. '.repeat(400)}\n\n## Cardiac output\nStroke volume times heart rate gives cardiac output and preload matters.`);
    const r = tutorRequest({ ...state, topics: [...all, huge] }, huge, [], 'what is cardiac output and how does preload matter?', 0);
    expect(r.user).toContain('Stroke volume times heart rate');
    expect(r.user.length).toBeLessThan(TOPIC_PASSAGE_CHARS + 2500 + 700);
    expect(r.user).toContain('Heart Failure');
  });
  it('falls back to the clipped note when nothing matches', () => {
    const huge = T('big', 'Big Note', 'zzz '.repeat(2000));
    const r = tutorRequest({ ...state, topics: [huge] }, huge, [], 'qqq', 0);
    expect(r.user).toContain('zzz');
    expect(r.user.length).toBeLessThan(TOPIC_PASSAGE_CHARS + 800);
  });
});
