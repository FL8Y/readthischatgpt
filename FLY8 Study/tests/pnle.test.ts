import { describe, expect, it } from 'vitest';
import { PNLE_SECTIONS, PNLE_SYSTEM_PROMPT, PNLE_PROMPT_WORDS } from '../src/pnle/systemPrompt';
import { PNLE_BANK, archetypeToItem, buildBank } from '../src/pnle/bank';
import { formatExemplars, pickExemplars } from '../src/pnle/retriever';
import { pnleDiagnosticRequest, pnleModuleQuizRequest, pnlePopQuizRequest } from '../src/pnle/requests';
import { parsePnleModuleQuestions } from '../src/pnle/parse';
import { parseMixedQuestions, parseQuestionItem } from '../src/core/questionParse';
import { parseQuestions, parseTopicQuestions } from '../src/ai/provider';
import type { PnleItem } from '../src/pnle/types';
import type { AppState, Topic } from '../src/core/types';

const topic = (id: string, title: string, body = ''): Topic => ({ id, folderId: 'f', title, body, sourceIds: [] });
const state = (topics: Topic[]): AppState => ({
  folders: [{ id: 'f', name: 'NP' }],
  topics,
  sources: [],
  chunks: [],
  events: [],
  diagnosticsDone: [],
  settings: { provider: 'openai', apiKey: 'sk-secret', model: '' },
});

const item = (o: Partial<PnleItem> & { id: string }): PnleItem => ({
  area: 'NP3',
  topic: 'oxygenation',
  archetype: 'abc-ordering',
  difficulty: 2,
  vignette: 'A client has noisy breathing.',
  stem: 'Which action is first?',
  options: ['a', 'b', 'c', 'd'],
  answerIndex: 1,
  strategyTag: 'ABC: airway first',
  reasoning: 'Airway first.',
  optionRationales: ['ra', 'rb', 'rc', 'rd'],
  keyFacts: ['airway'],
  aiWritten: true,
  nurseReviewed: false,
  ...o,
});

const pnleQ = (o: Record<string, unknown> = {}) => ({
  topic: 'Oxygenation',
  vignette: 'A 60-year-old client has gurgling breaths.',
  stem: 'Which action should the nurse take first?',
  choices: ['one', 'two', 'three', 'four'],
  answerIndex: 2,
  rationale: 'Airway comes first.',
  optionRationales: ['no1', 'no2', 'Correct. yes', 'no4'],
  strategy: 'ABC: airway first',
  area: 'NP3',
  archetype: 'abc-ordering',
  difficulty: 2,
  ...o,
});

describe('PNLE system prompt', () => {
  it('has every required section heading', () => {
    for (const h of [
      'ROLE AND TONE',
      'PNLE STRUCTURE',
      'ITEM ANATOMY',
      'THE REASONING HIERARCHY',
      'DISTRACTOR DESIGN',
      'RATIONALE FORMAT',
      'DIFFICULTY CALIBRATION',
      'VARIETY RULES',
      'SAFETY AND HONESTY RULES',
      'OUTPUT SCHEMA',
    ]) {
      expect(PNLE_SYSTEM_PROMPT).toContain(h);
    }
    expect(PNLE_SECTIONS.join('\n\n')).toBe(PNLE_SYSTEM_PROMPT);
  });

  it('names all five areas and says they come from search summaries', () => {
    for (const a of ['NP1', 'NP2', 'NP3', 'NP4', 'NP5', 'Community Health Nursing', 'search summaries']) expect(PNLE_SYSTEM_PROMPT).toContain(a);
  });

  it('carries the key rules: four options, notes first, no invented doses, unsure, textbook marker', () => {
    expect(PNLE_SYSTEM_PROMPT).toContain('Exactly four');
    expect(PNLE_SYSTEM_PROMPT).toContain('all of the above');
    expect(PNLE_SYSTEM_PROMPT).toContain('NOTES FIRST');
    expect(PNLE_SYSTEM_PROMPT).toMatch(/NEVER invent drug doses/);
    expect(PNLE_SYSTEM_PROMPT).toContain('Beyond your notes — check your textbook');
    expect(PNLE_SYSTEM_PROMPT).toContain('NO PATIENT-SPECIFIC MEDICAL ADVICE');
    expect(PNLE_SYSTEM_PROMPT).toContain('UNSURE');
    for (const k of ['Maslow', 'ABC', 'Delegation', 'Therapeutic communication', 'Infection control', 'Least invasive']) expect(PNLE_SYSTEM_PROMPT).toContain(k);
  });

  it('states the exact JSON schema', () => {
    expect(PNLE_SYSTEM_PROMPT).toContain(
      '{"questions":[{"topic":string,"vignette":string,"stem":string,"choices":string[4],"answerIndex":number,"rationale":string,"optionRationales":string[4],"strategy":string,"area":string,"archetype":string,"difficulty":number}]}',
    );
  });

  it('stays inside the word budget (1,500-2,300 words; shortened on purpose, see promptBudget.test.ts)', () => {
    expect(PNLE_PROMPT_WORDS).toBeGreaterThanOrEqual(1500);
    expect(PNLE_PROMPT_WORDS).toBeLessThanOrEqual(2300);
  });
});

