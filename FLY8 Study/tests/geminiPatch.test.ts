import { describe, expect, it } from 'vitest';
import { applyPatch, extractPatch, renderReceipt, validatePatch, type Note, type Packs } from '../src/gemini/patch';

const TARGET = 'data/presets/np1-comm.json';
const prose =
  'Community health nurses work with families and groups to prevent illness. This paragraph is written in plain words so that the body is long enough to pass the minimum length rule of the harness. ';
const base = (extra = ''): string => `## What it is\n${prose}${prose}\n\n## Must-know facts\n- **Key idea**: prevention comes first. ${extra}\n- Link to [[Other Note]] for more.\n\n## Check against your textbook\n- Confirm every fact in your textbook.`;

const mk = (id: string, title: string, over: Partial<Note> = {}): Note => ({
  id, area: 'NP1', title, body: base(), tags: ['chn'], priority: 'high', outlineRefs: ['1.1'], aiWritten: true, nurseReviewed: false, ...over,
});

const packs = (): Packs => ({
  [TARGET]: [mk('np1-a', 'Alpha Note'), mk('np1-b', 'Other Note')],
  'data/presets/gen-fund-a.json': [mk('gen-1', 'Fundamentals Thing', { area: 'GEN' })],
  'data/presets/np2-ob.json': [mk('np2-1', 'Maternal Thing', { area: 'NP2' })],
});

const patchOf = (ops: unknown[], over: Record<string, unknown> = {}) => ({ task: 'T-001', target: TARGET, batch: 1, ops, ...over });
const update = (id: string, note: Note) => ({ op: 'update', id, note });
const add = (note: Note) => ({ op: 'add', id: note.id, note });
const codes = (r: ReturnType<typeof validatePatch>, i = 0) => ({ e: r.ops[i].errors.map((x) => x.code), w: r.ops[i].warnings.map((x) => x.code) });

describe('extractPatch', () => {
  const json = JSON.stringify(patchOf([update('np1-a', mk('np1-a', 'Alpha Note', { tags: ['chn', 'new'] }))]), null, 2);

  it('reads a ```json fenced block with leading prose', () => {
    const r = extractPatch(`Sure! Here is the patch:\n\n\`\`\`json\n${json}\n\`\`\`\n\nLet me know.`);
    expect(r.errors).toEqual([]);
    expect((r.patch as { task: string }).task).toBe('T-001');
    expect(r.warnings).toEqual([]);
  });

  it('survives Google Docs export: curly quotes outside strings, nbsp, raw line breaks in strings', () => {
    const doc =
      '“Here is the result” \n```json\n{ “task”: “T-002”, “target”: “data/presets/np1-comm.json”, “batch”: 2,\n' +
      '“ops”: [ { “op”: “add”, “id”: “np1-x-demo”, “note”: { “id”: “np1-x-demo”, “title”: “He said “wash hands” today”, “body”: “line one\nline two”, },\n } ],\n}\n```\nThanks';
    const r = extractPatch(doc);
    expect(r.errors).toEqual([]);
    const p = r.patch as { task: string; ops: { note: { title: string; body: string } }[] };
    expect(p.task).toBe('T-002');
    expect(p.ops[0].note.title).toBe('He said “wash hands” today');
    expect(p.ops[0].note.body).toBe('line one\nline two');
    expect(r.warnings.some((w) => w.code === 'REPAIRED_JSON')).toBe(true);
  });

  it('keeps curly quotes that live inside a straight-quoted string', () => {
    const r = extractPatch('```json\n{"task":"T","target":"x","ops":[{"op":"add","id":"a","note":{"title":"“quoted”"}}]}\n```');
    expect((r.patch as { ops: { note: { title: string } }[] }).ops[0].note.title).toBe('“quoted”');
  });

  it('uses the first of two json blocks and warns', () => {
    const second = JSON.stringify(patchOf([], { task: 'T-999' }));
    const r = extractPatch(`\`\`\`json\n${json}\n\`\`\`\ntext\n\`\`\`json\n${second}\n\`\`\``);
    expect((r.patch as { task: string }).task).toBe('T-001');
    expect(r.blocks).toBe(2);
    expect(r.warnings.map((w) => w.code)).toContain('MULTI_BLOCK');
  });

  it('reports NO_PATCH for text without json and never throws on junk', () => {
    expect(extractPatch('nothing here').errors[0].code).toBe('NO_PATCH');
    expect(extractPatch('```json\n{ "ops": [ \n```').patch).toBeNull();
    expect(extractPatch(undefined as unknown as string).patch).toBeNull();
  });
});

