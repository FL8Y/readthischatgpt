import React, { useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Question } from '../core/types';
import { describeCorrect, kindOf, type Grade } from '../core/grading';
import { Btn, Chip, PressableScale, Sheet } from './kit';

import { LETTERS } from './quizInputs';
import { BOTTOM_INSET } from './kitParts';
import { radius, space, useTheme } from './theme';

export interface Outcome {
  grade: Grade;
  weight: number;
  said: string;
}

export type Explain = { status: 'idle' } | { status: 'loading' } | { status: 'done'; text: string } | { status: 'error'; message: string };

/** Collapsible block: a text row with a chevron. Collapsed by default. */
function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, type } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space.sm }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={open ? `Hide: ${title}` : `Show: ${title}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        scaleTo={0.99}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
      >
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.accentText} />
        <Text style={[type('bodyStrong'), { color: colors.accentText }]}>{title}</Text>
      </PressableScale>
      {open ? children : null}
    </View>
  );
}

/** Why each option is right or wrong. Correct one is marked in words, not just colour. */
function OptionNotes({ q, picked }: { q: Question; picked: number | null }) {
  const { colors, type } = useTheme();
  const notes = q.optionRationales;
  if (kindOf(q) !== 'choice' || !notes || notes.length !== q.choices.length) return null;
  return (
    <View accessibilityLabel="Why each option is right or wrong" style={{ gap: space.sm }}>
      {q.choices.map((choice, idx) => {
        const right = idx === q.answerIndex;
        const tag = right ? 'Correct answer' : picked === idx ? 'Your answer, not correct' : 'Not correct';
        return (
          <View
            key={idx}
            accessible
            accessibilityLabel={`Option ${LETTERS[idx] ?? idx + 1}, ${tag}. ${choice}. ${notes[idx]}`}
            style={{ gap: 2, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: right ? colors.success : colors.border }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Ionicons name={right ? 'checkmark-circle' : 'close-circle'} size={16} color={right ? colors.success : colors.danger} />
              <Text style={[type('label', 'semibold'), { color: right ? colors.success : colors.danger }]}>
                {LETTERS[idx] ?? idx + 1}. {tag}
              </Text>
            </View>
            <Text style={[type('label', 'medium'), { color: colors.text }]}>{choice}</Text>
            <Text style={[type('caption'), { color: colors.textDim }]}>{notes[idx]}</Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The feedback sheet: verdict (icon + words + colour), points, strategy chip, rationale, a collapsed "Why?"
 * with per-option notes and reasoning, optional AI Explain, and the sticky Continue button.
 */
export function FeedbackSheet({
  q,
  outcome,
  picked,
  hints,
  points,
  explain,
  onExplain,
  onNext,
  last,
}: {
  q: Question;
  outcome: Outcome;
  picked: number | null;
  hints: number;
  points: number;
  explain: Explain;
  onExplain: () => void;
  onNext: () => void;
  last: boolean;
}) {
  const { colors, type } = useTheme();
  const { height } = useWindowDimensions();
  const kind = kindOf(q);
  const ok = outcome.grade.correct;
  const partial = !ok && outcome.grade.partial;
  const tone = ok ? 'success' : 'danger';
  const verdictColor = ok ? colors.success : colors.danger;
  const verdict = ok ? 'Correct' : partial ? 'Partly right' : 'Not quite';
  const hasWhy = !!(q.optionRationales?.length || q.reasoning);
  return (
    <Sheet tone={tone} maxHeight={Math.round(height * 0.5)}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }} style={{ flexGrow: 0, flexShrink: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Ionicons name={ok ? 'checkmark-circle' : partial ? 'alert-circle' : 'close-circle'} size={28} color={verdictColor} />
          <Text accessibilityRole="header" style={[type('headline'), { color: verdictColor, flex: 1 }]}>
            {verdict}
            {partial ? `: ${outcome.grade.detail}` : ''}
          </Text>
          <Chip text={points > 0 ? `+${points} pts${hints > 0 ? ' (half)' : ''}` : '+0 pts'} tone={points > 0 ? 'accent' : 'neutral'} />
        </View>
        {q.strategy ? <Chip icon="bulb-outline" tone="accent" text={`Strategy: ${q.strategy}`} /> : null}
        {kind !== 'choice' || picked !== q.answerIndex ? (
          <Text style={[type('body'), { color: colors.text }]}>
            <Text style={type('bodyStrong')}>Answer: </Text>
            {describeCorrect(q)}
          </Text>
        ) : null}
        <Text style={[type('body'), { color: colors.text }]}>{q.rationale}</Text>
        {hasWhy ? (
          <Disclosure title="Why? Every option explained">
            <OptionNotes q={q} picked={picked} />
            {q.reasoning ? <Text style={[type('body'), { color: colors.text }]}>{q.reasoning}</Text> : null}
          </Disclosure>
        ) : null}
        {explain.status === 'done' ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md }}>
            <Text style={[type('body'), { color: colors.text }]}>{explain.text}</Text>
          </View>
        ) : null}
        {explain.status === 'error' ? <Text style={[type('caption'), { color: colors.textDim }]}>Explain failed: {explain.message}</Text> : null}
        {explain.status !== 'done' ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={explain.status === 'loading' ? 'Explaining' : explain.status === 'error' ? 'Try Explain again' : 'Explain with AI'}
            accessibilityHint="Asks the AI to explain this question and your answer. Optional."
            accessibilityState={{ disabled: explain.status === 'loading' }}
            disabled={explain.status === 'loading'}
            onPress={onExplain}
            scaleTo={0.99}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: explain.status === 'loading' ? 0.6 : 1 }}
          >
            <Ionicons name="sparkles-outline" size={18} color={colors.accentText} />
            <Text style={[type('bodyStrong'), { color: colors.accentText }]}>
              {explain.status === 'loading' ? 'Explaining...' : explain.status === 'error' ? 'Try Explain again' : 'Explain with AI'}
            </Text>
          </PressableScale>
        ) : null}
      </ScrollView>
      <View style={{ padding: space.lg, paddingTop: space.sm, paddingBottom: space.lg + BOTTOM_INSET }}>
        <Btn label={last ? 'Finish' : kind === 'choice' ? 'Next' : 'Continue'} onPress={onNext} />
      </View>
    </Sheet>
  );
}