describe('bank', () => {
  it('converts every archetype worked example and works while gold is empty', () => {
    expect(PNLE_BANK.length).toBeGreaterThanOrEqual(31);
    for (const it of PNLE_BANK) {
      expect(it.options).toHaveLength(4);
      expect(it.optionRationales).toHaveLength(4);
      expect(it.aiWritten).toBe(true);
      expect(it.nurseReviewed).toBe(false);
    }
    expect(new Set(PNLE_BANK.map((i) => i.id)).size).toBe(PNLE_BANK.length);
  });

  it('puts valid gold first, skips bad rows and duplicate ids', () => {
    const gold = [item({ id: 'g1' }), { id: 'bad' }, item({ id: 'g1' })];
    const bank = buildBank(gold, { archetypes: [] });
    expect(bank.map((b) => b.id)).toEqual(['g1']);
  });

  it('rejects malformed worked examples', () => {
    expect(archetypeToItem({ id: 'x', workedExample: { vignette: 'v', options: ['a'], answerIndex: 0 } } as any)).toBeNull();
  });
});

describe('retriever', () => {
  const bank: PnleItem[] = [
    item({ id: 'a1', archetype: 'abc', topic: 'airway oxygenation', area: 'NP3', keyFacts: ['airway', 'oxygen'] }),
    item({ id: 'a2', archetype: 'abc', topic: 'airway oxygenation', area: 'NP3', keyFacts: ['airway', 'oxygen'] }),
    item({ id: 'b1', archetype: 'maslow', topic: 'priority needs', area: 'any', keyFacts: ['physiological'] }),
    item({ id: 'c1', archetype: 'maternal', topic: 'postpartum bleeding', area: 'NP2', keyFacts: ['uterus', 'fundus'] }),
    item({ id: 'd1', archetype: 'community', topic: 'immunization program', area: 'NP1', keyFacts: ['vaccine'] }),
    item({ id: 'e1', archetype: 'psych', topic: 'suicide risk', area: 'NP5', keyFacts: ['crisis'] }),
  ];
  const q = { topicTitle: 'Postpartum hemorrhage', bodyText: 'Check the fundus and uterus for bleeding after delivery.' };

  it('is deterministic', () => {
    expect(pickExemplars(q, bank).map((i) => i.id)).toEqual(pickExemplars(q, bank).map((i) => i.id));
    expect(pickExemplars(q, [...bank].reverse()).map((i) => i.id)).toEqual(pickExemplars(q, bank).map((i) => i.id));
  });

  it('ranks keyword matches first and honours area', () => {
    expect(pickExemplars(q, bank)[0].id).toBe('c1');
    expect(pickExemplars({ topicTitle: 'x', bodyText: '', area: 'NP1' }, bank)[0].id).toBe('d1');
  });

  it('prefers archetype diversity over duplicate archetypes', () => {
    const ids = pickExemplars({ topicTitle: 'airway oxygenation', bodyText: 'airway oxygen', count: 3 }, bank).map((i) => i.id);
    expect(ids.filter((i) => i.startsWith('a'))).toHaveLength(1);
    expect(new Set(pickExemplars({ topicTitle: 'airway', bodyText: '', count: 5 }, bank).map((i) => i.archetype)).size).toBe(5);
  });

  it('breaks ties by id and respects difficulty closeness', () => {
    const tied = [item({ id: 'z', archetype: 'q1' }), item({ id: 'm', archetype: 'q2' }), item({ id: 'a', archetype: 'q3' })];
    expect(pickExemplars({ topicTitle: 'none', bodyText: '' }, tied).map((i) => i.id)).toEqual(['a', 'm', 'z']);
    const diff = [item({ id: 'd1', difficulty: 1, archetype: 'k1' }), item({ id: 'd5', difficulty: 5, archetype: 'k2' }), item({ id: 'd3', difficulty: 3, archetype: 'k3' })];
    expect(pickExemplars({ topicTitle: 'none', bodyText: '', difficulty: 5, count: 3 }, diff)[0].id).toBe('d5');
  });

  it('clamps count to 3..5 and to the bank size; empty bank gives []', () => {
    expect(pickExemplars({ ...q, count: 1 }, bank)).toHaveLength(3);
    expect(pickExemplars({ ...q, count: 99 }, bank)).toHaveLength(5);
    expect(pickExemplars(q, bank.slice(0, 2))).toHaveLength(2);
    expect(pickExemplars(q, [])).toEqual([]);
    expect(formatExemplars([])).toBe('');
  });

  it('works on the real bank (archetype fallback)', () => {
    const got = pickExemplars({ topicTitle: 'Delegation', bodyText: 'delegate a nursing assistant routine care stable client' }, PNLE_BANK);
    expect(got.length).toBeGreaterThanOrEqual(3);
    expect(got.some((i) => i.archetype.includes('delegation'))).toBe(true);
  });

  it('formatExemplars output is stable and complete', () => {
    const out = formatExemplars([item({ id: 'x' })]);
    expect(out).toBe(
      [
        'Worked example 1 (NP3, difficulty 2, archetype abc-ordering)',
        'Vignette: A client has noisy breathing.',
        'Stem: Which action is first?',
        'A. a',
        'B. b',
        'C. c',
        'D. d',
        'Answer: B',
        'Strategy: ABC: airway first',
        'Reasoning: Airway first.',
        'Why each option:',
        'A. ra',
        'B. rb',
        'C. rc',
        'D. rd',
      ].join('\n'),
    );
    expect(formatExemplars([item({ id: 'x', stem: '' })])).not.toContain('Stem:');
  });
});

