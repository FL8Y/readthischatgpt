import { describe, expect, it } from 'vitest';
import { isArea, isItemType, isCaseOnlyType, isDifficulty, ITEM_TYPES } from '../src/bank/schema';
import type { BankItem } from '../src/bank/schema';
import { isBannedOption, jaccard, trigrams, validateBank, validateFile, validateItem } from '../src/bank/validate';
import { fromGold, fromKit, fromQuestion, toLegacyQuestion } from '../src/bank/adapters';
import type { PnleItem } from '../src/pnle/types';
import type { Question } from '../src/core/types';

const RAT = 'The correct choice is right because it addresses the priority problem first and safely.';

function single(over: Partial<BankItem> = {}): BankItem {
  return {
    id: 'x-1', v: 2, type: 'single', area: 'NP3', topic: 'Oxygenation',
    vignette: 'A client has sudden shortness of breath.', stem: 'Which action comes first?',
    options: ['Raise the head of the bed', 'Check the chart', 'Call the family', 'Give a snack'],
    answer: [0], rationale: RAT, optionRationales: ['a', 'b', 'c', 'd'], strategy: 'ABCs: breathing',
    difficulty: 3, keyFacts: ['k'], source: 'bank', review: 'unreviewed', aiWritten: true, ...over,
  };
}
const sata = (over: Partial<BankItem> = {}): BankItem =>
  single({ id: 'x-s', type: 'sata', options: ['a1', 'b1', 'c1', 'd1', 'e1'], answer: [0, 2], optionRationales: ['', '', '', '', ''], ...over });
const matrix = (over: Partial<BankItem> = {}): BankItem =>
  single({ id: 'x-m', type: 'matrix', options: [], answer: [], optionRationales: [], rows: ['r1', 'r2'], columns: ['c1', 'c2'], rowAnswer: [0, 1], clusterId: 'cl', clusterSeq: 1, ...over });
const cloze = (over: Partial<BankItem> = {}): BankItem =>
  single({ id: 'x-c', type: 'cloze', options: [], answer: [], optionRationales: [], blanks: [{ choices: ['up', 'down'], answer: 1 }], clusterId: 'cl', clusterSeq: 2, ...over });
const highlight = (over: Partial<BankItem> = {}): BankItem =>
  single({ id: 'x-h', type: 'highlight', options: ['s1', 's2', 's3'], answer: [1], optionRationales: [], clusterId: 'cl', clusterSeq: 3, ...over });

const errs = (i: BankItem) => validateItem(i).errors.join(' | ');

describe('schema helpers', () => {
  it('type guards', () => {
    expect(ITEM_TYPES.every(isItemType)).toBe(true);
    expect(isItemType('mcq')).toBe(false);
    expect(isArea('GEN')).toBe(true);
    expect(isArea('any')).toBe(false);
    expect(isDifficulty(5)).toBe(true);
    expect(isDifficulty(6)).toBe(false);
    expect(isCaseOnlyType('matrix')).toBe(true);
    expect(isCaseOnlyType('single')).toBe(false);
  });
});

