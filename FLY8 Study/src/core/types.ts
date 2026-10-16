export type ProviderName = 'openai' | 'anthropic';

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
  kind: 'file' | 'paste' | 'ai';
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

export interface Question {
  id: string;
  topicId: string;
  stem: string;
  choices: string[];
  answerIndex: number;
  rationale: string;
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
}

export interface Settings {
  provider: ProviderName;
  apiKey: string;
  model: string;
}

export interface AppState {
  folders: Folder[];
  topics: Topic[];
  sources: Source[];
  chunks: Chunk[];
  events: AttemptEvent[];
  /** Folder ids whose diagnostic has been completed. */
  diagnosticsDone: string[];
  settings: Settings;
}
