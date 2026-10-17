import type { AppState, Topic } from '../core/types';
import type { ModelRequest } from '../ai/provider';
import { learnerProfile } from '../ai/prompts';
import { relatedOutline } from '../pnle/referenceOutline';

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
}

export const MAX_HISTORY_MESSAGES = 8;
export const MAX_MESSAGE_CHARS = 1500;
export const MAX_QUESTION_CHARS = 2000;
export const MAX_NOTES_CHARS = 4000;

export const NOTES_LABEL = 'From your notes:';
export const BEYOND_LABEL = 'Beyond your notes (check your textbook):';

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Newest messages only, each clipped, so the prompt stays bounded however long the chat gets. */
export function capHistory(history: TutorMessage[]): TutorMessage[] {
  return history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({ ...m, text: clip(m.text, MAX_MESSAGE_CHARS) }));
}

/**
 * Builds the tutor prompt. With a topic, the learner's own notes are put first and the model is told
 * to separate what comes from them from anything it adds.
 */
/** Optional pointer to related headings in the learner's own review deck (headings only). */
function deckHint(title: string): string[] {
  const hits = relatedOutline(title, undefined, 6);
  return hits.length
    ? [`The learner's review deck groups this near: ${hits.join('; ')}. You may suggest one to review next; quote no deck.`]
    : [];
}

export function tutorRequest(
  state: AppState,
  topic: Topic | undefined,
  history: TutorMessage[],
  question: string,
  now: number,
): ModelRequest {
  const rules = [
    'Tutoring chat. Be brief. Rules:',
    '1. Vague question: ask what the learner thinks or which part is unclear, then stop. Otherwise name the likely misconception.',
    '2. Explain the mechanism (why). For look-alikes give a contrast pair.',
    `3. Start with "${NOTES_LABEL}" using only the learner's notes${topic ? '' : ' (none were chosen, so say so and skip it)'}. Anything else goes under "${BEYOND_LABEL}"; never blend.`,
    '4. Admit uncertainty. A diagram may be one ```svg or ```mermaid block.',
    '5. End with ONE short transfer question: same reasoning, new scenario.',
    ...(topic ? deckHint(topic.title) : []),
  ].join('\n');
  const notes = topic
    ? `Learner's notes for "${topic.title}":\n${clip(topic.body, MAX_NOTES_CHARS) || '(this topic has no notes yet)'}`
    : 'No topic selected.';
  const turns = capHistory(history)
    .map((m) => `${m.role === 'user' ? 'Learner' : 'Tutor'}: ${m.text}`)
    .join('\n');
  return {
    system: `${learnerProfile(state, now)}\n${rules}`,
    user: [notes, turns ? `Conversation so far:\n${turns}` : '', `Learner's question:\n${clip(question, MAX_QUESTION_CHARS)}`]
      .filter(Boolean)
      .join('\n\n'),
  };
}

export interface ReplyPart {
  kind: 'text' | 'diagram';
  /** For diagrams: 'svg' | 'mermaid'. Another team owns rendering, so these are shown as captioned code. */
  lang?: 'svg' | 'mermaid';
  text: string;
}

/** Splits a reply into text and ```svg / ```mermaid blocks. Other fences stay in the text. */
export function splitReply(reply: string): ReplyPart[] {
  const parts: ReplyPart[] = [];
  const re = /```(svg|mermaid)[^\n]*\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(reply))) {
    if (m.index > last) parts.push({ kind: 'text', text: reply.slice(last, m.index) });
    parts.push({ kind: 'diagram', lang: m[1] as 'svg' | 'mermaid', text: m[2].trim() });
    last = m.index + m[0].length;
  }
  if (last < reply.length) parts.push({ kind: 'text', text: reply.slice(last) });
  return parts.filter((p) => p.text.trim());
}

/** The user message still waiting for an answer (last message is the user's), if any. Used by Retry. */
export function unansweredQuestion(messages: TutorMessage[]): TutorMessage | undefined {
  const last = messages[messages.length - 1];
  return last?.role === 'user' ? last : undefined;
}

/** Appends a user message unless that id is already present (so a retry never duplicates it). */
export function appendOnce(messages: TutorMessage[], m: TutorMessage): TutorMessage[] {
  return messages.some((x) => x.id === m.id) ? messages : [...messages, m];
}
