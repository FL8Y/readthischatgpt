import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BankItem } from '../../bank/schema';
import type { SessionResult } from '../../bank/results';
import type { OverallReadiness } from '../../bank/readiness';
import { GRID_LOOK, GRID_ORDER, formatDuration, gridCounts, readinessText } from '../../bank/statsData';
import { Chip, PressableScale, ProgressRing } from '../kitParts';
import { radius, shadow, space, TOUCH_MIN, useTheme } from '../theme';
import { AreaBars } from './StatsCharts';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, type, scheme } = useTheme();
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md }, shadow(scheme)]}>
      <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Button({ label, onPress, primary, icon }: { label: string; onPress: () => void; primary?: boolean; icon?: React.ComponentProps<typeof Ionicons>['name'] }) {
  const { colors, type } = useTheme();
  const fg = primary ? colors.onAccent : colors.accentText;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flex: 1, minHeight: TOUCH_MIN, borderRadius: radius.md, flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center',
        backgroundColor: primary ? colors.accent : colors.surface, borderWidth: primary ? 0 : 2, borderColor: colors.accent, paddingHorizontal: space.md,
      }}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[type('bodyStrong'), { color: fg }]}>{label}</Text>
    </PressableScale>
  );
}

/** End-of-session report: score, readiness, areas, what to review, review grid, patterns. */
export function Results({ result, items, onReviewItem, onRetryMissed, onDone, onAskTutor, readiness }: {
  result: SessionResult;
  items: readonly BankItem[];
  /** Open the note (or the question review) for this item id. */
  onReviewItem: (itemId: string) => void;
  onRetryMissed: () => void;
  onDone: () => void;
  onAskTutor?: (itemId: string) => void;
  /** Optional: pass readiness() to show the estimate instead of the locked text. */
  readiness?: OverallReadiness;
}) {
  const { colors, type } = useTheme();
  const rt = readinessText(readiness);
  const counts = gridCounts(result.grid);
  const pct = Math.round(result.percent);
  const byId = new Map(items.map((i) => [i.id, i]));
  const firstMissed = (topic: string): string | undefined => result.missedIds.find((id) => byId.get(id)?.topic === topic);
  const tone = pct >= 75 ? colors.success : pct >= 60 ? colors.warning : colors.danger;
  const verdict = pct >= 75 ? 'Strong result' : pct >= 60 ? 'Getting there' : 'Needs more practice';
  const missedCount = result.missedIds.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl, gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <ProgressRing value={pct / 100} size={104} stroke={10} label={`Score ${pct} percent by credit`}>
            <Text style={[type('title'), { color: colors.text }]}>{pct}%</Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: 2 }}>
            <Text accessibilityRole="header" style={[type('title'), { color: tone }]}>{verdict}</Text>
            <Text style={[type('body'), { color: colors.text }]}>
              {result.correctCount} of {result.total} fully correct · {result.points} points
            </Text>
            <Text style={[type('caption'), { color: colors.textDim }]}>
              {result.answeredCount} answered · {formatDuration(result.seconds)} · score counts partial credit
            </Text>
          </View>
        </View>

        <Chip text={`${rt.headline}`} tone={rt.locked ? 'neutral' : 'accent'} icon={rt.locked ? 'lock-closed-outline' : 'speedometer-outline'} />
        <Text style={[type('caption'), { color: colors.textDim }]}>{rt.detail}</Text>

        {result.areaBars.length > 0 ? (
          <Section title="By area">
            <AreaBars rows={result.areaBars.map((a) => ({ area: a.area, percent: a.percent, answered: a.answered }))} />
          </Section>
        ) : null}

        <Section title="What to review">
          {result.review.length === 0 ? (
            <Text style={[type('body'), { color: colors.text }]}>Nothing to review. Every answered question earned full credit.</Text>
          ) : (
            result.review.map((r) => {
              const id = firstMissed(r.topic);
              return (
                <View key={r.topic} style={{ gap: 2 }}>
                  <Text style={[type('bodyStrong'), { color: colors.text }]}>{r.topic}</Text>
                  <Text style={[type('caption'), { color: colors.textDim }]}>{r.missed} {r.missed === 1 ? 'question' : 'questions'} below full credit</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg }}>
                    {id ? (
                      <PressableScale
                        accessibilityRole="link"
                        accessibilityLabel={`Read the note for ${r.topic}`}
                        onPress={() => onReviewItem(id)}
                        style={{ minHeight: TOUCH_MIN, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
                      >
                        <Ionicons name="book-outline" size={18} color={colors.accentText} />
                        <Text style={[type('bodyStrong'), { color: colors.accentText }]}>Read the note</Text>
                      </PressableScale>
                    ) : null}
                    {id && onAskTutor ? (
                      <PressableScale
                        accessibilityRole="link"
                        accessibilityLabel={`Ask the tutor about ${r.topic}`}
                        onPress={() => onAskTutor(id)}
                        style={{ minHeight: TOUCH_MIN, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.accentText} />
                        <Text style={[type('bodyStrong'), { color: colors.accentText }]}>Ask tutor</Text>
                      </PressableScale>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </Section>

        <Section title="Review grid">
          <View accessibilityRole="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {result.grid.map((g) => {
              const look = GRID_LOOK[g.status];
              const under = GRID_LOOK[g.outcome];
              const bg = g.outcome === 'correct' ? colors.successSoft : g.outcome === 'wrong' ? colors.dangerSoft : g.outcome === 'partial' ? colors.warningSoft : colors.surfaceAlt;
              const fg = g.outcome === 'correct' ? colors.success : g.outcome === 'wrong' ? colors.danger : g.outcome === 'partial' ? colors.warning : colors.textDim;
              return (
                <PressableScale
                  key={g.itemId}
                  accessibilityRole="button"
                  accessibilityLabel={`Question ${g.number}: ${under.word}${g.flagged ? ', flagged' : ''}. Open review`}
                  onPress={() => onReviewItem(g.itemId)}
                  scaleTo={0.94}
                  style={{ width: TOUCH_MIN, height: TOUCH_MIN, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: g.flagged ? 2 : 1, borderColor: g.flagged ? colors.accent : colors.border }}
                >
                  <Text style={[type('label'), { color: fg }]}>{g.number}</Text>
                  <Text style={[type('caption'), { color: fg }]}>{g.flagged ? `${GRID_LOOK[g.outcome].glyph}${look.glyph}` : look.glyph}</Text>
                </PressableScale>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            {GRID_ORDER.map((s) => (
              <Text key={s} style={[type('caption'), { color: colors.textDim }]}>
                {GRID_LOOK[s].glyph} {GRID_LOOK[s].word} {counts[s]}
              </Text>
            ))}
          </View>
        </Section>

        {result.patterns.length > 0 ? (
          <Section title="Patterns in your misses">
            {result.patterns.map((p) => (
              <View key={p.strategy} style={{ gap: space.xs }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  <Chip text={`Strategy: ${p.strategy}`} tone="accent" icon="bulb-outline" />
                  {p.recurring ? <Chip text="Seen before" tone="warning" icon="repeat-outline" /> : null}
                </View>
                <Text style={[type('body'), { color: colors.text }]}>{p.message}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        <View style={{ flexDirection: 'row', gap: space.md }}>
          {missedCount > 0 ? <Button label={`Retry missed (${missedCount})`} icon="refresh" onPress={onRetryMissed} /> : null}
          <Button label="Done" primary icon="checkmark" onPress={onDone} />
        </View>
      </ScrollView>
    </View>
  );
}
