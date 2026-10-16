import type { Source } from '../core/types';

export type ImportKind = 'pdf' | 'image';

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

/** A file ready to send to a vision-capable model. */
export interface VisionInput {
  kind: ImportKind;
  mediaType: ImageMediaType | 'application/pdf';
  /** Raw base64, no "data:" prefix. */
  base64: string;
}

export interface VisionResult {
  /** Clean Markdown transcription. */
  text: string;
  /** True when the model hit its output limit, so the transcription is probably cut short. */
  truncated: boolean;
}

export type ImportErrorKind = 'unsupported' | 'too-large' | 'read' | 'empty';

/** Local problems with the picked file (as opposed to ProviderError, which is the AI call). */
export class ImportError extends Error {
  constructor(
    message: string,
    readonly kind: ImportErrorKind,
  ) {
    super(message);
  }
}

/** Source plus the AI double-check's issue list. Kept here because core/types.ts is owned elsewhere. */
export type ReviewedSource = Source & {
  /** Problems the AI flagged. Advice only, never proof. */
  issues?: string[];
};

/** Shown next to every AI-suggested origin or issue list. */
export const UNVERIFIED_SUGGESTION = 'unverified suggestion';
