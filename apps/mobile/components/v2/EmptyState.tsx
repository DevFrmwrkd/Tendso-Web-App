import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space } from '../../theme/v2';
import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  title: string;
  /** One short sentence. Rule #1: keep the whole state under ~20 words. */
  body?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** The one action. Omit it if there is nothing to do. */
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Centred empty state: accent icon circle (fill, ink glyph), a title, one line, one button. */
export function EmptyState({ title, body, icon = 'sparkles-outline', actionLabel, onAction, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]} accessible={false}>
      <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name={icon} size={36} color={colors.onAccent} />
      </View>
      <Text variant="title" align="center" accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text variant="bodyLg" tone="ink2" align="center" style={styles.body}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.xxl, gap: space.md },
  icon: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  body: { maxWidth: 320 },
  action: { marginTop: space.lg, alignSelf: 'stretch' },
});
