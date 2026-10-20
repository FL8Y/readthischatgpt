import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { AppState, Topic } from '../core/types';
import { parseMarkdownBlocks, type Block, type Span } from '../core/markdownBlocks';
import { backlinks, buildGraph, slugify } from '../core/vault';
import { PRESET_DISCLAIMER, findPresetNote } from '../presets';
import { visualForNote } from '../presets/visuals';
import { SvgView } from '../visual/SvgView';
import { Btn, Card, H, P, Pill, PressableScale, TOUCH } from './kit';
import { radius, space, useTheme, type Palette } from './theme';

type Resolve = (target: string) => Topic | undefined;

function Spans({ spans, resolve, onOpen, base }: { spans: Span[]; resolve: Resolve; onOpen: (id: string) => void; base?: object }) {
  const { colors, type } = useTheme();
  return (
    <Text selectable style={[type('body'), { color: colors.text, fontSize: 16, lineHeight: 25 }, base]}>
      {spans.map((s, i) => {
        if (s.t === 'bold') return <Text key={i} style={{ fontWeight: '700' }}>{s.text}</Text>;
        if (s.t === 'italic') return <Text key={i} style={{ fontStyle: 'italic' }}>{s.text}</Text>;
        if (s.t === 'code') return <Text key={i} style={{ fontFamily: 'monospace', backgroundColor: colors.surfaceAlt }}>{s.text}</Text>;
        if (s.t === 'link') {
          const hit = resolve(s.target);
          if (!hit) return <Text key={i} style={{ color: colors.textDim }}>{s.label}</Text>;
          return (
            <Text
              key={i}
              accessibilityRole="link"
              onPress={() => onOpen(hit.id)}
              style={{ color: colors.accentText, textDecorationLine: 'underline', fontWeight: '600' }}
            >
              {s.label}
            </Text>
          );
        }
        return <Text key={i}>{s.text}</Text>;
      })}
    </Text>
  );
}

