import { describe, expect, it } from 'vitest';
import { applyImport, validateBackup } from '../src/core/backup';
import { emptyState, exportJson } from '../src/storage';
import { buildExport, pickExtras } from '../src/core/backup';
import type { AppState } from '../src/core/types';

const sample = (): AppState => ({
  ...emptyState(),
  topics: [{ id: 't1', folderId: 'np1', title: 'Heart', body: 'See [[Lungs]]', sourceIds: [] }],
  events: [{ id: 'e1', questionId: 'q1', topicId: 't1', correct: true, at: 1, kind: 'pop' }],
  settings: { provider: 'openai', apiKey: 'sk-secret-123', model: 'gpt-x' },
});

describe('validateBackup', () => {
  it('round-trips an export and the export never holds the key', () => {
    const json = exportJson(sample());
    expect(json).not.toContain('sk-secret-123');
    const r = validateBackup(json);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.topics).toHaveLength(1);
      expect(r.state.settings.apiKey).toBe('');
      expect(r.summary).toMatchObject({ topics: 1, events: 1 });
    }
  });

  it('rejects non-JSON and non-objects', () => {
    expect(validateBackup('not json').ok).toBe(false);
    expect(validateBackup('[1,2]').ok).toBe(false);
    expect(validateBackup('null').ok).toBe(false);
  });

  it('rejects missing lists and settings', () => {
    const r = validateBackup('{}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('Missing list: topics');
  });

  it('rejects malformed items and unknown providers', () => {
    const bad = JSON.parse(exportJson(sample()));
    bad.topics[0].title = 5;
    bad.settings.provider = 'other';
    const r = validateBackup(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain('Topic #1 is malformed.');
      expect(r.errors).toContain('Settings has an unknown provider.');
    }
  });

  it('ignores a key smuggled into the file', () => {
    const withKey = JSON.parse(exportJson(sample()));
    withKey.settings.apiKey = 'sk-from-file';
    const r = validateBackup(JSON.stringify(withKey));
    expect(r.ok && r.state.settings.apiKey).toBe('');
  });
});

describe('applyImport', () => {
  it('keeps the key already on the phone', () => {
    const current = sample();
    const r = validateBackup(exportJson({ ...sample(), topics: [] }));
    if (!r.ok) throw new Error('fixture invalid');
    const next = applyImport(current, r.state);
    expect(next.topics).toHaveLength(0);
    expect(next.settings.apiKey).toBe('sk-secret-123');
  });
});

describe('backup extras (lessons, tutor chat)', () => {
  const extras = { lessons: { t1: { explanation: 'x' } }, tutor: { messages: [] } };

  it('round-trips extras through export and validate, and never exports the key', () => {
    const state = { ...emptyState(), settings: { ...emptyState().settings, apiKey: 'sk-secret' } };
    const text = buildExport(state, extras);
    expect(text).not.toContain('sk-secret');
    const r = validateBackup(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.extras).toEqual(extras);
      expect(r.state.settings.apiKey).toBe('');
      expect((r.state as unknown as Record<string, unknown>).extras).toBeUndefined();
    }
  });

  it('ignores extras that are not objects and old backups without extras still import', () => {
    expect(pickExtras({ lessons: 'nope', srs: 5, tutor: null })).toEqual({});
    expect(pickExtras(undefined)).toEqual({});
    const r = validateBackup(exportJson(emptyState()));
    expect(r.ok && r.extras).toEqual({});
  });

  it('imports an old backup that still contains flashcards (srs) and ignores them', () => {
    const old = JSON.stringify({ ...emptyState(), extras: { ...extras, srs: { cards: [{ id: 'c1', front: 'a', back: 'b' }], reviews: [] } } });
    const r = validateBackup(old);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.extras).toEqual(extras);
      expect((r.extras as Record<string, unknown>).srs).toBeUndefined();
    }
  });
});
