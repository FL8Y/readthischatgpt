import React from 'react';
import { View } from 'react-native';
import type { AppState } from '../core/types';
import { currentStreak, levelProgress, recommendNext, totalPoints, weakTopics } from '../core/mastery';
import { Btn, Card, EmptyState, H, P, Pill, ProgressBar, c, sp } from './kit';

/** Due reviews stay 0 until flashcards exist (R-019 needs the scheduler). */
const DUE_REVIEWS_PLACEHOLDER = 0;

export function Dashboard({ state, go }: { state: AppState; go: (tab: 'study' | 'library') => void }) {
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
    <View style={{ gap: sp.md }}>
      <Card>
        <P dim>Recommended next</P>
        <H>{next.title}</H>
        <P dim>{next.detail}</P>
        <Btn label={next.tab === 'library' ? 'Open Library' : 'Open Study'} onPress={() => go(next.tab)} />
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <H>{lv.rank}</H>
          <Pill text={`Level ${lv.level}`} color={c.accent} />
        </View>
        <ProgressBar value={lv.fraction} label={`Progress to level ${lv.level + 1}`} />
        <P dim>
          {points} points. {lv.toNext} more to level {lv.level + 1}.
        </P>
      </Card>

      <View style={{ flexDirection: 'row', gap: sp.md }}>
        <View style={{ flex: 1 }}>
          <Card>
            <P dim>Streak</P>
            <H>{streak === 1 ? '1 day' : `${streak} days`}</H>
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card>
            <P dim>Reviews due</P>
            <H>{DUE_REVIEWS_PLACEHOLDER}</H>
            <P dim>Placeholder until flashcards exist.</P>
          </Card>
        </View>
      </View>

      <Card>
        <H>Topics to work on</H>
        {weak.length ? (
          weak.map((w) => (
            <View key={w.topicId} style={{ gap: sp.xs }}>
              <P>{w.title}</P>
              <P dim>{w.reason}</P>
            </View>
          ))
        ) : (
          <EmptyState title="No weak topics yet" detail="Answer some quiz questions and the topics you miss will show up here." />
        )}
      </Card>
    </View>
  );
}
