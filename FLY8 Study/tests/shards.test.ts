import { describe, expect, it } from 'vitest';
import { SHARD_BYTES, joinState, shardMeta, splitState } from '../src/core/shards';
import { emptyStateForTest as emptyState } from './presetsFixture';
import type { AppState } from '../src/core/types';

const big = (n: number): AppState => {
  const s = emptyState();
  return {
    ...s,
    topics: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, folderId: 'f', title: `T${i}`, body: 'x'.repeat(5000), sourceIds: [] })),
    chunks: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, sourceId: 's', text: 'y'.repeat(5000), index: i } as never)),
  };
};

describe('state shards', () => {
  it('keeps every value under the shard size and round-trips exactly', () => {
    const s = big(600);
    const sp = splitState(s);
    expect(sp.topics.length).toBeGreaterThan(5);
    for (const v of [...sp.topics, ...sp.chunks]) expect(v.length).toBeLessThanOrEqual(SHARD_BYTES + 6000);
    const main = JSON.parse(sp.main);
    const meta = shardMeta(main);
    expect(meta).toEqual({ topics: sp.topics.length, chunks: sp.chunks.length });
    const back = joinState(main, sp.topics, sp.chunks) as AppState;
    expect(back.topics).toEqual(s.topics);
    expect(back.chunks).toEqual(s.chunks);
    expect(back.folders).toEqual(s.folders);
  });

  it('treats an older single-value save as unsharded and an empty state as zero parts', () => {
    expect(shardMeta({ topics: [] } as never)).toBeUndefined();
    const sp = splitState(emptyState());
    expect(sp.topics).toEqual([]);
    expect(sp.chunks).toEqual([]);
    expect(JSON.parse(sp.main).topics).toBeUndefined();
  });

  it('tolerates a missing shard (null) without throwing', () => {
    const sp = splitState(big(50));
    const back = joinState(JSON.parse(sp.main), [null, ...sp.topics.slice(1)], sp.chunks);
    expect(Array.isArray(back.topics)).toBe(true);
  });
});
