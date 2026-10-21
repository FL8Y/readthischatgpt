import React, { useState } from 'react';
import { Share, View } from 'react-native';
import type { AppState } from '../core/types';
import { applyImport, validateBackup, type BackupResult } from '../core/backup';
import { exportAll, writeExtras } from '../backupIO';
import { KeySetup } from './Onboarding';
import { ProviderPool } from './ProviderPool';
import { FreeAiGuide } from './FreeAiGuide';
import { QuickSetup } from './QuickSetup';
import { Btn, Card, Chip, Field, H, P } from './kit';
import { space } from './theme';

export function Settings({ state, update }: { state: AppState; update: (s: AppState) => void }) {
  const [raw, setRaw] = useState('');
  const [checked, setChecked] = useState<BackupResult | null>(null);
  const [done, setDone] = useState(false);
  const [guide, setGuide] = useState(false);

  const check = () => {
    setDone(false);
    setChecked(validateBackup(raw));
  };
  const confirmImport = () => {
    if (!checked || !checked.ok) return;
    void writeExtras(checked.extras);
    update(applyImport(state, checked.state));
    setChecked(null);
    setRaw('');
    setDone(true);
  };

  if (guide) {
    return (
      <View style={{ gap: space.md }}>
        <Btn label="Back to Settings" kind="ghost" onPress={() => setGuide(false)} />
        <FreeAiGuide />
      </View>
    );
  }
  const hasPool = !!state.settings.pool?.length;
  return (
    <View style={{ gap: space.md }}>
      <QuickSetup settings={state.settings} onSave={(settings) => update({ ...state, settings })} />
      {hasPool ? null : (
      <Card>
        <H>AI provider</H>
        <P dim>Manual mode needs no key. For an API mode, paste your own key; it stays on this phone and is left out of exports.</P>
        <KeySetup
          includeManual
          settings={state.settings}
          onChange={(settings) => update({ ...state, settings })}
          onRemove={() => update({ ...state, settings: { ...state.settings, apiKey: '' } })}
        />
      </Card>
      )}
      <ProviderPool settings={state.settings} onChange={(settings) => update({ ...state, settings })} onGuide={() => setGuide(true)} />
      <Card>
        <H>Backup</H>
        <Btn label="Export everything (no key)" kind="ghost" onPress={() => void exportAll(state).then((message) => Share.share({ message }))} />
      </Card>
      <Card>
        <H>Import a backup</H>
        <P dim>Paste text from an earlier export. It replaces your notes and progress, so check it first. Your key is kept.</P>
        <Field
          label="Backup text"
          value={raw}
          onChangeText={(t) => {
            setRaw(t);
            setChecked(null);
            setDone(false);
          }}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={{ minHeight: 96, textAlignVertical: 'top' }}
        />
        <Btn label="Check backup" kind="ghost" disabled={!raw.trim()} onPress={check} />
        {checked && !checked.ok ? (
          <View style={{ gap: space.xs }} accessibilityLiveRegion="polite">
            <Chip text="Not valid" tone="danger" icon="alert-circle" />
            {checked.errors.slice(0, 5).map((e) => (
              <P key={e}>{e}</P>
            ))}
          </View>
        ) : null}
        {checked && checked.ok ? (
          <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
            <Chip text="Looks valid" tone="success" icon="checkmark-circle" />
            <P>
              Found {checked.summary.topics} topics, {checked.summary.sources} sources, {checked.summary.events} answers{Object.keys(checked.extras).length ? ', plus lessons and chat' : ''}.
              Importing replaces what is on this phone now.
            </P>
            <Btn label="Replace my data with this backup" kind="danger" onPress={confirmImport} />
            <Btn label="Cancel" kind="ghost" onPress={() => setChecked(null)} />
          </View>
        ) : null}
        {done ? <P>Backup imported.</P> : null}
      </Card>
    </View>
  );
}
