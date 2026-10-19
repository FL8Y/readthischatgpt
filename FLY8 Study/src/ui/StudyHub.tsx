import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppState, Topic } from '../core/types';
import { canTeach, completeDiagnostic } from '../core/diagnostic';
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
import { Btn, Card, ChoiceChips, Chip, Divider, EmptyState, H, Header, PressableScale, Screen, TOP_INSET } from './kit';
import { radius, space, useTheme } from './theme';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
const POP_COUNTS = [1, 2, 3, 4, 5] as const;
const MODULE_COUNTS = [10, 20, 30, 50] as const;

/**
 * "Make new questions with AI" (opened from the Practice hub): study order, pop quizzes, module quiz and the weakness loop.
 * The old diagnostic gate is now an optional card; nothing here is locked behind it.
 */
export function StudyHub({ state, update, onBack }: { state: AppState; update: (s: AppState) => void; onBack?: () => void }) {
  const { colors, type } = useTheme();
  const folder = state.folders[0];
  const [session, setSession] = useState<QuizSession | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [popCount, setPopCount] = useState<number>(3);
  const [modCount, setModCount] = useState<number>(10);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  /** The pop/module session just finished, kept so one optional hard round can be offered for it. */
  const [finished, setFinished] = useState<QuizSession | null>(null);
  const [dxOpen, setDxOpen] = useState(false);

  if (!folder) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: TOP_INSET }}>
        <EmptyState art="notes" title="No folder yet" detail="Create a folder and add notes in More > Library, then come back to study." />
      </View>
    );
  }

  const now = Date.now();
  const topics = state.topics.filter((t) => t.folderId === folder.id);
  const points = totalPoints(state.events, now);
  const { rank, level } = rankFor(points);
  const header = (
    <Header
      title="Make new questions"
      subtitle={folder.name}
      onBack={onBack}
      right={<Chip icon="trophy-outline" tone="accent" text={`${rank} · level ${level}`} />}
    />
  );

  if (session) {
    const isDx = session.kind === 'diagnostic';
    return (
      <Quiz
        state={state}
        update={update}
        session={session}
        onCancel={() => setSession(null)}
        onDone={(r) => {
          if (isDx) {
            update(completeDiagnostic(state, folder.id));
            setNote(`Placement quiz done: ${r.correct}/${r.total} correct.`);
          } else if (session.id.startsWith(HARD_PREFIX)) {
            setNote(`Hard round done: ${r.correct}/${r.total} correct.`);
          } else {
            setResult(r.kind === 'module' ? r : null);
            setNote(r.kind === 'pop' ? `Pop quiz done: ${r.correct}/${r.total} correct.` : '');
            setFinished(session);
          }
          setSession(null);
        }}
      />
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
      const n = Math.round(popCount);
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
      const plan = moduleBlueprint(topics, state.events, t, Math.round(modCount));
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

  const order = planOrder(topics, state.events, now);
  const streak = currentStreak(state.events, now);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <Screen>
        {busy ? (
          <Card tone="tinted">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[type('bodyStrong'), { color: colors.text, flex: 1 }]}>
                {busy === 'module' ? 'Writing your quiz' : busy === 'fix' ? 'Writing new topics' : 'Writing your questions'}
              </Text>
            </View>
          </Card>
        ) : null}
        {note ? (
          <Card tone="tinted">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={[type('bodyStrong'), { color: colors.text, flex: 1 }]}>{note}</Text>
            </View>
          </Card>
        ) : null}
        {err ? <Chip tone="danger" icon="close-circle-outline" text={err} /> : null}
        {!canTeach(state, folder.id) ? (
          dxOpen ? (
            <Diagnostic
              state={state}
              folder={folder}
              onSession={(s, n) => {
                setErr(n ?? '');
                setSession(s);
              }}
            />
          ) : (
            <Card>
              <H>AI placement quiz (optional)</H>
              <Text style={[type('body'), { color: colors.textDim }]}>
                The free placement check is in Practice. This one writes its questions with AI from your notes. Nothing is locked without it.
              </Text>
              <Btn label="Set up AI placement quiz" kind="ghost" onPress={() => setDxOpen(true)} />
            </Card>
          )
        ) : null}
        {streak > 0 && !note && !busy ? <Chip tone="warning" icon="flame" text={`${streak} day streak. Keep it going.`} /> : null}

        {showHard ? (
          <Card>
            <H>Hard round</H>
            <Text style={[type('body'), { color: colors.textDim }]}>One optional follow-up on what you missed or needed a hint for (up to 5).</Text>
            <Btn label={`Hard round (${hardQs.length} missed)`} disabled={!!busy} onPress={startHardRound} />
          </Card>
        ) : null}

        <Card>
          <H>Your study order</H>
          <Text style={[type('caption'), { color: colors.textDim }]}>Weakest first. Tap a topic for a pop quiz.</Text>
          <Text style={[type('label'), { color: colors.textDim }]}>Questions per pop quiz</Text>
          <ChoiceChips options={POP_COUNTS} value={popCount} onChange={setPopCount} label="Questions per pop quiz" />
          <View>
            {order.map((p, n) => (
              <View key={p.topicId}>
                {n > 0 ? <Divider /> : null}
                <StudyRow
                  index={n + 1}
                  title={p.title}
                  reason={p.reason}
                  busy={busy === `pop-${p.topicId}`}
                  disabled={!!busy}
                  onPress={() => void popQuiz(topics.find((t) => t.id === p.topicId)!)}
                />
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <H>Module quiz</H>
          <Text style={[type('body'), { color: colors.textDim }]}>Covers every topic in this folder; weaker topics get more questions.</Text>
          <Text style={[type('label'), { color: colors.textDim }]}>{`Questions (at least ${topics.length})`}</Text>
          <ChoiceChips options={MODULE_COUNTS} value={modCount} onChange={setModCount} label="Module quiz length" />
          <Btn label={busy === 'module' ? 'Writing quiz...' : 'Start module quiz'} disabled={!!busy || topics.length === 0} onPress={() => void moduleQuiz()} />
        </Card>

        {result ? (
          <Card tone="tinted">
            <H>Module quiz result</H>
            <Text style={[type('display'), { color: colors.accentText }]}>
              {result.correct}/{result.total}
            </Text>
            {result.perTopic.map((s) => (
              <Text key={s.topicId} style={[type('body'), { color: colors.textDim }]}>
                {titleOf(s.topicId)}: {s.correct}/{s.total}
              </Text>
            ))}
          </Card>
        ) : null}

        {result || plan.items.length > 0 ? (
          <Card>
            <H>Weaknesses</H>
            {plan.items.length === 0 ? <Text style={[type('body'), { color: colors.textDim }]}>No weak topics right now.</Text> : null}
            {plan.items.map((w, n) => (
              <View key={w.topicId} style={{ gap: 2 }}>
                <Text style={[type('bodyStrong'), { color: colors.text }]}>
                  {n + 1}. {w.title}
                </Text>
                <Text style={[type('caption'), { color: colors.textDim }]}>{w.reason}</Text>
              </View>
            ))}
            {plan.mastered.length ? (
              <Text style={[type('caption'), { color: colors.textDim }]}>Skipping mastered: {plan.mastered.map(titleOf).join(', ')}.</Text>
            ) : null}
            <Btn
              label={busy === 'fix' ? 'Writing topics...' : 'Generate fix topics'}
              kind="ghost"
              disabled={!!busy || plan.items.length === 0}
              onPress={() => void fixTopics()}
            />
          </Card>
        ) : null}
      </Screen>
    </View>
  );
}

/** One topic in the study order with a quiet "Quiz" action; the whole row is tappable. */
function StudyRow({
  index,
  title,
  reason,
  busy,
  disabled,
  onPress,
}: {
  index: number;
  title: string;
  reason: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, type } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Pop quiz: ${title}. ${reason}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.985}
      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, opacity: disabled && !busy ? 0.55 : 1 }}
    >
      <View style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[type('label', 'semibold'), { color: colors.accentText }]}>{index}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type('bodyStrong'), { color: colors.text }]}>{title}</Text>
        <Text style={[type('caption'), { color: colors.textDim }]}>{reason}</Text>
      </View>
      {busy ? <ActivityIndicator color={colors.accent} /> : <Chip tone="accent" icon="flash-outline" text="Quiz" />}
    </PressableScale>
  );
}
