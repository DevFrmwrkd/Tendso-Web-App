import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAction, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { canUseAdminTools } from '../../../components/admin/access';
import { ActionFeedback, AdminButton, AdminCard, AdminEmptyState, AdminLoading, AdminNotice, AdminScreen, AdminTabs, date, money, useAdminAction, WebAdminLink } from '../../../components/admin/AdminUI';
import { Avatar, Chip, Text } from '../../../components/v2';
import { colors, space } from '../../../theme/v2';

export default function NativeAdminPayouts() {
  const session = useMobileAccount();
  const allowed = canUseAdminTools(session);
  const [tab, setTab] = useState<'open' | 'all'>('open');
  const rows = useQuery(api.withdrawals.getAll, allowed ? {} : 'skip');
  const check = useAction(api.withdrawals.refreshFromWise);
  const action = useAdminAction(allowed, session.account?.clerkId);
  if (!allowed) return <AdminLoading />;
  const visible = rows?.filter(row => tab === 'all' || row.status === 'pending' || row.status === 'processing' || row.status === 'failed');
  return (
    <AdminScreen title="Payouts" subtitle="Follow withdrawal requests and check their latest Wise status." section="payouts">
      <AdminNotice>Transfers need funding in Wise. Use web admin to review funding before paying. Checking Wise reads its latest status and reconciles the ledger; it does not send another transfer.</AdminNotice>
      <AdminTabs<'open' | 'all'> items={[{ value: 'open', label: 'Needs attention' }, { value: 'all', label: 'All' }]} value={tab} onChange={setTab} />
      <ActionFeedback {...action} />
      {visible === undefined ? <AdminLoading inline /> : (
        <>
          <View style={styles.listHeader}>
            <Text variant="heading" style={styles.listTitle}>{tab === 'open' ? 'Needs attention' : 'All withdrawals'}</Text>
            <Text variant="label" tone="muted">{visible.length} {visible.length === 1 ? 'request' : 'requests'}</Text>
          </View>
          {!visible.length ? (
            <AdminEmptyState
              icon="wallet-outline"
              title={tab === 'open' ? 'Nothing needs attention' : 'No withdrawals yet'}
              body={tab === 'open' ? 'Pending, processing and failed requests will appear here.' : 'Withdrawal requests will appear here when someone requests a payout.'}
            />
          ) : visible.map(row => {
            const name = row.creatorName?.replace(/\b(undefined|null)\b/g, '').trim() || 'Unknown account';
            const status = payoutStatus(row.status);
            return (
              <AdminCard key={row._id}>
                <View style={styles.amountHeader}>
                  <Text variant="label" tone="muted">Withdrawal request</Text>
                  <Chip label={status.label} tone={status.tone} />
                </View>
                <Text variant="display" tabular selectable>{money(row.amount)}</Text>
                <Text variant="label" tone="muted">Requested {date(row.createdAt)}</Text>
                <View style={styles.recipient}>
                  <Avatar name={name} size={44} />
                  <View style={styles.recipientText}>
                    <Text variant="body" weight="bold" selectable>{name}</Text>
                    <Text variant="label" tone="muted" selectable>{row.creatorEmail || 'No account email'}</Text>
                  </View>
                </View>
                <View style={styles.details}>
                  <PayoutDetail icon="wallet-outline" label="Payout method" value={row.wiseEmail ? `Wise · ${row.wiseEmail}` : row.bankName || 'Legacy payout method'} />
                  {row.wiseTransferId ? <PayoutDetail icon="swap-horizontal-outline" label="Wise transfer" value={`#${row.wiseTransferId}`} /> : null}
                  {row.wiseDetailedState ? <PayoutDetail icon="pulse-outline" label="Latest Wise reading" value={row.wiseDetailedState.replace(/_/g, ' ')} /> : null}
                  <PayoutDetail icon="time-outline" label="Last checked" value={row.lastStatusCheckAt ? date(row.lastStatusCheckAt) : 'Not yet checked with Wise'} />
                </View>
                <Text variant="label" tone="muted">Check again after funding; an earlier reading may be stale.</Text>
                {row.failureReason ? <AdminNotice error>{row.failureReason}</AdminNotice> : null}
                {row.wiseTransferId ? (
                  <AdminButton
                    label={`Check Wise for ${money(row.amount)}`}
                    icon="refresh-outline"
                    busy={action.busy}
                    onPress={() => action.run(async () => {
                      const result = await check({ withdrawalId: row._id, adminId: session.account!.clerkId });
                      if (!result.refreshed) throw new Error(result.reason || 'Wise could not be checked yet.');
                    }, 'Wise status checked.')}
                  />
                ) : null}
                <WebAdminLink path={`/payouts?open=${encodeURIComponent(row._id)}`} label={`Open ${money(row.amount)} payout in web admin`} />
              </AdminCard>
            );
          })}
        </>
      )}
    </AdminScreen>
  );
}

function payoutStatus(status: string): { label: string; tone: React.ComponentProps<typeof Chip>['tone'] } {
  switch (status) {
    case 'pending': return { label: 'Pending', tone: 'warn' };
    case 'processing': return { label: 'Processing', tone: 'info' };
    case 'completed': return { label: 'Completed', tone: 'ok' };
    case 'failed': return { label: 'Failed', tone: 'danger' };
    case 'cancelled': return { label: 'Cancelled', tone: 'muted' };
    default: return { label: status.replace(/_/g, ' '), tone: 'muted' };
  }
}

function PayoutDetail({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={20} color={colors.ink3Text} style={styles.detailIcon} />
      <View style={styles.detailText}>
        <Text variant="label" tone="muted">{label}</Text>
        <Text variant="body" tone="ink2" selectable>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  listTitle: { flexGrow: 1 },
  amountHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  recipient: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  recipientText: { flex: 1, minWidth: 0, gap: space.xs },
  details: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule, paddingTop: space.lg, gap: space.lg },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  detailIcon: { marginTop: 1 },
  detailText: { flex: 1, minWidth: 0, gap: space.xs },
});
