import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StatusBar, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Rect as SvgRect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TOUCH_MIN, radius, shadow, space, useTheme } from './theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Light haptic tap. Never throws; does nothing on web or when unsupported (UNTESTED on a real device). */
export function haptic(kind: 'tap' | 'success' | 'error' = 'tap'): void {
  if (Platform.OS === 'web') return;
  try {
    const p =
      kind === 'tap'
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    void p.catch(() => undefined);
  } catch {
    // haptics are a nicety, never a failure
  }
}

/** A full-screen flow (the quiz) sets this so the app shell can hide its header and tab bar. */
export const ImmersiveCtx = React.createContext<(on: boolean) => void>(() => undefined);

/** Safe-area stand-ins (no safe-area library in the project). */
export const TOP_INSET = Platform.select({ android: Math.max(StatusBar.currentHeight ?? 0, 28) + 6, ios: 54, default: 16 }) as number;
export const BOTTOM_INSET = Platform.select({ android: 8, ios: 22, default: 8 }) as number;

/** Pressable that shrinks slightly while pressed. Respects reduced motion. */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  onPress,
  ...rest
}: React.ComponentProps<typeof Pressable> & { scaleTo?: number; style?: StyleProp<ViewStyle> }) {
  const { reduceMotion } = useTheme();
  const v = useRef(new Animated.Value(1)).current;
  const to = (n: number) => {
    if (reduceMotion) return;
    Animated.timing(v, { toValue: n, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start();
  };
  return (
    <Pressable {...rest} onPress={onPress} onPressIn={() => to(scaleTo)} onPressOut={() => to(1)}>
      <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children as React.ReactNode}</Animated.View>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = 'plain',
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'plain' | 'tinted';
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={{
        width: TOUCH_MIN,
        height: TOUCH_MIN,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone === 'tinted' ? colors.surfaceAlt : 'transparent',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Ionicons name={icon} size={24} color={colors.text} />
    </PressableScale>
  );
}

/** Small label with an optional icon. Colour is never the only signal when `icon` is given. */
export function Chip({
  text,
  tone = 'neutral',
  icon,
}: {
  text: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  icon?: IconName;
}) {
  const { colors, type } = useTheme();
  const map = {
    neutral: [colors.surfaceAlt, colors.textDim],
    accent: [colors.accentSoft, colors.accentText],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View
      accessible
      accessibilityLabel={text}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: space.xs,
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: space.md,
        paddingVertical: space.xs + 1,
        maxWidth: '100%',
      }}
    >
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text style={[type('label'), { color: fg, flexShrink: 1 }]}>{text}</Text>
    </View>
  );
}

/** Compact number tile: icon, big value, small label. */
export function StatTile({ icon, value, label, tone = 'accent' }: { icon: IconName; value: string; label: string; tone?: 'accent' | 'warning' | 'success' }) {
  const { colors, type, scheme } = useTheme();
  const fg = tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : colors.accentText;
  const bg = tone === 'warning' ? colors.warningSoft : tone === 'success' ? colors.successSoft : colors.accentSoft;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[
        { flex: 1, minWidth: 0, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.border },
        shadow(scheme),
      ]}
    >
      <View style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={fg} />
      </View>
      <View>
        <Text style={[type('title'), { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={[type('caption'), { color: colors.textDim }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Circular progress. `value` 0..1. Children are drawn in the centre. */
export function ProgressRing({
  value,
  size = 72,
  stroke = 8,
  label,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ * v} ${circ}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Row with icon, title, optional detail and chevron. Whole row is the touch target. */
export function ListRow({
  icon,
  title,
  detail,
  onPress,
  disabled,
  trailing,
  badge,
}: {
  icon?: IconName;
  title: string;
  detail?: string;
  onPress?: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
  badge?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[title, detail, badge].filter(Boolean).join('. ')}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      scaleTo={0.985}
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, opacity: disabled ? 0.55 : 1 }}
    >
      {icon ? (
        <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color={colors.accentText} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type('bodyStrong'), { color: colors.text }]}>{title}</Text>
        {detail ? <Text style={[type('caption'), { color: colors.textDim }]}>{detail}</Text> : null}
      </View>
      {badge ? <Chip text={badge} /> : null}
      {trailing ?? (onPress && !disabled ? <Ionicons name="chevron-forward" size={20} color={colors.textDim} /> : null)}
    </PressableScale>
  );
}

/** Hairline separator for lists inside a Card. */
export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

/** Large page title with optional back arrow and a right-hand element. */
export function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ paddingTop: TOP_INSET, paddingHorizontal: space.lg, paddingBottom: space.sm, backgroundColor: colors.bg }}>
      <View style={{ minHeight: TOUCH_MIN, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {onBack ? (
          <View style={{ marginLeft: -space.sm }}>
            <IconButton icon="chevron-back" label="Back" onPress={onBack} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[type('title'), { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[type('caption'), { color: colors.textDim }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export interface TabItem {
  id: string;
  label: string;
  icon: IconName;
  iconOn: IconName;
}

/** Bottom tab bar: icon + label, 48dp+ targets, selected state by colour, weight AND a pill behind the icon. */
export function TabBar({ tabs, active, onChange }: { tabs: TabItem[]; active: string; onChange: (id: string) => void }) {
  const { colors, type } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: space.xs,
        paddingBottom: BOTTOM_INSET,
      }}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptic('tap');
              onChange(t.id);
            }}
            style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 }}
          >
            <View style={{ width: 56, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.accentSoft : 'transparent' }}>
              <Ionicons name={on ? t.iconOn : t.icon} size={22} color={on ? colors.accentText : colors.textDim} />
            </View>
            <Text style={[type('caption', on ? 'semibold' : 'medium'), { color: on ? colors.accentText : colors.textDim }]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom sheet that slides up when mounted. Not a Modal: it sits inside the screen so the question stays visible above it. */
export function Sheet({ children, tone = 'neutral', maxHeight }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'danger'; maxHeight?: number }) {
  const { colors, reduceMotion } = useTheme();
  const y = useRef(new Animated.Value(reduceMotion ? 0 : 48)).current;
  const o = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const nd = Platform.OS !== 'web';
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: nd }),
      Animated.timing(o, { toValue: 1, duration: 200, useNativeDriver: nd }),
    ]).start();
  }, [reduceMotion, y, o]);
  const bg = tone === 'success' ? colors.successSoft : tone === 'danger' ? colors.dangerSoft : colors.surface;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: bg,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        borderTopWidth: 1,
        borderColor: colors.border,
        opacity: o,
        transform: [{ translateY: y }],
        maxHeight,
        overflow: 'hidden',
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Simple shape-built illustrations for empty/error states. */
export function Illustration({ kind }: { kind: 'notes' | 'quiz' | 'error' | 'cards' | 'done' }) {
  const { colors } = useTheme();
  const a = colors.accent;
  const soft = colors.accentSoft;
  const dim = colors.border;
  return (
    <Svg width={132} height={104} viewBox="0 0 132 104" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={66} cy={54} r={46} fill={soft} />
      {kind === 'notes' ? (
        <>
          <Rect x={40} y={26} w={52} h={64} r={8} fill={colors.surface} stroke={dim} />
          <Rect x={48} y={38} w={36} h={5} r={2.5} fill={a} />
          <Rect x={48} y={50} w={30} h={5} r={2.5} fill={dim} />
          <Rect x={48} y={62} w={34} h={5} r={2.5} fill={dim} />
          <Circle cx={96} cy={30} r={11} fill={a} />
          <Rect x={90} y={29} w={12} h={2.5} r={1.2} fill={colors.onAccent} />
          <Rect x={95} y={24} w={2.5} h={12} r={1.2} fill={colors.onAccent} />
        </>
      ) : null}
      {kind === 'quiz' ? (
        <>
          <Rect x={36} y={30} w={60} h={16} r={8} fill={colors.surface} stroke={dim} />
          <Rect x={36} y={52} w={60} h={16} r={8} fill={a} />
          <Rect x={36} y={74} w={60} h={16} r={8} fill={colors.surface} stroke={dim} />
          <Circle cx={46} cy={60} r={4} fill={colors.onAccent} />
        </>
      ) : null}
      {kind === 'cards' ? (
        <>
          <Rect x={46} y={24} w={52} h={66} r={8} fill={colors.surface} stroke={dim} rot={8} />
          <Rect x={36} y={26} w={52} h={66} r={8} fill={colors.surface} stroke={a} />
          <Rect x={44} y={42} w={36} h={5} r={2.5} fill={a} />
          <Rect x={44} y={54} w={26} h={5} r={2.5} fill={dim} />
        </>
      ) : null}
      {kind === 'error' ? (
        <>
          <Circle cx={66} cy={54} r={26} fill={colors.dangerSoft} stroke={colors.danger} strokeWidth={3} />
          <Rect x={63.5} y={40} w={5} h={18} r={2.5} fill={colors.danger} />
          <Circle cx={66} cy={66} r={3} fill={colors.danger} />
        </>
      ) : null}
      {kind === 'done' ? (
        <>
          <Circle cx={66} cy={54} r={26} fill={a} />
          <Rect x={52} y={55} w={16} h={5} r={2.5} fill={colors.onAccent} rot={45} />
          <Rect x={59} y={58} w={26} h={5} r={2.5} fill={colors.onAccent} rot={-50} />
        </>
      ) : null}
    </Svg>
  );
}

/** Row of single-choice number/label chips (radio group). */
export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const { colors, type } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
      {options.map((n) => {
        const on = n === value;
        return (
          <PressableScale
            key={String(n)}
            accessibilityRole="radio"
            accessibilityLabel={`${n}`}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(n)}
            style={{
              minWidth: 56,
              minHeight: TOUCH_MIN,
              paddingHorizontal: space.md,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.md,
              borderWidth: 2,
              borderColor: on ? colors.accent : colors.border,
              backgroundColor: on ? colors.accentSoft : colors.surface,
            }}
          >
            <Text style={[type('bodyStrong'), { color: on ? colors.accentText : colors.text }]}>{n}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Tiny rect helper (rounded, optional rotation about its own centre). */
function Rect({ x, y, w, h, r, fill, stroke, strokeWidth = 1.5, rot }: { x: number; y: number; w: number; h: number; r: number; fill: string; stroke?: string; strokeWidth?: number; rot?: number }) {
  return (
    <SvgRect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke ? strokeWidth : 0}
      rotation={rot}
      origin={rot ? `${x + w / 2}, ${y + h / 2}` : undefined}
    />
  );
}
