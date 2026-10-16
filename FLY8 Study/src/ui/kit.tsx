import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

/** Dark theme. dim text is ~7:1 on bg; white on accent is ~5:1 (checked by hand, not by tool). */
export const c = {
  bg: '#0f1115',
  card: '#181b22',
  raised: '#20242d',
  line: '#2e3441',
  text: '#f2f4f8',
  dim: '#a3acbb',
  accent: '#6d4aff',
  accentSoft: '#2a2350',
  good: '#35c28a',
  bad: '#ef5b6c',
  warn: '#f0b44c',
};

/** Spacing scale (px). Use these instead of ad-hoc numbers. */
export const sp = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Minimum touch target (px). */
export const TOUCH = 48;

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

export function H({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={s.h}>
      {children}
    </Text>
  );
}

export function P({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return <Text style={[s.p, dim && { color: c.dim }]}>{children}</Text>;
}

export function Btn({
  label,
  onPress,
  kind = 'primary',
  disabled,
  hint,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        kind === 'ghost' && s.ghost,
        kind === 'danger' && s.danger,
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.8 },
      ]}
    >
      <Text style={[s.btnText, kind === 'ghost' && { color: c.text }, kind === 'danger' && { color: c.bad }]}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={c.dim} accessibilityLabel={label} {...rest} style={[s.input, rest.style]} />
    </View>
  );
}

export function Pill({ text, color = c.dim }: { text: string; color?: string }) {
  return (
    <View style={[s.pill, { borderColor: color }]}>
      <Text style={{ color, fontSize: 12 }}>{text}</Text>
    </View>
  );
}

/** Thin progress bar. `value` is 0..1. */
export function ProgressBar({ value, label, color = c.accent }: { value: number; label?: string; color?: string }) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Progress'}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={s.track}
    >
      <View style={[s.fill, { width: `${v * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function EmptyState({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.empty}>
      <Text accessibilityRole="header" style={[s.h, { textAlign: 'center' }]}>
        {title}
      </Text>
      {detail ? <Text style={[s.p, { color: c.dim, textAlign: 'center' }]}>{detail}</Text> : null}
      {actionLabel && onAction ? <Btn label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

/** Standard scrolling screen with consistent padding. */
export function Screen({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: sp.lg, paddingBottom: sp.xxl, gap: sp.md }}
      keyboardShouldPersistTaps="handled"
    >
      {title ? <H>{title}</H> : null}
      {children}
    </ScrollView>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: 16, padding: sp.lg, gap: 10, borderWidth: 1, borderColor: c.line },
  h: { color: c.text, fontSize: 20, fontWeight: '700' },
  p: { color: c.text, fontSize: 16, lineHeight: 23 },
  label: { color: c.dim, fontSize: 13 },
  input: {
    color: c.text,
    backgroundColor: c.bg,
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: sp.md,
    paddingVertical: 10,
    minHeight: TOUCH,
    fontSize: 16,
  },
  btn: {
    backgroundColor: c.accent,
    borderRadius: 12,
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    minHeight: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.line },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.bad },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  track: { height: 8, borderRadius: 4, backgroundColor: c.raised, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  empty: { alignItems: 'center', gap: sp.md, padding: sp.xl },
});
