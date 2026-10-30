import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, hit, radius, space } from '../../theme/v2';
import { Text } from './Text';
import { PressFeedback } from './PressFeedback';

export interface ListRowProps {
  title: string;
  /** Allow longer titles to wrap in lists such as training lessons. */
  titleNumberOfLines?: number;
  subtitle?: string;
  /** Defaults to two lines; use 0 for status copy that must wrap fully. */
  subtitleNumberOfLines?: number;
  /** Ionicons glyph shown in a tinted 48pt circle. Ignored when `leading` is passed. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Custom leading node (avatar, thumbnail). */
  leading?: React.ReactNode;
  /** Custom trailing node (Chip, price). Defaults to a chevron when tappable. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Hairline under the row (for rows stacked inside one Card). */
  divider?: boolean;
  /** Fade a subtle press highlight without moving or dimming the row's content. */
  softPress?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** One list row: leading, title (+ one line), trailing. >= 64pt tall. At most ~4 per screen. */
export function ListRow({
  title,
  titleNumberOfLines = 1,
  subtitle,
  subtitleNumberOfLines = 2,
  icon,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  divider,
  softPress = false,
  style,
}: ListRowProps) {
  const content = (
    <>
      {leading ?? (icon ? (
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={22} color={colors.ink} />
        </View>
      ) : null)}
      <View style={styles.text}>
        <Text variant="bodyLg" weight="semibold" numberOfLines={titleNumberOfLines}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" weight="medium" tone="muted" numberOfLines={subtitleNumberOfLines}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={22} color={colors.ink3} /> : null)}
    </>
  );
  const rowStyle: StyleProp<ViewStyle> = [styles.row, divider && styles.divider, style];

  if (!onPress) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}>
        {content}
      </View>
    );
  }
  if (softPress) {
    return <PressFeedback onPress={onPress} accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)} accessibilityHint={accessibilityHint} style={rowStyle} strength={0.04}>
      {content}
    </PressFeedback>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      accessibilityHint={accessibilityHint}
      cssInterop={false}
      style={({ pressed }) => [rowStyle, pressed ? { backgroundColor: colors.bg2 } : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: hit.large + 4, // 64
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg - 2,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.field,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule, borderRadius: 0 },
  iconCircle: {
    width: hit.icon,
    height: hit.icon,
    borderRadius: radius.pill,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
});
