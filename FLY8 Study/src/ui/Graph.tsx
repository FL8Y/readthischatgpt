import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import type { AppState } from '../core/types';
import { backlinks, buildGraph } from '../core/vault';
import { RELATIONS, classifyEdges, layoutGraph, type RelationKind } from '../visual/layout';
import { Lesson } from './Lesson';
import { Btn, Card, H, P, Pill } from './kit';
import { space, useTheme, type Palette } from './theme';

/** Relation colours. Each relation ALSO has a dash pattern, an icon and a text label (see RELATIONS). */
const relColors = (colors: Palette): Record<RelationKind, string> => ({ mutual: colors.success, 'cross-folder': colors.warning, link: colors.accent });

const short = (s: string) => (s.length > 14 ? s.slice(0, 13) + '…' : s);

function Legend() {
  const { colors } = useTheme();
  const REL_COLOR = relColors(colors);
  return (
    <Card>
      <H>Legend</H>
      {(Object.keys(RELATIONS) as RelationKind[]).map((k) => (
        <View key={k} accessible accessibilityLabel={`${RELATIONS[k].label}: ${RELATIONS[k].meaning}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Svg width={44} height={12}>
            <Line x1={2} y1={6} x2={42} y2={6} stroke={REL_COLOR[k]} strokeWidth={3} strokeDasharray={RELATIONS[k].dash} />
          </Svg>
          <P>
            {RELATIONS[k].icon} {RELATIONS[k].label} <P dim>- {RELATIONS[k].meaning}</P>
          </P>
        </View>
      ))}
    </Card>
  );
}

/** Mind map of topics (drawn, tap a node to open its lesson) with a linked outline as the accessible alternative. */
export function Graph({ state }: { state: AppState }) {
  const { colors } = useTheme();
  const REL_COLOR = relColors(colors);
  const [mode, setMode] = useState<'map' | 'outline'>('map');
  const [open, setOpen] = useState<string | null>(null);
  const g = useMemo(() => buildGraph(state.topics), [state.topics]);
  const layout = useMemo(() => layoutGraph(g), [g]);
  const edges = useMemo(() => classifyEdges(g, state.topics), [g, state.topics]);

  if (open) return <Lesson state={state} topicId={open} onOpen={setOpen} onBack={() => setOpen(null)} />;
  if (!state.topics.length) return <P dim>Your map appears here once you add notes with [[links]].</P>;

  const title = (id: string) => g.nodes.find((n) => n.id === id)?.title ?? id;
  const pos = new Map(layout.nodes.map((n) => [n.id, n]));

  const toggle = (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <View style={{ flex: 1 }}>
        <Btn label={mode === 'map' ? 'Drawn map (showing)' : 'Drawn map'} kind={mode === 'map' ? 'primary' : 'ghost'} onPress={() => setMode('map')} />
      </View>
      <View style={{ flex: 1 }}>
        <Btn label={mode === 'outline' ? 'Outline (showing)' : 'Outline'} kind={mode === 'outline' ? 'primary' : 'ghost'} onPress={() => setMode('outline')} />
      </View>
    </View>
  );

  if (mode === 'outline') {
    return (
      <View style={{ gap: 14 }}>
        {toggle}
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
                    <Pill key={m} text={`missing: ${m}`} color={colors.warning} />
                  ))}
                </View>
              ) : null}
              <Btn label={`Open lesson: ${n.title}`} kind="ghost" onPress={() => setOpen(n.id)} />
            </Card>
          );
        })}
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {toggle}
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, aspectRatio: 1, overflow: 'hidden' }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${layout.width} ${layout.height}`} accessibilityLabel="Mind map of your topics. Use the Outline view for a list.">
          {edges.map((e) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            return (
              <Line key={`${e.from}>${e.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={REL_COLOR[e.kind]} strokeWidth={2.5} strokeDasharray={RELATIONS[e.kind].dash} />
            );
          })}
          {layout.nodes.map((n) => (
            <G key={n.id} onPress={() => setOpen(n.id)}>
              <Circle cx={n.x} cy={n.y} r={layout.nodeRadius} fill={colors.accentSoft} stroke={colors.accentText} strokeWidth={2} />
              <SvgText x={n.x} y={n.y + 4} fill={colors.text} fontSize={11} fontWeight="bold" textAnchor="middle">
                {title(n.id).slice(0, 3).toUpperCase()}
              </SvgText>
              <SvgText x={n.x} y={n.y + layout.nodeRadius + 12} fill={colors.text} fontSize={10} textAnchor="middle">
                {short(title(n.id))}
              </SvgText>
            </G>
          ))}
        </Svg>
      </View>
      <P dim>Tap a topic to open its lesson. Small phones: use Outline for bigger tap targets.</P>
      <Legend />
    </View>
  );
}
