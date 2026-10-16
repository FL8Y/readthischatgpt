import React, { useRef, useState } from 'react';
import type { AppState } from '../core/types';
import { eventId, resultFromEvents, unansweredQuestions, type QuizSession, type SessionResult } from '../core/quiz';
import { Btn, Card, P, Pill, c } from './kit';

/**
 * Shared question runner: instant feedback + rationale. Every answer is written to the event ledger
 * immediately under a session-scoped id, so a replay never double counts and closing the app never
 * loses recorded answers. Remounting with the same session resumes at the first unanswered question.
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
  const [picked, setPicked] = useState<number | null>(null);
  const q = session.questions[i];
  if (!q) return null;

  const answer = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    const cur = latest.current;
    const id = eventId(session.id, q.id);
    if (cur.events.some((e) => e.id === id)) return;
    const event = { id, questionId: q.id, topicId: q.topicId, correct: idx === q.answerIndex, at: Date.now(), kind: session.kind };
    latest.current = { ...cur, events: [...cur.events, event] };
    update(latest.current);
  };

  const next = () => {
    if (i + 1 >= total) onDone(resultFromEvents(session, latest.current.events));
    else {
      setI(i + 1);
      setPicked(null);
    }
  };

  return (
    <Card>
      <P dim>
        Question {i + 1} of {total}
      </P>
      <P>{q.stem}</P>
      {q.choices.map((choice, idx) => (
        <Btn key={idx} label={choice} kind={picked !== null && idx === q.answerIndex ? 'primary' : 'ghost'} onPress={() => answer(idx)} />
      ))}
      {picked !== null ? (
        <>
          <Pill text={picked === q.answerIndex ? 'Correct' : 'Not quite'} color={picked === q.answerIndex ? c.good : c.bad} />
          <P>{q.rationale}</P>
          <Btn label={i + 1 >= total ? 'Finish' : 'Next'} onPress={next} />
        </>
      ) : null}
      {onCancel && picked === null ? <Btn label="Stop for now" kind="ghost" onPress={onCancel} /> : null}
    </Card>
  );
}
