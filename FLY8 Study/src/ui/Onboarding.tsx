import React, { useState } from 'react';
import { View } from 'react-native';
import type { ProviderName, Settings } from '../core/types';
import { callModel, DEFAULT_MODELS, ProviderError } from '../ai/provider';
import { Btn, Card, EmptyState, Field, H, P, Pill, Screen, c, sp } from './kit';

export type KeyTestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok' | 'bad-key' | 'rate-limit' | 'offline' | 'other'; message: string };

/** Fixed, key-free messages. The key is never part of any text shown here. */
export function describeKeyTestError(e: unknown): Exclude<KeyTestState, { status: 'idle' | 'testing' | 'ok' }> {
  const kind = e instanceof ProviderError ? e.kind : 'network';
  switch (kind) {
    case 'auth':
      return { status: 'bad-key', message: 'The provider rejected this key. Check you copied all of it and picked the right provider.' };
    case 'rate-limit':
      return { status: 'rate-limit', message: 'The key looks valid but you are rate limited right now. Wait a minute and test again.' };
    case 'network':
      return { status: 'offline', message: 'Could not reach the provider. Check your internet connection and try again.' };
    default:
      return { status: 'other', message: 'The provider answered with an error. Try again later.' };
  }
}

/** Sends one tiny request. Resolves to a message state; never throws, never echoes the key. */
export async function testKey(settings: Settings): Promise<KeyTestState> {
  try {
    await callModel(settings, { system: 'Reply with the single word OK.', user: 'ok' });
    return { status: 'ok', message: 'Key works. You are ready to study.' };
  } catch (e) {
    return describeKeyTestError(e);
  }
}

const STATUS_COLOR: Record<string, string> = {
  ok: c.good,
  'bad-key': c.bad,
  'rate-limit': c.warn,
  offline: c.warn,
  other: c.bad,
};

/** Provider choice + key field + "Test key". Used by onboarding and Settings. */
export function KeySetup({
  settings,
  onChange,
  onRemove,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  onRemove?: () => void;
}) {
  const [result, setResult] = useState<KeyTestState>({ status: 'idle' });
  const pick = (provider: ProviderName) => {
    setResult({ status: 'idle' });
    onChange({ ...settings, provider, model: DEFAULT_MODELS[provider] });
  };
  const hasKey = settings.apiKey.trim().length > 0;
  const run = async () => {
    setResult({ status: 'testing' });
    setResult(await testKey(settings));
  };
  return (
    <View style={{ gap: sp.md }}>
      <View style={{ flexDirection: 'row', gap: sp.sm }}>
        <View style={{ flex: 1 }}>
          <Btn label="Claude" kind={settings.provider === 'anthropic' ? 'primary' : 'ghost'} onPress={() => pick('anthropic')} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="ChatGPT" kind={settings.provider === 'openai' ? 'primary' : 'ghost'} onPress={() => pick('openai')} />
        </View>
      </View>
      <Field
        label="API key"
        value={settings.apiKey}
        onChangeText={(apiKey) => {
          setResult({ status: 'idle' });
          onChange({ ...settings, apiKey });
        }}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={settings.provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
      />
      <Field
        label="Model"
        value={settings.model}
        onChangeText={(model) => onChange({ ...settings, model })}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Btn
        label={result.status === 'testing' ? 'Testing...' : 'Test key'}
        kind="ghost"
        disabled={!hasKey || result.status === 'testing'}
        hint="Sends one tiny request to your provider"
        onPress={() => void run()}
      />
      {result.status !== 'idle' && result.status !== 'testing' ? (
        <View accessibilityLiveRegion="polite" style={{ gap: sp.xs }}>
          <Pill text={result.status === 'ok' ? 'Success' : 'Problem'} color={STATUS_COLOR[result.status]} />
          <P>{result.message}</P>
        </View>
      ) : null}
      {onRemove && hasKey ? <Btn label="Remove key from this phone" kind="danger" onPress={onRemove} /> : null}
    </View>
  );
}

/** Full-screen first-launch setup, shown while no key is saved. */
export function Onboarding({
  settings,
  onSave,
  onSkip,
}: {
  settings: Settings;
  onSave: (next: Settings) => void;
  onSkip: () => void;
}) {
  const [draft, setDraft] = useState<Settings>(settings);
  return (
    <Screen>
      <EmptyState title="Welcome to Nursing Study" detail="Add your own AI key to unlock lessons, quizzes and the tutor. It stays on this phone and is never included in backups." />
      <Card>
        <H>Connect your AI</H>
        <KeySetup settings={draft} onChange={setDraft} />
        <Btn label="Save and continue" disabled={!draft.apiKey.trim()} onPress={() => onSave(draft)} />
      </Card>
      <Btn label="Skip for now" kind="ghost" onPress={onSkip} hint="You can add a key later in Settings" />
    </Screen>
  );
}