describe('parsers keep PNLE fields', () => {
  it('parseQuestionItem composes vignette + blank line + stem and keeps extras', () => {
    const q = parseQuestionItem(pnleQ(), 't', 'id')!;
    expect(q.stem).toBe('A 60-year-old client has gurgling breaths.\n\nWhich action should the nurse take first?');
    expect(q.vignette).toBe('A 60-year-old client has gurgling breaths.');
    expect(q.strategy).toBe('ABC: airway first');
    expect(q.area).toBe('NP3');
    expect(q.archetype).toBe('abc-ordering');
    expect(q.optionRationales).toHaveLength(4);
    expect(q.answerIndex).toBe(2);
  });

  it('old-format items are unchanged', () => {
    const old = { stem: 's', choices: ['a', 'b'], answerIndex: 1, rationale: 'r' };
    expect(parseQuestionItem(old, 't', 'x')).toEqual({ id: 'x', topicId: 't', ...old });
    expect(parseQuestions(JSON.stringify([old]), 't', 'p')[0]).toEqual({ id: 'p-0', topicId: 't', ...old });
  });

  it('drops PNLE items with no rationale for the correct answer', () => {
    expect(parseQuestionItem(pnleQ({ rationale: '  ', optionRationales: undefined }), 't', 'id')).toBeNull();
    expect(parseQuestionItem(pnleQ({ rationale: '', optionRationales: ['a', 'b', '', 'd'] }), 't', 'id')).toBeNull();
    expect(parseQuestions(JSON.stringify([pnleQ({ rationale: '', optionRationales: undefined })]), 't', 'p')).toEqual([]);
  });

  it('falls back to the correct option rationale and ignores a malformed optionRationales', () => {
    const q = parseQuestionItem(pnleQ({ rationale: '' }), 't', 'id')!;
    expect(q.rationale).toBe('Correct. yes');
    const bad = parseQuestionItem(pnleQ({ optionRationales: ['only one'] }), 't', 'id')!;
    expect(bad.optionRationales).toBeUndefined();
  });

  it('parseQuestions and parseTopicQuestions keep the fields', () => {
    const raw = JSON.stringify({ questions: [pnleQ()] });
    const a = parseQuestions(raw, 't', 'p')[0];
    expect(a.strategy).toBe('ABC: airway first');
    expect(a.stem).toContain('\n\n');
    const b = parseTopicQuestions(raw, [topic('t1', 'oxygenation')], 'dx');
    expect(b).toHaveLength(1);
    expect(b[0].topicId).toBe('t1');
    expect(b[0].optionRationales).toHaveLength(4);
    expect(b[0].area).toBe('NP3');
  });

  it('every kept generated question carries a rationale and a strategy', () => {
    const raw = JSON.stringify({ questions: [pnleQ(), pnleQ({ strategy: undefined, vignette: 'v2' })] });
    for (const q of parseMixedQuestions(raw, 't', 'p')) expect(q.rationale.trim()).not.toBe('');
    expect(parseMixedQuestions(raw, 't', 'p')[0].strategy).toBeTruthy();
  });

  it('other kinds ignore PNLE fields', () => {
    const q = parseQuestionItem({ kind: 'typing', stem: 's', accept: ['x'], rationale: 'r', strategy: 'z' }, 't', 'id')!;
    expect(q.kind).toBe('typing');
    expect(q.strategy).toBeUndefined();
  });

  it('module parse keeps PNLE fields and still checks every topic is covered', () => {
    const topics = [topic('a', 'Oxygenation'), topic('b', 'Delegation')];
    const list = Array.from({ length: 10 }, (_, i) => pnleQ({ topic: i % 2 ? 'Delegation' : 'Oxygenation', vignette: `case ${i}` }));
    const ok = parsePnleModuleQuestions({ questions: list }, topics, 'f', 'mod-1', 1);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.questions).toHaveLength(10);
      expect(ok.value.questions[3].topicId).toBe('b');
      expect(ok.value.questions[3].strategy).toBe('ABC: airway first');
      expect(ok.value.questions[3].stem.startsWith('case 3')).toBe(true);
      expect(ok.value.questions[3].id).toBe('mod-1-3');
    }
    const missing = parsePnleModuleQuestions({ questions: list.filter((q) => q.topic === 'Oxygenation') }, topics, 'f', 'm', 1);
    expect(missing.ok).toBe(false);
    const dropped = parsePnleModuleQuestions({ questions: [...list, pnleQ({ rationale: '', optionRationales: undefined })] }, topics, 'f', 'm', 1);
    expect(dropped.ok && dropped.value.questions.length).toBe(10);
  });
});

