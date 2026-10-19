import type { BankItem } from './schema';

/**
 * Item-agnostic response. `selected` meaning by item type:
 *  single/sata/highlight: chosen option indexes.
 *  matrix: selected[row] = chosen column (-1 or missing = blank).
 *  cloze: selected[blank] = chosen dropdown choice (-1 or missing = blank).
 */
export interface ItemResponse {
  selected: number[];
}

export interface ScoreOptions {
  /** A hint was used before answering. Halves points, never credit. */
  hinted?: boolean;
  /** Mock board mode: hints are not allowed, so the flag is ignored. */
  mock?: boolean;
}

export interface ScoreDetail {
  correctPicks: number;
  wrongPicks: number;
  /** Number of correct options / rows / blanks. */
  total: number;
}

export interface ItemScore {
  credit: number; // 0..1
  correct: boolean; // credit === 1
  points: number; // round(10 * credit), halved when hinted
  detail: ScoreDetail;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function pickScore(correct: number[], picks: number[]): { credit: number; detail: ScoreDetail } {
  const unique = Array.from(new Set(picks));
  const right = unique.filter((p) => correct.includes(p)).length;
  const wrong = unique.length - right;
  const total = correct.length;
  const credit = total === 0 ? 0 : clamp01(Math.max(0, right - wrong) / total);
  return { credit, detail: { correctPicks: right, wrongPicks: wrong, total } };
}

function partScore(answers: number[], selected: number[]): { credit: number; detail: ScoreDetail } {
  const total = answers.length;
  let right = 0;
  let wrong = 0;
  answers.forEach((a, i) => {
    const s = selected[i];
    if (s === undefined || s < 0) return;
    if (s === a) right++;
    else wrong++;
  });
  return { credit: total === 0 ? 0 : right / total, detail: { correctPicks: right, wrongPicks: wrong, total } };
}

export function scoreItem(item: BankItem, response: ItemResponse, opts: ScoreOptions = {}): ItemScore {
  const sel = response.selected ?? [];
  let r: { credit: number; detail: ScoreDetail };
  switch (item.type) {
    case 'single':
      r = pickScore(item.answer.slice(0, 1), sel.slice(0, 1));
      break;
    case 'sata':
    case 'highlight':
      r = pickScore(item.answer, sel);
      break;
    case 'matrix':
      r = partScore(item.rowAnswer ?? [], sel);
      break;
    case 'cloze':
      r = partScore((item.blanks ?? []).map((b) => b.answer), sel);
      break;
    default:
      r = { credit: 0, detail: { correctPicks: 0, wrongPicks: 0, total: 0 } };
  }
  const credit = r.credit;
  const hintApplies = !!opts.hinted && !opts.mock;
  const base = 10 * credit;
  return {
    credit,
    correct: credit === 1,
    points: Math.round(hintApplies ? base / 2 : base),
    detail: r.detail,
  };
}

export interface CaseSetScore {
  /** Sum of credits / number of items. */
  credit: number;
  correct: boolean;
  points: number;
  perItem: ItemScore[];
}

/** responses[i] answers items[i]; a missing response scores 0. */
export function scoreCaseSet(
  items: BankItem[],
  responses: (ItemResponse | undefined)[],
  opts: ScoreOptions = {},
): CaseSetScore {
  const perItem = items.map((it, i) => {
    const r = responses[i];
    return r ? scoreItem(it, r, opts) : { credit: 0, correct: false, points: 0, detail: { correctPicks: 0, wrongPicks: 0, total: 0 } };
  });
  const credit = items.length === 0 ? 0 : perItem.reduce((s, x) => s + x.credit, 0) / items.length;
  return {
    credit,
    correct: items.length > 0 && perItem.every((x) => x.correct),
    points: perItem.reduce((s, x) => s + x.points, 0),
    perItem,
  };
}
