import React from 'react';
import { Text, View } from 'react-native';
import { Card, Divider, Header, ListRow, Screen, type IconName } from './kit';
import { space, useTheme } from './theme';

export type MoreId = 'library' | 'map' | 'tutor' | 'prompts' | 'settings';

export const MORE_ITEMS: { id: MoreId; title: string; detail: string; icon: IconName; soon?: boolean }[] = [
  { id: 'library', title: 'Library', detail: 'Your notes, imports and sources', icon: 'library-outline' },
  { id: 'map', title: 'Mind map', detail: 'See how your topics connect', icon: 'git-network-outline' },
  { id: 'tutor', title: 'Tutor', detail: 'Ask questions about your notes', icon: 'chatbubbles-outline' },
  { id: 'prompts', title: 'Prompt Maker', detail: 'Make your own questions and save them to your bank', icon: 'sparkles-outline' },
  { id: 'settings', title: 'Settings', detail: 'AI mode, backup and data', icon: 'settings-outline' },
];

/** The "More" tab: a clean list that opens the secondary screens. */
export function More({ open }: { open: (id: MoreId) => void }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="More" />
      <Screen>
        <Card>
          <View>
            {MORE_ITEMS.map((it, n) => (
              <View key={it.id}>
                {n > 0 ? <Divider /> : null}
                <ListRow
                  icon={it.icon}
                  title={it.title}
                  detail={it.detail}
                  badge={it.soon ? 'Coming soon' : undefined}
                  disabled={it.soon}
                  onPress={it.soon ? undefined : () => open(it.id)}
                />
              </View>
            ))}
          </View>
        </Card>
        <Text style={[type('caption'), { color: colors.textDim, textAlign: 'center', paddingHorizontal: space.lg }]}>
          AI replies can be wrong. Check facts against your textbook.
        </Text>
      </Screen>
    </View>
  );
}
