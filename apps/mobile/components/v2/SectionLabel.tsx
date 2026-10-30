import React from 'react';
import { type StyleProp, type TextStyle } from 'react-native';
import { Text } from './Text';

export interface SectionLabelProps {
  children: string;
  align?: 'left' | 'center';
  style?: StyleProp<TextStyle>;
}

/** Small section heading (mock `.a-sec`): 16/700 muted. Replaces the old mono uppercase labels. */
export function SectionLabel({ children, align = 'left', style }: SectionLabelProps) {
  return (
    <Text variant="label" weight="bold" tone="muted" align={align} accessibilityRole="header" style={style}>
      {children}
    </Text>
  );
}
