import React from 'react';
import { Pressable, type StyleProp, type TextStyle } from 'react-native';
import { colors } from '../../theme/v2';
import { Text } from './Text';

export interface TextLinkProps {
  label: string;
  onPress: () => void;
  /** 'danger' for destructive text links such as "Delete my account". */
  tone?: 'ink' | 'danger' | 'muted';
  align?: 'left' | 'center' | 'right';
  accessibilityHint?: string;
  disabled?: boolean;
  style?: StyleProp<TextStyle>;
}

/** The one quiet text action on a screen. Ink, bold, underlined; hit area is at least 48pt tall. */
export function TextLink({ label, onPress, tone = 'ink', align = 'center', accessibilityHint, disabled = false, style }: TextLinkProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={{ minHeight: 48, justifyContent: 'center', alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center', opacity: disabled ? 0.5 : 1 }}
    >
      <Text
        variant="label"
        weight="bold"
        tone={tone === 'danger' ? 'danger' : tone === 'muted' ? 'muted' : 'ink'}
        style={[{ textDecorationLine: 'underline', textDecorationColor: tone === 'danger' ? colors.danger : colors.ink }, style]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
