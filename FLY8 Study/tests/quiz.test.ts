import { describe, expect, it } from 'vitest';
import {
  buildPopSession,
  cycleChange,
  gradeSession,
  moduleBlueprint,
  parseFixTopics,
  parseModuleQuestions,
  remediationPlan,
  resultFromEvents,
  unansweredQuestions,
  type QuizSession,
} from '../src/core/quiz';
import { estimateMastery } from '../src/core/mastery';
import type { AttemptEvent, Question, Topic } from '../src/core/types';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 16, 12);
const topic = (id: string, title: string): Topic => ({ id, folderId: 'np1', title, body: '', sourceIds: [] });
const TOPICS = [topic('hf', 'Heart Failure'), topic('dm', 'Diabetes'), topic('ra', 'Renal Anatomy'), topic('as', 'Asthma')];
const q = (id: string, topicId: string): Question => ({ id, topicId, stem: id, choices: ['a', 'b', 'c', 'd'], answerIndex: 1, rationale: 'r' });
let n = 0;
const ev = (topicId: string, correct: boolean, daysAgo = 0, id = `e${n++}`): AttemptEvent => ({
  id,
  questionId: `q-${id}`,
  topicId,
  correct,
  at: NOW - daysAgo * DAY,
  kind: 'module',
});
const many = (topicId: string, right: number, wrong: number): AttemptEvent[] => [
  ...Array.from({ length: right }, () => ev(topicId, true)),
  ...Array.from({ length: wrong }, () => ev(topicId, false)),
];

describe('pop quiz', () => {
  it('accepts 1-5 questions and rejects 0 and 6', () => {
    const t = TOPICS[0];
    for (const k of [1, 3, 5]) {
      expect(buildPopSession(t, Array.from({ length: k }, (_, i) => q(`p${i}`, t.id)), 's1', NOW).ok).toBe(true);
    }
    for (const k of [0, 6]) {
      const r = buildPopSession(t, Array.from({ length: k }, (_, i) => q(`p${i}`, t.id)), 's1', NOW);
      expect(r.ok).toBe(false);
    }
  });
});

describe('module blueprint', () => {
  it('rejects counts outside 10-50 and counts below the topic number', () => {
    for (const c of [9, 51, 10.5, NaN]) expect(moduleBlueprint(TOPICS, [], NOW, c).ok).toBe(false);
    expect(moduleBlueprint(TOPICS, [], NOW, 10).ok).toBe(true);
    expect(moduleBlueprint(TOPICS, [], NOW, 50).ok).toBe(true);
    const many12 = Array.from({ length: 12 }, (_, i) => topic(`t${i}`, `T${i}`));
    expect(moduleBlueprint(many12, [], NOW, 10).ok).toBe(false);
  });

  it('covers every topic, sums to the requested count, and weights weak topics more', () => {
    const events = [...many('hf', 8, 0), ...many('dm', 0, 8), ...many('ra', 4, 4)];
    for (const count of [10, 17, 50]) {
      const r = moduleBlueprint(TOPICS, events, NOW, count);
      if (!r.ok) throw new Error(r.error);
      expect(r.value.length).toBe(TOPICS.length);
      expect(r.value.every((b) => b.count >= 1)).toBe(true);
      expect(r.value.reduce((s, b) => s + b.count, 0)).toBe(count);
    }
    const r = moduleBlueprint(TOPICS, events, NOW, 30);
    if (!r.ok) throw new Error(r.error);
    const by = Object.fromEntries(r.value.map((b) => [b.topicId, b.count]));
    expect(by.dm).toBeGreaterThan(by.hf);
  });

  it('is deterministic', () => {
    const events = many('dm', 1, 5);
    expect(moduleBlueprint(TOPICS, events, NOW, 23)).toEqual(moduleBlueprint([...TOPICS].reverse(), events, NOW, 23));
  });
});

