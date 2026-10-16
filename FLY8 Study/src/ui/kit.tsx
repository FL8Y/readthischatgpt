import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

export const c = {
  bg: '#0f1115',
  card: '#181b22',
  line: '#262b36',
  text: '#f2f4f8',
  dim: '#9aa3b2',
  accent: '#7c5cff',
  good: '#35c28a',
  bad: '#ef5b6c',
  warn: '#f0b44c',
};

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

export function H({ children }: { children: React.ReactNode }) {
  return <Text style={s.h}>{children}</Text>;
}

export function P({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return <Text style={[s.p, dim && { color: c.dim }]}>{children}</Text>;
}

export function Btn({
  label,
  onPress,
  kind = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        kind === 'ghost' && s.ghost,
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.8 },
      ]}
    >
      <Text style={[s.btnText, kind === 'ghost' && { color: c.text }]}>{label}</Text>
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

export const s = StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: c.line },
  h: { color: c.text, fontSize: 20, fontWeight: '700' },
  p: { color: c.text, fontSize: 15, lineHeight: 22 },
  label: { color: c.dim, fontSize: 13 },
  input: {
    color: c.text,
    backgroundColor: c.bg,
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  btn: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.line },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
});
