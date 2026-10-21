import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => undefined } }));

import { PNLE_SYSTEM_PROMPT } from '../src/pnle/systemPrompt';
import { END_MARK, CONTINUE_MARK, topicBuilderPrompt } from '../src/pnle/topicBuilder';
import { diagnosticRequest, learnerProfile, lessonRequest, popQuizRequest } from '../src/ai/prompts';
import { explainRequest, mixedModuleQuizRequest, mixedPopQuizRequest, moduleQuizRequest, remediationRequest } from '../src/ai/quizPrompts';
import { tutorRequest } from '../src/tutor/prompt';
import { lessonPrompt } from '../src/lesson/lesson';
import { composeManualPrompt } from '../src/ai/manual';
import { verificationPrompt } from '../src/core/provenance';
import { pnleModuleQuizRequest, pnlePopQuizRequest } from '../src/pnle/requests';
import { buildUnifiedPrompt } from '../src/pnle/unifiedPrompt';
import { BATCH_WORD_CAP, DEFAULT_MIX, planBatches } from '../src/pnle/generator';
import { BANK } from '../src/bank/loader';
import type { AppState, Question, Topic } from '../src/core/types';

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

const topic: Topic = { id: 't1', folderId: 'f', title: 'Heart failure', body: '', sourceIds: [] };
const st: AppState = {
  folders: [{ id: 'f', name: 'NP' }],
  topics: [topic],
  sources: [],
  chunks: [],
  events: [],
  diagnosticsDone: [],
  settings: { provider: 'manual', apiKey: '', model: '' },
};
const weakItem = { topicId: 't1', title: 'Heart failure', reason: 'weak', mastery: 0.2, confidence: 0.5, attempts: 3, priority: 1 };
const bp = [{ topicId: 't1', title: 'Heart failure', count: 2 }];
const q = { id: 'q', topicId: 't1', stem: 's', choices: ['a', 'b', 'c', 'd'], answerIndex: 0, rationale: 'r' } as unknown as Question;
const now = 0;

/**
 * Word budgets = the word counts BEFORE the "deeper, not longer" rewrite (2026-10-17), measured on this
 * exact fixture (one untested topic with an empty body, no deck outline, no worked examples). A prompt may
 * get richer but never longer than its budget. Lower a budget only when a prompt is shortened on purpose.
 */
const BUDGET: Record<string, [number, () => string]> = {
  pnleSystem: [2710, () => PNLE_SYSTEM_PROMPT],
  topicBuilder: [768, () => topicBuilderPrompt({ topic: 'X', referenceOutline: [] })],
  learnerProfile: [48, () => learnerProfile(st, now)],
  diagnosticSys: [80, () => diagnosticRequest(st, 'f', 5, now).system],
  diagnosticUser: [18, () => diagnosticRequest(st, 'f', 5, now).user],
  popSys: [70, () => popQuizRequest(st, topic, 3, now).system],
  lessonRequestUser: [28, () => lessonRequest(st, topic, now).user],
  moduleSys: [89, () => moduleQuizRequest(st, [topic], bp, now).system],
  moduleUser: [28, () => moduleQuizRequest(st, [topic], bp, now).user],
  fixTopicsUser: [79, () => remediationRequest(st, [weakItem], [topic], now).user],
  mixedPopSys: [188, () => mixedPopQuizRequest(st, topic, 3, now).system],
  mixedModuleSys: [209, () => mixedModuleQuizRequest(st, [topic], bp, now).system],
  explainSys: [98, () => explainRequest(st, q, 'x', false, now).system],
  tutorSysTopic: [159, () => tutorRequest(st, topic, [], 'why?', now).system],
  tutorSysNoTopic: [122, () => tutorRequest(st, undefined, [], 'why?', now).system],
  lessonSys: [149, () => lessonPrompt(st, topic, now).system],
  manualJson: [76, () => composeManualPrompt({ system: '', user: '' }, { expect: 'json' })],
  manualMarkdown: [62, () => composeManualPrompt({ system: '', user: '' }, { expect: 'markdown' })],
  verificationSys: [62, () => verificationPrompt(['x']).system],
  pnlePopSys: [2758, () => pnlePopQuizRequest(st, topic, 3, now, []).system],
  pnleModuleSys: [2916, () => pnleModuleQuizRequest(st, [topic], bp, now, []).system],
  // Unified question-maker prompt (W4-E), measured 2026-10-19: single 1461, case-set 1619 system words.
  unifiedSingleSys: [1560, () => buildUnifiedPrompt({ shape: 'single', count: 5 }).system],
  unifiedCaseSetSys: [1720, () => buildUnifiedPrompt({ shape: 'case-set', count: 4 }).system],
  unifiedUser: [60, () => buildUnifiedPrompt({ shape: 'single', count: 5 }).user],
};

describe('prompt word budgets (deeper, not longer)', () => {
  for (const [name, [budget, build]] of Object.entries(BUDGET)) {
    it(`${name} stays within ${budget} words`, () => {
      expect(words(build())).toBeLessThanOrEqual(budget);
    });
  }
  it('the PNLE system prompt is meaningfully shorter than before (at least 15%)', () => {
    expect(words(PNLE_SYSTEM_PROMPT)).toBeLessThanOrEqual(Math.floor(2710 * 0.85));
  });
});

