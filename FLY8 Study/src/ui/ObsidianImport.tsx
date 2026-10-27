import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { AppState } from '../core/types';
import { describeImportError } from '../import/pipeline';
import { askAiToMatch, matchesToForced, withSuggestedLinks } from '../obsidian/aiAssist';
import type { AiSuggestions } from '../obsidian/aiAssist';
import { ingestFiles } from '../obsidian/ingest';
import { applyPlan, planMerge } from '../obsidian/merge';
import type { Outcome, ParsedNote, VaultFile } from '../obsidian/types';
import { Btn, Card, H, P, Pill, c, TOUCH } from './kit';

const OUTCOME_LABEL: Record<Outcome, string> = {
  new: 'new topic',
  merge: 'adds to existing',
  identical: 'already there',
  conflict: 'kept separately',
};
const OUTCOME_COLOR: Record<Outcome, string> = { new: c.good, merge: c.accent, identical: c.dim, conflict: c.warn };

function Toggle({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 10 }}
    >
      <Text style={{ color: on ? c.good : c.dim, fontSize: 20 }}>{on ? '☑' : '☐'}</Text>
      <Text style={{ color: c.text, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

export function ObsidianImport({
  state,
  update,
  onClose,
}: {
  state: AppState;
  update: (s: AppState) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState<ParsedNote[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [off, setOff] = useState<Set<string>>(new Set());
  const [ai, setAi] = useState<AiSuggestions | null>(null);
  const [aiMsg, setAiMsg] = useState('');
  const [okMatches, setOkMatches] = useState<Set<string>>(new Set());
  const [okLinks, setOkLinks] = useState<Set<string>>(new Set());
  const [done, setDone] = useState('');

  const hasKey = state.settings.apiKey.trim().length > 0;
  const linkKey = (l: { from: string; to: string }) => `${l.from}>${l.to}`;

  const plan = useMemo(() => {
    if (!notes.length) return null;
    const links = (ai?.suggestedLinks ?? []).filter((l) => okLinks.has(linkKey(l)));
    const matches = (ai?.matches ?? []).filter((m) => okMatches.has(m.incoming));
    const effective = withSuggestedLinks(notes, links);
    return planMerge(state, effective, { forced: matchesToForced(matches, effective, state.topics) });
  }, [notes, ai, okMatches, okLinks, state]);

  const pick = async () => {
    setError('');
    setDone('');
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/markdown', 'text/plain', 'application/zip', 'application/json', '*/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets.length) return;
      setBusy('Reading files...');
      const files: VaultFile[] = [];
      for (const a of res.assets) {
        try {
          const f = new File(a.uri);
          files.push(/\.zip$/i.test(a.name) ? { name: a.name, bytes: await f.bytes() } : { name: a.name, text: await f.text() });
        } catch {
          setWarnings((w) => [...w, `Could not read "${a.name}".`]);
        }
      }
      const out = ingestFiles(files);
      setNotes(out.notes);
      setWarnings(out.warnings);
      setOff(new Set());
      setAi(null);
      setOkMatches(new Set());
      setOkLinks(new Set());
      if (!out.notes.length) setError('No notes found. Pick .md or .canvas files, or a zipped vault.');
    } catch (e) {
      setError(describeImportError(e));
    } finally {
      setBusy('');
    }
  };

  const askAi = async () => {
    setAiMsg('');
    setBusy('Asking the AI to match and link. Only titles and short snippets are sent...');
    try {
      const r = await askAiToMatch(state.settings, notes, state.topics);
      setAi(r);
      setAiMsg(
        `${r.matches.length} match and ${r.suggestedLinks.length} link suggestions (unverified, off until you tick them).` +
          (r.truncated ? ' Only the first 100 notes were checked.' : '') +
          (r.rejected ? ` ${r.rejected} unusable suggestions were ignored.` : ''),
      );
    } catch (e) {
      setAiMsg(describeImportError(e));
    } finally {
      setBusy('');
    }
  };

  const apply = () => {
    if (!plan) return;
    const enabled = new Set(plan.items.filter((i) => !off.has(i.id)).map((i) => i.id));
    update(applyPlan(state, plan, enabled));
    const n = plan.items.filter((i) => enabled.has(i.id) && i.outcome !== 'identical').length;
    setDone(`Imported ${n} note${n === 1 ? '' : 's'}. Open the Map tab to see the links.`);
    setNotes([]);
    setAi(null);
  };

  const toggle = (set: Set<string>, key: string, put: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    put(next);
  };

  return (
    <Card>
      <H>Import Obsidian vault / canvas</H>
      <P dim>
        Pick .md notes, a .canvas mind map, or a zipped vault. You see a preview first. Your existing text is never overwritten or deleted.
      </P>
      <Btn label={busy ? 'Working...' : 'Choose files'} disabled={!!busy} onPress={() => void pick()} />
      {busy ? <P dim>{busy}</P> : null}
      {error ? <P>{error}</P> : null}
      {done ? <P>{done}</P> : null}
      {warnings.map((w, i) => (
        <P key={i} dim>
          {w}
        </P>
      ))}
      {plan ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(plan.counts) as Outcome[]).map((k) => (
              <Pill key={k} text={`${plan.counts[k]} ${OUTCOME_LABEL[k]}`} color={OUTCOME_COLOR[k]} />
            ))}
          </View>
          {plan.items.map((i) => (
            <View key={i.id} style={{ gap: 2 }}>
              <Toggle
                on={!off.has(i.id) && i.outcome !== 'identical'}
                label={`${i.note.title} (${OUTCOME_LABEL[i.outcome]}${i.viaAi ? ', AI match' : ''}) in ${i.folderName}`}
                onPress={() => i.outcome !== 'identical' && toggle(off, i.id, setOff)}
              />
              <P dim>{i.reason}</P>
            </View>
          ))}
          {plan.unresolved.length ? (
            <View style={{ gap: 4 }}>
              <P dim>Links to topics you do not have yet (candidates for new topics):</P>
              <P>{[...new Set(plan.unresolved.map((u) => u.target))].slice(0, 40).join(', ')}</P>
            </View>
          ) : null}
          <Btn label="Ask AI to match and link" kind="ghost" disabled={!hasKey || !!busy} onPress={() => void askAi()} />
          {!hasKey ? <P dim>Add your API key in Settings to let the AI suggest matches. It is optional.</P> : null}
          {aiMsg ? <P dim>{aiMsg}</P> : null}
          {ai?.matches.map((m) => (
            <Toggle
              key={m.incoming}
              on={okMatches.has(m.incoming)}
              label={`AI suggests: "${m.incoming}" is the same as "${m.existing}". ${m.reason}`}
              onPress={() => toggle(okMatches, m.incoming, setOkMatches)}
            />
          ))}
          {ai?.suggestedLinks.map((l) => (
            <Toggle
              key={linkKey(l)}
              on={okLinks.has(linkKey(l))}
              label={`AI suggests linking "${l.from}" to "${l.to}"`}
              onPress={() => toggle(okLinks, linkKey(l), setOkLinks)}
            />
          ))}
          {ai?.issues.map((x, k) => (
            <P key={k} dim>
              AI note (unverified): {x}
            </P>
          ))}
          <Btn
            label="Apply"
            disabled={!!busy || plan.items.every((i) => i.outcome === 'identical' || off.has(i.id))}
            onPress={apply}
          />
        </View>
      ) : null}
      <Btn label="Close" kind="ghost" onPress={onClose} />
    </Card>
  );
}
