import React, { useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { canUseAdminTools } from '../../../components/admin/access';
import { ActionFeedback, AdminButton, AdminCard, AdminLoading, AdminNotice, AdminScreen, AdminTabs, AdminText, date, money, useAdminAction, WebAdminLink } from '../../../components/admin/AdminUI';

export default function NativeAdminPayouts() {
  const session = useMobileAccount();
  const allowed = canUseAdminTools(session);
  const [tab, setTab] = useState<'open' | 'all'>('open');
  const rows = useQuery(api.withdrawals.getAll, allowed ? {} : 'skip');
  const check = useAction(api.withdrawals.refreshFromWise);
  const action = useAdminAction(allowed, session.account?.clerkId);
  if (!allowed) return <AdminLoading />;
  const visible = rows?.filter(row => tab === 'all' || row.status === 'pending' || row.status === 'processing' || row.status === 'failed');
  return <AdminScreen title="Payouts">
    <AdminNotice>Transfers need funding in Wise. Use web admin to review funding before paying. Checking Wise reads its latest status and reconciles the ledger; it does not send another transfer.</AdminNotice>
    <AdminTabs<'open' | 'all'> items={[{ value: 'open', label: 'Needs attention' }, { value: 'all', label: 'All' }]} value={tab} onChange={setTab} />
    <ActionFeedback {...action} />
    {visible === undefined ? <AdminLoading /> : !visible.length ? <AdminText>No withdrawals here.</AdminText> : visible.map(row => <AdminCard key={row._id} title={money(row.amount)}>
      <AdminText>{row.creatorName?.replace(/\b(undefined|null)\b/g, '').trim() || 'Unknown account'}</AdminText><AdminText>{row.creatorEmail || 'No account email'}</AdminText>
      <AdminText>Ledger status: {row.status} · requested {date(row.createdAt)}</AdminText>
      <AdminText>{row.wiseEmail ? `Wise · ${row.wiseEmail}` : row.bankName || 'Legacy payout method'}</AdminText>
      {row.wiseTransferId && <AdminText>Wise transfer #{row.wiseTransferId}</AdminText>}
      {row.wiseDetailedState && <AdminText>Latest Wise reading: {row.wiseDetailedState.replace(/_/g, ' ')}</AdminText>}
      <AdminText>Last checked: {row.lastStatusCheckAt ? date(row.lastStatusCheckAt) : 'Not yet checked with Wise'}. Check again after funding; an earlier reading may be stale.</AdminText>
      {row.failureReason && <AdminNotice error>{row.failureReason}</AdminNotice>}
      {row.wiseTransferId && <AdminButton label={`Check Wise for ${money(row.amount)}`} busy={action.busy} onPress={() => action.run(async () => {
        const result = await check({ withdrawalId: row._id, adminId: session.account!.clerkId });
        if (!result.refreshed) throw new Error(result.reason || 'Wise could not be checked yet.');
      }, 'Wise status checked.')} />}
      <WebAdminLink path={`/payouts?open=${encodeURIComponent(row._id)}`} label={`Open ${money(row.amount)} payout in web admin`} />
    </AdminCard>)}
  </AdminScreen>;
}
