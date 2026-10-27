import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import type { AppState } from './src/core/types';
import { loadState, saveState } from './src/storage';
import { Dashboard } from './src/ui/Dashboard';
import { Library } from './src/ui/Library';
import { PracticeScreen } from './src/ui/practice/PracticeScreen';
import { BankProvider } from './src/ui/practice/BankProvider';
import { NoteViewer } from './src/ui/practice/NoteViewer';
import { HomeScreen, StatsScreen } from './src/ui/practice/BankScreens';
import { Graph } from './src/ui/Graph';
import { Topics } from './src/ui/Topics';
import { Settings } from './src/ui/Settings';
import { Onboarding } from './src/ui/Onboarding';
import { ManualHost } from './src/ui/ManualHost';
import { Tutor } from './src/ui/Tutor';
import { PromptMaker } from './src/ui/PromptMaker';
import type { ItemContext } from './src/pnle/itemContext';
import { More, type MoreId } from './src/ui/More';
import { DemoHarness } from './src/ui/DemoHarness';
import { Header, ImmersiveCtx, Screen, TabBar, type TabItem } from './src/ui/kit';
import { ThemeProvider, useTheme } from './src/ui/theme';

/** Every id the app has ever used keeps working with go() ('study' now opens Practice). library/map/tutor/settings live under More. */
type Tab = 'home' | 'practice' | 'topics' | 'stats' | 'library' | 'map' | 'tutor' | 'prompts' | 'settings' | 'more';
type GoId = Tab | 'study';
type Ctx = { state: AppState; update: (s: AppState) => void; go: (t: GoId) => void; registerBack: (fn: (() => boolean) | null) => void; tutorItem?: ItemContext; askTutor: (c: ItemContext) => void; clearTutorItem: () => void; readNote: (topicId: string) => void };

const BAR: (TabItem & { id: 'home' | 'practice' | 'topics' | 'stats' | 'more' })[] = [
  { id: 'home', label: 'Home', icon: 'home-outline', iconOn: 'home' },
  { id: 'practice', label: 'Practice', icon: 'create-outline', iconOn: 'create' },
  { id: 'topics', label: 'Learn', icon: 'book-outline', iconOn: 'book' },
  { id: 'stats', label: 'Stats', icon: 'stats-chart-outline', iconOn: 'stats-chart' },
  { id: 'more', label: 'More', icon: 'ellipsis-horizontal-circle-outline', iconOn: 'ellipsis-horizontal-circle' },
];

/** Screens that draw their own header and scrolling. Everything else gets the shell header + Screen. */
const SELF_DRAWN: Tab[] = ['home', 'practice', 'stats', 'more'];

/** The diagnostic no longer gates lessons: Learn sees every folder as unlocked (canTeach is true for all). */
const unlocked = (s: AppState): AppState => ({ ...s, diagnosticsDone: s.folders.map((f) => f.id) });

/** One entry per screen. To add or change a screen, edit only its `render`. */
const SCREENS: Record<Exclude<Tab, 'more'>, { title: string; render: (x: Ctx) => React.ReactNode }> = {
  home: { title: 'Home', render: (x) => <HomeScreen state={x.state} go={x.go} /> },
  practice: { title: 'Practice', render: (x) => <PracticeScreen state={x.state} update={x.update} go={x.go} registerBack={x.registerBack} onAskTutor={x.askTutor} onReadNote={x.readNote} /> },
  topics: { title: 'Learn', render: (x) => <Topics state={unlocked(x.state)} onAskTutor={() => x.go('tutor')} /> },
  stats: { title: 'Stats', render: (x) => <StatsScreen go={x.go} /> },
  library: { title: 'Library', render: (x) => <Library state={x.state} update={x.update} /> },
  map: { title: 'Mind map', render: (x) => <Graph state={x.state} /> },
  tutor: { title: 'Tutor', render: (x) => <Tutor state={unlocked(x.state)} itemContext={x.tutorItem} onClearContext={x.clearTutorItem} /> },
  prompts: { title: 'Prompt Maker', render: (x) => <PromptMaker state={x.state} go={x.go} /> },
  settings: { title: 'Settings', render: (x) => <Settings state={x.state} update={x.update} /> },
};

const isMoreChild = (t: Tab): t is MoreId => t === 'library' || t === 'map' || t === 'tutor' || t === 'prompts' || t === 'settings';

export default function App() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  return (
    <ThemeProvider fontsLoaded={loaded}>
      <BankProvider>
        <Root />
      </BankProvider>
    </ThemeProvider>
  );
}

function Root() {
  const { colors, scheme } = useTheme();
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const backRef = useRef<(() => boolean) | null>(null);
  const registerBack = useCallback((fn: (() => boolean) | null) => { backRef.current = fn; }, []);
  const [immersive, setImmersive] = useState(false);
  const [tutorItem, setTutorItem] = useState<ItemContext | undefined>();
  /** Topic id open in the full-screen note reader (opened from a question). Practice stays mounted underneath. */
  const [noteId, setNoteId] = useState<string | null>(null);

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
      if (noteId) {
        setNoteId(null);
        return true;
      }
      if (tab === 'practice' && backRef.current?.()) return true;
      if (tab === 'tutor' && tutorItem) {
        setTutorItem(undefined);
        setTab('practice');
        return true;
      }
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
  }, [tab, immersive, tutorItem, noteId]);

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

  if (!state.settings.aiChosen && !state.settings.apiKey.trim()) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {bar}
        <Onboarding settings={state.settings} onSave={(settings) => update({ ...state, settings })} onSkip={() => update({ ...state, settings: { ...state.settings, aiChosen: true } })} />
      </View>
    );
  }

  const go = (t: GoId) => setTab(t === 'study' ? 'practice' : t);
  const ctx: Ctx = { state, update, go, registerBack, tutorItem, askTutor: (c) => { setTutorItem(c); setTab('tutor'); }, clearTutorItem: () => { setTutorItem(undefined); setTab('practice'); }, readNote: setNoteId };
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
        <Header title={SCREENS[tab].title} onBack={isMoreChild(tab) ? () => (tab === 'tutor' && tutorItem ? ctx.clearTutorItem() : setTab('more')) : undefined} />
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
        <View style={{ flex: 1 }}>
          {body}
          {noteId ? <NoteViewer state={unlocked(state)} topicId={noteId} subtitle="From your question" onClose={() => setNoteId(null)} /> : null}
        </View>
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
