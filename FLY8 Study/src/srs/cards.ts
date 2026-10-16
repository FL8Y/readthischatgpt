import type { AppState, Topic } from '../core/types';
import type { ModelRequest } from '../ai/provider';
import { learnerProfile } from '../ai/prompts';
import { extractJson } from '../core/provenance';

export interface Card {
  id: string;
  topicId: string;
  front: string;
  back: string;
  sourceTopicTitle: string;
  dismissed: boolean;
  edited: boolean;
  /** True unless the AI confirmed the card comes only from the learner's notes. Check against a textbook. */
  beyondNotes: boolean;
  createdAt: number;
}

export const MAX_CARDS_PER_TOPIC = 20;
const MAX_FIELD = 600;

export const normalizeFront = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const CARD_SHAPE =
  'Reply with JSON only: {"cards":[{"front":string,"back":string,"beyondNotes":boolean}]}. ' +
  'front is one clear question or cue; back is a short answer (under 40 words). ' +
  'Set beyondNotes to true for any card whose answer is not stated in the notes given; otherwise false.';

export function cardsRequest(state: AppState, topic: Topic, n: number, now: number): ModelRequest {
  const count = Math.max(1, Math.min(MAX_CARDS_PER_TOPIC, Math.floor(n)));
  return {
    system: `${learnerProfile(state, now)}\n${CARD_SHAPE}`,
    user:
      `Write ${count} flashcards for "${topic.title}", favouring the learner's weak points. ` +
      `Base them on these notes:\n${topic.body.slice(0, 2500)}`,
  };
}

export interface ParseOpts {
  /** Topic for items that do not name one. */
  topicId?: string;
  idPrefix: string;
  now: number;
  /** Existing cards, used to avoid duplicates across generations. */
  existing?: Pick<Card, 'front'>[];
  cap?: number;
}

/** Validates model output into cards; malformed items are dropped, never repaired. */
export function parseCards(raw: string, topics: Topic[], opts: ParseOpts): Card[] {
  const json = extractJson(raw);
  const list = Array.isArray(json) ? json : (json as any)?.cards;
  if (!Array.isArray(list)) return [];
  const byTitle = new Map(topics.map((t) => [t.title.trim().toLowerCase(), t]));
  const byId = new Map(topics.map((t) => [t.id, t]));
  const seen = new Set((opts.existing ?? []).map((c) => normalizeFront(c.front)));
  const perTopic = new Map<string, number>();
  const cap = opts.cap ?? MAX_CARDS_PER_TOPIC;
  const out: Card[] = [];
  for (const it of list) {
    if (!it || typeof it.front !== 'string' || typeof it.back !== 'string') continue;
    const front = it.front.trim();
    const back = it.back.trim();
    if (!front || !back || front.length > MAX_FIELD || back.length > MAX_FIELD) continue;
    const topic =
      typeof it.topic === 'string' ? byTitle.get(it.topic.trim().toLowerCase()) : opts.topicId ? byId.get(opts.topicId) : undefined;
    if (!topic) continue;
    const key = normalizeFront(front);
    if (!key || seen.has(key)) continue;
    const used = perTopic.get(topic.id) ?? 0;
    if (used >= cap) continue;
    seen.add(key);
    perTopic.set(topic.id, used + 1);
    out.push({
      id: `${opts.idPrefix}-${out.length}`,
      topicId: topic.id,
      front,
      back,
      sourceTopicTitle: topic.title,
      dismissed: false,
      edited: false,
      // Anything not explicitly confirmed as from the notes is flagged.
      beyondNotes: it.beyondNotes !== false,
      createdAt: opts.now,
    });
  }
  return out;
}
