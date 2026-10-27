// Converts the Original Case Study Pack (kit schema) into BankItem v2 files: data/bank/cases-pack/np1..np5.json.
// Usage (from "FLY8 Study"): node scripts/bank/importCasePack.mjs "<path to Original Case Study Pack>"
// Source folder can also come from env CASEPACK_DIR. Only cases/np*.json are read (no docx, no review logs).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = process.argv[2] || process.env.CASEPACK_DIR;
if (!src || !existsSync(join(src, 'cases'))) {
  console.error('Pass the Original Case Study Pack folder (the one with cases/np1.json) as argument 1.');
  process.exit(1);
}
const outDir = join(root, 'data', 'bank', 'cases-pack');
mkdirSync(outDir, { recursive: true });

// ---- preset note index (for noteId) ----
const presetDir = join(root, 'data', 'presets');
const notes = [];
for (const f of readdirSync(presetDir).sort()) {
  if (!f.endsWith('.json') || f === 'bundles.json' || f === 'visuals.json') continue;
  const arr = JSON.parse(readFileSync(join(presetDir, f), 'utf8'));
  if (Array.isArray(arr)) for (const n of arr) if (n && n.id) notes.push(n);
}
const bundles = JSON.parse(readFileSync(join(presetDir, 'bundles.json'), 'utf8')).bundles;
const noteById = new Map(notes.map((n) => [n.id, n]));

const STOP = new Set(['and', 'the', 'of', 'in', 'to', 'for', 'a', 'on', 'with', 'or', 'part', 'final', 'others', 'extra', 'nursing', 'disorders', 'management', 'care', 'basics']);
const tok = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length > 1 && !STOP.has(w));
const stem1 = (w) => w.replace(/(ing|es|s)$/, '');
const noteTokens = notes.map((n) => ({
  n,
  title: new Set(tok(`${n.title} ${n.id}`).map(stem1)),
  extra: new Set(tok(`${[].concat(n.tags ?? []).join(' ')} ${[].concat(n.outlineRefs ?? []).join(' ')}`).map(stem1)),
}));

// Pack topic ids that never match by words but have an obvious home (hand-checked against note titles).
const HINTS = {
  'community-health-nursing/elements-of-primary-health-care/treatment-of-communicable-and-noncommunicable-diseases-and-emergency-services': 'np1-cd-ncd-emergency',
  'community-health-nursing/elements-of-primary-health-care/maternal-and-child-health': 'np1-mch-program',
  'community-health-nursing/chn-phc/health-promotion': 'np1-health-promotion',
  'ob-nursing/others/einc': 'np1-einc-amtsl',
};

// Hand-checked fixes by topic name where the word match picked a poor note.
const TOPIC_HINTS = {
  'Stages of labor': 'np2-ob-first-stage',
  'Postpartum changes': 'np2-ob-puerperium-rubin',
  'Toddler growth and development': 'np2-pd-toddler-dev',
  'Respiratory distress in a child (asthma)': 'np2-pd-asthma',
  'Dehydration in a child': 'np3-er-fvd',
  'Anaphylaxis': 'np3-cr-shock-distributive',
  'Bleeding precautions': 'np3-ho-hemophilia',
  'Cerebrovascular accident': 'np4-ns-stroke-nursing',
  "Patient's autonomy": 'gen-pl-biomedical-ethics-principles',
  'IV therapy safety': 'gen-fb-iv-complications',
  'Safe water': 'np1-environmental-sanitation',
  'Solid waste management': 'np1-waste-food-laws',
  'Disease surveillance and reporting': 'np1-epidemiology-fhsis',
  'Surveillance': 'np1-epidemiology-fhsis',
  'Epidemiologic measures': 'np1-x-epi-concepts',
  'Epidemiology': 'np1-epidemiology-fhsis',
  'Dengue warning signs': 'np1-cd-dengue',
  'Dengue home care': 'np1-cd-dengue',
  'Disaster response': 'np5-disaster-continuum',
  'Vulnerable groups in disaster': 'np5-disaster-basic-concepts',
  'Disaster triage and priorities': 'np5-nato-triage',
  'Disaster management phases': 'np5-disaster-continuum',
  'Psychological first aid': 'np5-disaster-basic-concepts',
  'Thyroid disorders': 'np4-ge-hyperthyroidism-graves',
};

