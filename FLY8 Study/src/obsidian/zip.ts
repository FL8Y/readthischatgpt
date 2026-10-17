import { strFromU8, unzipSync } from 'fflate';
import { ImportError } from '../import/types';

export const MAX_ZIP_ENTRIES = 2000;
export const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024;
/** One note bigger than this is certainly not a note. */
export const MAX_ENTRY_BYTES = 10 * 1024 * 1024;

const WANTED = /\.(md|markdown|canvas)$/i;

export interface ZipEntry {
  path: string;
  text: string;
}

/** True for paths that could escape the vault folder. */
export function isUnsafePath(name: string): boolean {
  if (name.includes('\0') || name.includes('\\')) return true;
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return true;
  return name.split('/').some((seg) => seg === '..');
}

/**
 * Reads .md and .canvas files from a zipped vault. Caps: 2000 entries, 50 MB unzipped.
 * Images and other binaries are skipped. Any "../" or absolute path rejects the whole zip.
 * Sizes are checked from the zip headers before inflating, then re-checked on the real output.
 */
export function readVaultZip(bytes: Uint8Array): ZipEntry[] {
  let entries = 0;
  let declared = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter(f) {
        entries++;
        if (entries > MAX_ZIP_ENTRIES) {
          throw new ImportError(`That zip has more than ${MAX_ZIP_ENTRIES} files. Zip a smaller part of the vault.`, 'too-large');
        }
        if (isUnsafePath(f.name)) {
          throw new ImportError('That zip contains unsafe file paths (like "../"), so it was not opened.', 'unsupported');
        }
        if (f.name.endsWith('/') || !WANTED.test(f.name)) return false;
        if (f.originalSize > MAX_ENTRY_BYTES) {
          throw new ImportError(`"${f.name}" is too big to be a note.`, 'too-large');
        }
        declared += f.originalSize;
        if (declared > MAX_UNZIPPED_BYTES) {
          throw new ImportError('That zip is bigger than 50 MB once unzipped. Zip a smaller part of the vault.', 'too-large');
        }
        return true;
      },
    });
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError('Could not open that zip file. It may be damaged or password protected.', 'read');
  }
  const out: ZipEntry[] = [];
  let actual = 0;
  for (const [path, data] of Object.entries(files)) {
    actual += data.length;
    if (actual > MAX_UNZIPPED_BYTES) {
      throw new ImportError('That zip is bigger than 50 MB once unzipped. Zip a smaller part of the vault.', 'too-large');
    }
    out.push({ path, text: strFromU8(data) });
  }
  return out;
}

/** If every path shares one top-level folder (the vault root), returns "Root/". Else "". */
export function commonRoot(paths: string[]): string {
  if (!paths.length) return '';
  const first = paths[0].split('/');
  if (first.length < 2) return '';
  const root = `${first[0]}/`;
  return paths.every((p) => p.startsWith(root)) ? root : '';
}
