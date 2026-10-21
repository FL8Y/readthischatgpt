// Flow 8: a 5-item case set (single, sata, matrix, cloze, highlight) seeded as USER items (same storage keys as spec 07)
// plays through the Case study mode as one unit; the set result shows summed partial credit and reasoning levels.
import { openApp, goTab, click, see, gone, btn, assertEq } from '../scripts/e2e/harness.mjs';

const shared = {
  v: 2, area: 'NP1', topic: 'E2E Case', clusterId: 'e2e-case-1', vignette: 'A 62-year-old client is brought to the clinic with breathlessness and a cough.',
  difficulty: 3, strategy: 'ABC: breathing first', source: 'user-paste', review: 'unreviewed', aiWritten: false,
  rationale: 'This is the reasoning for the item: airway and breathing come before the other concerns.',
};
const single = {
  ...shared, id: 'e2e-case-1-a', clusterSeq: 1, type: 'single', bloom: 'recall', stem: 'What does the nurse do first?',
  options: ['Teach about diet', 'Assess the breathing', 'Check the shoe size', 'Plan the discharge'], answer: [1],
  optionRationales: ['Not urgent.', 'Breathing is first.', 'Irrelevant.', 'Too early.'],
};
const sata = {
  ...shared, id: 'e2e-case-1-b', clusterSeq: 2, type: 'sata', bloom: 'apply', stem: 'Which findings need follow-up? Select all that apply.',
  options: ['Sata right one', 'Sata wrong two', 'Sata right three', 'Sata wrong four', 'Sata wrong five'], answer: [0, 2],
  optionRationales: ['Needs follow-up.', 'Expected.', 'Needs follow-up.', 'Expected.', 'Expected.'],
};
const matrix = {
  ...shared, id: 'e2e-case-1-c', clusterSeq: 3, type: 'matrix', bloom: 'apply', stem: 'Mark each finding as improving or worsening.',
  options: [], answer: [], optionRationales: [], rows: ['Alpha row', 'Beta row'], columns: ['Improving', 'Worsening'], rowAnswer: [0, 1],
};
const cloze = {
  ...shared, id: 'e2e-case-1-d', clusterSeq: 4, type: 'cloze', bloom: 'judgment', stem: 'Complete the plan: the nurse gives {{1}} and then checks {{2}}.',
  options: [], answer: [], optionRationales: [],
  blanks: [{ choices: ['oxygen', 'sweets'], answer: 0 }, { choices: ['pulse oximetry', 'the weather'], answer: 0 }],
};
const highlight = {
  ...shared, id: 'e2e-case-1-e', clusterSeq: 5, type: 'highlight', bloom: 'judgment', stem: 'Highlight the findings that show worsening gas exchange.',
  options: ['Segment text one', 'Segment text two', 'Segment text three'], answer: [0, 2], optionRationales: [],
};
const seed = {
  'fly8.bank.v1.main': JSON.stringify({ v: 1, flags: {}, itemNotes: {}, mastery: {}, reports: [], dailyGoal: 20, requeue: {}, shards: { attempts: 0, userItems: 1 } }),
  'fly8.bank.v1.userItems.0': JSON.stringify([single, sata, matrix, cloze, highlight]),
};

export default async function ({ ctx, base: url }) {
  const { page, errors } = await openApp(ctx, url, { seed });
  // The bank now ships real case sets; pin this spec to its own seeded set (hook in practiceFlow.ts).
  await page.evaluate(() => { globalThis.__FLY8_E2E_CLUSTER__ = 'e2e-case-1'; });
  await goTab(page, 'Practice');
  await click(page.getByRole('button', { name: /^Case study/ }));

  // 1 single: correct
  await see(page.getByText('Case item 1 of 5', { exact: true }), 'case progress strip, item 1');
  await see(page.getByText(/A 62-year-old client is brought/), 'shared vignette shown');
  await click(page.getByRole('button', { name: 'Hide the case text' }));
  await gone(page.getByText(/A 62-year-old client is brought/), 'vignette hidden after collapse');
  await click(page.getByRole('button', { name: 'Show the case text' }));
  await see(page.getByText(/A 62-year-old client is brought/), 'vignette shown again');
  await click(page.getByRole('radio', { name: /^Option B\. Assess the breathing/ }));
  await click(btn(page, 'Submit'));
  await see(page.getByRole('heading', { name: 'Correct' }), 'single correct');
  await click(btn(page, 'Next'));

  // 2 sata: one of two right picks = half credit
  await see(page.getByText('Case item 2 of 5', { exact: true }), 'item 2');
  await click(page.getByRole('checkbox', { name: /^Option A\. Sata right one/ }));
  await click(btn(page, 'Submit'));
  await see(page.getByRole('heading', { name: 'Partly correct' }), 'sata partial');
  await see(page.getByText(/^5 points$/), 'sata 5 points');
  await click(btn(page, 'Next'));

  // 3 matrix: both rows right
  await see(page.getByText('Case item 3 of 5', { exact: true }), 'item 3');
  assertEq(await btn(page, 'Submit').isDisabled(), true, 'matrix Submit is disabled until every row is answered');
  await click(page.getByRole('radio', { name: /^Row 1, Alpha row\. Column Improving\./ }));
  assertEq(await btn(page, 'Submit').isDisabled(), true, 'still disabled with one row blank');
  await click(page.getByRole('radio', { name: /^Row 2, Beta row\. Column Worsening\./ }));
  await click(btn(page, 'Submit'));
  await see(page.getByRole('heading', { name: 'Correct' }), 'matrix correct');
  await see(page.getByText('Correct', { exact: true }).first(), 'per-row word shown');
  await click(btn(page, 'Next'));

  // 4 cloze: blank 1 right, blank 2 wrong = half credit
  await see(page.getByText('Case item 4 of 5', { exact: true }), 'item 4');
  await click(page.getByRole('button', { name: /^Blank 1 of 2\./ }));
  await click(page.getByRole('radio', { name: /^Choice oxygen\./ }));
  await click(page.getByRole('button', { name: /^Blank 2 of 2\./ }));
  await click(page.getByRole('radio', { name: /^Choice the weather\./ }));
  await click(btn(page, 'Submit'));
  await see(page.getByRole('heading', { name: 'Partly correct' }), 'cloze partial');
  await see(page.getByText(/^5 points$/), 'cloze 5 points');
  await click(btn(page, 'Next'));

  // 5 highlight: one of two right segments = half credit; Done confirms
  await see(page.getByText('Case item 5 of 5', { exact: true }), 'item 5');
  assertEq(await btn(page, 'Done').isDisabled(), true, 'Done disabled with nothing highlighted');
  await click(page.getByRole('checkbox', { name: /^Segment 1\. Segment text one/ }));
  await see(page.getByText('1 highlighted.', { exact: true }), 'highlight count');
  await click(btn(page, 'Done'));
  await see(page.getByRole('heading', { name: 'Partly correct' }), 'highlight partial');

  // set result: (1 + .5 + 1 + .5 + .5) / 5 = 70%
  await see(page.getByRole('heading', { name: 'Case set result' }), 'case set result card');
  await see(page.getByText('70%', { exact: true }), 'summed credit 70%');
  await see(page.getByText(/35 points/), '10 + 5 + 10 + 5 + 5 points');
  await see(page.getByText('Recall 1 of 1 · Apply 1 of 2 · Judgment 0 of 2', { exact: true }), 'reasoning-level summary from bloom tags');
  await click(btn(page, 'Finish'));
  await see(page.getByRole('heading', { name: 'Review grid' }), 'results screen after the set');
  return { errors };
}
