import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Pill, ScreenShell, SectionLabel, Text, type ChipTone } from '../v2';
import { colors, radius, space } from '../../theme/v2';

export type WalletEarning = {
  _id: string; amount: number; type?: string; status?: string; businessName?: string;
  createdAt?: number; _creationTime?: number;
};
export type WalletWithdrawal = {
  _id: string; amount: number; status: string; wiseEmail?: string; bankName?: string;
  wiseTransferId?: string; reference?: string; failureReason?: string; errorMessage?: string;
  createdAt?: number; _creationTime?: number;
};
export type HistoryFilter = 'all' | 'earned' | 'cashed-out';

const EARNING_TITLE: Record<string, string> = {
  submission_approved: 'Site earnings', referral_bonus: 'From your invites',
  creator_override: '5% team commission', lead_bonus: 'Lead bonus',
};
const WITHDRAWAL_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  pending: { label: 'Pending', tone: 'warn' }, processing: { label: 'Processing', tone: 'info' },
  completed: { label: 'Completed', tone: 'ok' }, failed: { label: 'Failed', tone: 'danger' },
};

/** Keep centavos exact: a displayed available balance must never round up. */
export function walletPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2,
  })}`;
}

export function activityTime(row: { createdAt?: number; _creationTime?: number }): number {
  for (const time of [row.createdAt, row._creationTime]) {
    if (typeof time === 'number' && Number.isFinite(time) && time > 0) return time;
  }
  return 0;
}

export function isCredited(row: WalletEarning): boolean {
  return row.status === 'available' || row.status === 'withdrawn';
}

function activityDate(time: number): string {
  return time ? new Date(time).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable';
}

function shortActivityDate(time: number): string {
  return time ? new Date(time).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : 'Date unavailable';
}

function CompactActivityRow({ testID, title, subtitle, amount, icon, darkIcon = false, status }: {
  testID: string; title: string; subtitle: string; amount: string;
  icon: React.ComponentProps<typeof Ionicons>['name']; darkIcon?: boolean; status?: { label: string; tone: ChipTone };
}) {
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const rowWidth = measuredWidth || Math.max(100, width - 60);
  const units = [...amount].reduce((sum, character) => sum + (/[.,]/.test(character) ? 0.34 : 0.7), 0);
  const moneyWidth = units * 16 * Math.max(1, fontScale);
  const badgeWidth = status ? status.label.length * 9 * Math.max(1, fontScale) + 24 : 0;
  const stacked = Math.max(moneyWidth, badgeWidth) > rowWidth * 0.4;
  const amountAndStatus = <>
    <Text variant="label" weight="extrabold" tone={darkIcon ? 'ink2' : 'ink'} tabular
      style={stacked ? styles.stackedAmount : undefined}>{amount}</Text>
    {status ? <Chip label={status.label} tone={status.tone} style={styles.previewStatus} /> : null}
  </>;
  return <View testID={testID} style={styles.compactActivity} onLayout={event => {
    const measured = event.nativeEvent.layout.width;
    if (Number.isFinite(measured) && measured > 0) setMeasuredWidth(measured);
  }}>
    <View style={styles.compactMain}>
      <View style={[styles.icon, darkIcon && styles.payoutIcon]}><Ionicons name={icon} size={22} color={darkIcon ? colors.onDark : colors.ink} /></View>
      <View style={styles.rowBody}>
        <Text variant="label" weight="bold" numberOfLines={2}>{title}</Text>
        <Text variant="label" tone="muted" numberOfLines={2}>{subtitle}</Text>
      </View>
      {!stacked ? <View style={styles.rowEnd}>{amountAndStatus}</View> : null}
    </View>
    {stacked ? <View style={styles.compactFooter}>{amountAndStatus}</View> : null}
  </View>;
}

export function EarningRow({ earning, divider = false, compact = false }: { earning: WalletEarning; divider?: boolean; compact?: boolean }) {
  const title = EARNING_TITLE[earning.type ?? ''] ?? 'Earnings';
  const business = earning.businessName?.trim();
  const hasBusiness = !!business && business !== 'Unknown';
  if (compact) return <CompactActivityRow testID={`earning-${earning._id}`} title={hasBusiness ? business : title}
    subtitle={`${hasBusiness ? `${title} · ` : ''}${shortActivityDate(activityTime(earning))}`} amount={`+${walletPeso(earning.amount)}`}
    icon={earning.type === 'creator_override' ? 'people-outline' : 'storefront-outline'}
    status={earning.status === 'pending' ? { label: 'Pending', tone: 'warn' } : undefined} />;
  return <View style={[styles.row, divider && styles.divider]} testID={`earning-${earning._id}`}>
    <View style={styles.icon}><Ionicons name={earning.type === 'creator_override' ? 'people-outline' : 'storefront-outline'} size={22} color={colors.ink} /></View>
    <View style={styles.rowBody}>
      <Text variant="label" weight="bold">{hasBusiness ? business : title}</Text>
      <Text variant="label" tone="muted">{hasBusiness ? `${title} · ` : ''}{activityDate(activityTime(earning))}</Text>
      {earning.status === 'pending' ? <Chip label="Pending" tone="warn" /> : null}
    </View>
    <Text variant="label" weight="extrabold" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.rowAmount}>+{walletPeso(earning.amount)}</Text>
  </View>;
}

export function PayoutRow({ withdrawal, divider = false, compact = false }: { withdrawal: WalletWithdrawal; divider?: boolean; compact?: boolean }) {
  const status = WITHDRAWAL_STATUS[withdrawal.status] ?? { label: withdrawal.status, tone: 'muted' as ChipTone };
  const failure = withdrawal.failureReason || withdrawal.errorMessage;
  if (compact) return <CompactActivityRow testID={`payout-${withdrawal._id}`} darkIcon icon="arrow-up-outline" status={status}
    title={withdrawal.wiseEmail ? `To Wise · ${shortActivityDate(activityTime(withdrawal))}` : withdrawal.bankName || 'Wise transfer'}
    subtitle={withdrawal.wiseEmail || shortActivityDate(activityTime(withdrawal))} amount={`−${walletPeso(withdrawal.amount)}`} />;
  return <View style={[styles.row, divider && styles.divider]} testID={`payout-${withdrawal._id}`}>
    <View style={[styles.icon, styles.payoutIcon]}><Ionicons name="arrow-up-outline" size={22} color={colors.onDark} /></View>
    <View style={styles.rowBody}>
      <Text weight="bold">{withdrawal.wiseEmail ? `Wise · ${withdrawal.wiseEmail}` : withdrawal.bankName || 'Wise transfer'}</Text>
      <Text variant="label" tone="muted">{activityDate(activityTime(withdrawal))}</Text>
      <View style={styles.payoutMeta}>
        <Chip label={status.label} tone={status.tone} />
        <Text weight="extrabold" tone="ink2" tabular>−{walletPeso(withdrawal.amount)}</Text>
      </View>
      {withdrawal.wiseTransferId ? <Text variant="label" tone="muted" selectable>Wise #{withdrawal.wiseTransferId}</Text> : null}
      {withdrawal.reference ? <Text variant="label" tone="muted" selectable>{withdrawal.reference}</Text> : null}
      {withdrawal.status === 'failed' && failure ? <Text variant="label" tone="danger">{failure}</Text> : null}
    </View>
  </View>;
}

export function EarningsTrend({ earnings }: { earnings: WalletEarning[] }) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1).getTime();
    const total = earnings.filter(row => isCredited(row) && activityTime(row) >= start.getTime() && activityTime(row) < end)
      .reduce((sum, row) => sum + row.amount, 0);
    return { key: `${start.getFullYear()}-${start.getMonth()}`, label: start.toLocaleDateString('en-PH', { month: 'short' }),
      fullLabel: start.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }), total };
  });
  const maximum = Math.max(0, ...months.map(month => month.total));
  const current = months[5];
  return <Card style={styles.trend}>
    <View style={styles.trendHeader}>
      <Text variant="label" tone="muted">Earned in {now.toLocaleDateString('en-PH', { month: 'long' })}</Text>
      <Text variant="heading" tabular accessibilityLabel={`Earned this month, ${walletPeso(current.total)}`}
        accessibilityHint="Includes credited available and withdrawn earnings. Pending earnings are excluded." style={styles.trendAmount}>{walletPeso(current.total)}</Text>
    </View>
    {maximum > 0 ? <View style={styles.chart} testID="earnings-six-month-trend">
      {months.map((month, index) => <View key={month.key} style={styles.barColumn} accessible
        accessibilityLabel={`${month.fullLabel}, ${walletPeso(month.total)} earned`}>
        <View style={styles.barWell}>
          <View testID={`earnings-bar-${month.key}`} style={[styles.bar,
            { height: maximum > 0 ? Math.max(0, month.total / maximum) * 36 : 0 }, index === 5 && month.total > 0 && styles.currentBar]} />
        </View>
        <Text variant="label" tone={index === 5 ? 'ink' : 'muted'}>{month.label}</Text>
      </View>)}
    </View> : <Text tone="muted">No earnings recorded in the last six months.</Text>}
  </Card>;
}

export function WalletHistory({ earnings, withdrawals, balance, earned, withdrawn, isOffline, filter, onFilter, onBack }: {
  earnings?: WalletEarning[]; withdrawals?: WalletWithdrawal[]; balance: number | null; earned: number | null; withdrawn: number | null;
  isOffline: boolean;
  filter: HistoryFilter; onFilter: (filter: HistoryFilter) => void; onBack: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const [summaryWidth, setSummaryWidth] = useState(0);
  const summaryValues = ([['Earned', earned], ['Cashed out', withdrawn], ['Ready', balance]] as const)
    .map(([label, amount]) => ({ label, value: amount === null ? '—' : walletPeso(amount) }));
  const widestUnits = Math.max(...summaryValues.map(({ value }) => [...value]
    .reduce((sum, character) => sum + (/[.,]/.test(character) ? 0.34 : 0.7), 0)));
  const innerWidth = (summaryWidth || Math.max(100, width - 40)) - space.xs * 2;
  const columnWidth = innerWidth / 3 - space.xs * 2;
  const stackedSummary = widestUnits * 16 * Math.max(1, fontScale) > columnWidth;
  const valueWidth = stackedSummary ? innerWidth - space.xs * 2 : columnWidth;
  const summaryFontSize = Math.max(16, Math.min(17, Math.floor(valueWidth / (widestUnits * Math.max(1, fontScale)))));
  const records = [
    ...(filter !== 'cashed-out' ? (earnings ?? []).map(earning => ({ kind: 'earning' as const, row: earning, time: activityTime(earning) })) : []),
    ...(filter !== 'earned' ? (withdrawals ?? []).map(withdrawal => ({ kind: 'payout' as const, row: withdrawal, time: activityTime(withdrawal) })) : []),
  ].sort((a, b) => b.time - a.time || a.row._id.localeCompare(b.row._id));
  const groups = new Map<string, typeof records>();
  for (const record of records) {
    const month = record.time ? new Date(record.time).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }) : 'Earlier';
    const group = groups.get(month) ?? [];
    group.push(record); groups.set(month, group);
  }
  const loading = (filter !== 'cashed-out' && earnings === undefined) || (filter !== 'earned' && withdrawals === undefined);
  return <ScreenShell onBack={onBack} insetBottom={false} testID="wallet-history" contentStyle={styles.historyContent}
    headerRight={<View pointerEvents="none" style={styles.historyTitle}><Text variant="label" weight="bold" accessibilityRole="header">History</Text></View>}>
    <View style={styles.historyStack}>
      <Card style={[styles.summary, stackedSummary && styles.summaryColumn]} onLayout={event => {
        const measured = event.nativeEvent.layout.width;
        if (Number.isFinite(measured) && measured > 0) setSummaryWidth(measured);
      }}>
        {summaryValues.map(({ label, value }, index) => <View key={label} style={[
          styles.summaryStat, stackedSummary && styles.summaryStatStacked,
          index > 0 && (stackedSummary ? styles.summaryStackedDivider : styles.summaryDivider),
        ]}>
          <Text weight="extrabold" tabular align="center" accessibilityLabel={`${label}, ${value}`}
            style={{ maxWidth: '100%', fontSize: summaryFontSize, lineHeight: Math.ceil(summaryFontSize * 1.4) }}>{value}</Text>
          <Text variant="label" tone="muted" align="center">{label}</Text>
        </View>)}
      </Card>
      <View style={styles.filters}>
        {([['all', 'All'], ['earned', 'Earned'], ['cashed-out', 'Cashed out']] as const).map(([key, label]) =>
          <Pill key={key} label={label} selected={filter === key} onPress={() => onFilter(key)} accessibilityLabel={`History: ${label}`} />)}
      </View>
      {loading ? <Text tone="muted">{isOffline ? 'Reconnect to load your complete history.' : 'Loading history…'}</Text> : null}
      {!loading && !records.length ? <Card><Text weight="bold">No {filter === 'earned' ? 'earnings' : filter === 'cashed-out' ? 'cash-outs' : 'activity'} yet</Text></Card> : null}
      {[...groups].map(([month, rows]) => <View key={month} style={styles.historyMonth}>
        <SectionLabel>{month}</SectionLabel>
        <Card style={styles.historyCard}>{rows.map((record, index) => record.kind === 'earning'
          ? <EarningRow key={`earning-${record.row._id}`} earning={record.row} divider={index < rows.length - 1} />
          : <PayoutRow key={`payout-${record.row._id}`} withdrawal={record.row} divider={index < rows.length - 1} />)}</Card>
      </View>)}
    </View>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.lg },
  compactActivity: { paddingVertical: space.sm },
  compactMain: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  compactFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  stackedAmount: { maxWidth: '100%', flexShrink: 1 },
  previewStatus: { maxWidth: '100%' },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  icon: { width: 44, height: 44, borderRadius: radius.field, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  payoutIcon: { backgroundColor: colors.ink },
  rowBody: { flex: 1, minWidth: 0, gap: space.xs },
  rowAmount: { maxWidth: '37%' },
  rowEnd: { alignItems: 'flex-end', gap: space.xs, maxWidth: '40%' },
  payoutMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  trend: { gap: space.sm, paddingVertical: space.md, paddingHorizontal: 14 },
  trendHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  trendAmount: { maxWidth: '100%', fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },
  chart: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  barColumn: { flex: 1, alignItems: 'center', gap: space.sm, minWidth: 0 },
  barWell: { height: 36, alignSelf: 'stretch', justifyContent: 'flex-end' },
  bar: { borderRadius: 8, backgroundColor: colors.ruleStrong },
  currentBar: { backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.ink },
  historyStack: { gap: space.xl },
  historyContent: { paddingHorizontal: 20, paddingTop: space.lg },
  historyTitle: { position: 'absolute', left: 80, right: 80, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', paddingHorizontal: space.xs, paddingVertical: space.lg },
  summaryColumn: { flexDirection: 'column', gap: space.md },
  summaryStat: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingHorizontal: space.xs },
  summaryStatStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  summaryDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.ruleStrong },
  summaryStackedDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.ruleStrong, paddingTop: space.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  historyMonth: { gap: space.md },
  historyCard: { paddingVertical: 0 },
});
