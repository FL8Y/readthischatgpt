export interface WikiLink {
  /** Note title the link points at (no heading, no alias). */
  target: string;
  heading?: string;
  alias?: string;
}

/** One note read from a vault file or a canvas node. Pure data, no app state. */
export interface ParsedNote {
  /** Unique within an import. Canvas nodes use "file.canvas#nodeId". */
  path: string;
  title: string;
  aliases: string[];
  tags: string[];
  /** Markdown body without frontmatter and without ![[embeds]]. [[wikilinks]] are kept. */
  body: string;
  links: WikiLink[];
  /** Folder name derived from the vault directory path ("" for root-level files). */
  folder: string;
}

export interface Frontmatter {
  title?: string;
  aliases: string[];
  tags: string[];
}

export type Outcome = 'new' | 'merge' | 'identical' | 'conflict';

export interface PlanItem {
  /** Same as note.path. */
  id: string;
  note: ParsedNote;
  outcome: Outcome;
  /** Existing topic (or topic planned earlier in this batch) that this note merges into. */
  targetId?: string;
  targetTitle?: string;
  /** Paragraphs that would be appended (merge, or conflict into an existing twin). */
  addParagraphs: string[];
  /** Id the created topic gets (new / conflict). */
  newTopicId?: string;
  /** Title the created topic gets (conflict -> "Title (Obsidian)"). */
  newTitle?: string;
  folderName: string;
  reason: string;
  /** True when the match came from an AI suggestion the user accepted. */
  viaAi?: boolean;
}

export interface MergePlan {
  items: PlanItem[];
  counts: Record<Outcome, number>;
  /** Link targets that match no topic yet: candidates for new topics. */
  unresolved: { from: string; target: string }[];
}

export interface VaultFile {
  name: string;
  text?: string;
  bytes?: Uint8Array;
}

export interface IngestResult {
  notes: ParsedNote[];
  warnings: string[];
}
