import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  buildAreaInfos, buildDayLog, buildPath, dayLabel, launchFor, requeueByDay, type Launch, type PathTask, type TaskState,
} from '../../bank/path';
import { dayKey } from '../../bank/clock';
import { summarizeAdaptive, type AdaptiveState, type Scope } from '../../bank/adaptive';
import type { BankItem } from '../../bank/schema';
import { DEFAULT_PATH_MINUTES, isDayString, type BankState } from '../../bank/store';
import type { AttemptRecord } from '../../bank/types2';
import { Btn, Card, Chip, ChoiceChips, Divider, Field, H, Header, ListRow, Screen, type IconName } from '../kit';
import { space, useTheme } from '../theme';

const KIND_ICON: Record<PathTask['kind'], IconName> = {
  diagnostic: 'flag-outline', practice: 'flash-outline', requeue: 'refresh-outline', mock: 'ribbon-outline',
  review: 'book-outline', rest: 'moon-outline',
};
const STATE_LABEL: Record<TaskState, string> = {
  today: 'Today', upcoming: 'Up next', attention: 'Needs attention', done: 'Done',
};
const MINUTE_CHOICES = [30, 45, 60, 90, 120] as const;

export interface PathProps {
  items: readonly BankItem[];
  attempts: readonly AttemptRecord[];
  state: BankState;
  /** Manila day key for today. */
  today: string;
  onSetExam: (date: string | null) => void;
  onSetMinutes: (minutes: number) => void;
  onLaunch: (launch: NonNullable<Launch>) => void;
  onBack: () => void;
}

const two = (n: string) => n.padStart(2, '0');

/** Learning path: countdown, today's tasks, what is coming and what slipped. All planning is local and deterministic. */
export function Path(p: PathProps) {
  const { colors, type } = useTheme();
  const { state, today } = p;
  const [editing, setEditing] = useState(false);
  const [yy, setYy] = useState('');
  const [mm, setMm] = useState('');
  const [dd, setDd] = useState('');
  const [err, setErr] = useState('');

  const plan = useMemo(() => {
    const first = p.attempts.length ? Math.min(...p.attempts.map((a) => a.at)) : null;
    const startDay = first === null ? undefined : dayKey(first);
    const ids = new Set(p.items.map((i) => i.id));
    return buildPath({
      today,
      examDate: state.examDate,
      minutes: state.pathMinutes ?? DEFAULT_PATH_MINUTES,
      areas: buildAreaInfos(p.items, p.attempts, Date.now()),
      diagnosticTaken: state.attempts.some((a) => a.mode === 'diagnostic'),
      requeueByDay: requeueByDay(state.requeue, today, ids),
      log: buildDayLog(p.attempts),
      startDay,
    });
  }, [p.items, p.attempts, state.examDate, state.pathMinutes, state.attempts, state.requeue, today]);

  const saveDate = () => {
    const date = `${yy.trim().padStart(4, '0')}-${two(mm.trim())}-${two(dd.trim())}`;
    if (!isDayString(date)) return setErr('That is not a real date. Use year, month, day, for example 2026, 11, 28.');
    setErr('');
    setEditing(false);
    p.onSetExam(date);
  };

  const row = (t: PathTask, showDay: boolean) => {
    const launch = launchFor(t);
    return (
      <View key={t.id}>
        <ListRow
          icon={KIND_ICON[t.kind]}
          title={t.title}
          detail={`${showDay ? `${dayLabel(today, t.day)} · ` : ''}${t.minutes ? `${t.minutes} min` : 'no study'}${t.done > 0 && t.state !== 'done' ? ` · ${t.done} of ${t.target} done` : ''}`}
          badge={STATE_LABEL[t.state]}
          onPress={launch ? () => p.onLaunch(launch) : undefined}
          disabled={!launch}
        />
      </View>
    );
  };

  const attention = plan.attention;
  const todayDone = plan.todayTasks.filter((t) => t.state === 'done').length;
  const showEditor = editing || !state.examDate;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Learning path" subtitle={plan.countdown} onBack={p.onBack} />
      <Screen>
        <Card tone="tinted">
          <H>{state.examDate ? plan.countdown : 'Set your exam date'}</H>
          <Text style={[type('body'), { color: colors.textDim }]}>
            {state.examDate
              ? `Exam date: ${state.examDate}. The plan shows the next ${plan.status === 'exam-soon' && plan.daysLeft !== null ? Math.min(14, plan.daysLeft + 1) : 14} days at most.`
              : 'Without a date you get a rolling 7-day plan. Add your exam date to get a countdown, a weekly mock board and a lighter last two days.'}
          </Text>
          {showEditor ? (
            <View style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 2 }}><Field label="Year" value={yy} onChangeText={setYy} keyboardType="number-pad" maxLength={4} placeholder="2026" /></View>
                <View style={{ flex: 1 }}><Field label="Month" value={mm} onChangeText={setMm} keyboardType="number-pad" maxLength={2} placeholder="11" /></View>
                <View style={{ flex: 1 }}><Field label="Day" value={dd} onChangeText={setDd} keyboardType="number-pad" maxLength={2} placeholder="28" /></View>
              </View>
              {err ? <Chip tone="danger" icon="alert-circle-outline" text={err} /> : null}
              <Btn label="Save exam date" onPress={saveDate} disabled={!yy || !mm || !dd} />
              {state.examDate ? <Btn label="Cancel" kind="ghost" onPress={() => { setEditing(false); setErr(''); }} /> : null}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}><Btn label="Change date" kind="ghost" onPress={() => setEditing(true)} /></View>
              <View style={{ flex: 1 }}><Btn label="Remove date" kind="ghost" onPress={() => p.onSetExam(null)} /></View>
            </View>
          )}
        </Card>

        <Card>
          <H>Study time per day</H>
          <ChoiceChips options={MINUTE_CHOICES} value={plan.minutes as (typeof MINUTE_CHOICES)[number]} onChange={p.onSetMinutes} label="Minutes per day" />
          <Text style={[type('caption'), { color: colors.textDim }]}>
            Minutes per day. The plan counts about 1.5 minutes per question. These are estimates, not promises.
          </Text>
        </Card>

        {plan.note ? <Chip tone="warning" icon="alert-circle-outline" text={plan.note} /> : null}

        <Card>
          <H>Today</H>
          {plan.todayTasks.length === 0 ? (
            <Text style={[type('body'), { color: colors.textDim }]}>Nothing planned for today.</Text>
          ) : (
            <>
              <Text style={[type('caption'), { color: colors.textDim }]}>{todayDone} of {plan.todayTasks.length} done</Text>
              {plan.todayTasks.map((t, i) => (
                <View key={t.id}>{i > 0 ? <Divider /> : null}{row(t, false)}</View>
              ))}
            </>
          )}
        </Card>

        {attention.length ? (
          <Card>
            <H>Needs attention</H>
            <Text style={[type('caption'), { color: colors.textDim }]}>
              Missed days are spread over the next days, never more than 1.5 times your usual load.
            </Text>
            {attention.map((t, i) => (
              <View key={t.id}>{i > 0 ? <Divider /> : null}{row(t, true)}</View>
            ))}
          </Card>
        ) : null}

        <Card>
          <H>Up next</H>
          {plan.upNext.length === 0 ? (
            <Text style={[type('body'), { color: colors.textDim }]}>Nothing else planned.</Text>
          ) : (
            plan.upNext.map((t, i) => (
              <View key={t.id}>{i > 0 ? <Divider /> : null}{row(t, true)}</View>
            ))
          )}
        </Card>

        <Text style={[type('caption'), { color: colors.textDim, textAlign: 'center' }]}>
          A simple plan made on this phone from your answers. It is a guide, not a promise of a pass.
        </Text>
      </Screen>
    </View>
  );
}

