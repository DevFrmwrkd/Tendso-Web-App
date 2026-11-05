import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/v2';
import { Text } from './Text';

export interface LoadingProps {
  /** One short line. Optional. */
  label?: string;
  /** Fill the screen with the v2 background (default). Use false inside a card or list. */
  fill?: boolean;
}

/** Centred spinner on the v2 background. */
export function Loading({ label, fill = true }: LoadingProps) {
  return (
    <View style={[fill ? styles.fill : styles.inline]} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'}>
      <ActivityIndicator size="large" color={colors.ink} />
      {label ? (
        <Text variant="label" tone="muted" style={styles.label}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  inline: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  label: { marginTop: 12 },
});
