import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import bundlesJson from '../../data/presets/bundles.json';
import { noteToBundleMap } from '../bank/loader';
import type { BankItem } from '../bank/schema';
import { buildTree, toggleAll } from './practice/practiceFlow';
import { Btn, Divider, PressableScale } from './kit';
import { radius, space, useTheme } from './theme';

const NOTE_BUNDLE = noteToBundleMap(bundlesJson.bundles);
const BUNDLE_NAMES: Record<string, string> = Object.fromEntries(bundlesJson.bundles.map((b) => [b.id, b.name]));

function Check({ on, label, detail, onPress, indent = 0 }: { on: boolean | 'some'; label: string; detail: string; onPress: () => void; indent?: number }) {
  const { colors, type } = useTheme();
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={`${label}, ${detail}`}
      accessibilityState={{ checked: on === 'some' ? 'mixed' : on }}
      onPress={onPress}
      scaleTo={0.99}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: indent * space.lg }}
    >
      <View style={{
        width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
        borderColor: on ? colors.accent : colors.border, backgroundColor: on === true ? colors.accent : 'transparent',
      }}>
        {on ? <Text style={{ color: on === true ? colors.onAccent : colors.accentText, fontSize: 14, fontWeight: '700' }}>{on === true ? '✓' : '–'}</Text> : null}
      </View>
      <Text style={[type('body'), { color: colors.text, flex: 1 }]}>{label}</Text>
      <Text style={[type('caption'), { color: colors.textDim }]}>{detail}</Text>
    </PressableScale>
  );
}

export interface TopicTreePickerProps {
  items: readonly BankItem[];
  selected: readonly string[];
  onChange: (names: string[]) => void;
  /** Extra single topics that have no questions yet (the learner's own notes). */
  extraTopics?: readonly string[];
}

/** Area > bundle > topic tick tree (same pattern as Custom practice). Ticking a group ticks every topic inside. */
export function TopicTreePicker({ items, selected, onChange, extraTopics = [] }: TopicTreePickerProps) {
  const { colors, type } = useTheme();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const tree = useMemo(() => buildTree(items, NOTE_BUNDLE, BUNDLE_NAMES), [items]);
  const sel = new Set(selected);
  const state = (names: string[]): boolean | 'some' => {
    const n = names.filter((x) => sel.has(x)).length;
    return n === 0 ? false : n === names.length ? true : 'some';
  };
  const toggle = (names: string[]) => onChange(toggleAll(selected, names));
  const flip = (k: string) => setOpen({ ...open, [k]: !open[k] });
  return (
    <View>
      {tree.map((a, n) => {
        const names = a.bundles.flatMap((b) => b.topics.map((t) => t.name));
        const aKey = `a-${a.area}`;
        return (
          <View key={a.area}>
            {n > 0 ? <Divider /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}><Check on={state(names)} label={a.area} detail={`${a.count}`} onPress={() => toggle(names)} /></View>
              <Btn label={open[aKey] ? 'Hide' : 'Open'} kind="ghost" onPress={() => flip(aKey)} />
            </View>
            {open[aKey] ? a.bundles.map((b) => {
              const bn = b.topics.map((t) => t.name);
              const bKey = `b-${a.area}-${b.id}`;
              return (
                <View key={b.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}><Check indent={1} on={state(bn)} label={b.name} detail={`${b.count}`} onPress={() => toggle(bn)} /></View>
                    <Btn label={open[bKey] ? 'Hide' : 'Open'} kind="ghost" onPress={() => flip(bKey)} />
                  </View>
                  {open[bKey] ? b.topics.map((t) => (
                    <Check key={t.name} indent={2} on={sel.has(t.name)} label={t.name} detail={`${t.count}`} onPress={() => toggle([t.name])} />
                  )) : null}
                </View>
              );
            }) : null}
          </View>
        );
      })}
      {extraTopics.length ? (
        <View>
          <Divider />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}><Text style={[type('bodyStrong'), { color: colors.text }]}>My own notes</Text></View>
            <Btn label={open.mine ? 'Hide' : 'Open'} kind="ghost" onPress={() => flip('mine')} />
          </View>
          {open.mine ? extraTopics.map((t) => <Check key={t} indent={1} on={sel.has(t)} label={t} detail="note" onPress={() => toggle([t])} />) : null}
        </View>
      ) : null}
    </View>
  );
}
