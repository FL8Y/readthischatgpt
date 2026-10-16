import React, { useState } from 'react';
import type { AppState, Question } from '../core/types';
import type { QuizSession } from '../core/quiz';
import { Quiz } from './Quiz';

/**
 * Web-preview only (opened with #demo=choice|typing|matching|ordering|cloze). It mounts the real Quiz with fixed
 * sample questions so screenshots do not need an AI. Never reachable on a phone: App only uses it on web.
 */
const choice: Question = {
  id: 'demo-c1',
  topicId: 'demo-topic',
  stem: 'A client with a chest tube has continuous bubbling in the water-seal chamber. What should the nurse do first?',
  choices: [
    'Check the system for an air leak, starting at the insertion site',
    'Clamp the chest tube close to the client',
    'Document the finding as expected',
    'Raise the drainage unit above chest level',
  ],
  answerIndex: 0,
  rationale: 'Continuous bubbling in the water-seal chamber means air is leaking. Assess the system from the client outward before changing anything.',
  strategy: 'Nursing process: assess first',
  optionRationales: [
    'Right: assess for the leak first, starting at the insertion site and moving down the tubing.',
    'Clamping can cause a tension pneumothorax if air keeps entering the pleural space.',
    'Continuous bubbling is not expected; intermittent bubbling with breathing is.',
    'The unit must stay below chest level so fluid cannot drain back into the client.',
  ],
  reasoning: 'Air leak = something is open. Look for it before you act, and never clamp a tube that may be venting trapped air.',
};
const typing: Question = {
  id: 'demo-t1',
  topicId: 'demo-topic',
  kind: 'typing',
  stem: 'Which electrolyte is most associated with peaked T waves on an ECG?',
  choices: [],
  answerIndex: 0,
  accept: ['potassium', 'hyperkalemia', 'k'],
  rationale: 'High potassium (hyperkalemia) produces tall, peaked T waves.',
};
const matching: Question = {
  id: 'demo-m1',
  topicId: 'demo-topic',
  kind: 'matching',
  stem: 'Match each vitamin to its main deficiency finding.',
  choices: [],
  answerIndex: 0,
  pairs: [
    { left: 'Vitamin C', right: 'Scurvy' },
    { left: 'Vitamin D', right: 'Rickets' },
    { left: 'Vitamin B12', right: 'Pernicious anemia' },
  ],
  rationale: 'Classic pairings worth memorising.',
};
const ordering: Question = {
  id: 'demo-o1',
  topicId: 'demo-topic',
  kind: 'ordering',
  stem: 'Put the nursing process steps in order.',
  choices: [],
  answerIndex: 0,
  items: ['Assessment', 'Diagnosis', 'Planning', 'Implementation', 'Evaluation'],
  rationale: 'ADPIE.',
};
const cloze: Question = {
  id: 'demo-z1',
  topicId: 'demo-topic',
  kind: 'cloze',
  stem: 'The normal adult heart rate is ____ to ____ beats per minute.',
  choices: [],
  answerIndex: 0,
  blanks: [['60'], ['100']],
  rationale: 'Resting adult range.',
};

const BY_KIND: Record<string, Question[]> = {
  choice: [choice, { ...choice, id: 'demo-c2' }, { ...choice, id: 'demo-c3' }],
  typing: [typing, { ...typing, id: 'demo-t2' }],
  matching: [matching, { ...matching, id: 'demo-m2' }],
  ordering: [ordering],
  cloze: [cloze],
};

export function DemoHarness({ state, update, kind }: { state: AppState; update: (s: AppState) => void; kind: string }) {
  const [done, setDone] = useState(false);
  const questions = BY_KIND[kind] ?? BY_KIND.choice;
  const session: QuizSession = { id: `demo-${kind}`, kind: 'module', folderId: 'np1', questions, createdAt: 0 };
  if (done) return null;
  return <Quiz state={state} update={update} session={session} onDone={() => setDone(true)} onCancel={() => setDone(true)} />;
}
