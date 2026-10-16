import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Question } from '../core/types';
import { kindOf, presentationOrder, type Answer } from '../core/grading';
import { BLANK_MARK } from '../core/questionParse';
import { Btn, Field, PressableScale, haptic } from './kit';
import { radius, space, TOUCH_MIN, useTheme } from './theme';

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export type TileState = 'idle' | 'selected' | 'correct' | 'wrong' | 'ruledout' | 'dim';

/**
 * One tappable answer. State is shown three ways: colour, an icon in the badge, and a text tag.
 * `badge` is the letter (A-D) or a number; the badge swaps to a check / cross when graded.
 */
export function AnswerTile({
  label,
  badge,
  state = 'idle',
  tag,
  onPress,
  disabled,
  a11y,
}: {
  label: string;
  badge?: string;
  state?: TileState;
  tag?: string;
  onPress?: () => void;
  disabled?: boolean;
  a11y?: string;
}) {
  const { colors, type } = useTheme();
  const look = {
    idle: { bg: colors.surface, border: colors.border, badgeBg: colors.surfaceAlt, badgeFg: colors.textDim, fg: colors.text },
    selected: { bg: colors.accentSoft, border: colors.accent, badgeBg: colors.accent, badgeFg: colors.onAccent, fg: colors.text },
    correct: { bg: colors.successSoft, border: colors.success, badgeBg: colors.success, badgeFg: colors.successSoft, fg: colors.text },
    wrong: { bg: colors.dangerSoft, border: colors.danger, badgeBg: colors.danger, badgeFg: colors.dangerSoft, fg: colors.text },
    ruledout: { bg: colors.surfaceAlt, border: colors.border, badgeBg: colors.surfaceAlt, badgeFg: colors.textDim, fg: colors.textDim },
    dim: { bg: colors.surface, border: colors.border, badgeBg: colors.surfaceAlt, badgeFg: colors.textDim, fg: colors.textDim },
  }[state];
  const icon = state === 'correct' ? 'checkmark' : state === 'wrong' ? 'close' : state === 'ruledout' ? 'remove' : null;
  const tagText = tag ?? (state === 'ruledout' ? 'Ruled out' : undefined);
  const tagColor = state === 'correct' ? colors.success : state === 'wrong' ? colors.danger : colors.textDim;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y ?? [badge ? `Option ${badge}` : '', label, tagText].filter(Boolean).join('. ')}
      accessibilityState={{ selected: state === 'selected', disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.98}
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.md,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: look.border,
        backgroundColor: look.bg,
        opacity: state === 'dim' ? 0.7 : 1,
      }}
    >
      {badge || icon ? (
        <View style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: look.badgeBg, alignItems: 'center', justifyContent: 'center' }}>
          {icon ? (
            <Ionicons name={icon} size={18} color={look.badgeFg} />
          ) : (
            <Text style={[type('label', 'semibold'), { color: look.badgeFg }]}>{badge}</Text>
          )}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type('body'), { color: look.fg, textDecorationLine: state === 'ruledout' ? 'line-through' : 'none' }]}>{label}</Text>
        {tagText ? <Text style={[type('caption', 'semibold'), { color: tagColor }]}>{tagText}</Text> : null}
      </View>
    </PressableScale>
  );
}

export interface InputProps {
  q: Question;
  seed: string;
  locked: boolean;
  /** Reports the current complete answer, or null while it is incomplete. The sticky Check button submits it. */
  onChange: (a: Answer | null) => void;
}

