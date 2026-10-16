import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProviderName, Settings } from '../core/types';
import { callModel, DEFAULT_MODELS, ProviderError } from '../ai/provider';
import { Btn, Card, Chip, Field, H, Header, Illustration, P, PressableScale, Screen, TOP_INSET, sp } from './kit';
import type { IconName } from './kit';
import { radius, space, useTheme } from './theme';

/** Short explainer used in Settings and onboarding for manual mode. */
export function HowManualWorks() {
  const { colors, type } = useTheme();
  const steps = ['The app writes a full prompt for you.', 'Copy it into the ChatGPT or Claude app and send it.', 'Copy the reply and paste it back here. The app does the rest.'];
  return (
    <Card>
      <H>How it works</H>
      {steps.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
          <View style={{ width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[type('label', 'semibold'), { color: colors.accentText }]}>{i + 1}</Text>
          </View>
          <Text style={[type('body'), { color: colors.text, flex: 1 }]}>{t}</Text>
        </View>
      ))}
      <Text style={[type('caption'), { color: colors.textDim }]}>
        No key and no cost beyond your chat subscription. The prompt, including your notes, goes only where you paste it. AI replies can be
        wrong, so check them against a textbook. Long requests are split into parts to fit chat limits.
      </Text>
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

const STATUS_TONE = {
  ok: 'success',
  'bad-key': 'danger',
  'rate-limit': 'warning',
  offline: 'warning',
  other: 'danger',
} as const;

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
          <Chip
            text={result.status === 'ok' ? 'Success' : 'Problem'}
            tone={STATUS_TONE[result.status]}
            icon={result.status === 'ok' ? 'checkmark-circle' : 'alert-circle'}
          />
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
  const { colors, type } = useTheme();
  const [advanced, setAdvanced] = useState(false);
  const [draft, setDraft] = useState<Settings>(settings.provider === 'manual' ? { ...settings, provider: 'anthropic', model: DEFAULT_MODELS.anthropic } : settings);
  if (advanced) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header title="Use an API key" subtitle="Advanced" onBack={() => setAdvanced(false)} />
        <Screen>
          <Text style={[type('body'), { color: colors.textDim }]}>
            Your own key stays on this phone and is never included in backups. API use is billed by usage, separately from chat subscriptions.
          </Text>
          <Card>
            <H>Connect your AI</H>
            <KeySetup settings={draft} onChange={setDraft} />
            <Btn label="Save and continue" disabled={!draft.apiKey.trim()} onPress={() => onSave({ ...draft, aiChosen: true })} />
          </Card>
        </Screen>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <View style={{ height: TOP_INSET }} />
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Illustration kind="cards" />
          <Text accessibilityRole="header" style={[type('title'), { color: colors.text, textAlign: 'center' }]}>
            How do you want to use AI?
          </Text>
          <Text style={[type('body'), { color: colors.textDim, textAlign: 'center' }]}>
            Lessons, quizzes and the tutor need an AI. You can change this later in Settings.
          </Text>
        </View>
        <ChoiceCard
          icon="clipboard-outline"
          title="Copy and paste"
          badge="Free, recommended"
          body="The app writes the prompt. You paste it into your ChatGPT or Claude app, then paste the reply back. No key, no API bill."
          cta="Use copy and paste"
          hint="Finishes setup with no key"
          primary
          onPress={() => onSave({ ...settings, provider: 'manual', model: DEFAULT_MODELS.manual, apiKey: '', aiChosen: true })}
        />
        <ChoiceCard
          icon="key-outline"
          title="Use an API key"
          badge="Advanced, paid by usage"
          body="Answers arrive inside the app with no copying. Needs your own key, billed by the provider."
          cta="Set up an API key"
          onPress={() => setAdvanced(true)}
        />
        <Text style={[type('caption'), { color: colors.textDim, textAlign: 'center' }]}>
          Either way, AI replies can be wrong, so check facts against a textbook. In copy-paste mode your notes go only where you paste the prompt.
        </Text>
        <Btn label="Skip for now" kind="ghost" onPress={onSkip} hint="Copy-paste mode stays on; change it later in Settings" />
      </Screen>
    </View>
  );
}

/** One of the two big choices on the first screen. Whole card is tappable; the button repeats it for clarity. */
function ChoiceCard({
  icon,
  title,
  badge,
  body,
  cta,
  hint,
  primary,
  onPress,
}: {
  icon: IconName;
  title: string;
  badge: string;
  body: string;
  cta: string;
  hint?: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const { colors, type } = useTheme();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${title}. ${badge}. ${body}`} accessibilityHint={hint} onPress={onPress} scaleTo={0.985}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={24} color={colors.accentText} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type('headline'), { color: colors.text }]}>{title}</Text>
            <Chip text={badge} tone={primary ? 'success' : 'neutral'} />
          </View>
        </View>
        <Text style={[type('body'), { color: colors.textDim }]}>{body}</Text>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Btn label={cta} kind={primary ? 'primary' : 'ghost'} onPress={onPress} />
        </View>
      </Card>
    </PressableScale>
  );
}
