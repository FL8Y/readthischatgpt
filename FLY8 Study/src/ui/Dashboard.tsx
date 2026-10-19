import React from 'react';
import { Text, View } from 'react-native';
import type { AppState } from '../core/types';
import { currentStreak, levelProgress, recommendNext, totalPoints, weakTopics } from '../core/mastery';
import type { HomeSummary } from '../bank/home';
import { Card, Header, Illustration, ListRow, PressableScale, ProgressRing, Screen, StatTile } from './kit';
import { radius, space, useTheme } from './theme';

type Go = (tab: 'study' | 'library' | 'stats') => void;

const greeting = (h: number) => (h < 5 ? 'Late night study' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

/** Practice-loop card: daily goal ring, streak, rank and the one button to press. */
function TodayCard({ s, onStart, onStats }: { s: HomeSummary; onStart?: () => void; onStats?: () => void }) {
  const { colors, type } = useTheme();
  const resume = s.answeredToday > 0 && !s.goalMet;
  const cta = resume ? 'Continue' : 'Start quick practice';
  const days = s.streak.current;
  return (
    <Card>
      <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>Today</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <ProgressRing value={s.goalFraction} size={84} stroke={9} label={`Daily goal: ${s.answeredToday} of ${s.goalPerDay} answered`}>
          <Text style={[type('bodyStrong'), { color: colors.text }]}>{s.answeredToday}/{s.goalPerDay}</Text>
        </ProgressRing>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type('bodyStrong'), { color: colors.text }]}>{s.goalMet ? 'Goal met today' : `${Math.max(0, s.goalPerDay - s.answeredToday)} to reach your goal`}</Text>
          <Text style={[type('body'), { color: colors.text }]}>{days} {days === 1 ? 'day' : 'days'} streak</Text>
          <Text style={[type('caption'), { color: colors.textDim }]}>
            Rank {s.rank.tier}: {s.rank.name} · {s.rank.stars} of 3 stars
          </Text>
        </View>
      </View>
      {s.dueCount > 0 ? <Text style={[type('caption'), { color: colors.warning }]}>{s.dueCount} missed {s.dueCount === 1 ? 'question is' : 'questions are'} due to retry.</Text> : null}
      {onStart ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={cta}
          onPress={onStart}
          style={{ minHeight: 48, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={[type('bodyStrong'), { color: colors.onAccent }]}>{cta}</Text>
        </PressableScale>
      ) : null}
      {onStats ? (
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel="Open my stats"
          onPress={onStats}
          style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={[type('bodyStrong'), { color: colors.accentText }]}>
            {s.readiness.state === 'ready' ? `Readiness ${Math.round(s.readiness.percent ?? 0)}% · My stats` : 'Readiness locked · My stats'}
          </Text>
        </PressableScale>
      ) : null}
    </Card>
  );
}

export function Dashboard({ state, go, practice, onStartPractice, onOpenStats }: {
  state: AppState;
  go: Go;
  /** When given, the practice Today card replaces the focus, tiles and level cards. */
  practice?: HomeSummary;
  onStartPractice?: () => void;
  onOpenStats?: () => void;
}) {
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
        {practice ? <TodayCard s={practice} onStart={onStartPractice} onStats={onOpenStats} /> : null}
        {/* Today's focus: the one thing to do next */}
        {!practice ? <View style={{ backgroundColor: colors.accent, borderRadius: radius.xl, padding: space.xl, gap: space.md }}>
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
        </View> : null}

        {!practice ? <View style={{ flexDirection: 'row', gap: space.md }}>
          <StatTile icon="flame" value={String(streak)} label="day streak" tone="warning" />
          <StatTile icon="star" value={String(points)} label="points" />
        </View> : null}

        {!practice ? <Card>
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
        </Card> : null}

        <Card>
          <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>
            Topics to work on
          </Text>
          {practice && practice.weakestTopics.length ? (
            <View>
              {practice.weakestTopics.map((w) => (
                <ListRow key={`${w.area}|${w.topic}`} title={w.topic} detail={`${w.area} · ${Math.round(w.percent)}% over ${w.seen} answered`} icon="trending-down" onPress={onOpenStats} />
              ))}
            </View>
          ) : !practice && weak.length ? (
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
