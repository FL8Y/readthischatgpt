import { describe, expect, it } from 'vitest';
import { extractItems, mapRawItem, parseBank, stripTrailingCommas } from '../src/pnle/parseBank';
import { validateItem } from '../src/bank/validate';
import type { BankItem } from '../src/bank/schema';

const RAT = 'You notice the cue, the principle behind it decides the priority, and it beats the runner-up. Flip: if the client were stable, then assessment becomes correct.';
const OR4 = ['Right action, wrong time: tempting but too early.', 'Skips assessment: fails here.', 'Correct. The cue points to this first.', 'Over-intervention: too invasive for now.'];

const SCEN: [string, string][] = [
  ['Client A is 60 years old and short of breath after a fall on the ward, with oxygen saturation dropping slowly.', 'Which action should the nurse take first?'],
  ['A postpartum mother reports heavy bleeding and dizziness two hours after a home delivery in a barangay.', 'What is the priority nursing action now?'],
  ['A school nurse finds a child with an itchy rash after lunch and swelling of the lips beginning to appear.', 'What should the nurse do immediately?'],
  ['A man on the surgical ward has a blood pressure falling steadily and cold clammy skin after an operation.', 'Which finding needs the most urgent follow-up?'],
  ['A client with schizophrenia tells the nurse that voices are ordering him to leave the unit tonight.', 'Which response is most therapeutic?'],
  ['An older woman with diabetes arrives at the health center sweating, shaky and confused at midday.', 'What is the best initial action?'],
];
const single = (n: number, extra: Record<string, unknown> = {}) => ({
  id: '', v: 2, type: 'single', area: 'NP3', topic: 'Oxygenation',
  vignette: SCEN[n % 6][0], stem: SCEN[n % 6][1],
  options: ['Raise the head of the bed and check airway', 'Teach the family about breathing exercises', 'Document the finding in the chart', 'Call the dietitian about a meal plan'],
  answer: [0], rationale: RAT, optionRationales: ['Correct. Airway first.', 'Right action, wrong time: teaching comes later.', 'Skips assessment: charting is not first.', 'Treats the symptom, not the cause: unrelated.'],
  strategy: 'ABC: airway first', difficulty: 3, bloom: 'judgment', keyFacts: ['Airway before breathing'], beyondNotes: false, ...extra,
});
const sata = {
  type: 'sata', area: 'NP1', topic: 'Infection control', vignette: 'A nurse in a rural health unit reviews measures for a child with suspected measles.',
  stem: 'Which measures apply? Select all that apply.',
  options: ['Airborne precautions', 'Hand hygiene before and after contact', 'Share a room with an unvaccinated child', 'Mask the visitor who is unvaccinated', 'Wear gloves only when touching the rash'],
  answer: [0, 1, 3], rationale: RAT, optionRationales: ['Correct. Route is airborne.', 'Correct. Standard precaution.', 'Unsafe but common habit: exposes others.', 'Correct. Protects the visitor.', 'Partly true with one wrong detail: gloves alone are not enough.'],
  strategy: 'Infection control: by route', difficulty: 3, bloom: 'apply', keyFacts: ['Measles is airborne'],
};
const statement = single(7, {
  format: 'statement', stem: 'Statement I: Insulin lowers blood glucose. Statement II: Hypoglycemia causes dry flushed skin.',
  options: ['Both statements are true', 'Only Statement I is true', 'Only Statement II is true', 'Neither statement is true'], answer: [1],
  optionRationales: ['Right priority, wrong problem: II is false.', 'Correct. I true, II false.', 'Partly true with one wrong detail: reversed.', 'Treats the symptom, not the cause: I is true.'],
});
const except = single(8, {
  format: 'except', stem: 'All of the following are appropriate for a client with a new tracheostomy EXCEPT:',
  options: ['Keep a spare tube at the bedside', 'Suction only when secretions are present', 'Leave the cuff overinflated at all times', 'Provide humidified oxygen'], answer: [2],
});
const sequence = single(9, {
  format: 'sequence', stem: 'Put the actions in the correct order for a client who collapses on the ward.',
  options: ['1) Check response 2) Call for help 3) Start compressions 4) Apply the AED', '1) Apply the AED 2) Check response 3) Call for help 4) Start compressions', '1) Start compressions 2) Check response 3) Apply the AED 4) Call for help', '1) Call for help 2) Apply the AED 3) Check response 4) Start compressions'], answer: [0],
});
const calc = single(10, {
  format: 'calc', vignette: 'A client has an order for 500 mL over 4 hours.', stem: 'What is the rate in mL per hour?',
  options: ['125 mL/hr', '100 mL/hr', '250 mL/hr', '150 mL/hr'], answer: [0],
  rationale: 'You divide 500 mL by 4 hours to get 125 mL per hour. Flip: if the time were longer, then a lower rate becomes correct.',
});
const caseSet = [
  { ...single(1), vignette: 'Mrs. Reyes, 55, has crushing chest pain and sweating in the emergency room.', clusterId: 'A', clusterSeq: 1, stem: 'Which action comes first?' },
  { ...sata, vignette: 'Mrs. Reyes, 55, has crushing chest pain and sweating in the emergency room.', clusterId: 'A', clusterSeq: 2, stem: 'Which findings need follow-up? Select all that apply.' },
  {
    type: 'matrix', area: 'NP3', topic: 'Cardiac', vignette: 'Mrs. Reyes, 55, has crushing chest pain and sweating in the emergency room.', clusterId: 'A', stem: 'Mark each order.',
    rows: ['Oxygen if saturation is low', 'Hot meal', 'Cardiac monitor'], columns: ['Indicated', 'Not indicated'], rowAnswer: [0, 1, 0], options: [], answer: [],
    rationale: RAT, optionRationales: ['Indicated: low oxygen is treated.', 'Not indicated: not a priority.', 'Indicated: rhythm watch.'], strategy: 'Maslow: physiological first', difficulty: 3,
  },
  {
    type: 'cloze', area: 'NP3', topic: 'Cardiac', vignette: 'Mrs. Reyes, 55, has crushing chest pain and sweating in the emergency room.', clusterId: 'A', stem: 'The nurse expects ____ and should place the client on ____.',
    blanks: [{ choices: ['pain', 'itching'], answer: 0 }, { choices: ['a monitor', 'a puzzle'], answer: 0 }], options: [], answer: [],
    rationale: RAT, optionRationales: ['Pain is expected.', 'Monitor is needed.'], strategy: 'Assess before intervening', difficulty: 2,
  },
  {
    type: 'highlight', area: 'NP3', topic: 'Cardiac', vignette: 'Mrs. Reyes, 55, has crushing chest pain and sweating in the emergency room.', clusterId: 'A', stem: 'Select the findings that suggest a cardiac cause.',
    options: ['Crushing chest pain', 'Sweating', 'Slept well last night', 'Likes tea'], answer: [0, 1],
    rationale: RAT, optionRationales: ['Cardiac sign.', 'Cardiac sign.', 'Not relevant.', 'Not relevant.'], strategy: 'Recognise cues', difficulty: 3,
  },
];

