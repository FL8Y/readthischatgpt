// Runner for "check outbox" on question batches (NOT part of the normal test run: vitest.config excludes *.cli.test.ts).
//   QREPLY=<reply.txt> [QOUT=data/bank/gemini/<name>.json] [QREPORT=<report.md>] [QDRY=1] npx vitest run scripts/gemini/applyQuestions.cli.test.ts --config vitest.cli.config.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { it } from 'vitest';
import { checkQuestionReply } from '../../src/gemini/questionPatch';
import { BANK } from '../../src/bank/loader';
import { PACK_NOTE_IDS } from './noteIds';

it('apply a Gemini question reply', () => {
  const reply = process.env.QREPLY;
  if (!reply) return;
  const r = checkQuestionReply(readFileSync(reply, 'utf8'), { existing: BANK.items, noteIds: PACK_NOTE_IDS() });
  const lines = [`# Question merge receipt${process.env.QDRY ? ' (DRY RUN)' : ''}`, '', `- Task: ${r.task || '(none)'}  Batch: ${r.batch ?? '(none)'}`, `- ${r.accepted.length} of ${r.results.length} questions accepted.`, ''];
  r.errors.forEach((e) => lines.push(`- PROBLEM: ${e.message}`));
  r.readNotes.forEach((m) => lines.push(`- Note: ${m}`));
  for (const x of r.results) {
    lines.push(`- ${x.status === 'ok' ? 'OK' : 'REJECTED'} ${x.id}`);
    x.errors.forEach((e) => lines.push(`  - Problem: ${e.message}`));
    x.warnings.forEach((w) => lines.push(`  - Claude will double-check: ${w.message}`));
  }
  const out = process.env.QOUT;
  if (out && r.accepted.length && !process.env.QDRY) {
    const old = existsSync(out) ? (JSON.parse(readFileSync(out, 'utf8')) as unknown[]) : [];
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify([...old, ...r.accepted], null, 2) + '\n');
  }
  const text = lines.join('\n') + '\n';
  if (process.env.QREPORT) writeFileSync(process.env.QREPORT, text);
  console.log(text);
});
