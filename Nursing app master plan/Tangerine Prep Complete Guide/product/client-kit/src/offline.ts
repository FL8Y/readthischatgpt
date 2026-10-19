/** Offline sync rules: backoff, outbox outcomes, prefetch interval, offline window, chunk validation. */
export const PREFETCH_INTERVAL_MS = 24 * 3600_000;
export const OFFLINE_WINDOW_MS = 24 * 3600_000;

/** Exponential backoff: 500 ms doubling, capped at 8 s. */
export const backoffFor = (attempt: number, base = 500, cap = 8000) => Math.min(base * 2 ** attempt, cap);

export type Outcome = "sent" | "retry" | "discard";
/** HTTP outcome of posting one queued item. A thrown network error is passed as status 0. */
export function classify(status: number): Outcome {
  if (status >= 200 && status < 300) return "sent";
  if (status === 0 || status === 408 || status === 429 || status >= 500) return "retry";
  return "discard"; // other 4xx: the payload is wrong, retrying cannot help
}

export interface OutboxRow { id: number; kind: string; payload: unknown; attempts: number }
/** Send rows in order. Sent and discarded rows are removed; retry rows stay with attempts + 1. */
export async function drain(rows: OutboxRow[], send: (r: OutboxRow) => Promise<number>) {
  const result = { sent: 0, retry: 0, discarded: 0, remaining: [] as OutboxRow[] };
  for (const row of rows) {
    let status = 0;
    try { status = await send(row); } catch { status = 0; }
    const o = classify(status);
    if (o === "sent") result.sent++;
    else if (o === "discard") result.discarded++;
    else { result.retry++; result.remaining.push({ ...row, attempts: row.attempts + 1 }); }
  }
  return result;
}

export const shouldPrefetch = (lastAt: number | null, now: number) => lastAt === null || now - lastAt >= PREFETCH_INTERVAL_MS;
export const offlineRemainingMs = (startAt: number | null, now: number) => (startAt === null ? OFFLINE_WINDOW_MS : Math.max(0, OFFLINE_WINDOW_MS - (now - startAt)));

/** A downloaded chunk must be the one that was asked for. (The reference app checks version and index only.) */
export function chunkMatches(req: { version: string | number; index: number }, got: { version: string | number; index: number }) {
  return String(req.version) === String(got.version) && req.index === got.index;
}
