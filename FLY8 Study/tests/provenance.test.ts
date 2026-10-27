import { describe, expect, it } from 'vitest';
import { buildSourceLine } from '../src/bank/provenance';
import type { BankItem } from '../src/bank/schema';

const base = { id: 'x', v: 2, type: 'single', area: 'NP1', topic: 'T', vignette: '', stem: 's', options: ['a', 'b', 'c', 'd'], answer: [0],
  rationale: '', optionRationales: [], strategy: '', difficulty: 2, source: 'bank', review: 'unreviewed', aiWritten: true } as unknown as BankItem;
const link = { kind: 'note', topicId: 'preset-n', title: 'Measles', bundle: 'Communicable disease', byTitle: false } as const;

describe('buildSourceLine', () => {
  it('names the note, bundle, key facts and an honest status', () => {
    const s = buildSourceLine({ ...base, noteId: 'n', keyFacts: ['Airborne precautions', 'Infectious 4 days before rash'] }, link);
    expect(s.heading).toBe('Where this answer comes from');
    expect(s.note).toBe('Measles · Communicable disease');
    expect(s.facts).toEqual(['Airborne precautions', 'Infectious 4 days before rash']);
    expect(s.status).toBe('AI-written, checked against our notes only, not a textbook citation');
  });
  it('shows just the note when there are no key facts', () => {
    const s = buildSourceLine({ ...base, noteId: 'n' }, { ...link, bundle: undefined });
    expect(s.note).toBe('Measles');
    expect(s.facts).toEqual([]);
  });
  it('says no linked note yet, and shows no facts, without a link', () => {
    const s = buildSourceLine({ ...base, keyFacts: ['A fact'] }, { kind: 'none' });
    expect(s.note).toBe('No linked note yet');
    expect(s.facts).toEqual([]);
    expect(buildSourceLine(base, undefined).note).toBe('No linked note yet');
  });
  it('uses the real review label when a person checked it', () => {
    expect(buildSourceLine({ ...base, review: 'nurse-checked' }, link).status).toBe('Checked by a nurse');
    expect(buildSourceLine({ ...base, review: 'owner-checked' }, link).status).toBe('Checked by you, not by a nurse');
  });
  it('a missing (not installed) note still names the note', () => {
    expect(buildSourceLine(base, { kind: 'missing', title: 'Measles' }).note).toBe('Measles');
  });
});
