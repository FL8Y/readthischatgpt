import React, { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import type { AppState } from '../core/types';
import { canTeach } from '../core/diagnostic';
import { estimateMastery } from '../core/mastery';
import { exportVault, vaultAsText } from '../lesson/vaultExport';
import { Lesson } from './Lesson';
import { Btn, Card, EmptyState, H, P, Pill, ProgressBar, TOUCH, c, sp } from './kit';

/** Learn tab: topics per folder with mastery. A folder's lessons stay locked until its diagnostic is done. */
export function Topics({ state }: { state: AppState }) {
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');

  if (open) return <Lesson state={state} topicId={open} onOpen={setOpen} onBack={() => setOpen(null)} />;

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
    return <EmptyState title="No topics yet" detail="Add notes in the Library tab and your topics appear here." />;
  }

  const now = Date.now();
  return (
    <View style={{ gap: sp.md }}>
      {state.folders.map((f) => {
        const topics = state.topics.filter((t) => t.folderId === f.id);
        if (!topics.length) return null;
        const unlocked = canTeach(state, f.id);
        return (
          <Card key={f.id}>
            <H>{f.name}</H>
            {!unlocked ? <Pill text="🔒 Locked: finish the diagnostic in the Study tab" color={c.warn} /> : null}
            {topics.map((t) => {
              const m = estimateMastery(t.id, state.events, now);
              const pct = Math.round(m.mastery * 100);
              const status = m.attempts ? `${pct}% mastery` : 'not tested';
              return (
                <Pressable
                  key={t.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.title}, ${status}${unlocked ? '' : ', locked'}`}
                  accessibilityState={{ disabled: !unlocked }}
                  disabled={!unlocked}
                  onPress={() => setOpen(t.id)}
                  style={{ minHeight: TOUCH, gap: 6, paddingVertical: sp.sm, opacity: unlocked ? 1 : 0.5 }}
                >
                  <Text style={{ color: c.text, fontSize: 16 }}>
                    {unlocked ? '▸' : '🔒'}  {t.title}
                  </Text>
                  <ProgressBar value={m.attempts ? m.mastery : 0} label={`${t.title} mastery`} />
                  <P dim>{status}</P>
                </Pressable>
              );
            })}
          </Card>
        );
      })}
      {note ? <P>{note}</P> : null}
      <Btn label="Share vault" kind="ghost" hint="Shares your notes as Obsidian-style Markdown text. No API key is included." onPress={() => void share()} />
    </View>
  );
}
