import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AppState } from '../core/types';
import { PRESET_DISCLAIMER, PRESET_PACKS, installPack, presetStatus, presetTopicId } from '../presets';
import { Btn, Card, H, P, Pill, TOUCH, c, sp } from './kit';

const PRIORITY_COLOR = { high: c.bad, medium: c.warn, low: c.dim } as const;

/** Ready-made review notes (NP1-NP5, fundamentals, pharmacology, laws). Adding them needs no AI and no key. */
export function PresetPacks({ state, update }: { state: AppState; update: (s: AppState) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const status = presetStatus(state);
  const have = new Set(state.topics.map((t) => t.id));

  const add = (packId: string, ids?: string[]) => {
    const next = installPack(state, packId, ids);
    if (next === state) return setMsg('Nothing new to add: those notes are already in your library.');
    update(next);
    setMsg(`Added ${next.topics.length - state.topics.length} note(s). Open them in the Learn tab.`);
  };

  if (!PRESET_PACKS.some((p) => p.notes.length)) {
    return (
      <Card>
        <H>Ready-made notes</H>
        <P dim>No preset notes are bundled in this build.</P>
      </Card>
    );
  }

  return (
    <Card>
      <H>Ready-made notes (no AI needed)</H>
      <P dim>{PRESET_DISCLAIMER}</P>
      {PRESET_PACKS.map((p) => {
        const st = status.find((x) => x.packId === p.id);
        const installed = st?.installed ?? 0;
        const done = p.notes.length > 0 && installed === p.notes.length;
        const expanded = open === p.id;
        return (
          <View key={p.id} style={{ gap: sp.sm, borderTopWidth: 1, borderTopColor: c.line, paddingTop: sp.md }}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{p.name}</Text>
            <P dim>
              {p.notes.length} notes, {installed} added
            </P>
            <View style={{ flexDirection: 'row', gap: sp.sm, flexWrap: 'wrap' }}>
              <Btn label={done ? 'All added' : 'Add all'} disabled={done || !p.notes.length} onPress={() => add(p.id)} />
              <Btn label={expanded ? 'Hide notes' : 'Show notes'} kind="ghost" onPress={() => setOpen(expanded ? null : p.id)} />
            </View>
            {expanded
              ? p.notes.map((n) => {
                  const added = have.has(presetTopicId(n.id));
                  return (
                    <View key={n.id} style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ color: c.text, fontSize: 15 }}>{n.title}</Text>
                        <Pill text={`${n.priority} priority`} color={PRIORITY_COLOR[n.priority]} />
                      </View>
                      {added ? (
                        <Text style={{ color: c.good, fontSize: 14 }}>Added</Text>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${n.title}`}
                          onPress={() => add(p.id, [n.id])}
                          style={{ minHeight: TOUCH, minWidth: TOUCH, justifyContent: 'center', paddingHorizontal: sp.md }}
                        >
                          <Text style={{ color: c.accent, fontSize: 15, fontWeight: '600' }}>Add</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })
              : null}
          </View>
        );
      })}
      {msg ? <P>{msg}</P> : null}
    </Card>
  );
}
