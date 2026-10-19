import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { readiness, READINESS_FLOOR } from '../../bank/readiness';
import type { Area, BankItem } from '../../bank/schema';
import { goalDays, goalProgress, type StreakInfo } from '../../bank/streak';
import { rankStats, tierFor } from '../../bank/ranks';
import { areaAccuracy, readinessText, topicStats, trendDays } from '../../bank/statsData';
import type { AttemptRecord } from '../../bank/types2';
import { Chip, PressableScale, ProgressRing } from '../kitParts';
import { radius, shadow, space, TOUCH_MIN, useTheme } from '../theme';
import { AreaBars, ReadinessRing, TrendChart, readinessAreaNote } from './StatsCharts';

const TOPIC_PAGE = 12;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, type, scheme } = useTheme();
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md }, shadow(scheme)]}>
      <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

/** My stats: readiness ring, area accuracy, 14-day trend, goal and streak, topic list. */
export function Stats({ attempts, items, today, goal, streak, onPracticeTopic }: {
  attempts: readonly AttemptRecord[];
  items: readonly BankItem[];
  /** Manila dayKey, 'YYYY-MM-DD'. */
  today: string;
  goal: { perDay: number };
  streak: StreakInfo;
  onPracticeTopic: (topic: string, area: string) => void;
}) {
  const { colors, type } = useTheme();
  const [shown, setShown] = useState(TOPIC_PAGE);
  const now = useMemo(() => Date.parse(`${today}T23:59:59+08:00`), [today]);
  const ready = useMemo(() => readiness(items, attempts, now), [items, attempts, now]);
  const rt = readinessText(ready);
  const areas = useMemo(() => areaAccuracy(attempts), [attempts]);
  const trend = useMemo(() => trendDays(attempts, today), [attempts, today]);
  const topics = useMemo(() => topicStats(attempts, items), [attempts, items]);
  const gp = goalProgress(attempts, today, goal);
  const week = goalDays(attempts, today, goal, 7);
  const rank = tierFor(rankStats(attempts, streak.current));
  const lockedNote = (a: string) => {
    const r = ready.areas.find((x) => x.area === (a as Area));
    return r ? readinessAreaNote(r) : undefined;
  };
  const ringCaption = ready.state === 'ready'
    ? `Passing readiness ${Math.round(ready.percent ?? 0)} percent, ${ready.band}. ${ready.label}`
    : `Passing readiness locked. Needs ${READINESS_FLOOR} answers in an NP area`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl, gap: space.lg }}>
        <Section title="Passing readiness">
          <View style={{ alignItems: 'center', gap: space.md }}>
            <ReadinessRing percent={ready.state === 'ready' ? ready.percent : null} caption={ringCaption}>
              {ready.state === 'ready' ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={[type('title'), { color: colors.text }]}>{Math.round(ready.percent ?? 0)}%</Text>
                  <Text style={[type('label'), { color: colors.textDim }]}>{ready.band}</Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="lock-closed-outline" size={28} color={colors.textDim} />
                  <Text style={[type('label'), { color: colors.textDim }]}>Locked</Text>
                </View>
              )}
            </ReadinessRing>
            <Text style={[type('body'), { color: colors.text, textAlign: 'center' }]}>{rt.detail}</Text>
            <Text style={[type('caption'), { color: colors.textDim, textAlign: 'center' }]}>
              Each NP area unlocks after {READINESS_FLOOR} answers. Ticks mark 60% and 75%.
            </Text>
          </View>
          <View style={{ gap: 2 }}>
            {ready.areas.map((a) => (
              <Text key={a.area} style={[type('caption'), { color: colors.textDim }]}>
                {a.area}: {a.state === 'ready' ? `${Math.round(a.percent)}% ${a.band}` : `locked, ${a.answered} of ${a.needed} answers`}
              </Text>
            ))}
          </View>
        </Section>

        <Section title="Daily goal and streak">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
            <ProgressRing value={gp.fraction} size={84} stroke={9} label={`Daily goal: ${gp.answered} of ${gp.goal} answered`}>
              <Text style={[type('bodyStrong'), { color: colors.text }]}>{gp.answered}/{gp.goal}</Text>
            </ProgressRing>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text style={[type('bodyStrong'), { color: colors.text }]}>
                {gp.met ? 'Goal met today' : `${gp.remaining} to go today`}
              </Text>
              <Text style={[type('body'), { color: colors.text }]}>
                {streak.current} {streak.current === 1 ? 'day' : 'days'} streak · best {streak.longest}
              </Text>
              <Text style={[type('caption'), { color: colors.textDim }]}>
                {streak.nextMilestone ? `${streak.toNextMilestone} more ${streak.toNextMilestone === 1 ? 'day' : 'days'} to the ${streak.nextMilestone}-day milestone` : 'Every milestone reached'}
              </Text>
              {!streak.activeToday && streak.current > 0 ? (
                <Text style={[type('caption'), { color: colors.warning }]}>Answer one question today to keep your streak.</Text>
              ) : null}
            </View>
          </View>
          <View accessible accessibilityLabel={`Last 7 days: ${week.map((d) => `${d.day.slice(5)} ${d.met ? 'goal met' : `${d.answered} answered`}`).join(', ')}`} style={{ flexDirection: 'row', gap: space.sm }}>
            {week.map((d) => (
              <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <View style={{ width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: d.met ? colors.successSoft : colors.surfaceAlt }}>
                  <Ionicons name={d.met ? 'checkmark' : d.answered > 0 ? 'ellipse' : 'remove'} size={d.answered > 0 && !d.met ? 8 : 16} color={d.met ? colors.success : colors.textDim} />
                </View>
                <Text style={[type('caption'), { color: colors.textDim }]}>{d.day.slice(8)}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Chip text={`Rank ${rank.tier}: ${rank.name}`} tone="accent" icon="ribbon-outline" />
            <Chip text={`${rank.stars} of 3 stars`} tone="neutral" icon="star-outline" />
          </View>
        </Section>

        <Section title="Accuracy by area">
          {areas.length ? <AreaBars rows={areas} locked={lockedNote} /> : <Text style={[type('body'), { color: colors.textDim }]}>Answer some questions to see accuracy by area.</Text>}
        </Section>

        <Section title="Last 14 days">
          <TrendChart points={trend} />
        </Section>

        <Section title="Topics">
          {topics.length === 0 ? <Text style={[type('body'), { color: colors.textDim }]}>No questions loaded yet.</Text> : null}
          {topics.slice(0, shown).map((t) => (
            <View key={`${t.area}|${t.topic}`} style={{ gap: space.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md }}>
              <Text style={[type('bodyStrong'), { color: colors.text }]}>{t.topic}</Text>
              <Text style={[type('caption'), { color: colors.textDim }]}>
                {t.area} · Correct {t.correct} · Wrong {t.wrong} · Unseen {t.unseen}
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Practice this topic: ${t.topic}`}
                onPress={() => onPracticeTopic(t.topic, t.area)}
                style={{ minHeight: TOUCH_MIN, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
              >
                <Ionicons name="play-circle-outline" size={20} color={colors.accentText} />
                <Text style={[type('bodyStrong'), { color: colors.accentText }]}>Practice this topic</Text>
              </PressableScale>
            </View>
          ))}
          {topics.length > shown ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Show more topics, ${topics.length - shown} left`}
              onPress={() => setShown((n) => n + TOPIC_PAGE)}
              style={{ minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={[type('bodyStrong'), { color: colors.accentText }]}>Show more ({topics.length - shown} left)</Text>
            </PressableScale>
          ) : null}
          <Text style={[type('caption'), { color: colors.textDim }]}>Wrong includes partial credit. Counts use each question's latest answer.</Text>
        </Section>
      </ScrollView>
    </View>
  );
}
