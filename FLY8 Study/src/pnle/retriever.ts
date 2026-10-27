import type { PnleItem } from './types';

export interface ExemplarQuery {
  topicTitle: string;
  bodyText: string;
  /** NP1..NP5 or 'any'. */
  area?: string;
  /** Archetype ids to prefer. */
  archetypeHints?: string[];
  /** Target difficulty 1..5. */
  difficulty?: number;
  count?: number;
}

export const EXEMPLAR_MIN = 3;
export const EXEMPLAR_MAX = 5;
const BODY_CAP = 4000;

const STOP = new Set(
  'the a an and or of to in on for with is are was were be been by as at from that this it its his her their they them he she you your which what when how who whom not no can may will should would could do does did has have had than then also into about after before during over under between each per'.split(
    ' ',
  ),
);

/** Lowercase word tokens (3+ letters, not stop words). Deterministic. */
export function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.toLowerCase().split(/[^a-z0-9]+/)) if (w.length >= 3 && !STOP.has(w)) out.add(w);
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

function score(item: PnleItem, q: ExemplarQuery, query: Set<string>, titleTokens: Set<string>): number {
  let s = 0;
  s += 3 * overlap(tokens(item.topic), query);
  s += 2 * overlap(tokens(item.keyFacts.join(' ')), query);
  s += overlap(tokens(`${item.vignette} ${item.stem}`), query);
  s += 2 * overlap(tokens(`${item.topic} ${item.keyFacts.join(' ')}`), titleTokens);
  if (q.area) {
    if (item.area === q.area) s += 6;
    else if (item.area === 'any') s += 1;
  }
  if (q.archetypeHints?.includes(item.archetype)) s += 4;
  if (q.difficulty !== undefined && Number.isFinite(q.difficulty)) s += Math.max(0, 3 - Math.abs(item.difficulty - q.difficulty));
  return s;
}

/**
 * Picks the closest exemplars for a request. Pure and deterministic: same input, same output.
 * Score = keyword overlap + area match + archetype hints + difficulty closeness. Selection is greedy and
 * uses a new archetype whenever one is left (a repeat only fills the count), so the set shows different kinds of reasoning.
 * Ties break by id. Count is clamped to 3..5 and to the bank size; an empty bank gives [].
 */
export function pickExemplars(q: ExemplarQuery, bank: readonly PnleItem[]): PnleItem[] {
  const want = Math.min(EXEMPLAR_MAX, Math.max(EXEMPLAR_MIN, Math.round(q.count ?? 4)));
  if (!bank.length) return [];
  const titleTokens = tokens(q.topicTitle);
  const query = tokens(`${q.topicTitle} ${q.topicTitle} ${q.bodyText.slice(0, BODY_CAP)}`);
  const scored = bank.map((item) => ({ item, base: score(item, q, query, titleTokens) }));
  const picked: PnleItem[] = [];
  const perArchetype = new Map<string, number>();
  const pool = scored.slice();
  while (picked.length < want && pool.length) {
    let bestAt = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const adj = pool[i].base - 1000 * (perArchetype.get(pool[i].item.archetype) ?? 0);
      const better = adj > bestScore || (adj === bestScore && pool[i].item.id < pool[bestAt].item.id);
      if (better) {
        bestScore = adj;
        bestAt = i;
      }
    }
    const [{ item }] = pool.splice(bestAt, 1);
    picked.push(item);
    perArchetype.set(item.archetype, (perArchetype.get(item.archetype) ?? 0) + 1);
  }
  return picked;
}

const LETTERS = ['A', 'B', 'C', 'D'];

/** Compact, stable text for the prompt. */
export function formatExemplars(items: readonly PnleItem[]): string {
  if (!items.length) return '';
  return items
    .map((it, n) => {
      const lines = [`Worked example ${n + 1} (${it.area}, difficulty ${it.difficulty}, archetype ${it.archetype})`, `Vignette: ${it.vignette}`];
      if (it.stem.trim()) lines.push(`Stem: ${it.stem}`);
      it.options.forEach((o, k) => lines.push(`${LETTERS[k] ?? k + 1}. ${o}`));
      lines.push(`Answer: ${LETTERS[it.answerIndex] ?? it.answerIndex + 1}`);
      lines.push(`Strategy: ${it.strategyTag}`);
      if (it.reasoning.trim()) lines.push(`Reasoning: ${it.reasoning}`);
      lines.push('Why each option:');
      it.optionRationales.forEach((r, k) => lines.push(`${LETTERS[k] ?? k + 1}. ${r}`));
      return lines.join('\n');
    })
    .join('\n\n');
}
