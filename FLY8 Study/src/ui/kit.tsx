import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { currentScheme, dark, light, radius, shadow, space, TOUCH_MIN, useTheme } from './theme';
import { Header, Illustration, PressableScale, haptic } from './kitParts';

export * from './kitParts';

const snap = () => (currentScheme() === 'dark' ? dark : light);

/**
 * Legacy colour snapshot for screens that have not moved to useTheme() yet. It is read once at load, so it
 * follows the phone setting at app start but not live changes. New code should call useTheme().
 */
export const c = (() => {
  const p = snap();
  return {
    bg: p.bg,
    card: p.surface,
    raised: p.surfaceAlt,
    line: p.border,
    text: p.text,
    dim: p.textDim,
    accent: p.accentText, // legacy code uses c.accent for text and borders, so this is the text-safe tone
    accentSoft: p.accentSoft,
    good: p.success,
    bad: p.danger,
    warn: p.warning,
  };
})();

/** Spacing scale (px), 8-pt based. */
export const sp = space;

/** Minimum touch target (px). */
export const TOUCH = TOUCH_MIN;

export function Card({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'tinted' }) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: tone === 'tinted' ? colors.accentSoft : colors.surface,
          borderRadius: radius.lg,
          padding: space.lg,
          gap: space.md,
          borderWidth: 1,
          borderColor: tone === 'tinted' ? 'transparent' : colors.border,
        },
        tone === 'plain' ? shadow(scheme) : null,
      ]}
    >
      {children}
    </View>
  );
}

export function H({ children }: { children: React.ReactNode }) {
  const { colors, type } = useTheme();
  return (
    <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>
      {children}
    </Text>
  );
}

export function P({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  const { colors, type } = useTheme();
  return <Text style={[type('body'), { color: dim ? colors.textDim : colors.text }]}>{children}</Text>;
}

export function Btn({
  label,
  onPress,
  kind = 'primary',
  disabled,
  hint,
  icon,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  hint?: string;
  icon?: React.ReactNode;
}) {
  const { colors, type } = useTheme();
  const fg = kind === 'primary' ? colors.onAccent : kind === 'danger' ? colors.danger : colors.text;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptic('tap');
        onPress();
      }}
      style={{
        minHeight: TOUCH_MIN,
        borderRadius: radius.md,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: space.sm,
        backgroundColor: kind === 'primary' ? colors.accent : 'transparent',
        borderWidth: kind === 'primary' ? 0 : 1,
        borderColor: kind === 'danger' ? colors.danger : colors.border,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {icon}
      <Text style={[type('bodyStrong'), { color: fg, textAlign: 'center', flexShrink: 1 }]}>{label}</Text>
    </PressableScale>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  const { colors, type } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Text style={[type('label'), { color: colors.textDim }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textDim}
        accessibilityLabel={label}
        {...rest}
        onFocus={(e) => {
          setFocus(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          rest.onBlur?.(e);
        }}
        style={[
          type('body'),
          {
            color: colors.text,
            backgroundColor: colors.surfaceAlt,
            borderColor: focus ? colors.accent : 'transparent',
            borderWidth: 2,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            minHeight: TOUCH_MIN,
          },
          // the focus ring is drawn by the accent border, so hide the browser's own outline on web
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
          style,
        ]}
      />
    </View>
  );
}

/** Small outlined label (legacy). `color` is the text and border colour. */
export function Pill({ text, color }: { text: string; color?: string }) {
  const { colors, type } = useTheme();
  const col = color ?? colors.textDim;
  return (
    <View style={{ borderWidth: 1, borderColor: col, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs, alignSelf: 'flex-start', maxWidth: '100%' }}>
      <Text style={[type('caption', 'medium'), { color: col }]}>{text}</Text>
    </View>
  );
}

/** Slim progress bar that eases to its value. `value` is 0..1. */
export function ProgressBar({ value, label, color, height = 8 }: { value: number; label?: string; color?: string; height?: number }) {
  const { colors, reduceMotion } = useTheme();
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const w = useRef(new Animated.Value(v)).current;
  useEffect(() => {
    if (reduceMotion) return w.setValue(v);
    Animated.timing(w, { toValue: v, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, reduceMotion, w]);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Progress'}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: color ?? colors.accent,
          width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

export function EmptyState({
  title,
  detail,
  actionLabel,
  onAction,
  art,
}: {
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  art?: 'notes' | 'quiz' | 'error' | 'cards' | 'done';
}) {
  const { colors, type } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space.md, padding: space.xl }}>
      <Illustration kind={art ?? 'notes'} />
      <Text accessibilityRole="header" style={[type('headline'), { color: colors.text, textAlign: 'center' }]}>
        {title}
      </Text>
      {detail ? <Text style={[type('body'), { color: colors.textDim, textAlign: 'center' }]}>{detail}</Text> : null}
      {actionLabel && onAction ? (
        <View style={{ alignSelf: 'stretch' }}>
          <Btn label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

/** Standard scrolling screen with consistent padding. */
export function Screen({ children, title, flush }: { children: React.ReactNode; title?: string; flush?: boolean }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: flush ? 0 : space.lg, paddingBottom: space.xxxl, gap: space.lg }}
      keyboardShouldPersistTaps="handled"
    >
      {title ? <H>{title}</H> : null}
      {children}
    </ScrollView>
  );
}

/** Legacy style bag, snapshot colours. New code should not use it. */
export const s = StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg, gap: 10, borderWidth: 1, borderColor: c.line },
  h: { color: c.text, fontSize: 18, fontWeight: '600' },
  p: { color: c.text, fontSize: 16, lineHeight: 24 },
  label: { color: c.dim, fontSize: 14 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
});

export { Header };
export const isWeb = Platform.OS === 'web';
