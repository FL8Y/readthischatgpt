import { describe, expect, it } from 'vitest';
import { emptyStateForTest } from './presetsFixture';
import { findPresetNote, installPack, presetStatus, validatePresetNotes, type PresetPack } from '../src/presets';

const body = 'This is a reasonable note about community health nursing with enough ordinary words to read well.';
const mk = (id: string, title: string) => ({
  id, area: 'NP1', title, body: `## ${title}\n${body} See [[Other]].`, tags: [], priority: 'high', outlineRefs: [], aiWritten: true, nurseReviewed: false,
});

const raw = [mk('a-1', 'Alpha'), mk('a-2', 'Beta'), mk('a-3', 'Gamma')];
const { notes } = validatePresetNotes(raw);
const packs: PresetPack[] = [{ id: 'np1', area: 'NP1', blurb: 'test pack', name: 'NP1 Community Health Nursing', folderName: 'NP1 Community Health Nursing', notes }];

describe('validatePresetNotes', () => {
  it('drops malformed, duplicate-id and duplicate-title notes with warnings', () => {
    const res = validatePresetNotes([
      mk('x-1', 'One'),
      { id: 'x-2', title: 'No body' },
      { title: 'No id', body: 'b' },
      mk('x-1', 'Dup id'),
      mk('x-3', 'one'),
      null,
      mk('x-4', 'Four'),
    ]);
    expect(res.notes.map((n) => n.id)).toEqual(['x-1', 'x-4']);
    expect(res.warnings.length).toBe(5);
  });
  it('tolerates non-array input', () => {
    expect(validatePresetNotes({}).notes).toEqual([]);
  });
});

describe('installPack', () => {
  it('creates folder once, topics, one source and unique chunks', () => {
    const s1 = installPack(emptyStateForTest(), 'np1', undefined, packs);
    expect(s1.folders.filter((f) => f.name === 'NP1 Community Health Nursing')).toHaveLength(1);
    expect(s1.topics.map((t) => t.id)).toEqual(['preset-a-1', 'preset-a-2', 'preset-a-3']);
    expect(s1.sources.filter((s) => s.kind === 'preset')).toHaveLength(1);
    const src = s1.sources[0];
    expect(src.id).toBe('preset-np1');
    expect(src.verification).toBe('unverified');
    expect(src.suggestedOrigin).toBeUndefined();
    expect(s1.topics.every((t) => t.sourceIds[0] === src.id)).toBe(true);
    expect(s1.chunks.length).toBeGreaterThanOrEqual(3);
    expect(new Set(s1.chunks.map((c) => c.id)).size).toBe(s1.chunks.length);
    expect(s1.chunks.every((c) => c.sourceId === 'preset-np1')).toBe(true);
  });
  it('is idempotent', () => {
    const s1 = installPack(emptyStateForTest(), 'np1', undefined, packs);
    const s2 = installPack(s1, 'np1', undefined, packs);
    expect(s2).toEqual(s1);
  });
  it('never overwrites an edited topic and leaves other folders alone', () => {
    const s0 = emptyStateForTest();
    const s1 = installPack(s0, 'np1', ['a-1'], packs);
    const edited = { ...s1, topics: s1.topics.map((t) => ({ ...t, body: 'MY EDIT' })) };
    const s2 = installPack(edited, 'np1', undefined, packs);
    expect(s2.topics.find((t) => t.id === 'preset-a-1')?.body).toBe('MY EDIT');
    expect(s2.topics).toHaveLength(3);
    expect(s2.folders.filter((f) => f.name === 'NP1 Community Health Nursing')).toHaveLength(1);
    expect(s2.folders.find((f) => f.id === 'np1')).toEqual(s0.folders[0]);
  });
  it('installs only the requested ids and ignores unknown packs', () => {
    const s = installPack(emptyStateForTest(), 'np1', ['a-2'], packs);
    expect(s.topics.map((t) => t.id)).toEqual(['preset-a-2']);
    const same = emptyStateForTest();
    expect(installPack(same, 'nope', undefined, packs)).toBe(same);
  });
});

describe('presetStatus / findPresetNote', () => {
  it('counts installed vs total', () => {
    const s0 = emptyStateForTest();
    expect(presetStatus(s0, packs)).toEqual([{ packId: 'np1', installed: 0, total: 3 }]);
    const s1 = installPack(s0, 'np1', ['a-1', 'a-3'], packs);
    expect(presetStatus(s1, packs)).toEqual([{ packId: 'np1', installed: 2, total: 3 }]);
  });
  it('looks up a note by topic id', () => {
    expect(findPresetNote('preset-a-2', packs)?.title).toBe('Beta');
    expect(findPresetNote('t-1', packs)).toBeUndefined();
  });
});
