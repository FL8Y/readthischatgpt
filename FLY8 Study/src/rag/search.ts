/**
 * Offline retrieval over the learner's own notes (BM25 on heading-sized chunks). No network, no embeddings, no cost:
 * it picks the few passages that answer a question so only those are sent to the AI, not whole notes.
 * Pure: no I/O. Never throws.
 */
import type { Topic } from '../core/types';

export interface Chunk {
  topicId: string;
  title: string;
  heading: string;
  text: string;
}
export interface Hit extends Chunk {
  score: number;
}

const STOP = new Set((
  'the a an and or of to in on for with is are was were be been it its this that these those as at by from into than then ' +
  'what which who whom how why when where do does did can could should would may might will not no yes if but about over ' +
  'your you my me i we they them their his her he she nurse patient client'
).split(' '));

const CHUNK_MAX = 900;
const K1 = 1.4;
const B = 0.7;
/** A hit must match at least this many distinct query words, so a single common word never pulls a passage in. */
const MIN_MATCHED = 1;

/** Lowercase words, light stemming (plural / -ing / -ed), no stop words. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().replace(/\[\[|\]\]/g, ' ').split(/[^a-z0-9]+/)) {
    if (raw.length < 3 && !/^\d+$/.test(raw)) continue;
    if (STOP.has(raw)) continue;
    let w = raw;
    if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
    else if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
    else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
    else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    if (STOP.has(w)) continue;
    out.push(w);
  }
  return out;
}

/** Splits a note into chunks at "## " headings; long sections are cut at paragraph breaks. */
export function chunkTopic(t: Pick<Topic, 'id' | 'title' | 'body'>): Chunk[] {
  const chunks: Chunk[] = [];
  const body = typeof t.body === 'string' ? t.body : '';
  let heading = 'Overview';
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join('\n').trim();
    buf = [];
    if (!text) return;
    if (text.length <= CHUNK_MAX) return void chunks.push({ topicId: t.id, title: t.title, heading, text });
    let cur = '';
    for (const para of text.split(/\n{1,}/)) {
      if (cur && cur.length + para.length > CHUNK_MAX) {
        chunks.push({ topicId: t.id, title: t.title, heading, text: cur.trim() });
        cur = '';
      }
      cur += `${para}\n`;
    }
    if (cur.trim()) chunks.push({ topicId: t.id, title: t.title, heading, text: cur.trim() });
  };
  for (const line of body.split('\n')) {
    const m = /^##\s+(.*\S)\s*$/.exec(line);
    if (m) {
      flush();
      heading = m[1];
    } else buf.push(line);
  }
  flush();
  return chunks;
}

/** Best passages for a question: BM25 with the note title and heading counted as extra-weight words. */
export function retrieve(topics: readonly Pick<Topic, 'id' | 'title' | 'body'>[], query: string, opts: { k?: number } = {}): Hit[] {
  try {
    const q = [...new Set(tokenize(query))];
    if (!q.length) return [];
    const chunks = topics.flatMap((t) => chunkTopic(t));
    if (!chunks.length) return [];
    const docs = chunks.map((c) => {
      const words = [...tokenize(c.text), ...tokenize(c.heading), ...tokenize(c.title), ...tokenize(c.title)];
      const tf = new Map<string, number>();
      for (const w of words) tf.set(w, (tf.get(w) ?? 0) + 1);
      return { tf, len: words.length || 1 };
    });
    const avg = docs.reduce((s, d) => s + d.len, 0) / docs.length;
    const df = new Map<string, number>();
    for (const w of q) df.set(w, docs.filter((d) => d.tf.has(w)).length);
    const hits: Hit[] = [];
    chunks.forEach((c, i) => {
      let score = 0;
      let matched = 0;
      for (const w of q) {
        const f = docs[i].tf.get(w) ?? 0;
        if (!f) continue;
        matched++;
        const n = df.get(w) ?? 0;
        const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
        score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * docs[i].len) / avg)));
      }
      if (matched >= MIN_MATCHED && score > 0) hits.push({ ...c, score });
    });
    return hits.sort((a, b) => b.score - a.score).slice(0, opts.k ?? 4);
  } catch {
    return [];
  }
}

/** Joins hits into a prompt block, labelled by note and heading, within a character budget. */
export function formatHits(hits: readonly Hit[], maxChars: number): string {
  const out: string[] = [];
  let used = 0;
  for (const h of hits) {
    const block = `[${h.title} > ${h.heading}]\n${h.text}`;
    if (used + block.length > maxChars) {
      if (!out.length) out.push(`${block.slice(0, maxChars)}…`);
      break;
    }
    out.push(block);
    used += block.length + 2;
  }
  return out.join('\n\n');
}
