import { extractJson } from '../core/provenance';
import type { ModelRequest } from './provider';

/**
 * Manual copy-paste AI mode. The app composes ONE prompt, the owner pastes it into the ChatGPT or Claude
 * app, then pastes the reply back. Pure helpers plus a tiny handler registry (set by ManualHost).
 * No network code lives here.
 */

export type ManualExpect = 'json' | 'markdown' | 'text';

export type ManualOptions = {
  /** Short label shown in the UI, e.g. "Diagnostic quiz - Part 2 of 4". */
  purpose?: string;
  expect?: ManualExpect;
  /** Extra instruction about parts, e.g. "Part 2 of 4: write exactly 10 questions." */
  partsHint?: string;
  /** Lets the host drop a waiting exchange when the caller gives up. */
  signal?: AbortSignal;
};

export type ManualHandler = (req: ModelRequest, opts?: ManualOptions) => Promise<string>;

/** Thrown by the host when the owner closes the exchange. provider.ts maps it to ProviderError('cancelled'). */
export class ManualCancelled extends Error {
  constructor() {
    super('Cancelled.');
  }
}

let handler: ManualHandler | null = null;
export function setManualHandler(fn: ManualHandler | null): void {
  handler = fn;
}
export function getManualHandler(): ManualHandler | null {
  return handler;
}

const FORMAT: Record<ManualExpect, string> = {
  json: 'Reply with ONLY one ```json fenced code block of valid JSON (double quotes, no trailing commas, no comments). Nothing before or after it.',
  markdown: 'Reply with ONLY the Markdown text: no greeting, no surrounding code fence, no closing remarks.',
  text: 'Reply with ONLY the requested text: no greeting, no closing remarks.',
};

/**
 * Merges req.system and req.user into one chat message with ROLE AND RULES / TASK / OUTPUT FORMAT sections.
 * The original texts are included verbatim. Stable export: also used by the Prompt Maker.
 */
export function composeManualPrompt(req: ModelRequest, opts: ManualOptions = {}): string {
  const expect = opts.expect ?? 'text';
  const fmt = [
    FORMAT[expect],
    'Produce exactly the number of items the task asks for, no extras.',
    opts.partsHint ? opts.partsHint : '',
    'If you run out of room, stop at a complete item; I will type "continue".',
  ].filter(Boolean);
  return [
    '=== ROLE AND RULES ===',
    req.system.trim(),
    '',
    '=== TASK ===',
    req.user.trim(),
    '',
    '=== OUTPUT FORMAT ===',
    ...fmt,
  ].join('\n');
}

export type ManualValidation = { ok: boolean; text: string; hint?: string };

const CUT_OFF_HINT = "The reply looks cut off. In the chat app type 'continue', then add the next part here.";

/** Finds the JSON body the way extractJson does (fenced block first), returning the text from the first bracket. */
function jsonBody(raw: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)(?:```|$)/.exec(raw);
  const body = fenced && /[[{]/.test(fenced[1]) ? fenced[1] : raw;
  const start = body.search(/[[{]/);
  return start < 0 ? null : body.slice(start);
}

/** True when brackets opened outside strings are never closed (reply cut off mid-JSON). */
export function looksCutOff(body: string): boolean {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (const ch of body) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
  }
  return depth > 0 || inStr;
}

/**
 * Checks a pasted reply. json: ok only when extractJson can parse it; `text` is then the JSON itself
 * (chatter and the fence removed, content untouched). markdown/text: ok when non-empty, trimmed.
 */
export function validateManualReply(raw: string, expect: ManualExpect = 'text'): ManualValidation {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, text: '', hint: 'Nothing pasted yet. Paste the chat reply in the box.' };
  if (expect !== 'json') return { ok: true, text: trimmed };
  const parsed = extractJson(trimmed);
  const body = jsonBody(trimmed);
  if (parsed !== null && body !== null) {
    const end = body.lastIndexOf(body[0] === '[' ? ']' : '}');
    return { ok: true, text: body.slice(0, end + 1) };
  }
  if (body !== null && looksCutOff(body)) return { ok: false, text: trimmed, hint: CUT_OFF_HINT };
  return {
    ok: false,
    text: trimmed,
    hint: 'I cannot find valid JSON in this reply. Ask the chat to "reply again with only the JSON code block", then paste it here.',
  };
}

/**
 * Joins pasted parts. json: parts are glued directly (a continuation resumes mid-text), dropping the
 * code-fence lines at the joins. Other kinds: separated by a blank line.
 */
export function joinManualParts(parts: string[], expect: ManualExpect): string {
  const kept = parts.map((p) => p.trim()).filter(Boolean);
  if (expect !== 'json') return kept.join('\n\n');
  return kept
    .map((p, i) => {
      let t = p;
      if (i > 0) t = t.replace(/^```(?:json)?[ \t]*\n?/, '');
      if (i < kept.length - 1) t = t.replace(/\n?```[ \t]*$/, '');
      return t;
    })
    .join('');
}
