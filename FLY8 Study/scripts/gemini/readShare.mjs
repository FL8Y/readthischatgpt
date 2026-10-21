#!/usr/bin/env node
// Read a shared Gemini chat link (needs a browser because the page fills itself with JavaScript).
//   node scripts/gemini/readShare.mjs <share link> <out.txt>
// Then: node scripts/gemini/apply.mjs <out.txt> [--dry-run]
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('Usage: node scripts/gemini/readShare.mjs <share link> <out.txt>');
  process.exit(1);
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => undefined);
await page.waitForTimeout(6000);
const text = await page.evaluate(() => document.body.innerText);
writeFileSync(out, text);
console.log(`${text.length} characters saved to ${out}`);
await browser.close();
