/** Pure label builders for the answer card: what each explained slot is called, and where the answer comes from. */
import type { BankItem } from './schema';
import type { NoteLink } from './noteLink';
import { reviewBadge } from '../ui/practice/playerLogic';

/** One label per explained slot: options, matrix rows or cloze blanks. */
export function slotLabels(item: BankItem): string[] {
  if (item.type === 'matrix') return (item.rows ?? []).map((r, i) => `Row ${i + 1}: ${r}`);
  if (item.type === 'cloze') return (item.blanks ?? []).map((_, i) => `Blank ${i + 1}`);
  return item.options;
}

export interface SourceLine {
  heading: string;
  /** Note title and bundle, or "No linked note yet". */
  note: string;
  /** Key facts the answer rests on (never invented: only the item's own keyFacts). */
  facts: string[];
  /** Honest status. Never a citation. */
  status: string;
}

const MAX_FACTS = 3;

export function buildSourceLine(item: BankItem, link: NoteLink | undefined): SourceLine {
  const linked = link && link.kind !== 'none' ? link : undefined;
  const note = linked ? (linked.bundle ? `${linked.title} · ${linked.bundle}` : linked.title) : 'No linked note yet';
  const facts = linked ? (item.keyFacts ?? []).map((f) => f.trim()).filter(Boolean).slice(0, MAX_FACTS) : [];
  const badge = reviewBadge(item);
  const status = item.review === 'nurse-checked' || item.review === 'owner-checked'
    ? badge.text
    : item.aiWritten
      ? 'AI-written, checked against our notes only, not a textbook citation'
      : `${badge.text}, not a textbook citation`;
  return { heading: 'Where this answer comes from', note, facts, status };
}
