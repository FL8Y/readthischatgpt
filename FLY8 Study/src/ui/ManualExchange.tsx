import React, { useMemo, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { joinManualParts, validateManualReply, type ManualExpect } from '../ai/manual';
import { Btn, Card, Chip, EmptyState, Field, H, P, Screen } from './kit';
import { radius, space, useTheme } from './theme';

export const HONESTY_NOTE =
  'What leaves this phone: the prompt below, including your notes, goes only where you paste it (the ChatGPT or Claude app). ' +
  'AI replies can be wrong. Check facts, doses and rules against your textbook before relying on them.';

/**
 * Reusable copy-paste exchange (stable props, also used by the Prompt Maker).
 * Step 1: copy the prompt into the chat app. Step 2: paste the reply (in one or more parts) and use it.
 * `onReply` gets the validated text (for json: the JSON itself, or the raw text when the owner chooses "Use anyway").
 */
export function ManualExchange({
  title,
  purpose,
  prompt,
  expect,
  onReply,
  onCancel,
}: {
  title: string;
  purpose?: string;
  prompt: string;
  expect: ManualExpect;
  onReply: (text: string) => void;
  onCancel: () => void;
}) {
  const { colors, type } = useTheme();
  const [step, setStep] = useState<1 | 2>(1);
  const [parts, setParts] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const all = useMemo(() => joinManualParts([...parts, draft], expect), [parts, draft, expect]);
  const check = useMemo(() => validateManualReply(all, expect), [all, expect]);

  const flash = (m: string) => setNote(m);
  const copyPrompt = async () => {
    try {
      await Clipboard.setStringAsync(prompt);
      flash('Prompt copied. Now paste it into the chat app.');
    } catch {
      flash('Could not copy. Select the text in the preview and copy it by hand.');
    }
  };
  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      flash('Could not open the app. Open it yourself and paste the prompt there.');
    }
  };
  const paste = async () => {
    try {
      const t = await Clipboard.getStringAsync();
      if (!t.trim()) return flash('The clipboard is empty. Copy the chat reply first.');
      setDraft(t);
      flash('');
    } catch {
      flash('Could not read the clipboard. Long-press the box and choose Paste.');
    }
  };
  const addPart = () => {
    if (!draft.trim()) return;
    setParts([...parts, draft]);
    setDraft('');
    flash(`Part ${parts.length + 1} saved. Paste the next part below.`);
  };
  const importFile = async () => {
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/markdown', 'application/json'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets[0]) return;
      setDraft(await new File(res.assets[0].uri).text());
      flash('');
    } catch {
      flash('Could not read that file. Only .txt, .md and .json work; paste the text instead.');
    } finally {
      setBusy(false);
    }
  };

  const hasText = all.trim().length > 0;
  const lead =
    expect === 'markdown'
      ? 'The reply is plain Markdown text.'
      : expect === 'json'
        ? 'The reply should be one code block of JSON.'
        : 'The reply is plain text.';

  return (
    <Screen>
      <View accessibilityLiveRegion="polite" style={{ gap: space.xs }}>
        <H>{title}</H>
        {purpose ? <P dim>{purpose}</P> : null}
        <Chip text={`Step ${step} of 2`} tone="accent" />
      </View>

      {step === 1 ? (
        <>
          <Card>
            <H>1. Copy the prompt</H>
            <P>
              Copy this prompt, open the ChatGPT or Claude app, start a new chat, paste it and send it. If the prompt asks
              you to attach a photo or PDF, attach it in the chat first. Then come back here.
            </P>
            <P dim>{HONESTY_NOTE}</P>
            <Text accessibilityRole="header" style={[type('caption'), { color: colors.textDim }]}>
              Prompt preview ({prompt.length.toLocaleString()} characters)
            </Text>
            {prompt.trim() ? (
              <ScrollView
                nestedScrollEnabled
                accessibilityLabel="Prompt preview"
                style={{ maxHeight: 260, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}
                contentContainerStyle={{ padding: space.md }}
              >
                <Text selectable style={[type('caption'), { color: colors.text, lineHeight: 19 }]}>
                  {prompt}
                </Text>
              </ScrollView>
            ) : (
              <EmptyState title="No prompt to show" detail="Go back and try again." />
            )}
            <Btn label="Copy prompt" disabled={!prompt.trim()} onPress={() => void copyPrompt()} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Btn label="Open ChatGPT" kind="ghost" onPress={() => void open('https://chatgpt.com')} hint="Opens the ChatGPT app or website" />
              </View>
              <View style={{ flex: 1 }}>
                <Btn label="Open Claude" kind="ghost" onPress={() => void open('https://claude.ai')} hint="Opens the Claude app or website" />
              </View>
            </View>
            {note ? <P>{note}</P> : null}
          </Card>
          <Btn label="I have the reply, next" onPress={() => { setNote(''); setStep(2); }} />
          <Btn label="Cancel" kind="ghost" onPress={onCancel} />
        </>
      ) : (
        <>
          <Card>
            <H>2. Paste the reply</H>
            <P>{lead} Copy the chat reply, then paste it here. Long replies can come in several parts.</P>
            {parts.length ? <Chip text={`${parts.length} part${parts.length === 1 ? '' : 's'} saved`} tone="success" icon="checkmark-circle" /> : null}
            <Field
              label="Chat reply"
              value={draft}
              onChangeText={setDraft}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Paste the reply here"
              style={{ minHeight: 180, textAlignVertical: 'top' }}
            />
            <Btn label="Paste from clipboard" kind="ghost" onPress={() => void paste()} />
            <Btn label="Add another part" kind="ghost" disabled={!draft.trim()} onPress={addPart} hint="Saves this part so you can paste the next one" />
            <Btn label={busy ? 'Reading file...' : 'Import from file'} kind="ghost" disabled={busy} onPress={() => void importFile()} />
            {note ? <P>{note}</P> : null}
          </Card>

          <View accessibilityLiveRegion="polite" style={{ gap: space.xs }}>
            {!hasText ? (
              <P dim>Nothing pasted yet.</P>
            ) : check.ok ? (
              <>
                <Chip text="Looks usable" tone="success" icon="checkmark-circle" />
                <P dim>{expect === 'json' ? 'Found valid JSON.' : `${check.text.length.toLocaleString()} characters.`} Still check facts against your textbook.</P>
              </>
            ) : (
              <>
                <Chip text="Needs attention" tone="warning" icon="alert-circle" />
                <P>{check.hint}</P>
              </>
            )}
          </View>

          <Btn label="Use this reply" disabled={!check.ok} onPress={() => onReply(check.text)} />
          {hasText && !check.ok ? (
            <Btn label="Use anyway" kind="danger" onPress={() => onReply(all.trim())} hint="Sends the text as it is; it may not work" />
          ) : null}
          <Btn label="Back to the prompt" kind="ghost" onPress={() => setStep(1)} />
          <Btn label="Cancel" kind="ghost" onPress={onCancel} />
        </>
      )}
    </Screen>
  );
}
