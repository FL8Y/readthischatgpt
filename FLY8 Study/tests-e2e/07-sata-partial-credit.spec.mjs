// Flow 7: a select-all-that-apply item seeded as a USER item (same storage keys src/bank/store.ts writes) scores partial credit.
import { openApp, goTab, click, see, btn, role, assertEq } from '../scripts/e2e/harness.mjs';

const base = {
  v: 2, area: 'NP1', topic: 'E2E Topic', vignette: 'A nurse reviews findings during a home visit.',
  difficulty: 2, strategy: 'Assess first', source: 'user-paste', review: 'unreviewed', aiWritten: false, keyFacts: ['E2E fact'],
};
const sata = {
  ...base, id: 'e2e-sata-1', type: 'sata', stem: 'Which findings need follow-up? Select all that apply.',
  options: ['Sata right one', 'Sata wrong two', 'Sata right three', 'Sata wrong four', 'Sata wrong five'],
  answer: [0, 2],
  rationale: 'Options one and three are the findings that need follow-up; the others are expected.',
  optionRationales: ['Needs follow-up.', 'Expected finding.', 'Needs follow-up.', 'Expected finding.', 'Expected finding.'],
};
const single = {
  ...base, id: 'e2e-single-1', type: 'single', stem: 'Which action comes first in the nursing process?',
  options: ['Plan the care', 'Assess the client', 'Evaluate the outcome', 'Implement the plan'],
  answer: [1],
  rationale: 'Assessment always comes first because every later step depends on the data gathered.',
  optionRationales: ['Needs data first.', 'Correct: assess first.', 'Comes last.', 'Needs a plan first.'],
};
const seed = {
  'fly8.bank.v1.main': JSON.stringify({ v: 1, flags: {}, itemNotes: {}, mastery: {}, reports: [], dailyGoal: 20, requeue: {}, shards: { attempts: 0, userItems: 1 } }),
  'fly8.bank.v1.userItems.0': JSON.stringify([sata, single]),
};

export default async function ({ ctx, base: url }) {
  const { page, errors } = await openApp(ctx, url, { seed });
  await goTab(page, 'Practice');
  await click(page.getByRole('button', { name: /^Custom practice/ }));

  // The user topic shows up under NP1 > Other topics.
  await click(btn(page, 'Open')); // NP1
  await see(page.getByRole('checkbox', { name: /^Other topics, \d+$/ }), "'Other topics' group group exists");
  await click(page.getByRole('checkbox', { name: /^Other topics, \d+$/ }).locator('xpath=../..').getByRole('button', { name: 'Open', exact: true }));
  const topic = page.getByRole('checkbox', { name: /^E2E Topic, 2$/ });
  await see(topic, 'seeded topic with 2 questions');
  await topic.click();
  await see(page.getByText(/2 matches; this session will have 2\./), 'pool of exactly the 2 seeded items');
  await click(btn(page, 'Start 2 questions'));

  for (let n = 1; n <= 2; n++) {
    await see(page.getByText(`Question ${n} of 2`, { exact: true }), `question ${n}`);
    if ((await page.getByText('Select all that apply', { exact: true }).count()) > 0) {
      // Pick only one of the two correct options: 1 right, 0 wrong = 50% credit.
      await click(page.getByRole('checkbox', { name: /^Option A\. Sata right one/ }));
      await click(btn(page, 'Submit'));
      await see(page.getByRole('heading', { name: 'Partly correct' }), "'Partly correct' verdict");
      await see(page.getByText(/^5 points$/), '5 of 10 points for 1 of 2 correct picks');
    } else {
      await click(page.getByRole('radio', { name: /^Option B\. Assess the client/ }));
      await click(btn(page, 'Submit'));
      await see(page.getByRole('heading', { name: 'Correct' }), 'Correct verdict');
      await see(page.getByText(/^10 points$/), '10 points');
    }
    await click(btn(page, n === 2 ? 'Finish' : 'Next'));
  }

  await see(page.getByRole('heading', { name: 'Review grid' }), 'results');
  await see(page.getByText(/1 of 2 fully correct · 15 points/), 'results count only full credit as correct, plus partial points');
  await see(page.getByText(/score counts partial credit/), 'partial-credit wording');
  await see(page.getByText('75%', { exact: true }), 'score 75% = (1 + 0.5) / 2');
  await see(page.getByRole('button', { name: /^Question \d+: Partial\. Open review$/ }), 'review grid marks the sata item Partial');
  await see(page.getByText(/◐ Partial 1/), 'legend counts 1 partial');
  assertEq(await page.getByText('Needs more practice').count(), 0, 'verdict word matches 75%');
  return { errors };
}