describe('validateItem per type: pass and fail', () => {
  it('single passes', () => expect(validateItem(single()).ok).toBe(true));
  it('single fails: wrong option count', () => expect(errs(single({ options: ['a', 'b', 'c'], optionRationales: ['a', 'b', 'c'] }))).toMatch(/4 options/));
  it('single fails: answer length 2', () => expect(errs(single({ answer: [0, 1] }))).toMatch(/exactly 1/));
  it('single fails: answer out of range', () => expect(errs(single({ answer: [7] }))).toMatch(/out of range/));

  it('sata passes', () => expect(validateItem(sata()).ok).toBe(true));
  it('sata fails: 4 options', () => expect(errs(sata({ options: ['a', 'b', 'c', 'd'], optionRationales: ['', '', '', ''] }))).toMatch(/5-6 options/));
  it('sata fails: one answer', () => expect(errs(sata({ answer: [1] }))).toMatch(/at least 2/));
  it('sata fails: all options correct', () => expect(errs(sata({ answer: [0, 1, 2, 3, 4] }))).toMatch(/every option/));
  it('sata fails: duplicate answer index', () => expect(errs(sata({ answer: [1, 1] }))).toMatch(/duplicate indexes/));

  it('matrix passes', () => expect(validateItem(matrix()).ok).toBe(true));
  it('matrix fails: rowAnswer length', () => expect(errs(matrix({ rowAnswer: [0] }))).toMatch(/rowAnswer/));
  it('matrix fails: column index out of range', () => expect(errs(matrix({ rowAnswer: [0, 5] }))).toMatch(/out of range/));
  it('matrix fails: one column', () => expect(errs(matrix({ columns: ['only'] }))).toMatch(/columns/));
  it('matrix fails: one row', () => expect(errs(matrix({ rows: ['r'], rowAnswer: [0] }))).toMatch(/rows/));

  it('cloze passes', () => expect(validateItem(cloze()).ok).toBe(true));
  it('cloze fails: no blanks', () => expect(errs(cloze({ blanks: [] }))).toMatch(/at least 1 blank/));
  it('cloze fails: answer out of range', () => expect(errs(cloze({ blanks: [{ choices: ['a', 'b'], answer: 2 }] }))).toMatch(/answer out of range/));
  it('cloze fails: single choice', () => expect(errs(cloze({ blanks: [{ choices: ['a'], answer: 0 }] }))).toMatch(/at least 2 choices/));

  it('highlight passes', () => expect(validateItem(highlight()).ok).toBe(true));
  it('highlight fails: no correct segment', () => expect(errs(highlight({ answer: [] }))).toMatch(/at least 1 correct/));
  it('highlight fails: index out of range', () => expect(errs(highlight({ answer: [9] }))).toMatch(/out of range/));
  it('highlight fails: everything correct', () => expect(errs(highlight({ answer: [0, 1, 2] }))).toMatch(/every segment/));

  it('unknown type fails', () => expect(errs(single({ type: 'mcq' as never }))).toMatch(/unknown type/));
  it('case-only type outside a case set only warns', () => {
    const r = validateItem(highlight({ clusterId: undefined, clusterSeq: undefined }));
    expect(r.ok).toBe(true);
    expect(r.warnings.join()).toMatch(/case set/);
  });
});

describe('validateItem field rules', () => {
  it('banned options fail; normal options pass', () => {
    for (const bad of ['All of the above', 'None of the above.', 'Both A and B', 'a and c']) {
      expect(isBannedOption(bad)).toBe(true);
      expect(errs(single({ options: ['Raise the head of the bed', 'Check the chart', 'Call the family', bad] }))).toMatch(/banned/);
    }
    expect(isBannedOption('Apply the above dressing')).toBe(false);
    expect(validateItem(single()).ok).toBe(true);
  });
  it('duplicate options fail', () =>
    expect(errs(single({ options: ['Same', 'same ', 'Other', 'Third'] }))).toMatch(/duplicate option/));
  it('option length ratio over 3x fails, 2x passes', () => {
    expect(errs(single({ options: ['Yes', 'No way', 'A very long option that clearly goes past three times', 'Maybe'] }))).toMatch(/ratio/);
    expect(validateItem(single({ options: ['aaaa bbbb', 'cccc dddd', 'eeee ffff gggg', 'hhhh iiii'] })).ok).toBe(true);
  });
  it('rationale under 40 chars fails', () => expect(errs(single({ rationale: 'Too short.' }))).toMatch(/shorter than 40/));
  it('optionRationales count must equal options (single and sata)', () => {
    expect(errs(single({ optionRationales: ['a', 'b'] }))).toMatch(/optionRationales count/);
    expect(errs(sata({ optionRationales: ['a'] }))).toMatch(/optionRationales count/);
  });
  it('calc rationale numbers must come from the stem', () => {
    const base = { format: 'calc' as const, vignette: 'Order: 500 mg. Stock: 250 mg per tablet.', stem: 'How many tablets?', options: ['1', '2', '3', '4'], answer: [1] };
    expect(validateItem(single({ ...base, rationale: 'Divide 500 by 250 to get 2 tablets for the order given.' })).ok).toBe(true);
    expect(errs(single({ ...base, rationale: 'Divide 500 by 250 and then add 75 to the result for margin.' }))).toMatch(/numbers not in/);
  });
  it('format only on single', () => expect(errs(sata({ format: 'except' }))).toMatch(/single items only/));
  it('bad area, difficulty, ids fail', () => {
    expect(errs(single({ area: 'any' as never }))).toMatch(/area/);
    expect(errs(single({ difficulty: 9 as never }))).toMatch(/difficulty/);
    expect(errs(single({ id: '' }))).toMatch(/id is required/);
    expect(errs(single({ v: 1 as never }))).toMatch(/v must be 2/);
  });
});

