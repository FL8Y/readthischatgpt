import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BankItem } from '../../bank/schema';
import { Btn } from '../kit';
import { PressableScale, haptic } from '../kitParts';
import { radius, space, useTheme } from '../theme';
import { VERDICT_WORD, optionVerdict } from './playerLogic';

export interface HighlightTextProps {
  item: BankItem;
  selected: number[];
  locked: boolean;
  showVerdict: boolean;
  onToggle: (idx: number) => void;
  /** Confirms the highlights (submits the answer). */
  onDone: () => void;
}

/** Tap segments to highlight or un-highlight them, then press Done. Results use icon plus words. */
export function HighlightText({ item, selected, locked, showVerdict, onToggle, onDone }: HighlightTextProps) {
  const { colors, type } = useTheme();
  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: space.sm }}>
        {item.options.map((text, i) => {
          const on = selected.includes(i);
          const verdict = showVerdict ? optionVerdict(item, selected, i) : 'neutral';
          const word = VERDICT_WORD[verdict];
          const good = verdict === 'correct' || verdict === 'missed';
          const bad = verdict === 'wrong';
          const border = good ? colors.success : bad ? colors.danger : on ? colors.warning : colors.border;
          const bg = good ? colors.successSoft : bad ? colors.dangerSoft : on ? colors.warningSoft : colors.surface;
          return (
            <PressableScale
              key={i}
              accessibilityRole="checkbox"
              accessibilityLabel={`Segment ${i + 1}. ${text}. ${on ? 'Highlighted.' : 'Not highlighted.'}${word ? ` ${word}.` : ''}`}
              accessibilityState={{ checked: on, disabled: locked }}
              scaleTo={0.985}
              onPress={() => {
                if (locked) return;
                haptic('tap');
                onToggle(i);
              }}
              style={{
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: space.md,
                padding: space.md,
                borderRadius: radius.md,
                borderWidth: on || verdict !== 'neutral' ? 2 : 1,
                borderStyle: on || verdict !== 'neutral' ? 'solid' : 'dashed',
                borderColor: border,
                backgroundColor: bg,
              }}
            >
              <Ionicons name={on ? 'color-fill' : 'color-fill-outline'} size={22} color={on ? colors.warning : colors.textDim} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type('body'), { color: colors.text }]}>{text}</Text>
                {word ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                    <Ionicons name={bad ? 'close-circle' : 'checkmark-circle'} size={16} color={bad ? colors.danger : colors.success} />
                    <Text style={[type('label'), { color: bad ? colors.danger : colors.success }]}>{word}</Text>
                  </View>
                ) : null}
              </View>
            </PressableScale>
          );
        })}
      </View>
      {!locked ? (
        <View accessibilityLiveRegion="polite">
          <Text style={[type('caption'), { color: colors.textDim, marginBottom: space.sm }]}>
            {selected.length === 0 ? 'Nothing highlighted yet.' : `${selected.length} highlighted.`}
          </Text>
          <Btn label="Done" onPress={onDone} disabled={selected.length === 0} hint="Confirm your highlights and check the answer" />
        </View>
      ) : null}
    </View>
  );
}