describe('module question parsing', () => {
  const item = (topicTitle: string) => ({ topic: topicTitle, stem: 's', choices: ['a', 'b'], answerIndex: 0, rationale: 'r' });
  it('requires every topic to be covered', () => {
    const titles = TOPICS.map((t) => t.title);
    const good = Array.from({ length: 12 }, (_, i) => item(titles[i % 4]));
    expect(parseModuleQuestions({ questions: good }, TOPICS, 'np1', 'm1', NOW).ok).toBe(true);
    const missing = Array.from({ length: 12 }, (_, i) => item(titles[i % 3]));
    expect(parseModuleQuestions({ questions: missing }, TOPICS, 'np1', 'm1', NOW).ok).toBe(false);
  });
});

describe('grading and ledger', () => {
  const session: QuizSession = {
    id: 'mod-1',
    kind: 'module',
    folderId: 'np1',
    createdAt: NOW,
    questions: [q('a', 'hf'), q('b', 'hf'), q('c', 'dm'), q('d', 'dm')],
  };

  it('grades, flags weak topics, and builds unique ids', () => {
    const { events, result } = gradeSession(session, { a: 1, b: 1, c: 0, d: 2 }, NOW);
    expect(result.correct).toBe(2);
    expect(result.total).toBe(4);
    expect(result.weakTopicIds).toEqual(['dm']);
    expect(new Set(events.map((e) => e.id)).size).toBe(4);
  });

  it('ignores duplicate event ids when estimating mastery and rebuilding results', () => {
    const { events } = gradeSession(session, { a: 1, b: 1, c: 0, d: 0 }, NOW);
    const doubled = [...events, ...events];
    expect(estimateMastery('hf', doubled, NOW)).toEqual(estimateMastery('hf', events, NOW));
    expect(resultFromEvents(session, doubled)).toEqual(resultFromEvents(session, events));
  });

  it('resumes at the first unanswered question', () => {
    const { events } = gradeSession(session, { a: 1, b: 0 }, NOW);
    expect(unansweredQuestions(session, events).map((x) => x.id)).toEqual(['c', 'd']);
  });
});

describe('remediation plan', () => {
  const events = [
    ...many('hf', 12, 0), // strong and well evidenced -> mastered
    ...many('dm', 0, 6), // weak
    ...many('as', 1, 0), // sparse perfect: not mastered, not weak
    // 'ra' untested
  ];

  it('excludes mastered topics, sparse-perfect topics and untested topics', () => {
    const plan = remediationPlan(TOPICS, events, NOW);
    expect(plan.items.map((i) => i.topicId)).toEqual(['dm']);
    expect(plan.mastered).toEqual(['hf']);
    expect(plan.untested).toEqual(['ra']);
  });

  it('is deterministic for identical evidence regardless of input order', () => {
    const a = remediationPlan(TOPICS, events, NOW);
    const b = remediationPlan([...TOPICS].reverse(), [...events].reverse(), NOW);
    expect(b).toEqual(a);
  });

  it('orders by urgency and re-plans from new evidence', () => {
    const before = remediationPlan(TOPICS, [...events, ...many('as', 0, 5)], NOW);
    expect(before.items.map((i) => i.topicId)).toEqual(['dm', 'as']);
    const recovered = [...events, ...many('as', 0, 5), ...many('dm', 40, 0)];
    const after = remediationPlan(TOPICS, recovered, NOW);
    expect(after.items.map((i) => i.topicId)).not.toContain('dm');
    expect(cycleChange(before, after).resolved).toContain('dm');
    expect(after.mastered).toContain('dm');
  });

  it('lets old failures fade: stale mistakes plus recent success are not weak', () => {
    const stale = [...Array.from({ length: 6 }, (_, i) => ev('ra', false, 90 + i)), ...many('ra', 8, 0)];
    expect(remediationPlan(TOPICS, stale, NOW).items).toEqual([]);
  });
});

describe('fix topics', () => {
  it('splits Markdown on # titles, skips existing titles and empty sections', () => {
    const raw = '# Preload\nSee [[Heart Failure]].\n\n# Diabetes\nalready exists\n\n# Afterload\n';
    const out = parseFixTopics(raw, 'np1', TOPICS, 'fix-1');
    expect(out.map((t) => t.title)).toEqual(['Preload']);
    expect(out[0]).toMatchObject({ id: 'fix-1-preload', folderId: 'np1', sourceIds: [] });
    expect(out[0].body).toContain('[[Heart Failure]]');
  });
});
