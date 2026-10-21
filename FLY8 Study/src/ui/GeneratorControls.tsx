import React from 'react';
import { Text, View } from 'react-native';
import { DEFAULT_MIX, STYLES, type StyleMix } from '../pnle/generator';
import { Btn, PressableScale } from './kit';
import { radius, space, useTheme } from './theme';

export function Pick({ on, label, detail, onPress }: { on: boolean; label: string; detail?: string; onPress: () => void }) {
  const { colors, type } = useTheme();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      scaleTo={0.99}
      style={{
        minHeight: 48, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 2,
        borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : 'transparent', justifyContent: 'center',
      }}
    >
      <Text style={[type('bodyStrong'), { color: on ? colors.accentText : colors.text }]}>{label}</Text>
      {detail ? <Text style={[type('caption'), { color: colors.textDim }]}>{detail}</Text> : null}
    </PressableScale>
  );
}

export function Label({ children }: { children: string }) {
  const { colors, type } = useTheme();
  return <Text style={[type('label'), { color: colors.textDim }]}>{children}</Text>;
}

const STEP = 5;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** One row per question style with a minus / plus stepper (percent of the set). */
export function StyleMixEditor({ mix, onChange }: { mix: StyleMix; onChange: (m: StyleMix) => void }) {
  const { colors, type } = useTheme();
  const sum = STYLES.reduce((a, s) => a + mix[s.id], 0) || 1;
  return (
    <View style={{ gap: space.xs }}>
      {STYLES.map((s) => (
        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={[type('body'), { color: colors.text }]}>{s.label}</Text>
            <Text style={[type('caption'), { color: colors.textDim }]}>{s.blurb}</Text>
          </View>
          <Btn label="-" kind="ghost" onPress={() => onChange({ ...mix, [s.id]: clamp(mix[s.id] - STEP) })} hint={`Less ${s.label}`} />
          <Text accessibilityLabel={`${s.label} share`} style={[type('bodyStrong'), { color: colors.text, minWidth: 44, textAlign: 'center' }]}>{Math.round((mix[s.id] / sum) * 100)}%</Text>
          <Btn label="+" kind="ghost" onPress={() => onChange({ ...mix, [s.id]: clamp(mix[s.id] + STEP) })} hint={`More ${s.label}`} />
        </View>
      ))}
      <Btn label="Reset the mix" kind="ghost" onPress={() => onChange({ ...DEFAULT_MIX })} />
    </View>
  );
}
