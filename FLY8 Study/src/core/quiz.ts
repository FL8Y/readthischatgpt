import type { AttemptEvent, AttemptKind, Question, Topic } from './types';
import { dedupeEvents, estimateMastery } from './mastery';
import { POP_QUIZ_MAX, POP_QUIZ_MIN } from './diagnostic';
import { slugify } from './vault';
import { parseQuestionItem } from './questionParse';

export const MODULE_QUIZ_MIN = 10;
export const MODULE_QUIZ_MAX = 50;
/** A topic counts as mastered only with high accuracy AND enough evidence (R-033: confidence is separate). */
export const MASTERED_MASTERY = 0.8;
export const MASTERED_CONFIDENCE = 0.5;
/** Estimated mastery below this (with evidence) is a weakness. */
export const WEAK_MASTERY = 0.6;
/** Within one session, a topic scoring below this share of correct answers is flagged weak. */
export const SESSION_WEAK_ACCURACY = 0.6;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface QuizSession {
  /** Unique per run; event ids are built from it so replays never double count. */
  id: string;
  kind: Extract<AttemptKind, 'pop' | 'module' | 'diagnostic'>;
  folderId: string;
  questions: Question[];
  createdAt: number;
}

export function eventId(sessionId: string, questionId: string): string {
  return `${sessionId}:${questionId}`;
}

/** Pop quiz (R-012): exactly 1-5 questions for one topic; any other count is rejected, never trimmed. */
export function buildPopSession(topic: Topic, questions: Question[], sessionId: string, now: number): Result<QuizSession> {
  if (questions.length < POP_QUIZ_MIN || questions.length > POP_QUIZ_MAX) {
    return { ok: false, error: `A pop quiz needs ${POP_QUIZ_MIN}-${POP_QUIZ_MAX} questions, got ${questions.length}.` };
  }
  const qs = questions.map((q) => ({ ...q, topicId: topic.id }));
  return { ok: true, value: { id: sessionId, kind: 'pop', folderId: topic.folderId, questions: qs, createdAt: now } };
}

export interface BlueprintItem {
  topicId: string;
  title: string;
  count: number;
}

/**
 * Module quiz blueprint (R-014): every topic gets at least one question; the rest are shared out
 * in proportion to weakness (weak, low-evidence topics get more). Largest-remainder allocation with
 * title/id tie-breaks, so identical evidence gives an identical blueprint.
 */
