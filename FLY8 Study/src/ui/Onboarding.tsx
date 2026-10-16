import React, { useState } from 'react';
import { View } from 'react-native';
import type { ProviderName, Settings } from '../core/types';
import { callModel, DEFAULT_MODELS, ProviderError } from '../ai/provider';
import { Btn, Card, EmptyState, Field, H, P, Pill, Screen, c, sp } from './kit';

/** Short explainer used in Settings and onboarding for manual mode. */
export function HowManualWorks() {
  return (
    <Card>
      <H>How it works</H>
      <P>1. The app writes a full prompt for you.</P>
      <P>2. Copy it into the ChatGPT or Claude app and send it.</P>
      <P>3. Copy the reply and paste it back here. The app does the rest.</P>
      <P dim>
        No key and no cost beyond your chat subscription. The prompt, including your notes, goes only where you paste it. AI replies can be
        wrong, so check them against a textbook. Long requests are split into parts to fit chat limits.
      </P>
    </Card>
  );
}

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
  includeManual,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  onRemove?: () => void;
  /** Settings shows Manual as a third choice; onboarding offers it on its own first screen. */
  includeManual?: boolean;
}) {
  const [result, setResult] = useState<KeyTestState>({ status: 'idle' });
  const pick = (provider: ProviderName) => {
    setResult({ status: 'idle' });
    onChange({ ...settings, provider, model: DEFAULT_MODELS[provider], aiChosen: true });
  };
  const hasKey = settings.apiKey.trim().length > 0;
  const run = async () => {
    setResult({ status: 'testing' });
    setResult(await testKey(settings));
  };
  const manual = settings.provider === 'manual';
  const selector = (
    <View style={{ gap: sp.sm }}>
      {includeManual ? (
        <Btn label="Manual (free)" kind={manual ? 'primary' : 'ghost'} onPress={() => pick('manual')} hint="Copy-paste with the ChatGPT or Claude app" />
      ) : null}
      <View style={{ flexDirection: 'row', gap: sp.sm }}>
        <View style={{ flex: 1 }}>
          <Btn label={includeManual ? 'Claude API' : 'Claude'} kind={settings.provider === 'anthropic' ? 'primary' : 'ghost'} onPress={() => pick('anthropic')} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label={includeManual ? 'ChatGPT API' : 'ChatGPT'} kind={settings.provider === 'openai' ? 'primary' : 'ghost'} onPress={() => pick('openai')} />
        </View>
      </View>
    </View>
  );
  if (manual) {
    return (
      <View style={{ gap: sp.md }}>
        {selector}
        <HowManualWorks />
      </View>
    );
  }
  return (
    <View style={{ gap: sp.md }}>
      {selector}
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

/** Full-screen first-launch setup, shown until the owner picks how to use AI. */
export function Onboarding({
  settings,
  onSave,
  onSkip,
}: {
  settings: Settings;
  onSave: (next: Settings) => void;
  onSkip: () => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const [draft, setDraft] = useState<Settings>(settings.provider === 'manual' ? { ...settings, provider: 'anthropic', model: DEFAULT_MODELS.anthropic } : settings);
  if (advanced) {
    return (
      <Screen>
        <EmptyState title="Use an API key" detail="Your own key stays on this phone and is never included in backups. API use is paid by usage, separately from chat subscriptions." />
        <Card>
          <H>Connect your AI</H>
          <KeySetup settings={draft} onChange={setDraft} />
          <Btn label="Save and continue" disabled={!draft.apiKey.trim()} onPress={() => onSave({ ...draft, aiChosen: true })} />
        </Card>
        <Btn label="Back" kind="ghost" onPress={() => setAdvanced(false)} />
      </Screen>
    );
  }
  return (
    <Screen>
      <EmptyState title="How do you want to use AI?" detail="Lessons, quizzes and the tutor need an AI. You can change this later in Settings." />
      <Card>
        <H>Free: copy-paste with the ChatGPT or Claude app (recommended)</H>
        <P dim>The app writes the prompt, you paste it into your chat app and paste the reply back. No key, no API bill.</P>
        <Btn
          label="Use copy-paste (free)"
          hint="Finishes setup with no key"
          onPress={() => onSave({ ...settings, provider: 'manual', model: DEFAULT_MODELS.manual, apiKey: '', aiChosen: true })}
        />
      </Card>
      <Card>
        <H>Advanced: use an API key (paid by usage)</H>
        <P dim>Answers arrive inside the app with no copying. Needs your own key, billed by the provider.</P>
        <Btn label="Set up an API key" kind="ghost" onPress={() => setAdvanced(true)} />
      </Card>
      <P dim>
        Either way: AI replies can be wrong, so check facts against a textbook. In copy-paste mode your notes go only where you paste the prompt.
      </P>
      <Btn label="Skip for now" kind="ghost" onPress={onSkip} hint="Copy-paste mode stays on; change it later in Settings" />
    </Screen>
  );
}
