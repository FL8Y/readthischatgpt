import type { AppState, Question, Topic } from '../core/types';
import { describeCorrect, kindOf } from '../core/grading';
import type { BlueprintItem, RemediationItem } from '../core/quiz';
import type { ModelRequest } from './provider';
import { learnerProfile } from './prompts';

const MODULE_SHAPE =
  'Reply with JSON only: {"questions":[{"topic":string,"stem":string,"choices":string[],"answerIndex":number,"rationale":string}]}. ' +
  '"topic" must be copied exactly from the topic titles given. answerIndex is the zero-based index of the single correct choice. ' +
  'Write PNLE-style situational items with 4 choices. Produce exactly the requested number of questions per topic.';

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

/** Shapes for the non-choice kinds, shared by the plain mixed prompts and the PNLE prompts. */
export const OTHER_KINDS_SHAPES =
  '- typing (short answer: a term or a number, never a sentence): {"kind":"typing","stem":string,"accept":string[1-8],"rationale":string}; ' +
  'accept lists every correct spelling or form; a numeric answer is a bare number with no unit, and the unit goes in the stem\n' +
  '- cloze: {"kind":"cloze","stem":string with one "____" per blank,"blanks":string[][1-6],"rationale":string}; ' +
  'blanks[i] lists the accepted answers for the i-th "____", and the count of "____" must equal blanks.length\n' +
  '- matching: {"kind":"matching","stem":string,"pairs":[{"left":string,"right":string}][2-8],"rationale":string}; all lefts distinct, all rights distinct\n' +
  '- ordering: {"kind":"ordering","stem":string,"items":string[3-8],"rationale":string}; items listed in the CORRECT order, all distinct\n';

/** Exact JSON shape per kind. Mostly choice; the others add variety (Gizmo-style) without replacing it. */
export const MIXED_KINDS_SHAPE =
  'Mix question kinds: about 70% "choice", and the rest from "typing", "cloze", "matching", "ordering". ' +
  'Every item has "stem" and "rationale" (strings) and "kind". Exact shapes:\n' +
  '- choice: {"kind":"choice","stem":string,"choices":string[4],"answerIndex":number,"rationale":string}\n' +
  OTHER_KINDS_SHAPES +
  'Only use typing/cloze/matching/ordering when the fact suits it; otherwise use choice. Never include answers in the stem.';

const MIXED_POP_SHAPE = 'Reply with JSON only: {"questions":[...]} where each item follows one of these shapes. ' + MIXED_KINDS_SHAPE;

const MIXED_MODULE_SHAPE =
  'Reply with JSON only: {"questions":[...]} where every item also has "topic" (string, copied exactly from the topic titles given) ' +
  'and follows one of these shapes. Produce exactly the requested number of questions per topic. ' +
  MIXED_KINDS_SHAPE;

/** Like popQuizRequest, but asks for a mix of question kinds. Replies are validated by parseMixedQuestions. */
export function mixedPopQuizRequest(state: AppState, topic: Topic, count: number, now: number): ModelRequest {
  return {
    system: `${learnerProfile(state, now)}\n${MIXED_POP_SHAPE}`,
    user: `Write ${count} short quiz questions on "${topic.title}". Notes:\n${topic.body.slice(0, 2000)}`,
  };
}

/** Like moduleQuizRequest, but asks for a mix of question kinds. Replies go through parseModuleQuestions. */
export function mixedModuleQuizRequest(state: AppState, topics: Topic[], blueprint: BlueprintItem[], now: number): ModelRequest {
  const base = moduleQuizRequest(state, topics, blueprint, now);
  return { system: `${learnerProfile(state, now)}\n${MIXED_MODULE_SHAPE}`, user: base.user };
}

/** Short explanation tied to THIS question and what the learner answered. Plain text, no JSON. */
export function explainRequest(state: AppState, q: Question, learnerAnswer: string, wasCorrect: boolean, now: number): ModelRequest {
  return {
    system:
      `${learnerProfile(state, now)}\nYou are a nursing tutor. Explain in at most 120 words of plain text (no Markdown headings), ` +
      'kindly and concretely. Say why the correct answer is right and, if the learner was wrong, what likely led them astray. ' +
      'Do not invent facts beyond standard nursing knowledge; say so if unsure.',
    user:
      `Question (${kindOf(q)}): ${q.stem}\nCorrect answer: ${describeCorrect(q)}\n` +
      `Learner answered: ${learnerAnswer || '(nothing)'} (${wasCorrect ? 'correct' : 'incorrect'})\n` +
      `Stored rationale: ${q.rationale}`,
  };
}
