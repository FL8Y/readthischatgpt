import { describe, expect, it } from 'vitest';
import { applyImport, validateBackup } from '../src/core/backup';
import { emptyState, exportJson } from '../src/storage';
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
