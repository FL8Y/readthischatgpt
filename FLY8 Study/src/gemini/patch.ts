// Pure logic for merging Gemini-produced note patches into data/presets/np*.json (no react-native imports).
// The implementation lives in scripts/gemini/*.mjs so the CLI (`npm run gemini:apply`) and the tests run
// exactly the same code; this file is the typed entry point for TypeScript.
export { extractPatch, validatePatch, applyPatch, REQUIRED_SECTIONS } from '../../scripts/gemini/patchCore.mjs';
export { renderReceipt } from '../../scripts/gemini/receipt.mjs';
export type {
  ExtractResult, Issue, Note, OpResult, Packs, Patch, PatchOp, ValidateOptions, ValidationResult,
} from '../../scripts/gemini/patchCore.mjs';
