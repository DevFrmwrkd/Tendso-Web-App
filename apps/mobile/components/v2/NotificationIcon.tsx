import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/v2';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type TileTone = 'accent' | 'warn' | 'danger' | 'neutral';

const META: Record<string, { icon: IconName; tone: TileTone }> = {
  submission_approved: { icon: 'checkmark-circle-outline', tone: 'accent' },
  submission_rejected: { icon: 'alert-circle-outline', tone: 'danger' },
  payout_sent: { icon: 'cash-outline', tone: 'accent' },
  new_lead: { icon: 'location-outline', tone: 'neutral' },
  website_live: { icon: 'globe-outline', tone: 'neutral' },
  submission_created: { icon: 'add-circle-outline', tone: 'neutral' },
  profile_updated: { icon: 'person-circle-outline', tone: 'neutral' },
  password_changed: { icon: 'lock-closed-outline', tone: 'neutral' },
  certification: { icon: 'ribbon-outline', tone: 'accent' },
  system: { icon: 'information-circle-outline', tone: 'neutral' },
};

const TILE: Record<TileTone, { bg: string; fg: string }> = {
  accent: { bg: colors.accent, fg: colors.onAccent },
  warn: { bg: colors.warnBg, fg: colors.warn },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  neutral: { bg: colors.bg2, fg: colors.ink },
};

/** Icon tile for a notification type (mock `.cc-ic`: 44pt, radius 14, accent only as a fill). */
export function NotificationIcon({ type }: { type: string }) {
  const meta = META[type] ?? META.system;
  const t = TILE[meta.tone];
  return (
    <View style={[styles.tile, { backgroundColor: t.bg }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Ionicons name={meta.icon} size={22} color={t.fg} />
    </View>
  );
}

/** "Just now", "12m ago", "3h ago", "Yesterday", "4d ago". */
export function timeAgo(timestamp: number | undefined | null): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  tile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
