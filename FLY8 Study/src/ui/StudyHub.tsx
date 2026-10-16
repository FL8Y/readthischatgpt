import React, { useState } from 'react';
import { View } from 'react-native';
import type { AppState, Topic } from '../core/types';
import { canTeach } from '../core/diagnostic';
import { currentStreak, planOrder, rankFor, totalPoints } from '../core/mastery';
import {
  buildPopSession,
  moduleBlueprint,
  parseFixTopics,
  remediationPlan,
  type QuizSession,
  type SessionResult,
} from '../core/quiz';
import { callModel } from '../ai/provider';
import { defaultPerPart, generateInParts, splitBlueprint, splitCount, withAvoid } from '../ai/batch';
import { parseMixedQuestions } from '../core/questionParse';
import { HARD_PREFIX, buildHardSession, hardRoundDone, hardRoundQuestions } from '../core/hardRound';
import { extractJson } from '../core/provenance';
import { remediationRequest } from '../ai/quizPrompts';
import { pnleModuleQuizRequest, pnlePopQuizRequest } from '../pnle/requests';
import { parsePnleModuleQuestions } from '../pnle/parse';
import { Diagnostic } from './Study';
import { Quiz } from './Quiz';
import { Btn, Card, Field, H, P, Pill, c } from './kit';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

