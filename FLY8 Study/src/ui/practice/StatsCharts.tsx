import React, { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { BAND_EDGES, type AreaReadiness } from '../../bank/readiness';
import { pathFor, trendGeometry, trendSummary, type AreaAcc, type TrendPoint } from '../../bank/statsData';
import { space, useTheme } from '../theme';

/** Horizontal bars, one per area, weakest first. The number is always printed, so colour is not the only cue. */
export function AreaBars({ rows, locked }: { rows: readonly AreaAcc[]; locked?: (a: string) => string | undefined }) {
  const { colors, type } = useTheme();
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  const h = 12;
  return (
    <View style={{ gap: space.md }}>
      {rows.map((r) => {
        const tone = r.percent >= BAND_EDGES.onTrack ? colors.success : r.percent >= BAND_EDGES.approaching ? colors.warning : colors.danger;
        const word = r.percent >= BAND_EDGES.onTrack ? 'strong' : r.percent >= BAND_EDGES.approaching ? 'fair' : 'weak';
        const note = locked?.(r.area);
        return (
          <View key={r.area} accessible accessibilityLabel={`${r.area}: ${Math.round(r.percent)} percent, ${word}, ${r.answered} answered${note ? `. ${note}` : ''}`} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[type('bodyStrong'), { color: colors.text }]}>{r.area}</Text>
              <Text style={[type('caption'), { color: colors.textDim }]}>
                {Math.round(r.percent)}% {word} · {r.answered} answered
              </Text>
            </View>
            <View onLayout={onLayout} style={{ height: h }}>
              {w > 0 ? (
                <Svg width={w} height={h}>
                  <Rect x={0} y={0} width={w} height={h} rx={h / 2} fill={colors.surfaceAlt} />
                  <Rect x={0} y={0} width={Math.max(h, (w * Math.min(100, r.percent)) / 100)} height={h} rx={h / 2} fill={tone} />
                </Svg>
              ) : null}
            </View>
            {note ? <Text style={[type('caption'), { color: colors.textDim }]}>{note}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/** 14-day accuracy line. Gaps (days with no answers) break the line. */
export function TrendChart({ points, height = 120 }: { points: readonly TrendPoint[]; height?: number }) {
  const { colors, type } = useTheme();
  const [w, setW] = useState(0);
  const geo = w > 0 ? trendGeometry(points, w, height) : { runs: [], dots: [] };
  const first = points[0]?.label;
  const last = points[points.length - 1]?.label;
  const y = (pct: number) => 8 + (1 - pct / 100) * (height - 16);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Accuracy over the last ${points.length} days. ${trendSummary(points)}`} style={{ gap: 4 }}>
      <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ height }}>
        {w > 0 ? (
          <Svg width={w} height={height}>
            {[0, 50, 100].map((g) => (
              <Line key={g} x1={0} x2={w} y1={y(g)} y2={y(g)} stroke={colors.border} strokeWidth={1} strokeDasharray={g === 50 ? '4 4' : undefined} />
            ))}
            {geo.runs.map((run, i) => (run.length > 1 ? <Path key={i} d={pathFor(run)} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null))}
            {geo.dots.map((d) => (
              <Circle key={d.day} cx={d.x} cy={d.y} r={4} fill={colors.surface} stroke={colors.accent} strokeWidth={2} />
            ))}
          </Svg>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[type('caption'), { color: colors.textDim }]}>Day {first}</Text>
        <Text style={[type('caption'), { color: colors.textDim }]}>0% to 100%</Text>
        <Text style={[type('caption'), { color: colors.textDim }]}>Day {last}</Text>
      </View>
    </View>
  );
}

/**
 * Passing-readiness ring. `percent` null draws an empty, dashed ring (locked).
 * Tick marks sit at the 60 and 75 band edges.
 */
export function ReadinessRing({ percent, size = 140, stroke = 14, caption, children }: {
  percent: number | null;
  size?: number;
  stroke?: number;
  caption: string;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const v = percent === null ? 0 : Math.min(1, Math.max(0, percent / 100));
  const tone = percent === null ? colors.textDim : percent >= BAND_EDGES.onTrack ? colors.success : percent >= BAND_EDGES.approaching ? colors.warning : colors.danger;
  const tick = (pct: number) => {
    const a = (pct / 100) * 2 * Math.PI - Math.PI / 2;
    return { x1: c + (r - stroke / 2 - 2) * Math.cos(a), y1: c + (r - stroke / 2 - 2) * Math.sin(a), x2: c + (r + stroke / 2 + 2) * Math.cos(a), y2: c + (r + stroke / 2 + 2) * Math.sin(a) };
  };
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={caption}
      accessibilityValue={percent === null ? undefined : { min: 0, max: 100, now: Math.round(percent) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={c} cy={c} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" strokeDasharray={percent === null ? '6 8' : undefined} />
        {v > 0 ? (
          <Circle cx={c} cy={c} r={r} stroke={tone} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circ * v} ${circ}`} rotation={-90} origin={`${c}, ${c}`} />
        ) : null}
        {[BAND_EDGES.approaching, BAND_EDGES.onTrack].map((p) => (
          <Line key={p} {...tick(p)} stroke={colors.textDim} strokeWidth={2} />
        ))}
      </Svg>
      {children}
    </View>
  );
}

/** Small per-area readiness line used under the ring. */
export function readinessAreaNote(a: AreaReadiness): string | undefined {
  return a.state === 'locked' ? `Locked: ${a.answered} of ${a.needed} answers` : undefined;
}
