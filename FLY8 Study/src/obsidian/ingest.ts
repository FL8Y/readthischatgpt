import { strFromU8 } from 'fflate';
import { describeImportError } from '../import/pipeline';
import { parseCanvas } from './canvas';
import { isIgnoredPath, parseNote } from './parseNote';
import type { IngestResult, ParsedNote, VaultFile } from './types';
import { commonRoot, readVaultZip } from './zip';

const MAX_NOTES = 5000;

/** Turns picked files (.md, .canvas, .zip) into notes. Problems with one file become warnings. */
export function ingestFiles(files: VaultFile[]): IngestResult {
  const notes: ParsedNote[] = [];
  const warnings: string[] = [];
  const add = (path: string, text: string, root: string) => {
    if (isIgnoredPath(path)) return;
    try {
      if (/\.canvas$/i.test(path)) notes.push(...parseCanvas(text, path, root));
      else if (/\.(md|markdown)$/i.test(path)) notes.push(parseNote(path, text, root));
    } catch (e) {
      warnings.push(describeImportError(e));
    }
  };
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      if (!f.bytes) {
        warnings.push(`Could not read "${f.name}".`);
        continue;
      }
      try {
        const entries = readVaultZip(f.bytes).filter((e) => !isIgnoredPath(e.path));
        const root = commonRoot(entries.map((e) => e.path));
        for (const e of entries) add(e.path, e.text, root);
      } catch (e) {
        warnings.push(describeImportError(e));
      }
    } else if (/\.(md|markdown|canvas)$/i.test(f.name)) {
      const text = f.text ?? (f.bytes ? strFromU8(f.bytes) : undefined);
      if (text === undefined) warnings.push(`Could not read "${f.name}".`);
      else add(f.name, text, '');
    } else {
      warnings.push(`Skipped "${f.name}": only .md, .canvas and .zip files are imported.`);
    }
  }
  if (notes.length > MAX_NOTES) {
    warnings.push(`Only the first ${MAX_NOTES} notes were kept.`);
    notes.length = MAX_NOTES;
  }
  // Same path twice (two files picked with one name): keep the first.
  const seen = new Set<string>();
  const unique = notes.filter((n) => (seen.has(n.path) ? false : (seen.add(n.path), true)));
  return { notes: unique, warnings };
}
