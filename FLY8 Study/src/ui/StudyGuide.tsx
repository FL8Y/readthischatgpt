import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { AppState } from '../core/types';
import { estimateMastery } from '../core/mastery';
import {
  BUNDLE_TIERS,
  TIER_REASON,
  WEIGHTS,
  bankDifficulty,
  buildStudyGuide,
  isDone,
  rankNotes,
  type GuideNote,
  type RankedNote,
  type Stage,
} from '../core/studyGuide';
import { BANK, noteToBundleMap } from '../bank/loader';
import bundlesJson from '../../data/presets/bundles.json';
import { PRESET_PACKS, presetTopicId } from '../presets';
import type { NoteTab } from './NoteReader';
import { Btn, Card, Chip, EmptyState, H, ListRow, P, ProgressBar } from './kit';
import { space, useTheme } from './theme';

const PAGE = 25;

/** Notes the learner has actually installed, as ranking input. User-written notes are left out (no subject tier). */
function installedNotes(state: AppState): GuideNote[] {
  const have = new Set(state.topics.map((t) => t.id));
  const out: GuideNote[] = [];
  for (const p of PRESET_PACKS) {
    for (const n of p.notes) {
      const id = presetTopicId(n.id);
      if (!have.has(id)) continue;
      const t = state.topics.find((x) => x.id === id);
      out.push({ id, noteId: n.id, title: n.title, bundleId: p.id, body: t?.body ?? n.body });
    }
  }
  return out;
}

const packName = (id: string) => PRESET_PACKS.find((p) => p.id === id)?.name ?? id;

/**
 * Study Guide: easiest topics first, in three stages. Pure ranking lives in core/studyGuide.ts (see its header for the
 * exact formula). Tapping a topic opens its note; Stage 1 opens on the Beginner's Eye tab when the note has one.
 */
export function StudyGuide({
  state,
  studied,
  onOpen,
  onAskTutor,
  onClose,
}: {
  state: AppState;
  studied: string[];
  onOpen: (topicId: string, tab: NoteTab) => void;
  onAskTutor?: () => void;
  onClose: () => void;
}) {
  const { colors, type } = useTheme();
  const [openStage, setOpenStage] = useState<Stage | null>(1);
  const [shown, setShown] = useState<Record<number, number>>({});
  const [why, setWhy] = useState(false);

  const { guide, ranked, progress } = useMemo(() => {
    const notes = installedNotes(state);
    const bundleOf = noteToBundleMap(bundlesJson.bundles);
    const bank = bankDifficulty(BANK.items, (id) => bundleOf.get(id));
    const r = rankNotes(notes, bank);
    const now = Date.now();
    const progress: Record<string, { attempts: number; mastery: number }> = {};
    for (const n of r) {
      const m = estimateMastery(n.id, state.events, now);
      if (m.attempts) progress[n.id] = { attempts: m.attempts, mastery: m.mastery };
    }
    return { guide: buildStudyGuide(r, studied, progress), ranked: r, progress };
  }, [state, studied]);

  if (!ranked.length) {
    return (
      <View style={{ gap: space.md }}>
        <Btn label="Back to topics" kind="ghost" onPress={onClose} />
        <EmptyState title="No ready-made notes yet" detail="The Study Guide orders the ready-made review notes from easiest to hardest. Add them in More, then Library, and they appear here." />
      </View>
    );
  }

  const st = new Set(studied);
  const row = (n: RankedNote) => {
    const done = isDone(n.id, st, progress);
    return (
      <ListRow
        key={n.id}
        title={`${done ? '✓  ' : ''}${n.title}`}
        detail={`${packName(n.bundleId)}  ·  ${n.label}`}
        onPress={() => onOpen(n.id, n.stage === 1 ? 'beginner' : 'full')}
      />
    );
  };

  return (
    <View style={{ gap: space.md }}>
      <Btn label="Back to topics" kind="ghost" onPress={onClose} />
      <Card tone="tinted">
        <H>Study Guide</H>
        <P>Do the easy topics first. Your notes are lined up from easiest to hardest in three stages, so you do not start with the hardest ones.</P>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Chip text={`${ranked.length} notes`} tone="accent" />
          <Chip text={`${guide.stages.reduce((a, s) => a + s.done, 0)} done`} tone="success" />
        </View>
        <Btn label={why ? 'Hide how this is ordered' : 'How is this ordered?'} kind="ghost" onPress={() => setWhy(!why)} />
        {why ? (
          <View style={{ gap: space.xs }}>
            <P dim>{TIER_REASON}</P>
            <P dim>
              {`Each note gets a 0-100 difficulty score: ${Math.round(WEIGHTS.tier * 100)}% its subject's hand-set tier (1 easiest to ${Math.max(...Object.values(BUNDLE_TIERS))} hardest), ${Math.round(WEIGHTS.length * 100)}% length, ${Math.round(WEIGHTS.density * 100)}% how many numbers and abbreviations it packs in, ${Math.round(WEIGHTS.dependsOn * 100)}% how many other notes it builds on, ${Math.round(WEIGHTS.foundation * 100)}% less if many notes build on it, ${Math.round(WEIGHTS.bank * 100)}% how hard its practice questions are. Done means marked studied, or 70% or better on at least 2 answers.`}
            </P>
          </View>
        ) : null}
      </Card>

      <Card>
        <H>Start here</H>
        {guide.startHere.length ? (
          <>
            <P dim>The next easy topics you have not done yet.</P>
            {guide.startHere.map(row)}
          </>
        ) : (
          <P>You have done every topic you added. Add more subjects in the Library, or keep practicing.</P>
        )}
      </Card>

      {guide.stages.map((s) => {
        const expanded = openStage === s.stage;
        const limit = shown[s.stage] ?? PAGE;
        return (
          <Card key={s.stage}>
            <H>{s.title}</H>
            <P dim>{s.blurb}</P>
            {s.total ? (
              <>
                <ProgressBar value={s.done / s.total} label={`${s.title} progress`} />
                <Text style={[type('caption'), { color: colors.textDim }]}>
                  {`${s.done} of ${s.total} done` + (s.avgMastery !== null ? `  ·  ${Math.round(s.avgMastery * 100)}% average on ${s.tested} tested` : '  ·  not tested yet')}
                </Text>
                <Btn label={expanded ? 'Hide topics' : `Show topics (${s.total})`} kind="ghost" onPress={() => setOpenStage(expanded ? null : s.stage)} />
                {expanded ? (
                  <>
                    {s.topics.slice(0, limit).map(row)}
                    {s.topics.length > limit ? <Btn label={`Show ${Math.min(PAGE, s.topics.length - limit)} more`} kind="ghost" onPress={() => setShown({ ...shown, [s.stage]: limit + PAGE })} /> : null}
                  </>
                ) : null}
              </>
            ) : (
              <P dim>No topics from this stage are in your library yet.</P>
            )}
          </Card>
        );
      })}

      <Card>
        <H>Stuck on something?</H>
        {onAskTutor ? (
          <Btn label="Ask the tutor" onPress={onAskTutor} hint="Opens the tutor, which answers from your notes first." />
        ) : (
          <P dim>Open More, then Tutor, to ask a question about any topic.</P>
        )}
      </Card>
    </View>
  );
}
