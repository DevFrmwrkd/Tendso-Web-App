import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { colors, fonts, type as typeScale, type TypeVariant, type FontWeightKey } from '../../theme/v2';

export type V2TextTone = 'ink' | 'ink2' | 'muted' | 'onDark' | 'onAccent' | 'danger';

const toneColor: Record<V2TextTone, string> = {
  ink: colors.ink,
  ink2: colors.ink2,
  // ink3Text, not ink3: small muted text must stay readable on light surfaces.
  muted: colors.ink3Text,
  onDark: colors.onDark,
  onAccent: colors.onAccent,
  danger: colors.danger,
};

export interface V2TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: V2TextTone;
  /** Override the weight (picks the Onest file; RN cannot synthesise weights). */
  weight?: FontWeightKey;
  align?: TextStyle['textAlign'];
  /** Tabular figures for numbers that change (timers, money). */
  tabular?: boolean;
}

/**
 * Onest text with the v2 type scale. Every variant is >= 16px (Rule #1), and
 * `allowFontScaling` stays on so large-text users get larger, never smaller.
 */
export function Text({
  variant = 'body',
  tone = 'ink',
  weight,
  align,
  tabular,
  style,
  ...rest
}: V2TextProps) {
  const base = typeScale[variant];
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: weight ? fonts[weight] : base.fontFamily,
          fontSize: base.fontSize,
          lineHeight: base.lineHeight,
          letterSpacing: base.letterSpacing,
          color: toneColor[tone],
        },
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
