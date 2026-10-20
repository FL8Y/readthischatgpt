/**
 * Turns one bank question (plus the learner's answer) into text the tutor can start from, and a few
 * ready-made questions to ask about it. Pure: no I/O.
 */
import type { BankItem } from '../bank/schema';

export interface ItemContext {
  item: BankItem;
  /** What the learner picked, in `selected` form (see score.ts). Absent when not answered yet. */
  selected?: number[];
}

const L = (i: number): string => String.fromCharCode(65 + i);
const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}...` : s);

function describeAnswer(item: BankItem, picked: number[] | undefined, which: 'learner' | 'key'): string {
  if (item.type === 'matrix') {
    const src = which === 'key' ? item.rowAnswer ?? [] : picked ?? [];
    const rows = item.rows ?? [];
    const cols = item.columns ?? [];
    return rows.map((r, i) => `${r} -> ${cols[src[i]] ?? '(blank)'}`).join('; ');
  }
  if (item.type === 'cloze') {
    const blanks = item.blanks ?? [];
    return blanks.map((b, i) => `blank ${i + 1}: ${b.choices[which === 'key' ? b.answer : picked?.[i] ?? -1] ?? '(blank)'}`).join('; ');
  }
  const idx = which === 'key' ? item.answer : picked ?? [];
  if (!idx.length) return '(no answer)';
  return idx.map((i) => `${L(i)}. ${item.options[i] ?? '?'}`).join(' | ');
}

/** The question, the key, the learner's answer and the rationale as plain text. */
export function itemContextText(ctx: ItemContext): string {
  const { item, selected } = ctx;
  const lines = [
    'The learner is asking about this practice question (AI-written, not nurse-reviewed):',
    item.vignette ? `Case: ${clip(item.vignette, 900)}` : '',
    `Question: ${clip(item.stem, 400)}`,
  ];
  if (item.type === 'matrix') lines.push(`Rows: ${(item.rows ?? []).join('; ')}`, `Columns: ${(item.columns ?? []).join('; ')}`);
  else if (item.type === 'cloze') lines.push(...(item.blanks ?? []).map((b, i) => `Blank ${i + 1} choices: ${b.choices.join(' / ')}`));
  else lines.push('Options:', ...item.options.map((o, i) => `${L(i)}. ${clip(o, 300)}`));
  lines.push(`Best answer: ${describeAnswer(item, undefined, 'key')}`);
  if (selected !== undefined) lines.push(`Learner chose: ${describeAnswer(item, selected, 'learner')}`);
  if (item.strategy) lines.push(`Strategy tag: ${item.strategy}`);
  if (item.rationale) lines.push(`Rationale given: ${clip(item.rationale, 900)}`);
  lines.push('Explain from the learner\'s notes first, say plainly if the key itself looks doubtful, and keep it short.');
  return lines.filter(Boolean).join('\n');
}

/** Short questions the learner can tap instead of typing. */
export function itemQuickAsks(ctx: ItemContext): string[] {
  const asks = ['Explain the best answer in simpler words'];
  if (ctx.selected !== undefined && ctx.selected.length) asks.push('Check my answer: what did I get right or wrong, and what made the wrong options tempting?');
  asks.push('What rule or strategy decides this one?', 'Give me a similar question to try');
  return asks;
}
