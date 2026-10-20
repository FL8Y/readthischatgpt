// Flow 4: Save and exit mid-session, reload the page, Hub shows Continue, resume at the same question with answers kept.
import { openApp, startQuick, answerFirst, click, see, btn, goTab, assertEq } from '../scripts/e2e/harness.mjs';

export default async function ({ ctx, base }) {
  const { page, errors } = await openApp(ctx, base);
  await startQuick(page, 10);

  for (let n = 1; n <= 3; n++) {
    await answerFirst(page);
    await click(btn(page, 'Next'));
  }
  await see(page.getByText('Question 4 of 10', { exact: true }), 'on question 4');
  const stem4 = await page.getByRole('heading').first().innerText();

  await click(page.getByRole('button', { name: 'Leave practice' }));
  await click(btn(page, 'Save and exit'));
  await see(page.getByRole('heading', { name: 'Continue your session' }), 'Continue card on the hub');
  await see(page.getByText(/Quick practice: 3 of 10 answered/), 'resume summary');
  await page.waitForTimeout(500); // let the async save settle

  await page.reload();
  await goTab(page, 'Practice');
  await see(page.getByRole('heading', { name: 'Continue your session' }), 'Continue card after reload');
  await see(page.getByText(/Quick practice: 3 of 10 answered/), 'resume summary after reload');
  await click(btn(page, 'Continue'));
  // Save and exit paused the timer, so the question stays hidden until Resume.
  await see(page.getByRole('heading', { name: 'Paused' }), 'paused overlay after Continue');
  await click(btn(page, 'Resume'));
  await see(page.getByText('Question 4 of 10', { exact: true }), 'resumed at question 4');
  assertEq(await page.getByRole('heading').first().innerText(), stem4, 'same question after resume');

  // Earlier answers are kept: Q3 shows A selected and its feedback.
  await click(btn(page, 'Previous'));
  await see(page.getByText('Question 3 of 10', { exact: true }), 'previous goes to Q3');
  await see(page.getByRole('radio', { name: /^Option A\. .*Selected\./ }).or(page.getByRole('checkbox', { name: /^Option A\. .*Selected\./ })), 'answer A kept');
  await see(page.getByText(/AI-written/), 'feedback kept after resume');

  // Finishing the rest works and the session clears from the hub.
  await click(btn(page, 'Next'));
  for (let n = 4; n <= 10; n++) {
    await answerFirst(page);
    await click(btn(page, n === 10 ? 'Finish' : 'Next'));
  }
  await see(page.getByRole('heading', { name: 'Review grid' }), 'results after resumed session');
  await see(page.getByText(/10 answered/), 'all 10 counted');
  await click(btn(page, 'Done'));
  await see(btn(page, 'Quick 10'), 'hub');
  assertEq(await page.getByRole('heading', { name: 'Continue your session' }).count(), 0, 'no Continue card once finished');
  return { errors };
}
