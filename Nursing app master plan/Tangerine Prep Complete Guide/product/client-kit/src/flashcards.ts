/** Local flashcard review helpers (four-button rating, queue advance, mastery stats). */
export type Rating = "again" | "hard" | "good" | "easy";

/** Good and Easy remove the card from today's queue; Again and Hard send it back a few cards later. */
export function advanceQueue<T>(queue: T[], rating: Rating, reinsertAfter = 3): T[] {
  const [head, ...rest] = queue;
  if (head === undefined) return queue;
  if (rating === "good" || rating === "easy") return rest;
  const at = Math.min(reinsertAfter, rest.length);
  return [...rest.slice(0, at), head, ...rest.slice(at)];
}

/** Mastered = latest rating good/easy; learning = again/hard. Percent mastered of rated cards. */
export function masteryStats(latest: Rating[]) {
  const mastered = latest.filter((r) => r === "good" || r === "easy").length;
  const learning = latest.length - mastered;
  return { mastered, learning, percent: latest.length === 0 ? 0 : Math.round((mastered / latest.length) * 100) };
}

/** Fisher-Yates shuffle from the end, with an injectable random source. */
export function shuffled<T>(items: T[], rnd: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
