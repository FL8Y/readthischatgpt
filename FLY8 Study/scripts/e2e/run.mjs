// Headless-browser e2e runner. Run from "FLY8 Study/": npm run e2e
//   SKIP_EXPORT=1 E2E_EXPORT_DIR=/path npm run e2e   reuse an existing web export
//   E2E_ONLY=03 npm run e2e                          run specs whose filename contains "03"
//   E2E_REQUIRE_BROWSER=1                            fail (instead of skipping) when no Chromium is found
// Exports the web build once, serves it on localhost, runs tests-e2e/*.spec.mjs (each gets a fresh browser
// context), blocks all non-local network, and fails on any page error, console.error or blocked request.
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { findChromium } from './harness.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const specDir = join(root, 'tests-e2e');
const shotDir = join(root, '.expo', 'e2e-failures'); // .expo/ is gitignored
const exportDir = process.env.E2E_EXPORT_DIR || join(tmpdir(), `fly8-e2e-export-${process.pid}`);
const ownExport = !process.env.E2E_EXPORT_DIR;

const exe = findChromium();
if (!exe) {
  const msg = 'e2e: no Chromium found (looked in $CHROMIUM_PATH, $PLAYWRIGHT_BROWSERS_PATH, /opt/pw-browsers, ~/.cache/ms-playwright). Run `npx playwright-core install chromium` or set CHROMIUM_PATH.';
  if (process.env.E2E_REQUIRE_BROWSER) {
    console.error(msg);
    process.exit(1);
  }
  console.log(`${msg}\ne2e SKIPPED (set E2E_REQUIRE_BROWSER=1 to make this a failure).`);
  process.exit(0);
}

if (!process.env.SKIP_EXPORT) {
  console.log('e2e: exporting web build (once)...');
  execSync(`npx expo export --platform web --output-dir "${exportDir}"`, { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '1' } });
}
if (!existsSync(join(exportDir, 'index.html'))) {
  console.error(`e2e: no index.html in ${exportDir}`);
  process.exit(1);
}

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon', '.map': 'application/json' };
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  let file = join(exportDir, path === '/' ? 'index.html' : path);
  if (!file.startsWith(exportDir) || !existsSync(file) || statSync(file).isDirectory()) file = join(exportDir, 'index.html');
  res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const only = process.env.E2E_ONLY;
const specs = readdirSync(specDir).filter((f) => f.endsWith('.spec.mjs') && (!only || f.includes(only))).sort();
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
rmSync(shotDir, { recursive: true, force: true });

const results = [];
for (const file of specs) {
  const started = Date.now();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const blocked = [];
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    blocked.push(u);
    return route.abort();
  });
  const opened = [];
  const origNew = ctx.newPage.bind(ctx);
  ctx.newPage = async () => {
    const p = await origNew();
    opened.push(p);
    return p;
  };
  let err = null;
  try {
    const mod = await import(pathToFileURL(join(specDir, file)).href);
    const out = await mod.default({ ctx, base });
    const problems = [...(out?.errors ?? [])];
    if (blocked.length) problems.push(`blocked network request(s): ${blocked.slice(0, 3).join(', ')}`);
    if (problems.length) throw new Error(`page problems:\n  ${problems.join('\n  ')}`);
  } catch (e) {
    err = e;
    mkdirSync(shotDir, { recursive: true });
    for (const [i, p] of opened.entries()) {
      try {
        await p.screenshot({ path: join(shotDir, `${file.replace('.spec.mjs', '')}-${i}.png`) });
      } catch { /* page closed */ }
    }
  }
  await ctx.close();
  results.push({ file, ok: !err });
  console.log(`${err ? 'FAIL' : 'ok  '} ${file} (${((Date.now() - started) / 1000).toFixed(1)}s)${err ? `\n     ${String(err.message || err).split('\n').join('\n     ')}` : ''}`);
}

await browser.close();
server.close();
if (ownExport) rmSync(exportDir, { recursive: true, force: true });
const failed = results.filter((r) => !r.ok);
console.log(`\ne2e: ${results.length - failed.length}/${results.length} specs passed${failed.length ? `; failure screenshots in ${shotDir}` : ''}`);
process.exit(failed.length || !results.length ? 1 : 0);
