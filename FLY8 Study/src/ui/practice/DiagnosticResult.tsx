import React from 'react';
import { Text, View } from 'react-native';
import type { SessionResult } from '../../bank/results';
import { Btn, Card, Chip, H, Header, ProgressBar, Screen } from '../kit';
import { space, useTheme } from '../theme';
import { levelFor, SOURCE_LABEL } from './practiceFlow';

const TONE = { 'Needs work': 'danger', Building: 'warning', Strong: 'success' } as const;

/** Placement check result: a level per NP area. Not a pass prediction. */
export function DiagnosticResult({ result, onDetails, onDone }: { result: SessionResult; onDetails: () => void; onDone: () => void }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Placement check" subtitle={`${result.correctCount} of ${result.total} correct`} />
      <Screen>
        <Card tone="tinted">
          <Text style={[type('display'), { color: colors.accentText }]}>{Math.round(result.percent)}%</Text>
          <Text style={[type('body'), { color: colors.textDim }]}>
            A starting picture, not a pass prediction. {SOURCE_LABEL}.
          </Text>
        </Card>
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
        <Btn label="Review my answers" kind="ghost" onPress={onDetails} />
        <Btn label="Done" onPress={onDone} />
      </Screen>
    </View>
  );
}
