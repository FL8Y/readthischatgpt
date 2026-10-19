import archetypesJson from '../../data/pnle/archetypes.json';
import goldJson from '../../data/pnle/gold.json';
import type { PnleItem } from './types';

interface WorkedExample {
  vignette: string;
  options: string[];
  answerIndex: number;
  rationalePerOption: string[];
  strategyUsed: string;
}

interface Archetype {
  id: string;
  name: string;
  stemSignals: string[];
  whatItTests: string;
  decisionSteps: string[];
  strategyTag: string;
  pnleAreas: string[];
  difficultyRange: [number, number];
  workedExample: WorkedExample;
}

const isStr = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '';

/**
 * Turns one archetype worked example into an exemplar item. The archetype files keep the question line
 * inside "vignette", so `stem` is empty here. Returns null when the example is malformed.
 */
export function archetypeToItem(a: Archetype): PnleItem | null {
  const w = a?.workedExample;
  if (!w || !isStr(w.vignette) || !Array.isArray(w.options) || w.options.length !== 4 || !w.options.every(isStr)) return null;
  if (!Number.isInteger(w.answerIndex) || w.answerIndex < 0 || w.answerIndex > 3) return null;
  if (!Array.isArray(w.rationalePerOption) || w.rationalePerOption.length !== 4 || !w.rationalePerOption.every(isStr)) return null;
  const [lo, hi] = a.difficultyRange ?? [2, 3];
  return {
    id: `arch-${a.id}`,
    area: a.pnleAreas?.[0] ?? 'any',
    topic: a.name,
    archetype: a.id,
    difficulty: Math.round((lo + hi) / 2),
    vignette: w.vignette,
    stem: '',
    options: w.options,
    answerIndex: w.answerIndex,
    strategyTag: a.strategyTag || w.strategyUsed,
    reasoning: (a.decisionSteps ?? []).join(' '),
    optionRationales: w.rationalePerOption,
    keyFacts: [a.whatItTests, ...(a.stemSignals ?? [])].filter(isStr),
    aiWritten: true,
    nurseReviewed: false,
  };
}

/** Light shape check for gold items so one bad row cannot break the prompt. */
export function isPnleItem(x: any): x is PnleItem {
  return (
    !!x &&
    isStr(x.id) &&
    isStr(x.vignette) &&
    Array.isArray(x.options) &&
    x.options.length === 4 &&
    x.options.every(isStr) &&
    Number.isInteger(x.answerIndex) &&
    x.answerIndex >= 0 &&
    x.answerIndex < 4 &&
    Array.isArray(x.optionRationales) &&
    x.optionRationales.length === 4 &&
    typeof x.archetype === 'string' &&
    typeof x.area === 'string' &&
    typeof x.topic === 'string' &&
    typeof x.stem === 'string' &&
    typeof x.strategyTag === 'string' &&
    typeof x.reasoning === 'string' &&
    Number.isFinite(x.difficulty) &&
    Array.isArray(x.keyFacts)
  );
}

/** Builds a bank: valid gold items first, then archetype worked examples as a fallback. Ids stay unique. */
export function buildBank(gold: unknown, archetypes: unknown): PnleItem[] {
  const out: PnleItem[] = [];
  const seen = new Set<string>();
  const push = (it: PnleItem) => {
    if (seen.has(it.id)) return;
    seen.add(it.id);
    out.push(it);
  };
  if (Array.isArray(gold)) for (const g of gold) if (isPnleItem(g)) push(g);
  const list = (archetypes as { archetypes?: Archetype[] } | null)?.archetypes;
  if (Array.isArray(list)) {
    for (const a of list) {
      const it = archetypeToItem(a);
      if (it) push(it);
    }
  }
  return out;
}

/** The built-in exemplar bank. Works even while gold.json is empty. */
export const PNLE_BANK: PnleItem[] = buildBank(goldJson, archetypesJson);
