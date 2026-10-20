// Flow 9: answer a question, tap "Read this in your notes", see the note, go back, the session is intact.
import { openApp, goTab, click, see, gone, btn, assertEq } from '../scripts/e2e/harness.mjs';

const item = {
  v: 2, id: 'e2e-note-1', type: 'single', area: 'NP1', topic: 'E2E Linked', noteId: 'e2e-note', vignette: '', stem: 'Which action is the nurse priority for the linked note?',
  options: ['Teach about diet', 'Assess the breathing', 'Check the shoe size', 'Plan the discharge'], answer: [1],
  rationale: 'Breathing comes first because airway and breathing outrank the other concerns here.',
  optionRationales: ['Not urgent.', 'Breathing is first.', 'Irrelevant.', 'Too early.'],
  strategy: 'ABC: breathing first', difficulty: 2, keyFacts: ['Airway before teaching'], source: 'user-paste', review: 'unreviewed', aiWritten: true,
};
const noItem = { ...item, id: 'e2e-note-2', topic: 'E2E Orphan', noteId: undefined, stem: 'Which action is the nurse priority for the orphan item?' };
const seed = {
  'fly8.bank.v1.main': JSON.stringify({ v: 1, flags: {}, itemNotes: {}, mastery: {}, reports: [], dailyGoal: 20, requeue: {}, shards: { attempts: 0, userItems: 1 } }),
  'fly8.bank.v1.userItems.0': JSON.stringify([item, noItem]),
  'nursing-study-app/state/v1': JSON.stringify({
    folders: [{ id: 'f1', name: 'E2E' }],
    topics: [{ id: 'preset-e2e-note', folderId: 'f1', title: 'E2E Linked Note', body: '## Airway first\nCheck the airway and breathing before teaching.', sourceIds: [] }],
    sources: [], chunks: [], events: [], diagnosticsDone: [],
    settings: { provider: 'manual', apiKey: '', model: 'manual', aiChosen: true },
  }),
};

export default async function ({ ctx, base }) {
  const { page, errors } = await openApp(ctx, base, { seed, setup: false });
  await see(page.getByRole('tab', { name: 'Home', exact: true }), 'app loaded');
  await page.evaluate(() => { globalThis.__FLY8_E2E_CLUSTER__ = ''; });
  await goTab(page, 'Practice');
  await click(page.getByRole('button', { name: /^Custom practice/ }));
  // Seeded items have no bundle, so they sit under NP1 > Other topics.
  await click(btn(page, 'Open')); // NP1
  // Find the "Other topics" group by name (the tree grows as packs are added), then open it.
  const otherRow = page.getByRole('checkbox', { name: /^Other topics, / }).first();
  await see(otherRow, 'NP1 Other topics group');
  await otherRow.locator('xpath=ancestor::*[.//*[@role="button" and @aria-label="Open"]][1]').getByRole('button', { name: 'Open', exact: true }).first().click();
  const linked = page.getByRole('checkbox', { name: /^E2E Linked, / });
  await click(linked);
  await click(page.getByRole('button', { name: /^Start \d+ question/ }));
  await see(page.getByText('Which action is the nurse priority for the linked note?'), 'linked question shown');

  await click(page.getByRole('radio', { name: /^Option B\./ }));
  await click(btn(page, 'Submit'));
  await see(page.getByRole('heading', { name: 'Correct' }), 'correct');
  await see(page.getByText('Where this answer comes from'), 'source block');
  await see(page.getByText('E2E Linked Note', { exact: true }), 'note title');
  await see(page.getByText('Airway before teaching'), 'key fact');
  await see(page.getByText('AI-written, checked against our notes only, not a textbook citation'), 'honest status');

  await click(page.getByRole('link', { name: 'Read this in your notes' }));
  await see(page.getByText('Check the airway and breathing before teaching.'), 'note body shown');
  await click(page.getByRole('button', { name: 'Back' }).first());
  await gone(page.getByText('Check the airway and breathing before teaching.'), 'note closed');

  // Session intact: same question, answer kept, feedback showing, saved session still active.
  await see(page.getByText('Which action is the nurse priority for the linked note?'), 'same question');
  await see(page.getByRole('radio', { name: /^Option B\. .*Selected\./ }), 'answer kept');
  await see(page.getByText('Where this answer comes from'), 'feedback kept');
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('fly8.bank.v1.session')));
  assertEq(saved.status, 'active', 'session still active');
  assertEq(Object.keys(saved.answers).length, 1, 'one answer kept');
  return { errors };
}
