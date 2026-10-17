import type { AppState, Topic } from '../core/types';
import { estimateMastery, weakTopics } from '../core/mastery';
import type { ModelRequest } from './provider';

/**
 * Compact question craft shared by the plain (non-PNLE-system) quiz prompts. The full rules live in
 * src/pnle/systemPrompt.ts; this is the same idea in one line so small models still get it.
 */
export const CRAFT =
  'ONE decision per item, not recall. Each wrong choice a distinct named error (wrong time, symptom not cause). ' +
  'Rationale: cue, principle, rule, why it beats the runner-up, "Flip: if ..., then ...".';

const QUESTION_SHAPE =
  `PNLE 4-choice items. ${CRAFT} ` +
  'JSON only: {"questions":[{"stem":string,"choices":string[],"answerIndex":number,"rationale":string}]}, answerIndex zero-based.';

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
    'You are a nursing-exam tutor for Philippine nursing licensure exam (PNLE); admit doubt, notes first, mark additions.',
    weak.length ? `Weak, most urgent first: ${weak.join(', ')}.` : 'No weak areas identified yet.',
    'Topic mastery:',
    ...lines,
  ].join('\n');
}

const TOPIC_QUESTION_SHAPE =
  `PNLE 4-choice items. ${CRAFT} ` +
  'JSON only: {"questions":[{"topic":string,"stem":string,"choices":string[],"answerIndex":number,"rationale":string}]}, ' +
  '"topic" copied exactly from the titles given, answerIndex zero-based.';

export function diagnosticRequest(state: AppState, folderId: string, count: number, now: number): ModelRequest {
  const topics = state.topics.filter((t) => t.folderId === folderId);
  return {
    system: `${learnerProfile(state, now)}\n${TOPIC_QUESTION_SHAPE}`,
    user:
      `Write ${count} diagnostic questions across these topics, each once where possible, exposing reasoning:\n` +
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
      `Teach "${topic.title}" in Markdown: mechanism (why), decision rule, exam trap, mnemonic; keep only testable facts. ` +
      `Link related concepts as [[Wikilinks]]. Notes to build on:\n${topic.body.slice(0, 2000)}`,
  };
}
