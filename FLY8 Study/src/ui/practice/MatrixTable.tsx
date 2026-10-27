import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BankItem } from '../../bank/schema';
import { PressableScale, haptic } from '../kitParts';
import { radius, space, useTheme } from '../theme';
import { partVerdicts, slotsOf } from './caseLogic';

export interface MatrixTableProps {
  item: BankItem;
  selected: number[];
  locked: boolean;
  /** Show right / wrong per row (after feedback). */
  showVerdict: boolean;
  onSelect: (row: number, col: number) => void;
}

/** Rows x columns radio grid. One column per row; every cell is a 48dp radio. Results use glyph plus words. */
export function MatrixTable({ item, selected, locked, showVerdict, onSelect }: MatrixTableProps) {
  const { colors, type } = useTheme();
  const rows = item.rows ?? [];
  const cols = item.columns ?? [];
  const sel = slotsOf(item, selected);
  const verdicts = showVerdict ? partVerdicts(item, selected) : [];
  const answers = item.rowAnswer ?? [];
  return (
    <View style={{ gap: space.md }}>
      {rows.map((row, r) => {
        const v = verdicts[r];
        const border = v === 'correct' ? colors.success : v === 'wrong' || v === 'blank' ? colors.danger : colors.border;
        return (
          <View
            key={r}
            accessibilityRole="radiogroup"
            accessibilityLabel={`Row ${r + 1}: ${row}`}
            style={{ gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: v ? 2 : 1, borderColor: border, backgroundColor: colors.surface }}
          >
            <Text style={[type('bodyStrong'), { color: colors.text }]}>{r + 1}. {row}</Text>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {cols.map((col, c) => {
                const on = sel[r] === c;
                const isKey = showVerdict && answers[r] === c;
                const wrongPick = showVerdict && on && answers[r] !== c;
                const word = showVerdict ? (isKey ? (on ? 'Correct' : 'Correct answer (not chosen)') : wrongPick ? 'Not correct' : '') : '';
                const label = `Row ${r + 1}, ${row}. Column ${col}. ${on ? 'Selected.' : 'Not selected.'}${word ? ` ${word}.` : ''}`;
                return (
                  <PressableScale
                    key={c}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: on, disabled: locked }}
                    scaleTo={0.97}
                    onPress={() => {
                      if (locked) return;
                      haptic('tap');
                      onSelect(r, c);
                    }}
                    style={{
                      flex: 1,
                      minWidth: 48,
                      minHeight: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      paddingVertical: space.sm,
                      paddingHorizontal: space.xs,
                      borderRadius: radius.md,
                      borderWidth: on || isKey ? 2 : 1,
                      borderColor: isKey ? colors.success : wrongPick ? colors.danger : on ? colors.accent : colors.border,
                      backgroundColor: isKey ? colors.successSoft : wrongPick ? colors.dangerSoft : on ? colors.accentSoft : colors.surfaceAlt,
                    }}
                  >
                    <Ionicons
                      name={isKey ? 'checkmark-circle' : wrongPick ? 'close-circle' : on ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={isKey ? colors.success : wrongPick ? colors.danger : on ? colors.accentText : colors.textDim}
                    />
                    <Text style={[type('caption'), { color: colors.text, textAlign: 'center' }]}>{col}</Text>
                  </PressableScale>
                );
              })}
            </View>
            {v ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <Ionicons name={v === 'correct' ? 'checkmark-circle' : 'close-circle'} size={16} color={v === 'correct' ? colors.success : colors.danger} />
                <Text style={[type('label'), { color: v === 'correct' ? colors.success : colors.danger }]}>
                  {v === 'correct' ? 'Correct' : v === 'blank' ? `Not answered. Answer: ${cols[answers[r]] ?? ''}` : `Not correct. Answer: ${cols[answers[r]] ?? ''}`}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
