import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Settings } from '../core/types';
import { buildPoolSettings, detectKeys, QUICK_ORDER, QUICK_TITLES, quickSetup, type QuickProvider, type QuickResult, type QuickStatus } from '../ai/quickSetup';
import { Btn, Card, Chip, Field, H, P } from './kit';
import { space } from './theme';

const WHERE: Record<QuickProvider, { text: string; url: string; placeholder: string }> = {
  gemini: { text: 'Where do I get this key? aistudio.google.com, tap "Get API key".', url: 'https://aistudio.google.com/apikey', placeholder: 'AIza...' },
  groq: { text: 'Where do I get this key? console.groq.com, then "API Keys".', url: 'https://console.groq.com/keys', placeholder: 'gsk_...' },
  openrouter: { text: 'Where do I get this key? openrouter.ai, then "Keys".', url: 'https://openrouter.ai/keys', placeholder: 'sk-or-...' },
};

const WORD: Record<QuickStatus, string> = { ok: 'OK', 'bad-key': 'Bad key', 'rate-limit': 'Limit reached', offline: 'No network', other: 'Error' };

type Keys = Partial<Record<QuickProvider, string>>;

/** "Quick setup: paste your 3 free keys". Saves a provider pool when at least one key works. */
export function QuickSetup({ settings, onSave, onDone }: { settings: Settings; onSave: (next: Settings) => void; onDone?: () => void }) {
  const [blob, setBlob] = useState('');
  const [keys, setKeys] = useState<Keys>({});
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Partial<Record<QuickProvider, QuickResult>> | null>(null);
  const [saved, setSaved] = useState(false);

  const detected = detectKeys(blob);
  const onBlob = (t: string) => {
    setBlob(t);
    setResults(null);
    setSaved(false);
    const d = detectKeys(t);
    setKeys((k) => ({ ...k, ...(d.gemini ? { gemini: d.gemini } : {}), ...(d.groq ? { groq: d.groq } : {}), ...(d.openrouter ? { openrouter: d.openrouter } : {}) }));
  };
  const setOne = (p: QuickProvider, v: string) => {
    setResults(null);
    setSaved(false);
    setKeys((k) => ({ ...k, [p]: v.trim() }));
  };
  const paste = async () => {
    try {
      const t = await Clipboard.getStringAsync();
      if (t) onBlob(blob ? `${blob}\n${t}` : t);
    } catch {
      /* clipboard unavailable: the user can paste by hand */
    }
  };
  const count = QUICK_ORDER.filter((p) => keys[p]).length;
  const run = async () => {
    setBusy(true);
    setSaved(false);
    const r = await quickSetup({ keys });
    setResults(r);
    setBusy(false);
    if (QUICK_ORDER.some((p) => r[p]?.ok || (r[p]?.status === 'rate-limit' && r[p]?.model))) {
      onSave(buildPoolSettings(r, keys, settings));
      setSaved(true);
      onDone?.();
    }
  };
  const mark = (p: QuickProvider) => (detected[p] || keys[p] ? `${QUICK_TITLES[p]} ✓` : `${QUICK_TITLES[p]} —`);
  const worked = results ? QUICK_ORDER.filter((p) => results[p]?.ok || (results[p]?.status === 'rate-limit' && results[p]?.model)) : [];

  return (
    <Card>
      <H>Quick setup: paste your free keys</H>
      <P dim>Paste all your keys in one box, in any order. One working key is enough; the others are optional. Keys stay on this phone and are left out of exports.</P>
      <Field
        label="Paste all your keys here, one per line, any order"
        value={blob}
        onChangeText={onBlob}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        style={{ minHeight: 96, textAlignVertical: 'top' }}
      />
      <Btn label="Paste from clipboard" kind="ghost" onPress={() => void paste()} />
      <View accessibilityLiveRegion="polite">
        <P>Detected: {QUICK_ORDER.map(mark).join('  ')}</P>
        {detected.unknown.length ? <P dim>{detected.unknown.length} other piece(s) look like keys but were ignored (cut off, or from another service).</P> : null}
      </View>
      {QUICK_ORDER.map((p) => (
        <View key={p} style={{ gap: space.xs }}>
          <Field
            label={QUICK_TITLES[p]}
            value={keys[p] ?? ''}
            onChangeText={(v) => setOne(p, v)}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={WHERE[p].placeholder}
          />
          <P dim>{WHERE[p].text}</P>
          <Btn label={`Open ${QUICK_TITLES[p]} page`} kind="ghost" onPress={() => void Linking.openURL(WHERE[p].url)} />
        </View>
      ))}
      <Btn label={busy ? 'Testing...' : 'Connect and test'} disabled={busy || count === 0} onPress={() => void run()} hint="Tests each key with one tiny request" />
      {results ? (
        <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
          {QUICK_ORDER.filter((p) => results[p]).map((p) => {
            const r = results[p] as QuickResult;
            return (
              <View key={p} style={{ gap: 2 }}>
                <Chip text={`${QUICK_TITLES[p]}: ${WORD[r.status]}`} tone={r.ok ? 'success' : r.status === 'rate-limit' || r.status === 'offline' ? 'warning' : 'danger'} icon={r.ok ? 'checkmark-circle' : 'alert-circle'} />
                <P dim>{r.ok ? `Using ${r.model}.` : r.message}</P>
              </View>
            );
          })}
          {saved ? (
            <P>
              Saved. Your app will try {worked.map((p) => QUICK_TITLES[p]).join(', then ')} first, and skips any that hit a limit. If all of them are busy it shows the copy-paste screen.
            </P>
          ) : (
            <P>Nothing was saved. Fix the keys marked above and tap Connect and test again, or keep using copy and paste.</P>
          )}
        </View>
      ) : null}
    </Card>
  );
}
