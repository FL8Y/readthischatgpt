import React, { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BankItem } from '../../bank/schema';
import { Btn } from '../kit';
import { PressableScale, haptic } from '../kitParts';
import { radius, space, useTheme } from '../theme';
import { clozeSource, partVerdicts, slotsOf, splitCloze } from './caseLogic';

export interface ClozeLineProps {
  item: BankItem;
  selected: number[];
  locked: boolean;
  showVerdict: boolean;
  onSelect: (blank: number, choice: number) => void;
}

/** The sentence with a dropdown chip at each blank. Tapping a chip opens a bottom-sheet list of choices. */
export function ClozeLine({ item, selected, locked, showVerdict, onSelect }: ClozeLineProps) {
  const { colors, type } = useTheme();
  const [open, setOpen] = useState<number | null>(null);
  const blanks = item.blanks ?? [];
  const sel = slotsOf(item, selected);
  const verdicts = showVerdict ? partVerdicts(item, selected) : [];
  const text = clozeSource(item) === 'vignette' ? item.vignette : item.stem;
  const parts = splitCloze(text, blanks.length);
  const active = open !== null ? blanks[open] : undefined;

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: space.sm }}>
        {parts.map((p, k) => {
          if (p.kind === 'text') {
            return p.text.split(/(\s+)/).filter(Boolean).map((w, j) => (
              <Text key={`${k}-${j}`} style={[type('body'), { color: colors.text }]}>{w}</Text>
            ));
          }
          const b = blanks[p.index];
          const picked = sel[p.index];
          const v = verdicts[p.index];
          const shown = picked >= 0 ? b.choices[picked] : 'Choose';
          const border = v === 'correct' ? colors.success : v ? colors.danger : picked >= 0 ? colors.accent : colors.border;
          const bg = v === 'correct' ? colors.successSoft : v ? colors.dangerSoft : picked >= 0 ? colors.accentSoft : colors.surfaceAlt;
          const word = v === 'correct' ? 'Correct' : v === 'wrong' ? `Not correct. Answer: ${b.choices[b.answer]}` : v === 'blank' ? `Not answered. Answer: ${b.choices[b.answer]}` : '';
          return (
            <PressableScale
              key={`${k}-b`}
              accessibilityRole="button"
              accessibilityLabel={`Blank ${p.index + 1} of ${blanks.length}. ${picked >= 0 ? `Chosen: ${shown}.` : 'Nothing chosen.'}${word ? ` ${word}.` : ''}`}
              accessibilityHint={locked ? undefined : 'Opens a list of choices'}
              accessibilityState={{ disabled: locked }}
              scaleTo={0.97}
              onPress={() => {
                if (locked) return;
                haptic('tap');
                setOpen(p.index);
              }}
              style={{
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.xs,
                paddingHorizontal: space.md,
                marginHorizontal: space.xs,
                borderRadius: radius.pill,
                borderWidth: 2,
                borderColor: border,
                backgroundColor: bg,
              }}
            >
              {v ? <Ionicons name={v === 'correct' ? 'checkmark-circle' : 'close-circle'} size={16} color={v === 'correct' ? colors.success : colors.danger} /> : null}
              <Text style={[type('bodyStrong'), { color: picked >= 0 ? colors.accentText : colors.textDim }]}>{shown}</Text>
              {!locked ? <Ionicons name="chevron-down" size={16} color={colors.textDim} /> : null}
            </PressableScale>
          );
        })}
      </View>

      {showVerdict ? (
        <View style={{ gap: 2 }}>
          {blanks.map((b, i) => (
            <Text key={i} style={[type('caption'), { color: verdicts[i] === 'correct' ? colors.success : colors.danger }]}>
              {verdicts[i] === 'correct' ? '✓' : '✗'} Blank {i + 1}: {verdicts[i] === 'correct' ? 'correct' : `not correct, answer: ${b.choices[b.answer]}`}
            </Text>
          ))}
        </View>
      ) : null}

      <Modal visible={open !== null} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
          <View
            accessibilityViewIsModal
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, gap: space.sm, maxHeight: '70%' }}
          >
            <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>
              {open !== null ? `Blank ${open + 1} of ${blanks.length}` : ''}
            </Text>
            <ScrollView contentContainerStyle={{ gap: space.sm }}>
              {(active?.choices ?? []).map((c, i) => {
                const on = open !== null && sel[open] === i;
                return (
                  <PressableScale
                    key={i}
                    accessibilityRole="radio"
                    accessibilityLabel={`Choice ${c}. ${on ? 'Selected.' : 'Not selected.'}`}
                    accessibilityState={{ checked: on }}
                    scaleTo={0.985}
                    onPress={() => {
                      if (open === null) return;
                      haptic('tap');
                      onSelect(open, i);
                      setOpen(null);
                    }}
                    style={{
                      minHeight: 48,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.md,
                      padding: space.md,
                      borderRadius: radius.md,
                      borderWidth: on ? 2 : 1,
                      borderColor: on ? colors.accent : colors.border,
                      backgroundColor: on ? colors.accentSoft : colors.surface,
                    }}
                  >
                    <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.accentText : colors.textDim} />
                    <Text style={[type('body'), { color: colors.text, flex: 1 }]}>{c}</Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
            <Btn label="Close list" kind="ghost" onPress={() => setOpen(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
