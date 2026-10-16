// Web preview screenshots (light + dark) at a phone viewport. Run from "FLY8 Study/":
//   node scripts/screenshots.mjs            -> PNGs in $SHOT_DIR (default /tmp/fly8-shots)
//   SKIP_EXPORT=1 EXPORT_DIR=/path node scripts/screenshots.mjs   -> reuse an existing web export
// Needs `playwright-core` (devDependency) and a Chromium under /opt/pw-browsers (or CHROMIUM_PATH). Never runs `playwright install`.
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = process.env.SHOT_DIR || '/tmp/fly8-shots';
const exportDir = process.env.EXPORT_DIR || '/tmp/fly8-web-export';
mkdirSync(outDir, { recursive: true });

if (!process.env.SKIP_EXPORT) {
  execSync(`npx expo export --platform web --output-dir "${exportDir}"`, { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '1' } });
}

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = '/opt/pw-browsers';
  const walk = (d, depth = 0) => {
    if (depth > 4 || !existsSync(d)) return null;
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
  const exe = walk(base);
  if (!exe) throw new Error('No Chromium found under /opt/pw-browsers. Set CHROMIUM_PATH.');
  return exe;
}

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  let file = join(exportDir, path === '/' ? 'index.html' : path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(exportDir, 'index.html');
  res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

// ---- seed data ----
const demo = JSON.parse(readFileSync(join(root, 'design/demoState.json'), 'utf8'));
const DAY = 86400000;
const now = Date.now();
const seed = (over = {}) => {
  const app = structuredClone(demo.app);
  app.events = app.events.map(({ daysAgo, ...e }) => ({ ...e, at: Math.round(now - daysAgo * DAY) }));
  const merged = { ...app, ...over, settings: { ...app.settings, ...(over.settings || {}) } };
  const srs = structuredClone(demo.srs);
  srs.cards = srs.cards.map((c) => ({ ...c, createdAt: now - 6 * DAY }));
  return { app: JSON.stringify(merged), srs: JSON.stringify(srs) };
};

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const log = [];

async function shot(scheme, name, over, steps) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
  const s = seed(over?.state);
  await ctx.addInitScript(({ app, srs }) => {
    localStorage.setItem('nursing-study-app/state/v1', app);
    localStorage.setItem('nursing-study-app/srs/v1', srs);
  }, s);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log.push(`[${scheme}/${name}] pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && log.push(`[${scheme}/${name}] console: ${m.text().slice(0, 160)}`));
  await page.goto(base + (over?.hash || ''));
  await page.waitForTimeout(1200);
  if (steps) await steps(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(outDir, `${scheme}-${name}.png`) });
  await ctx.close();
}

const tab = (page, label) => page.getByRole('tab', { name: label }).click();
const btn = (page, name) => page.getByRole('button', { name }).first().click();

for (const scheme of ['light', 'dark']) {
  await shot(scheme, '01-onboarding', { state: { settings: { aiChosen: false } } });
  await shot(scheme, '02-home');
  await shot(scheme, '03-study-before-diagnostic', { state: { diagnosticsDone: [] } }, (p) => tab(p, 'Study'));
  await shot(scheme, '04-study-after-diagnostic', {}, (p) => tab(p, 'Study'));
  await shot(scheme, '05-quiz-choice-unanswered', { hash: '#demo=choice' });
  await shot(scheme, '05b-quiz-choice-selected', { hash: '#demo=choice' }, (p) => btn(p, /Clamp the chest tube/));
  await shot(scheme, '06-quiz-choice-correct', { hash: '#demo=choice' }, async (p) => {
    await btn(p, /Check the system for an air leak/);
    await btn(p, /^Check$/);
  });
  await shot(scheme, '07-quiz-choice-wrong', { hash: '#demo=choice' }, async (p) => {
    await btn(p, /Clamp the chest tube/);
    await btn(p, /^Check$/);
    await p.waitForTimeout(400);
    await btn(p, /Show: Why/);
  });
  await shot(scheme, '08-quiz-typing', { hash: '#demo=typing' }, (p) => p.getByLabel('Your answer').fill('potassium'));
  await shot(scheme, '09-quiz-matching', { hash: '#demo=matching' }, async (p) => {
    await btn(p, /Scurvy/);
  });
  await shot(scheme, '10-quiz-ordering', { hash: '#demo=ordering' }, async (p) => {
    await btn(p, /Place: Assessment/);
    await btn(p, /Place: Diagnosis/);
  });
  await shot(scheme, '11-more', {}, (p) => tab(p, 'More'));
  await shot(scheme, '12-library-legacy', {}, async (p) => {
    await tab(p, 'More');
    await btn(p, /^Library/);
  });
  await shot(scheme, '13-learn-legacy', {}, (p) => tab(p, 'Learn'));
}

await browser.close();
server.close();
console.log(`Screenshots written to ${outDir}`);
if (log.length) console.log('Browser errors seen:\n' + [...new Set(log)].join('\n'));
