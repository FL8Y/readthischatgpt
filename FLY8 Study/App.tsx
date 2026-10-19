import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import type { AppState } from './src/core/types';
import { loadState, saveState } from './src/storage';
import { Dashboard } from './src/ui/Dashboard';
import { Library } from './src/ui/Library';
import { StudyHub } from './src/ui/StudyHub';
import { Graph } from './src/ui/Graph';
import { Topics } from './src/ui/Topics';
import { Settings } from './src/ui/Settings';
import { Onboarding } from './src/ui/Onboarding';
import { ManualHost } from './src/ui/ManualHost';
import { Tutor } from './src/ui/Tutor';
import { More, type MoreId } from './src/ui/More';
import { DemoHarness } from './src/ui/DemoHarness';
import { Header, ImmersiveCtx, Screen, TabBar, type TabItem } from './src/ui/kit';
import { ThemeProvider, useTheme } from './src/ui/theme';

/** Every id the app has ever used keeps working with go(). library/map/tutor/settings live under More. */
type Tab = 'home' | 'study' | 'topics' | 'library' | 'map' | 'tutor' | 'settings' | 'more';
type Ctx = { state: AppState; update: (s: AppState) => void; go: (t: Tab) => void };

const BAR: (TabItem & { id: 'home' | 'study' | 'topics' | 'more' })[] = [
  { id: 'home', label: 'Home', icon: 'home-outline', iconOn: 'home' },
  { id: 'study', label: 'Study', icon: 'school-outline', iconOn: 'school' },
  { id: 'topics', label: 'Learn', icon: 'book-outline', iconOn: 'book' },
  { id: 'more', label: 'More', icon: 'ellipsis-horizontal-circle-outline', iconOn: 'ellipsis-horizontal-circle' },
];

/** Screens that draw their own header and scrolling. Everything else gets the shell header + Screen. */
const SELF_DRAWN: Tab[] = ['home', 'study', 'more'];

/** One entry per screen. To add or change a screen, edit only its `render`. */
const SCREENS: Record<Exclude<Tab, 'more'>, { title: string; render: (x: Ctx) => React.ReactNode }> = {
  home: { title: 'Home', render: (x) => <Dashboard state={x.state} go={x.go} /> },
  study: { title: 'Study', render: (x) => <StudyHub state={x.state} update={x.update} /> },
  topics: { title: 'Learn', render: (x) => <Topics state={x.state} /> },
  library: { title: 'Library', render: (x) => <Library state={x.state} update={x.update} /> },
  map: { title: 'Mind map', render: (x) => <Graph state={x.state} /> },
  tutor: { title: 'Tutor', render: (x) => <Tutor state={x.state} /> },
  settings: { title: 'Settings', render: (x) => <Settings state={x.state} update={x.update} /> },
};

const isMoreChild = (t: Tab): t is MoreId => t === 'library' || t === 'map' || t === 'tutor' || t === 'settings';

export default function App() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  return (
    <ThemeProvider fontsLoaded={loaded}>
      <Root />
    </ThemeProvider>
  );
}

function Root() {
  const { colors, scheme } = useTheme();
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [skipped, setSkipped] = useState(false);
  const [immersive, setImmersive] = useState(false);

  useEffect(() => {
    void loadState().then(setState);
  }, []);

  const update = useCallback((next: AppState) => {
    setState(next);
    void saveState(next);
  }, []);

  // Android back: leave a More sub-screen before leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isMoreChild(tab)) {
        setTab('more');
        return true;
      }
      if (tab !== 'home' && !immersive) {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab, immersive]);

  const bar = <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
  if (!state) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        {bar}
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
      </View>
    );
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash.startsWith('#demo=')) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {bar}
        <DemoHarness state={state} update={update} kind={window.location.hash.slice(6)} />
      </View>
    );
  }

  if (!state.settings.aiChosen && !state.settings.apiKey.trim() && !skipped) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {bar}
        <Onboarding settings={state.settings} onSave={(settings) => update({ ...state, settings })} onSkip={() => setSkipped(true)} />
      </View>
    );
  }

  const ctx: Ctx = { state, update, go: setTab };
  const barId = isMoreChild(tab) ? 'more' : tab;
  const needsKey = state.settings.provider !== 'manual' && !state.settings.apiKey.trim();

  let body: React.ReactNode;
  if (tab === 'more') {
    body = <More open={setTab} />;
  } else if (SELF_DRAWN.includes(tab)) {
    body = SCREENS[tab].render(ctx);
  } else {
    body = (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header title={SCREENS[tab].title} onBack={isMoreChild(tab) ? () => setTab('more') : undefined} />
        <Screen>
          {needsKey ? (
            <KeyNotice />
          ) : null}
          {SCREENS[tab].render(ctx)}
        </Screen>
      </View>
    );
  }

  return (
    <ImmersiveCtx.Provider value={setImmersive}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {bar}
        <View style={{ flex: 1 }}>{body}</View>
        {immersive ? null : <TabBar tabs={BAR} active={barId} onChange={(id) => setTab(id as Tab)} />}
        <ManualHost />
      </View>
    </ImmersiveCtx.Provider>
  );
}

function KeyNotice() {
  const { colors, type } = useTheme();
  return (
    <View style={{ backgroundColor: colors.warningSoft, borderRadius: 12, padding: 12 }}>
      <Text style={[type('label'), { color: colors.warning }]}>Add your API key in More &gt; Settings to unlock AI features.</Text>
    </View>
  );
}
