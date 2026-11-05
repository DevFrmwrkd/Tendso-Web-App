import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space } from '../../theme/v2';
import { Text } from './Text';

export type ChipTone = 'ok' | 'info' | 'warn' | 'danger' | 'muted';

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  style?: StyleProp<ViewStyle>;
}

const tones: Record<ChipTone, { bg: string; fg: string }> = {
  ok: { bg: colors.accentSoft, fg: colors.ink },
  info: { bg: colors.infoBg, fg: colors.info },
  warn: { bg: colors.warnBg, fg: colors.warn },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  muted: { bg: colors.bg2, fg: colors.ink3Text },
};

/** Status chip (mock `.a-chip`). Read-only; 16px so it never drops under the floor. */
export function Chip({ label, tone = 'muted', style }: ChipProps) {
  const t = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }, style]} accessible accessibilityRole="text" accessibilityLabel={label}>
      <Text variant="chip" style={{ color: t.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
  },
});