describe('request builders', () => {
  const topics = [topic('t1', 'Oxygenation', 'airway breathing oxygen saturation '.repeat(200)), topic('t2', 'Delegation', 'delegate to assistive personnel')];
  const st = state(topics);

  it('carry the PNLE prompt, profile, exemplars, notes and weak list; never the key', () => {
    const pop = pnlePopQuizRequest(st, topics[0], 3, 1);
    expect(pop.system).toContain(PNLE_SYSTEM_PROMPT);
    expect(pop.system).toContain('Philippine nursing licensure exam');
    expect(pop.user).toContain('Worked example 1');
    expect(pop.user).toContain('Write 3 PNLE quiz questions on "Oxygenation"');
    expect(pop.user).toContain('No weak topics identified yet.');
    expect(pop.user.length).toBeLessThan(2000 + 8000); // notes capped at 2000 characters
    expect(pop.system + pop.user).not.toContain('sk-secret');
    expect(pop.system).not.toContain('NCLEX-style');
  });

  it('pop quizzes under 6 items use choice only; larger ones may mix kinds', () => {
    expect(pnlePopQuizRequest(st, topics[0], 3, 1).system).not.toContain('"kind":"typing"');
    expect(pnlePopQuizRequest(st, topics[0], 6, 1).system).toContain('"kind":"typing"');
  });

  it('diagnostic uses choice items only and names the topics', () => {
    const r = pnleDiagnosticRequest(st, 'f', 5, 1);
    expect(r.system).not.toContain('"kind":"typing"');
    expect(r.user).toContain('## Oxygenation');
    expect(r.user).toContain('## Delegation');
    expect(r.user).toContain('copied exactly');
  });

  it('module request keeps the per-topic counts and allows other kinds', () => {
    const r = pnleModuleQuizRequest(st, topics, [{ topicId: 't1', title: 'Oxygenation', count: 6 }, { topicId: 't2', title: 'Delegation', count: 4 }], 1);
    expect(r.user).toContain('10-question PNLE module quiz');
    expect(r.user).toContain('## Oxygenation (6 questions)');
    expect(r.system).toContain('"kind":"ordering"');
    expect(r.system).toContain('85%');
  });

  it('works with an empty bank', () => {
    const r = pnlePopQuizRequest(st, topics[0], 2, 1, []);
    expect(r.user).not.toContain('WORKED EXAMPLES');
  });
});
