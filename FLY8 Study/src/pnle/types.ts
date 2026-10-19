/** One original PNLE-style practice item. Exemplars in the bank use this shape. */
export interface PnleItem {
  id: string;
  /** NP1..NP5, or 'any' for cross-cutting reasoning (fundamentals, delegation, communication). */
  area: string;
  topic: string;
  /** Archetype id from data/pnle/archetypes.json. */
  archetype: string;
  /** 1 (recall/apply) .. 5 (multi-step prioritization). */
  difficulty: number;
  vignette: string;
  /** One question line with a signal word. May be empty when the vignette already ends in the question. */
  stem: string;
  options: string[];
  answerIndex: number;
  strategyTag: string;
  reasoning: string;
  /** One explanation per option, same order as `options`. */
  optionRationales: string[];
  keyFacts: string[];
  /** True for every item written by a model. */
  aiWritten: boolean;
  /** True only after a licensed nurse has checked the item. */
  nurseReviewed: boolean;
}
