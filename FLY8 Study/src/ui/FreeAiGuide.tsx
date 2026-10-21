import React from 'react';
import { Text, View } from 'react-native';
import { GUIDE_HONESTY, GUIDE_INTRO, GUIDE_SECTIONS } from '../ai/freeAiGuide';
import { Card, Chip, H, P } from './kit';
import { radius, space, useTheme } from './theme';

/** Plain step-by-step guide. All wording lives in src/ai/freeAiGuide.ts. */
export function FreeAiGuide() {
  const { colors, type } = useTheme();
  return (
    <View style={{ gap: space.md }}>
      <P>{GUIDE_INTRO}</P>
      {GUIDE_SECTIONS.map((sec) => (
        <Card key={sec.id}>
          <H>{sec.title}</H>
          <Chip text={sec.tag} tone="accent" />
          <P dim>{sec.intro}</P>
          {sec.steps.map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
              <View style={{ width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[type('label', 'semibold'), { color: colors.accentText }]}>{i + 1}</Text>
              </View>
              <Text style={[type('body'), { color: colors.text, flex: 1 }]}>{t}</Text>
            </View>
          ))}
        </Card>
      ))}
      <Card tone="tinted">
        <H>Please note</H>
        {GUIDE_HONESTY.map((t) => (
          <P key={t} dim>
            {t}
          </P>
        ))}
      </Card>
    </View>
  );
}
