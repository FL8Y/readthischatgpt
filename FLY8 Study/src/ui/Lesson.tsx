import React, { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import type { AppState } from '../core/types';
import { canTeach } from '../core/diagnostic';
import { callModel } from '../ai/provider';
import { lessonPrompt, mdBlocks, parseLesson, resolveRelated } from '../lesson/lesson';
import { loadLesson, saveLesson } from '../lesson/store';
import { AI_ADDED_LABEL, AI_DRAWN_LABEL, type Lesson as LessonData } from '../lesson/types';
import { attributionLine, searchCommons, type CommonsImage } from '../visual/commons';
import { sanitizeSvg } from '../visual/svg';
import { SvgView } from '../visual/SvgView';
import { Btn, Card, EmptyState, H, P, Pill, TOUCH } from './kit';
import { space, useTheme } from './theme';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

function AiNote({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Pill text={`AI  ${text}`} color={colors.warning} />;
}

/** Lesson reader for one topic. Cached lessons open offline; generating needs the AI and a taught folder. */
export function Lesson({
  state,
  topicId,
  onOpen,
  onBack,
}: {
  state: AppState;
  topicId: string;
  onOpen: (topicId: string) => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const topic = state.topics.find((t) => t.id === topicId);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [images, setImages] = useState<CommonsImage[]>([]);

  const unlocked = !!topic && canTeach(state, topic.folderId);
  const title = topic?.title ?? '';

  useEffect(() => {
    let live = true;
    setLesson(null);
    setErr('');
    setImages([]);
    setLoading(true);
    void loadLesson(topicId).then((l) => {
      if (!live) return;
      setLesson(l ?? null);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [topicId]);

  // Pictures are a bonus: offline or empty results never block or error the lesson.
  useEffect(() => {
    if (!lesson || !title) return;
    let live = true;
    void searchCommons(title).then((r) => live && setImages(r.slice(0, 1)));
    return () => {
      live = false;
    };
  }, [lesson, title]);

  const generate = useCallback(async () => {
    if (!topic) return;
    setBusy(true);
    setErr('');
    try {
      const now = Date.now();
      const raw = await callModel(state.settings, lessonPrompt(state, topic, now));
      const parsed = parseLesson(raw, topic.id, now);
      if (!parsed) throw new Error('The AI reply was not a usable lesson. Try Regenerate.');
      await saveLesson(parsed);
      setLesson(parsed);
    } catch (e) {
      setErr(msg(e));
    } finally {
      setBusy(false);
    }
  }, [state, topic]);

  const back = <Btn label="Back to topics" kind="ghost" onPress={onBack} />;
  if (!topic) return <View style={{ gap: space.md }}>{back}<EmptyState title="Topic not found" /></View>;

  if (loading) return <View style={{ gap: space.md }}>{back}<P dim>Loading lesson...</P></View>;

  if (!lesson && !unlocked) {
    return (
      <View style={{ gap: space.md }}>
        {back}
        <EmptyState title="Lesson locked" detail="Finish this folder's diagnostic in the Study tab first, so the lesson can target your gaps." />
      </View>
    );
  }

  const related = lesson ? resolveRelated(lesson, state.topics) : [];
  const svg = lesson?.diagram?.kind === 'svg' ? sanitizeSvg(lesson.diagram.code) : null;

  return (
    <View style={{ gap: space.md }}>
      {back}
      <H>{topic.title}</H>
      {err ? <P>{err}</P> : null}

      {!lesson ? (
        <EmptyState
          title="No lesson yet"
          detail="Generate a lesson built on your own notes. It is saved on this phone so you can read it offline."
          actionLabel={busy ? 'Writing lesson...' : 'Generate lesson'}
          onAction={busy ? undefined : () => void generate()}
        />
      ) : (
        <>
          {lesson.aiAdded ? <AiNote text={AI_ADDED_LABEL} /> : null}
          <Card>
            {mdBlocks(lesson.explanation).map((b, i) =>
              b.kind === 'h' ? <H key={i}>{b.text}</H> : <P key={i}>{b.kind === 'li' ? `•  ${b.text}` : b.text}</P>,
            )}
          </Card>

          {lesson.mnemonic ? (
            <Card>
              <H>Mnemonic</H>
              <Text accessibilityLabel={`Mnemonic: ${lesson.mnemonic.text}`} style={{ color: colors.accentText, fontSize: 20, fontWeight: '700' }}>
                {lesson.mnemonic.text}
              </Text>
              <P dim>{lesson.mnemonic.rationale}</P>
              <AiNote text={AI_ADDED_LABEL} />
            </Card>
          ) : null}

          {lesson.keyFacts.length ? (
            <Card>
              <H>Key facts</H>
              {lesson.keyFacts.map((f, i) => (
                <P key={i}>✓  {f}</P>
              ))}
            </Card>
          ) : null}

          {lesson.examTraps.length ? (
            <Card>
              <H>Exam traps</H>
              {lesson.examTraps.map((f, i) => (
                <P key={i}>
                  <Text style={{ color: colors.warning }}>⚠ Trap: </Text>
                  {f}
                </P>
              ))}
            </Card>
          ) : null}

          {lesson.diagram ? (
            <Card>
              <H>Diagram</H>
              {svg?.ok ? (
                <SvgView code={lesson.diagram.code} label={lesson.diagram.caption} />
              ) : lesson.diagram.kind === 'mermaid' ? (
                <>
                  <P dim>Mermaid diagrams are not drawn yet. Source:</P>
                  <Text selectable style={{ color: colors.text, backgroundColor: colors.bg, padding: space.md, borderRadius: 8, fontFamily: 'monospace' }}>
                    {lesson.diagram.code}
                  </Text>
                </>
              ) : (
                <P dim>This drawing could not be shown safely, so only the caption is available.</P>
              )}
              <P>{lesson.diagram.caption}</P>
              <AiNote text={AI_DRAWN_LABEL} />
            </Card>
          ) : null}

          {images.map((img) => (
            <Card key={img.pageUrl}>
              <H>Picture</H>
              <Image
                source={{ uri: img.thumbUrl }}
                accessibilityLabel={img.title}
                resizeMode="contain"
                style={{ width: '100%', aspectRatio: 1.4, backgroundColor: colors.bg, borderRadius: 8 }}
              />
              <P dim>{attributionLine(img)}</P>
              <Btn label="Open image page" kind="ghost" onPress={() => void Linking.openURL(img.pageUrl)} />
            </Card>
          ))}

          {related.length ? (
            <Card>
              <H>Related topics</H>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {related.map((r) =>
                  r.topicId ? (
                    <Pressable
                      key={r.title}
                      accessibilityRole="button"
                      accessibilityLabel={`Open lesson: ${r.title}`}
                      onPress={() => onOpen(r.topicId!)}
                      style={{ minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: space.lg, borderRadius: 999, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentText }}
                    >
                      <Text style={{ color: colors.text }}>→ {r.title}</Text>
                    </Pressable>
                  ) : (
                    <Pill key={r.title} text={`${r.title} (no topic yet)`} />
                  ),
                )}
              </View>
            </Card>
          ) : null}

          <Btn
            label={busy ? 'Writing lesson...' : 'Regenerate'}
            kind="ghost"
            disabled={busy || !unlocked}
            hint={unlocked ? 'Asks the AI for a fresh lesson and replaces the saved one' : 'Needs the folder diagnostic'}
            onPress={() => void generate()}
          />
        </>
      )}
    </View>
  );
}
