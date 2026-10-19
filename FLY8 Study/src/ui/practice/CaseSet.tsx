import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BankItem } from '../../bank/schema';
import { Chip, PressableScale } from '../kitParts';
import { radius, space, useTheme } from '../theme';
import { ClozeLine } from './ClozeLine';
import { HighlightText } from './HighlightText';
import { MatrixTable } from './MatrixTable';
import {
  caseHint, caseProgressText, clozeSource, plainCloze, setSlot, togglePick, type CaseSetResult, type ClusterPos,
} from './caseLogic';

/** Shared vignette for a case set: progress strip on top, text collapsible so the question gets the screen. */
export function CasePanel({ pos, vignette, hideText }: { pos: ClusterPos; vignette: string; hideText?: boolean }) {
  const { colors, type } = useTheme();
  const [open, setOpen] = useState(true);
  const show = open && !hideText;
  return (
    <View style={{ backgroundColor: colors.surfaceAlt, borderBottomWidth: 1, borderColor: colors.border, paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Chip text={caseProgressText(pos)} tone="accent" icon="albums-outline" />
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }} accessible={false}>
          {Array.from({ length: pos.size }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < pos.seq ? colors.accent : colors.border }} />
          ))}
        </View>
        {!hideText ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={open ? 'Hide the case text' : 'Show the case text'}
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((o) => !o)}
            scaleTo={0.97}
            style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 2 }}
          >
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.accentText} />
            <Text style={[type('label'), { color: colors.accentText }]}>{open ? 'Hide case' : 'Show case'}</Text>
          </PressableScale>
        ) : null}
      </View>
      {show ? (
        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
          <Text accessibilityLabel={`Case text. ${plainCloze(vignette)}`} style={[type('body'), { color: colors.text }]}>{plainCloze(vignette)}</Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

export interface CaseInputProps {
  item: BankItem;
  selected: number[];
  locked: boolean;
  showVerdict: boolean;
  onChange: (sel: number[]) => void;
  /** Highlight's Done button. */
  onDone: () => void;
}

/** Interaction for the non-option item types. Returns null for single and sata (the Player draws those). */
export function CaseItemInput({ item, selected, locked, showVerdict, onChange, onDone }: CaseInputProps) {
  const { colors, type } = useTheme();
  const hint = caseHint(item);
  let body: React.ReactNode = null;
  if (item.type === 'matrix') {
    body = <MatrixTable item={item} selected={selected} locked={locked} showVerdict={showVerdict} onSelect={(r, c) => onChange(setSlot(item, selected, r, c))} />;
  } else if (item.type === 'cloze') {
    body = <ClozeLine item={item} selected={selected} locked={locked} showVerdict={showVerdict} onSelect={(b, c) => onChange(setSlot(item, selected, b, c))} />;
  } else if (item.type === 'highlight') {
    body = (
      <HighlightText
        item={item}
        selected={selected}
        locked={locked}
        showVerdict={showVerdict}
        onToggle={(i) => onChange(togglePick(selected, i, item.options.length))}
        onDone={onDone}
      />
    );
  }
  if (!body) return null;
  return (
    <View style={{ gap: space.md }}>
      {hint ? <Text style={[type('label'), { color: colors.accentText }]}>{hint}</Text> : null}
      {body}
    </View>
  );
}

/** True when the item's sentence-with-blanks is drawn by ClozeLine instead of the plain stem header. */
export const stemIsInline = (item: BankItem): boolean => item.type === 'cloze' && clozeSource(item) === 'stem';
export const vignetteIsInline = (item: BankItem): boolean => item.type === 'cloze' && clozeSource(item) === 'vignette';

/** Final card of a case set: summed credit and a short reasoning-level line. */
export function CaseResultCard({ result }: { result: CaseSetResult }) {
  const { colors, type } = useTheme();
  const tone = result.percent >= 100 ? colors.success : result.percent > 0 ? colors.warning : colors.danger;
  const bg = result.percent >= 100 ? colors.successSoft : result.percent > 0 ? colors.warningSoft : colors.dangerSoft;
  const word = result.percent >= 100 ? 'Full credit' : result.percent > 0 ? 'Partial credit' : 'No credit';
  const credit = Math.round(result.score.credit * result.total * 100) / 100;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: tone, padding: space.lg, gap: space.md }}
    >
      <Text accessibilityRole="header" style={[type('headline'), { color: colors.text }]}>Case set result</Text>
      <View style={{ backgroundColor: bg, borderRadius: radius.md, padding: space.md, gap: 2 }}>
        <Text style={[type('title'), { color: tone }]}>{result.percent}%</Text>
        <Text style={[type('bodyStrong'), { color: tone }]}>{word}</Text>
        <Text style={[type('caption'), { color: colors.text }]}>
          {credit} of {result.total} items in credit · {result.score.points} points
        </Text>
      </View>
      <View style={{ gap: space.xs }}>
        {result.score.perItem.map((p, i) => (
          <Text key={i} style={[type('caption'), { color: colors.textDim }]}>
            {p.credit >= 1 ? '✓' : p.credit > 0 ? '◐' : '✗'} Item {i + 1}: {Math.round(p.credit * 100)}%
          </Text>
        ))}
      </View>
      {result.bloomText ? (
        <View style={{ gap: 2 }}>
          <Text style={[type('bodyStrong'), { color: colors.text }]}>Reasoning levels (fully correct)</Text>
          <Text style={[type('body'), { color: colors.text }]}>{result.bloomText}</Text>
        </View>
      ) : null}
    </View>
  );
}
