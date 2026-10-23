import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, hit, radius, shadow, space, type as typeScale } from '../../theme/v2';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'dark' | 'ghost';
export type ButtonSize = 'lg' | 'md';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  /** lg = 60pt (default), md = 56pt. Nothing is smaller than 56pt. */
  size?: ButtonSize;
  /** Optional leading Ionicons glyph. Keep it rare: one thing per screen. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  /** Full width is the default (Round 2: full-width pills). */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  // Accent is a FILL with ink text — never the other way round.
  primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
  dark: { bg: colors.ink, fg: colors.onDark, border: colors.ink },
  ghost: { bg: colors.bg2, fg: colors.ink, border: colors.bg2 },
};

/**
 * Pill button (mock `.door`): centred label, 18/700, >= 56pt tall.
 * Primary = accent fill, dark = ink fill, ghost = tinted fill.
 * Keep native press-state callbacks out of NativeWind's style interop: its v4
 * wrapper drops callback styles, including this button's background and size.
 */
export function Button({
  title,
  variant = 'primary',
  size = 'lg',
  icon,
  loading = false,
  fullWidth = true,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  style,
  ...rest
}: ButtonProps) {
  const p = palette[variant];
  const isDisabled = !!disabled || loading;
  const minHeight = size === 'lg' ? hit.large : hit.primary;

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      cssInterop={false}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight,
          backgroundColor: p.bg,
          borderColor: p.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: isDisabled && !loading ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        variant !== 'ghost' && !pressed ? shadow.soft : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={22} color={p.fg} /> : null}
          <Text variant="button" style={{ color: p.fg }} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});

export const BUTTON_FONT_SIZE = typeScale.button.fontSize;
