/**
 * Converts data/pnle/gold.json (PnleItem[]) to data/bank/gold.v2.json (BankItem[]).
 * Run from "FLY8 Study":  node --experimental-strip-types scripts/bank/migrateGold.ts
 * (Node 22.18+ strips types by default.)
 */
// No @types/node in this project; these built-ins are untyped on purpose.
// @ts-ignore
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
// @ts-ignore
import { dirname, resolve } from 'node:path';
// @ts-ignore
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (rel: string): Promise<any> => import(pathToFileURL(resolve(root, rel)).href);

const { fromGold } = await load('src/bank/adapters.ts');
const gold = JSON.parse(readFileSync(resolve(root, 'data/pnle/gold.json'), 'utf8'));
const items = gold.map(fromGold);
const outPath = resolve(root, 'data/bank/gold.v2.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(items, null, 2) + '\n');
console.log(`wrote ${items.length} items to ${outPath}`);
console.log('run "npx vitest run tests/bankData.test.ts" to validate the output.');
