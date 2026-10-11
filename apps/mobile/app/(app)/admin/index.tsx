import React from 'react';
import { useQuery } from 'convex/react';
import { useClerk } from '@clerk/clerk-expo';
import { api } from '@tendso/convex-client';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { canUseAdminTools } from '../../../components/admin/access';
import { ActionFeedback, AdminButton, AdminCard, AdminLink, AdminLoading, AdminScreen, AdminText, useAdminAction, WebAdminLink } from '../../../components/admin/AdminUI';

export default function NativeAdminOverview() {
  const session = useMobileAccount();
  const allowed = canUseAdminTools(session);
  const { signOut } = useClerk();
  const action = useAdminAction(allowed, session.account?.clerkId);
  const stats = useQuery(api.admin.getDashboardStats, allowed ? {} : 'skip');
  if (!allowed || stats === undefined) return <AdminLoading />;
  return <AdminScreen title="Overview" home>
    <AdminCard title="Today’s work"><AdminText>{stats.pendingReview} submissions need review</AdminText><AdminText>{stats.totalCreators} creators · {stats.activeCreators} active</AdminText><AdminText>{stats.totalSubmissions} total submissions</AdminText></AdminCard>
    <AdminLink label="Review submissions and creators" href="/(app)/admin/reviews" />
    <AdminLink label="Creator and affiliate accounts" href="/(app)/admin/accounts" />
    <AdminLink label="Payouts" href="/(app)/admin/payouts" />
    <AdminCard title="Advanced tools"><AdminText>Open the secure web admin for website generation, publishing, giveaway activation, leads and settings. Your web sign-in may be requested.</AdminText><WebAdminLink /></AdminCard>
    <AdminCard title="Your account">
      {session.account?.email && <AdminText>{session.account.email}</AdminText>}
      <ActionFeedback {...action} />
      <AdminButton label="Sign out" disabled={action.busy} onPress={() => action.confirm('Sign out?', 'Sign out of Tendso on this device. You can sign in again to return to admin tools.', 'Sign out', () => signOut(), 'Signed out.')} />
    </AdminCard>
  </AdminScreen>;
}
