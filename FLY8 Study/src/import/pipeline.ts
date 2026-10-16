import type { Chunk, Quality, Verification } from '../core/types';
import { assessTextQuality, chunkText, NEEDS_REVIEW_BELOW } from '../core/provenance';
import { ProviderError } from '../ai/provider';
import { ImportError } from './types';

export interface PreparedNote {
  quality: Quality;
  verification: Verification;
  chunks: Chunk[];
}

/** Scores and chunks transcribed Markdown. A truncated or low-quality transcript needs review. */
export function prepareImportedNote(markdown: string, sourceId: string, truncated = false): PreparedNote {
  const quality = assessTextQuality(markdown);
  const flags = truncated ? [...quality.flags, 'possibly-truncated'] : quality.flags;
  const poor = truncated || quality.score < NEEDS_REVIEW_BELOW;
  return {
    quality: { score: quality.score, flags },
    verification: poor ? 'needs-review' : 'unverified',
    chunks: chunkText(markdown, sourceId),
  };
}

/** Plain-language message for any import failure. Never includes the key. */
export function describeImportError(e: unknown): string {
  if (e instanceof ImportError) return e.message;
  if (e instanceof ProviderError) {
    switch (e.kind) {
      case 'auth':
        return e.message.startsWith('Add your') ? e.message : 'Your API key was rejected. Check it in Settings.';
      case 'rate-limit':
        return 'The AI is rate limiting you. Wait a minute and try again.';
      case 'network':
        return 'You seem to be offline, or the AI could not be reached. Check your connection and try again.';
      default:
        return e.message;
    }
  }
  return 'Import failed. Try again, or paste the text instead.';
}

/** Title from a file name: drop the extension, tidy separators. */
export function titleFromFileName(name: string): string {
  const t = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return t || 'Imported note';
}
