import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BankItem } from '../../bank/schema';
import type { SessionAnswer } from '../../bank/session';
import { Chip, PressableScale } from '../kitParts';
import { radius, space, useTheme } from '../theme';
import { ReportSheet, type ItemReport } from './ReportSheet';
import { optionLetter, pointsText, reviewBadge, verdictFor } from './playerLogic';

function LinkRow({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  const { colors, type } = useTheme();
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.98}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
    >
      <Ionicons name={icon} size={18} color={colors.accentText} />
      <Text style={[type('bodyStrong'), { color: colors.accentText }]}>{label}</Text>
    </PressableScale>
  );
}

/** Shown after an answer when feedback is on: verdict, points, why, per-option notes, facts, links. */
export function RationaleCard({ item, answer, onReadNote, onAskTutor, onReport }: {
  item: BankItem;
  answer: SessionAnswer | undefined;
  onReadNote?: (noteId: string) => void;
  onAskTutor?: (itemId: string) => void;
  onReport: (report: ItemReport) => void;
}) {
  const { colors, type } = useTheme();
  const [why, setWhy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const v = verdictFor(answer);
  const tone = v.tone === 'success' ? colors.success : v.tone === 'warning' ? colors.warning : colors.danger;
  const bg = v.tone === 'success' ? colors.successSoft : v.tone === 'warning' ? colors.warningSoft : colors.dangerSoft;
  const icon = v.tone === 'success' ? 'checkmark-circle' : v.tone === 'warning' ? 'alert-circle' : 'close-circle';
  const badge = reviewBadge(item);
  const notes = item.optionRationales.length === item.options.length ? item.optionRationales : [];
  const facts = item.keyFacts ?? [];
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: bg, borderRadius: radius.md, padding: space.md }}>
        <Ionicons name={icon} size={24} color={tone} />
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[type('headline'), { color: tone }]}>{v.word}</Text>
          <Text style={[type('caption'), { color: colors.text }]}>{pointsText(answer?.points ?? 0, !!answer?.hinted)}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {item.strategy ? <Chip text={`Strategy: ${item.strategy}`} tone="accent" icon="bulb-outline" /> : null}
        <Chip text={badge.text} tone={badge.tone} icon={badge.tone === 'success' ? 'shield-checkmark-outline' : 'sparkles-outline'} />
      </View>

      <Text style={[type('body'), { color: colors.text }]}>{item.rationale}</Text>
      {item.beyondNotes ? (
        <Text style={[type('caption'), { color: colors.textDim }]}>Some facts here go beyond your notes. Check them against your textbook.</Text>
      ) : null}

      {notes.length > 0 ? (
        <View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={why ? 'Hide why each option' : 'Why? Show an explanation for each option'}
            accessibilityState={{ expanded: why }}
            onPress={() => setWhy((w) => !w)}
            scaleTo={0.99}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
          >
            <Ionicons name={why ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.accentText} />
            <Text style={[type('bodyStrong'), { color: colors.accentText }]}>Why?</Text>
          </PressableScale>
          {why ? (
            <View style={{ gap: space.sm }}>
              {notes.map((n, i) => {
                const right = item.answer.includes(i);
                return (
                  <View key={i} accessible accessibilityLabel={`Option ${optionLetter(i)}, ${right ? 'correct' : 'not correct'}. ${n}`}
                    style={{ gap: 2, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}>
                    <Text style={[type('label'), { color: right ? colors.success : colors.danger }]}>
                      {right ? '✓' : '✗'} {optionLetter(i)}. {right ? 'Correct' : 'Not correct'}
                    </Text>
                    <Text style={[type('body'), { color: colors.text }]}>{n}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {facts.length > 0 ? (
        <View style={{ gap: space.xs }}>
          <Text style={[type('bodyStrong'), { color: colors.text }]}>Key facts</Text>
          {facts.map((f, i) => (
            <Text key={i} style={[type('body'), { color: colors.text }]}>{'•'} {f}</Text>
          ))}
        </View>
      ) : null}

      <View>
        {item.noteId && onReadNote ? <LinkRow icon="book-outline" label="Read the note" onPress={() => onReadNote(item.noteId as string)} /> : null}
        {onAskTutor ? <LinkRow icon="chatbubble-ellipses-outline" label="Ask tutor" onPress={() => onAskTutor(item.id)} /> : null}
        <LinkRow icon="flag-outline" label="Report a problem" onPress={() => setReporting(true)} />
      </View>
      <ReportSheet itemId={item.id} visible={reporting} onSend={onReport} onClose={() => setReporting(false)} />
    </View>
  );
}
