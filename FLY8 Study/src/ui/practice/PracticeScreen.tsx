import React, { useContext, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { AppState } from '../../core/types';
import {
  adaptivePool, extendAdaptive, isAdaptive, replayAdaptive, startAdaptive, thetaFromAttempts, weakBonusFrom,
  type AdaptiveState, type Scope,
} from '../../bank/adaptive';
import { countdownText, type Launch } from '../../bank/path';
import { dueItems } from '../../bank/requeue';
import { buildResult, type SessionResult } from '../../bank/results';
import type { BankItem } from '../../bank/schema';
import type { PracticeSession } from '../../bank/session';
import { Btn, ImmersiveCtx, Header, Screen } from '../kit';
import { useTheme } from '../theme';
import { StudyHub } from '../StudyHub';
import { resolveNoteLink } from '../../bank/noteLink';
import { noteToBundleMap } from '../../bank/loader';
import { PRESET_PACKS } from '../../presets';
import bundlesJson from '../../../data/presets/bundles.json';
import type { ItemContext } from '../../pnle/itemContext';
import { finishRound, roundOfSessionId, weakBoostFrom, type BundleOf } from '../../bank/diagnosticRounds';
import { WeaknessProfileCard } from './WeaknessProfileCard';
import { useBank } from './BankProvider';
import { CustomSetup } from './CustomSetup';
import { DiagnosticResult } from './DiagnosticResult';
import { History } from './History';
import { Player } from './Player';
import { PracticeHub } from './PracticeHub';
import { Results } from './Results';
import { AdaptiveSummaryScreen, Path } from './Path';
import type { ItemReport } from './ReportSheet';
import {
  changedAnswerId, defaultCustom, hubStats, planNotice, planSession, planSessionId, resumeDecision, sessionFromPlan,
  type CustomValues, type Plan, type StartRequest,
} from './practiceFlow';

type View_ =
  | { v: 'hub' }
  | { v: 'custom' }
  | { v: 'history' }
  | { v: 'ai' }
  | { v: 'path' }
  | { v: 'profile' }
  | { v: 'adaptive'; result: SessionResult; items: BankItem[]; session: PracticeSession; st: AdaptiveState; scope: Scope; evidence: Partial<Record<string, number>> }
  | { v: 'session' }
  | { v: 'results'; result: SessionResult; items: BankItem[]; session: PracticeSession }
  | { v: 'dx'; result: SessionResult; items: BankItem[]; session: PracticeSession }
  | { v: 'review'; itemId: string; back: View_ };

const MODE_LABEL: Record<string, string> = {
  quick: 'Quick practice', smart: 'Smart set', custom: 'Custom practice', diagnostic: 'Diagnostic',
  mock: 'Mock board', weak: 'Weak spots', requeue: 'Missed questions', adaptive: 'Adaptive', case: 'Case study',
};

const NOTE_BUNDLE = noteToBundleMap(bundlesJson.bundles);
const BUNDLE_NAMES: Record<string, string> = Object.fromEntries(bundlesJson.bundles.map((b) => [b.id, b.name]));
const bundleOf: BundleOf = (i) => (i.noteId ? NOTE_BUNDLE.get(i.noteId) : undefined);
const noteTitle = (noteId: string): string | undefined => {
  for (const p of PRESET_PACKS) for (const n of p.notes) if (n.id === noteId) return n.title;
  return undefined;
};

export interface PracticeScreenProps {
  state: AppState;
  update: (s: AppState) => void;
  go: (tab: 'tutor' | 'topics') => void;
  /** Lets the shell's Android back button step out of a sub-screen. Return true when handled. */
  registerBack: (fn: (() => boolean) | null) => void;
  /** Open the tutor about one question. Without it 'Ask tutor' just opens the Tutor tab. */
  onAskTutor?: (ctx: ItemContext) => void;
  /** Open a note (topic id) in the app's note reader on top of Practice. Without it 'Read this in your notes' opens the Learn tab. */
  onReadNote?: (topicId: string) => void;
}

/** Practice tab runner: hub -> setup -> session -> finish -> results. The store saves the session after every answer. */
export function PracticeScreen({ state, update, go, registerBack, onAskTutor, onReadNote }: PracticeScreenProps) {
  const { colors } = useTheme();
  const setImmersive = useContext(ImmersiveCtx);
  const bank = useBank();
  const { state: bs, items, byId, attempts, today, dispatch } = bank;
  const [view, setView] = useState<View_>({ v: 'hub' });
  const [notice, setNotice] = useState('');

  const saved = bs.session;
  const decision = useMemo(() => resumeDecision(saved, byId), [saved, byId]);

  // A saved session whose questions left the bank cannot be played: clear it once.
  useEffect(() => {
    if (bank.ready && decision.kind === 'discard') void dispatch({ type: 'session/clear' });
  }, [bank.ready, decision.kind, dispatch]);

  const inSession = view.v === 'session' || view.v === 'review';
  useEffect(() => {
    setImmersive(inSession);
    return () => setImmersive(false);
  }, [inSession, setImmersive]);

  useEffect(() => {
    if (view.v === 'hub') {
      registerBack(null);
      return undefined;
    }
    registerBack(() => {
      if (view.v === 'session') return true; // leave through the Leave button so progress is saved on purpose
      setView(view.v === 'review' ? view.back : { v: 'hub' });
      return true;
    });
    return () => registerBack(null);
  }, [view, registerBack]);

  const askTutor = (itemId: string, from?: PracticeSession | null) => {
    const item = byId.get(itemId);
    if (!item || !onAskTutor) return go('tutor');
    onAskTutor({ item, selected: (from ?? saved)?.answers[itemId]?.selected });
  };

  const resolveNote = useMemo(
    () => (item: BankItem) => resolveNoteLink(item, state.topics, { noteBundle: NOTE_BUNDLE, bundleNames: BUNDLE_NAMES, noteTitle }),
    [state.topics],
  );
  const readNote = (topicId: string) => (onReadNote ? onReadNote(topicId) : go('topics'));

  const profile = state.dx?.profile;
  const stats = useMemo(() => hubStats(items, bs, attempts, today, profile), [items, bs, attempts, today, profile]);

  const begin = async (plan: Plan, label: string) => {
    const msg = planNotice(plan, label);
    if (plan.ids.length === 0) return setNotice(msg ?? '');
    const now = Date.now();
    await dispatch({ type: 'session/start', session: sessionFromPlan(plan, planSessionId(plan, now), now) });
    setNotice([msg, ...(plan.notes ?? [])].filter(Boolean).join(' '));
    setView({ v: 'session' });
  };

  const start = (req: StartRequest) => {
    const plan = planSession(req, {
      items, attempts, seed: Date.now(), flaggedIds: Object.keys(bs.flags), dueIds: dueItems(bs.requeue, today),
      dx: state.dx, bundleOf, bundleNames: BUNDLE_NAMES, weakBoost: weakBoostFrom(profile, bundleOf),
    });
    void begin(plan, MODE_LABEL[plan.mode] ?? 'this mode');
  };

  const startCustom = (values: CustomValues) => start({ kind: 'custom', values });

  const onChange = (next: PracticeSession) => {
    const id = changedAnswerId(saved, next);
    const item = id ? byId.get(id) : undefined;
    const ans = id ? next.answers[id] : undefined;
    void (async () => {
      const after = id && item && ans
        ? await dispatch({ type: 'session/answer', item, selected: ans.selected, now: Date.now(), seconds: ans.seconds, hinted: ans.hinted })
        : await dispatch({ type: 'session/update', session: next });
      // Adaptive exam: once every queued question is answered, pick the next one for the new ability estimate.
      const cur = after.session;
      if (isAdaptive(cur)) {
        const ext = extendAdaptive(cur, adaptivePool(items, cur.adaptive.scope), byId);
        if (ext !== cur) await dispatch({ type: 'session/update', session: ext });
      }
    })();
  };

  const startAdaptiveExam = async (scope: Scope) => {
    const now = Date.now();
    const s = startAdaptive(items, {
      id: `adaptive-${now}`, now, scope, seed: `adaptive-${now}`,
      start: thetaFromAttempts(byId, attempts).theta, weak: weakBonusFrom(attempts),
    });
    if (!s) return setNotice('No questions are available for the adaptive exam yet.');
    await dispatch({ type: 'session/start', session: s });
    setNotice('');
    setView({ v: 'session' });
  };

  const launchPath = (l: NonNullable<Launch>) => {
    if (l.kind === 'practice') start({ kind: 'custom', values: { ...defaultCustom(), areas: [l.area], topics: l.topics, count: l.count } });
    else if (l.kind === 'mock') start({ kind: 'mock', area: l.area });
    else start({ kind: l.kind });
  };

  const onFinish = async (done: PracticeSession) => {
    const after = await dispatch({ type: 'session/finish', now: Date.now() });
    const s = after.session ?? done;
    const sItems = s.order.map((id) => byId.get(id)).filter((x): x is BankItem => !!x);
    const earlier = attempts.filter((a) => a.sessionId !== s.id);
    const result = buildResult(s, sItems, earlier);
    if (s.mode === 'diagnostic') {
      const byId = new Map(items.map((i) => [i.id, i]));
      const dx = finishRound(state.dx, s, attempts, { byId, bundleOf, names: BUNDLE_NAMES }, Date.now());
      if (dx !== state.dx) update({ ...state, dx });
    }
    if (isAdaptive(s)) {
      const st = replayAdaptive(s, byId);
      const evidence: Partial<Record<string, number>> = {};
      for (const a of earlier) evidence[a.area] = (evidence[a.area] ?? 0) + 1;
      for (const [a, n] of Object.entries(st.n)) evidence[a] = (evidence[a] ?? 0) + (n ?? 0);
      return setView({ v: 'adaptive', result, items: sItems, session: s, st, scope: s.adaptive.scope, evidence });
    }
    setView({ v: s.mode === 'diagnostic' ? 'dx' : 'results', result, items: sItems, session: s });
  };

  const onReport = (r: ItemReport) => {
    void dispatch({ type: 'report/add', id: `rep-${r.at}-${r.itemId}`, itemId: r.itemId, text: `${r.kind}: ${r.note}`.trim(), now: r.at });
  };

  const retryMissed = (ids: string[]) =>
    void begin({ mode: 'custom', ids, requested: ids.length, short: false, revealMode: 'now' }, 'the missed questions');

  const showResults = (session: PracticeSession) => {
    const sItems = session.order.map((id) => byId.get(id)).filter((x): x is BankItem => !!x);
    const result = buildResult(session, sItems, attempts.filter((a) => a.sessionId !== session.id));
    setView({ v: session.mode === 'diagnostic' ? 'dx' : 'results', result, items: sItems, session });
  };

  if (!bank.ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  if (view.v === 'session' && saved && saved.status === 'active') {
    return (
      <Player
        session={saved}
        items={saved.order.map((id) => byId.get(id)).filter((x): x is BankItem => !!x)}
        onChange={onChange}
        onFinish={(s) => void onFinish(s)}
        onLeave={() => setView({ v: 'hub' })}
        onReport={onReport}
        onAskTutor={(id) => askTutor(id, saved)}
        resolveNote={resolveNote}
        onReadNote={readNote}
      />
    );
  }

  if (view.v === 'review') {
    const base = (view.back.v === 'results' || view.back.v === 'dx') ? view.back.session : saved;
    if (!base) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
    const one: PracticeSession = { ...base, itemIds: [view.itemId], order: [view.itemId], cursor: 0, status: 'done', revealMode: 'now' };
    const back = view.back;
    return (
      <Player
        session={one}
        items={[byId.get(view.itemId)].filter((x): x is BankItem => !!x)}
        onChange={() => undefined}
        onFinish={() => setView(back)}
        onLeave={() => setView(back)}
        onReport={onReport}
        onAskTutor={(id) => askTutor(id, base)}
        resolveNote={resolveNote}
        onReadNote={readNote}
      />
    );
  }

  if (view.v === 'adaptive') {
    const cur = view;
    return (
      <AdaptiveSummaryScreen
        state={cur.st}
        scope={cur.scope}
        evidence={cur.evidence}
        onDetails={() => setView({ v: 'results', result: cur.result, items: cur.items, session: cur.session })}
        onDone={() => setView({ v: 'hub' })}
      />
    );
  }

  if (view.v === 'path') {
    return (
      <Path
        items={items}
        attempts={attempts}
        state={bs}
        today={today}
        onSetExam={(date) => void dispatch({ type: 'exam/set', date })}
        onSetMinutes={(minutes) => void dispatch({ type: 'path/minutes', minutes })}
        onLaunch={launchPath}
        onBack={() => setView({ v: 'hub' })}
      />
    );
  }

  if (view.v === 'results' || view.v === 'dx') {
    const cur = view;
    const common = {
      onReviewItem: (itemId: string) => setView({ v: 'review', itemId, back: cur }),
    };
    if (view.v === 'dx') {
      return (
        <DiagnosticResult
          result={view.result}
          round={roundOfSessionId(view.session.id)}
          profile={profile}
          onDetails={() => setView({ v: 'results', result: cur.result, items: cur.items, session: cur.session })}
          onDone={() => setView({ v: 'hub' })}
          onNext={(round) => start({ kind: 'diagnostic', round })}
          onPractice={() => start({ kind: 'weak', count: 10 })}
        />
      );
    }
    return (
      <Results
        result={view.result}
        items={view.items}
        {...common}
        onRetryMissed={() => retryMissed(cur.result.missedIds)}
        onDone={() => setView({ v: 'hub' })}
        onAskTutor={(id) => askTutor(id, cur.session)}
      />
    );
  }

  if (view.v === 'custom') {
    return (
      <CustomSetup
        items={items}
        attempts={attempts}
        flaggedIds={Object.keys(bs.flags)}
        onStart={startCustom}
        onBack={() => setView({ v: 'hub' })}
      />
    );
  }

  if (view.v === 'history') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header title="History" onBack={() => setView({ v: 'hub' })} />
        <History
          entries={bank.history}
          onResume={(id) => (saved?.id === id && saved.status === 'active' ? setView({ v: 'session' }) : setNotice('That session can no longer be resumed.'))}
          onReview={(id) => {
            if (saved?.id === id && saved.status === 'done') return showResults(saved);
            setNotice('Only your most recent session can be opened in detail.');
            setView({ v: 'hub' });
          }}
        />
      </View>
    );
  }

  if (view.v === 'profile' && profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header title="Weakness profile" onBack={() => setView({ v: 'hub' })} />
        <Screen>
          <WeaknessProfileCard profile={profile} />
          <Btn label="Practice my weak spots" onPress={() => start({ kind: 'weak', count: 10 })} />
          <Btn label="Back" kind="ghost" onPress={() => setView({ v: 'hub' })} />
        </Screen>
      </View>
    );
  }

  if (view.v === 'ai') return <StudyHub state={state} update={update} onBack={() => setView({ v: 'hub' })} />;

  return (
    <PracticeHub
      stats={stats}
      resume={decision}
      resumeLabel={saved ? MODE_LABEL[saved.mode] : undefined}
      notice={notice}
      onStart={start}
      onCustom={() => { setNotice(''); setView({ v: 'custom' }); }}
      onContinue={() => setView({ v: 'session' })}
      onDiscardSaved={() => void dispatch({ type: 'session/clear' })}
      onHistory={() => { setNotice(''); setView({ v: 'history' }); }}
      onAi={() => setView({ v: 'ai' })}
      onAdaptive={(scope) => void startAdaptiveExam(scope)}
      onPath={() => { setNotice(''); setView({ v: 'path' }); }}
      pathDetail={bs.examDate ? countdownText(today, bs.examDate) : undefined}
      dx={state.dx}
      onProfile={() => { setNotice(''); setView({ v: 'profile' }); }}
    />
  );
}
