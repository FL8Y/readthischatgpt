/** Turns ticked topic names into TopicPick entries (area, note id, note body). Pure: no I/O. */
import type { BankItem } from '../bank/schema';
import type { TopicPick } from './generator';

export interface NoteRef {
  id: string;
  title: string;
  body: string;
}

const key = (s: string): string => s.trim().toLowerCase();

export function resolvePicks(names: readonly string[], perTopic: number, items: readonly BankItem[], notes: readonly NoteRef[]): TopicPick[] {
  const byTopic = new Map<string, BankItem[]>();
  for (const it of items) {
    const k = key(it.topic);
    byTopic.set(k, [...(byTopic.get(k) ?? []), it]);
  }
  const byId = new Map(notes.map((n) => [n.id, n]));
  const byTitle = new Map(notes.map((n) => [key(n.title), n]));
  return names.map((name) => {
    const its = byTopic.get(key(name)) ?? [];
    const noteId = its.find((i) => i.noteId && byId.has(i.noteId))?.noteId;
    const note = (noteId && byId.get(noteId)) || byTitle.get(key(name));
    return { name, count: perTopic, area: its[0]?.area, noteId: note?.id ?? noteId, body: note?.body };
  });
}
