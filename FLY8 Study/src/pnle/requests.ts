import type { AppState, Topic } from '../core/types';
import { weakTopics } from '../core/mastery';
import type { BlueprintItem } from '../core/quiz';
import type { ModelRequest } from '../ai/provider';
import { learnerProfile } from '../ai/prompts';
import { OTHER_KINDS_SHAPES } from '../ai/quizPrompts';
import { PNLE_SYSTEM_PROMPT } from './systemPrompt';
import { PNLE_BANK } from './bank';
import { formatExemplars, pickExemplars } from './retriever';
import type { PnleItem } from './types';

/** Caps keep the whole request inside a sensible token budget. */
export const NOTES_CAP_POP = 2000;
export const NOTES_CAP_DIAGNOSTIC = 1200;
export const NOTES_CAP_MODULE = 1000;
export const EXEMPLAR_COUNT = 4;
/** Below this many items, other kinds are skipped so the PNLE vignette share stays high. */
export const OTHER_KINDS_MIN_COUNT = 6;

const OTHER_KINDS_ADDENDUM =
  'OTHER QUESTION KINDS. About 85% of the items must be PNLE vignette "choice" items in the OUTPUT SCHEMA above. ' +
  'The other ~15% may be these kinds where a fact suits it. PNLE items carry "kind":"choice" or no "kind". ' +
  'Each also carries "topic" when topics are named:\n' +
  OTHER_KINDS_SHAPES +
  'Never put answers in the stem. The same safety rules apply.';

function weakLine(state: AppState, now: number): string {
  const weak = weakTopics(state.topics, state.events, now).map((p) => p.title);
  return weak.length ? `Weak, most urgent first (aim distractors at their reasoning errors): ${weak.join(', ')}.` : 'No weak topics identified yet.';
}

function exemplarBlock(query: { topicTitle: string; bodyText: string }, bank: readonly PnleItem[]): string {
  const text = formatExemplars(pickExemplars({ ...query, count: EXEMPLAR_COUNT }, bank));
  return text ? `WORKED EXAMPLES (original; copy the craft, never the content):\n${text}` : '';
}

function systemFor(state: AppState, now: number, withOtherKinds: boolean): string {
  return [PNLE_SYSTEM_PROMPT, learnerProfile(state, now), withOtherKinds ? OTHER_KINDS_ADDENDUM : ''].filter(Boolean).join('\n\n');
}

const join = (...parts: string[]) => parts.filter(Boolean).join('\n\n');

/** Diagnostic: PNLE choice items only (credited to topics by title via parseTopicQuestions). */
export function pnleDiagnosticRequest(
  state: AppState,
  folderId: string,
  count: number,
  now: number,
  bank: readonly PnleItem[] = PNLE_BANK,
): ModelRequest {
  const topics = state.topics.filter((t) => t.folderId === folderId);
  const bodyText = topics.map((t) => t.body.slice(0, 300)).join('\n');
  return {
    system: systemFor(state, now, false),
    user: join(
      exemplarBlock({ topicTitle: topics.map((t) => t.title).join(' '), bodyText }, bank),
      weakLine(state, now),
      `Write ${count} PNLE diagnostic questions spread across these topics, covering each at least once where possible. ` +
        'Every item needs a "topic" copied exactly from the topic titles below. Use only the choice schema.',
      "The learner's notes:\n" + topics.map((t) => `## ${t.title}\n${t.body.slice(0, NOTES_CAP_DIAGNOSTIC)}`).join('\n\n'),
    ),
  };
}

/** Pop quiz on one topic. Replies go through parseMixedQuestions (choice items keep their PNLE fields). */
export function pnlePopQuizRequest(
  state: AppState,
  topic: Topic,
  count: number,
  now: number,
  bank: readonly PnleItem[] = PNLE_BANK,
): ModelRequest {
  return {
    system: systemFor(state, now, count >= OTHER_KINDS_MIN_COUNT),
    user: join(
      exemplarBlock({ topicTitle: topic.title, bodyText: topic.body }, bank),
      weakLine(state, now),
      `Write ${count} PNLE quiz question${count === 1 ? '' : 's'} on "${topic.title}". "topic" of every item: "${topic.title}".`,
      `The learner's notes:\n${topic.body.slice(0, NOTES_CAP_POP)}`,
    ),
  };
}

/** Module quiz across topics with an exact per-topic count. Parse with parsePnleModuleQuestions. */
export function pnleModuleQuizRequest(
  state: AppState,
  topics: Topic[],
  blueprint: BlueprintItem[],
  now: number,
  bank: readonly PnleItem[] = PNLE_BANK,
): ModelRequest {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const total = blueprint.reduce((n, b) => n + b.count, 0);
  const sections = blueprint.map((b) => {
    const t = byId.get(b.topicId);
    return `## ${b.title} (${b.count} question${b.count === 1 ? '' : 's'})\n${(t?.body ?? '').slice(0, NOTES_CAP_MODULE)}`;
  });
  const bodyText = blueprint.map((b) => (byId.get(b.topicId)?.body ?? '').slice(0, 300)).join('\n');
  return {
    system: systemFor(state, now, true),
    user: join(
      exemplarBlock({ topicTitle: blueprint.map((b) => b.title).join(' '), bodyText }, bank),
      weakLine(state, now),
      `Write a ${total}-question PNLE module quiz covering EVERY topic below, with exactly the stated count per topic. ` +
        'Every item needs a "topic" copied exactly from the topic titles below. Weaker topics have more questions; vary difficulty and archetypes.',
      "The learner's notes:\n" + sections.join('\n\n'),
    ),
  };
}
