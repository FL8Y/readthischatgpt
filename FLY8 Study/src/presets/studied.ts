/** Pure "studied" bookkeeping for the note reader. Storage lives in studiedStore.ts. */
export function normalizeStudied(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is string => typeof x === 'string' && x.length > 0))];
}

export function isStudied(studied: string[], topicId: string): boolean {
  return studied.includes(topicId);
}

/** Returns a new list with the topic toggled. */
export function toggleStudied(studied: string[], topicId: string): string[] {
  return studied.includes(topicId) ? studied.filter((x) => x !== topicId) : [...studied, topicId];
}

/** Counts only ids that still exist, so deleted topics never inflate the number. */
export function studiedProgress(studied: string[], topicIds: string[]): { done: number; total: number } {
  const have = new Set(studied);
  return { done: topicIds.filter((id) => have.has(id)).length, total: topicIds.length };
}

export const studiedLabel = (p: { done: number; total: number }) => `Studied ${p.done}/${p.total}`;
