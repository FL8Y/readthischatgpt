import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AppState, AttemptEvent, Question } from '../core/types';
import { eventId, resultFromEvents, unansweredQuestions, type QuizSession, type SessionResult } from '../core/quiz';
import { POINTS } from '../core/mastery';
import {
  answerWeight,
  describeCorrect,
  gradeAnswer,
  kindOf,
  presentationOrder,
  shuffleSeeded,
  type Answer,
  type Grade,
} from '../core/grading';
import { BLANK_MARK } from '../core/questionParse';
import { callModel } from '../ai/provider';
import { explainRequest } from '../ai/quizPrompts';
import { Btn, Card, Field, P, Pill, TOUCH, c, s } from './kit';

export const MAX_HINTS = 2;

/** Large tap target used by matching and ordering (no drag-only interactions). */
function Tile({
  label,
  a11y,
  onPress,
  selected,
  disabled,
  tone,
}: {
  label: string;
  a11y?: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  tone?: 'good' | 'bad';
}) {
  const border = tone === 'good' ? c.good : tone === 'bad' ? c.bad : selected ? c.accent : c.line;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: TOUCH,
        justifyContent: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: border,
        backgroundColor: selected ? c.accentSoft : c.raised,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <Text style={[s.p, { fontSize: 16 }]}>{label}</Text>
    </Pressable>
  );
}

interface InputProps {
  q: Question;
  seed: string;
  locked: boolean;
  onSubmit: (a: Answer) => void;
}

function TypingInput({ q, locked, onSubmit }: InputProps) {
  const [text, setText] = useState('');
  return (
    <>
      <Field label="Your answer" value={text} onChangeText={setText} editable={!locked} autoCapitalize="none" autoCorrect={false} />
      {!locked ? <Btn label="Check" disabled={!text.trim()} onPress={() => onSubmit(text)} /> : null}
    </>
  );
}

function ClozeInput({ q, locked, onSubmit }: InputProps) {
  const n = q.blanks?.length ?? 0;
  const [vals, setVals] = useState<string[]>(() => Array.from({ length: n }, () => ''));
  const parts = q.stem.split(BLANK_MARK);
  const shown = parts.map((p, k) => (k < parts.length - 1 ? `${p}(${k + 1})` : p)).join('');
  return (
    <>
      <P>{shown}</P>
      {vals.map((v, k) => (
        <Field
          key={k}
          label={`Blank ${k + 1}`}
          value={v}
          editable={!locked}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(t) => setVals((cur) => cur.map((x, j) => (j === k ? t : x)))}
        />
      ))}
      {!locked ? <Btn label="Check" disabled={vals.some((v) => !v.trim())} onPress={() => onSubmit(vals)} /> : null}
    </>
  );
}

/** Tap a left item, then tap its match on the right. Answers are canonical pair indices. */
function MatchingInput({ q, seed, locked, onSubmit }: InputProps) {
  const pairs = q.pairs ?? [];
  const [assign, setAssign] = useState<(number | null)[]>(() => pairs.map(() => null));
  const [sel, setSel] = useState<number | null>(0);
  const order = useRef(presentationOrder(pairs.length, seed)).current;

  const pickRight = (ri: number) => {
    if (locked || sel === null) return;
    const next = assign.map((v) => (v === ri ? null : v));
    next[sel] = ri;
    setAssign(next);
    const nextFree = next.findIndex((v, k) => v === null && k !== sel);
    setSel(nextFree >= 0 ? nextFree : null);
  };

  return (
    <>
      <P dim>{locked ? 'Your matches' : 'Tap an item on the left, then tap its match on the right.'}</P>
      {pairs.map((p, k) => {
        const m = assign[k];
        const label = m === null ? `${p.left}  →  ?` : `${p.left}  →  ${pairs[m].right}`;
        return (
          <Tile
            key={k}
            label={label}
            a11y={m === null ? `${p.left}, not matched yet${sel === k ? ', selected' : ''}` : `${p.left}, matched to ${pairs[m].right}${sel === k ? ', selected' : ''}`}
            selected={sel === k}
            disabled={locked}
            tone={locked ? (m === k ? 'good' : 'bad') : undefined}
            onPress={() => setSel(k)}
          />
        );
      })}
      {!locked ? (
        <>
          <P dim>Matches</P>
          {order.map((ri) => (
            <Tile
              key={ri}
              label={pairs[ri].right}
              a11y={`Match option: ${pairs[ri].right}${assign.includes(ri) ? ', already used' : ''}`}
              selected={assign.includes(ri)}
              disabled={sel === null}
              onPress={() => pickRight(ri)}
            />
          ))}
          <Btn label="Check" disabled={assign.some((v) => v === null)} onPress={() => onSubmit(assign as number[])} />
        </>
      ) : null}
    </>
  );
}

