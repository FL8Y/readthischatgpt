// Flow 3: strike an option by long-press, flag a question, open the question map and jump.
import { openApp, startQuick, answerFirst, click, see, btn, longPress, assertEq } from '../scripts/e2e/harness.mjs';

export default async function ({ ctx, base }) {
  const { page, errors } = await openApp(ctx, base);
  await startQuick(page, 10);

  // Strike option B by long-press, then restore it. Quick sets mix item types (cloze, matrix, highlight have no option rows),
  // so this part only runs when the first question has plain option rows.
  const optB = () => page.getByRole('radio', { name: /^Option B\./ }).or(page.getByRole('checkbox', { name: /^Option B\./ }));
  if ((await optB().count()) > 0) {
    assertEq((await optB().first().getAttribute('aria-label')).includes('Crossed out'), false, 'B starts uncrossed');
    await longPress(page, optB());
    await see(page.getByRole('radio', { name: /^Option B\..*Crossed out\./ }).or(page.getByRole('checkbox', { name: /^Option B\..*Crossed out\./ })), 'option B crossed out');
    await see(page.getByText('Crossed out (long press to restore)'), 'crossed-out caption');
    await longPress(page, optB());
    await see(page.getByRole('radio', { name: /^Option B\. .*Not selected\.$/ }).or(page.getByRole('checkbox', { name: /^Option B\. .*Not selected\.$/ })), 'option B restored');
  }

  // Flag Q1, then answer it.
  await click(btn(page, 'Flag this question'));
  await see(btn(page, 'Remove flag'), 'flag toggled on');
  await see(page.getByText('Flagged', { exact: true }), 'Flagged chip');
  await answerFirst(page);
  await click(btn(page, 'Next'));
  await see(page.getByText('Question 2 of 10', { exact: true }), 'on question 2');

  // Question map: Q1 is answered + flagged, Q5 is not answered. Jump to Q5.
  await click(btn(page, 'Open question map'));
  await see(page.getByRole('heading', { name: 'Question map' }), 'map sheet');
  await see(btn(page, 'Question 1, Answered, flagged'), 'Q1 answered and flagged in the map');
  await see(btn(page, 'Question 2, Not answered, current'), 'Q2 current in the map');
  await see(page.getByText(/answered 1 .*not answered 9 .*flagged 1/), 'map counts');
  await click(btn(page, 'Question 5, Not answered'));
  await see(page.getByText('Question 5 of 10', { exact: true }), 'jumped to question 5');
  await see(btn(page, 'Flag this question'), 'Q5 is not flagged');

  // Jump back to Q1: its answer and flag are kept and feedback shows.
  await click(btn(page, 'Open question map'));
  await click(btn(page, 'Question 1, Answered, flagged'));
  await see(page.getByText('Question 1 of 10', { exact: true }), 'back on question 1');
  await see(btn(page, 'Remove flag'), 'flag kept');
  await see(page.getByText(/AI-written/), 'feedback kept');
  return { errors };
}
