import React, { useEffect, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import type { AppState } from '../core/types';
import { estimateMastery } from '../core/mastery';
import { exportVault, vaultAsText } from '../lesson/vaultExport';
import { isStudied, studiedLabel, studiedProgress, toggleStudied } from '../presets/studied';
import { loadStudied, saveStudied } from '../presets/studiedStore';
import { Lesson } from './Lesson';
import { NoteReader } from './NoteReader';
import { Btn, Card, EmptyState, Field, H, P, ProgressBar, TOUCH } from './kit';
import { space, useTheme } from './theme';

/** Learn tab: every topic (preset and your own) grouped by folder. Notes open in a plain reader; AI lessons stay optional. */
export function Topics({ state }: { state: AppState }) {
  const { colors, type } = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [studied, setStudied] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    void loadStudied().then((s) => live && setStudied(s));
    return () => {
      live = false;
    };
  }, []);

  const toggle = (id: string) => {
    const next = toggleStudied(studied, id);
    setStudied(next);
    void saveStudied(next);
  };
  const openTopic = (id: string) => {
    setLessonOpen(false);
    setOpen(id);
  };

  if (open && lessonOpen) return <Lesson state={state} topicId={open} onOpen={setOpen} onBack={() => setLessonOpen(false)} />;
  if (open) {
    return (
      <NoteReader
        state={state}
        topicId={open}
        studied={isStudied(studied, open)}
        onToggleStudied={() => toggle(open)}
        onOpen={openTopic}
        onBack={() => setOpen(null)}
        onLesson={() => setLessonOpen(true)}
      />
    );
  }

  const share = async () => {
    setNote('');
    try {
      const files = exportVault(state);
      if (!files.length) return setNote('Nothing to share yet: add topics first.');
      await Share.share({ title: 'Study vault', message: vaultAsText(files) });
    } catch {
      setNote('Sharing failed or was cancelled.');
    }
  };

  if (!state.topics.length) {
    return <EmptyState title="No topics yet" detail="Add the ready-made review notes or your own notes in the Library tab and they appear here." />;
  }

  const now = Date.now();
  const q = query.trim().toLowerCase();
  const matches = (t: { title: string; body: string }) => !q || t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q);
  let shown = 0;
  return (
    <View style={{ gap: space.md }}>
      <Field label="Search notes" value={query} onChangeText={setQuery} placeholder="Title or text" autoCorrect={false} />
      {state.folders.map((f) => {
        const all = state.topics.filter((t) => t.folderId === f.id);
        if (!all.length) return null;
        const topics = all.filter(matches);
        if (!topics.length) return null;
        shown += topics.length;
        const prog = studiedProgress(studied, all.map((t) => t.id));
        return (
          <Card key={f.id}>
            <H>{f.name}</H>
            <P dim>{studiedLabel(prog)}</P>
            {topics.map((t) => {
              const m = estimateMastery(t.id, state.events, now);
              const status = m.attempts ? `${Math.round(m.mastery * 100)}% mastery` : 'not tested';
              const done = isStudied(studied, t.id);
              return (
                <Pressable
                  key={t.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.title}, ${done ? 'studied, ' : ''}${status}`}
                  onPress={() => openTopic(t.id)}
                  style={{ minHeight: TOUCH, gap: 6, paddingVertical: space.sm }}
                >
                  <Text style={[type('bodyStrong'), { color: colors.text }]}>
                    {done ? '✓' : '▸'}  {t.title}
                  </Text>
                  {m.attempts ? <ProgressBar value={m.mastery} label={`${t.title} mastery`} /> : null}
                  <P dim>{done ? `studied, ${status}` : status}</P>
                </Pressable>
              );
            })}
          </Card>
        );
      })}
      {q && !shown ? <P dim>No notes match "{query.trim()}".</P> : null}
      {note ? <P>{note}</P> : null}
      <Btn label="Share vault" kind="ghost" hint="Shares your notes as Obsidian-style Markdown text. No API key is included." onPress={() => void share()} />
    </View>
  );
}
