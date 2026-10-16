import React, { useState } from 'react';
import type { AppState, Folder } from '../core/types';
import { clampDiagnosticCount, completeDiagnostic, DIAGNOSTIC_MAX } from '../core/diagnostic';
import type { QuizSession } from '../core/quiz';
import { callModel, parseTopicQuestions } from '../ai/provider';
import { pnleDiagnosticRequest } from '../pnle/requests';
import { defaultPerPart, generateInParts, withAvoid } from '../ai/batch';
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
      if (res.error) setErr(`Only ${questions.length} questions arrived (${res.error}). Started with those.`);
      setSession({ id, kind: 'diagnostic', folderId: folder.id, questions, createdAt: now });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start.');
    } finally {
      setBusy(false);
    }
  };

  if (session) {
    return (
      <>
        {err ? <P>{err}</P> : null}
        <Quiz state={state} update={update} session={session} onDone={() => update(completeDiagnostic(state, folder.id))} />
      </>
    );
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
