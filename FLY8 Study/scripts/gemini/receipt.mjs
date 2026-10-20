// Plain-English receipt for a Gemini patch, written to be pasted into a Google Doc / Gemini chat.
// Pure (no imports, no I/O). Types: receipt.d.mts.

const line = (s = '') => s;

/**
 * @param {{task:string,target:string,batch:number|null,errors:object[],warnings:object[],ops:object[],applied:number,rejected:number}} v
 * @param {{dryRun?:boolean, extractWarnings?:object[], extractErrors?:object[]}} [opts]
 */
export function renderReceipt(v, opts = {}) {
  const out = [];
  const dry = !!opts.dryRun;
  const extractErrors = opts.extractErrors ?? [];
  const extractWarnings = opts.extractWarnings ?? [];
  out.push(`# Merge receipt${dry ? ' (DRY RUN: nothing was written)' : ''}`);
  out.push(line());
  out.push(`- Task: ${v.task || '(none given)'}`);
  out.push(`- Batch: ${v.batch ?? '(none given)'}`);
  out.push(`- Target pack: ${v.target || '(none given)'}`);
  out.push(`- Result: ${v.applied} of ${v.ops.length} changes ${dry ? 'would be' : 'were'} merged, ${v.rejected} rejected.`);
  out.push(line());

  const patchProblems = [...extractErrors, ...v.errors];
  if (patchProblems.length) {
    out.push('## Problems with the whole reply');
    for (const p of patchProblems) {
      out.push(`- ${p.message}${p.fix ? ` FIX: ${p.fix}` : ''}`);
    }
    out.push(line());
  }

  const okOps = v.ops.filter((o) => o.status === 'ok');
  const badOps = v.ops.filter((o) => o.status !== 'ok');
  if (okOps.length) {
    out.push(`## ${dry ? 'Would merge' : 'Merged'} (${okOps.length})`);
    for (const o of okOps) {
      out.push(`- OK ${o.op} ${o.id}${o.title ? ` ("${o.title}")` : ''}`);
      for (const w of o.warnings) out.push(`  - Claude will double-check: ${w.message}`);
    }
    out.push(line());
  }
  if (badOps.length) {
    out.push(`## Rejected (${badOps.length}): please fix and resend ONLY these`);
    for (const o of badOps) {
      out.push(`- REJECTED ${o.op || '?'} ${o.id || '(no id)'}${o.title ? ` ("${o.title}")` : ''}`);
      for (const e of o.errors) out.push(`  - Problem: ${e.message}${e.fix ? ` FIX: ${e.fix}` : ''}`);
      for (const w of o.warnings) out.push(`  - Also noted: ${w.message}`);
    }
    out.push(line());
  }

  const links = [...new Set(v.ops.flatMap((o) => o.links))];
  const warnTop = [...extractWarnings, ...v.warnings];
  if (warnTop.length || links.length) {
    out.push('## Notices');
    for (const w of warnTop) out.push(`- ${w.message}${w.fix ? ` ${w.fix}` : ''}`);
    if (links.length) out.push(`- [[Wikilinks]] that do not match any note title: ${links.map((l) => `[[${l}]]`).join(', ')}. Use exact existing titles.`);
    out.push(line());
  }

  out.push('## What happens next');
  if (!v.ops.length || !v.applied) out.push('- Nothing was merged. Fix the items above and send the whole json block again (only the rejected notes are needed).');
  else if (badOps.length) out.push('- The OK items above are in. Resend only the REJECTED items, in a new json block, with the fixes applied.');
  else out.push('- Everything in this batch was accepted. Send the next batch.');
  out.push('- Reminder: every note stays aiWritten:true and nurseReviewed:false. Doses and facts are checked by a person, not by this tool.');
  return out.join('\n') + '\n';
}