// A balanced 20-item file: keys cycle A,B,C,D (25% each); correct option never strictly longest.
function balanced(n = 20): BankItem[] {
  return Array.from({ length: n }, (_, i) => {
    const key = i % 4;
    const opts = [`alpha ${i} one`, `beta ${i} two`, `gamma ${i} three`, `delta ${i} four`];
    return single({
      id: `b-${i}`, vignette: `Case ${i} about topic number ${i} unique words w${i}x`, stem: `Question ${i} pick best option q${i}z`,
      options: opts.map((o, j) => (j === key ? o : `${o} extra words`)), answer: [key],
    });
  });
}

describe('validateFile gates', () => {
  it('balanced file passes', () => expect(validateFile(balanced()).errors).toEqual([]));
  it('duplicate ids fail', () => {
    const f = balanced();
    f[3] = { ...f[3], id: f[2].id };
    expect(validateFile(f).errors.join()).toMatch(/duplicate id/);
  });
  it('duplicate stems fail', () => {
    const f = balanced();
    f[5] = { ...f[5], vignette: f[4].vignette, stem: f[4].stem };
    expect(validateFile(f).errors.join()).toMatch(/duplicate stem/);
  });
  it('key position skew fails (>= 20 singles), tiny files are exempt', () => {
    const f = balanced().map((i) => ({ ...i, options: i.options.map((o, j) => (j === 0 ? o.replace(/ extra words/, '') : o.includes('extra') ? o : `${o} extra words`)), answer: [0] }));
    expect(validateFile(f).errors.join()).toMatch(/key position/);
    expect(validateFile(f.slice(0, 5)).errors.join()).not.toMatch(/key position/);
  });
  it('correct strictly longest in >50% fails', () => {
    const f = balanced().map((i) => ({ ...i, options: i.options.map((o, j) => (j === i.answer[0] ? `${o.replace(' extra words', '')} with a clearly longer tail` : o.replace(' extra words', ''))) }));
    expect(validateFile(f).errors.join()).toMatch(/strictly the longest/);
  });
  it('item errors are prefixed with the item id', () => {
    const f = balanced();
    f[1] = { ...f[1], rationale: 'short' };
    expect(validateFile(f).errors.join()).toMatch(/b-1: rationale/);
  });
  it('non-array fails', () => expect(validateFile(null as never).ok).toBe(false));
});

describe('validateBank cross-file gates', () => {
  it('unique ids and distinct stems pass', () => expect(validateBank(balanced(6)).ok).toBe(true));
  it('duplicate ids across files fail', () => {
    const r = validateBank([single({ id: 'z' }), single({ id: 'z', stem: 'Totally different words here now please' , vignette: 'Other case entirely about something else altogether'})]);
    expect(r.errors.join()).toMatch(/duplicate id across bank/);
  });
  it('near-duplicate stems are reported as pairs', () => {
    const a = single({ id: 'n-1', vignette: 'A nurse is caring for a client with chest pain and shortness of breath on the ward today', stem: 'Which action should the nurse take first?' });
    const b = single({ id: 'n-2', vignette: 'A nurse is caring for a client with chest pain and shortness of breath on the ward today', stem: 'Which action should the nurse take first now?' });
    const r = validateBank([a, b]);
    expect(r.ok).toBe(false);
    expect(r.duplicatePairs.length).toBe(1);
    expect(r.duplicatePairs[0].score).toBeGreaterThan(0.6);
  });
  it('same-cluster items sharing a vignette are not flagged', () => {
    const v = 'A nurse is caring for a client with chest pain and shortness of breath on the ward today';
    const r = validateBank([single({ id: 'c-1', vignette: v, clusterId: 'k', clusterSeq: 1 }), single({ id: 'c-2', vignette: v, stem: 'What else?', clusterId: 'k', clusterSeq: 2 })]);
    expect(r.duplicatePairs).toEqual([]);
  });
  it('trigram helpers', () => {
    expect(jaccard(trigrams('a b c d e'), trigrams('a b c d e'))).toBe(1);
    expect(jaccard(trigrams('a b c d e'), trigrams('v w x y z'))).toBe(0);
  });
});

