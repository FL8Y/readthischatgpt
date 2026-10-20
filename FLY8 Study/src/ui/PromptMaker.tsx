import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import bundlesJson from '../../data/presets/bundles.json';
import type { AppState } from '../core/types';
import { accuracyBy } from '../bank/curate';
import type { Area, BankItem } from '../bank/schema';
import { composeManualPrompt } from '../ai/manual';
import { callModel, ProviderError } from '../ai/provider';
import { MAX_BATCH, SHAPES, clampCount, shapeDef, type ShapeId } from '../pnle/shapes';
import { buildUnifiedPrompt, type NoteInput } from '../pnle/unifiedPrompt';
import { parseBank, type ParseBankResult } from '../pnle/parseBank';
import { sessionFromPlan } from './practice/practiceFlow';
import { useBank } from './practice/BankProvider';
import { Btn, Card, Chip, Divider, Field, H, Header, PressableScale, Screen } from './kit';
import { radius, space, useTheme } from './theme';

type ScopeKind = 'bundle' | 'notes' | 'weak';
const SCOPES: { id: ScopeKind; label: string; blurb: string }[] = [
  { id: 'bundle', label: 'A subject', blurb: 'Pick a subject bundle' },
  { id: 'notes', label: 'My notes', blurb: 'Tick notes you installed' },
  { id: 'weak', label: 'My weak spots', blurb: 'From your practice results' },
];
const COUNTS = [3, 5, 10] as const;
const DIFFS: { id: number | 'mixed'; label: string }[] = [
  { id: 'mixed', label: 'Mixed' }, { id: 2, label: 'Easier' }, { id: 3, label: 'Medium' }, { id: 4, label: 'Hard' }, { id: 5, label: 'Hardest' },
];
const MAX_NOTES = 4;
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

function Pick({ on, label, detail, onPress }: { on: boolean; label: string; detail?: string; onPress: () => void }) {
  const { colors, type } = useTheme();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      scaleTo={0.99}
      style={{
        minHeight: 48, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 2,
        borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : 'transparent', justifyContent: 'center',
      }}
    >
      <Text style={[type('bodyStrong'), { color: on ? colors.accentText : colors.text }]}>{label}</Text>
      {detail ? <Text style={[type('caption'), { color: colors.textDim }]}>{detail}</Text> : null}
    </PressableScale>
  );
}

function Label({ children }: { children: string }) {
  const { colors, type } = useTheme();
  return <Text style={[type('label'), { color: colors.textDim }]}>{children}</Text>;
}

