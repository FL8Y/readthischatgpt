import React from 'react';
import { Text, View } from 'react-native';
import type { SessionResult } from '../../bank/results';
import { ROUND_TITLE, WEAK_BELOW, type RoundNo, type WeaknessProfile } from '../../bank/diagnosticRounds';
import { Btn, Card, Chip, H, Header, ProgressBar, Screen } from '../kit';
import { space, useTheme } from '../theme';
import { levelFor, SOURCE_LABEL } from './practiceFlow';
import { WeaknessProfileCard } from './WeaknessProfileCard';

const TONE = { 'Needs work': 'danger', Building: 'warning', Strong: 'success' } as const;

export interface DiagnosticResultProps {
  result: SessionResult;
  round: RoundNo;
  /** Saved profile (already includes this round). */
  profile?: WeaknessProfile;
  onDetails: () => void;
  onDone: () => void;
  /** Start the next round (Round 2 or 3). */
  onNext: (round: RoundNo) => void;
  onPractice: () => void;
}

/** Diagnostic round result. Round 1: areas + weak areas. Round 2: weakest bundles. Round 3: the Weakness profile. Never a pass prediction. */
export function DiagnosticResult({ result, round, profile, onDetails, onDone, onNext, onPractice }: DiagnosticResultProps) {
  const { colors, type } = useTheme();
  const weakAreas = (profile?.areas ?? []).filter((a) => a.percent < WEAK_BELOW).slice(0, 2);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={ROUND_TITLE[round]} subtitle={`${result.correctCount} of ${result.total} correct`} />
      <Screen>
        <Card tone="tinted">
          <Text style={[type('display'), { color: colors.accentText }]}>{Math.round(result.percent)}%</Text>
          <Text style={[type('body'), { color: colors.textDim }]}>
            A starting picture, not a pass prediction. {SOURCE_LABEL}.
          </Text>
        </Card>
        {round === 1 ? (
          <>
            <Card>
              <H>Your level by area</H>
              {result.areaBars.map((a) => {
                const level = levelFor(a.percent);
                return (
                  <View key={a.area} style={{ gap: space.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[type('bodyStrong'), { color: colors.text }]}>{a.area}</Text>
                      <Chip tone={TONE[level]} text={`${level} · ${Math.round(a.percent)}%`} />
                    </View>
                    <ProgressBar value={a.percent / 100} label={`${a.area} ${Math.round(a.percent)} percent`} />
                  </View>
                );
              })}
            </Card>
            <Card>
              <H>Where to look next</H>
              <Text style={[type('body'), { color: colors.text }]}>
                {weakAreas.length
                  ? `Weakest areas so far: ${weakAreas.map((a) => `${a.area} (${Math.round(a.percent)}%)`).join(' and ')}. With about 5 questions per area this is a first guess.`
                  : `No area is under ${WEAK_BELOW}% in this round. With about 5 questions per area that is only a first look.`}
              </Text>
            </Card>
          </>
        ) : null}
        {round === 2 ? (
          <Card>
            <H>Weakest topic bundles</H>
            <Text style={[type('body'), { color: colors.text }]}>
              {profile?.topics.length ? 'These subject bundles had the lowest accuracy across Rounds 1 and 2.' : `No bundle is under ${WEAK_BELOW}% so far.`}
            </Text>
            {(profile?.topics ?? []).slice(0, 6).map((e) => (
              <View key={e.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
                <Text style={[type('bodyStrong'), { color: colors.text, flex: 1 }]}>{e.label}</Text>
                <Chip tone="danger" text={`${Math.round(e.percent)}% of ${e.answered}`} />
              </View>
            ))}
          </Card>
        ) : null}
        {round === 3 && profile ? <WeaknessProfileCard profile={profile} /> : null}

        {round < 3 ? <Btn label={`Go deeper (Round ${round + 1})`} onPress={() => onNext((round + 1) as RoundNo)} /> : null}
        {round === 3 ? <Btn label="Practice my weak spots" onPress={onPractice} /> : null}
        <Btn label="Review my answers" kind="ghost" onPress={onDetails} />
        <Btn label={round < 3 ? "I'm done for now" : 'Done'} kind={round < 3 ? 'ghost' : 'primary'} onPress={onDone} />
      </Screen>
    </View>
  );
}
