import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { AppState, Folder } from '../core/types';
import { clampDiagnosticCount, DIAGNOSTIC_MAX } from '../core/diagnostic';
import type { QuizSession } from '../core/quiz';
import { callModel, parseTopicQuestions } from '../ai/provider';
import { pnleDiagnosticRequest } from '../pnle/requests';
import { defaultPerPart, generateInParts, withAvoid } from '../ai/batch';
import { Btn, Card, ChoiceChips, Chip, Illustration } from './kit';
import { space, useTheme } from './theme';

const PRESETS = [5, 10, 20, 30, 50];

/** Optional AI placement quiz (no longer a gate). StudyHub mounts it and runs the quiz. */
export function Diagnostic({
  state,
  folder,
  onSession,
}: {
  state: AppState;
  folder: Folder;
  /** Called with the ready-to-run diagnostic quiz, plus an optional note (e.g. fewer questions arrived than asked). */
  onSession: (session: QuizSession, note?: string) => void;
}) {
  const { colors, type } = useTheme();
  const [count, setCount] = useState(10);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const folderTopics = state.topics.filter((t) => t.folderId === folder.id);

  const start = async () => {
    setBusy(true);
    setErr('');
    try {
      const now = Date.now();
      const n = clampDiagnosticCount(count);
      const id = `dx-${now}`;
      // Manual mode asks in parts of 10 to fit chat limits; API modes make one call.
      const res = await generateInParts({
        total: n,
        perPart: defaultPerPart(state.settings),
        label: 'Diagnostic quiz',
        ask: (k, ctx) =>
          callModel(state.settings, withAvoid(pnleDiagnosticRequest(state, folder.id, k, now), ctx.avoid), undefined, {
            purpose: ctx.purpose,
            expect: 'json',
            partsHint: ctx.parts > 1 ? `This is part ${ctx.index + 1} of ${ctx.parts}: write exactly ${k} questions.` : undefined,
          }),
        parse: (raw, ctx) => parseTopicQuestions(raw, folderTopics, `${id}-p${ctx.index}`),
      });
      const questions = res.items.map((q, i) => ({ ...q, id: `${id}-${i}` }));
      if (!questions.length) throw new Error('The AI did not return usable questions. Try again.');
      onSession(
        { id, kind: 'diagnostic', folderId: folder.id, questions, createdAt: now },
        res.error ? `Only ${questions.length} questions arrived (${res.error}). Started with those.` : undefined,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start.');
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <Card>
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[type('headline'), { color: colors.text }]}>Writing your questions</Text>
          <Text style={[type('body'), { color: colors.textDim, textAlign: 'center' }]}>This can take a moment. In copy-paste mode a window will ask you to paste the reply.</Text>
        </View>
      </Card>
    );
  }
  return (
    <Card>
      <View style={{ alignItems: 'center' }}>
        <Illustration kind="quiz" />
      </View>
      <Text accessibilityRole="header" style={[type('title'), { color: colors.text }]}>
        AI placement quiz
      </Text>
      <Text style={[type('body'), { color: colors.textDim }]}>
        A short AI-written quiz from your notes shows where you stand and helps order your topics. It is optional: lessons and practice never wait for it.
      </Text>
      <Text style={[type('label'), { color: colors.textDim }]}>{`How many questions? (1-${DIAGNOSTIC_MAX})`}</Text>
      <ChoiceChips options={PRESETS} value={count} onChange={setCount} label="Number of questions" />
      <Btn label="Start diagnostic" disabled={folderTopics.length === 0} onPress={() => void start()} />
      {folderTopics.length === 0 ? <Chip tone="warning" icon="alert-circle-outline" text="Add some notes in the More tab > Library first" /> : null}
      {err ? <Chip tone="danger" icon="close-circle-outline" text={err} /> : null}
    </Card>
  );
}
