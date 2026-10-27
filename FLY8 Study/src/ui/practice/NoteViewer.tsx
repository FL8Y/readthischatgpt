import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { AppState } from '../../core/types';
import { isStudied, toggleStudied } from '../../presets/studied';
import { loadStudied, saveStudied } from '../../presets/studiedStore';
import { Header, Screen } from '../kit';
import { Lesson } from '../Lesson';
import { NoteReader } from '../NoteReader';
import { useTheme } from '../theme';

/** Full-screen note reader opened from a question. Sits on top of Practice so the session underneath is untouched. */
export function NoteViewer({ state, topicId, subtitle, onClose }: { state: AppState; topicId: string; subtitle?: string; onClose: () => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(topicId);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [studied, setStudied] = useState<string[]>([]);

  useEffect(() => {
    setOpen(topicId);
    setLessonOpen(false);
  }, [topicId]);
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
  const title = state.topics.find((t) => t.id === open)?.title ?? 'Note';

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg }} accessibilityViewIsModal>
      <Header title={title} subtitle={subtitle} onBack={lessonOpen ? () => setLessonOpen(false) : onClose} />
      <Screen>
        {lessonOpen ? (
          <Lesson state={state} topicId={open} onOpen={setOpen} onBack={() => setLessonOpen(false)} />
        ) : (
          <NoteReader
            state={state}
            topicId={open}
            studied={isStudied(studied, open)}
            onToggleStudied={() => toggle(open)}
            onOpen={(id) => { setLessonOpen(false); setOpen(id); }}
            onBack={onClose}
            onLesson={() => setLessonOpen(true)}
          />
        )}
      </Screen>
    </View>
  );
}