/** Tap items in the order you think is right; tap a placed item to take it back. Answers are canonical item indices. */
function OrderingInput({ q, seed, locked, onSubmit }: InputProps) {
  const items = q.items ?? [];
  const [placed, setPlaced] = useState<number[]>([]);
  const order = useRef(presentationOrder(items.length, seed)).current;
  const pool = order.filter((i) => !placed.includes(i));
  return (
    <>
      <P dim>{locked ? 'Your order' : 'Tap items in order, first to last. Tap a placed item to remove it.'}</P>
      {placed.map((idx, pos) => (
        <Tile
          key={idx}
          label={`${pos + 1}. ${items[idx]}`}
          a11y={`Position ${pos + 1}: ${items[idx]}. ${locked ? '' : 'Tap to remove.'}`}
          selected
          disabled={locked}
          tone={locked ? (idx === pos ? 'good' : 'bad') : undefined}
          onPress={() => setPlaced((cur) => cur.filter((x) => x !== idx))}
        />
      ))}
      {!locked ? (
        <>
          {pool.length ? <P dim>Left to place</P> : null}
          {pool.map((idx) => (
            <Tile key={idx} label={items[idx]} a11y={`Place: ${items[idx]}`} onPress={() => setPlaced((cur) => [...cur, idx])} />
          ))}
          <Btn label="Check" disabled={placed.length !== items.length} onPress={() => onSubmit(placed)} />
          {placed.length ? <Btn label="Reset order" kind="ghost" onPress={() => setPlaced([])} /> : null}
        </>
      ) : null}
    </>
  );
}

