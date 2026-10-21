import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../kitParts';
import { radius, space, useTheme } from '../theme';

/** "Explain simply" toggle for BankItem.rationaleSimple. Renders nothing when the item has no simple version. */
export function SimpleRationale({ text }: { text?: string }) {
  const { colors, type } = useTheme();
  const [open, setOpen] = useState(false);
  if (!text || !text.trim()) return null;
  return (
    <View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide the simple explanation' : 'Explain simply'}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        scaleTo={0.99}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
      >
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.accentText} />
        <Text style={[type('bodyStrong'), { color: colors.accentText }]}>Explain simply</Text>
      </PressableScale>
      {open ? (
        <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}>
          <Text style={[type('body'), { color: colors.text }]}>{text}</Text>
        </View>
      ) : null}
    </View>
  );
}