const wrap = (items: unknown[]) => JSON.stringify({ items });

describe('extractItems', () => {
  it('reads a wrapping object, a bare array, a fenced block and chatter', () => {
    expect(extractItems(wrap([single(1)]))?.list.length).toBe(1);
    expect(extractItems(JSON.stringify([single(1), single(2)]))?.list.length).toBe(2);
    expect(extractItems('Sure! Here you go:\n```json\n' + wrap([single(1)]) + '\n```\nHope it helps.')?.list.length).toBe(1);
    expect(extractItems('Here: ' + JSON.stringify(single(1)) + ' done')?.list.length).toBe(1);
  });
  it('tolerates trailing commas and smart quotes', () => {
    expect(stripTrailingCommas('{"a":[1,2,],}')).toBe('{"a":[1,2]}');
    expect(stripTrailingCommas('{"a":"x,]"}')).toBe('{"a":"x,]"}');
    const messy = wrap([single(1)]).replace(']}', ',]},');
    expect(extractItems(messy)?.list.length).toBe(1);
  });
  it('keeps complete items of a cut-off reply', () => {
    const full = wrap([single(1), single(2), single(3)]);
    const cut = full.slice(0, full.lastIndexOf('{"id"') + 40);
    const r = extractItems(cut);
    expect(r?.list.length).toBe(2);
    expect(r?.cutOff).toBe(true);
  });
  it('returns null when there is no JSON', () => {
    expect(extractItems('I cannot help with that.')).toBeNull();
    expect(extractItems('')).toBeNull();
  });
});