export function moduleBlueprint(
  topics: Topic[],
  events: AttemptEvent[],
  now: number,
  count: number,
): Result<BlueprintItem[]> {
  if (!Number.isInteger(count) || count < MODULE_QUIZ_MIN || count > MODULE_QUIZ_MAX) {
    return { ok: false, error: `A module quiz needs ${MODULE_QUIZ_MIN}-${MODULE_QUIZ_MAX} questions.` };
  }
  if (topics.length === 0) return { ok: false, error: 'This folder has no topics.' };
  if (topics.length > count) {
    return { ok: false, error: `${topics.length} topics cannot all be covered by ${count} questions. Ask for at least ${topics.length}.` };
  }
  const weights = topics.map((t) => {
    const m = estimateMastery(t.id, events, now);
    // Floor keeps mastered topics in the quiz; low confidence raises the weight.
    return 0.25 + (1 - m.mastery) * (1 + (1 - m.confidence));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const spare = count - topics.length;
  const raw = weights.map((w) => (w / total) * spare);
  const counts = raw.map((r) => 1 + Math.floor(r));
  let left = count - counts.reduce((a, b) => a + b, 0);
  const order = topics
    .map((t, i) => ({ t, i, frac: raw[i] - Math.floor(raw[i]) }))
    .sort((a, b) => b.frac - a.frac || a.t.title.localeCompare(b.t.title) || a.t.id.localeCompare(b.t.id));
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) counts[order[k].i] += 1;
  const items = topics.map((t, i) => ({ topicId: t.id, title: t.title, count: counts[i] }));
  items.sort((a, b) => a.title.localeCompare(b.title) || a.topicId.localeCompare(b.topicId));
  return { ok: true, value: items };
}

/** Turns the AI reply into a module session. Questions are matched to topics by their "topic" title. */
export function parseModuleQuestions(
  json: unknown,
  topics: Topic[],
  folderId: string,
  sessionId: string,
  now: number,
): Result<QuizSession> {
  const list = Array.isArray(json) ? json : (json as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(list)) return { ok: false, error: 'The AI did not return a question list.' };
  const byTitle = new Map(topics.map((t) => [t.title.trim().toLowerCase(), t]));
  const questions: Question[] = [];
  for (const q of list) {
    const topic = typeof q?.topic === 'string' ? byTitle.get(q.topic.trim().toLowerCase()) : undefined;
    if (topic && q.kind !== undefined && q.kind !== 'choice') {
      // Non-choice kinds (typing, cloze, matching, ordering) go through the strict mixed-kind parser.
      const parsed = parseQuestionItem(q, topic.id, `${sessionId}-${questions.length}`);
      if (parsed) questions.push(parsed);
      continue;
    }
    const ok =
      topic &&
      typeof q.stem === 'string' &&
      Array.isArray(q.choices) &&
      q.choices.length >= 2 &&
      q.choices.every((x: unknown) => typeof x === 'string') &&
      Number.isInteger(q.answerIndex) &&
      q.answerIndex >= 0 &&
      q.answerIndex < q.choices.length &&
      typeof q.rationale === 'string';
    if (ok) {
      questions.push({
        id: `${sessionId}-${questions.length}`,
        topicId: topic.id,
        stem: q.stem,
        choices: q.choices,
        answerIndex: q.answerIndex,
        rationale: q.rationale,
      });
    }
  }
  const missing = topics.filter((t) => !questions.some((q) => q.topicId === t.id));
  if (missing.length) {
    return { ok: false, error: `The AI skipped: ${missing.map((t) => t.title).join(', ')}. Try again.` };
  }
  if (questions.length < MODULE_QUIZ_MIN || questions.length > MODULE_QUIZ_MAX) {
    return { ok: false, error: `Got ${questions.length} usable questions, need ${MODULE_QUIZ_MIN}-${MODULE_QUIZ_MAX}.` };
  }
  return { ok: true, value: { id: sessionId, kind: 'module', folderId, questions, createdAt: now } };
}

export interface TopicScore {
  topicId: string;
  correct: number;
  total: number;
}

export interface SessionResult {
  sessionId: string;
  kind: QuizSession['kind'];
  correct: number;
  total: number;
  perTopic: TopicScore[];
  /** Topics scored below SESSION_WEAK_ACCURACY in this session, worst first. */
  weakTopicIds: string[];
}

/** Summarises a session from per-question outcomes. Unanswered questions are left out of the totals. */
export function summarizeSession(session: QuizSession, outcomes: ReadonlyMap<string, boolean>): SessionResult {
  const per = new Map<string, TopicScore>();
  for (const q of session.questions) {
    const o = outcomes.get(q.id);
    if (o === undefined) continue;
    const s = per.get(q.topicId) ?? { topicId: q.topicId, correct: 0, total: 0 };
    s.total += 1;
    if (o) s.correct += 1;
    per.set(q.topicId, s);
  }
  const perTopic = [...per.values()].sort((a, b) => a.topicId.localeCompare(b.topicId));
  const weakTopicIds = perTopic
    .filter((s) => s.correct / s.total < SESSION_WEAK_ACCURACY)
    .sort((a, b) => a.correct / a.total - b.correct / b.total || a.topicId.localeCompare(b.topicId))
    .map((s) => s.topicId);
  return {
    sessionId: session.id,
    kind: session.kind,
    correct: perTopic.reduce((n, s) => n + s.correct, 0),
    total: perTopic.reduce((n, s) => n + s.total, 0),
    perTopic,
    weakTopicIds,
  };
}

/** Grades picks (questionId -> chosen index) into attempt events plus a result. Unpicked questions are skipped. */
export function gradeSession(
  session: QuizSession,
  picks: Readonly<Record<string, number>>,
  now: number,
): { events: AttemptEvent[]; result: SessionResult } {
  const events: AttemptEvent[] = [];
  const outcomes = new Map<string, boolean>();
  for (const q of session.questions) {
    if (!(q.id in picks)) continue;
    const correct = picks[q.id] === q.answerIndex;
    outcomes.set(q.id, correct);
    events.push({ id: eventId(session.id, q.id), questionId: q.id, topicId: q.topicId, correct, at: now, kind: session.kind });
  }
  return { events, result: summarizeSession(session, outcomes) };
}

/** Rebuilds a result from recorded events, so a resumed or re-opened session reports the same score. */
export function resultFromEvents(session: QuizSession, events: AttemptEvent[]): SessionResult {
  const byId = new Map(dedupeEvents(events).map((e) => [e.id, e.correct]));
  const outcomes = new Map<string, boolean>();
  for (const q of session.questions) {
    const o = byId.get(eventId(session.id, q.id));
    if (o !== undefined) outcomes.set(q.id, o);
  }
  return summarizeSession(session, outcomes);
}

/** Questions of a session that have no recorded answer yet (resume point). */
export function unansweredQuestions(session: QuizSession, events: AttemptEvent[]): Question[] {
  const seen = new Set(events.map((e) => e.id));
  return session.questions.filter((q) => !seen.has(eventId(session.id, q.id)));
}

export interface RemediationItem {
  topicId: string;
  title: string;
  mastery: number;
  confidence: number;
  attempts: number;
  priority: number;
  reason: string;
}

export interface RemediationPlan {
  /** Weak topics, most urgent first. Never includes mastered topics. */
  items: RemediationItem[];
  mastered: string[];
  /** Topics with no evidence yet; not remediation targets, they need assessment first. */
  untested: string[];
}

export function isMastered(mastery: number, confidence: number): boolean {
  return mastery >= MASTERED_MASTERY && confidence >= MASTERED_CONFIDENCE;
}

/**
 * Remediation plan (R-015): weak, evidenced, not-yet-mastered topics ordered by urgency. Pure over the
 * event ledger, so calling it again after new evidence is the re-plan step of the cycle (R-016).
 */
export function remediationPlan(topics: Topic[], events: AttemptEvent[], now: number): RemediationPlan {
  const items: RemediationItem[] = [];
  const mastered: string[] = [];
  const untested: string[] = [];
  for (const t of topics) {
    const m = estimateMastery(t.id, events, now);
    if (m.attempts === 0) untested.push(t.id);
    else if (isMastered(m.mastery, m.confidence)) mastered.push(t.id);
    else if (m.mastery < WEAK_MASTERY) {
      items.push({
        topicId: t.id,
        title: t.title,
        mastery: Number(m.mastery.toFixed(6)),
        confidence: Number(m.confidence.toFixed(6)),
        attempts: m.attempts,
        priority: Number(((1 - m.mastery) * (1 + (1 - m.confidence))).toFixed(6)),
        reason: `${Math.round(m.mastery * 100)}% estimated mastery from ${m.attempts} attempt(s)`,
      });
    }
  }
  items.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title) || a.topicId.localeCompare(b.topicId));
  return { items, mastered: mastered.sort(), untested: untested.sort() };
}

