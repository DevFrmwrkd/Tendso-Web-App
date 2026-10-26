import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Text } from '../v2';
import { colors, hit, radius, space } from '../../theme/v2';

export interface ProfileReviewNoticeProps {
  reason?: string | null;
  rejectedAt?: number | null;
  instruction: string;
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Shared reviewer feedback for the rejected profile and its correction form. */
export function ProfileReviewNotice({ reason, rejectedAt, instruction }: ProfileReviewNoticeProps) {
  const feedback = reason || 'Your profile needs an update. Ask the team which details to change.';
  const reviewed = rejectedAt ? `Reviewed ${timeAgo(rejectedAt)}.` : '';

  return (
    <Card
      style={styles.notice}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={['Action required.', feedback, instruction, reviewed].filter(Boolean).join(' ')}
    >
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name="alert-circle-outline" size={26} color={colors.danger} />
        </View>
        <View style={styles.headerText}>
          <Text variant="bodyLg" weight="bold">Action required</Text>
          {reviewed ? <Text variant="label" tone="ink2" weight="medium">{reviewed}</Text> : null}
        </View>
      </View>
      <Text variant="body" weight="semibold">{feedback}</Text>
      <Text variant="label" tone="ink2" weight="medium">{instruction}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  notice: {
    gap: space.md,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1, gap: space.xs },
  icon: {
    width: hit.icon,
    height: hit.icon,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
