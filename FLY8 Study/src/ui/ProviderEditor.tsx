import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { ProviderName, Settings } from '../core/types';
import { callOne, DEFAULT_MODELS, ProviderError } from '../ai/provider';
import { fetchModels, LIMITS_NOTE, PROVIDER_INFO, SUGGESTED_MODELS, type ModelSuggestion } from '../ai/models';
import { FREELLMAPI_URL_PLACEHOLDER, HTTP_WARNING, isPlainHttp } from '../ai/transport';
import { Btn, ChoiceChips, Chip, Field, P, PressableScale } from './kit';
import { radius, space, useTheme } from './theme';

export type KeyTestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok' | 'bad-key' | 'rate-limit' | 'offline' | 'other'; message: string };

/** Fixed, key-free messages. The key is never part of any text shown here. */
export function describeKeyTestError(e: unknown): Exclude<KeyTestState, { status: 'idle' | 'testing' | 'ok' }> {
  const kind = e instanceof ProviderError ? e.kind : 'network';
  switch (kind) {
    case 'auth':
      return { status: 'bad-key', message: 'The provider rejected this key (or the address is missing). Check you copied all of it and picked the right provider.' };
    case 'rate-limit':
      return { status: 'rate-limit', message: 'The key looks valid but a rate or daily limit was reached. Wait a while, try another provider, or use manual mode.' };
    case 'network':
      return { status: 'offline', message: 'Could not reach the provider. Check your internet connection (and the address, for a custom endpoint) and try again.' };
    default:
      return { status: 'other', message: 'The provider answered with an error. Check the model name, or try again later.' };
  }
}

/** Sends one tiny request to exactly this provider (no pool). Never throws, never echoes the key. */
export async function testKey(settings: Settings, doFetch: typeof fetch = fetch): Promise<KeyTestState> {
  try {
    await callOne({ ...settings, pool: undefined }, { system: 'Reply with the single word OK.', user: 'ok' }, doFetch);
    return { status: 'ok', message: 'Key works. You are ready to study.' };
  } catch (e) {
    return describeKeyTestError(e);
  }
}

const STATUS_TONE = { ok: 'success', 'bad-key': 'danger', 'rate-limit': 'warning', offline: 'warning', other: 'danger' } as const;

