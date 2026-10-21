import React from 'react';
import { View } from 'react-native';
import { backlinks, type TopicGraph } from '../../core/vault';
import { Btn, Card, H, P, Pill } from '../kit';
import { useTheme } from '../theme';

/** Accessible list version of the map: every topic with what it links to and what links to it. */
export function GraphOutline({ graph, onOpen }: { graph: TopicGraph; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const title = (id: string) => graph.nodes.find((n) => n.id === id)?.title ?? id;
  return (
    <View style={{ gap: 14 }}>
      {graph.nodes.map((n) => {
        const out = graph.edges.filter((e) => e.from === n.id).map((e) => title(e.to));
        const back = backlinks(graph, n.id).map(title);
        const missing = graph.unresolved.filter((u) => u.from === n.id).map((u) => u.target);
        return (
          <Card key={n.id}>
            <H>{n.title}</H>
            {out.length ? <P>Links to: {out.join(', ')}</P> : null}
            {back.length ? <P dim>Linked from: {back.join(', ')}</P> : null}
            {missing.length ? (
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {missing.map((m) => (
                  <Pill key={m} text={`missing: ${m}`} color={colors.warning} />
                ))}
              </View>
            ) : null}
            <Btn label={`Open lesson: ${n.title}`} kind="ghost" onPress={() => onOpen(n.id)} />
          </Card>
        );
      })}
    </View>
  );
}
