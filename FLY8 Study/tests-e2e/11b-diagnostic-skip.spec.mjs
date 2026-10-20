// Flow 11b: the diagnostic is skippable. Nothing else is locked; "Start Round 3 anyway" works after Round 1 only.
import { openApp, answerFirst, click, see, btn, goTab, assert } from '../scripts/e2e/harness.mjs';

export default async function ({ ctx, base }) {
  const { page, errors } = await openApp(ctx, base);
  await goTab(page, 'Practice');
  // Without any diagnostic, normal practice is available.
  await see(btn(page, 'Quick 10'), 'quick practice available without the diagnostic');
  assert((await btn(page, 'Quick 10').first().getAttribute('aria-disabled')) !== 'true', 'quick practice is not locked');

  await click(btn(page, 'Start Round 1'));
  const first = page.getByText(/^Question 1 of \d+$/);
  await see(first, 'round 1 running');
  const total = Number.parseInt((await first.first().textContent()).match(/of (\d+)/)[1], 10);
  for (let n = 1; n <= total; n++) {
    await answerFirst(page);
    await click(btn(page, n === total ? 'Finish' : 'Next'));
  }
  await click(btn(page, "I'm done for now"));
  await click(btn(page, 'Start Round 3 anyway'));
  await see(page.getByText(/^Question 1 of \d+$/), 'round 3 started without round 2');
  await click(page.getByRole('button', { name: 'Leave practice' }));
  await click(btn(page, 'Save and exit'));
  await see(page.getByText('Diagnostic (optional, 3 rounds)'), 'back on the hub');
  return { errors };
}
