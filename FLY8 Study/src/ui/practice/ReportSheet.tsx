import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Btn, PressableScale } from '../kit';
import { BOTTOM_INSET } from '../kitParts';
import { radius, space, useTheme } from '../theme';
import { REPORT_KINDS, buildReport, type ItemReport, type ReportKind } from './playerLogic';

export type { ItemReport, ReportKind } from './playerLogic';

/** "Report a problem" sheet: Unclear / Too long / Incorrect / Other plus an optional note. */
export function ReportSheet({ itemId, visible, onSend, onClose }: {
  itemId: string;
  visible: boolean;
  onSend: (report: ItemReport) => void;
  onClose: () => void;
}) {
  const { colors, type } = useTheme();
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const close = () => {
    setKind(null);
    setNote('');
    setSent(false);
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable accessibilityLabel="Close report" onPress={close} style={{ flex: 1, backgroundColor: colors.scrim }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: space.lg,
            gap: space.md,
            paddingBottom: space.lg + BOTTOM_INSET,
          }}
        >
          <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>Report a problem</Text>
          {sent ? (
            <>
              <Text style={[type('body'), { color: colors.text }]}>Thanks. Your report was saved on this phone.</Text>
              <Btn label="Done" onPress={close} />
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {REPORT_KINDS.map((k) => {
                  const on = kind === k.id;
                  return (
                    <PressableScale
                      key={k.id}
                      accessibilityRole="radio"
                      accessibilityLabel={k.label}
                      accessibilityState={{ selected: on }}
                      onPress={() => setKind(k.id)}
                      style={{
                        minHeight: 48,
                        paddingHorizontal: space.lg,
                        justifyContent: 'center',
                        borderRadius: radius.pill,
                        borderWidth: on ? 2 : 1,
                        borderColor: on ? colors.accent : colors.border,
                        backgroundColor: on ? colors.accentSoft : colors.surface,
                      }}
                    >
                      <Text style={[type('bodyStrong'), { color: on ? colors.accentText : colors.text }]}>{on ? '✓ ' : ''}{k.label}</Text>
                    </PressableScale>
                  );
                })}
              </View>
              <TextInput
                accessibilityLabel="Note (optional)"
                placeholder="Add a note (optional)"
                placeholderTextColor={colors.textDim}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={500}
                style={[type('body'), {
                  minHeight: 72, textAlignVertical: 'top', color: colors.text, backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.md, padding: space.md,
                }]}
              />
              <Btn
                label="Send report"
                disabled={!kind}
                onPress={() => {
                  if (!kind) return;
                  onSend(buildReport(itemId, kind, note, Date.now()));
                  setSent(true);
                }}
              />
              <Btn label="Cancel" kind="ghost" onPress={close} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
