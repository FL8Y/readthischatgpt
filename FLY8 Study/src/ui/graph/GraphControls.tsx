import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { IconButton, PressableScale } from '../kit';
import { radius, space, useTheme } from '../theme';
import type { GroupInfo } from './model';

/** Filter chip per bundle (Obsidian "groups"). Colour dot + name + count, so colour is never the only signal. */
export function BundleChips({
  groups,
  colors: swatch,
  hidden,
  onToggle,
  onAll,
  onNone,
}: {
  groups: GroupInfo[];
  colors: Map<string, string>;
  hidden: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onAll: () => void;
  onNone: () => void;
}) {
  const { colors, type } = useTheme();
  const chip = (key: string, label: string, on: boolean, onPress: () => void, dot?: string) => (
    <PressableScale
      key={key}
      accessibilityRole="button"
      accessibilityLabel={`${label}${dot ? (on ? ', shown' : ', hidden') : ''}`}
      accessibilityState={dot ? { selected: on } : undefined}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: 40,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: dot && on ? dot : colors.border,
        backgroundColor: on ? colors.surface : colors.surfaceAlt,
        opacity: dot && !on ? 0.6 : 1,
      }}
    >
      {dot ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dot, opacity: on ? 1 : 0.35 }} /> : null}
      <Text style={[type('label'), { color: colors.text, textDecorationLine: dot && !on ? 'line-through' : 'none' }]}>{label}</Text>
    </PressableScale>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs }} accessibilityLabel="Bundle filters">
      {chip('all', 'All', false, onAll)}
      {chip('none', 'None', false, onNone)}
      {groups.map((g) => chip(g.id, `${g.name} · ${g.count}`, !hidden.has(g.id), () => onToggle(g.id), swatch.get(g.id)))}
    </ScrollView>
  );
}

/** - value + control (a slider substitute that needs no native module). */
export function Stepper({ label, value, step, min, max, onChange }: { label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
      <Text style={[type('body'), { color: colors.text, flexShrink: 1 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton icon="remove" label={`Less ${label}`} tone="tinted" disabled={value <= min} onPress={() => onChange(Math.max(min, value - step))} />
        <Text accessibilityLabel={`${label} ${value}`} style={[type('bodyStrong'), { color: colors.text, minWidth: 44, textAlign: 'center' }]}>{value}</Text>
        <IconButton icon="add" label={`More ${label}`} tone="tinted" disabled={value >= max} onPress={() => onChange(Math.min(max, value + step))} />
      </View>
    </View>
  );
}

export function MapToolbar({ onZoomIn, onZoomOut, onFit, onReset }: { onZoomIn: () => void; onZoomOut: () => void; onFit: () => void; onReset: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <IconButton icon="add" label="Zoom in" tone="tinted" onPress={onZoomIn} />
      <IconButton icon="remove" label="Zoom out" tone="tinted" onPress={onZoomOut} />
      <IconButton icon="scan-outline" label="Fit to screen" tone="tinted" onPress={onFit} />
      <IconButton icon="refresh-outline" label="Reset layout" tone="tinted" onPress={onReset} />
    </View>
  );
}
