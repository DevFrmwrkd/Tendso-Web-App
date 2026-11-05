import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, hit, radius, shadow, space } from '../../theme/v2';
import { Text } from './Text';

export interface OptionRowProps {
  title: string;
  subtitle?: string;
  /** Ionicons glyph in a 44pt tinted tile. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** A letter (A, B, C, D) in the tile instead of an icon (quiz answers). */
  letter?: string;
  leading?: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** Replaces the tick (for example a chevron). */
  trailing?: React.ReactNode;
  accessibilityHint?: string;
  /** Overrides the default "title, subtitle" label (tests and screen readers). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * One answer / choice (mock `.a-opt`): white card, 2pt ink border when selected, accent tick.
 * Use for "pick one" lists (account type, quiz answers, how you heard about us).
 */
export function OptionRow({
  title,
  subtitle,
  icon,
  letter,
  leading,
  selected,
  onPress,
  disabled,
  trailing,
  accessibilityHint,
  accessibilityLabel,
  style,
}: OptionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      accessibilityHint={accessibilityHint}
      cssInterop={false}
      style={({ pressed }) => [
        styles.row,
        shadow.soft,
        selected ? styles.on : null,
        disabled ? { opacity: 0.5 } : null,
        pressed ? { transform: [{ scale: 0.99 }] } : null,
        style,
      ]}
    >
      {leading ??
        (icon || letter ? (
          <View style={[styles.tile, selected && letter ? styles.tileOn : null]}>
            {letter ? (
              <Text variant="button" tone={selected ? 'onDark' : 'ink'} weight="extrabold">
                {letter}
              </Text>
            ) : (
              <Ionicons name={icon!} size={22} color={colors.ink} />
            )}
          </View>
        ) : null)}
      <View style={styles.text}>
        <Text variant="bodyLg" weight="semibold">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" weight="medium" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (selected ? (
          <View style={styles.tick}>
            <Ionicons name="checkmark" size={16} color={colors.onAccent} />
          </View>
        ) : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md + 2,
    minHeight: hit.large + 4,
    paddingVertical: space.sm + 2,
    paddingLeft: space.sm + 2,
    paddingRight: space.lg,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  on: { borderColor: colors.ink },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.tick,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileOn: { backgroundColor: colors.ink },
  text: { flex: 1, gap: 2, paddingLeft: space.xs },
  tick: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
