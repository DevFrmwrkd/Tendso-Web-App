import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radius, shadow, space } from '../../theme/v2';

export type CardVariant = 'default' | 'lg' | 'dark' | 'tint';

export interface CardProps extends Omit<ViewProps, 'style'> {
  variant?: CardVariant;
  /** Makes the whole card a button. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** Soft white card: borderless, radius 20/24, `shadow.soft` (mock `.a-card`). */
export function Card({ variant = 'default', onPress, accessibilityLabel, style, children, ...rest }: CardProps) {
  const base: StyleProp<ViewStyle> = [
    styles.base,
    variant === 'lg' && styles.lg,
    variant === 'dark' && styles.dark,
    variant === 'tint' && styles.tint,
    variant !== 'dark' && variant !== 'tint' ? shadow.soft : null,
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [base, pressed ? { transform: [{ scale: 0.99 }] } : null]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View accessibilityLabel={accessibilityLabel} {...rest} style={base}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg },
  lg: { borderRadius: radius.cardLg, padding: space.xl - 4 },
  dark: { backgroundColor: colors.ink, borderRadius: radius.cardLg },
  tint: { backgroundColor: colors.accentSoft },
});