export interface ProviderValue {
  provider: Exclude<ProviderName, 'manual'>;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

/** Provider cards + key + (custom address) + model with chips + Fetch models + Test key. Used for the main provider and pool entries. */
export function ProviderEditor({ value, onChange }: { value: ProviderValue; onChange: (next: ProviderValue) => void }) {
  const { colors, type } = useTheme();
  const [result, setResult] = useState<KeyTestState>({ status: 'idle' });
  const [fetched, setFetched] = useState<ModelSuggestion[] | null>(null);
  const [fetchMsg, setFetchMsg] = useState('');
  const info = PROVIDER_INFO.find((p) => p.name === value.provider) ?? PROVIDER_INFO[0];
  const custom = value.provider === 'custom';
  const hasKey = value.apiKey.trim().length > 0;
  const canTest = custom ? !!value.baseUrl?.trim() : hasKey;

  const pick = (provider: ProviderValue['provider']) => {
    setResult({ status: 'idle' });
    setFetched(null);
    setFetchMsg('');
    onChange({ provider, apiKey: provider === value.provider ? value.apiKey : '', model: DEFAULT_MODELS[provider], baseUrl: provider === 'custom' ? value.baseUrl : undefined });
  };
  const set = (patch: Partial<ProviderValue>) => {
    setResult({ status: 'idle' });
    onChange({ ...value, ...patch });
  };
  const run = async () => {
    setResult({ status: 'testing' });
    setResult(await testKey({ ...value, provider: value.provider }));
  };
  const fetchList = async () => {
    setFetchMsg('Fetching...');
    try {
      const list = await fetchModels(value);
      setFetched(list);
      setFetchMsg(list.length ? `${list.length} models found. Tap one to use it.` : 'The provider returned no matching models.');
    } catch (e) {
      setFetched(null);
      setFetchMsg(describeKeyTestError(e).message);
    }
  };
  const chips: string[] = (fetched ? fetched.map((m) => m.id) : value.provider === 'custom' ? [] : SUGGESTED_MODELS[value.provider]).slice(0, 12);

  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: space.sm }}>
        {PROVIDER_INFO.map((p) => {
          const on = p.name === value.provider;
          return (
            <PressableScale
              key={p.name}
              accessibilityRole="radio"
              accessibilityLabel={`${p.title}. ${p.blurb}`}
              accessibilityState={{ selected: on }}
              onPress={() => pick(p.name)}
              scaleTo={0.985}
            >
              <View
                style={{
                  borderRadius: radius.md,
                  borderWidth: 2,
                  borderColor: on ? colors.accent : colors.surfaceAlt,
                  backgroundColor: on ? colors.accentSoft : colors.surface,
                  padding: space.md,
                  gap: 2,
                }}
              >
                <Text style={[type('headline'), { color: colors.text }]}>{p.title}</Text>
                <Text style={[type('caption'), { color: colors.textDim }]}>{p.blurb}</Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
      <P dim>{info.keyHint} {LIMITS_NOTE}</P>
      {custom ? (
        <View style={{ gap: space.sm }}>
          <Field
            label="Base address"
            value={value.baseUrl ?? ''}
            onChangeText={(baseUrl) => set({ baseUrl })}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={FREELLMAPI_URL_PLACEHOLDER}
          />
          <Btn label="Preset: FreeLLMAPI" kind="ghost" hint="Fills model auto and an example address" onPress={() => set({ model: 'auto', baseUrl: value.baseUrl?.trim() ? value.baseUrl : FREELLMAPI_URL_PLACEHOLDER })} />
          <P dim>Works with any OpenAI-compatible server: FreeLLMAPI, Ollama, LM Studio.</P>
          {isPlainHttp(value.baseUrl) ? (
            <View accessibilityLiveRegion="polite" style={{ gap: space.xs }}>
              <Chip text="Not encrypted" tone="warning" icon="alert-circle" />
              <P>{HTTP_WARNING}</P>
            </View>
          ) : null}
        </View>
      ) : null}
      <Field
        label={custom ? 'API key (optional)' : 'API key'}
        value={value.apiKey}
        onChangeText={(apiKey) => set({ apiKey })}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={info.keyPlaceholder}
      />
      <Field label="Model" value={value.model} onChangeText={(model) => set({ model })} autoCapitalize="none" autoCorrect={false} />
      {chips.length ? <ChoiceChips label="Suggested models" options={chips} value={chips.includes(value.model) ? value.model : ''} onChange={(model) => set({ model })} /> : null}
      {!fetched ? <P dim>Suggestions may be out of date. Use Fetch available models for the current list.</P> : null}
      <Btn label="Fetch available models" kind="ghost" disabled={!canTest && !(value.provider === 'openrouter')} hint="Asks the provider for its model list" onPress={() => void fetchList()} />
      {fetchMsg ? <P dim>{fetchMsg}</P> : null}
      <Btn
        label={result.status === 'testing' ? 'Testing...' : 'Test key'}
        kind="ghost"
        disabled={!canTest || result.status === 'testing'}
        hint="Sends one tiny request to this provider"
        onPress={() => void run()}
      />
      {result.status !== 'idle' && result.status !== 'testing' ? (
        <View accessibilityLiveRegion="polite" style={{ gap: space.xs }}>
          <Chip text={result.status === 'ok' ? 'Success' : 'Problem'} tone={STATUS_TONE[result.status]} icon={result.status === 'ok' ? 'checkmark-circle' : 'alert-circle'} />
          <P>{result.message}</P>
        </View>
      ) : null}
    </View>
  );
}

