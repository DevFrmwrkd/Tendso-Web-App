import React from 'react';
import { StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, space } from '../../theme/v2';
import { Text } from './Text';

export interface ToggleRowProps {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Setting with an on/off switch. Ink track when on. */
export function ToggleRow({ title, subtitle, value, onValueChange, disabled, style }: ToggleRowProps) {
  return (
    <View style={[styles.row, shadow.soft, style]}>
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
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={title}
        trackColor={{ false: colors.bg2, true: colors.ink }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={colors.bg2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 68,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.card - 2,
    backgroundColor: colors.card,
  },
  text: { flex: 1, gap: 2 },
});
