import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { AppState } from '../core/types';
import { ProviderError } from '../ai/provider';
import { TutorCancelled, tutorCall } from '../tutor/call';
import { appendOnce, splitReply, tutorRequest, unansweredQuestion, type TutorMessage } from '../tutor/prompt';
import { loadChat, saveChat } from '../tutor/store';
import { Btn, Card, Field, H, P, Pill, c, sp } from './kit';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

function Reply({ text }: { text: string }) {
  return (
    <View style={{ gap: sp.sm }}>
      {splitReply(text).map((p, i) =>
        p.kind === 'text' ? (
          <Text key={i} selectable style={{ color: c.text, fontSize: 16, lineHeight: 23 }}>
            {p.text.trim()}
          </Text>
        ) : (
          <View key={i} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: sp.md, gap: sp.xs, backgroundColor: c.bg }}>
            <Text style={{ color: c.dim, fontSize: 13 }}>{`Diagram (${p.lang}) - drawing is not shown here yet`}</Text>
            <Text selectable style={{ color: c.text, fontFamily: 'monospace', fontSize: 12 }}>
              {p.text}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}

/** Tutor tab: optional topic, chat list, send / cancel / retry. History is saved after every change. */
export function Tutor({ state }: { state: AppState }) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [topicId, setTopicId] = useState<string | undefined>();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const abort = useRef<AbortController | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    void loadChat().then((chat) => {
      setMessages(chat.messages);
      setTopicId(chat.topicId);
      ready.current = true;
    });
    return () => abort.current?.abort();
  }, []);

  const persist = (m: TutorMessage[], t: string | undefined) => {
    if (ready.current) void saveChat({ messages: m, topicId: t }).catch(() => undefined);
  };

  /** Asks about `q` given the messages before it. The user message `q` is added only once. */
  const ask = async (q: TutorMessage, prior: TutorMessage[]) => {
    const withQ = appendOnce(prior, q);
    setMessages(withQ);
    persist(withQ, topicId);
    setErr('');
    setBusy(true);
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      const now = Date.now();
      const topic = state.topics.find((t) => t.id === topicId);
      const reply = await tutorCall(state.settings, tutorRequest(state, topic, prior, q.text, now), ctl.signal);
      const done = [...withQ, { id: `a-${now}-${withQ.length}`, role: 'assistant' as const, text: reply, at: Date.now() }];
      setMessages(done);
      persist(done, topicId);
    } catch (e) {
      setErr(e instanceof TutorCancelled ? 'Cancelled. Your question is kept; tap Retry to send it again.' : e instanceof ProviderError ? e.message : msg(e));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    const now = Date.now();
    void ask({ id: `u-${now}-${messages.length}`, role: 'user', text, at: now }, messages);
  };

  const pending = unansweredQuestion(messages);
  const retry = () => {
    if (pending && !busy) void ask(pending, messages.slice(0, -1));
  };

  return (
    <View style={{ gap: sp.md }}>
      <H>Tutor</H>
      <Card>
        <P dim>Topic (optional). Answers start from your own notes.</P>
        <View style={{ gap: sp.sm }}>
          <Btn
            label={topicId ? 'No topic' : 'No topic (selected)'}
            kind="ghost"
            onPress={() => {
              setTopicId(undefined);
              persist(messages, undefined);
            }}
          />
          {state.topics.map((t) => (
            <Btn
              key={t.id}
              label={t.id === topicId ? `${t.title} (selected)` : t.title}
              kind="ghost"
              onPress={() => {
                setTopicId(t.id);
                persist(messages, t.id);
              }}
            />
          ))}
        </View>
      </Card>

      {messages.length === 0 ? <P dim>Ask a question about your notes to begin.</P> : null}
      {messages.map((m) => (
        <Card key={m.id}>
          <Pill text={m.role === 'user' ? 'You' : 'Tutor'} color={m.role === 'user' ? c.accent : c.good} />
          {m.role === 'user' ? <P>{m.text}</P> : <Reply text={m.text} />}
        </Card>
      ))}

      {busy ? <P dim>Thinking…</P> : null}
      {err ? <P>{err}</P> : null}
      {busy ? <Btn label="Cancel" kind="danger" onPress={() => abort.current?.abort()} /> : null}
      {!busy && pending ? <Btn label="Retry" onPress={retry} hint="Sends the last question again without repeating it in the chat" /> : null}

      <Field label="Your question" value={draft} onChangeText={setDraft} multiline placeholder="Ask anything about this topic" />
      <Btn label="Send" onPress={send} disabled={busy || !draft.trim()} />
      {messages.length ? (
        <Btn
          label="Clear chat"
          kind="ghost"
          disabled={busy}
          onPress={() => {
            setMessages([]);
            setErr('');
            persist([], topicId);
          }}
        />
      ) : null}
    </View>
  );
}
