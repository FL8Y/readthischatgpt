import type { Question, Topic } from '../core/types';
import { parseModuleQuestions, type QuizSession, type Result } from '../core/quiz';
import { parseQuestionItem } from '../core/questionParse';

/**
 * Module-quiz parsing that keeps PNLE fields. parseModuleQuestions (core/quiz.ts) validates topics, counts
 * and kinds but rebuilds plain choice items without the extras. Here every item is first validated by
 * parseQuestionItem (which composes the vignette into the stem and drops items without a correct-answer
 * rationale); only accepted items are handed on, and the extras are put back by position afterwards.
 */
export function parsePnleModuleQuestions(
  json: unknown,
  topics: Topic[],
  folderId: string,
  sessionId: string,
  now: number,
): Result<QuizSession> {
  const list = Array.isArray(json) ? json : (json as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(list)) return parseModuleQuestions(json, topics, folderId, sessionId, now);
  const byTitle = new Map(topics.map((t) => [t.title.trim().toLowerCase(), t]));
  const kept: unknown[] = [];
  const parsed: Question[] = [];
  for (const q of list) {
    const topic = typeof q?.topic === 'string' ? byTitle.get(q.topic.trim().toLowerCase()) : undefined;
    if (!topic) continue;
    const p = parseQuestionItem(q, topic.id, 'x');
    if (!p) continue;
    kept.push({ ...q, stem: p.stem, rationale: p.rationale });
    parsed.push(p);
  }
  const res = parseModuleQuestions({ questions: kept }, topics, folderId, sessionId, now);
  if (!res.ok) return res;
  const questions = res.value.questions.map((q, i) => {
    const p = parsed[i];
    return p && p.stem === q.stem && p.topicId === q.topicId ? { ...p, id: q.id } : q;
  });
  return { ok: true, value: { ...res.value, questions } };
}
