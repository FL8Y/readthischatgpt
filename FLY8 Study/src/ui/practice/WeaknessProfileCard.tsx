import React from 'react';
import { Text, View } from 'react-native';
import { CONFIDENCE_TEXT, WEAK_BELOW, type Confidence, type WeakEntry, type WeaknessProfile } from '../../bank/diagnosticRounds';
import { Card, Chip, H, ProgressBar } from '../kit';
import { space, useTheme } from '../theme';

const CONF_TONE: Record<Confidence, 'warning' | 'neutral' | 'success'> = { low: 'warning', medium: 'neutral', higher: 'success' };

function Row({ e }: { e: WeakEntry }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ gap: space.xs }} accessible accessibilityLabel={`${e.label}, ${Math.round(e.percent)} percent over ${e.answered} questions, ${CONFIDENCE_TEXT[e.confidence]}`}>
      <Text style={[type('bodyStrong'), { color: colors.text }]}>{e.label}</Text>
      <ProgressBar value={e.percent / 100} label={`${e.label} ${Math.round(e.percent)} percent`} />
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Chip tone="danger" text={`${Math.round(e.percent)}%`} />
        <Chip text={`${e.answered} question${e.answered === 1 ? '' : 's'}`} />
        <Chip tone={CONF_TONE[e.confidence]} text={CONFIDENCE_TEXT[e.confidence]} />
      </View>
    </View>
  );
}

/** Ranked weak subjects and strategies from the diagnostic, each with its accuracy, question count and an honest confidence label. */
export function WeaknessProfileCard({ profile }: { profile: WeaknessProfile }) {
  const { colors, type } = useTheme();
  const none = !profile.topics.length && !profile.strategies.length;
  return (
    <Card>
      <H>Weakness profile</H>
      <Text style={[type('caption'), { color: colors.textDim }]}>
        Built from {profile.answered} diagnostic question{profile.answered === 1 ? '' : 's'} (round{profile.rounds.length === 1 ? '' : 's'} {profile.rounds.join(', ')}).
        A practice estimate, not a pass prediction. Few questions behind a number means it may be a slip, not a real weakness.
      </Text>
      {none ? (
        <Text style={[type('body'), { color: colors.textDim }]}>No clear weak spot yet: everything you answered is at {WEAK_BELOW}% or better.</Text>
      ) : null}
      {profile.topics.length ? <Text style={[type('bodyStrong'), { color: colors.text }]}>Weak subjects, weakest first</Text> : null}
      {profile.topics.map((e) => <Row key={`t-${e.key}`} e={e} />)}
      {profile.strategies.length ? <Text style={[type('bodyStrong'), { color: colors.text }]}>Weak reasoning strategies</Text> : null}
      {profile.strategies.map((e) => <Row key={`s-${e.key}`} e={e} />)}
    </Card>
  );
}
