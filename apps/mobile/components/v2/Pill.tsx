import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, hit, radius, space } from '../../theme/v2';
import { Text } from './Text';

export type PillTone = 'neutral' | 'ink' | 'accent';

export interface PillProps {
  label: string;
  tone?: PillTone;
  /** Filter-chip behaviour: pass onPress to make it tappable. */
  onPress?: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const tones: Record<PillTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.bg2, fg: colors.ink },
  ink: { bg: colors.ink, fg: colors.onDark },
  accent: { bg: colors.accent, fg: colors.onAccent }, // fill, ink text
};

/**
 * Filter pill (mock `.a-pill`). 16px/700 label; tappable pills get a 48pt hit
 * area through `hitSlop` while staying visually compact. A selected pill
 * switches to the accent fill (one accent per region).
 */
export function Pill({ label, tone = 'neutral', onPress, selected, accessibilityLabel, style }: PillProps) {
  const resolved = selected ? 'accent' : tone;
  const t = tones[resolved];
  const body = (
    <View style={[styles.pill, { backgroundColor: t.bg }, style]}>
      <Text variant="chip" style={{ color: t.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: hit.min - 8, // 40
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
