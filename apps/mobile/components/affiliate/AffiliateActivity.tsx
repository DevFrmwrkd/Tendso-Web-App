import React, { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { Card, Chip, Text, type ChipTone } from '../v2';
import { colors, hit, radius } from '../../theme/v2';
import { activityTime, isCredited, walletPeso, type WalletEarning, type WalletWithdrawal } from '../wallet/WalletActivity';
import { AffiliateAccess, type AffiliateAccessProps } from './Screen';
import { AffiliateToolFrame } from './AffiliateToolFrame';
import { samplePortal, type AffiliatePortal } from './model';

export type AffiliateActivityRow = { kind: 'earned'; id: string; time: number; earning: WalletEarning } |
  { kind: 'out'; id: string; time: number; withdrawal: WalletWithdrawal };
type Filter = 'all' | 'earned' | 'out';

/** Pending shop payments are separate from credited ledger income. Failed payouts stay in history. */
export function affiliateActivity(portal: Pick<AffiliatePortal, 'earnings' | 'withdrawals'>): AffiliateActivityRow[] {
  const earned: AffiliateActivityRow[] = portal.earnings.filter(isCredited).map(earning => ({
    kind: 'earned', id: `earned-${earning._id}`, time: activityTime(earning), earning,
  }));
  const out: AffiliateActivityRow[] = portal.withdrawals.map(withdrawal => ({
    kind: 'out', id: `out-${withdrawal._id}`, time: activityTime(withdrawal), withdrawal,
  }));
  return [...earned, ...out].sort((a, b) => b.time - a.time || a.id.localeCompare(b.id));
}

/** Retain every digit and permit wrapping when enlarged text reaches the 16px floor. */
export function AffiliateAmount({ amount, size = 20, testID, loading = false }: { amount?: number; size?: number; testID?: string; loading?: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  const value = amount === undefined ? loading ? 'Loading…' : '—' : walletPeso(amount);
  const units = [...value].reduce((sum, char) => sum + (/[.,]/.test(char) ? 0.34 : 0.7), 0);
  const available = Math.max(90, width - 88);
  const fontSize = Math.max(16, Math.min(size, Math.floor(available / (units * Math.max(1, fontScale)))));
  return <View style={styles.amountBox}>
    <Text testID={testID} variant="number" tabular style={{ fontSize, lineHeight: Math.ceil(fontSize * 1.22), letterSpacing: -0.5 }}>{value}</Text>
  </View>;
}

const payoutStates: Record<string, { label: string; tone: ChipTone }> = {
  pending: { label: 'Pending', tone: 'warn' }, processing: { label: 'Processing', tone: 'info' },
  completed: { label: 'Completed', tone: 'ok' }, failed: { label: 'Failed', tone: 'danger' },
};
function rowDate(time: number) {
  return time ? new Date(time).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' }) : 'Date unavailable';
}

export function AffiliateLedger({ rows, detailed = false }: { rows: AffiliateActivityRow[]; detailed?: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  return <Card style={styles.ledger}>{rows.map((row, index) => {
    const payout = row.kind === 'out' ? row.withdrawal : null;
    const earning = row.kind === 'earned' ? row.earning : null;
    const isTeam = earning?.type === 'creator_override';
    const typeLabel = isTeam ? 'Agent commission' : earning?.type === 'referral_bonus' ? 'Earlier referral bonus' : 'Link sale';
    const title = payout ? 'To Wise' : earning?.businessName || typeLabel;
    const state = payout ? payoutStates[payout.status] ?? { label: payout.status, tone: 'muted' as ChipTone } : null;
    const amount = walletPeso(payout?.amount ?? earning?.amount ?? 0);
    const sign = payout ? payout.status === 'failed' ? '' : '−' : '+';
    const stacked = width < 360 || fontScale > 1.15 || amount.length > 9;
    return <View key={row.id} testID={`affiliate-activity-${row.id}`} style={[styles.row, index > 0 && styles.divider]}>
      <View style={[styles.icon, !!payout && styles.payoutIcon]}>
        <Ionicons name={payout ? payout.status === 'pending' ? 'time-outline' : 'arrow-up-outline' : isTeam ? 'people-outline' : 'storefront-outline'}
          size={22} color={payout ? colors.onDark : colors.ink} />
      </View>
      <View style={[styles.rowBody, stacked && styles.stacked]}>
        <View style={styles.description}>
          <Text weight="semibold">{title}</Text>
          <Text variant="label" tone="muted">{payout
            ? detailed ? rowDate(row.time) : `${state?.label}${payout.status === 'failed' ? ' · funds returned' : ''} · ${rowDate(row.time)}`
            : `${typeLabel} · ${rowDate(row.time)}`}</Text>
          {detailed && payout?.status === 'failed' ? <Text variant="label" tone="muted">Funds returned</Text> : null}
          {detailed && payout?.reference ? <Text variant="label" tone="muted">{payout.reference}</Text> : null}
          {detailed && payout?.status === 'failed' && (payout.failureReason || payout.errorMessage) ? <Text variant="label" tone="muted">{payout.failureReason || payout.errorMessage}</Text> : null}
        </View>
        <View style={[styles.rowValue, stacked && styles.stackedValue]}>
          <Text testID={`affiliate-activity-amount-${row.id}`} variant="bodyLg" weight="bold" tabular>{sign}{amount}</Text>
          {detailed && state ? <Chip label={state.label} tone={state.tone} style={styles.status} /> : null}
        </View>
      </View>
    </View>;
  })}</Card>;
}

export function AffiliateActivityScreen() {
  return <AffiliateAccess>{props => props.isPreview
    ? <AffiliateActivityContent {...props} portal={samplePortal} /> : <LiveActivity {...props} />}</AffiliateAccess>;
}
function LiveActivity(props: AffiliateAccessProps) {
  const portal = useQuery(api.affiliates.portal, props.isAuthenticated ? {} : 'skip');
  return <AffiliateActivityContent {...props} portal={portal} />;
}

export function AffiliateActivityContent({ account, isPreview, isOffline, portal }: AffiliateAccessProps & { portal: AffiliatePortal | undefined }) {
  const [filter, setFilter] = useState<Filter>('all');
  const rows = portal ? affiliateActivity(portal).filter(row => filter === 'all' || row.kind === filter) : [];
  const groups: { label: string; key: string; rows: AffiliateActivityRow[] }[] = [];
  rows.forEach(row => {
    const date = row.time ? new Date(row.time) : null;
    const key = date ? date.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Manila' }) : 'unknown';
    const label = date ? date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' }) : 'Date unavailable';
    const group = groups[groups.length - 1];
    if (group?.key === key) group.rows.push(row);
    else groups.push({ key, label, rows: [row] });
  });
  return <AffiliateToolFrame title="Activity" preview={isPreview} offline={isOffline} suspended={account.status !== 'active'}>
    <Card style={styles.stats}>
      {([['Earned', portal?.summary.totalEarned], ['Cashed out', portal?.summary.totalWithdrawn], ['Available', portal?.summary.balance]] as const).map(([label, amount]) =>
        <View key={label} style={styles.stat}><AffiliateAmount amount={amount} loading={!isOffline && !portal} /><Text variant="label" tone="muted">{label}</Text></View>)}
    </Card>
    <View style={styles.filters} accessibilityRole="tablist">
      {([['all', 'All'], ['earned', 'Earned'], ['out', 'Cash outs']] as const).map(([value, label]) =>
        <Pressable key={value} onPress={() => setFilter(value)} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: filter === value }}
          style={[styles.filter, filter === value && styles.selected]}><Text variant="label">{label}</Text></Pressable>)}
    </View>
    {!portal ? <Text tone="muted">{isOffline ? 'Reconnect to load your activity.' : 'Loading your activity…'}</Text> : !rows.length
      ? <Card style={styles.empty}><Text variant="heading">{filter === 'out' ? 'No cash outs yet' : filter === 'earned' ? 'No earnings yet' : 'No activity yet'}</Text>
          <Text tone="muted">{filter === 'out' ? 'Your Wise requests and their transfer status will appear here.' : 'Your credited earnings and cash-out requests will appear here.'}</Text></Card>
      : groups.map(group => <View key={group.key} style={styles.group}><Text weight="bold">{group.label}</Text><AffiliateLedger rows={group.rows} detailed /></View>)}
  </AffiliateToolFrame>;
}

const styles = StyleSheet.create({
  amountBox: { minWidth: 0, maxWidth: '100%' },
  ledger: { paddingHorizontal: 16, paddingVertical: 0 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 14, alignItems: 'flex-start' },
  divider: { borderTopWidth: 1, borderTopColor: colors.rule },
  icon: { width: 43, height: 43, borderRadius: 13, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  payoutIcon: { backgroundColor: colors.ink },
  rowBody: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stacked: { flexDirection: 'column' },
  description: { flex: 1, minWidth: 0, gap: 5 },
  rowValue: { flexShrink: 1, minWidth: 0, maxWidth: '100%', alignItems: 'flex-end', gap: 6 },
  stackedValue: { alignItems: 'flex-start' },
  status: { maxWidth: '100%' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 16 },
  stat: { flexGrow: 1, flexBasis: 80, minWidth: 0, gap: 4 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { minHeight: hit.min, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.bg2 },
  selected: { backgroundColor: colors.accent },
  empty: { gap: 12 },
  group: { gap: 12 },
});