describe('parseBank: one fixture per shape', () => {
  const cases: [string, unknown[], number][] = [
    ['single', [single(1), single(2, { answer: [2], options: ['Call the dietitian about a meal plan', 'Teach the family about breathing exercises', 'Raise the head of the bed and check airway', 'Document the finding in the chart'] })], 2],
    ['sata', [sata], 1],
    ['statement', [statement], 1],
    ['except', [except], 1],
    ['sequence', [sequence], 1],
    ['calc', [calc], 1],
    ['case-set', caseSet, 5],
  ];
  for (const [name, items, n] of cases) {
    it(`${name}: good reply parses to valid v2 items`, () => {
      const r = parseBank(wrap(items));
      expect(r.rejected).toEqual([]);
      expect(r.valid.length).toBe(n);
      for (const it of r.valid) {
        expect(it.v).toBe(2);
        expect(it.id).toMatch(/^u-[0-9a-f]{8}$/);
        expect(it.source).toBe('user-paste');
        expect(it.review).toBe('unreviewed');
        expect(it.aiWritten).toBe(true);
        expect(validateItem(it).ok).toBe(true);
      }
    });
    it(`${name}: messy reply (fence, chatter, trailing commas) still parses`, () => {
      const text = `Sure, here are the questions!\n\n\`\`\`json\n${wrap(items).replace(/}\]}$/, '},]},')}\n\`\`\`\n\nLet me know if you want more.`;
      const r = parseBank(text, { source: 'user-ai' });
      expect(r.valid.length).toBe(n);
      expect(r.valid.every((i) => i.source === 'user-ai')).toBe(true);
    });
  }

  it('case set: items share one clusterId and are numbered', () => {
    const r = parseBank(wrap(caseSet));
    const ids = new Set(r.valid.map((i) => i.clusterId));
    expect(ids.size).toBe(1);
    expect([...ids][0]).toMatch(/^uc-[0-9a-f]{8}$/);
    expect(r.valid.map((i) => i.clusterSeq)).toEqual([1, 2, 3, 4, 5]);
    expect(r.valid.map((i) => i.type)).toEqual(['single', 'sata', 'matrix', 'cloze', 'highlight']);
  });
  it('format tags survive on single items only', () => {
    const r = parseBank(wrap([statement, except, sequence, calc]));
    expect(r.valid.map((i) => i.format)).toEqual(['statement', 'except', 'sequence', 'calc']);
  });
});

