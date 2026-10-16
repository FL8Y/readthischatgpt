import React, { useMemo } from 'react';
import { View } from 'react-native';
import type { AppState } from '../core/types';
import { backlinks, buildGraph } from '../core/vault';
import { Card, H, P, Pill, c } from './kit';

/** Linked outline of the knowledge graph. A drawn graph view can build on the same data later. */
export function Graph({ state }: { state: AppState }) {
  const g = useMemo(() => buildGraph(state.topics), [state.topics]);
  const title = (id: string) => g.nodes.find((n) => n.id === id)?.title ?? id;
  if (!state.topics.length) return <P dim>Your map appears here once you add notes with [[links]].</P>;
  return (
    <View style={{ gap: 14 }}>
      {g.nodes.map((n) => {
        const out = g.edges.filter((e) => e.from === n.id).map((e) => title(e.to));
        const back = backlinks(g, n.id).map(title);
        const missing = g.unresolved.filter((u) => u.from === n.id).map((u) => u.target);
        return (
          <Card key={n.id}>
            <H>{n.title}</H>
            {out.length ? <P>Links to: {out.join(', ')}</P> : null}
            {back.length ? <P dim>Linked from: {back.join(', ')}</P> : null}
            {missing.length ? (
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {missing.map((m) => (
                  <Pill key={m} text={`missing: ${m}`} color={c.warn} />
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
