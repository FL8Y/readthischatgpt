import type { DxState } from '../bank/diagnosticRounds';
/** 'manual' = copy-paste with the ChatGPT or Claude app; no key, no model. */
export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'groq' | 'custom' | 'manual';

export type Verification = 'unverified' | 'needs-review' | 'ai-checked';

export interface Quality {
  /** 0 (unusable) .. 1 (clean text) */
  score: number;
  flags: string[];
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
}

export interface Source {
  id: string;
  title: string;
  kind: 'file' | 'paste' | 'ai' | 'preset';
  uri?: string;
  addedAt: number;
  quality: Quality;
  verification: Verification;
  /** Where the AI thinks the material comes from. Always a suggestion, never proof. */
  suggestedOrigin?: string;
  /** Problems the AI double-check flagged. Advice, not proof. */
  issues?: string[];
}

export interface Chunk {
  id: string;
  sourceId: string;
  text: string;
  /** Human-readable location, e.g. "chars 0-742". */
  loc: string;
}

export interface Topic {
  id: string;
  folderId: string;
  title: string;
  /** Markdown body; may contain [[wikilinks]] to other topics. */
  body: string;
  sourceIds: string[];
  /** Other names for this topic (e.g. from Obsidian frontmatter). Links and imports match on them. */
  aliases?: string[];
}

export type QuestionKind = 'choice' | 'typing' | 'cloze' | 'matching' | 'ordering';

export interface Question {
  id: string;
  topicId: string;
  stem: string;
  /** Choice questions only. Other kinds store [] here and 0 in answerIndex (kept for old readers). */
  choices: string[];
  answerIndex: number;
  rationale: string;
  /** Absent means 'choice', so old saved questions keep working. */
  kind?: QuestionKind;
  /** typing: every accepted answer (normalised comparison; pure numbers also get a small tolerance). */
  accept?: string[];
  /** cloze: stem holds "____" markers; blanks[i] lists the accepted answers for marker i. */
  blanks?: string[][];
  /** matching: canonical pairs. The UI shuffles the right-hand side; grading uses pair positions. */
  pairs?: { left: string; right: string }[];
  /** ordering: items in the CORRECT order. The UI shuffles them; grading uses canonical positions. */
  items?: string[];
  /**
   * PNLE-style extras (all optional; old saved questions have none). When the AI sent a vignette, the parser
   * composes `stem` as `vignette + blank line + stem`, so every consumer of `stem` already shows the full case.
   */
  vignette?: string;
  /** Reasoning strategy that decides the item, e.g. "Maslow: physiological first". Shown as a chip after answering. */
  strategy?: string;
  /** PNLE test area tag: NP1..NP5 or 'any'. */
  area?: string;
  /** Archetype id the item was written from. */
  archetype?: string;
  /** One explanation per choice (same order as `choices`), correct one included. */
  optionRationales?: string[];
  /** Longer "how to think about it" text, shown collapsed. */
  reasoning?: string;
}

export type AttemptKind = 'diagnostic' | 'pop' | 'module' | 'review';

export interface AttemptEvent {
  /** Unique id: replaying the same event never double counts. */
  id: string;
  questionId: string;
  topicId: string;
  correct: boolean;
  at: number;
  kind: AttemptKind;
  /** True when a hint was used before answering. Absent on old events (= not hinted). */
  hinted?: boolean;
  /** Partial credit 0..1 (bank practice). Absent on old events: use `correct`. */
  credit?: number;
  /** Chosen option/column/choice indexes (-1 = left blank). */
  selected?: number[];
  /** Seconds spent on the item. */
  seconds?: number;
  /** Practice session this attempt belongs to. */
  sessionId?: string;
  /** Session mode ('quick', 'mock', ...). */
  mode?: string;
}

/** One API provider in the owner's pool. Never exported in backups (apiKey is blanked). */
export interface PoolEntry {
  id: string;
  provider: Exclude<ProviderName, 'manual'>;
  apiKey: string;
  model: string;
  enabled: boolean;
  /** Only for provider 'custom': any OpenAI-compatible endpoint. */
  baseUrl?: string;
}

export type PoolMode = 'fallback' | 'spread';

export interface Settings {
  provider: ProviderName;
  apiKey: string;
  model: string;
  /** True once the owner picked how to use AI on the first screen (hides onboarding). */
  aiChosen?: boolean;
  /** Only for provider 'custom'. */
  baseUrl?: string;
  /** Ordered provider pool. Absent/empty = legacy single provider above. provider/apiKey/model then mirror the first entry. */
  pool?: PoolEntry[];
  poolMode?: PoolMode;
  /** When every pool entry fails, fall back to manual copy-paste. Default on (only used when a pool exists). */
  manualLastResort?: boolean;
}

export interface AppState {
  folders: Folder[];
  topics: Topic[];
  sources: Source[];
  chunks: Chunk[];
  events: AttemptEvent[];
  /** Folder ids whose diagnostic has been completed. */
  diagnosticsDone: string[];
  /** Optional 3-round diagnostic: saved rounds and the weakness profile they produced. */
  dx?: DxState;
  settings: Settings;
}
