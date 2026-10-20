import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { AppState } from '../core/types';
import { accuracyBy } from '../bank/curate';
import type { BankItem } from '../bank/schema';
import { importBank, type ImportResult } from '../bank/importBank';
import { callModel, ProviderError } from '../ai/provider';
import { DEFAULT_MIX, planBatches, totalQuestions, type StyleMix } from '../pnle/generator';
import { resolvePicks } from '../pnle/generatorPicks';
import { sessionFromPlan } from './practice/practiceFlow';
import { useBank } from './practice/BankProvider';
import { BankFileCard } from './BankFileCard';
import { Label, Pick, StyleMixEditor } from './GeneratorControls';
import { TopicTreePicker } from './TopicTreePicker';
import { Btn, Card, Chip, Divider, Field, H, Header, Screen } from './kit';
import { space, useTheme } from './theme';

const PER_TOPIC = [1, 2, 3, 5] as const;
const DIFFS: { id: number | 'mixed'; label: string }[] = [
  { id: 'mixed', label: 'Mixed' }, { id: 2, label: 'Easier' }, { id: 3, label: 'Medium' }, { id: 4, label: 'Hard' }, { id: 5, label: 'Hardest' },
];
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

/** Prompt Maker: tick topics + style mix -> app-aware prompt batches (copy, or run with the free AI) -> reply -> preview -> save. */
export function PromptMaker({ state, go, onBack }: { state: AppState; go: (t: 'practice') => void; onBack?: () => void }) {
  const { colors, type } = useTheme();
  const bank = useBank();
  const [picked, setPicked] = useState<string[]>([]);
  const [perTopic, setPerTopic] = useState<number>(3);
  const [mix, setMix] = useState<StyleMix>({ ...DEFAULT_MIX });
  const [diff, setDiff] = useState<number | 'mixed'>('mixed');
  const [batchNo, setBatchNo] = useState(0);
  const [reply, setReply] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [collected, setCollected] = useState<BankItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [saved, setSaved] = useState<string[]>([]);

  const weakness = useMemo(() => {
    const low = (m: Map<string, { attempts: number; accuracy: number }>) =>
      [...m.entries()].filter(([, s]) => s.attempts >= 2 && s.accuracy < 0.7).sort((a, b) => a[1].accuracy - b[1].accuracy).slice(0, 4);
    return {
      topics: low(accuracyBy(bank.attempts, (a) => a.topic)).map(([k]) => k),
      strategies: low(accuracyBy(bank.attempts, (a) => a.strategy)).map(([k]) => k),
    };
  }, [bank.attempts]);
  const weakLine = [
    weakness.topics.length ? `weak topics: ${weakness.topics.join(', ')}` : '',
    weakness.strategies.length ? `often misses the rule: ${weakness.strategies.join(', ')}` : '',
  ].filter(Boolean).join('; ');

  const bankTopics = useMemo(() => new Set(bank.items.map((i) => i.topic)), [bank.items]);
  const extraTopics = useMemo(() => state.topics.map((t) => t.title).filter((t) => !bankTopics.has(t)).slice(0, 80), [state.topics, bankTopics]);

  const batches = useMemo(() => {
    if (!picked.length) return [];
    const topics = resolvePicks(picked, perTopic, bank.items, state.topics.map((t) => ({ id: t.id, title: t.title, body: t.body })));
    return planBatches({ topics, mix, difficulty: diff, weakness: weakLine, existing: bank.items });
  }, [picked, perTopic, mix, diff, weakLine, bank.items, state.topics]);
  const cur = batches[Math.min(batchNo, batches.length - 1)];
  const total = totalQuestions(picked.map((name) => ({ name, count: perTopic })));

  const reset = () => { setResult(null); setReply(''); setMsgText(''); };
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setBatchNo(0); reset(); };

  const take = (r: ImportResult) => {
    setResult(r);
    const seen = new Set(collected.map((i) => i.id));
    const fresh = r.valid.filter((i) => !seen.has(i.id));
    setCollected([...collected, ...fresh]);
    setSaved([]);
    setMsgText(r.valid.length ? '' : 'No usable questions yet. See the notes below.');
  };
  const check = (text: string) => {
    const first = cur ? picked[0] : undefined;
    take(importBank(text, { existing: [...bank.items, ...collected], defaults: { topic: first } }));
  };

  const runAi = async () => {
    if (!cur) return;
    setBusy(true);
    setMsgText('');
    try {
      const text = await callModel(state.settings, cur.request, undefined, { purpose: `Prompt Maker: batch ${cur.index + 1} of ${cur.total}`, expect: 'json' });
      setReply(text);
      check(text);
    } catch (e) {
      setMsgText(e instanceof ProviderError && e.kind === 'cancelled' ? 'Cancelled.' : msg(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!cur) return;
    try {
      await Clipboard.setStringAsync(cur.text);
      setMsgText(`Prompt copied${cur.total > 1 ? ` (batch ${cur.index + 1} of ${cur.total})` : ''}. Paste it into ChatGPT or Claude, then paste the reply below.`);
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
    if (!collected.length) return;
    await bank.dispatch({ type: 'userItems/add', items: collected });
    setSaved(collected.map((i) => i.id));
    setMsgText(`Saved ${collected.length} question(s) to your bank. They work offline.`);
  };
  const practiceNow = async (ids: string[]) => {
    const now = Date.now();
    await bank.dispatch({ type: 'session/start', session: sessionFromPlan({ mode: 'custom', ids, requested: ids.length, short: false, revealMode: 'now' }, `custom-${now}`, now) });
    go('practice');
  };
  const preview = (i: BankItem) => `${i.type.toUpperCase()}${i.format ? ` (${i.format})` : ''}${i.flags?.includes('curveball') ? ' curve-ball' : ''} - ${i.stem.slice(0, 80)}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Prompt Maker" subtitle="Make your own practice questions" onBack={onBack} />
      <Screen>
        <Card>
          <H>1. Pick topics</H>
          <Text style={[type('caption'), { color: colors.textDim }]}>Tick areas, groups or single topics. {picked.length ? `${picked.length} topic(s) ticked.` : 'Nothing ticked yet.'}</Text>
          {weakness.topics.length ? <Btn label="Tick my weak spots" kind="ghost" onPress={() => change(setPicked)([...new Set([...picked, ...weakness.topics])])} /> : null}
          {picked.length ? <Btn label="Clear ticks" kind="ghost" onPress={() => change(setPicked)([])} /> : null}
          <TopicTreePicker items={bank.items} selected={picked} onChange={change(setPicked)} extraTopics={extraTopics} />
        </Card>

        <Card>
          <H>2. What kind</H>
          <Label>Questions per topic</Label>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {PER_TOPIC.map((c) => <Pick key={c} on={perTopic === c} label={String(c)} onPress={() => change(setPerTopic)(c)} />)}
          </View>
          <Label>Question styles (share of the set)</Label>
          <StyleMixEditor mix={mix} onChange={change(setMix)} />
          <Label>Difficulty</Label>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {DIFFS.map((d) => <Pick key={String(d.id)} on={diff === d.id} label={d.label} onPress={() => change(setDiff)(d.id)} />)}
          </View>
        </Card>

        {cur ? (
          <Card>
            <H>3. Send it to an AI</H>
            <Text accessibilityLiveRegion="polite" style={[type('bodyStrong'), { color: colors.text }]}>
              {`${total} questions in ${batches.length} ${batches.length === 1 ? 'prompt' : 'prompts'}. This prompt: about ${cur.words} words.`}
            </Text>
            {batches.length > 1 ? (
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                {batches.map((b) => <Pick key={b.index} on={cur.index === b.index} label={`Batch ${b.index + 1} of ${b.total}`} detail={`${b.count} questions`} onPress={() => { setBatchNo(b.index); setReply(''); }} />)}
              </View>
            ) : null}
            <Text style={[type('caption'), { color: colors.textDim }]}>Topics: {cur.topics.join(', ')}</Text>
            <Text selectable numberOfLines={6} style={[type('caption'), { color: colors.textDim }]}>{cur.text}</Text>
            <Btn label="Copy prompt" onPress={() => void copy()} />
            <Btn label={busy ? 'Waiting for the AI...' : 'Run with my free AI'} kind="ghost" disabled={busy} onPress={() => void runAi()} hint="Uses your free keys, or opens copy and paste" />
            <Divider />
            <Field label="Paste the AI's reply here" value={reply} onChangeText={setReply} multiline placeholder="The JSON the AI gave you" />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}><Btn label="Paste" kind="ghost" onPress={() => void paste()} /></View>
              <View style={{ flex: 1 }}><Btn label="Check reply" onPress={() => check(reply)} disabled={!reply.trim()} /></View>
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
              <View key={`${r.index}-${r.title}`} style={{ gap: 2 }}>
                <Chip text="Not saved" tone="danger" />
                <Text style={[type('body'), { color: colors.text }]}>{r.title}</Text>
                {r.errors.map((e) => <Text key={e} style={[type('caption'), { color: colors.danger }]}>{e}</Text>)}
              </View>
            ))}
            <Text style={[type('caption'), { color: colors.textDim }]}>AI-written and not nurse-reviewed. Check facts against your textbook.</Text>
          </Card>
        ) : null}

        {collected.length ? (
          <Card>
            <H>Ready to save</H>
            <Text style={[type('body'), { color: colors.text }]}>{collected.length} valid question(s) collected from this session.</Text>
            {saved.length ? <Btn label="Practice them now" onPress={() => void practiceNow(saved)} /> : <Btn label={`Save ${collected.length} valid question(s) to my bank`} onPress={() => void save()} />}
          </Card>
        ) : null}

        <BankFileCard all={bank.items} mine={bank.state.userItems} topics={picked} generated={collected} onImported={take} />
      </Screen>
    </View>
  );
}
