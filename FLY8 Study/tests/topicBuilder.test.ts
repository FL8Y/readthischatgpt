import { describe, expect, it } from 'vitest';
import { CONTINUE_MARK, END_MARK, parseTopicBuilderReply, topicBuilderPrompt } from '../src/pnle/topicBuilder';
import type { Topic } from '../src/core/types';

const existing: Topic[] = [{ id: 't0', folderId: 'f', title: 'Fluid Volume Deficit', body: 'x', sourceIds: [] }];

describe('topicBuilderPrompt', () => {
  it('contains the topic, the template, the output rules and the accuracy rules', () => {
    const p = topicBuilderPrompt({ topic: 'Heart failure', area: 'NP3' });
    expect(p).toContain('Heart failure');
    expect(p).toContain('Exam area: NP3');
    expect(p).toContain('COVERAGE MAP');
    expect(p).toContain('## Priority nursing actions');
    expect(p).toContain('## Check against your textbook');
    expect(p).toContain(END_MARK);
    expect(p).toContain(CONTINUE_MARK);
    expect(p).toMatch(/Never invent drug doses/);
    expect(p).toMatch(/Do not copy or recall real board-exam questions/);
    expect(p).toContain('NP1 Community Health Nursing');
  });

  it('shows a placeholder for an empty topic and is deterministic', () => {
    expect(topicBuilderPrompt({ topic: '  ' })).toContain('[WRITE YOUR TOPIC HERE]');
    const a = topicBuilderPrompt({ topic: 'Sepsis', existingTitles: ['A', 'B'] });
    expect(topicBuilderPrompt({ topic: 'Sepsis', existingTitles: ['A', 'B'] })).toBe(a);
  });

  it('includes the learner notes, existing titles and a continuation request when given', () => {
    const p = topicBuilderPrompt({
      topic: 'Diabetes',
      notes: 'My note about insulin',
      existingTitles: ['Hypoglycemia'],
      continueFrom: 'Diabetic ketoacidosis',
    });
    expect(p).toContain('My note about insulin');
    expect(p).toContain('- Hypoglycemia');
    expect(p).toContain('THIS IS A CONTINUATION');
    expect(p).toContain('Diabetic ketoacidosis');
  });

  it('clamps note length and caps very long input', () => {
    expect(topicBuilderPrompt({ topic: 'X', wordsPerNote: 5000 })).toContain('about 900 words');
    expect(topicBuilderPrompt({ topic: 'X', wordsPerNote: 10 })).toContain('about 250 words');
    const long = topicBuilderPrompt({ topic: 'X', notes: 'a'.repeat(20000) });
    expect(long.length).toBeLessThan(20000);
  });
});

describe('parseTopicBuilderReply', () => {
  const reply = [
    'COVERAGE MAP',
    '1. Definition (high)',
    '2. Priority actions (high)',
    '',
    '# Heart Failure Basics',
    'Area: NP3 | Type: disease | Exam priority: high',
    '## What it is',
    'The heart cannot pump enough. See [[Fluid Volume Deficit]].',
    '',
    '# Heart Failure Priority Actions',
    '## Priority nursing actions',
    '1. Position upright.',
    '',
    `${CONTINUE_MARK} Heart failure teaching`,
  ].join('\n');

  it('splits the coverage map from the notes and strips the continue marker', () => {
    const r = parseTopicBuilderReply(reply, 'f1', existing, 'tb');
    expect(r.coverageMap).toContain('1. Definition');
    expect(r.topics.map((t) => t.title)).toEqual(['Heart Failure Basics', 'Heart Failure Priority Actions']);
    expect(r.topics[1].body).not.toContain(CONTINUE_MARK);
    expect(r.continueFrom).toBe('Heart failure teaching');
    expect(r.complete).toBe(false);
    expect(r.topics[0].body).toContain('[[Fluid Volume Deficit]]');
  });

  it('recognises a finished reply and skips titles already in the library', () => {
    const done = '# Fluid Volume Deficit\nold\n\n# New Thing\nbody here\n' + END_MARK;
    const r = parseTopicBuilderReply(done, 'f1', existing, 'tb');
    expect(r.complete).toBe(true);
    expect(r.topics.map((t) => t.title)).toEqual(['New Thing']);
    expect(r.topics[0].body).not.toContain(END_MARK);
  });

  it('tolerates code fences and returns no topics for a reply without notes', () => {
    const fenced = '```markdown\n# A Topic\nsome body\n```';
    expect(parseTopicBuilderReply(fenced, 'f', [], 'p').topics).toHaveLength(1);
    const none = parseTopicBuilderReply('Sorry, I cannot do that.', 'f', [], 'p');
    expect(none.topics).toEqual([]);
    expect(none.coverageMap).toContain('Sorry');
  });
});
