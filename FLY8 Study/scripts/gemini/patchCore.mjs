// Gemini patch harness: extract, validate and apply a JSON patch to the preset note packs.
// Plain ESM (no imports, no React Native) so both `node scripts/gemini/apply.mjs` and vitest
// (via src/gemini/patch.ts) run exactly this code. Types: patchCore.d.mts. Nothing here throws.

// Owner rule: what the NURSE does (independent, needs no order) is kept apart from what needs an order
// (collaborative) and from what the DOCTOR does (medical management). PNLE answers are nursing actions.
const REQUIRED_DISEASE_SECTIONS = [
  'What it is', 'Causative agent', 'Main problem', 'Initial manifestations', 'Other manifestations',
  'Laboratory and diagnostic data', 'Medical management', 'Pharmacologic care', 'Nursing diagnoses',
  'Independent nursing interventions', 'Collaborative nursing interventions', 'Philippine context',
  'Exam traps', 'References', 'Check against your textbook',
];
// Drug-class notes (they have "## Mechanism of action").
const REQUIRED_DRUG_SECTIONS = [
  'What it is', 'Prototype drugs', 'Mechanism of action', 'Indications', 'Side and adverse effects',
  'Contraindications and cautions', 'Nursing responsibilities', 'Health teaching', 'Exam traps',
  'References', 'Check against your textbook',
];
const CROSSCHECK_VERDICTS = ['AGREE', 'FIXED', 'DOUBT'];
const BODY_MIN = 300;
const BODY_MAX = 16000;
const PRIORITIES = ['high', 'medium', 'low'];
const DOSE_RE = /\b\d+(\.\d+)?\s?(mg|mcg|g|mL|IU|units)\b/g;
const ADD_ID_RE = /^(np[1-5]|gen)-x-[a-z0-9-]+$/;
const TARGET_RE = /^data\/presets\/(np|gen-)[^/]*\.json$/;
const KNOWN_KEYS = ['id', 'area', 'title', 'body', 'tags', 'priority', 'outlineRefs', 'aiWritten', 'nurseReviewed'];

const issue = (code, message, fix) => ({ code, message, ...(fix ? { fix } : {}) });
const isStr = (x) => typeof x === 'string' && x.trim().length > 0;
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const normTitle = (s) => String(s).replace(/[\s ]+/g, ' ').trim().toLowerCase();
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------------------------------------------------------------------------------------------
// extractPatch
// ---------------------------------------------------------------------------------------------

const OPEN_QUOTES = '"“”„‟‘’';
const CURLY_CLOSERS = '”“’‘"';
const SPACE_LIKE = /[     　]/;
const INVISIBLE = /[​‌‍⁠﻿]/;

/** First non-space char at or after i (zero-width and nbsp count as space). */
function nextSignificant(text, i) {
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (c === ' ' || c === '\n' || c === '\r' || c === '\t' || SPACE_LIKE.test(c) || INVISIBLE.test(c)) continue;
    return c;
  }
  return '';
}

/**
 * Walks one object starting at text[start] === '{' and returns clean JSON text plus what was repaired.
 * Repairs: curly quotes used as string delimiters, nbsp/zero-width characters, raw line breaks inside
 * strings, trailing commas. Curly quotes INSIDE a straight-quoted string are real text and kept.
 */