export function TypingInput({ locked, onChange }: InputProps) {
  const [text, setText] = useState('');
  useEffect(() => onChange(text.trim() ? text : null), [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Field label="Your answer" value={text} onChangeText={setText} editable={!locked} autoCapitalize="none" autoCorrect={false} placeholder="Type your answer" />;
}

export function ClozeInput({ q, locked, onChange }: InputProps) {
  const { colors, type } = useTheme();
  const n = q.blanks?.length ?? 0;
  const [vals, setVals] = useState<string[]>(() => Array.from({ length: n }, () => ''));
  useEffect(() => onChange(vals.every((v) => v.trim()) ? vals : null), [vals]); // eslint-disable-line react-hooks/exhaustive-deps
  const parts = q.stem.split(BLANK_MARK);
  const shown = parts.map((p, k) => (k < parts.length - 1 ? `${p}(${k + 1})` : p)).join('');
  return (
    <View style={{ gap: space.md }}>
      <Text style={[type('headline', 'medium'), { color: colors.text }]}>{shown}</Text>
      {vals.map((v, k) => (
        <Field
          key={k}
          label={`Blank ${k + 1}`}
          value={v}
          editable={!locked}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(t) => setVals((cur) => cur.map((x, j) => (j === k ? t : x)))}
        />
      ))}
    </View>
  );
}

const Hint = ({ children }: { children: string }) => {
  const { colors, type } = useTheme();
  return <Text style={[type('label'), { color: colors.textDim }]}>{children}</Text>;
};

/** Tap a left item, then tap its match on the right. Answers are canonical pair indices. */
export function MatchingInput({ q, seed, locked, onChange }: InputProps) {
  const pairs = q.pairs ?? [];
  const [assign, setAssign] = useState<(number | null)[]>(() => pairs.map(() => null));
  const [sel, setSel] = useState<number | null>(0);
  const order = useRef(presentationOrder(pairs.length, seed)).current;
  useEffect(() => onChange(assign.every((v) => v !== null) ? (assign as number[]) : null), [assign]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickRight = (ri: number) => {
    if (locked || sel === null) return;
    haptic('tap');
    const next = assign.map((v) => (v === ri ? null : v));
    next[sel] = ri;
    setAssign(next);
    const nextFree = next.findIndex((v, k) => v === null && k !== sel);
    setSel(nextFree >= 0 ? nextFree : null);
  };

  return (
    <View style={{ gap: space.sm }}>
      <Hint>{locked ? 'Your matches' : 'Tap an item, then tap its match below.'}</Hint>
      {pairs.map((p, k) => {
        const m = assign[k];
        const label = m === null ? `${p.left}  →  ?` : `${p.left}  →  ${pairs[m].right}`;
        const state: TileState = locked ? (m === k ? 'correct' : 'wrong') : sel === k ? 'selected' : 'idle';
        return (
          <AnswerTile
            key={k}
            label={label}
            badge={String(k + 1)}
            state={state}
            tag={locked ? (m === k ? 'Correct match' : 'Not a match') : undefined}
            a11y={
              m === null
                ? `${p.left}, not matched yet${sel === k ? ', selected' : ''}`
                : `${p.left}, matched to ${pairs[m].right}${sel === k ? ', selected' : ''}`
            }
            disabled={locked}
            onPress={() => setSel(k)}
          />
        );
      })}
      {!locked ? (
        <>
          <Hint>Matches</Hint>
          {order.map((ri) => (
            <AnswerTile
              key={ri}
              label={pairs[ri].right}
              state={assign.includes(ri) ? 'dim' : 'idle'}
              tag={assign.includes(ri) ? 'Used' : undefined}
              a11y={`Match option: ${pairs[ri].right}${assign.includes(ri) ? ', already used' : ''}`}
              disabled={sel === null}
              onPress={() => pickRight(ri)}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

/** Tap items in the order you think is right; tap a placed item to take it back. Answers are canonical item indices. */
export function OrderingInput({ q, seed, locked, onChange }: InputProps) {
  const items = q.items ?? [];
  const [placed, setPlaced] = useState<number[]>([]);
  const order = useRef(presentationOrder(items.length, seed)).current;
  useEffect(() => onChange(placed.length === items.length && items.length > 0 ? placed : null), [placed]); // eslint-disable-line react-hooks/exhaustive-deps
  const pool = order.filter((i) => !placed.includes(i));
  return (
    <View style={{ gap: space.sm }}>
      <Hint>{locked ? 'Your order' : 'Tap items in order, first to last. Tap a placed item to remove it.'}</Hint>
      {placed.map((idx, pos) => (
        <AnswerTile
          key={idx}
          label={items[idx]}
          badge={String(pos + 1)}
          state={locked ? (idx === pos ? 'correct' : 'wrong') : 'selected'}
          tag={locked ? (idx === pos ? 'Right place' : 'Wrong place') : undefined}
          a11y={`Position ${pos + 1}: ${items[idx]}. ${locked ? '' : 'Tap to remove.'}`}
          disabled={locked}
          onPress={() => setPlaced((cur) => cur.filter((x) => x !== idx))}
        />
      ))}
      {!locked ? (
        <>
          {pool.length ? <Hint>Left to place</Hint> : null}
          {pool.map((idx) => (
            <AnswerTile
              key={idx}
              label={items[idx]}
              a11y={`Place: ${items[idx]}`}
              onPress={() => {
                haptic('tap');
                setPlaced((cur) => [...cur, idx]);
              }}
            />
          ))}
          {placed.length ? <Btn label="Reset order" kind="ghost" onPress={() => setPlaced([])} /> : null}
        </>
      ) : null}
    </View>
  );
}

/** Plain-text rendering of what the learner answered, for the Explain prompt. */
export function answerText(q: Question, a: Answer): string {
  switch (kindOf(q)) {
    case 'matching':
      return (a as number[]).map((m, k) => `${q.pairs?.[k]?.left} = ${q.pairs?.[m]?.right}`).join('; ');
    case 'ordering':
      return (a as number[]).map((i, pos) => `${pos + 1}. ${q.items?.[i]}`).join('; ');
    case 'cloze':
      return (a as string[]).map((v, k) => `${k + 1}. ${v}`).join('; ');
    case 'choice':
      return q.choices[a as number] ?? '';
    default:
      return String(a);
  }
}

export { TOUCH_MIN };
