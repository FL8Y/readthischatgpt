import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Btn, PressableScale, haptic } from '../kit';
import { BOTTOM_INSET } from '../kitParts';
import { radius, space, useTheme } from '../theme';
import type { PracticeSession } from '../../bank/session';
import { canJumpTo, mapCells, mapCounts } from './playerLogic';

/** Bottom-sheet grid of every question: answered / not answered / flagged, shown with glyph and word. */
export function QuestionMap({ session, visible, onJump, onClose }: {
  session: PracticeSession;
  visible: boolean;
  onJump: (index: number) => void;
  onClose: () => void;
}) {
  const { colors, type } = useTheme();
  const cells = mapCells(session);
  const n = mapCounts(session);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close question map" onPress={onClose} style={{ flex: 1, backgroundColor: colors.scrim }} />
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          padding: space.lg,
          gap: space.md,
          maxHeight: '75%',
          paddingBottom: space.lg + BOTTOM_INSET,
        }}
      >
        <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>Question map</Text>
        <Text style={[type('caption'), { color: colors.textDim }]}>
          {`✓ answered ${n.answered}   ○ not answered ${n.unanswered}   ⚑ flagged ${n.flagged}`}
        </Text>
        <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {cells.map((cell) => {
            const ok = canJumpTo(session, cell.index);
            return (
              <PressableScale
                key={cell.id}
                accessibilityRole="button"
                accessibilityLabel={cell.label}
                accessibilityState={{ disabled: !ok, selected: cell.current }}
                disabled={!ok}
                onPress={() => {
                  haptic('tap');
                  onJump(cell.index);
                }}
                style={{
                  width: 64,
                  minHeight: 56,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: cell.current ? 2 : 1,
                  borderColor: cell.current ? colors.accent : colors.border,
                  backgroundColor: cell.state === 'answered' ? colors.accentSoft : colors.surfaceAlt,
                  opacity: ok ? 1 : 0.4,
                }}
              >
                <Text style={[type('bodyStrong'), { color: colors.text }]}>{cell.index + 1}</Text>
                <Text style={[type('caption'), { color: cell.flagged ? colors.warning : colors.textDim }]}>{cell.glyph}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>
        {session.mode === 'mock' ? (
          <Text style={[type('caption'), { color: colors.textDim }]}>Mock mode: you can only jump forward.</Text>
        ) : null}
        <Btn label="Close" kind="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}
