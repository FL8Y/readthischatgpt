import type { AppState, Topic } from '../core/types';
import type { BlueprintItem, RemediationItem } from '../core/quiz';
import type { ModelRequest } from './provider';
import { learnerProfile } from './prompts';

const MODULE_SHAPE =
  'Reply with JSON only: {"questions":[{"topic":string,"stem":string,"choices":string[],"answerIndex":number,"rationale":string}]}. ' +
  '"topic" must be copied exactly from the topic titles given. answerIndex is the zero-based index of the single correct choice. ' +
  'Write NCLEX-style items with 4 choices. Produce exactly the requested number of questions per topic.';

export function moduleQuizRequest(state: AppState, topics: Topic[], blueprint: BlueprintItem[], now: number): ModelRequest {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const total = blueprint.reduce((n, b) => n + b.count, 0);
  const sections = blueprint.map((b) => {
    const t = byId.get(b.topicId);
    return `## ${b.title} (${b.count} question${b.count === 1 ? '' : 's'})\n${(t?.body ?? '').slice(0, 1000)}`;
  });
  return {
    system: `${learnerProfile(state, now)}\n${MODULE_SHAPE}`,
    user:
      `Write a ${total}-question module quiz covering EVERY topic below, with exactly the stated count per topic. ` +
      `Weaker topics have more questions; vary difficulty.\n\n${sections.join('\n\n')}`,
  };
}

export function remediationRequest(state: AppState, weak: RemediationItem[], topics: Topic[], now: number): ModelRequest {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const sections = weak.map((w) => {
    const t = byId.get(w.topicId);
    return `## ${w.title} (${w.reason})\n${(t?.body ?? '').slice(0, 800)}`;
  });
  return {
    system: learnerProfile(state, now),
    user:
      'The learner is weak on the topics below. Write NEW targeted study notes that fix the likely gaps. ' +
      'Do not repeat topics that are not listed. Reply in Markdown only: start each new topic with a "# Title" line ' +
      '(a new title, not an existing one), then a clear explanation, a mnemonic, key facts and common exam traps. ' +
      'Link related concepts as [[Wikilinks]] so they join the learner\'s graph. Mark anything beyond the learner\'s notes.\n\n' +
      sections.join('\n\n'),
  };
}
