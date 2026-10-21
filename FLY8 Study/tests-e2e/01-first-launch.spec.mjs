// Flow 1: first launch -> skip AI setup (no key needed) -> Home shows the Today card.
import { openApp, see, tab, role } from '../scripts/e2e/harness.mjs';

export default async function ({ ctx, base }) {
  const { page, errors } = await openApp(ctx, base);
  await see(role(page, 'heading', 'Today'), 'Today card header');
  await see(page.getByRole('button', { name: /Start quick practice|Continue/ }), 'Today card button');
  await see(page.getByRole('link', { name: 'Open my stats' }), 'stats link');
  for (const t of ['Home', 'Practice', 'Learn', 'Stats', 'More']) await see(tab(page, t), `tab ${t}`);
  return { errors };
}
