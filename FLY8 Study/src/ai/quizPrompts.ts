import type { AppState, Question, Topic } from '../core/types';
import { describeCorrect, kindOf } from '../core/grading';
import type { BlueprintItem, RemediationItem } from '../core/quiz';
import type { ModelRequest } from './provider';
import { CRAFT, learnerProfile } from './prompts';

const MODULE_SHAPE =
  `PNLE 4-choice items. ${CRAFT} Exactly the requested number of questions per topic. ` +
  'JSON only: {"questions":[{"topic":string,"stem":string,"choices":string[],"answerIndex":number,"rationale":string}]}, ' +
  '"topic" copied exactly from the titles given, answerIndex zero-based.';

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
      `Write a ${total}-question module quiz covering EVERY topic below, exactly the stated count each; ` +
      `weaker topics get more, aimed at their reasoning errors.\n\n${sections.join('\n\n')}`,
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
      'The learner is weak on the topics below. Write NEW notes that fix the likely reasoning gaps; skip topics not listed. ' +
      'Per topic: the mechanism (why), then the decision rule, then the exam trap, then a mnemonic if it helps; every fact must be testable. ' +
      "Link related concepts as [[Wikilinks]]. Mark anything beyond the learner's notes. " +
      'Markdown only: start each new topic with a "# Title" line (a new title, not an existing one).\n\n' +
      sections.join('\n\n'),
  };
}

/** Shapes for the non-choice kinds, shared by the plain mixed prompts and the PNLE prompts. */
export const OTHER_KINDS_SHAPES =
  '- typing (a term or a number, never a sentence): {"kind":"typing","stem":string,"accept":string[1-8],"rationale":string}; ' +
  'accept lists every correct spelling; a numeric answer is a bare number and the unit goes in the stem\n' +
  '- cloze: {"kind":"cloze","stem":string with one "____" per blank,"blanks":string[][1-6],"rationale":string}; ' +
  'blanks[i] lists accepted answers for the i-th "____"; the count of "____" equals blanks.length\n' +
  '- matching: {"kind":"matching","stem":string,"pairs":[{"left":string,"right":string}][2-8],"rationale":string}; lefts distinct, rights distinct\n' +
  '- ordering: {"kind":"ordering","stem":string,"items":string[3-8],"rationale":string}; items in the CORRECT order, all distinct\n';

/** Exact JSON shape per kind. Mostly choice; the others add variety (Gizmo-style) without replacing it. */
export const MIXED_KINDS_SHAPE =
  'About 70% "choice"; use typing, cloze, matching or ordering only where the fact suits. ' +
  'Every item has "kind", "stem", "rationale"; never put the answer in the stem. Exact shapes:\n' +
  '- choice: {"kind":"choice","stem":string,"choices":string[4],"answerIndex":number,"rationale":string}\n' +
  OTHER_KINDS_SHAPES;

const MIXED_POP_SHAPE = `PNLE-style items. ${CRAFT} Reply with JSON only: {"questions":[...]}, each item one of these shapes. ` + MIXED_KINDS_SHAPE;

const MIXED_MODULE_SHAPE =
  `PNLE-style items. ${CRAFT} Exactly the requested number of questions per topic. ` +
  'Reply with JSON only: {"questions":[...]}, each item also has "topic" (copied exactly from the titles given) and is one of these shapes. ' +
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
      `${learnerProfile(state, now)}\nPlain text, under 120 words, no headings. ` +
      'Name the cue the correct answer rests on and the rule that ranks it first (ABC, Maslow, safety, assess before act, least invasive). ' +
      'If the learner was wrong, name the error type behind their answer. End with a flip: the one change that would make their answer correct. ' +
      'Only standard nursing facts; say if unsure.',
    user:
      `Question (${kindOf(q)}): ${q.stem}\nCorrect answer: ${describeCorrect(q)}\n` +
      `Learner answered: ${learnerAnswer || '(nothing)'} (${wasCorrect ? 'correct' : 'incorrect'})\n` +
      `Stored rationale: ${q.rationale}`,
  };
}
