// Flow 6: Stats tab renders cleanly with 0 attempts and again after a finished session.
import { openApp, startQuick, answerFirst, click, see, btn, goTab, assertEq } from '../scripts/e2e/harness.mjs';

const SECTIONS = ['Passing readiness', 'Daily goal and streak'];

export default async function ({ ctx, base }) {
  const { page, errors } = await openApp(ctx, base);

  await goTab(page, 'Stats');
  for (const h of SECTIONS) await see(page.getByRole('heading', { name: h }), `Stats section ${h}`);
  await see(page.getByText('Locked', { exact: true }), 'readiness locked with 0 attempts');
  await see(page.getByText(/^0\/20$/), 'daily goal 0/20');

  await startQuick(page, 10);
  for (let n = 1; n <= 10; n++) {
    await answerFirst(page);
    await click(btn(page, n === 10 ? 'Finish' : 'Next'));
  }
  await see(page.getByRole('heading', { name: 'Review grid' }), 'results');
  await click(btn(page, 'Done'));

  await goTab(page, 'Stats');
  for (const h of SECTIONS) await see(page.getByRole('heading', { name: h }), `Stats section ${h} after session`);
  await see(page.getByText(/^10\/20$/), 'daily goal 10/20 after the session');
  assertEq(await page.getByText(/^0\/20$/).count(), 0, 'goal no longer 0/20');
  await goTab(page, 'Home');
  await see(page.getByText(/^10\/20$/), 'Home Today card shows 10/20');
  return { errors };
}
