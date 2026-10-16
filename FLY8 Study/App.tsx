import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StatusBar, View } from 'react-native';
import type { AppState } from './src/core/types';
import { loadState, saveState } from './src/storage';
import { Library } from './src/ui/Library';
import { Study } from './src/ui/Study';
import { Graph } from './src/ui/Graph';
import { Settings } from './src/ui/Settings';
import { Btn, H, P, c } from './src/ui/kit';

type Tab = 'study' | 'library' | 'map' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'study', label: 'Study' },
  { id: 'library', label: 'Library' },
  { id: 'map', label: 'Map' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>('study');

  useEffect(() => {
    void loadState().then(setState);
  }, []);

  const update = useCallback((next: AppState) => {
    setState(next);
    void saveState(next);
  }, []);

  if (!state) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  const needsKey = !state.settings.apiKey.trim();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48 }}>
      <StatusBar barStyle="light-content" />
      <View style={{ paddingHorizontal: 16, gap: 4 }}>
        <H>Nursing Study</H>
        {needsKey ? <P dim>Add your API key in Settings to unlock AI features.</P> : null}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {tab === 'study' && <Study state={state} update={update} />}
        {tab === 'library' && <Library state={state} update={update} />}
        {tab === 'map' && <Graph state={state} />}
        {tab === 'settings' && <Settings state={state} update={update} />}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.line }}>
        {TABS.map((t) => (
          <View key={t.id} style={{ flex: 1 }}>
            <Btn label={t.label} kind={tab === t.id ? 'primary' : 'ghost'} onPress={() => setTab(t.id)} />
          </View>
        ))}
      </View>
    </View>
  );
}

