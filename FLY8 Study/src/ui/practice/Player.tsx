import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import type { BankItem } from '../../bank/schema';
import type { NoteLink } from '../../bank/noteLink';
import {
  answerItem, finishSession, flagItem, isAnswered, moveTo, pauseSession, resumeSession, strikeOption,
  type PracticeSession,
} from '../../bank/session';
import { Btn, Chip, haptic } from '../kit';
import { BOTTOM_INSET, TOP_INSET } from '../kitParts';
import { radius, space, useTheme } from '../theme';
import { OptionRow } from './OptionRow';
import { CaseItemInput, CasePanel, CaseResultCard, stemIsInline, vignetteIsInline } from './CaseSet';
import { QuestionMap } from './QuestionMap';
import { RationaleCard } from './RationaleCard';
import { TimerHeader } from './TimerHeader';
import type { ItemReport } from './ReportSheet';
import { caseSetResult, clusterAnswered, clusterAt, clusterItems, emptyResponse, slotsOf } from './caseLogic';
import {
  canGoPrevious, canSubmit, dropStruck, isLastQuestion, isLocked, isMultiPick, isPlayable, isTimeUp,
  mapCounts, optionVerdict, secondsSince, selectHint, showsFeedback, struckOf, toggleSelection, usesOptionRows,
} from './playerLogic';

export interface PlayerProps {
  session: PracticeSession;
  items: BankItem[];
  /** Called with every new session state (parent persists it). */
  onChange: (session: PracticeSession) => void;
  /** Called with the finished session (status 'done'). */
  onFinish: (session: PracticeSession) => void;
  /** Called after "Save and exit" (the session is already paused and sent through onChange) and after Cancel-free exits. */
  onLeave: () => void;
  onReport: (report: ItemReport) => void;
  onAskTutor?: (itemId: string) => void;
  /** Where to read this question again; hidden when it returns kind 'none' or is missing. */
  resolveNote?: (item: BankItem) => NoteLink;
  /** Opens the topic with this id in the note reader. The session stays saved underneath. */
  onReadNote?: (topicId: string) => void;
}

interface DialogAction { label: string; kind?: 'primary' | 'ghost' | 'danger'; onPress: () => void }

function Dialog({ visible, title, body, actions }: { visible: boolean; title: string; body: string; actions: DialogAction[] }) {
  const { colors, type } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: space.xl }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
          <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>{title}</Text>
          <Text style={[type('body'), { color: colors.textDim }]}>{body}</Text>
          {actions.map((a) => <Btn key={a.label} label={a.label} kind={a.kind} onPress={a.onPress} />)}
        </View>
      </View>
    </Modal>
  );
}