function BlockView({ b, resolve, onOpen }: { b: Block; resolve: Resolve; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const sp_ = { resolve, onOpen };
  switch (b.t) {
    case 'heading':
      return (
        <View accessibilityRole="header" style={{ marginTop: b.level === 2 ? space.md : space.xs }}>
          <Spans spans={b.spans} {...sp_} base={{ fontSize: b.level === 2 ? 20 : b.level === 3 ? 18 : 16, fontWeight: '700' }} />
        </View>
      );
    case 'paragraph':
      return <Spans spans={b.spans} {...sp_} />;
    case 'bullets':
    case 'numbered':
      return (
        <View style={{ gap: space.sm }}>
          {b.items.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: space.sm, paddingRight: space.md }}>
              <Text style={{ color: colors.textDim, fontSize: 16, lineHeight: 25, minWidth: 22 }}>{b.t === 'bullets' ? '•' : `${i + 1}.`}</Text>
              <View style={{ flex: 1 }}>
                <Spans spans={it} {...sp_} />
              </View>
            </View>
          ))}
        </View>
      );
    case 'quote':
      return (
        <View style={{ borderLeftWidth: 3, borderLeftColor: colors.accentText, paddingLeft: space.md }}>
          <Spans spans={b.spans} {...sp_} base={{ color: colors.textDim }} />
        </View>
      );
    case 'code':
      return (
        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: space.md }}>
          <Text selectable style={{ color: colors.text, fontFamily: 'monospace', fontSize: 14 }}>{b.text}</Text>
        </View>
      );
    case 'rule':
      return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.xs }} />;
    case 'table':
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8 }}>
            {[b.header, ...b.rows].map((row, r) => (
              <View key={r} style={{ flexDirection: 'row', backgroundColor: r === 0 ? colors.surfaceAlt : undefined }}>
                {row.map((cell, k) => (
                  <View key={k} style={{ width: 150, padding: space.sm, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
                    <Spans spans={cell} {...sp_} base={{ fontSize: 14, lineHeight: 20, fontWeight: r === 0 ? '700' : '400' }} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
  }
}

export type NoteTab = 'full' | 'beginner';

/** Two-tab switch: the full note, or the plain-language Beginner's Eye version. */
function TabSwitch({ value, onChange, hasBeginner }: { value: NoteTab; onChange: (t: NoteTab) => void; hasBeginner: boolean }) {
  const { colors, type } = useTheme();
  const tabs: { id: NoteTab; label: string }[] = [
    { id: 'full', label: 'Full note' },
    { id: 'beginner', label: "Beginner's Eye" },
  ];
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: space.xs, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.xs }}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <View key={t.id} style={{ flex: 1 }}>
          <PressableScale
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.id)}
            style={{
              minHeight: TOUCH,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              backgroundColor: on ? colors.surface : 'transparent',
              borderWidth: on ? 1 : 0,
              borderColor: colors.border,
            }}
          >
            <Text style={[type('bodyStrong'), { color: on ? colors.accentText : colors.textDim }]}>{t.label}</Text>
            {t.id === 'beginner' && !hasBeginner ? <Text style={[type('caption'), { color: colors.textDim }]}>coming</Text> : null}
          </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

const priorityColor = (colors: Palette) => ({ high: colors.danger, medium: colors.warning, low: colors.textDim }) as const;

/** Plain Markdown note reader. No AI, no key, not gated by the diagnostic. */
export function NoteReader({
  state,
  topicId,
  studied,
  onToggleStudied,
  onOpen,
  onBack,
  onLesson,
  initialTab = 'full',
}: {
  state: AppState;
  topicId: string;
  studied: boolean;
  onToggleStudied: () => void;
  onOpen: (id: string) => void;
  onBack: () => void;
  onLesson: () => void;
  /** Which tab to show first. 'beginner' only takes effect when the note has a Beginner's Eye. */
  initialTab?: NoteTab;
}) {
  const { colors } = useTheme();
  const [pickedTab, setPickedTab] = useState<NoteTab | null>(null);
  const topic = state.topics.find((t) => t.id === topicId);
  const { resolve, from } = useMemo(() => {
    const bySlug = new Map<string, Topic>();
    for (const t of state.topics) bySlug.set(slugify(t.title), t);
    for (const t of state.topics) for (const a of t.aliases ?? []) if (!bySlug.has(slugify(a))) bySlug.set(slugify(a), t);
    const g = buildGraph(state.topics);
    return {
      resolve: ((target: string) => bySlug.get(slugify(target))) as Resolve,
      from: backlinks(g, topicId)
        .map((id) => state.topics.find((t) => t.id === id))
        .filter((t): t is Topic => !!t),
    };
  }, [state.topics, topicId]);
  const blocks = useMemo(() => parseMarkdownBlocks(topic?.body ?? ''), [topic?.body]);
  const beginnerText = findPresetNote(topicId)?.beginnerEye;
  const beginnerBlocks = useMemo(() => parseMarkdownBlocks(beginnerText ?? ''), [beginnerText]);

  if (!topic) {
    return (
      <Card>
        <H>Topic not found</H>
        <Btn label="Back" onPress={onBack} />
      </Card>
    );
  }
  const siblings = state.topics.filter((t) => t.folderId === topic.folderId);
  const idx = siblings.findIndex((t) => t.id === topic.id);
  const prev = idx > 0 ? siblings[idx - 1] : undefined;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : undefined;
  const meta = findPresetNote(topic.id);
  const visual = meta ? visualForNote(meta.id) : undefined;
  const tab: NoteTab = pickedTab ?? (initialTab === 'beginner' && beginnerText ? 'beginner' : 'full');
  const visualBlock = visual ? (
    <View style={{ gap: space.xs }}>
      <SvgView code={visual.svg} label={visual.caption} natural />
      <P dim>{`Diagram (schematic): ${visual.caption}`}</P>
    </View>
  ) : null;
  const isPreset = topic.sourceIds.some((id) => state.sources.find((s) => s.id === id)?.kind === 'preset');

  return (
    <View style={{ gap: space.md }}>
      <Btn label="Back to topics" kind="ghost" onPress={onBack} />
      <Card>
        <H>{topic.title}</H>
        {meta ? (
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <Pill text={meta.area} color={colors.accentText} />
            <Pill text={`${meta.priority} priority`} color={priorityColor(colors)[meta.priority]} />
          </View>
        ) : null}
        <TabSwitch value={tab} onChange={setPickedTab} hasBeginner={!!beginnerText} />
        {tab === 'full' ? (
          <View style={{ gap: space.md }}>
            {visualBlock}
            {blocks.length ? blocks.map((b, i) => <BlockView key={i} b={b} resolve={resolve} onOpen={onOpen} />) : <P dim>This note is empty.</P>}
          </View>
        ) : beginnerText ? (
          <View style={{ gap: space.md }}>
            <P dim>Plain-language version for non-nurses. Same facts as the full note, in simpler words. Switch to Full note for the exam details.</P>
            {beginnerBlocks.map((b, i) => <BlockView key={i} b={b} resolve={resolve} onOpen={onOpen} />)}
          </View>
        ) : (
          <View style={{ gap: space.sm, paddingVertical: space.sm }}>
            <H>Beginner's Eye for this note is coming</H>
            <P dim>
              {isPreset
                ? 'A plain-words version of this note has not been written yet. Nothing is made up in the meantime: the Full note has everything.'
                : "Beginner's Eye is only written for the ready-made notes. Your own notes show here as you wrote them in the Full note."}
            </P>
            <Btn label="Read the full note" kind="ghost" onPress={() => setPickedTab('full')} />
          </View>
        )}
        {isPreset ? <P dim>{PRESET_DISCLAIMER}</P> : null}
      </Card>
      <Btn label={studied ? 'Studied (tap to undo)' : 'Mark as studied'} kind={studied ? 'ghost' : 'primary'} onPress={onToggleStudied} />
      {from.length ? (
        <Card>
          <H>Linked from</H>
          {from.map((t) => (
            <Text
              key={t.id}
              accessibilityRole="link"
              onPress={() => onOpen(t.id)}
              style={{ color: colors.accentText, fontSize: 16, minHeight: TOUCH, textAlignVertical: 'center', paddingVertical: space.md }}
            >
              {t.title}
            </Text>
          ))}
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Btn label="Previous" kind="ghost" disabled={!prev} onPress={() => prev && onOpen(prev.id)} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="Next" kind="ghost" disabled={!next} onPress={() => next && onOpen(next.id)} />
        </View>
      </View>
      <Btn label="Generate AI lesson" kind="ghost" hint="Needs the AI and a finished diagnostic for this folder." onPress={onLesson} />
    </View>
  );
}