export interface AdaptiveSummaryProps {
  state: AdaptiveState;
  scope: Scope;
  /** Earlier answered counts per area (adds to this exam's answers for the readiness lock). */
  evidence: Partial<Record<string, number>>;
  onDetails: () => void;
  onDone: () => void;
}

/** End-of-exam card for the adaptive exam: ability curve in plain words plus per-area readiness. */
export function AdaptiveSummaryScreen(p: AdaptiveSummaryProps) {
  const { colors, type } = useTheme();
  const sum = useMemo(() => summarizeAdaptive(p.state, p.scope, p.evidence), [p.state, p.scope, p.evidence]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Adaptive exam" subtitle={`${sum.answered} questions`} onBack={p.onDone} />
      <Screen>
        <Card tone="tinted">
          <H>How your level moved</H>
          {sum.lines.map((l, i) => (
            <Text key={i} style={[type('body'), { color: colors.text }]}>{l}</Text>
          ))}
        </Card>
        {sum.areas.length ? (
          <Card>
            <H>By area</H>
            {sum.areas.map((a, i) => (
              <View key={a.area}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={a.area}
                  detail={a.readiness.state === 'ready'
                    ? `Estimate about ${Math.round(a.readiness.percent)}% on a typical board mix (${a.readiness.band}). Practice estimate, not a pass prediction.`
                    : `Needs ${a.readiness.needed} answers in this area before an estimate shows (${a.readiness.answered} so far).`}
                  trailing={<Chip text={a.readiness.state === 'ready' ? a.readiness.band : 'locked'} tone={a.readiness.state === 'ready' ? 'accent' : 'neutral'} />}
                />
              </View>
            ))}
          </Card>
        ) : null}
        <Btn label="Review the questions" onPress={p.onDetails} />
        <Btn label="Done" kind="ghost" onPress={p.onDone} />
      </Screen>
    </View>
  );
}
