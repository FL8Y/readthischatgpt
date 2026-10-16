import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StatusBar, Text, View } from 'react-native';
import type { AppState } from './src/core/types';
import { loadState, saveState } from './src/storage';
import { Dashboard } from './src/ui/Dashboard';
import { Library } from './src/ui/Library';
import { Study } from './src/ui/Study';
import { Graph } from './src/ui/Graph';
import { Settings } from './src/ui/Settings';
import { Onboarding } from './src/ui/Onboarding';
import { H, P, Screen, TOUCH, c, sp } from './src/ui/kit';

type Tab = 'home' | 'study' | 'library' | 'map' | 'settings';
type Ctx = { state: AppState; update: (s: AppState) => void; go: (t: Tab) => void };

/** One entry per tab. To add or change a screen, edit only its `render`. */
const TABS: { id: Tab; label: string; icon: string; render: (x: Ctx) => React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: '⌂', render: (x) => <Dashboard state={x.state} go={x.go} /> },
  { id: 'study', label: 'Study', icon: '✎', render: (x) => <Study state={x.state} update={x.update} /> },
  { id: 'library', label: 'Library', icon: '▤', render: (x) => <Library state={x.state} update={x.update} /> },
  { id: 'map', label: 'Map', icon: '◎', render: (x) => <Graph state={x.state} /> },
  { id: 'settings', label: 'Settings', icon: '⚙', render: (x) => <Settings state={x.state} update={x.update} /> },
];

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    void loadState().then(setState);
  }, []);

  const update = useCallback((next: AppState) => {
    setState(next);
    void saveState(next);
  }, []);

  if (!state) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  if (!state.settings.apiKey.trim() && !skipped) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48 }}>
        <StatusBar barStyle="light-content" />
        <Onboarding
          settings={state.settings}
          onSave={(settings) => update({ ...state, settings })}
          onSkip={() => setSkipped(true)}
        />
      </View>
    );
  }

  const ctx: Ctx = { state, update, go: setTab };
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48 }}>
      <StatusBar barStyle="light-content" />
      <View style={{ paddingHorizontal: sp.lg, gap: sp.xs }}>
        <H>Nursing Study</H>
        {!state.settings.apiKey.trim() ? <P dim>Add your API key in Settings to unlock AI features.</P> : null}
      </View>
      <Screen>{active.render(ctx)}</Screen>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.card }}>
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="tab"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: on }}
              onPress={() => setTab(t.id)}
              style={{ flex: 1, minHeight: TOUCH + 8, alignItems: 'center', justifyContent: 'center', gap: 2 }}
            >
              <Text style={{ fontSize: 20, color: on ? c.accent : c.dim }}>{t.icon}</Text>
              <Text style={{ fontSize: 12, fontWeight: on ? '700' : '500', color: on ? c.text : c.dim }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
