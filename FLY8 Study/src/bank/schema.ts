/** BankItem v2: the single question format for the MCQ bank (MASTER_PLAN section 4.1). Pure types and constants. */
export type Area = 'NP1' | 'NP2' | 'NP3' | 'NP4' | 'NP5' | 'GEN';
export type ItemType = 'single' | 'sata' | 'matrix' | 'cloze' | 'highlight';
export type ItemFormat = 'standard' | 'except' | 'statement' | 'sequence' | 'calc';
export type ItemSource = 'gold' | 'bank' | 'user-ai' | 'user-paste';
export type ReviewLevel = 'unreviewed' | 'ai-checked' | 'owner-checked' | 'nurse-checked';
export type Bloom = 'recall' | 'apply' | 'judgment';
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface ClozeBlank {
  choices: string[];
  answer: number;
}

/** Optional picture hint for a later image pass. Never rendered by the app today. */
export interface ImageSuggestion {
  description: string;
  placement: string;
  searchTerms: string[];
}

export interface BankItem {
  id: string;
  v: 2;
  type: ItemType;
  format?: ItemFormat;
  area: Area;
  topic: string;
  topicId?: string;
  noteId?: string;
  clusterId?: string;
  clusterSeq?: number;
  vignette: string;
  stem: string;
  /** single 4; sata 5-8; highlight = selectable segments. Empty for matrix and cloze. */
  options: string[];
  /** single [i]; sata/highlight correct indexes. Empty for matrix and cloze. */
  answer: number[];
  rows?: string[];
  columns?: string[];
  rowAnswer?: number[];
  blanks?: ClozeBlank[];
  rationale: string;
  /** Optional plain-language version of the rationale (1-2 short sentences). */
  rationaleSimple?: string;
  optionRationales: string[];
  imageSuggestion?: ImageSuggestion;
  strategy: string;
  archetype?: string;
  difficulty: Difficulty;
  bloom?: Bloom;
  keyFacts?: string[];
  beyondNotes?: boolean;
  source: ItemSource;
  review: ReviewLevel;
  aiWritten: boolean;
  flags?: string[];
}

export const ITEM_TYPES: readonly ItemType[] = ['single', 'sata', 'matrix', 'cloze', 'highlight'];
export const AREAS: readonly Area[] = ['NP1', 'NP2', 'NP3', 'NP4', 'NP5', 'GEN'];
export const FORMATS: readonly ItemFormat[] = ['standard', 'except', 'statement', 'sequence', 'calc'];
export const SOURCES: readonly ItemSource[] = ['gold', 'bank', 'user-ai', 'user-paste'];
export const REVIEW_LEVELS: readonly ReviewLevel[] = ['unreviewed', 'ai-checked', 'owner-checked', 'nurse-checked'];

export const SINGLE_OPTION_COUNT = 4;
export const SATA_MIN_OPTIONS = 5;
export const SATA_MAX_OPTIONS = 8;
export const SATA_MIN_ANSWERS = 2;
export const MATRIX_MIN_ROWS = 2;
export const MATRIX_MIN_COLUMNS = 2;
export const MATRIX_MAX_COLUMNS = 5;
export const CLOZE_MIN_CHOICES = 2;
export const HIGHLIGHT_MIN_OPTIONS = 2;
export const MIN_RATIONALE_CHARS = 40;
export const MAX_OPTION_LENGTH_RATIO = 3;
export const LONGEST_CORRECT_MAX_SHARE = 0.5;
export const KEY_SHARE_MIN = 0.15;
export const KEY_SHARE_MAX = 0.35;
export const KEY_SPREAD_MIN_ITEMS = 20;
export const NEAR_DUPLICATE_JACCARD = 0.6;

export function isItemType(x: unknown): x is ItemType {
  return typeof x === 'string' && (ITEM_TYPES as readonly string[]).includes(x);
}
export function isArea(x: unknown): x is Area {
  return typeof x === 'string' && (AREAS as readonly string[]).includes(x);
}
export function isFormat(x: unknown): x is ItemFormat {
  return typeof x === 'string' && (FORMATS as readonly string[]).includes(x);
}
export function isSource(x: unknown): x is ItemSource {
  return typeof x === 'string' && (SOURCES as readonly string[]).includes(x);
}
export function isReviewLevel(x: unknown): x is ReviewLevel {
  return typeof x === 'string' && (REVIEW_LEVELS as readonly string[]).includes(x);
}
export function isDifficulty(x: unknown): x is Difficulty {
  return x === 1 || x === 2 || x === 3 || x === 4 || x === 5;
}

export const isSingle = (i: BankItem): boolean => i.type === 'single';
export const isSata = (i: BankItem): boolean => i.type === 'sata';
export const isMatrix = (i: BankItem): boolean => i.type === 'matrix';
export const isCloze = (i: BankItem): boolean => i.type === 'cloze';
export const isHighlight = (i: BankItem): boolean => i.type === 'highlight';
/** Types that are only allowed inside case sets (MASTER_PLAN 4.2). */
export const isCaseOnlyType = (t: ItemType): boolean => t === 'matrix' || t === 'cloze' || t === 'highlight';
