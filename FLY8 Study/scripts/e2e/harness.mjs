// Shared e2e helpers: assertions, a fresh page per spec with error capture, and small UI actions.
// Locators use the accessibility roles/labels the app sets (react-native-web turns them into ARIA).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const walk = (d, depth = 0) => {
    if (depth > 5 || !existsSync(d)) return null;
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (/^(chrome|headless_shell|chromium)$/.test(name) && statSync(p).isFile()) return p;
      if (statSync(p).isDirectory()) {
        const hit = walk(p, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  };
  for (const base of [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', join(process.env.HOME || '', '.cache/ms-playwright')]) {
    if (base) {
      const hit = walk(base);
      if (hit) return hit;
    }
  }
  return null;
}

export function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}
export function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`Assertion failed: ${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

const T = 8000;
export const role = (page, r, name, opts = {}) => page.getByRole(r, { name, ...opts });
export const btn = (page, name, opts) => role(page, 'button', name, { exact: true, ...opts });
export const tab = (page, name) => role(page, 'tab', name, { exact: true });
export async function click(loc) {
  await loc.first().waitFor({ state: 'visible', timeout: T });
  await loc.first().click({ timeout: T });
}
export async function see(loc, what) {
  try {
    await loc.first().waitFor({ state: 'visible', timeout: T });
  } catch {
    throw new Error(`Expected to see: ${what}`);
  }
}
export async function gone(loc, what) {
  try {
    await loc.first().waitFor({ state: 'hidden', timeout: T });
  } catch {
    throw new Error(`Expected to be gone: ${what}`);
  }
}
/** Press and hold (touch long-press equivalent on web). */
export async function longPress(page, loc, ms = 800) {
  const el = loc.first();
  await el.waitFor({ state: 'visible', timeout: T });
  const box = await el.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** First launch to Home: skip AI setup if it shows. */
export async function skipSetup(page) {
  const skip = btn(page, 'Skip for now');
  await skip.waitFor({ state: 'visible', timeout: 15000 });
  await skip.click();
  await see(tab(page, 'Home'), 'tab bar after setup');
}

/**
 * Open the app in a fresh page with error capture.
 * seed = { localStorage key: value } is written once before the app loads (a reload keeps the real state).
 * setup=false leaves the first-launch screen showing (for reloads, use reopen()).
 */
export async function openApp(ctx, base, { seed, setup = true } = {}) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 300)}`);
  });
  if (seed) {
    await page.addInitScript((s) => {
      try {
        if (!localStorage.getItem('__e2e_seeded')) {
          for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
          localStorage.setItem('__e2e_seeded', '1');
        }
      } catch { /* storage blocked */ }
    }, seed);
  }
  await page.goto(base);
  if (setup) await skipSetup(page);
  return { page, errors };
}

export async function goTab(page, name) {
  await click(tab(page, name));
}

/** Open Practice, start Quick N (default 10). */
export async function startQuick(page, n = 10) {
  await goTab(page, 'Practice');
  if (n !== 10) await click(role(page, 'radio', String(n), { exact: true }));
  await click(btn(page, `Quick ${n}`));
  // Only option-row items show the long-press tip; every item type shows the progress label.
  await see(page.getByText(`Question 1 of ${n}`, { exact: true }), 'question player');
}

/** Select the first option and submit; waits for the rationale card. */
export async function answerFirst(page) {
  const plain = page.getByRole('radio', { name: /^Option A\./ }).or(page.getByRole('checkbox', { name: /^Option A\./ }));
  const rowRadio = page.getByRole('radio', { name: /^Row 1, / });
  const blank = page.getByRole('button', { name: /^Blank 1 of \d+\./ });
  const segment = page.getByRole('checkbox', { name: /^Segment 1\./ });
  // Case-set item types (matrix, cloze, highlight) can appear in any mixed session: answer them generically.
  await plain.or(rowRadio).or(blank).or(segment).first().waitFor({ state: 'visible', timeout: T });
  if (await plain.count()) {
    await click(plain);
    await click(btn(page, 'Submit'));
  } else if (await rowRadio.count()) {
    for (let r = 1; (await page.getByRole('radio', { name: new RegExp(`^Row ${r}, `) }).count()) > 0; r++) {
      await click(page.getByRole('radio', { name: new RegExp(`^Row ${r}, `) }).first());
    }
    await click(btn(page, 'Submit'));
  } else if (await blank.count()) {
    const total = Number.parseInt((await blank.first().getAttribute('aria-label')).match(/of (\d+)/)[1], 10);
    for (let b = 1; b <= total; b++) {
      await click(page.getByRole('button', { name: new RegExp(`^Blank ${b} of ${total}\\.`) }));
      await click(page.getByRole('radio', { name: /^Choice / }).first());
    }
    await click(btn(page, 'Submit'));
  } else {
    await click(segment);
    await click(btn(page, 'Done'));
  }
  await see(page.getByText(/AI-written|Not yet checked|Checked by/), 'rationale card badge');
}
