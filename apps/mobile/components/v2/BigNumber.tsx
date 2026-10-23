import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { space } from '../../theme/v2';
import { Card } from './Card';
import { Chip, type ChipTone } from './Chip';
import { Text, type V2TextTone } from './Text';

export interface BigNumberProps {
  /** Already formatted: "₱4,999", "12". Tabular figures keep it from jittering. */
  value: string;
  /** One short line under the number (>= 16px). */
  label?: string;
  size?: 'md' | 'lg';
  tone?: V2TextTone;
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
}

/** One big number and one line. Reads as a single sentence for screen readers. */
export function BigNumber({ value, label, size = 'md', tone = 'ink', align = 'left', style }: BigNumberProps) {
  return (
    <View
      accessible
      accessibilityLabel={label ? `${value}, ${label}` : value}
      style={[{ alignItems: align === 'center' ? 'center' : 'flex-start' }, style]}
    >
      <Text variant={size === 'lg' ? 'numberLg' : 'number'} tone={tone} tabular align={align} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      {label ? (
        <Text variant="body" tone="muted" align={align} style={styles.label}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export interface StatCardProps extends BigNumberProps {
  /** Optional status chip, e.g. "Live" or "In review". */
  chip?: { label: string; tone?: ChipTone };
  onPress?: () => void;
}

/** BigNumber on a soft card. */
export function StatCard({ chip, onPress, style, ...number }: StatCardProps) {
  return (
    <Card onPress={onPress} variant="lg" style={[styles.card, style]}>
      <BigNumber {...number} />
      {chip ? <Chip label={chip.label} tone={chip.tone} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: space.xs },
  card: { gap: space.md },
});
