// Flow 5: Custom practice with a topic filter and count 10; the session holds only questions from the chosen topics.
import { openApp, goTab, click, see, btn, role, assert, assertEq } from '../scripts/e2e/harness.mjs';

export default async function ({ ctx, base }) {
  const { page, errors } = await openApp(ctx, base);
  await goTab(page, 'Practice');
  await click(page.getByRole('button', { name: /^Custom practice/ }));
  await see(page.getByRole('heading', { name: 'Topics' }), 'custom setup');
  await see(page.getByText('All topics', { exact: true }), 'nothing ticked = all topics');

  // Open NP1 > first group and tick one single topic.
  await click(btn(page, 'Open')); // NP1
  await click(btn(page, 'Open')); // first group under NP1
  const boxes = page.getByRole('checkbox', { name: /, \d+$/ });
  await see(boxes.nth(2), 'a topic checkbox');
  await boxes.nth(2).click();
  await see(page.getByText('1 topic(s) chosen', { exact: true }), 'one topic chosen');
  await see(page.getByText(/^\d+ (match|matches); this session will have \d+\.$/), 'pool summary for one topic');

  // Tick the whole NP1 area instead (a larger pool), set count 10.
  await boxes.nth(0).click();
  const subtitle = await page.getByText(/^\d+ topic\(s\) chosen$/).first().innerText();
  assert(Number.parseInt(subtitle, 10) > 1, `area tick selects many topics (${subtitle})`);
  await click(role(page, 'radio', '10', { exact: true }));
  await see(page.getByText(/this session will have 10\./), 'session will have 10');
  await click(btn(page, 'Start 10 questions'));

  await see(page.getByText('Question 1 of 10', { exact: true }), 'custom session started with 10');
  await page.waitForTimeout(400);
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('fly8.bank.v1.session')));
  assertEq(saved.mode, 'custom', 'session mode');
  assertEq(saved.order.length, 10, 'ten questions');
  assert(saved.order.every((id) => id.startsWith('np1') || id.startsWith('cs-np1')), `all questions are NP1 (${saved.order.join(',')})`);
  return { errors };
}
