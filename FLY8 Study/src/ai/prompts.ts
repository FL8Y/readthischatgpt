import type { AppState, Topic } from '../core/types';
import { estimateMastery, weakTopics } from '../core/mastery';
import type { ModelRequest } from './provider';

const QUESTION_SHAPE =
  'Reply with JSON only: {"questions":[{"stem":string,"choices":string[],"answerIndex":number,"rationale":string}]}. ' +
  'answerIndex is the zero-based index of the single correct choice. Write PNLE-style situational items with 4 choices.';

/**
 * The "pre-installed prompt": every AI call carries who the learner is and where they are weak,
 * built from stored attempts, so generated questions and lessons target the gaps.
 */
export function learnerProfile(state: AppState, now: number): string {
  const lines = state.topics.map((t) => {
    const m = estimateMastery(t.id, state.events, now);
    return `- ${t.title}: ${m.attempts ? Math.round(m.mastery * 100) + '% mastery' : 'untested'} (${m.attempts} attempts)`;
  });
  const weak = weakTopics(state.topics, state.events, now).map((p) => p.title);
  return [
    'You are a nursing-exam tutor for one learner preparing for the Philippine nursing licensure exam (PNLE).',
    'Be accurate. Say so when you are unsure. Prefer the learner\'s own notes; mark anything you add beyond them.',
    weak.length ? `Current weak areas, most urgent first: ${weak.join(', ')}.` : 'No weak areas identified yet.',
    'Topic mastery:',
    ...lines,
  ].join('\n');
}

const TOPIC_QUESTION_SHAPE =
  'Reply with JSON only: {"questions":[{"topic":string,"stem":string,"choices":string[],"answerIndex":number,"rationale":string}]}. ' +
  '"topic" must be copied exactly from the topic titles given. answerIndex is the zero-based index of the single correct choice. ' +
  'Write PNLE-style situational items with 4 choices.';

export function diagnosticRequest(state: AppState, folderId: string, count: number, now: number): ModelRequest {
  const topics = state.topics.filter((t) => t.folderId === folderId);
  return {
    system: `${learnerProfile(state, now)}\n${TOPIC_QUESTION_SHAPE}`,
    user:
      `Write ${count} diagnostic questions spread across these topics, covering each at least once where possible:\n` +
      topics.map((t) => `## ${t.title}\n${t.body.slice(0, 1200)}`).join('\n\n'),
  };
}

export function popQuizRequest(state: AppState, topic: Topic, count: number, now: number): ModelRequest {
  return {
    system: `${learnerProfile(state, now)}\n${QUESTION_SHAPE}`,
    user: `Write ${count} short quiz questions on "${topic.title}". Notes:\n${topic.body.slice(0, 2000)}`,
  };
}

export function lessonRequest(state: AppState, topic: Topic, now: number): ModelRequest {
  return {
    system: learnerProfile(state, now),
    user:
      `Teach "${topic.title}" in Markdown: explanation, a mnemonic, key facts, common exam traps. ` +
      `Link related concepts as [[Wikilinks]] so they join the learner's graph. Notes to build on:\n${topic.body.slice(0, 2000)}`,
  };
}
