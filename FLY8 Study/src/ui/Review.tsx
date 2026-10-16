import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AppState } from '../core/types';
import { callModel } from '../ai/provider';
import { cardsRequest, parseCards, type Card } from '../srs/cards';
import { dueQueue, formatInterval, previewDelays, newSched, RATINGS, MIN, type Rating } from '../srs/scheduler';
import { dispatchSrs, emptySnapshot, loadSrs, type SrsSnapshot } from '../srs/store';
import { Btn, Card as Box, EmptyState, Field, H, P, Pill, ProgressBar, TOUCH, c, sp } from './kit';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
const RATING_LABEL: Record<Rating, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
const RATING_COLOR: Record<Rating, string> = { again: c.bad, hard: c.warn, good: c.good, easy: c.accent };

/** Review tab: due queue, flip, rate, session summary, plus card generation and edit/dismiss. */
export function Review({ state }: { state: AppState }) {
  const [snap, setSnap] = useState<SrsSnapshot>(emptySnapshot());
  const [loaded, setLoaded] = useState(false);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState<Record<Rating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [editing, setEditing] = useState<Card | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [genOpen, setGenOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const seq = useRef(0);

  useEffect(() => {
    void loadSrs().then((s) => {
      setSnap(s);
      setLoaded(true);
    });
  }, []);

  // Serialised: each action reduces the latest snapshot and is written to storage straight away.
  const act = async (action: Parameters<typeof dispatchSrs>[1]) => {
    const next = await dispatchSrs(snapRef.current, action);
    snapRef.current = next;
    setSnap(next);
    return next;
  };

  const live = useMemo(() => snap.cards.filter((x) => !x.dismissed), [snap.cards]);
  const byId = useMemo(() => new Map(snap.cards.map((x) => [x.id, x])), [snap.cards]);
  const now = Date.now();
  const dueNow = useMemo(
    () => dueQueue(live, snap.sched, state.topics, state.events, now).length,
    [live, snap.sched, state.topics, state.events, now],
  );

  const start = () => {
    const q = dueQueue(live, snap.sched, state.topics, state.events, Date.now()).map((x) => x.cardId);
    setQueue(q);
    setPos(0);
    setFlipped(false);
    setTally({ again: 0, hard: 0, good: 0, easy: 0 });
    setNote('');
  };

  const rate = async (card: Card, rating: Rating) => {
    const at = Date.now();
    seq.current += 1;
    const next = await act({ type: 'review', event: { id: `${card.id}@${at}#${seq.current}`, cardId: card.id, rating, at } });
    setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
    // A card that comes back within 20 minutes is asked again before the session ends.
    const s = next.sched[card.id];
    setQueue((q) => (q && s && s.due - at < 20 * MIN ? [...q, card.id] : q));
    setFlipped(false);
    setPos((p) => p + 1);
  };

  const generate = async (topicId: string) => {
    const topic = state.topics.find((t) => t.id === topicId);
    if (!topic) return;
    setBusy(true);
    setErr('');
    setNote('');
    try {
      const t = Date.now();
      const raw = await callModel(state.settings, cardsRequest(state, topic, 8, t));
      const cards = parseCards(raw, state.topics, { topicId, idPrefix: `card-${t}`, now: t, existing: snapRef.current.cards });
      if (!cards.length) setErr('No usable cards came back. Try again.');
      else {
        await act({ type: 'addCards', cards, now: t });
        const flagged = cards.filter((x) => x.beyondNotes).length;
        setNote(`Added ${cards.length} cards${flagged ? `; ${flagged} go beyond your notes, check them against your textbook` : ''}.`);
        setGenOpen(false);
      }
    } catch (e) {
      setErr(msg(e));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <P dim>Loading cards…</P>;

  if (editing) {
    return (
      <Box>
        <H>Edit card</H>
        <Field label="Front" value={front} onChangeText={setFront} multiline />
        <Field label="Back" value={back} onChangeText={setBack} multiline />
        <Btn
          label="Save card"
          disabled={!front.trim() || !back.trim()}
          onPress={() => {
            void act({ type: 'editCard', id: editing.id, front, back });
            setEditing(null);
          }}
        />
        <Btn label="Cancel" kind="ghost" onPress={() => setEditing(null)} />
      </Box>
    );
  }

  if (genOpen) {
    return (
      <View style={{ gap: sp.md }}>
        <H>Generate cards for a topic</H>
        {state.topics.length === 0 ? <P dim>Add notes in Library first.</P> : null}
        {state.topics.map((t) => (
          <Btn key={t.id} label={t.title} kind="ghost" disabled={busy} onPress={() => void generate(t.id)} hint="Asks the AI for flashcards on this topic" />
        ))}
        {busy ? <P dim>Writing cards…</P> : null}
        {err ? <P>{err}</P> : null}
        <Btn label="Back" kind="ghost" onPress={() => setGenOpen(false)} />
      </View>
    );
  }

  if (queue) {
    const card = pos < queue.length ? byId.get(queue[pos]) : undefined;
    if (!card) {
      const total = RATINGS.reduce((n, r) => n + tally[r], 0);
      return (
        <Box>
          <H>Session complete</H>
          <P>{total ? `You reviewed ${total} card(s).` : 'No cards were reviewed.'}</P>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {RATINGS.map((r) => (
              <Pill key={r} text={`${RATING_LABEL[r]} ${tally[r]}`} color={RATING_COLOR[r]} />
            ))}
          </View>
          <Btn label="Done" onPress={() => setQueue(null)} />
        </Box>
      );
    }
    const t = Date.now();
    const delays = previewDelays(snap.sched[card.id] ?? newSched(card.id, t), t);
    return (
      <View style={{ gap: sp.md }}>
        <ProgressBar value={queue.length ? pos / queue.length : 0} label={`Card ${pos + 1} of ${queue.length}`} />
        <Box>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pill text={card.sourceTopicTitle} />
            {card.beyondNotes ? <Pill text="Beyond your notes, check your textbook" color={c.warn} /> : null}
            {card.edited ? <Pill text="Edited" /> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={flipped ? `Answer: ${card.back}. Tap to hide.` : `Question: ${card.front}. Tap to show the answer.`}
            onPress={() => setFlipped((f) => !f)}
            style={{ minHeight: TOUCH * 3, justifyContent: 'center' }}
          >
            <Text style={{ color: c.text, fontSize: 20, lineHeight: 28 }}>{card.front}</Text>
            {flipped ? <Text style={{ color: c.good, fontSize: 18, lineHeight: 26, marginTop: sp.md }}>{card.back}</Text> : null}
            {!flipped ? <Text style={{ color: c.dim, marginTop: sp.md }}>Tap to show the answer</Text> : null}
          </Pressable>
        </Box>
        {flipped ? (
          <View style={{ flexDirection: 'row', gap: sp.sm }}>
            {RATINGS.map((r) => (
              <Pressable
                key={r}
                accessibilityRole="button"
                accessibilityLabel={`${RATING_LABEL[r]}, next in ${formatInterval(delays[r])}`}
                onPress={() => void rate(card, r)}
                style={{ flex: 1, minHeight: TOUCH, borderRadius: 12, borderWidth: 1, borderColor: RATING_COLOR[r], alignItems: 'center', justifyContent: 'center', padding: sp.xs }}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>{RATING_LABEL[r]}</Text>
                <Text style={{ color: c.dim, fontSize: 12 }}>{formatInterval(delays[r])}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Btn label="Show answer" onPress={() => setFlipped(true)} />
        )}
        <View style={{ flexDirection: 'row', gap: sp.sm }}>
          <View style={{ flex: 1 }}>
            <Btn label="Edit" kind="ghost" onPress={() => { setFront(card.front); setBack(card.back); setEditing(card); }} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn
              label="Dismiss"
              kind="danger"
              hint="Removes this card from reviews"
              onPress={() => {
                void act({ type: 'dismissCard', id: card.id });
                setFlipped(false);
                setPos((p) => p + 1);
              }}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: sp.md }}>
      <H>Review</H>
      {note ? <P>{note}</P> : null}
      {err ? <P>{err}</P> : null}
      {dueNow === 0 ? (
        <EmptyState
          title="No cards due"
          detail={live.length ? 'Come back later, or add more cards.' : 'Make flashcards from your notes to start.'}
          actionLabel="Generate cards for a topic"
          onAction={() => setGenOpen(true)}
        />
      ) : (
        <Box>
          <P>{`${dueNow} card(s) due`}</P>
          <Btn label="Start review" onPress={start} />
          <Btn label="Generate cards for a topic" kind="ghost" onPress={() => setGenOpen(true)} />
        </Box>
      )}
    </View>
  );
}
