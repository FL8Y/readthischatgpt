export interface Issue { code: string; message: string; fix?: string }
export interface Note {
  id: string; area: string; title: string; body: string; tags: string[]; priority: string;
  outlineRefs: string[]; aiWritten: boolean; nurseReviewed: boolean; [extra: string]: unknown;
}
/** File path such as "data/presets/np1-comm.json" -> notes in that file. */
export type Packs = Record<string, Note[]>;
export interface Crosscheck { sources: string[]; verdict: 'AGREE' | 'FIXED' | 'DOUBT'; doubts?: string[] }
export interface PatchOp { op: 'update' | 'add'; id: string; note: Note; crosscheck?: Crosscheck }
export interface Patch { task?: string; target?: string; batch?: number; ops?: PatchOp[]; [extra: string]: unknown }
export interface OpResult {
  index: number; op: string; id: string; title: string; status: 'ok' | 'rejected';
  errors: Issue[]; warnings: Issue[]; links: string[];
}
export interface ValidationResult {
  task: string; target: string; batch: number | null; errors: Issue[]; warnings: Issue[];
  ops: OpResult[]; applied: number; rejected: number;
}
export interface ValidateOptions { reservedIds?: string[] }
export interface ExtractResult { patch: Patch | null; warnings: Issue[]; errors: Issue[]; blocks: number }
export function extractPatch(text: string): ExtractResult;
export function validatePatch(patch: unknown, packs: Packs, opts?: ValidateOptions): ValidationResult;
export function applyPatch(packs: Packs, patch: unknown, opts?: ValidateOptions): Packs;
export const REQUIRED_SECTIONS: string[];
export const REQUIRED_DRUG: string[];