function matchNote(area, topic, topicId) {
  if (TOPIC_HINTS[topic] && noteById.has(TOPIC_HINTS[topic])) return { id: TOPIC_HINTS[topic], score: 99, how: 'hint' };
  if (HINTS[topicId] && noteById.has(HINTS[topicId])) return { id: HINTS[topicId], score: 99, how: 'hint' };
  const tTopic = new Set(tok(topic).map(stem1));
  const tPath = new Set(tok(topicId.split('/').slice(-2).join(' ')).map(stem1));
  let best = null;
  for (const { n, title, extra } of noteTokens) {
    let score = 0;
    for (const w of tTopic) score += (title.has(w) ? 3 : 0) + (extra.has(w) ? 1 : 0);
    for (const w of tPath) if (!tTopic.has(w)) score += (title.has(w) ? 2 : 0) + (extra.has(w) ? 0.5 : 0);
    if (score > 0) score += n.area === area ? 1 : n.area === 'GEN' ? 0.5 : 0;
    if (!best || score > best.score) best = { id: n.id, score, how: 'words' };
  }
  if (best && best.score >= 4) return best;
  // fallback: first note of the bundle whose name best matches, preferring the item's area
  let fb = null;
  for (const b of bundles) {
    const bt = new Set(tok(`${b.name} ${b.blurb}`).map(stem1));
    let s = 0;
    for (const w of [...tTopic, ...tPath]) if (bt.has(w)) s++;
    if (b.area === area) s += 0.5;
    if (!fb || s > fb.s) fb = { s, b };
  }
  const first = fb && fb.b.notes.find((id) => noteById.has(id));
  if (first) return { id: first, score: best ? best.score : 0, how: 'bundle-fallback' };
  return { id: undefined, score: 0, how: 'none' };
}

function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return () => { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x6d2b79f5) >>> 0; return (h >>> 0) / 4294967296; };
}
const DIFF = { easy: 2, moderate: 3, difficult: 4 };
const BLOOM = { remembering: 'recall', understanding: 'recall', applying: 'apply', analyzing: 'judgment', evaluating: 'judgment', creating: 'judgment' };
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const firstSentence = (s) => (String(s).match(/^.*?[.!?](\s|$)/)?.[0] ?? String(s)).trim();

