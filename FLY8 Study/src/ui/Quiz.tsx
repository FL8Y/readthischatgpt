import React, { useContext, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import type { AppState, AttemptEvent } from '../core/types';
import { eventId, resultFromEvents, unansweredQuestions, type QuizSession, type SessionResult } from '../core/quiz';
import { POINTS } from '../core/mastery';
import { answerWeight, gradeAnswer, kindOf, shuffleSeeded, type Answer } from '../core/grading';
import { callModel } from '../ai/provider';
import { explainRequest } from '../ai/quizPrompts';
import { Btn, Chip, IconButton, ImmersiveCtx, ProgressBar, haptic } from './kit';
import { BOTTOM_INSET, TOP_INSET } from './kitParts';
import { AnswerTile, ClozeInput, LETTERS, MatchingInput, OrderingInput, TypingInput, answerText, type InputProps } from './quizInputs';
import { FeedbackSheet, type Explain, type Outcome } from './QuizFeedback';
import { space, useTheme } from './theme';

export const MAX_HINTS = 2;

/**
 * Full-screen question runner: slim progress bar and close at the top, big question, answer tiles, a sticky
 * Check button, and a feedback sheet that slides up with the verdict. Every answer is written to the event
 * ledger immediately under a session-scoped id, so a replay never double counts and closing the app never
 * loses recorded answers. Remounting with the same session resumes at the first unanswered question.
 * Choice answers are picked, then graded on "Check"; other kinds grade on "Check" too. "Continue" moves on.
 */
export function Quiz({
  state,
  update,
  session,
  onDone,
  onCancel,
}: {
  state: AppState;
  update: (s: AppState) => void;
  session: QuizSession;
  onDone: (result: SessionResult) => void;
  onCancel?: () => void;
}) {
  const { colors, type } = useTheme();
  const setImmersive = useContext(ImmersiveCtx);
  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  const latest = useRef(state);
  latest.current = state;
  const total = session.questions.length;
  const [start] = useState(() => total - unansweredQuestions(session, state.events).length);
  const [i, setI] = useState(Math.min(start, total - 1));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [pending, setPending] = useState<Answer | null>(null);
  const [hints, setHints] = useState(0);
  const [explain, setExplain] = useState<Explain>({ status: 'idle' });
  const lastAnswer = useRef<Answer>(0);
  const q = session.questions[i];
  if (!q) return null;

  const kind = kindOf(q);
  const seed = `${session.id}:${q.id}`;
  const wrong = q.choices.map((_, idx) => idx).filter((idx) => idx !== q.answerIndex);
  const maxHints = kind === 'choice' ? Math.min(MAX_HINTS, wrong.length - 1) : 0;
  const eliminated = kind === 'choice' ? shuffleSeeded(wrong, seed).slice(0, hints) : [];

  const submit = (answer: Answer) => {
    if (outcome) return;
    lastAnswer.current = answer;
    const grade = gradeAnswer(q, answer);
    haptic(grade.correct ? 'success' : 'error');
    const id = eventId(session.id, q.id);
    const event: AttemptEvent = {
      id,
      questionId: q.id,
      topicId: q.topicId,
      correct: grade.correct,
      at: Date.now(),
      kind: session.kind,
      ...(hints > 0 ? { hinted: true } : {}),
    };
    setOutcome({ grade, weight: answerWeight(event), said: answerText(q, answer) });
    const cur = latest.current;
    if (cur.events.some((e) => e.id === id)) return; // replay: show feedback, record nothing twice
    latest.current = { ...cur, events: [...cur.events, event] };
    update(latest.current);
  };

  const next = () => {
    if (i + 1 >= total) onDone(resultFromEvents(session, latest.current.events));
    else {
      setI(i + 1);
      setOutcome(null);
      setPicked(null);
      setPending(null);
      setHints(0);
      setExplain({ status: 'idle' });
    }
  };

  const askExplain = async () => {
    if (!outcome || explain.status === 'loading') return;
    const forQuestion = q.id;
    setExplain({ status: 'loading' });
    try {
      const text = await callModel(latest.current.settings, explainRequest(latest.current, q, outcome.said, outcome.grade.correct, Date.now()));
      setExplain((cur) => (q.id === forQuestion && cur.status === 'loading' ? { status: 'done', text: text.trim() } : cur));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not get an explanation.';
      setExplain((cur) => (cur.status === 'loading' ? { status: 'error', message } : cur));
    }
  };

  const inputProps: InputProps = { q, seed, locked: !!outcome, onChange: setPending };
  const points = outcome ? Math.round(POINTS.correct * outcome.weight) : 0;
  const ready = kind === 'choice' ? picked !== null : pending !== null;
  const check = () => {
    if (kind === 'choice') {
      if (picked !== null) submit(picked);
    } else if (pending !== null) submit(pending);
  };

  const tileState = (idx: number) => {
    if (outcome) {
      if (idx === q.answerIndex) return { state: 'correct' as const, tag: 'Correct answer' };
      if (idx === picked) return { state: 'wrong' as const, tag: 'Your answer' };
      return { state: 'dim' as const, tag: undefined };
    }
    if (eliminated.includes(idx)) return { state: 'ruledout' as const, tag: 'Ruled out' };
    return { state: idx === picked ? ('selected' as const) : ('idle' as const), tag: undefined };
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: TOP_INSET, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {onCancel ? <IconButton icon="close" label="Stop for now" onPress={onCancel} /> : <View style={{ width: space.md }} />}
        <View style={{ flex: 1 }}>
          <ProgressBar value={(i + (outcome ? 1 : 0)) / total} label={`Question ${i + 1} of ${total}`} height={10} />
        </View>
        <Text style={[type('label'), { color: colors.textDim, minWidth: 44, textAlign: 'right', paddingRight: space.xs }]}>
          {i + 1}/{total}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl, gap: space.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {kind !== 'choice' ? <Chip tone="accent" text={{ typing: 'Type the answer', cloze: 'Fill in the blanks', matching: 'Match the pairs', ordering: 'Put in order' }[kind]} /> : null}
        {kind !== 'cloze' ? (
          <Text accessibilityRole="header" style={[type('headline', 'medium'), { color: colors.text, fontSize: 19, lineHeight: 29 }]}>
            {q.stem}
          </Text>
        ) : null}

        {kind === 'choice' ? (
          <View style={{ gap: space.md }}>
            {q.choices.map((choice, idx) => {
              const t = tileState(idx);
              return (
                <AnswerTile
                  key={idx}
                  label={choice}
                  badge={LETTERS[idx] ?? String(idx + 1)}
                  state={t.state}
                  tag={t.tag}
                  disabled={t.state === 'ruledout' || !!outcome}
                  onPress={() => {
                    haptic('tap');
                    setPicked(idx);
                  }}
                />
              );
            })}
          </View>
        ) : null}
        {kind === 'typing' ? <TypingInput key={q.id} {...inputProps} /> : null}
        {kind === 'cloze' ? <ClozeInput key={q.id} {...inputProps} /> : null}
        {kind === 'matching' ? <MatchingInput key={q.id} {...inputProps} /> : null}
        {kind === 'ordering' ? <OrderingInput key={q.id} {...inputProps} /> : null}
      </ScrollView>

      {outcome ? (
        <FeedbackSheet
          q={q}
          outcome={outcome}
          picked={picked}
          hints={hints}
          points={points}
          explain={explain}
          onExplain={() => void askExplain()}
          onNext={next}
          last={i + 1 >= total}
        />
      ) : (
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            paddingBottom: space.lg + BOTTOM_INSET,
            gap: space.sm,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {maxHints > 0 ? (
            <Btn
              label={hints >= maxHints ? 'No more hints' : `Hint (${hints}/${maxHints}): rule out one wrong answer`}
              kind="ghost"
              disabled={hints >= maxHints}
              hint="A correct answer after a hint earns half points"
              onPress={() => {
                const nh = Math.min(maxHints, hints + 1);
                const gone = shuffleSeeded(wrong, seed).slice(0, nh);
                setHints(nh);
                setPicked((p) => (p !== null && gone.includes(p) ? null : p));
              }}
            />
          ) : null}
          <Btn label="Check" disabled={!ready} onPress={check} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
