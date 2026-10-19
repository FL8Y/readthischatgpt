import React from 'react';
import { Text, View } from 'react-native';
import type { AppState } from '../core/types';
import { currentStreak, levelProgress, recommendNext, totalPoints, weakTopics } from '../core/mastery';
import { Card, Header, Illustration, ListRow, PressableScale, ProgressRing, Screen, StatTile } from './kit';
import { radius, space, useTheme } from './theme';

type Go = (tab: 'study' | 'library') => void;

const greeting = (h: number) => (h < 5 ? 'Late night study' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

export function Dashboard({ state, go }: { state: AppState; go: Go }) {
  const { colors, type } = useTheme();
  const now = Date.now();
  const tz = new Date(now).getTimezoneOffset();
  const points = totalPoints(state.events, now, tz);
  const lv = levelProgress(points);
  const streak = currentStreak(state.events, now, tz);
  const weak = weakTopics(state.topics, state.events, now, 3);
  const next = recommendNext({
    topicCount: state.topics.length,
    diagnosticsDone: state.diagnosticsDone.length,
    attempts: state.events.length,
    weakTitle: weak[0]?.title,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={greeting(new Date(now).getHours())} subtitle="Ready to study?" />
      <Screen>
        {/* Today's focus: the one thing to do next */}
        <View style={{ backgroundColor: colors.accent, borderRadius: radius.xl, padding: space.xl, gap: space.md }}>
          <Text style={[type('label'), { color: colors.onAccent, opacity: 0.85 }]}>Today's focus</Text>
          <Text accessibilityRole="header" style={[type('title'), { color: colors.onAccent }]}>
            {next.title}
          </Text>
          <Text style={[type('body'), { color: colors.onAccent, opacity: 0.92 }]}>{next.detail}</Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={next.tab === 'library' ? 'Open Library' : 'Open Study'}
            onPress={() => go(next.tab)}
            style={{ minHeight: 48, borderRadius: radius.md, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: space.xs }}
          >
            <Text style={[type('bodyStrong'), { color: '#3730A3' }]}>{next.tab === 'library' ? 'Add notes' : 'Start now'}</Text>
          </PressableScale>
        </View>

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <StatTile icon="flame" value={String(streak)} label="day streak" tone="warning" />
          <StatTile icon="star" value={String(points)} label="points" />
        </View>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
            <ProgressRing value={lv.fraction} label={`Progress to level ${lv.level + 1}`}>
              <Text style={[type('headline'), { color: colors.text }]}>{lv.level}</Text>
            </ProgressRing>
            <View style={{ flex: 1, gap: 2 }}>
              <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>
                {lv.rank}
              </Text>
              <Text style={[type('body'), { color: colors.textDim }]}>
                {lv.toNext} points to level {lv.level + 1}
              </Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>
            Topics to work on
          </Text>
          {weak.length ? (
            <View>
              {weak.map((w) => (
                <ListRow key={w.topicId} title={w.title} detail={w.reason} icon="trending-down" onPress={() => go('study')} />
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: space.sm }}>
              <Illustration kind="quiz" />
              <Text style={[type('bodyStrong'), { color: colors.text }]}>Nothing weak yet</Text>
              <Text style={[type('body'), { color: colors.textDim, textAlign: 'center' }]}>
                Answer some quiz questions and the topics you miss will show up here.
              </Text>
            </View>
          )}
        </Card>
      </Screen>
    </View>
  );
}