function convertItem(k, cs, seq, mapStats) {
  const m = k.meta ?? {};
  const area = String(m.nursing_practice);
  const nm = matchNote(area, m.topic, m.topic_id);
  mapStats.push({ id: k.id, topicId: m.topic_id, topic: m.topic, ...nm });
  const base = {
    id: `cp-${k.id.replace(/^cs-/, '')}`,
    v: 2,
    type: undefined,
    area,
    topic: String(m.topic),
    topicId: String(m.topic_id),
    ...(nm.id ? { noteId: nm.id } : {}),
    clusterId: `cp-${cs.id.replace(/^cs-/, '')}`,
    clusterSeq: seq,
    vignette: String(cs.situation),
    stem: String(k.stem),
    options: [],
    answer: [],
    rationale: String(k.rationale),
    ...(k.rationale_simplified ? { rationaleSimple: String(k.rationale_simplified) } : {}),
    optionRationales: [],
    strategy: String(m.competency || m.tos_content_area || 'unspecified'),
    difficulty: DIFF[m.difficulty] ?? 3,
    ...(BLOOM[m.cognitive_domain] ? { bloom: BLOOM[m.cognitive_domain] } : {}),
    ...(k.image_suggestion?.description
      ? { imageSuggestion: { description: String(k.image_suggestion.description), placement: String(k.image_suggestion.placement ?? 'stem'), searchTerms: (k.image_suggestion.search_terms ?? []).map(String) } }
      : {}),
    source: 'bank',
    review: 'unreviewed',
    aiWritten: true,
    nurseReviewed: false,
    flags: ['check-textbook'],
  };
  switch (k.type) {
    case 'mcq': {
      const ans = LETTERS.indexOf(String(k.answer));
      const opts = k.options;
      return { ...base, type: 'single', options: opts.map((o) => String(o.text)), answer: [ans],
        optionRationales: opts.map((o, i) => (i === ans ? `Best answer. ${firstSentence(k.rationale)}` : String(o.why_not || 'Not the best choice for this case.'))) };
    }
    case 'sata': {
      // Some pack items list every correct option first ([0,1,2,..]); shuffle those deterministically so position gives nothing away.
      let opts = k.options.map(String);
      let answers = [...k.answers].sort((a, b) => a - b);
      if (answers.every((a, i) => a === i)) {
        const rnd = rng(k.id);
        const order = opts.map((_, i) => i);
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(rnd() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        const correct = new Set(answers);
        opts = order.map((o) => opts[o]);
        answers = order.flatMap((o, pos) => (correct.has(o) ? [pos] : []));
      }
      return { ...base, type: 'sata', options: opts, answer: answers, optionRationales: opts.map(() => '') };
    }
    case 'matrix':
      return { ...base, type: 'matrix', rows: k.rows.map((r) => String(r.text)), columns: k.columns.map(String), rowAnswer: k.rows.map((r) => Number(r.correct_column)) };
    case 'cloze':
      return { ...base, type: 'cloze', stem: `${base.stem}\n\n${k.text}`.trim(), blanks: k.blanks.map((b) => ({ choices: b.choices.map(String), answer: Number(b.correct_index) })) };
    case 'highlight': {
      const segs = k.segments.filter((s) => s.selectable);
      return { ...base, type: 'highlight', options: segs.map((s) => String(s.text)), answer: segs.flatMap((s, i) => (s.correct ? [i] : [])) };
    }
    default:
      return null;
  }
}

const total = { cases: 0, items: 0, skipped: [] };
const byType = {};
const lowConf = [];
for (let np = 1; np <= 5; np++) {
  const cases = JSON.parse(readFileSync(join(src, 'cases', `np${np}.json`), 'utf8'));
  const out = [];
  const stats = [];
  for (const cs of cases) {
    total.cases++;
    cs.items.forEach((k, i) => {
      const it = convertItem(k, cs, i + 1, stats);
      if (!it) { total.skipped.push(k.id); return; }
      // drop undefined keys and the non-schema nurseReviewed flag (kept in flags instead)
      delete it.nurseReviewed;
      it.flags = ['check-textbook', 'nurse-unreviewed'];
      out.push(JSON.parse(JSON.stringify(it)));
      byType[it.type] = (byType[it.type] || 0) + 1;
    });
  }
  total.items += out.length;
  lowConf.push(...stats.filter((s) => s.how !== 'hint' && s.score < 6));
  writeFileSync(join(outDir, `np${np}.json`), JSON.stringify(out, null, 1) + '\n');
  console.log(`np${np}.json: ${cases.length} cases, ${out.length} items`);
}
console.log(`total: ${total.cases} cases, ${total.items} items`, byType, 'skipped:', total.skipped);
const seen = new Set();
for (const s of lowConf) {
  const k = `${s.topicId}->${s.id.slice(0, 0)}${s.id}`;
  if (seen.has(s.topicId)) continue;
  seen.add(s.topicId);
  console.log(`weak/fallback note match [${s.how} ${s.score}] ${s.topicId} (${s.topic}) -> ${s.id ?? 'NONE'}`);
}
