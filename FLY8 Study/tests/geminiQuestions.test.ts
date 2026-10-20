import { describe, expect, it } from 'vitest';
import { checkQuestionReply, validateQuestionPatch } from '../src/gemini/questionPatch';
import type { BankItem } from '../src/bank/schema';
import comm from '../data/bank/np1/comm-01.json';

const base = comm[0] as unknown as BankItem;
const NOTES = new Set(['np1-cd-terms', 'np1-cd-dengue']);
const ctx = { existing: [] as BankItem[], noteIds: NOTES };
const cc = { sources: ['Maglaya, Nursing Practice in the Community 5e, ch. on communicable disease', 'https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue'], verdict: 'AGREE' };

let n = 0;
const q = (over: Record<string, unknown> = {}) => {
  n++;
  return {
    item: { ...base, id: `np1-gx-${String(n).padStart(4, '0')}`, noteId: 'np1-cd-terms', stem: `Which measure applies to exposed pupils, variant ${n} ${'x'.repeat(n)} unique words ${n * 7919}?`, vignette: `Unique vignette number ${n} about a school clinic and ${n * 104729} other things.`, ...over },
    crosscheck: cc,
  };
};
const patch = (questions: unknown[]) => ({ task: 'Q-NP1', batch: 1, questions });
const codes = (r: ReturnType<typeof validateQuestionPatch>, i = 0) => r.results[i].errors.map((e) => e.code);

describe('validateQuestionPatch', () => {
  it('accepts a good question and forces unreviewed + aiWritten', () => {
    const r = validateQuestionPatch(patch([q({ review: 'nurse-checked', aiWritten: false })]), ctx);
    expect(codes(r)).toEqual([]);
    expect(r.accepted).toHaveLength(1);
    expect(r.accepted[0].review).toBe('unreviewed');
    expect(r.accepted[0].aiWritten).toBe(true);
  });

  it('rejects a missing or fake noteId, a missing crosscheck and a crosscheck without a link', () => {
    const r = validateQuestionPatch(patch([
      q({ noteId: undefined }), q({ noteId: 'np1-nope' }),
      { ...q(), crosscheck: undefined },
      { ...q(), crosscheck: { sources: ['Maglaya ch 10', 'DOH'], verdict: 'AGREE' } },
    ]), ctx);
    expect(codes(r, 0)).toContain('NOTE_MISSING');
    expect(codes(r, 1)).toContain('NOTE_UNKNOWN');
    expect(codes(r, 2)).toContain('CROSSCHECK_MISSING');
    expect(codes(r, 3)).toContain('CROSSCHECK_NO_LINK');
    expect(r.accepted).toHaveLength(0);
  });

  it('rejects duplicate ids, bad id format and near-duplicate stems', () => {
    const a = q();
    const dupId = { ...q(), item: { ...q().item, id: a.item.id } };
    const badId = q({ id: 'np1-9999' });
    const near = { ...q(), item: { ...a.item, id: 'np1-gx-8888' } };
    const r = validateQuestionPatch(patch([a, dupId, badId, near]), ctx);
    expect(codes(r, 0)).toEqual([]);
    expect(codes(r, 1)).toContain('ID_TAKEN');
    expect(codes(r, 2)).toContain('ID_FORMAT');
    expect(codes(r, 3)).toContain('NEAR_DUPLICATE');
  });

  it('limits select-all-that-apply to 1 in 10', () => {
    const sata = (k: number) => q({ type: 'sata', options: ['a one', 'b two', 'c three', 'd four', 'e five'], answer: [0, 1], optionRationales: ['r1 reason', 'r2 reason', 'r3 reason', 'r4 reason', 'r5 reason'], stem: `Select all that apply, set ${k} ${k * 31337}` });
    const r = validateQuestionPatch(patch([sata(1), sata(2), ...Array.from({ length: 8 }, () => q())]), ctx);
    expect(codes(r, 0)).not.toContain('SATA_BUDGET');
    expect(codes(r, 1)).toContain('SATA_BUDGET');
  });

  it('flags text that mentions a board exam, workbook or test bank', () => {
    const r = validateQuestionPatch(patch([q({ stem: 'From the workbook: which measure applies, copy 1?' })]), ctx);
    expect(codes(r)).toContain('COPY_SUSPECT');
  });

  it('warns on a DOUBT crosscheck but still accepts', () => {
    const r = validateQuestionPatch(patch([{ ...q(), crosscheck: { ...cc, verdict: 'DOUBT', doubts: ['incubation range differs'] } }]), ctx);
    expect(codes(r)).toEqual([]);
    expect(r.results[0].warnings.map((w) => w.code)).toContain('CROSSCHECK_DOUBT');
  });

  it('never throws on junk', () => {
    for (const j of [null, 5, {}, { questions: [null, 3, {}] }]) expect(() => validateQuestionPatch(j, ctx)).not.toThrow();
    expect(validateQuestionPatch({ questions: [null, 3, {}] }, ctx).accepted).toHaveLength(0);
  });
});

describe('checkQuestionReply', () => {
  it('reads the json block out of a chat reply', () => {
    const reply = `Here you go\n\`\`\`json\n${JSON.stringify(patch([q()]))}\n\`\`\`\nThanks`;
    const r = checkQuestionReply(reply, ctx);
    expect(r.accepted).toHaveLength(1);
    expect(checkQuestionReply('no json here', ctx).errors.length).toBeGreaterThan(0);
  });
});
