import { describe, expect, it } from 'vitest';
import bundlesJson from '../data/presets/bundles.json';
import { noteToBundleMap } from '../src/bank/loader';
import { PACKS } from '../src/bank/packs.generated';
import { findTopicByName, resolveNoteLink } from '../src/bank/noteLink';
import type { BankItem } from '../src/bank/schema';
import { PRESET_PACKS } from '../src/presets';

const noteBundle = noteToBundleMap(bundlesJson.bundles);
const bundleNames = Object.fromEntries(bundlesJson.bundles.map((b) => [b.id, b.name]));
const opts = { noteBundle, bundleNames };
const topics = [
  { id: 'preset-np1-cd-measles', title: 'Measles' },
  { id: 'u1', title: 'My heart failure notes' },
];

describe('resolveNoteLink', () => {
  it('opens the installed ready-made note by noteId and names its bundle', () => {
    const l = resolveNoteLink({ noteId: 'np1-cd-measles', topic: 'Something else' }, topics, opts);
    expect(l).toMatchObject({ kind: 'note', topicId: 'preset-np1-cd-measles', title: 'Measles', byTitle: false });
    if (l.kind === 'note') expect(l.bundle).toBeTruthy();
  });

  it('accepts a topic whose id is the bare noteId', () => {
    const l = resolveNoteLink({ noteId: 'abc', topic: 'x' }, [{ id: 'abc', title: 'ABC note' }], opts);
    expect(l).toMatchObject({ kind: 'note', topicId: 'abc' });
  });

  it('falls back to a topic-name search when there is no noteId', () => {
    const l = resolveNoteLink({ topic: 'Heart failure' }, topics, opts);
    expect(l).toMatchObject({ kind: 'note', topicId: 'u1', byTitle: true });
  });

  it('reports a ready-made note that is not installed', () => {
    const l = resolveNoteLink({ noteId: 'np1-cd-measles', topic: 'Measles contacts of a child' }, [], { ...opts, noteTitle: () => 'Measles' });
    expect(l).toMatchObject({ kind: 'missing', title: 'Measles' });
  });

  it('returns none when nothing matches or the topic name is too short', () => {
    expect(resolveNoteLink({ topic: 'Burns' }, topics, opts)).toEqual({ kind: 'none' });
    expect(resolveNoteLink({ noteId: 'zzz', topic: 'Unknown thing' }, topics, opts)).toEqual({ kind: 'none' });
    expect(findTopicByName('ab', [{ id: 'a', title: 'ab' }])).toBeUndefined();
  });
});

describe('bundled questions point at real notes', () => {
  const noteIds = new Set(PRESET_PACKS.flatMap((p) => p.notes.map((n) => n.id)));
  const items = PACKS.flatMap((p) => (Array.isArray(p.items) ? (p.items as BankItem[]) : []));

  it('every noteId on a question exists in the ready-made notes', () => {
    const missing = items.filter((i) => i.noteId && !noteIds.has(i.noteId)).map((i) => `${i.id}:${i.noteId}`);
    expect(missing).toEqual([]);
  });

  it('with all notes installed, every question that has a noteId resolves to its note', () => {
    const all = PRESET_PACKS.flatMap((p) => p.notes.map((n) => ({ id: `preset-${n.id}`, title: n.title })));
    const withNote = items.filter((i) => i.noteId);
    expect(withNote.length).toBeGreaterThan(500);
    for (const i of withNote) {
      const l = resolveNoteLink(i, all, opts);
      expect(l.kind === 'note' && l.topicId === `preset-${i.noteId}`).toBe(true);
    }
  });
});
