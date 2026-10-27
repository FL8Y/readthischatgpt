import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { filterHistory, historySummaryLine } from '../../bank/history';
import type { SessionMode } from '../../bank/session';
import { formatDuration, formatWhen, modeLabel } from '../../bank/statsData';
import type { HistoryEntry } from '../../bank/types2';
import { Chip, PressableScale } from '../kitParts';
import { radius, space, TOUCH_MIN, useTheme } from '../theme';

type Filter = 'all' | SessionMode;

/** Session list with mode filter chips. Active sessions Resume; finished ones Review. */
export function History({ entries, onResume, onReview }: {
  entries: readonly HistoryEntry[];
  onResume: (id: string) => void;
  onReview: (id: string) => void;
}) {
  const { colors, type } = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const modes = useMemo(() => [...new Set(entries.map((e) => e.mode))].sort(), [entries]);
  const shown = useMemo(() => filterHistory(entries, filter === 'all' ? {} : { mode: filter }), [entries, filter]);
  const options: Filter[] = ['all', ...modes];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl, gap: space.md }}>
        <Text style={[type('caption'), { color: colors.textDim }]}>{historySummaryLine(shown)}</Text>
        {modes.length > 1 ? (
          <View accessibilityRole="radiogroup" accessibilityLabel="Filter by mode" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {options.map((o) => {
              const on = o === filter;
              const label = o === 'all' ? 'All' : modeLabel(o);
              return (
                <PressableScale
                  key={o}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: on }}
                  onPress={() => setFilter(o)}
                  style={{
                    minHeight: TOUCH_MIN, paddingHorizontal: space.lg, borderRadius: radius.pill, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: space.xs,
                    borderWidth: 2, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface,
                  }}
                >
                  {on ? <Ionicons name="checkmark" size={16} color={colors.accentText} /> : null}
                  <Text style={[type('bodyStrong'), { color: on ? colors.accentText : colors.text }]}>{label}</Text>
                </PressableScale>
              );
            })}
          </View>
        ) : null}

        {shown.length === 0 ? (
          <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
            <Ionicons name="time-outline" size={36} color={colors.textDim} />
            <Text style={[type('bodyStrong'), { color: colors.text }]}>{entries.length ? 'No sessions in this filter' : 'No sessions yet'}</Text>
            <Text style={[type('body'), { color: colors.textDim, textAlign: 'center' }]}>
              {entries.length ? 'Pick another mode above.' : 'Finish or start a practice set and it will show up here.'}
            </Text>
          </View>
        ) : (
          shown.map((e) => {
            const active = e.status === 'active';
            const pct = Math.round(e.percent);
            const action = active ? 'Resume' : 'Review';
            return (
              <PressableScale
                key={e.id}
                accessibilityRole="button"
                accessibilityLabel={`${modeLabel(e.mode)}, ${formatWhen(e.at)}, ${active ? 'in progress' : `${pct} percent`}, ${e.answered} of ${e.total} answered. ${action}`}
                onPress={() => (active ? onResume(e.id) : onReview(e.id))}
                scaleTo={0.985}
                style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
              >
                <View style={{ width: 52, alignItems: 'center' }}>
                  {active ? (
                    <Ionicons name="play-circle" size={32} color={colors.accentText} />
                  ) : (
                    <Text style={[type('headline'), { color: pct >= 75 ? colors.success : pct >= 60 ? colors.warning : colors.danger }]}>{pct}%</Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[type('bodyStrong'), { color: colors.text }]}>{modeLabel(e.mode)}</Text>
                  <Text style={[type('caption'), { color: colors.textDim }]}>
                    {formatWhen(e.at)} · {e.answered} of {e.total} answered{e.seconds > 0 ? ` · ${formatDuration(e.seconds)}` : ''}
                  </Text>
                </View>
                <Chip text={action} tone={active ? 'accent' : 'neutral'} icon={active ? 'play' : 'eye-outline'} />
              </PressableScale>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
