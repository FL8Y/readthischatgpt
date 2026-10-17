import type { AppState } from './types';

/**
 * Splits the big arrays (topics, chunks) into several storage values so no single value gets
 * near Android's ~2 MB row limit when hundreds of preset notes are installed. Pure; the
 * AsyncStorage wiring lives in storage.ts.
 */
export const SHARD_BYTES = 400_000;

export interface ShardMeta {
  topics: number;
  chunks: number;
}

export interface SplitState {
  main: string;
  topics: string[];
  chunks: string[];
}

function shard<T>(items: T[]): string[] {
  const out: string[] = [];
  let cur: T[] = [];
  let size = 0;
  for (const it of items) {
    const s = JSON.stringify(it).length + 1;
    if (cur.length && size + s > SHARD_BYTES) {
      out.push(JSON.stringify(cur));
      cur = [];
      size = 0;
    }
    cur.push(it);
    size += s;
  }
  if (cur.length) out.push(JSON.stringify(cur));
  return out;
}

export function splitState(state: AppState): SplitState {
  const topics = shard(state.topics);
  const chunks = shard(state.chunks);
  const { topics: _t, chunks: _c, ...rest } = state;
  const meta: ShardMeta = { topics: topics.length, chunks: chunks.length };
  return { main: JSON.stringify({ ...rest, __shards: meta }), topics, chunks };
}

/** Reads the `__shards` marker from a saved main value; undefined for old single-value saves. */
export function shardMeta(main: Partial<AppState> & { __shards?: ShardMeta }): ShardMeta | undefined {
  const m = main.__shards;
  return m && Number.isFinite(m.topics) && Number.isFinite(m.chunks) ? m : undefined;
}

export function joinState(
  main: Partial<AppState> & { __shards?: ShardMeta },
  topicParts: (string | null)[],
  chunkParts: (string | null)[],
): Partial<AppState> {
  const { __shards: _m, ...rest } = main;
  const parse = (parts: (string | null)[]) => parts.flatMap((p) => (p ? (JSON.parse(p) as unknown[]) : []));
  return { ...rest, topics: parse(topicParts) as AppState['topics'], chunks: parse(chunkParts) as AppState['chunks'] };
}
