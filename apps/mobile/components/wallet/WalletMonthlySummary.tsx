import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../v2';
import { colors, space } from '../../theme/v2';
import { activityTime, isCredited, walletPeso, type WalletEarning } from './WalletActivity';

export function walletMonths(earnings: WalletEarning[], now: Date) {
  return Array.from({ length: 6 }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1).getTime();
    const credited = earnings.filter(row => isCredited(row) && Number.isFinite(row.amount)
      && activityTime(row) >= start.getTime() && activityTime(row) < end);
    const sites = credited.filter(row => row.type === 'submission_approved');
    const knownSites = sites.every(row => typeof row.submissionId === 'string' && !!row.submissionId.trim());
    return {
      key: `${start.getFullYear()}-${start.getMonth()}`,
      label: start.toLocaleDateString('en-PH', { month: 'short' }),
      month: start.toLocaleDateString('en-PH', { month: 'long' }),
      fullLabel: start.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
      total: credited.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100,
      siteCount: knownSites ? new Set(sites.map(row => row.submissionId)).size : null,
    };
  });
}

/** The reference's unboxed monthly earnings hero, backed entirely by ledger data. */
export function WalletMonthlySummary({ earnings, isOffline = false, onHistory, now = new Date() }: {
  earnings?: WalletEarning[]; isOffline?: boolean; onHistory?: () => void; now?: Date;
}) {
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const months = walletMonths(earnings ?? [], now);
  const current = months[5];
  const previous = months[4];
  const availableWidth = measuredWidth || Math.max(100, width - space.gutter * 2);
  const value = earnings === undefined ? '—' : walletPeso(current.total);
  const moneyUnits = [...value].reduce((sum, char) => sum + (/[.,]/.test(char) ? 0.34 : 0.7), 0);
  const fontSize = Math.max(16, Math.min(44, Math.floor((availableWidth - 8) / (Math.max(1, moneyUnits) * Math.max(1, fontScale)))));
  const maximum = Math.max(0, ...months.map(month => month.total));
  const difference = Math.round((current.total - previous.total) * 100) / 100;
  const detail = [
    current.siteCount === null ? null : `${current.siteCount} ${current.siteCount === 1 ? 'site' : 'sites'}`,
    previous.total > 0 && difference !== 0
      ? `${walletPeso(Math.abs(difference))} ${difference > 0 ? 'more' : 'less'} than ${previous.month}` : null,
  ].filter(Boolean).join(' · ');
  return <View style={styles.hero} onLayout={event => {
    const value = event.nativeEvent.layout.width;
    if (Number.isFinite(value) && value > 0) setMeasuredWidth(value);
  }}>
    <View style={styles.top}>
      <Text variant="label" weight="bold" tone="muted" style={styles.title} accessibilityRole="header">You earned in {current.month}</Text>
      {onHistory ? <Pressable accessibilityRole="button" accessibilityLabel="View all earnings and payouts" onPress={onHistory}
        cssInterop={false} style={({ pressed }) => [styles.history, pressed && styles.pressed]}>
        <View style={styles.historyIcon}><Ionicons name="time-outline" size={22} color={colors.ink} /></View>
      </Pressable> : null}
    </View>
    <Text weight="extrabold" tabular accessibilityLabel={earnings === undefined ? 'Monthly earnings unavailable' : `Earned this month, ${value}`}
      accessibilityHint="Includes credited available and withdrawn earnings. Pending earnings are excluded."
      style={[styles.amount, { fontSize, lineHeight: Math.ceil(fontSize * 1.18) }]}>{value}</Text>
    {earnings === undefined ? <Text variant="label" tone="muted">{isOffline ? 'Reconnect to load your monthly earnings.' : 'Loading earnings…'}</Text>
      : <>
        {detail ? <Text variant="label" weight="bold" tone="ink2">{detail}</Text> : null}
        {maximum > 0 ? <View style={styles.chart} testID="earnings-six-month-trend">
          {months.map((month, index) => <View key={month.key} style={styles.column} accessible accessibilityLabel={`${month.fullLabel}, ${walletPeso(month.total)} earned`}>
            <View style={styles.well}><View testID={`earnings-bar-${month.key}`} style={[styles.bar,
              { height: Math.max(0, month.total / maximum) * 56 }, index === 5 && month.total > 0 && styles.current]} /></View>
            <Text variant="label" tone={index === 5 ? 'ink' : 'muted'}>{month.label}</Text>
          </View>)}
        </View> : <Text variant="label" tone="muted">No earnings recorded in the last six months.</Text>}
      </>}
  </View>;
}

const styles = StyleSheet.create({
  hero: { gap: space.xs },
  top: { paddingRight: 56, minHeight: 24, justifyContent: 'center' },
  title: { minWidth: 0 },
  history: { position: 'absolute', right: 0, top: -12, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  historyIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  pressed: { backgroundColor: colors.bg2 },
  amount: { letterSpacing: -1.1 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.md },
  column: { flexGrow: 1, flexShrink: 0, flexBasis: 0, minWidth: 0, alignItems: 'center', gap: 6 },
  well: { width: '100%', height: 56, minHeight: 56, flexShrink: 0, justifyContent: 'flex-end' },
  bar: { width: '100%', flexShrink: 0, borderRadius: 8, backgroundColor: colors.ruleStrong },
  current: { backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.ink },
});