describe('adapters', () => {
  const gold: PnleItem = {
    id: 'np1-001', area: 'any', topic: 'T', archetype: 'arch', difficulty: 3, vignette: 'V', stem: 'S',
    options: ['a', 'b', 'c', 'd'], answerIndex: 2, strategyTag: 'Maslow', reasoning: 'Because reasons that are long enough here.',
    optionRationales: ['1', '2', '3', '4'], keyFacts: ['kf'], aiWritten: true, nurseReviewed: false,
  };
  it('fromGold maps fields', () => {
    const b = fromGold(gold);
    expect(b).toMatchObject({ v: 2, type: 'single', area: 'GEN', answer: [2], strategy: 'Maslow', rationale: gold.reasoning, source: 'gold', review: 'unreviewed' });
    expect(b.bloom).toBeUndefined();
  });
  it('fromQuestion maps choice and skips other kinds', () => {
    const q: Question = { id: 'q1', topicId: 't1', stem: 'V\n\nS', vignette: 'V', choices: ['a', 'b', 'c', 'd'], answerIndex: 1, rationale: 'r', strategy: 'ABC' };
    const b = fromQuestion(q)!;
    expect(b.stem).toBe('S');
    expect(b.vignette).toBe('V');
    expect(b).toMatchObject({ source: 'user-ai', answer: [1], type: 'single' });
    expect(b.id).toMatch(/^u-[0-9a-f]{8}$/);
    expect(fromQuestion({ ...q, kind: 'typing' })).toBeNull();
  });
  it('toLegacyQuestion round-trips a single and skips others', () => {
    const q = toLegacyQuestion(fromGold(gold))!;
    expect(q).toMatchObject({ id: 'np1-001', answerIndex: 2, kind: 'choice', area: 'any', stem: 'V\n\nS' });
    expect(toLegacyQuestion(sata())).toBeNull();
  });
  it('fromKit maps mcq, sata, matrix, cloze, highlight and situations', () => {
    const meta = { nursing_practice: 'NP5', topic: 'Comm', difficulty: 'difficult', cognitive_domain: 'applying' };
    const rat = 'x'.repeat(50);
    const out = fromKit([
      { id: 'k1', type: 'mcq', stem: 'Stem one here', rationale: rat, meta, answer: 'C', options: [
        { label: 'A', text: 'a', why_not: 'wa' }, { label: 'B', text: 'b', why_not: 'wb' }, { label: 'C', text: 'c' }, { label: 'D', text: 'd', why_not: 'wd' }] },
      { id: 'k2', type: 'sata', stem: 'Stem two here', rationale: rat, meta, options: ['a', 'b', 'c', 'd', 'e'], answers: [0, 3] },
      { id: 'k3', type: 'situation', situation: 'Shared case text that is long enough', items: [
        { id: 'k3a', type: 'matrix', stem: 'Matrix stem here', rationale: rat, meta, columns: ['x', 'y'], rows: [{ text: 'r1', correct_column: 1 }, { text: 'r2', correct_column: 0 }] },
        { id: 'k3b', type: 'cloze', stem: 'Cloze stem here', text: 'Give {{1}} fluids', rationale: rat, meta, blanks: [{ id: '1', choices: ['IV', 'PO'], correct_index: 0 }] },
        { id: 'k3c', type: 'highlight', stem: 'Highlight stem here', rationale: rat, meta, segments: [{ text: 'ctx', selectable: false, correct: false }, { text: 'p', selectable: true, correct: false }, { text: 'q', selectable: true, correct: true }] },
      ] },
    ]);
    expect(out.map((i) => i.type)).toEqual(['single', 'sata', 'matrix', 'cloze', 'highlight']);
    expect(out[0]).toMatchObject({ answer: [2], difficulty: 4, area: 'NP5', bloom: 'apply' });
    expect(out[0].optionRationales).toEqual(['wa', 'wb', rat, 'wd']);
    expect(out[2]).toMatchObject({ rowAnswer: [1, 0], clusterId: 'k3', clusterSeq: 1, vignette: 'Shared case text that is long enough' });
    expect(out[3].blanks).toEqual([{ choices: ['IV', 'PO'], answer: 0 }]);
    expect(out[4]).toMatchObject({ options: ['p', 'q'], answer: [1] });
  });
});
