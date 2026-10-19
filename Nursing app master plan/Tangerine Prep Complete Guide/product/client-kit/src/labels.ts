/** Score labels and buckets (thresholds observed in the reference app; wording here is original). */
export function readiness(score: number): { label: string; tone: "green" | "amber" | "red" } {
  if (score >= 85) return { label: "Board-ready momentum", tone: "green" };
  if (score >= 75) return { label: "Almost there", tone: "green" };
  if (score >= 60) return { label: "Needs reinforcement", tone: "amber" };
  return { label: "Recovery mode", tone: "red" };
}
export function caseReadiness(score: number) {
  return score >= 80 ? "Strong on this case" : score >= 60 ? "Needs another pass" : "Worth revisiting";
}
/** Difficulty label from the expected percent correct for a learner. */
export function difficultyLabel(pctCorrect: number) {
  return pctCorrect <= 40 ? "Likely very hard" : pctCorrect <= 60 ? "Likely hard" : pctCorrect <= 80 ? "Balanced challenge" : "Likely easy";
}
export type DiagnosticLevel = "starting" | "building" | "solid" | "strong";
/** Diagnostic accuracy buckets at 40 / 60 / 80 percent (cut-offs observed; level names are ours). */
export function diagnosticLevel(accuracyPct: number): DiagnosticLevel {
  return accuracyPct < 40 ? "starting" : accuracyPct < 60 ? "building" : accuracyPct < 80 ? "solid" : "strong";
}
export type Bloom = "remembering" | "understanding" | "applying" | "analyzing" | "evaluating" | "creating";
/** Six Bloom levels fold into three buckets: recall, apply, judgment. */
export const bloomBucket = (b: Bloom): "recall" | "apply" | "judgment" =>
  b === "remembering" || b === "understanding" ? "recall" : b === "applying" || b === "analyzing" ? "apply" : "judgment";

/** A forecast is only shown with enough evidence (at least 5 answered items; at least 3 per subject). */
export const hasEnoughEvidence = (count: number) => count >= 5;
export const subjectHasEvidence = (count: number) => count >= 3;

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365] as const;
export const streakVariant = (days: number): "started" | "milestone" | "extended" =>
  days <= 1 ? "started" : (STREAK_MILESTONES as readonly number[]).includes(days) ? "milestone" : "extended";