function scanObject(text, start) {
  const out = [];
  let depth = 0;
  let i = start;
  let delim = null; // null | 'straight' | 'curly'
  const repairs = new Set();
  while (i < text.length) {
    const c = text[i];
    if (delim === null) {
      if (OPEN_QUOTES.includes(c)) {
        delim = c === '"' ? 'straight' : 'curly';
        if (delim === 'curly') repairs.add('curly quotes around keys or values were straightened');
        out.push('"');
      } else if (c === '{' || c === '[') {
        depth++;
        out.push(c);
      } else if (c === '}' || c === ']') {
        depth--;
        out.push(c);
        if (depth === 0) return { json: out.join(''), end: i + 1, repairs: [...repairs] };
      } else if (c === ',' && '}]'.includes(nextSignificant(text, i + 1))) {
        repairs.add('trailing comma removed');
      } else if (SPACE_LIKE.test(c)) {
        repairs.add('non-breaking spaces replaced');
        out.push(' ');
      } else if (INVISIBLE.test(c)) {
        repairs.add('invisible characters removed');
      } else {
        out.push(c);
      }
      i++;
      continue;
    }
    // inside a string
    if (c === '\\') {
      out.push(c);
      if (i + 1 < text.length) out.push(text[i + 1]);
      i += 2;
      continue;
    }
    const nx = nextSignificant(text, i + 1);
    const structuralNext = ':,}]'.includes(nx) || nx === '';
    if (delim === 'straight' && c === '"') {
      delim = null;
      out.push('"');
    } else if (delim === 'curly' && CURLY_CLOSERS.includes(c) && structuralNext) {
      delim = null;
      out.push('"');
    } else if (c === '"') {
      out.push('\\"');
    } else if (c === '\n') {
      repairs.add('line breaks inside a string were escaped');
      out.push('\\n');
    } else if (c === '\r') {
      // dropped; the \n that follows (if any) carries the break
    } else if (c === '\t') {
      out.push('\\t');
    } else if (SPACE_LIKE.test(c)) {
      repairs.add('non-breaking spaces replaced');
      out.push(' ');
    } else if (INVISIBLE.test(c)) {
      repairs.add('invisible characters removed');
    } else {
      out.push(c);
    }
    i++;
  }
  return null;
}

/** First '{' in text from which a JSON object can be read; optionally it must be patch-like. */
function firstObject(text, wantPatchLike) {
  let from = text.indexOf('{');
  while (from !== -1) {
    const scanned = scanObject(text, from);
    if (scanned) {
      try {
        const value = JSON.parse(scanned.json);
        if (isObj(value) && (!wantPatchLike || 'ops' in value || 'target' in value || 'questions' in value)) return { value, repairs: scanned.repairs };
      } catch {
        /* try the next '{' */
      }
    }
    from = text.indexOf('{', from + 1);
  }
  return null;
}

/**
 * Finds the patch in a pasted or exported reply. Uses the first ```json block that parses (a plain ```
 * fence or no fence at all also works). Never throws.
 * @returns {{patch: object|null, warnings: object[], errors: object[], blocks: number}}
 */
/** Google Docs "export as text/markdown" puts a backslash before markdown punctuation ("\\[", "\\#\\#", "\\\\n"). Undo that. */
const DOCS_ESCAPES = /\\([\\`*_{}[\]()#+\-.!>~|<&=$%@^?:;,/'])/g;
export const undoDocsEscapes = (t) => String(t ?? '').replace(DOCS_ESCAPES, '$1');

export function extractPatch(text) {
  const first = extractPatchRaw(text);
  if (first.patch) return first;
  const src = String(text ?? '');
  if (!/\\[[\]#_*]/.test(src)) return first;
  const second = extractPatchRaw(undoDocsEscapes(src));
  if (!second.patch) return first;
  second.warnings.push(issue('DOCS_ESCAPES', 'Google Docs added backslashes to the markdown; they were removed before reading the patch.', 'Fine as is. Exporting as plain text or copying from the chat avoids this.'));
  return second;
}

function extractPatchRaw(text) {
  const warnings = [];
  const errors = [];
  try {
    const src = String(text ?? '').replace(/^﻿/, '');
    const fenceRe = /```[ \t]*(?:json)?[ \t]*\r?\n?([\s\S]*?)```/gi;
    const blocks = [];
    for (let m = fenceRe.exec(src); m; m = fenceRe.exec(src)) blocks.push(m[1]);
    let found = null;
    let usedIndex = -1;
    for (let k = 0; k < blocks.length && !found; k++) {
      found = firstObject(blocks[k], true);
      if (found) usedIndex = k;
    }
    if (!found) {
      // Fallback: no usable fence (or a body contained backticks); scan the whole reply for a patch-like object.
      found = firstObject(src, true);
      if (found) warnings.push(issue('NO_FENCE', 'No usable ```json block was found; the patch was read from loose text.', 'Put the patch inside one ```json fenced block.'));
    }
    if (!found) {
      errors.push(issue('NO_PATCH', 'No JSON patch found in the reply.', 'Reply with exactly one ```json block shaped like {"task":"...","target":"data/presets/<pack>.json","batch":1,"ops":[...]}.'));
      return { patch: null, warnings, errors, blocks: blocks.length };
    }
    if (blocks.length > 1 && usedIndex >= 0) {
      warnings.push(issue('MULTI_BLOCK', `${blocks.length} json blocks were found; only block ${usedIndex + 1} was used and the rest were ignored.`, 'Send exactly one json block per reply.'));
    }
    for (const r of found.repairs) warnings.push(issue('REPAIRED_JSON', `Copy/paste damage repaired: ${r}.`, 'Export the reply as plain text, or copy straight from the code block.'));
    return { patch: found.value, warnings, errors, blocks: blocks.length };
  } catch (e) {
    errors.push(issue('NO_PATCH', `The reply could not be read: ${e && e.message ? e.message : e}`));
    return { patch: null, warnings, errors, blocks: 0 };
  }
}