describe('validatePatch: accepted changes', () => {
  it('accepts a valid update (tags grow, links resolve)', () => {
    const r = validatePatch(patchOf([update('np1-a', mk('np1-a', 'Alpha Note', { body: base('Extra fact.'), tags: ['chn', 'extra'] }))]), packs());
    expect(codes(r).e).toEqual([]);
    expect(r.ops[0].status).toBe('ok');
    expect(r.applied).toBe(1);
  });

  it('accepts a valid add and lets new notes link to each other in the same patch', () => {
    const n1 = mk('np1-x-first', 'First New', { body: base() + '\nSee [[Second New]].', outlineRefs: [] });
    const n2 = mk('np1-x-second', 'Second New', { outlineRefs: [] });
    const r = validatePatch(patchOf([add(n1), add(n2)]), packs());
    expect(r.applied).toBe(2);
    expect(r.ops[0].links).toEqual([]);
  });
});

describe('validatePatch: rejections', () => {
  it('rejects a changed id on update but restores area, outlineRefs, priority, title and tags', () => {
    const r = validatePatch(patchOf([update('np1-a', mk('np1-zzz', 'Alpha Note', { area: 'NP2', outlineRefs: ['9'], tags: [] }))]), packs());
    expect(codes(r).e).toEqual(['ID_MISMATCH']);
    const ok = patchOf([update('np1-a', mk('np1-a', 'Renamed', { area: 'NP2', outlineRefs: ['9'], tags: ['extra'], priority: 'low', nurseReviewed: true as unknown as false, body: base('changed') }))]);
    const v = validatePatch(ok, packs());
    expect(codes(v).e).toEqual([]);
    expect(codes(v).w).toContain('FIELDS_RESTORED');
    const out = applyPatch(packs(), ok)[TARGET].find((n) => n.id === 'np1-a')!;
    expect([out.area, out.outlineRefs, out.priority, out.title, out.nurseReviewed]).toEqual(['NP1', ['1.1'], 'high', 'Alpha Note', false]);
    expect(out.tags).toEqual(['chn', 'extra']);
  });

  it('an update that sends only id and body is enough', () => {
    const p = patchOf([{ op: 'update', id: 'np1-a', note: { body: base('only body') } }]);
    const v = validatePatch(p, packs());
    expect(codes(v).e).toEqual([]);
    expect(applyPatch(packs(), p)[TARGET].find((n) => n.id === 'np1-a')!.body).toContain('only body');
  });

  it('rejects flags that are not aiWritten:true / nurseReviewed:false, empty title, duplicate title, short body', () => {
    const r = validatePatch(
      patchOf([
        add(mk('np1-x-flag', 'Flagged New', { nurseReviewed: true as unknown as false })),
        add(mk('np1-x-blank', '  ')),
        add(mk('np1-x-dup', 'alpha note')),
        add(mk('np1-x-short', 'Short', { body: 'too short' })),
      ]),
      packs(),
    );
    expect(codes(r, 0).e).toContain('FLAGS_BAD');
    expect(codes(r, 1).e).toContain('TITLE_EMPTY');
    expect(codes(r, 2).e).toContain('TITLE_DUP');
    expect(codes(r, 3).e).toContain('BODY_LENGTH');
  });

  it('rejects tables, HTML, images, code fences and other markdown', () => {
    const bad = (extra: string) => update('np1-a', mk('np1-a', 'Alpha Note', { body: base() + '\n' + extra }));
    const r = validatePatch(
      patchOf([bad('| a | b |\n|---|---|\n| 1 | 2 |'), bad('<b>bold</b>'), bad('![pic](x.png)'), bad('```\ncode\n```'), bad('### small heading'), bad('* star bullet'), bad('[site](https://x.org)')]),
      packs(),
    );
    expect(codes(r, 0).e).toContain('MD_TABLE');
    expect(codes(r, 1).e).toContain('MD_HTML');
    expect(codes(r, 2).e).toContain('MD_IMAGE');
    expect(codes(r, 3).e).toContain('MD_FENCE');
    expect(codes(r, 4).e).toContain('MD_SYNTAX');
    expect(codes(r, 5).e).toContain('MD_SYNTAX');
    expect(codes(r, 6).e).toContain('MD_LINK');
    expect(r.applied).toBe(0);
  });

  it('rejects disease notes with missing or out-of-order sections', () => {
    const order = ['What it is', 'Causative agent', 'Main problem', 'Initial manifestations', 'Other manifestations', 'Laboratory and diagnostic data', 'Medical management', 'Pharmacologic care', 'Nursing diagnoses', 'Independent nursing interventions', 'Collaborative nursing interventions', 'Philippine context', 'Exam traps', 'References', 'Check against your textbook'];
    const make = (names: string[]) => names.map((h) => `## ${h}\n${prose}\n`).join('\n');
    const good = make(order);
    const swapped = make([order[0], order[2], order[1], ...order.slice(3)]);
    const missing = make(order.filter((h) => h !== 'Collaborative nursing interventions'));
    const r = validatePatch(
      patchOf([update('np1-a', mk('np1-a', 'Alpha Note', { body: good })), update('np1-b', mk('np1-b', 'Other Note', { body: swapped })), add(mk('np1-x-m', 'Missing', { body: missing }))]),
      packs(),
    );
    expect(codes(r, 0).e).toEqual([]);
    expect(codes(r, 1).e).toEqual(['DISEASE_ORDER']);
    expect(codes(r, 2).e).toEqual(['DISEASE_MISSING']);
  });

  it('checks drug-class notes and allows gen packs (update and gen-x add)', () => {
    const order = ['What it is', 'Prototype drugs', 'Mechanism of action', 'Indications', 'Side and adverse effects', 'Contraindications and cautions', 'Nursing responsibilities', 'Health teaching', 'Exam traps', 'References', 'Check against your textbook'];
    const make = (names: string[]) => names.map((h) => `## ${h}\n${prose}\n`).join('\n');
    const GEN = 'data/presets/gen-fund-a.json';
    const r = validatePatch(
      patchOf([
        update('gen-1', mk('gen-1', 'Fundamentals Thing', { area: 'GEN', body: make(order) })),
        add(mk('gen-x-loop-diuretics', 'Loop Diuretics', { area: 'GEN', outlineRefs: [], body: make(order.filter((h) => h !== 'Health teaching')) })),
        add(mk('gen-x-bad-area', 'Bad Area', { area: 'NP1', outlineRefs: [] })),
      ], { target: GEN }),
      packs(),
    );
    expect(codes(r, 0).e).toEqual([]);
    expect(codes(r, 1).e).toEqual(['DRUG_MISSING']);
    expect(codes(r, 2).e).toEqual(['AREA_BAD']);
  });
});

