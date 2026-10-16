import React from 'react';
import { Share, View } from 'react-native';
import type { AppState, ProviderName } from '../core/types';
import { DEFAULT_MODELS } from '../ai/provider';
import { exportJson } from '../storage';
import { Btn, Card, Field, H, P } from './kit';

export function Settings({ state, update }: { state: AppState; update: (s: AppState) => void }) {
  const set = state.settings;
  const patch = (p: Partial<typeof set>) => update({ ...state, settings: { ...set, ...p } });
  const pick = (provider: ProviderName) => patch({ provider, model: DEFAULT_MODELS[provider] });
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <H>AI provider</H>
        <P dim>Paste your own key. It stays on this phone and is left out of exports.</P>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn label="Claude" kind={set.provider === 'anthropic' ? 'primary' : 'ghost'} onPress={() => pick('anthropic')} />
          <Btn label="ChatGPT" kind={set.provider === 'openai' ? 'primary' : 'ghost'} onPress={() => pick('openai')} />
        </View>
        <Field
          label="API key"
          value={set.apiKey}
          onChangeText={(apiKey) => patch({ apiKey })}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={set.provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
        />
        <Field label="Model" value={set.model} onChangeText={(model) => patch({ model })} autoCapitalize="none" />
      </Card>
      <Card>
        <H>Backup</H>
        <Btn label="Export my data (no key)" kind="ghost" onPress={() => void Share.share({ message: exportJson(state) })} />
      </Card>
    </View>
  );
}
