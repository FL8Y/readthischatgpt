import React, { useState } from 'react';
import type { AppState, Folder } from '../core/types';
import { clampDiagnosticCount, completeDiagnostic, DIAGNOSTIC_MAX } from '../core/diagnostic';
import type { QuizSession } from '../core/quiz';
import { callModel, parseTopicQuestions } from '../ai/provider';
import { diagnosticRequest } from '../ai/prompts';
import { Quiz } from './Quiz';
import { Btn, Card, Field, H, P } from './kit';

/**
 * Legacy entry point kept only so App.tsx still compiles until it mounts StudyHub instead.
 * It shows the diagnostic gate and nothing after it; StudyHub is the real Study tab.
 */
export function Study({ state, update }: { state: AppState; update: (s: AppState) => void }) {
  const folder = state.folders[0];
  if (!folder) return <P>Create a folder in Library first.</P>;
  if (!state.diagnosticsDone.includes(folder.id)) return <Diagnostic state={state} update={update} folder={folder} />;
  return <P>Diagnostic complete. Mount StudyHub in App.tsx for quizzes and the study order.</P>;
}

/** Diagnostic gate flow (R-004): shown until the folder's diagnostic is done. StudyHub mounts it. */
export function Diagnostic({ state, update, folder }: { state: AppState; update: (s: AppState) => void; folder: Folder }) {
  const [count, setCount] = useState('10');
  const [session, setSession] = useState<QuizSession | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const folderTopics = state.topics.filter((t) => t.folderId === folder.id);

  const start = async () => {
    setBusy(true);
    setErr('');
    try {
      const now = Date.now();
      const n = clampDiagnosticCount(Number(count));
      const raw = await callModel(state.settings, diagnosticRequest(state, folder.id, n, now));
      const id = `dx-${now}`;
      const questions = parseTopicQuestions(raw, folderTopics, id);
      if (!questions.length) throw new Error('The AI did not return usable questions. Try again.');
      setSession({ id, kind: 'diagnostic', folderId: folder.id, questions, createdAt: now });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start.');
    } finally {
      setBusy(false);
    }
  };

  if (session) {
    return <Quiz state={state} update={update} session={session} onDone={() => update(completeDiagnostic(state, folder.id))} />;
  }
  return (
    <Card>
      <H>Diagnostic first</H>
      <P dim>Lessons unlock after a short test so the app knows where you stand.</P>
      <Field label={`How many questions? (1-${DIAGNOSTIC_MAX})`} value={count} onChangeText={setCount} keyboardType="number-pad" />
      <Btn label={busy ? 'Writing questions...' : 'Start diagnostic'} disabled={busy || folderTopics.length === 0} onPress={() => void start()} />
      {folderTopics.length === 0 ? <P dim>Add some notes in Library first.</P> : null}
      {err ? <P>{err}</P> : null}
    </Card>
  );
}
