// Flow 2: Quick practice 10 -> answer all (first option, Submit, Next) -> rationale card with the AI-written badge
// -> Results (score + review grid) -> History lists the session.
import { openApp, startQuick, answerFirst, click, see, btn, goTab, assert, assertEq } from '../scripts/e2e/harness.mjs';

export default async function ({ ctx, base }) {
  const { page, errors } = await openApp(ctx, base);
  await startQuick(page, 10);

  for (let n = 1; n <= 10; n++) {
    await see(page.getByText(`Question ${n} of 10`, { exact: true }), `progress Question ${n} of 10`);
    await answerFirst(page);
    if (n === 1) {
      // Honest review label: the bundled bank is AI-written and not nurse checked.
      await see(page.getByText(/AI-written/), "'AI-written' badge on the rationale card");
      await see(page.getByText(/^Strategy: /), 'strategy chip');
      assertEq(await page.getByText(/Checked by a nurse/).count(), 0, 'no false nurse-checked claim');
    }
    await click(btn(page, n === 10 ? 'Finish' : 'Next'));
  }

  // Results
  await see(page.getByRole('heading', { name: 'Review grid' }), 'Results review grid');
  await see(page.getByText(/of 10 fully correct/), 'score line');
  await see(page.getByText(/\d+%/).first(), 'score percent');
  const cells = await page.getByRole('button', { name: /^Question \d+: .*Open review$/ }).count();
  assertEq(cells, 10, 'review grid has 10 cells');

  // Open one review cell and come back.
  await click(page.getByRole('button', { name: /^Question 3: / }));
  await see(page.getByText(/AI-written/), 'review shows rationale card');
  await click(page.getByRole('button', { name: 'Leave practice' }));
  await click(btn(page, 'Save and exit'));
  await see(page.getByRole('heading', { name: 'Review grid' }), 'back on Results');
  await click(btn(page, 'Done'));

  // History
  await see(btn(page, 'Quick 10'), 'hub after Done');
  await click(page.getByRole('button', { name: /^History/ }));
  const row = page.getByRole('button', { name: /^Quick, .*10 of 10 answered/ });
  await see(row, 'History row for the session');
  assert((await page.getByText('No sessions yet').count()) === 0, 'history is not empty');
  await goTab(page, 'Home');
  return { errors };
}
