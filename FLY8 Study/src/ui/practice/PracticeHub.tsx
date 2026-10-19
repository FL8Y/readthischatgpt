import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AREAS, type Area } from '../../bank/schema';
import { Btn, Card, ChoiceChips, Chip, Divider, H, Header, ListRow, Screen } from '../kit';
import { space, useTheme } from '../theme';
import {
  mockSummary, QUICK_COUNTS, SOURCE_LABEL, type HubStats, type ResumeDecision, type StartRequest,
} from './practiceFlow';

const NP_AREAS = AREAS.filter((a) => a !== 'GEN') as Area[];

export interface PracticeHubProps {
  stats: HubStats;
  resume: ResumeDecision;
  /** Label for the saved session, e.g. "Quick practice". */
  resumeLabel?: string;
  notice?: string;
  onStart: (req: StartRequest) => void;
  onCustom: () => void;
  onContinue: () => void;
  onDiscardSaved: () => void;
  onHistory: () => void;
  onAi: () => void;
  /** Start an adaptive exam for one NP area or all of them. */
  onAdaptive: (scope: Area | 'ALL') => void;
  onPath: () => void;
  /** One line under 'Learning path', e.g. the exam countdown. */
  pathDetail?: string;
}

/** Practice tab landing: pick how to practice. Counts are live from the bank. */
export function PracticeHub(p: PracticeHubProps) {
  const { colors, type } = useTheme();
  const { stats } = p;
  const [quick, setQuick] = useState<number>(QUICK_COUNTS[0]);
  const [mockArea, setMockArea] = useState<Area>('NP1');
  const [mockOpen, setMockOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [adaptiveOpen, setAdaptiveOpen] = useState(false);
  const [adaptiveScope, setAdaptiveScope] = useState<Area | 'ALL'>('ALL');
  const adaptiveAvailable = adaptiveScope === 'ALL'
    ? NP_AREAS.reduce((n, a) => n + (stats.byArea[a] ?? 0), 0)
    : stats.byArea[adaptiveScope] ?? 0;
  const empty = stats.total === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title="Practice"
        subtitle={`${stats.total} question${stats.total === 1 ? '' : 's'} in your bank`}
        right={<Chip icon="information-circle-outline" text={SOURCE_LABEL} />}
      />
      <Screen>
        {p.notice ? <Chip tone="warning" icon="alert-circle-outline" text={p.notice} /> : null}

        {p.resume.kind === 'resume' ? (
          <Card tone="tinted">
            <H>Continue your session</H>
            <Text style={[type('body'), { color: colors.textDim }]}>
              {p.resumeLabel ?? 'Practice'}: {p.resume.answered} of {p.resume.total} answered.
            </Text>
            <Btn label="Continue" onPress={p.onContinue} />
            <Btn label="Discard saved session" kind="ghost" onPress={p.onDiscardSaved} />
          </Card>
        ) : null}
        {p.resume.kind === 'discard' ? (
          <Chip tone="warning" icon="alert-circle-outline" text={`${p.resume.reason} It was cleared.`} />
        ) : null}

        {!stats.diagnosticTaken && !empty ? (
          <Card tone="tinted">
            <H>Start with a placement check</H>
            <Text style={[type('body'), { color: colors.textDim }]}>
              25 questions, 5 per NP area, with feedback after each. It shows where you stand. You can skip it and practice anything.
            </Text>
            <Btn label="Take the 25-question check" onPress={() => p.onStart({ kind: 'diagnostic' })} />
          </Card>
        ) : null}

        <Card>
          <H>Quick practice</H>
          <ChoiceChips options={QUICK_COUNTS} value={quick} onChange={setQuick} label="Questions in a quick practice" />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Btn label={`Quick ${quick}`} disabled={empty} onPress={() => p.onStart({ kind: 'quick', count: quick })} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn label={`Smart set ${quick}`} kind="ghost" disabled={empty} onPress={() => p.onStart({ kind: 'smart', count: quick })} />
            </View>
          </View>
          <Text style={[type('caption'), { color: colors.textDim }]}>
            Smart set mixes your weak topics, new questions and your level. It runs on this phone, no AI.
          </Text>
        </Card>

        <Card>
          <ListRow icon="options-outline" title="Custom practice" detail="Pick topics, count, timer and filters" onPress={p.onCustom} disabled={empty} />
          <Divider />
          <ListRow
            icon="trending-down-outline"
            title="Weak spots"
            detail={stats.weakAvailable ? 'Topics and strategies you miss most' : 'Answer some questions first'}
            onPress={() => p.onStart({ kind: 'weak', count: 10 })}
            disabled={!stats.weakAvailable}
          />
          <Divider />
          <ListRow
            icon="refresh-outline"
            title="Missed questions due"
            detail={stats.requeueDue ? `${stats.requeueDue} due today` : 'Nothing due today'}
            badge={stats.requeueDue ? String(stats.requeueDue) : undefined}
            onPress={() => p.onStart({ kind: 'requeue' })}
            disabled={stats.requeueDue === 0}
          />
          <Divider />
          <ListRow
            icon="ribbon-outline"
            title="Mock board"
            detail="One NP area, up to 100 questions, 120 minutes, answers at the end"
            onPress={() => setMockOpen(!mockOpen)}
            disabled={empty}
            trailing={<Chip text={mockOpen ? 'Hide' : 'Set up'} />}
          />
          {mockOpen ? (
            <View style={{ gap: space.md, paddingBottom: space.md }}>
              <ChoiceChips options={NP_AREAS} value={mockArea} onChange={setMockArea} label="Mock board area" />
              <Text style={[type('caption'), { color: colors.textDim }]}>{mockSummary(stats.byArea[mockArea] ?? 0)}. No going back to earlier questions.</Text>
              <Btn label={`Start ${mockArea} mock`} disabled={(stats.byArea[mockArea] ?? 0) === 0} onPress={() => p.onStart({ kind: 'mock', area: mockArea })} />
            </View>
          ) : null}
          <Divider />
          <ListRow
            icon="pulse-outline"
            title="Adaptive exam"
            detail="Questions follow your level. 25 to 75 questions, answers at the end"
            onPress={() => setAdaptiveOpen(!adaptiveOpen)}
            disabled={empty}
            trailing={<Chip text={adaptiveOpen ? 'Hide' : 'Set up'} />}
          />
          {adaptiveOpen ? (
            <View style={{ gap: space.md, paddingBottom: space.md }}>
              <ChoiceChips options={['ALL', ...NP_AREAS] as (Area | 'ALL')[]} value={adaptiveScope} onChange={setAdaptiveScope} label="Adaptive exam area" />
              <Text style={[type('caption'), { color: colors.textDim }]}>
                Each answer moves your level up or down and the next question is picked to match it. It ends once the estimate is steady.
                {adaptiveScope === 'ALL' ? ' All five NP areas are mixed.' : ''} A rough estimate, not a pass prediction.
              </Text>
              <Btn label="Start adaptive exam" disabled={adaptiveAvailable === 0} onPress={() => p.onAdaptive(adaptiveScope)} />
            </View>
          ) : null}
          <Divider />
          <ListRow icon="calendar-outline" title="Learning path" detail={p.pathDetail ?? 'Daily tasks and exam countdown'} onPress={p.onPath} />
          <Divider />
          <ListRow
            icon="albums-outline"
            title="Case study"
            detail="One shared case with 3 to 6 linked questions"
            onPress={() => p.onStart({ kind: 'case', sets: 1 })}
            disabled={empty}
          />
          <Divider />
          <ListRow icon="time-outline" title="History" detail="Past sessions and results" onPress={p.onHistory} />
        </Card>

        <Card>
          <ListRow
            icon="sparkles-outline"
            title="Make new questions with AI"
            detail="Optional. Needs copy-paste or an API key."
            onPress={() => setAiOpen(!aiOpen)}
            trailing={<Chip text={aiOpen ? 'Hide' : 'Show'} />}
          />
          {aiOpen ? (
            <View style={{ gap: space.sm, paddingBottom: space.sm }}>
              <Text style={[type('caption'), { color: colors.textDim }]}>
                Pop quizzes, module quizzes and the weakness loop built from your notes. Practice above never needs AI.
              </Text>
              <Btn label="Open AI question maker" kind="ghost" onPress={p.onAi} />
            </View>
          ) : null}
        </Card>

        <Text style={[type('caption'), { color: colors.textDim, textAlign: 'center' }]}>
          {SOURCE_LABEL}. Check facts against your textbook.
        </Text>
      </Screen>
    </View>
  );
}
