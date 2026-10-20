#!/usr/bin/env node
// Merge a Gemini reply into data/presets/np*.json.
//   node scripts/gemini/apply.mjs <reply.txt> [--dry-run] [--report out.md] [--root <app dir>]
// Exit codes: 0 = at least one op applied (or would be, with --dry-run); 2 = patch read but nothing applied;
//             1 = reply file unreadable, or no JSON patch could be found in it.
import { readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPatch, validatePatch, applyPatch } from './patchCore.mjs';
import { renderReceipt } from './receipt.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const valueOptions = ['--report', '--root'];
const positional = args.filter((a, i) => !a.startsWith('--') && !valueOptions.includes(args[i - 1]));
const root = resolve(option('--root') ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
const dry = flag('--dry-run');
const reportPath = option('--report');

if (!positional[0] || flag('--help')) {
  console.error('Usage: node scripts/gemini/apply.mjs <reply.txt> [--dry-run] [--report out.md] [--root <app dir>]');
  process.exit(positional[0] ? 0 : 1);
}

let text;
try {
  text = readFileSync(positional[0], 'utf8');
} catch (e) {
  console.error(`Cannot read ${positional[0]}: ${e.message}`);
  process.exit(1);
}

const presetsDir = join(root, 'data', 'presets');
const packs = {};
const reservedIds = new Set();
for (const f of readdirSync(presetsDir).filter((n) => n.endsWith('.json')).sort()) {
  let data;
  try {
    data = JSON.parse(readFileSync(join(presetsDir, f), 'utf8'));
  } catch {
    continue;
  }
  const key = `data/presets/${f}`;
  if (/^(np|gen)/.test(f) && Array.isArray(data)) packs[key] = data;
  else if (Array.isArray(data)) data.forEach((x) => x && typeof x.noteId === 'string' && reservedIds.add(x.noteId));
  else if (data && typeof data === 'object') Object.keys(data).forEach((k) => reservedIds.add(k));
}
const opts = { reservedIds: [...reservedIds] };

const extracted = extractPatch(text);
let validation;
let exit;
if (!extracted.patch) {
  validation = { task: '', target: '', batch: null, errors: [], warnings: [], ops: [], applied: 0, rejected: 0 };
  exit = 1;
} else {
  validation = validatePatch(extracted.patch, packs, opts);
  exit = validation.applied > 0 ? 0 : 2;
  if (validation.applied > 0 && !dry) {
    const next = applyPatch(packs, extracted.patch, opts);
    const file = join(root, validation.target);
    // Same format as the existing files: 1-space indent, no trailing newline.
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(next[validation.target], null, 1));
    renameSync(tmp, file);
  }
}

const receipt = renderReceipt(validation, { dryRun: dry, extractWarnings: extracted.warnings, extractErrors: extracted.errors });
console.log(receipt);
if (reportPath) {
  try {
    writeFileSync(reportPath, receipt);
  } catch (e) {
    console.error(`Could not write report ${reportPath}: ${e.message}`);
  }
}
process.exit(exit);