describe('parseBank: partially invalid replies', () => {
  it('rejects bad items with reasons and keeps the good ones', () => {
    const bad1 = single(3, { options: ['only', 'two'], answer: [5] });
    const bad2 = single(4, { rationale: 'too short' });
    const bad3 = single(5, { optionRationales: ['one'] });
    const bad4 = single(6, { options: ['All of the above', 'x is true here', 'y is true here', 'z is true here'] });
    const r = parseBank(wrap([single(1), bad1, bad2, bad3, bad4, 'junk', null]));
    expect(r.valid.length).toBe(1);
    expect(r.rejected.map((x) => x.index)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.rejected[0].errors.join(' ')).toMatch(/4 options|out of range/);
    expect(r.rejected[1].errors.join(' ')).toMatch(/rationale shorter/);
    expect(r.rejected[2].errors.join(' ')).toMatch(/optionRationales/);
    expect(r.rejected[3].errors.join(' ')).toMatch(/banned/);
    expect(r.rejected[4].errors).toContain('not a question object');
  });
  it('calc item with a number missing from the stem is rejected', () => {
    const bad = { ...calc, rationale: 'You divide 600 mL by 4 hours to get 150 mL per hour. Flip: if the order changed, then another option wins.' };
    const r = parseBank(wrap([bad]));
    expect(r.valid.length).toBe(0);
    expect(r.rejected[0].errors.join(' ')).toMatch(/calc rationale uses numbers/);
  });
  it('wrong matrix and cloze shapes are rejected', () => {
    const m = { ...caseSet[2], rowAnswer: [0, 1] };
    const c = { ...caseSet[3], blanks: [{ choices: ['only one'], answer: 0 }] };
    const r = parseBank(wrap([m, c]));
    expect(r.valid.length).toBe(0);
    expect(r.rejected.length).toBe(2);
  });
  it('never throws on garbage', () => {
    for (const g of ['', '{', '[[[', '```', 'null', '{"items":5}', '{"items":[{"stem":1}]}', undefined as unknown as string]) {
      expect(() => parseBank(g)).not.toThrow();
    }
    const r = parseBank('no json at all');
    expect(r.valid).toEqual([]);
    expect(r.notes[0]).toMatch(/No JSON/);
  });
  it('reports a cut-off reply', () => {
    const full = wrap([single(1), single(2), single(3)]);
    const r = parseBank(full.slice(0, full.lastIndexOf('{"id"') + 30));
    expect(r.valid.length).toBe(2);
    expect(r.notes.join(' ')).toMatch(/cut off/);
  });
});

describe('parseBank: duplicates and old key names', () => {
  it('rejects a near-duplicate of the existing bank and of an earlier item in the same reply', () => {
    const existing = parseBank(wrap([single(1)])).valid;
    const r = parseBank(wrap([single(1), single(0, { stem: 'Which action should the nurse take first, right now?' }), single(1)]), { existing });
    expect(r.valid.length).toBe(1);
    expect(r.rejected.some((x) => /already in your bank/.test(x.errors.join(' ')))).toBe(true);
    const r2 = parseBank(wrap([single(1), single(1)]));
    expect(r2.valid.length).toBe(1);
    expect(r2.rejected[0].errors.join(' ')).toMatch(/earlier in this reply/);
  });
  it('maps the older choices/answerIndex keys and "any" area', () => {
    const old = { topic: 'T', vignette: '', stem: 'Which is first?', choices: ['Assess the client', 'Call the doctor', 'Document it', 'Teach the family'], answerIndex: 0, rationale: RAT, optionRationales: OR4, strategy: 'Assess before intervening', area: 'any', difficulty: 9 };
    const it = mapRawItem(old, 'user-paste', { difficulty: 2 });
    expect(it?.options.length).toBe(4);
    expect(it?.answer).toEqual([0]);
    expect(it?.area).toBe('GEN');
    expect(it?.difficulty).toBe(2);
    expect(validateItem(it as BankItem).ok).toBe(true);
  });
  it('accepts letter answers', () => {
    const it = mapRawItem({ ...single(1), answer: 'C' }, 'user-paste', {});
    expect(it?.answer).toEqual([2]);
    const s = mapRawItem({ ...sata, answer: 'A, B, D' }, 'user-paste', {});
    expect(s?.answer).toEqual([0, 1, 3]);
  });
  it('uses defaults for missing area and topic', () => {
    const { area: _a, topic: _t, ...rest } = single(1);
    const r = parseBank(wrap([rest]), { defaults: { area: 'NP4', topic: 'Diabetes', noteId: 'np4-dm' } });
    expect(r.valid[0].area).toBe('NP4');
    expect(r.valid[0].topic).toBe('Diabetes');
    expect(r.valid[0].noteId).toBe('np4-dm');
  });
});
