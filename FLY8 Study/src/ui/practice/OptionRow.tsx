import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale, haptic } from '../kitParts';
import { radius, space, useTheme } from '../theme';
import { VERDICT_WORD, optionLetter, type OptionVerdict } from './playerLogic';

export interface OptionRowProps {
  index: number;
  text: string;
  multi: boolean;
  selected: boolean;
  struck: boolean;
  /** Set after feedback is shown. */
  verdict?: OptionVerdict;
  disabled?: boolean;
  onPress: () => void;
  /** Long-press toggles strike-through. Omit when locked. */
  onStrike?: () => void;
}

/** One lettered answer. Radio (single) or checkbox (sata) glyph; results use icon + words, not colour alone. */
export function OptionRow({ index, text, multi, selected, struck, verdict = 'neutral', disabled, onPress, onStrike }: OptionRowProps) {
  const { colors, type } = useTheme();
  const hasVerdict = verdict !== 'neutral';
  const good = verdict === 'correct' || verdict === 'missed';
  const bad = verdict === 'wrong';
  const border = good ? colors.success : bad ? colors.danger : selected ? colors.accent : colors.border;
  const bg = good ? colors.successSoft : bad ? colors.dangerSoft : selected ? colors.accentSoft : colors.surface;
  const icon = multi
    ? selected ? 'checkbox' : 'square-outline'
    : selected ? 'radio-button-on' : 'radio-button-off';
  const word = VERDICT_WORD[verdict];
  const label = `Option ${optionLetter(index)}. ${text}. ${selected ? 'Selected.' : 'Not selected.'}${struck ? ' Crossed out.' : ''}${word ? ` ${word}.` : ''}`;
  const actions = onStrike ? [{ name: 'longpress', label: struck ? 'Restore option' : 'Cross out option' }] : undefined;
  return (
    <PressableScale
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityLabel={label}
      accessibilityHint={onStrike ? 'Long press to cross out or restore' : undefined}
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityActions={actions}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'longpress') onStrike?.();
      }}
      onPress={() => {
        if (disabled || struck) return;
        haptic('tap');
        onPress();
      }}
      onLongPress={() => {
        if (!onStrike) return;
        haptic('tap');
        onStrike();
      }}
      scaleTo={0.985}
      style={{
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: selected || hasVerdict ? 2 : 1,
        borderColor: border,
        backgroundColor: bg,
      }}
    >
      <Ionicons name={icon} size={24} color={selected ? colors.accentText : colors.textDim} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[
            type('body'),
            { color: struck ? colors.textDim : colors.text, textDecorationLine: struck ? 'line-through' : 'none' },
          ]}
        >
          <Text style={type('bodyStrong')}>{optionLetter(index)}.  </Text>
          {text}
        </Text>
        {struck ? <Text style={[type('caption'), { color: colors.textDim }]}>Crossed out (long press to restore)</Text> : null}
        {word ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Ionicons name={bad ? 'close-circle' : 'checkmark-circle'} size={16} color={bad ? colors.danger : colors.success} />
            <Text style={[type('label'), { color: bad ? colors.danger : colors.success }]}>{word}</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}
