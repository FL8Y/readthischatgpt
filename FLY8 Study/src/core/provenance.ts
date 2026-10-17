import type { Chunk, Quality } from './types';

/**
 * Heuristic readability check for imported text (OCR output, bad PDFs, pasted junk).
 * It cannot prove content is correct; it only flags text that is probably unreadable.
 */
export function assessTextQuality(text: string): Quality {
  const flags: string[] = [];
  const trimmed = text.trim();
  if (trimmed.length < 40) {
    return { score: 0, flags: ['too-short'] };
  }
  const chars = [...trimmed];
  const letters = chars.filter((c) => /\p{L}/u.test(c)).length;
  const spaces = chars.filter((c) => /\s/.test(c)).length;
  const control = chars.filter((c) => /[\u0000-\u0008\u000e-\u001f�]/.test(c)).length;
  const letterRatio = letters / chars.length;
  const words = trimmed.split(/\s+/);
  const avgWord = words.reduce((n, w) => n + w.length, 0) / words.length;
  const vowelWords = words.filter((w) => /[aeiouy]/i.test(w)).length / words.length;
  const longRuns = /(.)\1{5,}/.test(trimmed);

  let score = 1;
  if (letterRatio < 0.5) {
    flags.push('low-letter-ratio');
    score -= 0.35;
  }
  if (control / chars.length > 0.01) {
    flags.push('control-characters');
    score -= 0.3;
  }
  if (avgWord > 14 || spaces / chars.length < 0.08) {
    flags.push('words-run-together');
    score -= 0.2;
  }
  if (vowelWords < 0.6) {
    flags.push('garbled-words');
    score -= 0.3;
  }
  if (longRuns) {
    flags.push('repeated-characters');
    score -= 0.15;
  }
  return { score: Math.max(0, Math.min(1, Number(score.toFixed(2)))), flags };
}

export const NEEDS_REVIEW_BELOW = 0.7;

/** Splits text into paragraph-aware chunks, each keeping its location in the source. */
export function chunkText(text: string, sourceId: string, maxChars = 800): Chunk[] {
  const chunks: Chunk[] = [];
  const paras = text.split(/\n{2,}/);
  let offset = 0;
  let buf = '';
  let bufStart = 0;
  const flush = () => {
    const t = buf.trim();
    if (t) {
      chunks.push({
        id: `${sourceId}#${chunks.length}`,
        sourceId,
        text: t,
        loc: `chars ${bufStart}-${bufStart + buf.length}`,
      });
    }
    buf = '';
  };
  for (const p of paras) {
    const start = text.indexOf(p, offset);
    offset = start + p.length;
    if (buf && buf.length + p.length + 2 > maxChars) flush();
    if (!buf) bufStart = start;
    buf = buf ? `${buf}\n\n${p}` : p;
    while (buf.length > maxChars * 1.5) {
      const cut = buf.lastIndexOf('. ', maxChars) + 1 || maxChars;
      const head = buf.slice(0, cut);
      const rest = buf.slice(cut);
      buf = head;
      flush();
      bufStart += head.length;
      buf = rest.trimStart();
    }
  }
  flush();
  return chunks;
}

export interface VerificationResult {
  legit: boolean;
  issues: string[];
  suggestedOrigin?: string;
}

/** Prompt asking the model to sanity-check notes. The answer is advice, not proof. */
export function verificationPrompt(chunkTexts: string[]): { system: string; user: string } {
  return {
    system:
      'You check nursing study notes for accuracy. Each doubtful or self-contradicting claim is one "issues" entry: quote it, say why ' +
      '(wrong, unsafe, outdated, ambiguous) and the correction, or "verify" if unsure. ' +
      '"suggestedOrigin": a general textbook or guideline family the material resembles, else null; never an edition, page, quote, link or invented citation. ' +
      'Reply with JSON only: {"legit":boolean,"issues":string[],"suggestedOrigin":string|null}.',
    user: chunkTexts.map((t, i) => `[${i + 1}] ${t}`).join('\n\n'),
  };
}

/**
 * Keeps a suggested origin only if it is a plain family name. Anything with a URL, page number,
 * DOI or ISBN is dropped, because the model cannot know those and must never invent them.
 */
export function sanitizeOrigin(origin: unknown): string | undefined {
  if (typeof origin !== 'string') return undefined;
  const t = origin.trim().replace(/\s+/g, ' ');
  if (!t || t.length > 120) return undefined;
  if (/https?:\/\/|www\.|\bdoi\b|10\.\d{4,}\/|\bisbn\b|\b(?:pp?|pages?)\.?\s*\d/i.test(t)) return undefined;
  if (/^(null|none|unknown|n\/a)$/i.test(t)) return undefined;
  return t;
}

export function parseVerification(raw: string): VerificationResult | null {
  const json = extractJson(raw);
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  if (typeof o.legit !== 'boolean' || !Array.isArray(o.issues)) return null;
  return {
    legit: o.legit,
    issues: o.issues.filter((x): x is string => typeof x === 'string'),
    suggestedOrigin: sanitizeOrigin(o.suggestedOrigin),
  };
}

export function extractJson(raw: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  const body = fenced ? fenced[1] : raw;
  const start = body.search(/[[{]/);
  if (start < 0) return null;
  try {
    return JSON.parse(body.slice(start, body.lastIndexOf(body[start] === '[' ? ']' : '}') + 1));
  } catch {
    return null;
  }
}