/** One question per page. Controlled: all state changes go out through onChange; nothing is stored here. */
export function Player({ session, items, onChange, onFinish, onLeave, onReport, onAskTutor, resolveNote, onReadNote }: PlayerProps) {
  const { colors, type } = useTheme();
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [now, setNow] = useState(() => Date.now());
  const [drafts, setDrafts] = useState<Record<string, number[]>>({});
  const [mapOpen, setMapOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [timeUpSeen, setTimeUpSeen] = useState(false);
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const shownAt = useRef(Date.now());

  const id = session.order[session.cursor];
  const item = id ? byId.get(id) : undefined;

  useEffect(() => {
    if (session.status !== 'active') return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session.status]);

  useEffect(() => {
    shownAt.current = Date.now();
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [session.cursor]);

  const finish = () => onFinish(finishSession(session, Date.now()));
  const timeUp = !timeUpSeen && isTimeUp(session, now);

  if (!item || !id) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.xl, justifyContent: 'center', gap: space.md }}>
        <Text style={[type('body'), { color: colors.text }]}>This question could not be loaded.</Text>
        <Btn label="Leave" onPress={onLeave} />
      </View>
    );
  }
  if (!isPlayable(item)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.xl, justifyContent: 'center', gap: space.md }}>
        <Text style={[type('body'), { color: colors.text }]}>This question type is not supported yet.</Text>
        <Btn label="Skip this question" onPress={() => onChange(moveTo(session, session.cursor + 1))} />
      </View>
    );
  }

  const ans = session.answers[id];
  const struck = struckOf(session, id);
  const locked = isLocked(session, id);
  const answered = isAnswered(session, id);
  const feedback = showsFeedback(session, id);
  const rawPos = clusterAt(session.order, byId, session.cursor);
  const pos = rawPos && rawPos.size > 1 ? rawPos : null;
  const optionRows = usesOptionRows(item);
  const selected = optionRows ? (drafts[id] ?? ans?.selected ?? []) : slotsOf(item, drafts[id] ?? ans?.selected ?? emptyResponse(item));
  const multi = isMultiPick(item);
  const dirty = answered && !locked && selected.join() !== (ans?.selected ?? []).join();
  const last = isLastQuestion(session);

  const setDraft = (sel: number[]) => setDrafts((d) => ({ ...d, [id]: sel }));
  const submit = () => {
    if (!canSubmit(item, selected, locked)) return;
    const next = answerItem(session, item, selected, { seconds: secondsSince(shownAt.current, Date.now()) });
    const a = next.answers[id];
    if (session.revealMode === 'now') haptic(a?.correct ? 'success' : 'error');
    onChange(next);
  };
  const strike = (idx: number) => {
    if (locked) return;
    const nowStruck = !struck.includes(idx);
    const next = strikeOption(session, id, idx);
    if (nowStruck) setDraft(dropStruck(selected, [idx]));
    onChange(next);
  };
  const goNext = () => {
    if (!last) return onChange(moveTo(session, session.cursor + 1));
    if (mapCounts(session).unanswered > 0) return setFinishOpen(true);
    finish();
  };

  const primary = answered && !dirty
    ? { label: last ? 'Finish' : 'Next', onPress: goNext, disabled: false }
    : { label: dirty ? 'Update answer' : 'Submit', onPress: submit, disabled: !canSubmit(item, selected, locked) };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: TOP_INSET }}>
      <TimerHeader
        session={session}
        now={now}
        flagged={!!ans?.flagged}
        onLeave={() => setLeaveOpen(true)}
        onPause={() => onChange(pauseSession(session, Date.now()))}
        onResume={() => onChange(resumeSession(session, Date.now()))}
        onFlag={() => onChange(flagItem(session, id, !ans?.flagged))}
        onMap={() => setMapOpen(true)}
      />
      {pos ? <CasePanel pos={pos} vignette={item.vignette} hideText={vignetteIsInline(item)} /> : null}
      <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip text={item.topic} tone="neutral" />
          {ans?.flagged ? <Chip text="Flagged" tone="warning" icon="flag" /> : null}
        </View>
        {item.vignette && !pos && !vignetteIsInline(item) ? <Text style={[type('body'), { color: colors.text }]}>{item.vignette}</Text> : null}
        {!stemIsInline(item) ? <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>{item.stem}</Text> : null}
        {!optionRows ? (
          <CaseItemInput item={item} selected={selected} locked={locked} showVerdict={feedback} onChange={setDraft} onDone={submit} />
        ) : null}
        {optionRows ? <Text style={[type('label'), { color: colors.accentText }]}>{selectHint(item)}</Text> : null}
        <View style={{ gap: space.sm, display: optionRows ? 'flex' : 'none' }} accessibilityRole={multi ? undefined : 'radiogroup'}>
          {(optionRows ? item.options : []).map((text, idx) => (
            <OptionRow
              key={idx}
              index={idx}
              text={text}
              multi={multi}
              selected={selected.includes(idx)}
              struck={struck.includes(idx)}
              verdict={feedback ? optionVerdict(item, ans?.selected ?? [], idx) : undefined}
              disabled={locked}
              onPress={() => setDraft(toggleSelection(item, selected, idx, struck, locked))}
              onStrike={locked ? undefined : () => strike(idx)}
            />
          ))}
        </View>
        {!locked && optionRows ? <Text style={[type('caption'), { color: colors.textDim }]}>Tip: long press an option to cross it out.</Text> : null}
        {feedback ? (
          <RationaleCard item={item} answer={ans} note={resolveNote?.(item)} onReadNote={onReadNote} onAskTutor={onAskTutor} onReport={onReport} />
        ) : answered && session.revealMode === 'end' ? (
          <Text style={[type('caption'), { color: colors.textDim }]}>Answer saved. Results show at the end.</Text>
        ) : null}
        {pos && pos.end === session.cursor && feedback && clusterAnswered(session, clusterItems(session, byId, pos)) ? (
          <CaseResultCard result={caseSetResult(session, clusterItems(session, byId, pos))} />
        ) : null}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: space.sm, padding: space.lg, paddingBottom: space.lg + BOTTOM_INSET, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        {canGoPrevious(session) ? (
          <View style={{ flex: 1 }}><Btn label="Previous" kind="ghost" onPress={() => onChange(moveTo(session, session.cursor - 1))} /></View>
        ) : null}
        {!answered && !last ? (
          <View style={{ flex: 1 }}><Btn label="Skip" kind="ghost" onPress={() => onChange(moveTo(session, session.cursor + 1))} /></View>
        ) : null}
        <View style={{ flex: 2 }}><Btn label={primary.label} onPress={primary.onPress} disabled={primary.disabled} /></View>
      </View>

      <QuestionMap
        session={session}
        visible={mapOpen}
        onJump={(i) => {
          setMapOpen(false);
          onChange(moveTo(session, i));
        }}
        onClose={() => setMapOpen(false)}
      />
      <Dialog
        visible={leaveOpen}
        title="Leave practice?"
        body="Save and exit lets you pick up where you stopped. End now scores what you have answered."
        actions={[
          { label: 'Save and exit', onPress: () => { setLeaveOpen(false); onChange(pauseSession(session, Date.now())); onLeave(); } },
          { label: 'End now', kind: 'danger', onPress: () => { setLeaveOpen(false); finish(); } },
          { label: 'Cancel', kind: 'ghost', onPress: () => setLeaveOpen(false) },
        ]}
      />
      <Dialog
        visible={finishOpen}
        title="Finish with unanswered questions?"
        body={`${mapCounts(session).unanswered} not answered. Unanswered questions score 0.`}
        actions={[
          { label: 'Finish', onPress: () => { setFinishOpen(false); finish(); } },
          { label: 'Keep working', kind: 'ghost', onPress: () => { setFinishOpen(false); setMapOpen(true); } },
        ]}
      />
      <Dialog
        visible={timeUp}
        title="Time is up"
        body="The timer is soft: nothing ends on its own. Choose what to do next."
        actions={[
          { label: 'End', kind: 'danger', onPress: finish },
          { label: 'Take a break', kind: 'ghost', onPress: () => { setTimeUpSeen(true); onChange(pauseSession(session, Date.now())); } },
          { label: 'Keep going', kind: 'ghost', onPress: () => setTimeUpSeen(true) },
        ]}
      />
      {session.timer.paused && session.status === 'active' ? (
        <View
          accessibilityViewIsModal
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, justifyContent: 'center', padding: space.xl, gap: space.md }}
        >
          <Text accessibilityRole="header" style={[type('title'), { color: colors.text, textAlign: 'center' }]}>Paused</Text>
          <Text style={[type('body'), { color: colors.textDim, textAlign: 'center' }]}>The question is hidden while the timer is stopped.</Text>
          <Btn label="Resume" onPress={() => onChange(resumeSession(session, Date.now()))} />
        </View>
      ) : null}
    </View>
  );
}