describe('unified prompt vs the old PNLE prompt', () => {
  it('no shape is more than 15% longer than the old PNLE system prompt (it is shorter)', () => {
    const old = words(PNLE_SYSTEM_PROMPT);
    for (const shape of ['single', 'sata', 'statement', 'except', 'sequence', 'calc', 'case-set'] as const) {
      expect(words(buildUnifiedPrompt({ shape, count: 4 }).system)).toBeLessThanOrEqual(Math.floor(old * 1.15));
    }
  });
});

describe('key quality rules survive', () => {
  it('PNLE prompt: one decision, two steps, named distractor errors, causal chain, flip, calibration', () => {
    const p = PNLE_SYSTEM_PROMPT;
    expect(p).toMatch(/ONE DECISION POINT/);
    expect(p).toMatch(/TWO REASONING STEPS/);
    expect(p).toMatch(/DISTINCT, named error type/);
    for (const e of ['right action, wrong time', 'wrong client', 'treats the symptom, not the cause', 'over-intervention', 'delegation outside scope', 'skips assessment', 'unsafe but common habit']) {
      expect(p).toContain(e);
    }
    expect(p).toMatch(/causal chain/);
    expect(p).toMatch(/Flip: if/);
    expect(p).toMatch(/only memorised the note/);
    expect(p).toMatch(/ERROR TYPE/);
    expect(p).toMatch(/Beyond your notes — check your textbook/);
  });
  it('PNLE prompt ends with the output schema (format last)', () => {
    expect(PNLE_SYSTEM_PROMPT.lastIndexOf('OUTPUT SCHEMA')).toBeGreaterThan(PNLE_SYSTEM_PROMPT.lastIndexOf('SAFETY AND HONESTY RULES'));
    expect(PNLE_SYSTEM_PROMPT.trimEnd().endsWith('discarded by the app.')).toBe(true);
  });
  it('plain quiz prompts carry the compact craft: one decision, named errors, flip', () => {
    for (const s of [popQuizRequest(st, topic, 3, now).system, moduleQuizRequest(st, [topic], bp, now).system, diagnosticRequest(st, 'f', 3, now).system, mixedPopQuizRequest(st, topic, 3, now).system]) {
      expect(s).toMatch(/ONE decision per item/);
      expect(s).toMatch(/distinct named error/);
      expect(s).toMatch(/Flip: if/);
    }
  });
  it('tutor: diagnose first, mechanism, contrast pair, notes labels, uncertainty, one transfer question', () => {
    const s = tutorRequest(st, topic, [], 'why?', now).system;
    expect(s).toMatch(/Vague question: ask/);
    expect(s).toMatch(/likely misconception/);
    expect(s).toMatch(/mechanism/);
    expect(s).toMatch(/contrast pair/);
    expect(s).toMatch(/Admit uncertainty/);
    expect(s).toMatch(/ONE short transfer question/);
    expect(s.lastIndexOf('transfer question')).toBeGreaterThan(s.indexOf('From your notes:'));
  });
  it('lesson and fix-topic prompts teach mechanism, then decision rule, then trap, testable facts only', () => {
    const l = lessonPrompt(st, topic, now).system;
    expect(l).toMatch(/mechanism[\s\S]*decision rule[\s\S]*exam trap/);
    expect(l).toMatch(/Keep a fact only if an exam question could test it/);
    expect(l).toContain('AI-added, check against your textbook:');
    const f = remediationRequest(st, [weakItem], [topic], now).user;
    expect(f).toMatch(/mechanism[\s\S]*decision rule[\s\S]*exam trap/);
    expect(f).toContain('"# Title"');
  });
  it('topic builder keeps its parser markers and teaches mechanism first', () => {
    const p = topicBuilderPrompt({ topic: 'Heart failure', referenceOutline: [] });
    for (const m of [END_MARK, CONTINUE_MARK, 'COVERAGE MAP', '## Mechanism (why)', '## Decision rule', '## Priority nursing actions', '## Check against your textbook', 'exactly ONE "# " heading line']) {
      expect(p).toContain(m);
    }
    expect(p.lastIndexOf('OUTPUT FORMAT')).toBeGreaterThan(p.lastIndexOf('RULES FOR ACCURACY'));
  });
  it('explain prompt names the cue, the rule, the error type and a flip', () => {
    const s = explainRequest(st, q, 'x', false, now).system;
    expect(s).toMatch(/error type/);
    expect(s).toMatch(/flip/);
  });
});

describe('multi-topic generator batches (app-aware prompts)', () => {
  const names = [...new Set(BANK.items.map((i) => i.topic))].slice(0, 10);
  const body = `## Key facts\n${'fact words here '.repeat(400)}\n\n## Check against your textbook\n- note`;
  const topics = names.map((name) => ({ name, body, noteId: name, count: 7 }));
  it(`every batch prompt, wrapper included, stays within ${BATCH_WORD_CAP} words`, () => {
    const batches = planBatches({ topics, mix: DEFAULT_MIX, difficulty: 'mixed', existing: BANK.items, weakness: 'priority; delegation' });
    expect(batches.length).toBeGreaterThan(5);
    for (const b of batches) {
      expect(words(b.text)).toBeLessThanOrEqual(BATCH_WORD_CAP);
      expect(b.count).toBeLessThanOrEqual(10);
    }
  });
  it('a single small batch is well inside the cap and numbered', () => {
    const [b] = planBatches({ topics: topics.slice(0, 1), mix: DEFAULT_MIX, difficulty: 3, existing: BANK.items });
    expect(b.text).toContain('Batch 1 of 1');
    expect(b.words).toBeLessThan(BATCH_WORD_CAP);
  });
});