export interface CycleChange {
  resolved: string[];
  stillWeak: string[];
  newlyWeak: string[];
}

/** Compares two plans so the UI can show what new evidence changed. */
export function cycleChange(before: RemediationPlan, after: RemediationPlan): CycleChange {
  const b = new Set(before.items.map((i) => i.topicId));
  const a = new Set(after.items.map((i) => i.topicId));
  return {
    resolved: [...b].filter((id) => !a.has(id)).sort(),
    stillWeak: [...b].filter((id) => a.has(id)).sort(),
    newlyWeak: [...a].filter((id) => !b.has(id)).sort(),
  };
}

/**
 * Splits an AI Markdown reply into new Topics, one per "# Title" section. Sections whose title already
 * exists in the folder (case-insensitive), or that are empty, are skipped so nothing is overwritten.
 */
export function parseFixTopics(raw: string, folderId: string, existing: Topic[], idPrefix: string): Topic[] {
  const taken = new Set(existing.map((t) => t.title.trim().toLowerCase()));
  const out: Topic[] = [];
  const parts = raw.split(/^#\s+(.+)$/m);
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const title = parts[i].trim();
    const body = parts[i + 1].trim();
    const key = title.toLowerCase();
    if (!title || !body || taken.has(key)) continue;
    taken.add(key);
    out.push({ id: `${idPrefix}-${slugify(title) || out.length}`, folderId, title, body, sourceIds: [] });
  }
  return out;
}
