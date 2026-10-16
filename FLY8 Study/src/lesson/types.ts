/** A saved lesson. Kept outside AppState so lessons stay readable offline under their own storage key. */
export interface Mnemonic {
  text: string;
  rationale: string;
}

export interface Diagram {
  kind: 'svg' | 'mermaid';
  code: string;
  caption: string;
}

export interface Lesson {
  topicId: string;
  /** Markdown; may contain [[wikilinks]]. */
  explanation: string;
  mnemonic?: Mnemonic;
  keyFacts: string[];
  examTraps: string[];
  /** Wikilink titles of related topics. */
  relatedTopics: string[];
  diagram?: Diagram;
  /** True when the lesson contains material the model added beyond the learner's notes. */
  aiAdded: boolean;
  generatedAt: number;
}

export const AI_ADDED_LABEL = 'AI-added, check against your textbook';
export const AI_DRAWN_LABEL = 'AI-drawn, check against your textbook';