describe('validatePatch: cross-check', () => {
  const op = (crosscheck?: unknown) => ({ ...update('np1-a', mk('np1-a', 'Alpha Note', { tags: ['chn', 'x'] })), ...(crosscheck === undefined ? {} : { crosscheck }) });
  it('warns when the cross-check is missing, incomplete or doubtful, and never rejects for it', () => {
    const r = validatePatch(patchOf([op()]), packs());
    expect(codes(r).w).toContain('NO_CROSSCHECK');
    expect(r.ops[0].status).toBe('ok');
    expect(codes(validatePatch(patchOf([op({ sources: ['one'], verdict: 'AGREE' })]), packs())).w).toContain('CROSSCHECK_BAD');
    const doubt = validatePatch(patchOf([op({ sources: ['DOH', 'Kozier'], verdict: 'DOUBT', doubts: ['incubation days differ'] })]), packs());
    expect(codes(doubt).w).toContain('CROSSCHECK_DOUBT');
    expect(doubt.ops[0].warnings.find((w) => w.code === 'CROSSCHECK_DOUBT')?.message).toContain('incubation days differ');
    const fine = codes(validatePatch(patchOf([op({ sources: ['DOH', 'Kozier'], verdict: 'AGREE' })]), packs())).w;
    expect(fine.filter((c) => c.includes('CROSSCHECK'))).toEqual([]);
  });
});