// ---------------------------------------------------------------------------------------------
// validatePatch
// ---------------------------------------------------------------------------------------------

const wikilinks = (body) => {
  const out = [];
  const re = /\[\[([^\]\n]+)\]\]/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    const title = m[1].split('|')[0].split('#')[0].trim();
    if (title) out.push(title);
  }
  return out;
};

function checkMarkdown(body, errors) {
  if (/```|~~~/.test(body)) errors.push(issue('MD_FENCE', 'The body contains a code fence.', 'Remove code blocks; use plain paragraphs or bullets.'));
  if (/^\s*\|.*\|\s*$/m.test(body) || /\|\s*:?-{3,}/.test(body)) errors.push(issue('MD_TABLE', 'The body contains a table.', 'Rewrite the table as "- " bullets (one row per bullet).'));
  if (/!\[[^\]]*\]\(|!\[\[/.test(body)) errors.push(issue('MD_IMAGE', 'The body contains an image.', 'Remove the image; describe it in words.'));
  if (/<!--|<\/?[a-zA-Z][^>\n]*>/.test(body)) errors.push(issue('MD_HTML', 'The body contains HTML tags.', 'Remove every <tag>; use plain markdown only.'));
  if (/\[[^\]\n]+\]\([^)\n]+\)/.test(body)) errors.push(issue('MD_LINK', 'The body contains a [text](url) link.', 'Write the bare https:// address on its own References line instead.'));
  const bad = new Set();
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (/^#\s|^#{3,}\s/.test(line)) bad.add('only "## " headings are allowed (not # or ###)');
    else if (/^\s*>/.test(line)) bad.add('block quotes ("> ") are not allowed');
    else if (/^\s*[*+]\s/.test(line)) bad.add('use "- " for bullets, not "* " or "+ "');
    else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) bad.add('horizontal rules ("---") are not allowed');
  }
  for (const b of bad) errors.push(issue('MD_SYNTAX', `Unsupported markdown: ${b}.`, 'Allowed: "## " headings, paragraphs, "- " bullets, "1. " lists, **bold**, *italic*, [[Wikilinks]].'));
}

const headings = (body) => body.split('\n').filter((l) => /^## /.test(l)).map((l) => l.slice(3).trim());

function checkSections(body, errors, kind, marker, required) {
  if (!new RegExp(`^## ${marker}\\s*$`, 'm').test(body)) return;
  const hs = headings(body).map((h) => h.toLowerCase());
  const missing = required.filter((s) => !hs.includes(s.toLowerCase()));
  const order = required.join(' > ');
  const code = kind.toUpperCase();
  if (missing.length) {
    errors.push(issue(`${code}_MISSING`, `A ${kind} note (it has "## ${marker}") is missing section(s): ${missing.join(', ')}.`, `Add the missing "## " heading(s). Full order: ${order}.`));
    return;
  }
  const pos = required.map((s) => hs.indexOf(s.toLowerCase()));
  if (!pos.every((p, i) => i === 0 || p > pos[i - 1])) {
    errors.push(issue(`${code}_ORDER`, `The ${kind} sections are out of order.`, `Reorder the headings to: ${order}.`));
  }
}

function checkDisease(body, errors) {
  checkSections(body, errors, 'disease', 'Causative agent', REQUIRED_DISEASE_SECTIONS);
  checkSections(body, errors, 'drug', 'Mechanism of action', REQUIRED_DRUG_SECTIONS);
}

/** Gemini's second pass: at least 2 sources it checked the note against, and a verdict. Warns, never rejects. */
function checkCrosscheck(cc, warnings) {
  if (cc === undefined) {
    warnings.push(issue('NO_CROSSCHECK', 'No "crosscheck" for this note.', 'Add "crosscheck": { "sources": [2+ sources], "verdict": "AGREE|FIXED|DOUBT", "doubts": [] } to the op.'));
    return;
  }
  const ok = isObj(cc) && Array.isArray(cc.sources) && cc.sources.filter(isStr).length >= 2 && CROSSCHECK_VERDICTS.includes(cc.verdict)
    && (cc.doubts === undefined || (Array.isArray(cc.doubts) && cc.doubts.every(isStr)));
  if (!ok) {
    warnings.push(issue('CROSSCHECK_BAD', 'The "crosscheck" is incomplete.', 'It needs "sources" (2 or more), "verdict" (AGREE, FIXED or DOUBT) and optional "doubts" (list of text).'));
    return;
  }
  if (cc.verdict === 'DOUBT') {
    const d = (cc.doubts ?? []).filter(isStr);
    warnings.push(issue('CROSSCHECK_DOUBT', `Cross-check found doubts${d.length ? `: ${d.slice(0, 5).join(' | ')}` : ''}.`));
  }
}

function refsSection(body) {
  const lines = body.split('\n');
  const at = lines.findIndex((l) => /^## References\s*$/.test(l));
  if (at < 0) return null;
  const rest = [];
  for (let i = at + 1; i < lines.length && !/^## /.test(lines[i]); i++) rest.push(lines[i]);
  return rest.join('\n');
}

/** Canonical key order. Updates keep the old note's extra fields (e.g. beginnerEye). */
function buildNote(op, old) {
  const n = op.note;
  const keep = old ? { id: old.id, area: old.area, outlineRefs: old.outlineRefs ?? [] } : { id: op.id, area: n.area, outlineRefs: n.outlineRefs };
  const merged = { ...(old ?? {}), ...keep, title: n.title.trim(), body: n.body, tags: [...n.tags], priority: n.priority, aiWritten: true, nurseReviewed: false };
  const out = {};
  for (const k of KNOWN_KEYS) out[k] = merged[k];
  for (const k of Object.keys(merged)) if (!(k in out)) out[k] = merged[k];
  return out;
}

/** Validates one op against the originals. Returns { errors, warnings, links }. */
function checkOp(op, ctx) {
  const errors = [];
  const warnings = [];
  const isUpdate = op.op === 'update';
  const note = op.note;
  if (op.op !== 'update' && op.op !== 'add') {
    errors.push(issue('BAD_OP', `Unknown op "${String(op.op)}".`, 'Use "update" or "add".'));
    return { errors, warnings, links: [] };
  }
  if (!isStr(op.id)) {
    errors.push(issue('ID_MISSING', 'The op has no id.', 'Give every op an "id".'));
    return { errors, warnings, links: [] };
  }
  if (!isObj(note)) {
    errors.push(issue('NOTE_MISSING', 'The op has no "note" object.', 'Provide the FULL note object (id, area, title, body, tags, priority, outlineRefs, aiWritten, nurseReviewed).'));
    return { errors, warnings, links: [] };
  }
  const old = isUpdate ? ctx.targetById.get(op.id) : undefined;
  if (note.id !== op.id) errors.push(issue('ID_MISMATCH', `note.id ("${String(note.id)}") does not match op.id ("${op.id}").`, 'Make both ids identical.'));
  if (ctx.seen.has(op.id)) errors.push(issue('DUP_OP', `More than one op for id ${op.id} in this patch.`, 'Send one op per id per patch.'));
  ctx.seen.add(op.id);

  if (isUpdate) {
    if (!old) errors.push(issue('UPDATE_UNKNOWN_ID', `No note with id ${op.id} exists in ${ctx.target}.`, 'Check the id spelling and the target pack, or use "add" with a new np<N>-x-<slug> id.'));
  } else {
    const idArea = /^np([1-5])-/.exec(op.id);
    const isGen = /^gen-/.test(op.id);
    if (!ADD_ID_RE.test(op.id)) errors.push(issue('ADD_BAD_ID', `New id "${op.id}" is not allowed.`, 'New ids must look like np1-x-short-slug or gen-x-short-slug (np1..np5 or gen, then -x-, then lowercase letters, digits, hyphens).'));
    else if (ctx.allIds.has(op.id)) errors.push(issue('ADD_ID_EXISTS', `Id ${op.id} already exists in a pack.`, 'Pick a different id, or send an "update" if you meant to change that note.'));
    const idPrefix = idArea ? `np${idArea[1]}` : isGen ? 'gen' : '';
    if (idPrefix && ctx.targetPrefix && idPrefix !== ctx.targetPrefix) {
      warnings.push(issue('TARGET_PREFIX_MISMATCH', `Id ${op.id} starts with ${idPrefix} but the target pack is ${ctx.targetPrefix}*.`));
    }
    const wantArea = idArea ? `NP${idArea[1]}` : isGen ? 'GEN' : '';
    if (!/^(NP[1-5]|GEN)$/.test(String(note.area)) || (wantArea && note.area !== wantArea)) {
      errors.push(issue('AREA_BAD', `area "${String(note.area)}" must be NP1..NP5 or GEN and match the id (np1-x-... -> NP1, gen-x-... -> GEN).`));
    }
    if (!Array.isArray(note.outlineRefs) || !note.outlineRefs.every((x) => typeof x === 'string')) {
      errors.push(issue('OUTLINE_BAD', 'outlineRefs must be a list of strings (an empty list [] is fine for a new note).'));
    }
  }

  if (old) {
    if (note.area !== old.area) errors.push(issue('AREA_CHANGED', `area changed from ${old.area} to ${String(note.area)}.`, `Keep area exactly "${old.area}".`));
    if (!Array.isArray(note.outlineRefs) || !sameList(note.outlineRefs, old.outlineRefs ?? [])) {
      errors.push(issue('OUTLINE_CHANGED', 'outlineRefs changed.', `Keep outlineRefs exactly ${JSON.stringify(old.outlineRefs ?? [])}.`));
    }
  }

  if (!Array.isArray(note.tags) || !note.tags.every((t) => isStr(t))) {
    errors.push(issue('TAGS_BAD', 'tags must be a list of non-empty strings.'));
  } else if (old) {
    const lost = (old.tags ?? []).filter((t) => !note.tags.includes(t));
    if (lost.length) errors.push(issue('TAGS_SHRUNK', `Tags were removed: ${lost.join(', ')}.`, 'Tags may only grow. Keep every existing tag and add new ones after them.'));
  }
  if (!PRIORITIES.includes(note.priority)) errors.push(issue('PRIORITY_BAD', `priority "${String(note.priority)}" must be high, medium or low.`));
  if (note.aiWritten !== true || note.nurseReviewed !== false) {
    errors.push(issue('FLAGS_BAD', 'aiWritten must be true and nurseReviewed must be false.', 'Set "aiWritten": true and "nurseReviewed": false (only a nurse may change this, by hand).'));
  }
  const extra = Object.keys(note).filter((k) => !KNOWN_KEYS.includes(k));
  if (extra.length) warnings.push(issue('EXTRA_FIELDS', `Unknown field(s) ignored or kept as before: ${extra.join(', ')}.`));

  if (!isStr(note.title)) {
    errors.push(issue('TITLE_EMPTY', 'title is empty.', 'Give the note a non-empty title.'));
  } else {
    const key = normTitle(note.title);
    const owner = ctx.titles.get(key);
    const earlier = ctx.opTitles.get(key);
    if ((owner && owner !== op.id) || (earlier && earlier !== op.id)) {
      errors.push(issue('TITLE_DUP', `Title "${note.title}" is already used by note ${owner && owner !== op.id ? owner : earlier}.`, 'Titles must be unique (wikilinks use them). Choose a different title.'));
    }
    ctx.opTitles.set(key, op.id);
    if (old && normTitle(old.title) !== key) {
      warnings.push(issue('TITLE_CHANGED', `Title changed from "${old.title}" to "${note.title}"; [[links]] elsewhere that use the old title will break.`));
    }
  }

  let links = [];
  if (typeof note.body !== 'string') {
    errors.push(issue('BODY_NOT_STRING', 'body must be a string.'));
  } else {
    const body = note.body;
    if (body.length < BODY_MIN || body.length > BODY_MAX) {
      errors.push(issue('BODY_LENGTH', `body is ${body.length} characters; it must be ${BODY_MIN}..${BODY_MAX}.`, body.length < BODY_MIN ? 'Expand the note.' : 'Shorten the note or split it into two notes.'));
    }
    checkMarkdown(body, errors);
    checkDisease(body, errors);
    checkCrosscheck(op.crosscheck, warnings);
    if (!/UNVERIFIED/.test(body)) {
      const refs = refsSection(body);
      if (refs === null) warnings.push(issue('REFS_MISSING', 'No "## References" section (and the body does not say UNVERIFIED).'));
      else if (!/https:\/\/\S+/.test(refs)) warnings.push(issue('REFS_NO_URL', '"## References" has no https:// line (and the body does not say UNVERIFIED).'));
    }
    const oldBody = typeof old?.body === 'string' ? old.body : '';
    const oldDoses = new Set((oldBody.match(DOSE_RE) ?? []).map((s) => s.replace(/\s/g, '')));
    const doses = [...new Set((body.match(DOSE_RE) ?? []).map((s) => s.replace(/\s/g, '')))].filter((d) => !oldDoses.has(d));
    if (doses.length) warnings.push(issue('DOSE', `Dose-like value(s) for Claude to review: ${doses.slice(0, 10).join(', ')}${doses.length > 10 ? ', ...' : ''}.`));
    if (old && oldBody.length > 0 && body.length < oldBody.length * 0.6) {
      warnings.push(issue('BODY_SHRANK', `The body shrank from ${oldBody.length} to ${body.length} characters (more than 40% lost).`));
    }
    const oldLinks = new Set(wikilinks(oldBody).map(normTitle));
    links = [...new Set(wikilinks(body).filter((t) => !ctx.linkTitles.has(normTitle(t))))];
    const fresh = links.filter((t) => !oldLinks.has(normTitle(t)));
    if (fresh.length) warnings.push(issue('LINK_UNRESOLVED', `[[Wikilink]] target(s) not found: ${fresh.map((t) => `[[${t}]]`).join(', ')}.`, 'Use the exact title of an existing note, or add that note in the same patch.'));
  }
  if (!errors.length && old && JSON.stringify(old) === JSON.stringify(buildNote(op, old))) {
    warnings.push(issue('NO_CHANGE', 'This update is identical to the current note.'));
  }
  return { errors, warnings, links };
}

/**
 * Checks a patch against the packs. Never throws; every problem is returned per op.
 * @param {unknown} patch
 * @param {Record<string, object[]>} packs  file path ("data/presets/np1-comm.json") -> notes
 * @param {{reservedIds?: string[]}} [opts] ids that exist elsewhere (visuals, beginner-eye) and must not be reused
 */
export function validatePatch(patch, packs, opts = {}) {
  const result = { task: '', target: '', batch: null, errors: [], warnings: [], ops: [], applied: 0, rejected: 0 };
  try {
    if (!isObj(patch)) {
      result.errors.push(issue('BAD_SHAPE', 'The patch is not a JSON object.'));
      return result;
    }
    result.task = typeof patch.task === 'string' ? patch.task : '';
    result.batch = typeof patch.batch === 'number' ? patch.batch : null;
    if (!result.task) result.warnings.push(issue('TASK_MISSING', 'The patch has no "task".'));
    if (result.batch === null) result.warnings.push(issue('BATCH_MISSING', 'The patch has no numeric "batch".'));
    const target = typeof patch.target === 'string' ? patch.target.trim().replace(/\\/g, '/').replace(/^\.\//, '') : '';
    result.target = target;
    const ops = Array.isArray(patch.ops) ? patch.ops : [];
    if (!ops.length) result.errors.push(issue('NO_OPS', 'The patch has no "ops" list (or it is empty).', 'Send "ops": [ { "op": "update" | "add", "id": "...", "note": { ...full note } } ].'));
    const targetOk = TARGET_RE.test(target) && Array.isArray(packs?.[target]);
    if (!TARGET_RE.test(target)) {
      result.errors.push(issue('TARGET_INVALID', `target "${target}" is not allowed.`, 'target must be one of the np*.json or gen-*.json packs, written as data/presets/<file>.json (bundles, visuals and beginner-eye files cannot be patched).'));
    } else if (!targetOk) {
      result.errors.push(issue('TARGET_MISSING', `target ${target} does not exist.`, `Pick an existing pack. Available: ${Object.keys(packs ?? {}).filter((k) => TARGET_RE.test(k)).join(', ')}.`));
    }
    const targetById = new Map();
    const titles = new Map();
    const allIds = new Set(opts.reservedIds ?? []);
    for (const [file, notes] of Object.entries(packs ?? {})) {
      for (const n of Array.isArray(notes) ? notes : []) {
        if (!n || typeof n.id !== 'string') continue;
        allIds.add(n.id);
        titles.set(normTitle(n.title ?? ''), n.id);
        if (file === target) targetById.set(n.id, n);
      }
    }
    // Titles of notes added or retitled in this same patch also resolve wikilinks.
    const resolvable = new Map(titles);
    for (const op of ops) {
      if (isObj(op) && isObj(op.note) && isStr(op.note.title) && isStr(op.id) && !resolvable.has(normTitle(op.note.title))) resolvable.set(normTitle(op.note.title), op.id);
    }
    // `titles` (existing notes only) drives duplicate-title checks; `linkTitles` also includes this patch's titles.
    const ctx = {
      target, targetById, allIds, titles, linkTitles: resolvable, seen: new Set(), opTitles: new Map(),
      targetPrefix: (/\/(np[1-5]|gen)-/.exec(target) ?? [])[1] ?? '',
    };
    ops.forEach((raw, index) => {
      const op = isObj(raw) ? raw : {};
      const entry = { index, op: String(op.op ?? ''), id: String(op.id ?? ''), title: isObj(op.note) ? String(op.note.title ?? '') : '', status: 'rejected', errors: [], warnings: [], links: [] };
      if (!targetOk) {
        entry.errors.push(issue('TARGET_INVALID', 'Skipped because the patch target is not valid.'));
      } else {
        const r = checkOp(op, ctx);
        entry.errors = r.errors;
        entry.warnings = r.warnings;
        entry.links = r.links;
      }
      entry.status = entry.errors.length ? 'rejected' : 'ok';
      result.ops.push(entry);
    });
    result.applied = result.ops.filter((o) => o.status === 'ok').length;
    result.rejected = result.ops.length - result.applied;
  } catch (e) {
    result.errors.push(issue('INTERNAL', `Validation failed unexpectedly: ${e && e.message ? e.message : e}`));
    result.ops.forEach((o) => { o.status = 'rejected'; });
    result.applied = 0;
    result.rejected = result.ops.length;
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// applyPatch
// ---------------------------------------------------------------------------------------------

/**
 * Returns NEW packs with only the valid ops applied (updates in place, adds appended to the target in
 * patch order). The input is never mutated. Re-validates internally, so it is safe to call directly.
 */
export function applyPatch(packs, patch, opts = {}) {
  const copy = {};
  for (const [k, v] of Object.entries(packs ?? {})) copy[k] = Array.isArray(v) ? v.map((n) => (isObj(n) ? { ...n } : n)) : v;
  try {
    const v = validatePatch(patch, packs, opts);
    if (!v.applied) return copy;
    const list = copy[v.target];
    patch.ops.forEach((raw, i) => {
      if (v.ops[i]?.status !== 'ok') return;
      if (raw.op === 'update') {
        const at = list.findIndex((n) => n.id === raw.id);
        if (at >= 0) list[at] = buildNote(raw, list[at]);
      } else {
        list.push(buildNote(raw, undefined));
      }
    });
  } catch {
    /* unreachable in practice: validatePatch guards the shape */
  }
  return copy;
}

export const REQUIRED_SECTIONS = REQUIRED_DISEASE_SECTIONS;
export const REQUIRED_DRUG = REQUIRED_DRUG_SECTIONS;
