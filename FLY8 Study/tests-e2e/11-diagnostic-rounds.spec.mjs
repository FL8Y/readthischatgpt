// Flow 11: optional 3-round diagnostic. Hub entry -> Round 1 -> result (areas, two buttons) -> "I'm done for now" keeps
// the rounds sequential -> Round 2 -> weakest bundles -> Round 3 -> Weakness profile card -> survives a reload.
// Also: "Start Round 3 anyway" is offered after Round 1 only. Answers use harness helpers, so any question type works.
import { openApp, answerFirst, click, see, btn, goTab, assert, assertEq } from '../scripts/e2e/harness.mjs';

/** Answer every question of the running round; returns how many there were. */
async function playRound(page) {
  const first = page.getByText(/^Question 1 of \d+$/);
  await see(first, 'question 1 of the round');
  const total = Number.parseInt((await first.first().textContent()).match(/of (\d+)/)[1], 10);
  for (let n = 1; n <= total; n++) {
    await see(page.getByText(`Question ${n} of ${total}`, { exact: true }), `progress Question ${n} of ${total}`);
    await answerFirst(page);
    await click(btn(page, n === total ? 'Finish' : 'Next'));
  }
  return total;
}

const disabled = async (loc) => (await loc.first().getAttribute('aria-disabled')) === 'true' || (await loc.first().isDisabled());

export default async function ({ ctx, base }) {
  const { page, errors } = await openApp(ctx, base);
  await goTab(page, 'Practice');

  // Hub entry: optional, three rounds, only Round 1 open at first.
  await see(page.getByRole('heading', { name: 'Diagnostic (optional, 3 rounds)' }), 'diagnostic hub entry');
  await see(btn(page, 'Start Round 1'), 'Round 1 button');
  assert(await disabled(btn(page, 'Start Round 2')), 'Round 2 is locked before Round 1');
  assert(await disabled(btn(page, 'Start Round 3')), 'Round 3 is locked before Round 1');
  assertEq(await page.getByText('Start Round 3 anyway').count(), 0, 'no skip-ahead before Round 1');
  assertEq(await page.getByRole('button', { name: 'See my weakness profile' }).count(), 0, 'no profile yet');

  // Round 1: the broad 25-question check.
  await click(btn(page, 'Start Round 1'));
  const t1 = await playRound(page);
  assert(t1 >= 20 && t1 <= 25, `round 1 has about 25 questions (got ${t1})`);
  await see(page.getByText('Round 1: broad check'), 'Round 1 result');
  await see(page.getByText('Your level by area'), 'per-area accuracy');
  await see(page.getByText('Where to look next'), 'weak-area list');
  await see(btn(page, 'Go deeper (Round 2)'), 'Go deeper button');
  await click(btn(page, "I'm done for now"));

  // Back on the hub: Round 1 done, Round 2 open, Round 3 can be started anyway.
  await see(page.getByText('Round 1 done'), 'Round 1 marked done');
  await see(btn(page, 'Retake Round 1'), 'retake offered');
  assert(!(await disabled(btn(page, 'Start Round 2'))), 'Round 2 unlocked');
  await see(btn(page, 'Start Round 3 anyway'), 'Round 3 anyway offered after Round 1');
  await see(page.getByRole('button', { name: 'See my weakness profile' }), 'profile available after Round 1');

  // Round 2: drill-down.
  await click(btn(page, 'Start Round 2'));
  const t2 = await playRound(page);
  assert(t2 >= 10 && t2 <= 20, `round 2 has up to 20 questions (got ${t2})`);
  await see(page.getByText('Round 2: drill down'), 'Round 2 result');
  await see(page.getByText('Weakest topic bundles'), 'weakest bundles card');
  await click(btn(page, 'Go deeper (Round 3)'));

  // Round 3: pinpoint, then the Weakness profile card.
  const t3 = await playRound(page);
  assert(t3 >= 5 && t3 <= 20, `round 3 has up to 20 questions (got ${t3})`);
  await see(page.getByText('Round 3: pinpoint'), 'Round 3 result');
  await see(page.getByRole('heading', { name: 'Weakness profile' }), 'Weakness profile card');
  await see(page.getByText(/not a pass prediction/).first(), 'honest label');
  await see(btn(page, 'Practice my weak spots'), 'weak-spots shortcut');
  await click(btn(page, 'Done'));

  // Everything done: retake labels, no skip-ahead hint, profile survives a reload.
  await see(page.getByText('Round 3 done'), 'Round 3 marked done');
  assertEq(await page.getByText('Start Round 3 anyway').count(), 0, 'no skip-ahead once Round 2 is done');
  await page.reload();
  await goTab(page, 'Practice');
  await see(page.getByText('Round 3 done'), 'rounds survive a reload');
  await click(page.getByRole('button', { name: 'See my weakness profile' }));
  await see(page.getByRole('heading', { name: 'Weakness profile' }).last(), 'saved profile after reload');
  return { errors };
}
