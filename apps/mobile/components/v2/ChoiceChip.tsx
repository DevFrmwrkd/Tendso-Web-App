import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, hit, shadow, space } from '../../theme/v2';
import { Text } from './Text';

export interface ChoiceChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
}

/**
 * Wrapping answer chip (mock `.cc-chip`): 48pt tall white pill, 2pt ink border and a small
 * accent check when chosen. Put them in a `flexDirection: 'row', flexWrap: 'wrap', gap: 8` View.
 */
export function ChoiceChip({ label, selected, onPress, icon, style }: ChoiceChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      cssInterop={false}
      style={({ pressed }) => [styles.chip, shadow.soft, selected ? styles.on : null, pressed ? { opacity: 0.85 } : null, style]}
    >
      {selected ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={13} color={colors.onAccent} />
        </View>
      ) : icon ? (
        <Ionicons name={icon} size={18} color={colors.ink} />
      ) : null}
      <Text variant="label" weight={selected ? 'bold' : 'semibold'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm - 2,
    minHeight: hit.min,
    paddingHorizontal: space.lg + 2,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  on: { borderColor: colors.ink },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
});
