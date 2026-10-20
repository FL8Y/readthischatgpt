import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { AppState } from '../core/types';
import { ProviderError } from '../ai/provider';
import { TutorCancelled, tutorCall } from '../tutor/call';
import { appendOnce, splitReply, tutorRequest, unansweredQuestion, type TutorMessage } from '../tutor/prompt';
import { loadChat, saveChat } from '../tutor/store';
import { itemContextText, itemQuickAsks, type ItemContext } from '../pnle/itemContext';
import { Btn, Card, Field, H, P, Pill } from './kit';
import { space, useTheme } from './theme';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

function Reply({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      {splitReply(text).map((p, i) =>
        p.kind === 'text' ? (
          <Text key={i} selectable style={{ color: colors.text, fontSize: 16, lineHeight: 23 }}>
            {p.text.trim()}
          </Text>
        ) : (
          <View key={i} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: space.md, gap: space.xs, backgroundColor: colors.bg }}>
            <Text style={{ color: colors.textDim, fontSize: 13 }}>{`Diagram (${p.lang}) - drawing is not shown here yet`}</Text>
            <Text selectable style={{ color: colors.text, fontFamily: 'monospace', fontSize: 12 }}>
              {p.text}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}

/** Tutor tab: optional topic, chat list, send / cancel / retry. History is saved after every change. */
export function Tutor({ state, itemContext, onClearContext }: { state: AppState; itemContext?: ItemContext; onClearContext?: () => void }) {
  const { colors } = useTheme();
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

  // Opened from a question: pick the matching note topic so answers start from the learner's own notes.
  const ctxId = itemContext?.item.id;
  useEffect(() => {
    if (!itemContext) return;
    const it = itemContext.item;
    const t = state.topics.find((x) => x.id === it.noteId || x.id === it.topicId) ?? state.topics.find((x) => x.title.toLowerCase() === it.topic.toLowerCase());
    if (t) setTopicId(t.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxId]);

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
      const base = tutorRequest(state, topic, prior, q.text, now);
      const req = itemContext ? { ...base, user: `${itemContextText(itemContext)}\n\n${base.user}` } : base;
      const reply = await tutorCall(state.settings, req, ctl.signal);
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

  const send = (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text || busy) return;
    if (override === undefined) setDraft('');
    const now = Date.now();
    void ask({ id: `u-${now}-${messages.length}`, role: 'user', text, at: now }, messages);
  };

  const pending = unansweredQuestion(messages);
  const retry = () => {
    if (pending && !busy) void ask(pending, messages.slice(0, -1));
  };

  return (
    <View style={{ gap: space.md }}>
      <H>Tutor</H>
      {itemContext ? (
        <Card tone="tinted">
          <Pill text="About this question" color={colors.accentText} />
          <P>{itemContext.item.stem}</P>
          <P dim>The tutor can see the case, the options, your answer and the rationale.</P>
          <View style={{ gap: space.sm }}>
            {itemQuickAsks(itemContext).map((q) => (
              <Btn key={q} label={q} kind="ghost" disabled={busy} onPress={() => send(q)} />
            ))}
            {onClearContext ? <Btn label="Done with this question" kind="ghost" onPress={onClearContext} /> : null}
          </View>
        </Card>
      ) : null}
      <Card>
        <P dim>Topic (optional). Answers start from your own notes.</P>
        <View style={{ gap: space.sm }}>
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
          <Pill text={m.role === 'user' ? 'You' : 'Tutor'} color={m.role === 'user' ? colors.accentText : colors.success} />
          {m.role === 'user' ? <P>{m.text}</P> : <Reply text={m.text} />}
        </Card>
      ))}

      {busy ? <P dim>Thinking…</P> : null}
      {err ? <P>{err}</P> : null}
      {busy ? <Btn label="Cancel" kind="danger" onPress={() => abort.current?.abort()} /> : null}
      {!busy && pending ? <Btn label="Retry" onPress={retry} hint="Sends the last question again without repeating it in the chat" /> : null}

      <Field label="Your question" value={draft} onChangeText={setDraft} multiline placeholder="Ask anything about this topic" />
      <Btn label="Send" onPress={() => send()} disabled={busy || !draft.trim()} />
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