/** Study tab: diagnostic gate, then study order, pop quizzes, module quiz and the weakness loop. */
export function StudyHub({ state, update }: { state: AppState; update: (s: AppState) => void }) {
  const folder = state.folders[0];
  const [session, setSession] = useState<QuizSession | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [popCount, setPopCount] = useState('3');
  const [modCount, setModCount] = useState('10');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  /** The pop/module session just finished, kept so one optional hard round can be offered for it. */
  const [finished, setFinished] = useState<QuizSession | null>(null);
  if (!folder) return <P>Create a folder in Library first.</P>;

  const now = Date.now();
  const topics = state.topics.filter((t) => t.folderId === folder.id);
  const points = totalPoints(state.events, now);
  const { rank, level } = rankFor(points);
  const header = (
    <Card>
      <H>{folder.name}</H>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Pill text={`${rank} · level ${level}`} color={c.accent} />
        <Pill text={`${points} pts`} />
        <Pill text={`${currentStreak(state.events, now)} day streak`} />
      </View>
    </Card>
  );

  if (!canTeach(state, folder.id)) {
    return (
      <View style={{ gap: 14 }}>
        {header}
        <Diagnostic state={state} update={update} folder={folder} />
      </View>
    );
  }

  if (session) {
    return (
      <View style={{ gap: 14 }}>
        {header}
        <Quiz
          state={state}
          update={update}
          session={session}
          onCancel={() => setSession(null)}
          onDone={(r) => {
            const isHard = session.id.startsWith(HARD_PREFIX);
            if (isHard) {
              setNote(`Hard round done: ${r.correct}/${r.total} correct.`);
            } else {
              setResult(r.kind === 'module' ? r : null);
              setNote(r.kind === 'pop' ? `Pop quiz done: ${r.correct}/${r.total} correct.` : '');
              setFinished(session);
            }
            setSession(null);
          }}
        />
      </View>
    );
  }

  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(label);
    setErr('');
    setNote('');
    try {
      await job();
    } catch (e) {
      setErr(msg(e));
    } finally {
      setBusy('');
    }
  };

  const popQuiz = (topic: Topic) =>
    run(`pop-${topic.id}`, async () => {
      const t = Date.now();
      const n = Math.round(Number(popCount));
      if (!Number.isFinite(n) || n < 1 || n > 5) throw new Error('Pop quiz length must be 1-5.');
      const id = `pop-${t}-${topic.id}`;
      const questions = parseMixedQuestions(await callModel(state.settings, pnlePopQuizRequest(state, topic, n, t)), topic.id, id);
      const built = buildPopSession(topic, questions.slice(0, n), id, t);
      if (!built.ok) throw new Error(built.error);
      setResult(null);
      setFinished(null);
      setSession(built.value);
    });

  const moduleQuiz = () =>
    run('module', async () => {
      const t = Date.now();
      const plan = moduleBlueprint(topics, state.events, t, Math.round(Number(modCount)));
      if (!plan.ok) throw new Error(plan.error);
      // Manual mode asks in parts of 10 (the blueprint is split to match); API modes make one call.
      const total = plan.value.reduce((n, b) => n + b.count, 0);
      const perPart = defaultPerPart(state.settings);
      const subs = splitBlueprint(plan.value, splitCount(total, perPart));
      const res = await generateInParts<Record<string, unknown>>({
        total,
        perPart,
        label: 'Module quiz',
        ask: (k, ctx) =>
          callModel(state.settings, withAvoid(pnleModuleQuizRequest(state, topics, subs[ctx.index], t), ctx.avoid), undefined, {
            purpose: ctx.purpose,
            expect: 'json',
            partsHint: ctx.parts > 1 ? `This is part ${ctx.index + 1} of ${ctx.parts}: write exactly ${k} questions.` : undefined,
          }),
        parse: (raw) => {
          const j = extractJson(raw);
          const list = Array.isArray(j) ? j : (j as { questions?: unknown } | null)?.questions;
          return Array.isArray(list) ? list.filter((q): q is Record<string, unknown> => !!q && typeof q === 'object') : [];
        },
      });
      const built = parsePnleModuleQuestions({ questions: res.items }, topics, folder.id, `mod-${t}`, t);
      if (!built.ok) throw new Error(built.error);
      setResult(null);
      setFinished(null);
      setSession(built.value);
    });

  const hardQs = finished ? hardRoundQuestions(finished, state.events) : [];
  const showHard = !!finished && hardQs.length > 0 && !hardRoundDone(finished, state.events);
  const startHardRound = () => {
    if (!finished) return;
    setErr('');
    setNote('');
    setSession(buildHardSession(finished, hardQs, Date.now()));
  };

  const plan = remediationPlan(topics, state.events, now);
  const titleOf = (id: string) => topics.find((t) => t.id === id)?.title ?? id;

  const fixTopics = () =>
    run('fix', async () => {
      const t = Date.now();
      const raw = await callModel(state.settings, remediationRequest(state, plan.items, topics, t));
      const added = parseFixTopics(raw, folder.id, state.topics, `fix-${t}`);
      if (!added.length) throw new Error('The AI did not return any new topics. Try again.');
      update({ ...state, topics: [...state.topics, ...added] });
      setNote(`Added ${added.length} new topic(s): ${added.map((a) => a.title).join(', ')}. Take a pop quiz on them next.`);
    });

  return (
    <View style={{ gap: 14 }}>
      {header}
      {note ? <P>{note}</P> : null}
      {err ? <P>{err}</P> : null}

      {showHard ? (
        <Card>
          <H>Hard round</H>
          <P dim>One optional follow-up on what you missed or needed a hint for (up to 5).</P>
          <Btn label={`Hard round (${hardQs.length} missed)`} disabled={!!busy} onPress={startHardRound} />
        </Card>
      ) : null}

      <Card>
        <H>Your study order</H>
        {planOrder(topics, state.events, now).map((p, n) => (
          <View key={p.topicId} style={{ gap: 6 }}>
            <P>
              {n + 1}. {p.title} <P dim>— {p.reason}</P>
            </P>
            <Btn
              label={busy === `pop-${p.topicId}` ? 'Writing questions...' : `Pop quiz: ${p.title}`}
              kind="ghost"
              disabled={!!busy}
              onPress={() => void popQuiz(topics.find((t) => t.id === p.topicId)!)}
            />
          </View>
        ))}
        <Field label="Pop quiz questions (1-5)" value={popCount} onChangeText={setPopCount} keyboardType="number-pad" />
      </Card>

      <Card>
        <H>Module quiz</H>
        <P dim>Covers every topic in this folder; weaker topics get more questions.</P>
        <Field label={`Questions (10-50, at least ${topics.length})`} value={modCount} onChangeText={setModCount} keyboardType="number-pad" />
        <Btn label={busy === 'module' ? 'Writing quiz...' : 'Module quiz'} disabled={!!busy || topics.length === 0} onPress={() => void moduleQuiz()} />
      </Card>

      {result ? (
        <Card>
          <H>Module quiz result</H>
          <P>
            {result.correct} of {result.total} correct.
          </P>
          {result.perTopic.map((s) => (
            <P key={s.topicId} dim>
              {titleOf(s.topicId)}: {s.correct}/{s.total}
            </P>
          ))}
        </Card>
      ) : null}

      {result || plan.items.length > 0 ? (
        <Card>
          <H>Weaknesses</H>
          {plan.items.length === 0 ? <P dim>No weak topics right now.</P> : null}
          {plan.items.map((w, n) => (
            <P key={w.topicId}>
              {n + 1}. {w.title} <P dim>— {w.reason}</P>
            </P>
          ))}
          {plan.mastered.length ? <P dim>Skipping mastered: {plan.mastered.map(titleOf).join(', ')}.</P> : null}
          <Btn
            label={busy === 'fix' ? 'Writing topics...' : 'Generate fix topics'}
            disabled={!!busy || plan.items.length === 0}
            onPress={() => void fixTopics()}
          />
        </Card>
      ) : null}
    </View>
  );
}
