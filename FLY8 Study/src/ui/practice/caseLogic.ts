// Pure logic for case sets (clusters) and the matrix / cloze / highlight item types: response shaping,
// completeness, cluster ordering inside a session, whole-cluster selection, set result and reasoning summary.
import type { Bloom, BankItem } from '../../bank/schema';
import { makeSelection, makeRng, shuffled, SATA_CAP, type Rng } from '../../bank/curate';
import { scoreCaseSet, type CaseSetScore } from '../../bank/score';
import type { PracticeSession } from '../../bank/session';
import type { Selection } from '../../bank/types2';

// ---------- response shaping ----------

/** Empty draft: matrix = -1 per row, cloze = -1 per blank, others = no picks. */
export function emptyResponse(item: BankItem): number[] {
  if (item.type === 'matrix') return (item.rows ?? []).map(() => -1);
  if (item.type === 'cloze') return (item.blanks ?? []).map(() => -1);
  return [];
}

/** Draft padded/trimmed to the item's slots so positions line up (matrix/cloze only). */
export function slotsOf(item: BankItem, selected: readonly number[]): number[] {
  if (item.type !== 'matrix' && item.type !== 'cloze') return [...selected];
  return emptyResponse(item).map((_, i) => (typeof selected[i] === 'number' ? selected[i] : -1));
}

/** Set one slot (matrix row -> column, cloze blank -> choice). Out-of-range indexes change nothing. */
export function setSlot(item: BankItem, selected: readonly number[], slot: number, value: number): number[] {
  const cur = slotsOf(item, selected);
  const size = item.type === 'matrix' ? (item.columns ?? []).length : (item.blanks?.[slot]?.choices.length ?? 0);
  if (slot < 0 || slot >= cur.length || value < -1 || value >= size) return cur;
  cur[slot] = value;
  return cur;
}

/** Highlight / sata toggle, kept sorted. */
export function togglePick(selected: readonly number[], idx: number, optionCount: number): number[] {
  if (idx < 0 || idx >= optionCount) return [...selected];
  return selected.includes(idx) ? selected.filter((x) => x !== idx) : [...selected, idx].sort((a, b) => a - b);
}

/** True when the response may be submitted. Matrix and cloze need every row / blank filled. */
export function isComplete(item: BankItem, selected: readonly number[]): boolean {
  switch (item.type) {
    case 'single': return selected.length === 1;
    case 'sata':
    case 'highlight': return selected.length >= 1;
    case 'matrix': {
      const cols = (item.columns ?? []).length;
      const rows = (item.rows ?? []).length;
      return rows > 0 && Array.from({ length: rows }, (_, i) => selected[i]).every((s) => typeof s === 'number' && s >= 0 && s < cols);
    }
    case 'cloze': {
      const blanks = item.blanks ?? [];
      return blanks.length > 0 && blanks.every((b, i) => typeof selected[i] === 'number' && selected[i] >= 0 && selected[i] < b.choices.length);
    }
    default: return false;
  }
}

/** Short instruction under the stem for the new types. */
export function caseHint(item: BankItem): string {
  if (item.type === 'matrix') return 'Pick one column for every row';
  if (item.type === 'cloze') return 'Choose a word for every blank';
  if (item.type === 'highlight') return 'Tap the parts of the text that answer the question, then press Done';
  return '';
}

export type PartVerdict = 'correct' | 'wrong' | 'blank';

/** Per row / blank verdicts for feedback. */
export function partVerdicts(item: BankItem, selected: readonly number[]): PartVerdict[] {
  const answers = item.type === 'matrix' ? (item.rowAnswer ?? []) : (item.blanks ?? []).map((b) => b.answer);
  return answers.map((a, i) => (typeof selected[i] !== 'number' || selected[i] < 0 ? 'blank' : selected[i] === a ? 'correct' : 'wrong'));
}

// ---------- cloze text ----------

export type ClozePart = { kind: 'text'; text: string } | { kind: 'blank'; index: number };

