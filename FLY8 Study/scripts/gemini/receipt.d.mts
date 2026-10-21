import type { Issue, ValidationResult } from './patchCore.mjs';
export function renderReceipt(
  v: ValidationResult,
  opts?: { dryRun?: boolean; extractWarnings?: Issue[]; extractErrors?: Issue[] },
): string;