describe('validatePatch: warnings', () => {
  it('warns (not rejects) on a broken wikilink and reports it', () => {
    const r = validatePatch(patchOf([update('np1-a', mk('np1-a', 'Alpha Note', { body: base() + '\nAlso [[Ghost Topic]] and [[other note|alias]].' }))]), packs());
    expect(r.ops[0].status).toBe('ok');
    expect(codes(r).w).toContain('LINK_UNRESOLVED');
    expect(r.ops[0].links).toEqual(['Ghost Topic']);
  });

  it('warns on dose-like values, missing references, and big shrinkage', () => {
    const big = mk('np1-a', 'Alpha Note', { body: base() + '\n' + '- filler line of text for length.\n'.repeat(40) });
    const p = packs();
    p[TARGET][0] = big;
    const r = validatePatch(patchOf([update('np1-a', mk('np1-a', 'Alpha Note', { body: base('Give 500 mg or 2.5 mL or 10 units.') }))]), p);
    expect(r.ops[0].status).toBe('ok');
    expect(codes(r).w).toEqual(expect.arrayContaining(['DOSE', 'REFS_MISSING', 'BODY_SHRANK']));
    expect(r.ops[0].warnings.find((w) => w.code === 'DOSE')?.message).toContain('500mg');
  });

  it('does not warn about references when the body says UNVERIFIED, and accepts an https reference line', () => {
    const withRefs = base() + '\n\n## References\n- Example Health Org. https://example.org/page';
    const r = validatePatch(patchOf([update('np1-a', mk('np1-a', 'Alpha Note', { body: withRefs })), update('np1-b', mk('np1-b', 'Other Note', { body: base('UNVERIFIED addition.') }))]), packs());
    expect(codes(r, 0).w).not.toContain('REFS_MISSING');
    expect(codes(r, 0).w).not.toContain('REFS_NO_URL');
    expect(codes(r, 1).w).not.toContain('REFS_MISSING');
  });
});

describe('applyPatch', () => {
  it('applies updates in place and appends adds, skipping rejected ops, without mutating input', () => {
    const before = packs();
    const snapshot = JSON.stringify(before);
    const out = applyPatch(
      before,
      patchOf([
        add(mk('np1-x-new', 'Brand New', { outlineRefs: [] })),
        update('np1-a', mk('np1-a', 'Alpha Note', { body: base('Changed.'), tags: ['chn', 'more'] })),
        update('np1-b', mk('np1-b', 'Other Note', { area: 'NP2' })),
      ]),
    );
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(out[TARGET].map((n) => n.id)).toEqual(['np1-a', 'np1-b', 'np1-x-new']);
    expect(out[TARGET][0].body).toContain('Changed.');
    expect(out[TARGET][0].tags).toEqual(['chn', 'more']);
    expect(out[TARGET][1]).toEqual(before[TARGET][1]);
    expect(out['data/presets/np2-ob.json']).toEqual(before['data/presets/np2-ob.json']);
    expect(Object.keys(out[TARGET][2])).toEqual(['id', 'area', 'title', 'body', 'tags', 'priority', 'outlineRefs', 'aiWritten', 'nurseReviewed']);
  });

  it('keeps extra fields (e.g. beginnerEye) on an updated note and returns equal packs when nothing is valid', () => {
    const p = packs();
    (p[TARGET][0] as Note).beginnerEye = 'plain version';
    const out = applyPatch(p, patchOf([update('np1-a', mk('np1-a', 'Alpha Note', { body: base('Changed.') }))]));
    expect(out[TARGET][0].beginnerEye).toBe('plain version');
    expect(applyPatch(p, patchOf([update('np1-zz', mk('np1-zz', 'Zz'))]))).toEqual(p);
  });
});

describe('renderReceipt', () => {
  it('lists merged and rejected ops with plain-English fixes', () => {
    const v = validatePatch(patchOf([update('np1-a', mk('np1-a', 'Alpha Note', { body: base('Dose 5 mg.') })), update('np1-b', mk('np1-b', 'Other Note', { body: base() + '\n<b>x</b>' }))]), packs());
    const text = renderReceipt(v, { dryRun: true });
    expect(text).toContain('DRY RUN');
    expect(text).toContain('OK update np1-a');
    expect(text).toContain('REJECTED update np1-b');
    expect(text).toContain('FIX: Remove every <tag>');
    expect(text).toContain('Claude will double-check');
    expect(text).toContain('Resend only the REJECTED items');
  });
});
