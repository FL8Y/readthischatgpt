// Flow 12: the Learn tab stays short: after adding every ready-made subject, folders are collapsed, open on tap, and page 25 at a time.
import { openApp, goTab, click, see, btn, assert } from '../scripts/e2e/harness.mjs';

export default async function ({ ctx, base }) {
  const { page, errors } = await openApp(ctx, base);
  await goTab(page, 'More');
  await click(page.getByText('Library', { exact: true }));
  await click(btn(page, 'Add every subject'));
  await goTab(page, 'Learn');
  await see(btn(page, 'Open Study Guide'), 'study guide card');

  const folderButtons = page.getByRole('button', { name: /\. (Expand|Collapse)$/ });
  await see(folderButtons.first(), 'folder rows');
  assert((await folderButtons.count()) >= 5, 'several folders are listed');
  // Collapsed: no topic rows show their studied/mastery label buttons beyond the folder rows.
  const topicRows = page.getByRole('button', { name: /, not tested$|, \d+% mastery$|studied, / });
  assert((await topicRows.count()) === 0, 'no topic rows while folders are collapsed');

  await folderButtons.first().click();
  await see(topicRows.first(), 'topic rows after opening a folder');
  assert((await topicRows.count()) <= 25, 'at most 25 topic rows per folder page');
  return { errors };
}
