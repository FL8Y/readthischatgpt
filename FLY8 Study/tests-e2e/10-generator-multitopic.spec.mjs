// Flow 10: Prompt Maker with several topics ticked: word estimate, style mix, batches, copy button, export file, import back.
import { openApp, goTab, click, see, btn, role, assert } from '../scripts/e2e/harness.mjs';

export default async function ({ ctx, base }) {
  const { page, errors } = await openApp(ctx, base);
  await goTab(page, 'More');
  await click(page.getByText('Prompt Maker', { exact: true }));
  await see(page.getByRole('heading', { name: 'Question files' }).or(page.getByText('Question files', { exact: true })), 'prompt maker open');
  await see(page.getByText(/Nothing ticked yet/), 'nothing ticked at first');

  // Open NP1, then its first group, and tick three single topics.
  await click(btn(page, 'Open')); // NP1
  await click(btn(page, 'Open')); // first group under NP1
  const boxes = page.getByRole('checkbox', { name: /, \d+$/ });
  await see(boxes.nth(4), 'topic checkboxes');
  for (const i of [2, 3, 4]) await boxes.nth(i).click();
  await see(page.getByText(/3 topic\(s\) ticked/), 'three topics ticked');

  // 3 per topic = 9 questions; one prompt with a word estimate.
  await click(role(page, 'radio', '3', { exact: true }));
  const summary = await page.getByText(/^\d+ questions in \d+ prompts?\. This prompt: about \d+ words\.$/).first().innerText();
  const words = Number.parseInt(summary.match(/about (\d+) words/)[1], 10);
  assert(words > 1500 && words < 3300, `word estimate is plausible (${words})`);
  assert(/^9 questions in 1 prompt\./.test(summary), `nine questions in one prompt (${summary})`);

  // 5 per topic = 15 questions -> two batches.
  await click(role(page, 'radio', '5', { exact: true }));
  await see(page.getByText(/^15 questions in 2 prompts\./), 'two batches for 15 questions');
  await see(role(page, 'radio', /^Batch 2 of 2/), 'batch 2 chip');
  await click(role(page, 'radio', /^Batch 2 of 2/));
  await see(btn(page, 'Copy prompt'), 'copy prompt button');

  // Style mix: select-all share shows about 10%.
  await see(page.getByLabel('Select all that apply share'), 'sata share');
  assert((await page.getByLabel('Select all that apply share').innerText()) === '10%', 'sata share defaults to 10%');

  // Export my questions (none yet): the whole bank downloads as a .txt with the header and END line.
  await click(role(page, 'radio', 'The whole bank', { exact: true }));
  const [download] = await Promise.all([page.waitForEvent('download'), click(page.getByRole('button', { name: /^Export \d+ question\(s\) to a file$/ }))]);
  assert(/^fly8-questions-\d{8}-\d+\.txt$/.test(download.suggestedFilename()), `file name ${download.suggestedFilename()}`);
  const stream = await download.createReadStream();
  let text = '';
  for await (const chunk of stream) text += chunk;
  const lines = text.trimEnd().split('\n');
  assert(/^FLY8-BANK v1 count=\d+$/.test(lines[0]), `header ${lines[0]}`);
  assert(/^#END n=\d+ sum=[0-9a-f]{8}$/.test(lines[lines.length - 1]), 'end line');
  assert(lines.length === Number(lines[0].match(/count=(\d+)/)[1]) + 2, 'one line per question');
  return { errors };
}