/** Blank markers accepted in the cloze text: {{1}} [[1]] {1} [1] [blank] {blank} or a run of 3+ underscores. */
const MARKER = /\{\{\s*\d*\s*\}\}|\[\[\s*\d*\s*\]\]|\{\s*\d+\s*\}|\[\s*\d+\s*\]|\[blank\]|\{blank\}|_{3,}/gi;

export const countMarkers = (text: string): number => (text.match(MARKER) ?? []).length;

/**
 * Splits text at its markers; the k-th marker is blank k (in order, numbers are ignored). Extra markers stay as
 * "____" text; blanks without a marker are appended after the text so every blank can still be answered.
 */
export function splitCloze(text: string, blankCount: number): ClozePart[] {
  const parts: ClozePart[] = [];
  let used = 0;
  let last = 0;
  for (const m of text.matchAll(MARKER)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ kind: 'text', text: text.slice(last, at) });
    if (used < blankCount) parts.push({ kind: 'blank', index: used++ });
    else parts.push({ kind: 'text', text: '____' });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  while (used < blankCount) parts.push({ kind: 'blank', index: used++ });
  return parts;
}

/** Which field holds the sentence with blanks. The stem wins; the vignette is used when only it has markers. */
export function clozeSource(item: BankItem): 'stem' | 'vignette' {
  if (countMarkers(item.stem) > 0) return 'stem';
  return countMarkers(item.vignette) > 0 ? 'vignette' : 'stem';
}

/** Marker-free reading text for a shared panel (blanks shown as "____"). */
export const plainCloze = (text: string): string => text.replace(MARKER, '____');

// ---------- clusters inside a session ----------

export interface ClusterPos {
  clusterId: string;
  /** Session order indexes of the cluster's first and last item. */
  start: number;
  end: number;
  /** 1-based position of the cursor within the cluster, and the size. */
  seq: number;
  size: number;
}

/** The contiguous run of items sharing a clusterId around `cursor`, or null for a stand-alone item. */
export function clusterAt(order: readonly string[], byId: ReadonlyMap<string, BankItem>, cursor: number): ClusterPos | null {
  const cid = byId.get(order[cursor])?.clusterId;
  if (!cid) return null;
  let start = cursor;
  let end = cursor;
  while (start > 0 && byId.get(order[start - 1])?.clusterId === cid) start--;
  while (end < order.length - 1 && byId.get(order[end + 1])?.clusterId === cid) end++;
  return { clusterId: cid, start, end, seq: cursor - start + 1, size: end - start + 1 };
}

export const caseProgressText = (p: ClusterPos): string => `Case item ${p.seq} of ${p.size}`;

/** Items of a cluster in presentation order, from the session. */
export function clusterItems(s: PracticeSession, byId: ReadonlyMap<string, BankItem>, p: ClusterPos): BankItem[] {
  return s.order.slice(p.start, p.end + 1).map((id) => byId.get(id)).filter((x): x is BankItem => !!x);
}

export interface BloomLine { level: Bloom; label: string; correct: number; total: number }

export interface CaseSetResult {
  score: CaseSetScore;
  /** Summed credit as a whole percent. */
  percent: number;
  answered: number;
  total: number;
  bloom: BloomLine[];
  /** Plain text, e.g. "Recall 1 of 1 · Apply 2 of 3". Empty when no item has a bloom tag. */
  bloomText: string;
}

const BLOOM_ORDER: Bloom[] = ['recall', 'apply', 'judgment'];
const BLOOM_LABEL: Record<Bloom, string> = { recall: 'Recall', apply: 'Apply', judgment: 'Judgment' };

/** Counts per reasoning level: items tagged, and how many earned full credit. */
export function bloomSummary(items: readonly BankItem[], credits: readonly number[]): BloomLine[] {
  return BLOOM_ORDER.map((level) => {
    let total = 0;
    let correct = 0;
    items.forEach((it, i) => {
      if (it.bloom !== level) return;
      total++;
      if ((credits[i] ?? 0) >= 1) correct++;
    });
    return { level, label: BLOOM_LABEL[level], correct, total };
  }).filter((l) => l.total > 0);
}

