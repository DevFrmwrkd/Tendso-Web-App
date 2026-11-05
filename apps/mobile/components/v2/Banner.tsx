import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space } from '../../theme/v2';
import { Text } from './Text';

export type BannerTone = 'neutral' | 'ok' | 'info' | 'warn' | 'danger';

export interface BannerProps {
  tone?: BannerTone;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title?: string;
  /** One short sentence. */
  body?: string;
  /** Optional node under the text (a TextLink or small button). */
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const tones: Record<BannerTone, { bg: string; fg: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  neutral: { bg: colors.bg2, fg: colors.ink, icon: 'information-circle-outline' },
  ok: { bg: colors.accentSoft, fg: colors.ink, icon: 'checkmark-circle-outline' },
  info: { bg: colors.infoBg, fg: colors.info, icon: 'information-circle-outline' },
  warn: { bg: colors.warnBg, fg: colors.warn, icon: 'alert-circle-outline' },
  danger: { bg: colors.dangerBg, fg: colors.danger, icon: 'alert-circle-outline' },
};

/** A tinted note (status, warning, offline). Replaces the old coloured banners and boxes. */
export function Banner({ tone = 'neutral', icon, title, body, action, style }: BannerProps) {
  const t = tones[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg }, style]} accessible accessibilityRole="alert" accessibilityLabel={[title, body].filter(Boolean).join('. ')}>
      <Ionicons name={icon ?? t.icon} size={24} color={t.fg} style={styles.icon} />
      <View style={styles.text}>
        {title ? (
          <Text variant="body" weight="bold" style={{ color: t.fg }}>
            {title}
          </Text>
        ) : null}
        {body ? (
          <Text variant="label" weight="medium" style={{ color: tone === 'neutral' || tone === 'ok' ? colors.ink2 : t.fg }}>
            {body}
          </Text>
        ) : null}
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.card - 2 },
  icon: { marginTop: 1 },
  text: { flex: 1, gap: space.xs },
});
