import React, { useState } from 'react';
import { View } from 'react-native';
import type { PoolEntry, PoolMode, Settings } from '../core/types';
import { DEFAULT_MODELS } from '../ai/provider';
import { answeredByLabel, entryLabel, migrateToPool, poolSnapshot, sessionRuntime, withPool } from '../ai/pool';
import { Btn, Card, Chip, ChoiceChips, H, P } from './kit';
import { space } from './theme';
import { ProviderEditor } from './ProviderEditor';

const newId = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** "My AI providers": ordered list, enable toggles, reorder, mode switch, per-session counters. */
export function ProviderPool({ settings, onChange, onGuide }: { settings: Settings; onChange: (s: Settings) => void; onGuide: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const pool = settings.pool ?? [];
  const set = (next: PoolEntry[]) => onChange(withPool(settings, next));
  const patch = (id: string, p: Partial<PoolEntry>) => set(pool.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= pool.length) return;
    const next = [...pool];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  const add = () => {
    const e: PoolEntry = { id: newId(), provider: 'gemini', apiKey: '', model: DEFAULT_MODELS.gemini, enabled: true };
    const base = migrateToPool(settings);
    onChange(withPool(base, [...(base.pool ?? []), e]));
    setOpen(e.id);
  };
  const mode: PoolMode = settings.poolMode ?? 'fallback';
  const snap = poolSnapshot(settings, sessionRuntime);
  const last = answeredByLabel(sessionRuntime.last);

  return (
    <Card>
      <H>My AI providers</H>
      <P dim>
        Use several providers together: when one is busy or out of free use, the app moves to the next. Keys stay on this phone and are left out of exports.
      </P>
      <Btn label="How to get free AI" kind="ghost" onPress={onGuide} />
      {pool.length === 0 ? (
        <P dim>Nothing here yet, so the single provider above is used. Add one to start a list.</P>
      ) : (
        <View style={{ gap: space.md }}>
          <ChoiceChips
            label="Mode"
            options={['Fallback', 'Spread load'] as const}
            value={mode === 'spread' ? 'Spread load' : 'Fallback'}
            onChange={(v) => onChange({ ...settings, poolMode: v === 'Spread load' ? 'spread' : 'fallback' })}
          />
          <P dim>
            {mode === 'spread'
              ? 'Spread load: takes turns between switched-on providers to stretch free allowances.'
              : 'Fallback: always tries the top provider first, then the next.'}
          </P>
          {pool.map((e, i) => (
            <View key={e.id} style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                <Chip text={`${i + 1}. ${entryLabel(e)}${e.model ? ` · ${e.model}` : ''}${e.enabled ? '' : ' (off)'}`} tone={e.enabled ? 'success' : 'neutral'} icon={e.enabled ? 'checkmark-circle' : 'pause-circle'} />
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                <Btn label={e.enabled ? 'Switch off' : 'Switch on'} kind="ghost" onPress={() => patch(e.id, { enabled: !e.enabled })} />
                <Btn label="Up" kind="ghost" disabled={i === 0} onPress={() => move(i, -1)} />
                <Btn label="Down" kind="ghost" disabled={i === pool.length - 1} onPress={() => move(i, 1)} />
                <Btn label={open === e.id ? 'Close' : 'Edit and test'} kind="ghost" onPress={() => setOpen(open === e.id ? null : e.id)} />
                <Btn label="Remove" kind="danger" onPress={() => set(pool.filter((x) => x.id !== e.id))} />
              </View>
              {open === e.id ? (
                <ProviderEditor
                  value={{ provider: e.provider, apiKey: e.apiKey, model: e.model, baseUrl: e.baseUrl }}
                  onChange={(v) => patch(e.id, v)}
                />
              ) : null}
            </View>
          ))}
          <ChoiceChips
            label="Last resort"
            options={['Manual copy and paste: on', 'Manual copy and paste: off'] as const}
            value={settings.manualLastResort === false ? 'Manual copy and paste: off' : 'Manual copy and paste: on'}
            onChange={(v) => onChange({ ...settings, manualLastResort: v.endsWith('on') })}
          />
          <P dim>Last resort: if every provider fails, the app shows the copy-paste screen instead of an error.</P>
        </View>
      )}
      <Btn label="Add provider" onPress={add} />
      {pool.length ? (
        <Btn label="Go back to one provider" kind="ghost" onPress={() => onChange({ ...settings, pool: undefined })} hint="Keeps the first provider only" />
      ) : null}
      {snap.length ? (
        <View style={{ gap: space.xs }} key={tick}>
          <H>This session</H>
          {snap.map((s) => (
            <P key={s.id} dim>
              {s.label}: {s.calls} calls, {s.failures} failures, {s.cooldowns} cooldowns ({s.status})
            </P>
          ))}
          {last ? <P dim>Last: {last}</P> : null}
          <Btn label="Refresh" kind="ghost" onPress={() => setTick(tick + 1)} />
        </View>
      ) : null}
    </Card>
  );
}