/** True once every item of the cluster has been answered. */
export function clusterAnswered(s: PracticeSession, items: readonly BankItem[]): boolean {
  return items.length > 0 && items.every((it) => s.answeredIds.includes(it.id));
}

/** Summed credit through score.ts plus the reasoning-level summary. */
export function caseSetResult(s: PracticeSession, items: readonly BankItem[]): CaseSetResult {
  const responses = items.map((it) => (s.answeredIds.includes(it.id) ? { selected: s.answers[it.id]?.selected ?? [] } : undefined));
  const score = scoreCaseSet([...items], responses);
  const bloom = bloomSummary(items, score.perItem.map((p) => p.credit));
  return {
    score,
    percent: Math.round(score.credit * 100),
    answered: responses.filter(Boolean).length,
    total: items.length,
    bloom,
    bloomText: bloom.map((b) => `${b.label} ${b.correct} of ${b.total}`).join(' · '),
  };
}

// ---------- whole-cluster selection ----------

/** clusterId -> members sorted by clusterSeq (then id). Only clusters of 2+ items. */
export function groupClusters(items: readonly BankItem[]): Map<string, BankItem[]> {
  const m = new Map<string, BankItem[]>();
  for (const it of items) {
    if (!it.clusterId) continue;
    const g = m.get(it.clusterId);
    if (g) g.push(it); else m.set(it.clusterId, [it]);
  }
  for (const [k, g] of [...m]) {
    if (g.length < 2) m.delete(k);
    else g.sort((a, b) => (a.clusterSeq ?? 0) - (b.clusterSeq ?? 0) || a.id.localeCompare(b.id));
  }
  return m;
}

/**
 * Same contract as curate.Picker (no repeats, sata <= 12% of stand-alone picks, stops at n) but a candidate that
 * belongs to a case set pulls in the whole set, in clusterSeq order, counted as its item count. A set that does
 * not fit in the room left is skipped, so a set is never split.
 */
export class ClusterPicker {
  readonly out: BankItem[] = [];
  private ids = new Set<string>();
  private sata = 0;
  private cap: number;
  private groups: Map<string, BankItem[]>;
  constructor(readonly n: number, all: readonly BankItem[]) {
    this.cap = Math.max(1, Math.ceil(n * SATA_CAP));
    this.groups = groupClusters(all);
  }
  get full(): boolean { return this.out.length >= this.n; }
  /** Add from cands in order, at most `quota` of them (a set counts as its size). */
  add(cands: readonly BankItem[], quota = this.n): void {
    let c = 0;
    for (const it of cands) {
      if (this.full || c >= quota) break;
      if (this.ids.has(it.id)) continue;
      const group = it.clusterId ? this.groups.get(it.clusterId) : undefined;
      if (group) {
        if (group.some((g) => this.ids.has(g.id))) continue; // never split
        if (this.out.length + group.length > this.n || c + group.length > quota) continue;
        for (const g of group) { this.ids.add(g.id); this.out.push(g); }
        c += group.length;
        continue;
      }
      if (it.type === 'sata') { if (this.sata >= this.cap) continue; this.sata++; }
      this.ids.add(it.id); this.out.push(it); c++;
    }
  }
  selection(): Selection { return makeSelection(this.out.map((i) => i.id), this.n); }
}

/** Case-study mode: `sets` whole case sets (2+ items, shuffled by seed). Short when fewer exist. */
export function pickCaseSets(items: readonly BankItem[], sets: number, seed: number | string | Rng): Selection {
  const rng = typeof seed === 'function' ? seed : makeRng(seed);
  const want = Math.max(1, Math.floor(sets));
  const chosen = shuffled([...groupClusters(items).values()], rng).slice(0, want);
  return { ids: chosen.flatMap((g) => g.map((i) => i.id)), requested: want, short: chosen.length < want };
}
