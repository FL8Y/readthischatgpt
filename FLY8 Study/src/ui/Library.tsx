import React, { useState } from 'react';
import { View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { AppState, Source, Topic } from '../core/types';
import { assessTextQuality, chunkText, NEEDS_REVIEW_BELOW, parseVerification, verificationPrompt } from '../core/provenance';
import { callModel } from '../ai/provider';
import { assertBase64Size, classifyFile } from '../import/files';
import { describeImportError, prepareImportedNote, titleFromFileName } from '../import/pipeline';
import { ImportError, UNVERIFIED_SUGGESTION } from '../import/types';
import type { ReviewedSource } from '../import/types';
import { callModelVision } from '../import/vision';
import { Btn, Card, Field, H, P, Pill } from './kit';
import { useTheme } from './theme';
import { ObsidianImport } from './ObsidianImport';
import { PresetPacks } from './PresetPacks';

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function Library({ state, update }: { state: AppState; update: (s: AppState) => void }) {
  const { colors } = useTheme();
  const [folderId, setFolderId] = useState(state.folders[0]?.id ?? '');
  const [newFolder, setNewFolder] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [importing, setImporting] = useState('');
  const [importError, setImportError] = useState('');
  const [showObsidian, setShowObsidian] = useState(false);

  const addFolder = () => {
    const name = newFolder.trim();
    if (!name) return;
    const id = uid('f');
    update({ ...state, folders: [...state.folders, { id, name }] });
    setFolderId(id);
    setNewFolder('');
  };

  const addNote = (noteTitle: string, body: string, kind: Source['kind'], uri?: string) => {
    const quality = assessTextQuality(body);
    const source: Source = {
      id: uid('s'),
      title: noteTitle,
      kind,
      uri,
      addedAt: Date.now(),
      quality,
      verification: quality.score < NEEDS_REVIEW_BELOW ? 'needs-review' : 'unverified',
    };
    const topic: Topic = { id: uid('t'), folderId, title: noteTitle, body, sourceIds: [source.id] };
    update({
      ...state,
      sources: [...state.sources, source],
      chunks: [...state.chunks, ...chunkText(body, source.id)],
      topics: [...state.topics, topic],
    });
    setMsg(
      quality.score < NEEDS_REVIEW_BELOW
        ? `Saved, but the text looks unreadable (${quality.flags.join(', ')}). Check it before studying.`
        : 'Saved to your library.',
    );
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'text/markdown'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    try {
      addNote(a.name.replace(/\.[^.]+$/, ''), await new File(a.uri).text(), 'file', a.uri);
    } catch {
      setMsg('Could not read that file. Only .txt and .md work for now; paste text for anything else.');
    }
  };

  const importScan = async () => {
    setImportError('');
    setMsg('');
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    try {
      const { kind, mediaType } = classifyFile(a);
      if (kind === 'pdf' && state.settings.provider === 'openai') {
        throw new ImportError('PDF import needs Claude. With OpenAI, take photos of the pages instead.', 'unsupported');
      }
      setImporting('Reading file...');
      let base64: string;
      try {
        base64 = await new File(a.uri).base64();
      } catch {
        throw new ImportError('Could not read that file. Try picking it again.', 'read');
      }
      assertBase64Size(base64);
      setImporting('Asking the AI to transcribe it. This can take a minute...');
      const out = await callModelVision(state.settings, { kind, mediaType, base64 });
      setImporting('Saving...');
      const title = titleFromFileName(a.name);
      const sourceId = uid('s');
      const prepared = prepareImportedNote(out.text, sourceId, out.truncated);
      const source: Source = {
        id: sourceId,
        title,
        kind: 'file',
        uri: a.uri,
        addedAt: Date.now(),
        quality: prepared.quality,
        verification: prepared.verification,
      };
      const topic: Topic = { id: uid('t'), folderId, title, body: out.text, sourceIds: [sourceId] };
      update({
        ...state,
        sources: [...state.sources, source],
        chunks: [...state.chunks, ...prepared.chunks],
        topics: [...state.topics, topic],
      });
      setMsg(
        prepared.verification === 'needs-review'
          ? `Saved, but the transcription looks rough${out.truncated ? ' or cut short' : ''}. Check it before studying.`
          : 'Transcribed and saved to your library. Skim it for mistakes.',
      );
    } catch (e) {
      setImportError(describeImportError(e));
    } finally {
      setImporting('');
    }
  };

  const check = async (source: Source) => {
    setBusy(source.id);
    try {
      const sample = state.chunks.filter((k) => k.sourceId === source.id).slice(0, 4).map((k) => k.text);
      const raw = await callModel(state.settings, verificationPrompt(sample));
      const result = parseVerification(raw);
      if (!result) throw new Error('unreadable reply');
      update({
        ...state,
        sources: state.sources.map((x) =>
          x.id === source.id
            ? {
                ...x,
                verification: result.legit ? 'ai-checked' : 'needs-review',
                suggestedOrigin: result.suggestedOrigin,
                issues: result.issues,
              } as ReviewedSource
            : x,
        ),
      });
      setMsg(
        result.issues.length
          ? `AI flagged (${UNVERIFIED_SUGGESTION}): ${result.issues.join('; ')}`
          : `AI found no obvious problems (${UNVERIFIED_SUGGESTION}, not proof).`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Check failed.');
    } finally {
      setBusy(null);
    }
  };

  const topics = state.topics.filter((t) => t.folderId === folderId);
  return (
    <View style={{ gap: 14 }}>
      <PresetPacks state={state} update={update} />
      <Card>
        <H>Folders</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {state.folders.map((f) => (
            <Btn key={f.id} label={f.name} kind={f.id === folderId ? 'primary' : 'ghost'} onPress={() => setFolderId(f.id)} />
          ))}
        </View>
        <Field label="New folder" value={newFolder} onChangeText={setNewFolder} placeholder="e.g. NP2 Pharmacology" />
        <Btn label="Add folder" kind="ghost" onPress={addFolder} />
      </Card>
      <Card>
        <H>Feed your notes</H>
        <Field label="Topic title" value={title} onChangeText={setTitle} placeholder="Heart failure" />
        <Field label="Notes (use [[links]] to connect topics)" value={text} onChangeText={setText} multiline numberOfLines={6} style={{ minHeight: 120, textAlignVertical: 'top' }} />
        <Btn
          label="Save notes"
          disabled={!title.trim() || !text.trim()}
          onPress={() => {
            addNote(title.trim(), text, 'paste');
            setTitle('');
            setText('');
          }}
        />
        <Btn label="Import .txt / .md file" kind="ghost" onPress={() => void pickFile()} />
        <Btn label={importing ? 'Importing...' : 'Import PDF / photo'} kind="ghost" disabled={!!importing} onPress={() => void importScan()} />
        <Btn label="Import Obsidian vault / canvas" kind="ghost" onPress={() => setShowObsidian(true)} />
        <P dim>PDF needs Claude. Photos work with Claude or OpenAI. Max 15 MB. The AI transcribes it, so skim the result.</P>
        {importing ? <P dim>{importing}</P> : null}
        {importError ? <P>{importError}</P> : null}
        {msg ? <P dim>{msg}</P> : null}
      </Card>
      {showObsidian ? <ObsidianImport state={state} update={update} onClose={() => setShowObsidian(false)} /> : null}
      {topics.map((t) => {
        const src = state.sources.find((x) => x.id === t.sourceIds[0]) as ReviewedSource | undefined;
        return (
          <Card key={t.id}>
            <H>{t.title}</H>
            {src ? (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Pill text={`readability ${Math.round(src.quality.score * 100)}%`} color={src.quality.score < NEEDS_REVIEW_BELOW ? colors.warning : colors.success} />
                <Pill text={src.verification} color={src.verification === 'ai-checked' ? colors.success : colors.textDim} />
                {src.suggestedOrigin ? <Pill text={`looks like: ${src.suggestedOrigin} (${UNVERIFIED_SUGGESTION})`} /> : null}
              </View>
            ) : null}
            {src?.issues?.length ? (
              <View style={{ gap: 4 }}>
                <P dim>AI-flagged issues ({UNVERIFIED_SUGGESTION}):</P>
                {src.issues.map((issue, i) => (
                  <P key={i}>- {issue}</P>
                ))}
              </View>
            ) : null}
            {src ? <Btn label={busy === src.id ? 'Checking...' : 'Double-check with AI'} kind="ghost" disabled={busy !== null} onPress={() => void check(src)} /> : null}
          </Card>
        );
      })}
    </View>
  );
}
