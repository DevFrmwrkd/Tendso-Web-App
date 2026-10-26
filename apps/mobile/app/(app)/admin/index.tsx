import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { useClerk } from '@clerk/clerk-expo';
import { api } from '@tendso/convex-client';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { canUseAdminTools } from '../../../components/admin/access';
import { ActionFeedback, AdminButton, AdminCard, AdminLink, AdminLoading, AdminScreen, AdminText, useAdminAction, WebAdminLink } from '../../../components/admin/AdminUI';
import { Avatar } from '../../../components/v2/Avatar';
import { Text } from '../../../components/v2/Text';
import { colors, radius, shadow, space } from '../../../theme/v2';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';

export default function NativeAdminOverview() {
  const session = useMobileAccount();
  const router = useGuardedRouter();
  const allowed = canUseAdminTools(session);
  const { signOut } = useClerk();
  const action = useAdminAction(allowed, session.account?.clerkId);
  const stats = useQuery(api.admin.getDashboardStats, allowed ? {} : 'skip');
  if (!allowed || stats === undefined) return <AdminLoading />;
  return <AdminScreen title="Overview" subtitle="Reviews, people and payments." section="overview" home>
    <View style={[styles.reviewCard, shadow.soft]}>
      <View style={styles.reviewHeading}>
        <Text variant="label" tone="muted">Business submissions</Text>
        <View style={styles.reviewIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="checkmark-done-outline" size={24} color={colors.ink} />
        </View>
      </View>
      <Text variant="number" tabular>{stats.pendingReview.toLocaleString('en-PH')}</Text>
      <Text variant="bodyLg" tone="ink2">{stats.pendingReview === 1 ? 'submission waiting for review' : 'submissions waiting for review'}</Text>
      <AdminButton label="Open reviews" icon="arrow-forward-outline" onPress={() => router.push('/(app)/admin/reviews')} />
    </View>
    <View style={styles.figures}>
      <View style={[styles.figure, shadow.soft]}>
        <Text variant="title" tabular>{stats.totalSubmissions.toLocaleString('en-PH')}</Text>
        <Text variant="label" tone="muted">Total submissions</Text>
      </View>
      <View style={[styles.figure, shadow.soft]}>
        <Text variant="title" tabular>{stats.totalCreators.toLocaleString('en-PH')}</Text>
        <Text variant="label" tone="muted">Field agents</Text>
        <Text variant="label" tone="muted">{stats.activeCreators.toLocaleString('en-PH')} active</Text>
      </View>
    </View>
    <AdminCard title="Manage">
      <AdminLink label="Accounts" subtitle="Field agents and creators" icon="people-outline" href="/(app)/admin/accounts" />
      <View style={styles.rule} />
      <AdminLink label="Payouts" subtitle="Requests and Wise status" icon="wallet-outline" href="/(app)/admin/payouts" />
    </AdminCard>
    <AdminCard title="Web workspace">
      <AdminText>Publishing, website generation, giveaways, leads and settings are in web admin.</AdminText>
      <WebAdminLink />
    </AdminCard>
    <AdminCard>
      <View style={styles.identity}>
        <Avatar uri={session.account?.profileImage} name={session.account?.firstName || 'Admin'} size={48} />
        <View style={styles.identityText}>
          <Text variant="body" weight="bold">Your admin account</Text>
          {session.account?.email ? <Text variant="label" tone="muted" selectable>{session.account.email}</Text> : null}
        </View>
      </View>
      <ActionFeedback {...action} />
      <AdminButton label="Sign out" variant="ghost" icon="log-out-outline" disabled={action.busy} onPress={() => action.confirm('Sign out?', 'Sign out of Tendso on this device. You can sign in again to return to admin tools.', 'Sign out', () => signOut(), 'Signed out.')} />
    </AdminCard>
  </AdminScreen>;
}

const styles = StyleSheet.create({
  reviewCard: { padding: space.xl, gap: space.sm, borderRadius: radius.cardLg, backgroundColor: colors.card },
  reviewHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  reviewIcon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  figures: { flexDirection: 'row', alignItems: 'stretch', gap: space.md },
  figure: { flex: 1, minWidth: 0, gap: space.sm, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.card },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.rule },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  identityText: { flex: 1, minWidth: 0, gap: space.xs },
});
