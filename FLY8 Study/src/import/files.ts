import type { ImageMediaType, ImportKind } from './types';
import { ImportError } from './types';

/** About 15 MB. Base64 adds a third, and providers cap request sizes, so keep it modest. */
export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

const IMAGE_TYPES: Record<string, ImageMediaType> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/gif': 'image/gif',
  'image/webp': 'image/webp',
};

const EXTENSIONS: Record<string, ImageMediaType | 'application/pdf'> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export interface PickedFile {
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

export interface Classified {
  kind: ImportKind;
  mediaType: ImageMediaType | 'application/pdf';
}

/** Decides if a picked file can be transcribed. Throws ImportError with a plain-language reason. */
export function classifyFile(file: PickedFile): Classified {
  const mime = (file.mimeType ?? '').toLowerCase();
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? '';
  const mediaType = mime === 'application/pdf' ? 'application/pdf' : (IMAGE_TYPES[mime] ?? EXTENSIONS[ext]);
  if (!mediaType) {
    throw new ImportError('That file type is not supported. Use a PDF, or a JPG, PNG, GIF or WebP photo.', 'unsupported');
  }
  if (typeof file.size === 'number' && file.size > MAX_IMPORT_BYTES) {
    throw new ImportError(tooLarge(file.size), 'too-large');
  }
  return { kind: mediaType === 'application/pdf' ? 'pdf' : 'image', mediaType };
}

/** Second size check on the actual base64 string, in case the picker did not report a size. */
export function assertBase64Size(base64: string): void {
  if (!base64) throw new ImportError('The file was empty.', 'empty');
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAX_IMPORT_BYTES) throw new ImportError(tooLarge(bytes), 'too-large');
}

function tooLarge(bytes: number): string {
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  return `That file is ${mb} MB. The limit is ${MAX_IMPORT_BYTES / (1024 * 1024)} MB. Split the PDF or use a smaller photo.`;
}
