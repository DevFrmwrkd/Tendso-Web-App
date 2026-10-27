import React from 'react';
import { StyleSheet, View } from 'react-native';
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

export function EarningRow({ earning, divider = false }: { earning: WalletEarning; divider?: boolean }) {
  const title = EARNING_TITLE[earning.type ?? ''] ?? 'Earnings';
  const business = earning.businessName?.trim();
  const hasBusiness = !!business && business !== 'Unknown';
  return <View style={[styles.row, divider && styles.divider]} testID={`earning-${earning._id}`}>
    <View style={styles.icon}><Ionicons name={earning.type === 'creator_override' ? 'people-outline' : 'storefront-outline'} size={22} color={colors.ink} /></View>
    <View style={styles.rowBody}>
      <Text weight="bold">{hasBusiness ? business : title}</Text>
      <Text variant="label" tone="muted">{hasBusiness ? `${title} · ` : ''}{activityDate(activityTime(earning))}</Text>
      {earning.status === 'pending' ? <Chip label="Pending" tone="warn" /> : null}
    </View>
    <Text weight="extrabold" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.rowAmount}>+{walletPeso(earning.amount)}</Text>
  </View>;
}

export function PayoutRow({ withdrawal, divider = false }: { withdrawal: WalletWithdrawal; divider?: boolean }) {
  const status = WITHDRAWAL_STATUS[withdrawal.status] ?? { label: withdrawal.status, tone: 'muted' as ChipTone };
  const failure = withdrawal.failureReason || withdrawal.errorMessage;
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
  return <Card variant="lg" style={styles.trend}>
    <Text variant="label" tone="muted">Earned in {now.toLocaleDateString('en-PH', { month: 'long' })}</Text>
    <Text variant="display" tabular accessibilityLabel={`Earned this month, ${walletPeso(current.total)}`}>{walletPeso(current.total)}</Text>
    {maximum > 0 ? <View style={styles.chart} testID="earnings-six-month-trend">
      {months.map((month, index) => <View key={month.key} style={styles.barColumn} accessible
        accessibilityLabel={`${month.fullLabel}, ${walletPeso(month.total)} earned`}>
        <View style={styles.barWell}>
          <View testID={`earnings-bar-${month.key}`} style={[styles.bar,
            { height: maximum > 0 ? Math.max(0, month.total / maximum) * 64 : 0 }, index === 5 && month.total > 0 && styles.currentBar]} />
        </View>
        <Text variant="label" tone={index === 5 ? 'ink' : 'muted'}>{month.label}</Text>
      </View>)}
    </View> : <Text tone="muted">No earnings recorded in the last six months.</Text>}
    <Text variant="label" tone="muted">Credited earnings · pending earnings excluded</Text>
  </Card>;
}

export function WalletHistory({ earnings, withdrawals, balance, earned, withdrawn, isOffline, filter, onFilter, onBack }: {
  earnings?: WalletEarning[]; withdrawals?: WalletWithdrawal[]; balance: number | null; earned: number | null; withdrawn: number | null;
  isOffline: boolean;
  filter: HistoryFilter; onFilter: (filter: HistoryFilter) => void; onBack: () => void;
}) {
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
  return <ScreenShell title="Payout history" onBack={onBack} insetBottom={false} testID="wallet-history">
    <View style={styles.historyStack}>
      <Card style={styles.summary}>
        {([['Earned', earned], ['Cashed out', withdrawn], ['Ready', balance]] as const).map(([label, amount], index) => <View key={label} style={[styles.summaryStat, index > 0 && styles.summaryDivider]}>
          <Text weight="extrabold" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{amount === null ? '—' : walletPeso(amount)}</Text>
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
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  icon: { width: 44, height: 44, borderRadius: radius.field, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  payoutIcon: { backgroundColor: colors.ink },
  rowBody: { flex: 1, minWidth: 0, gap: space.xs },
  rowAmount: { maxWidth: '37%' },
  payoutMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  trend: { gap: space.sm },
  chart: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  barColumn: { flex: 1, alignItems: 'center', gap: space.sm, minWidth: 0 },
  barWell: { height: 64, alignSelf: 'stretch', justifyContent: 'flex-end' },
  bar: { borderRadius: 8, backgroundColor: colors.ruleStrong },
  currentBar: { backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.ink },
  historyStack: { gap: space.xl },
  summary: { flexDirection: 'row', paddingHorizontal: space.xs, paddingVertical: space.lg },
  summaryStat: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingHorizontal: space.xs },
  summaryDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.ruleStrong },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  historyMonth: { gap: space.md },
  historyCard: { paddingVertical: 0 },
});
