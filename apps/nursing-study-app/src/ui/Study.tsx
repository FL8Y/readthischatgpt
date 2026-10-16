import React, { useState } from 'react';
import { View } from 'react-native';
import type { AppState, Question } from '../core/types';
import { canTeach, clampDiagnosticCount, completeDiagnostic, DIAGNOSTIC_MAX } from '../core/diagnostic';
import { currentStreak, planOrder, rankFor, totalPoints } from '../core/mastery';
import { callModel, parseQuestions } from '../ai/provider';
import { diagnosticRequest } from '../ai/prompts';
import { Btn, Card, Field, H, P, Pill, c } from './kit';

export function Study({ state, update }: { state: AppState; update: (s: AppState) => void }) {
  const folder = state.folders[0];
  const [count, setCount] = useState('10');
  const [qs, setQs] = useState<Question[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const now = Date.now();
  if (!folder) return <P>Create a folder in Library first.</P>;

  const folderTopics = state.topics.filter((t) => t.folderId === folder.id);
  const points = totalPoints(state.events, now);
  const { rank, level } = rankFor(points);

  const start = async () => {
    setBusy(true);
    setErr('');
    try {
      const n = clampDiagnosticCount(Number(count));
      const raw = await callModel(state.settings, diagnosticRequest(state, folder.id, n, now));
      const topicId = folderTopics[0]?.id ?? '';
      const parsed = parseQuestions(raw, topicId, `dx-${now}`);
      if (!parsed.length) throw new Error('The AI did not return usable questions. Try again.');
      setQs(parsed);
      setI(0);
      setPicked(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start.');
    } finally {
      setBusy(false);
    }
  };

  const answer = (idx: number) => {
    const q = qs[i];
    if (picked !== null || !q) return;
    setPicked(idx);
    update({
      ...state,
      events: [
        ...state.events,
        { id: `${q.id}`, questionId: q.id, topicId: q.topicId, correct: idx === q.answerIndex, at: Date.now(), kind: 'diagnostic' },
      ],
    });
  };

  const next = () => {
    if (i + 1 >= qs.length) {
      update(completeDiagnostic(state, folder.id));
      setQs([]);
    } else {
      setI(i + 1);
      setPicked(null);
    }
  };

  const q = qs[i];
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <H>{folder.name}</H>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Pill text={`${rank} · level ${level}`} color={c.accent} />
          <Pill text={`${points} pts`} />
          <Pill text={`${currentStreak(state.events, now)} day streak`} />
        </View>
      </Card>

      {q ? (
        <Card>
          <P dim>
            Question {i + 1} of {qs.length}
          </P>
          <P>{q.stem}</P>
          {q.choices.map((choice, idx) => (
            <Btn
              key={idx}
              label={choice}
              kind={picked === null ? 'ghost' : idx === q.answerIndex ? 'primary' : 'ghost'}
              onPress={() => answer(idx)}
            />
          ))}
          {picked !== null ? (
            <>
              <P>{picked === q.answerIndex ? 'Correct.' : 'Not quite.'} {q.rationale}</P>
              <Btn label={i + 1 >= qs.length ? 'Finish' : 'Next'} onPress={next} />
            </>
          ) : null}
        </Card>
      ) : !canTeach(state, folder.id) ? (
        <Card>
          <H>Diagnostic first</H>
          <P dim>Lessons unlock after a short test so the app knows where you stand.</P>
          <Field label={`How many questions? (1-${DIAGNOSTIC_MAX})`} value={count} onChangeText={setCount} keyboardType="number-pad" />
          <Btn label={busy ? 'Writing questions...' : 'Start diagnostic'} disabled={busy || folderTopics.length === 0} onPress={() => void start()} />
          {folderTopics.length === 0 ? <P dim>Add some notes in Library first.</P> : null}
          {err ? <P>{err}</P> : null}
        </Card>
      ) : (
        <Card>
          <H>Your study order</H>
          {planOrder(folderTopics, state.events, now).map((p, n) => (
            <P key={p.topicId}>
              {n + 1}. {p.title} <P dim>— {p.reason}</P>
            </P>
          ))}
        </Card>
      )}
    </View>
  );
}