/** Prompt Maker: scope + shape -> prompt (copy, or run with the free AI) -> reply -> per-item preview -> save to the bank. */
export function PromptMaker({ state, go, onBack }: { state: AppState; go: (t: 'practice') => void; onBack?: () => void }) {
  const { colors, type } = useTheme();
  const bank = useBank();
  const [scope, setScope] = useState<ScopeKind>('bundle');
  const [bundleId, setBundleId] = useState<string>(bundlesJson.bundles[0]?.id ?? '');
  const [noteIds, setNoteIds] = useState<string[]>([]);
  const [shape, setShape] = useState<ShapeId>('single');
  const [count, setCount] = useState<number>(5);
  const [diff, setDiff] = useState<number | 'mixed'>('mixed');
  const [prompt, setPrompt] = useState('');
  const [reply, setReply] = useState('');
  const [result, setResult] = useState<ParseBankResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [saved, setSaved] = useState<string[]>([]);

  const bundle = bundlesJson.bundles.find((b) => b.id === bundleId);
  const weakness = useMemo(() => {
    const acc = accuracyBy(bank.attempts, (a) => a.topic);
    const strat = accuracyBy(bank.attempts, (a) => a.strategy);
    const low = (m: Map<string, { attempts: number; accuracy: number }>) =>
      [...m.entries()].filter(([, s]) => s.attempts >= 2 && s.accuracy < 0.7).sort((a, b) => a[1].accuracy - b[1].accuracy).slice(0, 4);
    return { topics: low(acc).map(([k]) => k), strategies: low(strat).map(([k]) => k) };
  }, [bank.attempts]);
  const weakLine = [
    weakness.topics.length ? `weak topics: ${weakness.topics.join(', ')}` : '',
    weakness.strategies.length ? `often misses the rule: ${weakness.strategies.join(', ')}` : '',
  ].filter(Boolean).join('; ');

  const noteInputs = (): { notes: NoteInput[]; topic: string; area?: Area } => {
    if (scope === 'notes') {
      const ts = state.topics.filter((t) => noteIds.includes(t.id));
      return { notes: ts.map((t) => ({ id: t.id, title: t.title, body: t.body })), topic: ts.map((t) => t.title).join('; ') };
    }
    if (scope === 'bundle' && bundle) {
      const have = state.topics.filter((t) => bundle.notes.includes(t.id)).slice(0, MAX_NOTES);
      return { notes: have.map((t) => ({ id: t.id, title: t.title, body: t.body })), topic: bundle.name, area: bundle.area as Area };
    }
    const names = weakness.topics.length ? weakness.topics : [];
    const ts = state.topics.filter((t) => names.includes(t.title)).slice(0, MAX_NOTES);
    return { notes: ts.map((t) => ({ id: t.id, title: t.title, body: t.body })), topic: names.join('; ') };
  };

  const scopeReady = scope === 'notes' ? noteIds.length > 0 : scope === 'weak' ? weakness.topics.length > 0 : !!bundle;
  const n = clampCount(shape, count);

  const request = () => {
    const s = noteInputs();
    return buildUnifiedPrompt({
      shape, count: n, area: s.area, topic: s.topic, notes: s.notes, difficulty: diff, weakness: weakLine,
      avoidStems: bank.items.filter((i) => s.topic && i.topic && s.topic.includes(i.topic)).slice(0, 12).map((i) => i.stem),
    });
  };

  const make = () => {
    setPrompt(composeManualPrompt(request(), { expect: 'json' }));
    setResult(null);
    setReply('');
    setSaved([]);
    setMsgText('');
  };

  const check = (text: string, source: 'user-ai' | 'user-paste') => {
    const s = noteInputs();
    const r = parseBank(text, { source, existing: bank.items, defaults: { area: s.area, topic: s.notes[0]?.title ?? s.topic, noteId: s.notes.length === 1 ? s.notes[0].id : undefined } });
    setResult(r);
    setMsgText(r.valid.length ? '' : 'No usable questions yet. See the notes below.');
  };

  const runAi = async () => {
    setBusy(true);
    setMsgText('');
    try {
      const text = await callModel(state.settings, request(), undefined, { purpose: `Prompt Maker: ${shapeDef(shape).label}`, expect: 'json' });
      setReply(text);
      check(text, state.settings.pool?.length ? 'user-ai' : 'user-paste');
    } catch (e) {
      setMsgText(e instanceof ProviderError && e.kind === 'cancelled' ? 'Cancelled.' : msg(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(prompt);
      setMsgText('Prompt copied. Paste it into ChatGPT or Claude, then paste the reply below.');
    } catch {
      setMsgText('Could not copy. Long-press the prompt text and choose Copy.');
    }
  };
  const paste = async () => {
    try {
      const t = await Clipboard.getStringAsync();
      if (!t.trim()) return setMsgText('The clipboard is empty.');
      setReply(t);
    } catch {
      setMsgText('Could not read the clipboard. Long-press the box and choose Paste.');
    }
  };

  const save = async () => {
    if (!result?.valid.length) return;
    await bank.dispatch({ type: 'userItems/add', items: result.valid });
    setSaved(result.valid.map((i) => i.id));
    setMsgText(`Saved ${result.valid.length} question(s) to your bank. They work offline.`);
  };

  const practiceNow = async (ids: string[]) => {
    const now = Date.now();
    await bank.dispatch({ type: 'session/start', session: sessionFromPlan({ mode: 'custom', ids, requested: ids.length, short: false, revealMode: 'now' }, `custom-${now}`, now) });
    go('practice');
  };

  const preview = (i: BankItem) => `${i.type.toUpperCase()}${i.format ? ` (${i.format})` : ''} - ${i.stem.slice(0, 80)}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Prompt Maker" subtitle="Make your own practice questions" onBack={onBack} />
      <Screen>
        <Card>
          <H>1. What to cover</H>
          <View style={{ gap: space.sm }}>
            {SCOPES.map((s) => <Pick key={s.id} on={scope === s.id} label={s.label} detail={s.blurb} onPress={() => setScope(s.id)} />)}
          </View>
          {scope === 'bundle' ? (
            <View style={{ gap: space.sm }}>
              {bundlesJson.bundles.map((b) => (
                <Pick key={b.id} on={bundleId === b.id} label={b.name} detail={`${b.area} - ${state.topics.filter((t) => b.notes.includes(t.id)).length} of your notes installed`} onPress={() => setBundleId(b.id)} />
              ))}
            </View>
          ) : null}
          {scope === 'notes' ? (
            state.topics.length ? (
              <View style={{ gap: space.sm }}>
                <Text style={[type('caption'), { color: colors.textDim }]}>Tick up to {MAX_NOTES} notes.</Text>
                {state.topics.slice(0, 60).map((t) => {
                  const on = noteIds.includes(t.id);
                  return (
                    <Pick key={t.id} on={on} label={t.title} onPress={() => setNoteIds(on ? noteIds.filter((x) => x !== t.id) : noteIds.length < MAX_NOTES ? [...noteIds, t.id] : noteIds)} />
                  );
                })}
              </View>
            ) : <Text style={[type('body'), { color: colors.textDim }]}>No notes yet. Add some in More &gt; Library.</Text>
          ) : null}
          {scope === 'weak' ? (
            <Text style={[type('body'), { color: colors.textDim }]}>
              {weakness.topics.length ? `Weak topics: ${weakness.topics.join(', ')}.` : 'Answer a few practice questions first so the app can see your weak spots.'}
            </Text>
          ) : null}
        </Card>

        <Card>
          <H>2. What kind</H>
          <View style={{ gap: space.sm }}>
            {SHAPES.map((s) => <Pick key={s.id} on={shape === s.id} label={s.label} detail={s.blurb} onPress={() => setShape(s.id)} />)}
          </View>
          <Label>How many (max 10 at a time)</Label>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {COUNTS.filter((c) => c <= MAX_BATCH).map((c) => <Pick key={c} on={n === clampCount(shape, c)} label={String(clampCount(shape, c))} onPress={() => setCount(c)} />)}
          </View>
          <Label>Difficulty</Label>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {DIFFS.map((d) => <Pick key={String(d.id)} on={diff === d.id} label={d.label} onPress={() => setDiff(d.id)} />)}
          </View>
          <Btn label="Make the prompt" onPress={make} disabled={!scopeReady} />
        </Card>

        {prompt ? (
          <Card>
            <H>3. Send it to an AI</H>
            <Text selectable numberOfLines={8} style={[type('caption'), { color: colors.textDim }]}>{prompt}</Text>
            <Btn label="Copy prompt" onPress={() => void copy()} />
            <Btn label={busy ? 'Waiting for the AI...' : 'Run with my free AI'} kind="ghost" disabled={busy} onPress={() => void runAi()} hint="Uses your free keys, or opens copy and paste" />
            <Divider />
            <Field label="Paste the AI's reply here" value={reply} onChangeText={setReply} multiline placeholder="The JSON the AI gave you" />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}><Btn label="Paste" kind="ghost" onPress={() => void paste()} /></View>
              <View style={{ flex: 1 }}><Btn label="Check reply" onPress={() => check(reply, 'user-paste')} disabled={!reply.trim()} /></View>
            </View>
          </Card>
        ) : null}

        {msgText ? <Text accessibilityLiveRegion="polite" style={[type('body'), { color: colors.text }]}>{msgText}</Text> : null}

        {result ? (
          <Card>
            <H>4. Check the questions</H>
            {result.notes.map((t) => <Text key={t} style={[type('caption'), { color: colors.warning }]}>{t}</Text>)}
            {result.valid.map((i, k) => (
              <View key={i.id} style={{ gap: 2 }}>
                <Chip text={`OK - ${i.area}, level ${i.difficulty}`} tone="success" />
                <Text style={[type('body'), { color: colors.text }]}>{preview(i)}</Text>
                {result.warnings[k]?.length ? <Text style={[type('caption'), { color: colors.textDim }]}>{result.warnings[k].join('; ')}</Text> : null}
              </View>
            ))}
            {result.rejected.map((r) => (
              <View key={r.index} style={{ gap: 2 }}>
                <Chip text="Not saved" tone="danger" />
                <Text style={[type('body'), { color: colors.text }]}>{r.title}</Text>
                {r.errors.map((e) => <Text key={e} style={[type('caption'), { color: colors.danger }]}>{e}</Text>)}
              </View>
            ))}
            <Text style={[type('caption'), { color: colors.textDim }]}>AI-written and not nurse-reviewed. Check facts against your textbook.</Text>
            {saved.length ? (
              <Btn label="Practice them now" onPress={() => void practiceNow(saved)} />
            ) : (
              <Btn label={`Save ${result.valid.length} valid question(s) to my bank`} onPress={() => void save()} disabled={!result.valid.length} />
            )}
          </Card>
        ) : null}
      </Screen>
    </View>
  );
}
