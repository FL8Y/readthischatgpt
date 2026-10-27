/**
 * App-aware context for the question-maker prompt: trimmed note excerpts and a compact digest of the questions
 * already in the bank. Pure: no I/O. Never carries options or answers, and never includes exam material.
 */
import type { BankItem } from '../bank/schema';

export const wordsOf = (s: string): string[] => s.split(/\s+/).filter(Boolean);
export const countWords = (s: string): number => wordsOf(s).length;
const clipWords = (s: string, n: number): string => {
  const w = wordsOf(s);
  return w.length > n ? `${w.slice(0, n).join(' ')} ...` : s.trim();
};

const DROP = /check against your textbook|related topics|references?\b|sources?\b/i;
const FIRST = /key facts|must[- ]know|exam trap|how the exam|trap|priority|decision rule|red flag/i;

/**
 * Cuts a note body to at most `maxWords`: sections called "Check against your textbook" (and Related topics)
 * are dropped, key facts / exam traps / decision rules come first, then the rest in note order. [[links]] lose their brackets.
 */
export function noteExcerpt(body: string, maxWords: number): string {
  const text = body.replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, '$1').replace(/\r/g, '');
  const parts = text.split(/^(?=##\s)/m).map((p) => p.trim()).filter(Boolean);
  const kept = parts.filter((p) => !DROP.test(p.split('\n')[0]));
  const head = kept.filter((p) => p.startsWith('##') && FIRST.test(p.split('\n')[0]));
  const rest = kept.filter((p) => !head.includes(p));
  const out: string[] = [];
  let left = Math.max(20, maxWords);
  for (const p of [...head, ...rest]) {
    if (left < 15) break;
    const w = countWords(p);
    out.push(w <= left ? p : clipWords(p, left));
    left -= Math.min(w, left);
  }
  return out.join('\n');
}

export const DIGEST_STEM_WORDS = 12;
export const DIGEST_MAX_LINES = 18;

export interface BankDigest {
  /** Prompt lines: counts line first, then one line per sampled question. */
  lines: string[];
  /** How many bank questions matched the topics. */
  matched: number;
}

const stemHead = (it: BankItem): string => {
  const base = it.stem && countWords(it.stem) >= 4 ? it.stem : `${it.vignette} ${it.stem}`;
  return clipWords(base.replace(/\s+/g, ' '), DIGEST_STEM_WORDS);
};

/**
 * Compact list of questions the bank already holds for these topics: first ~12 words of the stem, topic and
 * strategy or archetype; no options. Sampled round-robin across topics so each is represented.
 */
export function bankDigest(items: readonly BankItem[], topics: readonly string[], maxLines: number = DIGEST_MAX_LINES): BankDigest {
  const want = new Set(topics.map((t) => t.trim().toLowerCase()).filter(Boolean));
  const matched = items.filter((i) => want.has(i.topic.trim().toLowerCase()));
  if (!matched.length) return { lines: [], matched: 0 };
  const byTopic = new Map<string, BankItem[]>();
  for (const it of matched) byTopic.set(it.topic, [...(byTopic.get(it.topic) ?? []), it]);
  const mix: Record<string, number> = {};
  for (const it of matched) mix[it.type] = (mix[it.type] ?? 0) + 1;
  const lines = [
    `Already in the bank for these topics: ${matched.length} questions (${Object.entries(mix).map(([k, n]) => `${n} ${k}`).join(', ')}).`,
  ];
  const queues = [...byTopic.values()].map((q) => [...q]);
  const picked: BankItem[] = [];
  while (picked.length < maxLines && queues.some((q) => q.length)) {
    for (const q of queues) {
      const x = q.shift();
      if (x && picked.length < maxLines) picked.push(x);
    }
  }
  for (const it of picked) lines.push(`- ${stemHead(it)} | ${it.topic} | ${it.archetype || it.strategy || it.type}`);
  return { lines, matched: matched.length };
}
