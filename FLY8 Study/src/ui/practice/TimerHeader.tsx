import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IconButton } from '../kitParts';
import { space, useTheme } from '../theme';
import type { PracticeSession } from '../../bank/session';
import { progressText, timerView } from './playerLogic';

/** Top bar: leave, "Question 3 of 20", soft timer with pause, flag, question map. */
export function TimerHeader({ session, now, flagged, onLeave, onPause, onResume, onFlag, onMap }: {
  session: PracticeSession;
  now: number;
  flagged: boolean;
  onLeave: () => void;
  onPause: () => void;
  onResume: () => void;
  onFlag: () => void;
  onMap: () => void;
}) {
  const { colors, type } = useTheme();
  const tv = timerView(session, now);
  const color = tv.kind === 'over' ? colors.danger : tv.low ? colors.warning : colors.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, minHeight: 56 }}>
      <IconButton icon="close" label="Leave practice" onPress={onLeave} />
      <View style={{ flex: 1 }}>
        <Text style={[type('bodyStrong'), { color: colors.text }]} numberOfLines={1}>{progressText(session)}</Text>
        <View accessible accessibilityLabel={tv.label} accessibilityLiveRegion="none" style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Ionicons name={tv.paused ? 'pause-circle' : 'time-outline'} size={14} color={color} />
          <Text style={[type('caption'), { color }]}>
            {tv.kind === 'over' ? 'Time is up' : tv.kind === 'left' ? `${tv.text} left` : tv.text}
            {tv.paused ? ' (paused)' : ''}
          </Text>
        </View>
      </View>
      <IconButton icon={tv.paused ? 'play' : 'pause'} label={tv.paused ? 'Resume timer' : 'Pause timer'} onPress={tv.paused ? onResume : onPause} />
      <IconButton icon={flagged ? 'flag' : 'flag-outline'} label={flagged ? 'Remove flag' : 'Flag this question'} onPress={onFlag} tone={flagged ? 'tinted' : 'plain'} />
      <IconButton icon="grid-outline" label="Open question map" onPress={onMap} />
    </View>
  );
}
