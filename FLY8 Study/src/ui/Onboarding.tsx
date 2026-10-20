import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Settings } from '../core/types';
import { DEFAULT_MODELS } from '../ai/provider';
import { ProviderEditor } from './ProviderEditor';
import { FreeAiGuide } from './FreeAiGuide';
import { QuickSetup } from './QuickSetup';
import { Btn, Card, Chip, H, Header, Illustration, PressableScale, Screen, TOP_INSET } from './kit';
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

export { describeKeyTestError, testKey, type KeyTestState } from './ProviderEditor';

/** Provider choice (Manual or an API provider) + the provider fields. Used by onboarding and Settings. */
export function KeySetup({
  settings,
  onChange,
  onRemove,
  includeManual,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  onRemove?: () => void;
  /** Settings shows Manual as a choice; onboarding offers it on its own first screen. */
  includeManual?: boolean;
}) {
  const manual = settings.provider === 'manual';
  const hasKey = settings.apiKey.trim().length > 0;
  return (
    <View style={{ gap: space.md }}>
      {includeManual ? (
        <Btn
          label="Manual (free)"
          kind={manual ? 'primary' : 'ghost'}
          onPress={() => onChange({ ...settings, provider: 'manual', model: DEFAULT_MODELS.manual, apiKey: '', baseUrl: undefined, aiChosen: true })}
          hint="Copy-paste with the ChatGPT or Claude app"
        />
      ) : null}
      {manual ? (
        <HowManualWorks />
      ) : (
        <>
          <ProviderEditor
            value={{
              provider: settings.provider === 'manual' ? 'gemini' : settings.provider,
              apiKey: settings.apiKey,
              model: settings.model,
              baseUrl: settings.baseUrl,
            }}
            onChange={(v) => onChange({ ...settings, ...v, aiChosen: true })}
          />
          {onRemove && hasKey ? <Btn label="Remove key from this phone" kind="danger" onPress={onRemove} /> : null}
        </>
      )}
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
  const [guide, setGuide] = useState(false);
  const [quickSaved, setQuickSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings>(settings.provider === 'manual' ? { ...settings, provider: 'gemini', model: DEFAULT_MODELS.gemini } : settings);
  if (guide) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header title="How to get free AI" onBack={() => setGuide(false)} />
        <Screen>
          <FreeAiGuide />
        </Screen>
      </View>
    );
  }
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
            <Btn label="How to get free AI" kind="ghost" onPress={() => setGuide(true)} />
            <Btn label="Save and continue" disabled={draft.provider === 'custom' ? !draft.baseUrl?.trim() : !draft.apiKey.trim()} onPress={() => onSave({ ...draft, aiChosen: true })} />
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
        <QuickSetup settings={settings} onSave={setQuickSaved} />
        {quickSaved ? <Btn label="Continue" onPress={() => onSave(quickSaved)} hint="Finishes setup with your connected keys" /> : null}
        <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>
          Other options
        </Text>
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
          badge="Advanced, some free options"
          body="Answers arrive inside the app with no copying. Needs a key: Gemini, Groq and OpenRouter have free tiers (limits change), Claude and ChatGPT are paid by usage."
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