/** Plain-text rendering of what the learner answered, for the Explain prompt. */
function answerText(q: Question, a: Answer): string {
  switch (kindOf(q)) {
    case 'matching':
      return (a as number[]).map((m, k) => `${q.pairs?.[k]?.left} = ${q.pairs?.[m]?.right}`).join('; ');
    case 'ordering':
      return (a as number[]).map((i, pos) => `${pos + 1}. ${q.items?.[i]}`).join('; ');
    case 'cloze':
      return (a as string[]).map((v, k) => `${k + 1}. ${v}`).join('; ');
    case 'choice':
      return q.choices[a as number] ?? '';
    default:
      return String(a);
  }
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Feedback for every option of a PNLE item: the correct one is highlighted, each wrong one says why it tempts. */
function OptionFeedback({ q, picked }: { q: Question; picked: number | null }) {
  const notes = q.optionRationales;
  if (kindOf(q) !== 'choice' || !notes || notes.length !== q.choices.length) return null;
  return (
    <View accessibilityLabel="Why each option is right or wrong" style={{ gap: 8 }}>
      {q.choices.map((choice, idx) => {
        const right = idx === q.answerIndex;
        const tag = right ? 'correct answer' : picked === idx ? 'your answer, not correct' : 'not correct';
        return (
          <View
            key={idx}
            accessible
            accessibilityLabel={`Option ${LETTERS[idx] ?? idx + 1}, ${tag}. ${choice}. ${notes[idx]}`}
            style={{
              minHeight: TOUCH,
              justifyContent: 'center',
              gap: 4,
              padding: 12,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: right ? c.good : picked === idx ? c.bad : c.line,
              backgroundColor: right ? c.raised : c.card,
            }}
          >
            <Text style={[s.p, { fontWeight: '700', color: right ? c.good : c.text }]}>
              {LETTERS[idx] ?? idx + 1}. {choice}
              {right ? ' (correct)' : ''}
            </Text>
            <P dim>{notes[idx]}</P>
          </View>
        );
      })}
    </View>
  );
}

/** Collapsed "How to think about it" section; the text appears only after the learner opens it. */
function Reasoning({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide: how to think about it' : 'Show: how to think about it'}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{ minHeight: TOUCH, justifyContent: 'center' }}
      >
        <Text style={[s.p, { color: c.accent, fontWeight: '700' }]}>{open ? '▾' : '▸'} How to think about it</Text>
      </Pressable>
      {open ? <P>{text}</P> : null}
    </>
  );
}

interface Outcome {
  grade: Grade;
  weight: number;
  said: string;
}

type Explain = { status: 'idle' } | { status: 'loading' } | { status: 'done'; text: string } | { status: 'error'; message: string };

/**
 * Shared question runner: instant feedback + rationale. Every answer is written to the event ledger
 * immediately under a session-scoped id, so a replay never double counts and closing the app never
 * loses recorded answers. Remounting with the same session resumes at the first unanswered question.
 * Choice answers grade on tap; typing, cloze, matching and ordering grade on "Check", then "Continue".
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
  const latest = useRef(state);
  latest.current = state;
  const total = session.questions.length;
  const [start] = useState(() => total - unansweredQuestions(session, state.events).length);
  const [i, setI] = useState(Math.min(start, total - 1));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
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
      setHints(0);
      setExplain({ status: 'idle' });
    }
  };

  const askExplain = async () => {
    if (!outcome || explain.status === 'loading') return;
    const forQuestion = q.id;
    setExplain({ status: 'loading' });
    try {
      const text = await callModel(
        latest.current.settings,
        explainRequest(latest.current, q, outcome.said, outcome.grade.correct, Date.now()),
      );
      setExplain((cur) => (q.id === forQuestion && cur.status === 'loading' ? { status: 'done', text: text.trim() } : cur));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not get an explanation.';
      setExplain((cur) => (cur.status === 'loading' ? { status: 'error', message } : cur));
    }
  };

  const inputProps: InputProps = { q, seed, locked: !!outcome, onSubmit: submit };
  const points = outcome ? Math.round(POINTS.correct * outcome.weight) : 0;

  return (
    <Card>
      <P dim>
        Question {i + 1} of {total}
        {kind !== 'choice' ? ` · ${kind}` : ''}
      </P>
      {kind !== 'cloze' ? <P>{q.stem}</P> : null}

      {kind === 'choice'
        ? q.choices.map((choice, idx) => {
            const out = eliminated.includes(idx);
            return (
              <Btn
                key={idx}
                label={out ? `${choice} (ruled out)` : choice}
                kind={outcome && idx === q.answerIndex ? 'primary' : 'ghost'}
                disabled={out || !!outcome}
                onPress={() => {
                  setPicked(idx);
                  submit(idx);
                }}
              />
            );
          })
        : null}
      {kind === 'typing' ? <TypingInput key={q.id} {...inputProps} /> : null}
      {kind === 'cloze' ? <ClozeInput key={q.id} {...inputProps} /> : null}
      {kind === 'matching' ? <MatchingInput key={q.id} {...inputProps} /> : null}
      {kind === 'ordering' ? <OrderingInput key={q.id} {...inputProps} /> : null}

      {!outcome && maxHints > 0 ? (
        <Btn
          label={hints >= maxHints ? 'No more hints' : `Hint (${hints}/${maxHints}) - rules out one wrong answer`}
          kind="ghost"
          disabled={hints >= maxHints}
          hint="A correct answer after a hint earns half points"
          onPress={() => setHints((h) => Math.min(maxHints, h + 1))}
        />
      ) : null}

      {outcome ? (
        <>
          <Pill
            text={outcome.grade.correct ? 'Correct' : outcome.grade.partial ? `Partly right: ${outcome.grade.detail}` : 'Not quite'}
            color={outcome.grade.correct ? c.good : c.bad}
          />
          {kind !== 'choice' || picked !== q.answerIndex ? <P dim>Answer: {describeCorrect(q)}</P> : null}
          {q.strategy ? <Pill text={`Strategy: ${q.strategy}`} color={c.accent} /> : null}
          <P>{q.rationale}</P>
          <OptionFeedback q={q} picked={picked} />
          {q.reasoning ? <Reasoning key={q.id} text={q.reasoning} /> : null}
          <P dim>
            {points > 0 ? `+${points} pts${hints > 0 ? ' (half: hint used)' : ''}` : '+0 pts'}
          </P>
          {explain.status === 'done' ? <P>{explain.text}</P> : null}
          {explain.status === 'error' ? <P dim>Explain failed: {explain.message}</P> : null}
          {explain.status !== 'done' ? (
            <Btn
              label={explain.status === 'loading' ? 'Explaining...' : explain.status === 'error' ? 'Try Explain again' : 'Explain'}
              kind="ghost"
              disabled={explain.status === 'loading'}
              hint="Asks the AI to explain this question and your answer. Optional."
              onPress={() => void askExplain()}
            />
          ) : null}
          <Btn label={i + 1 >= total ? 'Finish' : kind === 'choice' ? 'Next' : 'Continue'} onPress={next} />
        </>
      ) : null}
      {onCancel && !outcome ? <Btn label="Stop for now" kind="ghost" onPress={onCancel} /> : null}
    </Card>
  );
}
