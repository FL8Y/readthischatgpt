import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { BankItem } from '../../bank/schema';
import type { AttemptRecord, CustomFilter } from '../../bank/types2';
import bundlesJson from '../../../data/presets/bundles.json';
import { Btn, Card, ChoiceChips, Chip, Divider, H, Header, PressableScale, Screen } from '../kit';
import { radius, space, useTheme } from '../theme';
import {
  buildTree, clampMinutes, CUSTOM_COUNTS, customPoolSize, defaultCustom, MAX_MINUTES, MIN_MINUTES, toggleAll,
  type CustomValues,
} from './practiceFlow';
import { noteToBundleMap } from '../../bank/loader';

const NOTE_BUNDLE = noteToBundleMap(bundlesJson.bundles);
const BUNDLE_NAMES: Record<string, string> = Object.fromEntries(bundlesJson.bundles.map((b) => [b.id, b.name]));
const FILTERS: { id: CustomFilter; label: string }[] = [
  { id: 'unseen', label: 'Unseen' },
  { id: 'missed', label: 'Missed' },
  { id: 'flagged', label: 'Flagged' },
];
const MINUTE_PRESETS = [10, 30, 60, 90, 120] as const;

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

export interface CustomSetupProps {
  items: readonly BankItem[];
  attempts: readonly AttemptRecord[];
  flaggedIds: readonly string[];
  onStart: (v: CustomValues) => void;
  onBack: () => void;
}

/** Custom practice: area > bundle > topic tree, count, timer, reveal timing and filters. */
export function CustomSetup({ items, attempts, flaggedIds, onStart, onBack }: CustomSetupProps) {
  const { colors, type } = useTheme();
  const [v, setV] = useState<CustomValues>(defaultCustom());
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const tree = useMemo(() => buildTree(items, NOTE_BUNDLE, BUNDLE_NAMES), [items]);
  const pool = useMemo(() => customPoolSize(items, attempts, flaggedIds, v), [items, attempts, flaggedIds, v]);
  const sel = new Set(v.topics);
  const state = (names: string[]): boolean | 'some' => {
    const n = names.filter((x) => sel.has(x)).length;
    return n === 0 ? false : n === names.length ? true : 'some';
  };
  const set = (patch: Partial<CustomValues>) => setV((cur) => ({ ...cur, ...patch }));
  const toggleFilter = (f: CustomFilter) =>
    set({ filters: v.filters.includes(f) ? v.filters.filter((x) => x !== f) : [...v.filters, f] });
  const count = Math.min(v.count, Math.max(pool, 0));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Custom practice" subtitle={v.topics.length ? `${v.topics.length} topic(s) chosen` : 'All topics'} onBack={onBack} />
      <Screen>
        <Card>
          <H>Topics</H>
          <Text style={[type('caption'), { color: colors.textDim }]}>Tick areas, groups or single topics. Nothing ticked means every topic.</Text>
          {tree.map((a, n) => {
            const names = a.bundles.flatMap((b) => b.topics.map((t) => t.name));
            const aKey = `a-${a.area}`;
            return (
              <View key={a.area}>
                {n > 0 ? <Divider /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Check on={state(names)} label={a.area} detail={`${a.count}`} onPress={() => set({ topics: toggleAll(v.topics, names) })} />
                  </View>
                  <Btn label={open[aKey] ? 'Hide' : 'Open'} kind="ghost" onPress={() => setOpen({ ...open, [aKey]: !open[aKey] })} />
                </View>
                {open[aKey] ? a.bundles.map((b) => {
                  const bn = b.topics.map((t) => t.name);
                  const bKey = `b-${a.area}-${b.id}`;
                  return (
                    <View key={b.id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Check indent={1} on={state(bn)} label={b.name} detail={`${b.count}`} onPress={() => set({ topics: toggleAll(v.topics, bn) })} />
                        </View>
                        <Btn label={open[bKey] ? 'Hide' : 'Open'} kind="ghost" onPress={() => setOpen({ ...open, [bKey]: !open[bKey] })} />
                      </View>
                      {open[bKey] ? b.topics.map((t) => (
                        <Check key={t.name} indent={2} on={sel.has(t.name)} label={t.name} detail={`${t.count}`} onPress={() => set({ topics: toggleAll(v.topics, [t.name]) })} />
                      )) : null}
                    </View>
                  );
                }) : null}
              </View>
            );
          })}
        </Card>

        <Card>
          <H>How many questions</H>
          <ChoiceChips options={CUSTOM_COUNTS} value={v.count} onChange={(n) => set({ count: n })} label="Number of questions" />
        </Card>

        <Card>
          <H>Timer</H>
          <ChoiceChips options={['Off', 'On'] as const} value={v.timerOn ? 'On' : 'Off'} onChange={(x) => set({ timerOn: x === 'On' })} label="Timer" />
          {v.timerOn ? (
            <>
              <Text style={[type('label'), { color: colors.textDim }]}>{`Minutes (${MIN_MINUTES}-${MAX_MINUTES})`}</Text>
              <ChoiceChips options={MINUTE_PRESETS} value={v.minutes} onChange={(m) => set({ minutes: clampMinutes(m) })} label="Timer minutes" />
              <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                <Btn label="-5" kind="ghost" onPress={() => set({ minutes: clampMinutes(v.minutes - 5) })} />
                <Text style={[type('headline'), { color: colors.text, flex: 1, textAlign: 'center' }]}>{v.minutes} min</Text>
                <Btn label="+5" kind="ghost" onPress={() => set({ minutes: clampMinutes(v.minutes + 5) })} />
              </View>
            </>
          ) : null}
        </Card>

        <Card>
          <H>Show answers</H>
          <ChoiceChips options={['Now', 'At end'] as const} value={v.reveal === 'now' ? 'Now' : 'At end'} onChange={(x) => set({ reveal: x === 'Now' ? 'now' : 'end' })} label="Reveal answers" />
          <Text style={[type('caption'), { color: colors.textDim }]}>
            {v.reveal === 'now' ? 'Feedback after every question.' : 'You can change answers until you finish.'}
          </Text>
        </Card>

        <Card>
          <H>Only show</H>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {FILTERS.map((f) => {
              const on = v.filters.includes(f.id);
              return (
                <PressableScale
                  key={f.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={f.label}
                  accessibilityState={{ checked: on }}
                  onPress={() => toggleFilter(f.id)}
                  style={{
                    minHeight: 48, minWidth: 80, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center',
                    borderRadius: radius.md, borderWidth: 2, borderColor: on ? colors.accent : colors.border,
                    backgroundColor: on ? colors.accentSoft : colors.surface,
                  }}
                >
                  <Text style={[type('bodyStrong'), { color: on ? colors.accentText : colors.text }]}>{f.label}</Text>
                </PressableScale>
              );
            })}
          </View>
        </Card>

        <Text style={[type('body'), { color: colors.textDim, textAlign: 'center' }]}>
          {pool === 0 ? 'No questions match these choices.' : `${pool} ${pool === 1 ? 'match' : 'matches'}; this session will have ${count}.`}
        </Text>
        <Btn label={`Start ${count || ''} questions`.replace('  ', ' ')} disabled={pool === 0} onPress={() => onStart(v)} />
      </Screen>
    </View>
  );
}
