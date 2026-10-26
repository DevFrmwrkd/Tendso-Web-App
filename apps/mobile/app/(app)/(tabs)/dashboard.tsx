import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { openExternalUrl } from '../../../services/links';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { CreatorDashboardPreview } from '../../../components/AccountPreview';
import {
  Avatar,
  BigNumber,
  Banner,
  Card,
  Chip,
  EmptyState,
  ListRow,
  Loading,
  ScreenShell,
  SectionLabel,
  Text,
  TextLink,
  formatPeso,
  shortDate,
  submissionStatus,
} from '../../../components/v2';
import { NotificationIcon, timeAgo } from '../../../components/v2/NotificationIcon';
import { colors, hit, shadow, space } from '../../../theme/v2';

// Dashboard-tile groupings. "Verified" is approval AND everything downstream of
// it — a paid/deployed/completed submission is still verified — so it mustn't
// drop out the moment its status advances past 'approved'. Mirrors the approved
// set used elsewhere in the app so the counts agree.
const APPROVED_STATUSES = [
  'approved', 'deployed', 'pending_payment', 'paid', 'completed', 'website_generated', 'unpublished',
];
// In-review statuses. 'in_review' was missing before, so those never counted.
const IN_REVIEW_STATUSES = ['submitted', 'in_review', 'pending'];
// Statuses where the generated website is live and its URL is worth linking to
// (mirrors the submission detail screen's "View Live Website" gate).
const WEBSITE_READY_STATUSES = [
  'deployed', 'pending_payment', 'paid', 'completed', 'website_generated',
];

export default function HomeScreen() {
  const { isPreview } = useMobileAccount();
  return isPreview ? <CreatorDashboardPreview /> : <CreatorHomeScreen />;
}

function CreatorHomeScreen() {
  const router = useGuardedRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const { isConnected } = useNetwork();
  const [justCertified, setJustCertified] = useState(false);
  const certCheckDone = useRef(false);
  const isOffline = isConnected === false;

  useEffect(() => {
    if (certCheckDone.current) return;
    certCheckDone.current = true;
    AsyncStorage.getItem('ndm_just_certified').then((val) => {
      if (val === 'true') {
        setJustCertified(true);
        AsyncStorage.removeItem('ndm_just_certified');
      }
    });
  }, []);

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );
  const submissions = useQuery(
    api.submissions.getByCreatorId,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );
  const notifications = useQuery(
    api.notifications.getByCreator,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );
  const leadsData = useQuery(
    api.leads.listForMobileCRM,
    creator?._id ? { statusFilter: 'all' } : 'skip'
  );

  usePushNotifications(creator?._id);

  if (!isOffline && (!isLoaded || !isSignedIn || creator === undefined)) {
    return <Loading />;
  }

  if (!isOffline && !creator) {
    return <Loading />;
  }

  // Complete-profile gate — must come BEFORE the onboarding redirects below,
  // which key off certification, not name. A social sign-up (Apple withholding
  // the name on a repeat authorization, or "Hide My Email") lands here with a
  // blank name; send them to collect it before onboarding. Once the field agent has
  // a name this passes and the normal flow resumes.
  if (
    !isOffline &&
    creator &&
    !((creator as any).firstName ?? '').trim() &&
    !((creator as any).lastName ?? '').trim()
  ) {
    return <Redirect href={'/(app)/complete-profile' as any} />;
  }

  if (!isOffline && !justCertified && creator && !(creator as any).certifiedAt) {
    // Rejected by admin — gate to the dedicated rejection screen.
    // Checked BEFORE the pending branch because a rejected field agent
    // still has quizPassedAt set (rejection doesn't clear it).
    if ((creator as any).rejectedAt) {
      return <Redirect href={'/(app)/verification-rejected' as any} />;
    }
    if ((creator as any).quizPassedAt) {
      return <Redirect href={'/(app)/pending-review' as any} />;
    }
    return <Redirect href={'/(app)/training' as any} />;
  }

  const recentSubmissions = submissions?.slice(0, 3) || [];
  const recentActivity    = notifications?.slice(0, 5) || [];

  const totalSubs    = submissions?.length ?? 0;
  const pendingSubs  = submissions?.filter((s: any) => IN_REVIEW_STATUSES.includes(s.status)).length ?? 0;
  const approvedSubs = submissions?.filter((s: any) => APPROVED_STATUSES.includes(s.status)).length ?? 0;

  const firstName = creator?.firstName || user?.firstName || '';
  const balance = creator?.balance ?? 0;
  const totalEarnings = (creator as any)?.totalEarnings ?? 0;
  const totalWithdrawn = (creator as any)?.totalWithdrawn ?? 0;
  const unread = unreadCount ?? 0;

  const leadStats = [
    { label: 'Total', value: leadsData?.stats?.total ?? 0 },
    { label: 'Hot', value: (leadsData?.leads ?? []).filter((l: any) => l.isHot).length },
    { label: 'Yours', value: leadsData?.stats?.mine ?? 0 },
    { label: 'Live', value: leadsData?.stats?.converted ?? 0 },
  ];

  const summary = [
    { label: 'Total', value: totalSubs },
    { label: 'In review', value: pendingSubs },
    { label: 'Verified', value: approvedSubs },
  ];

  return (
    <ScreenShell insetBottom={false} contentStyle={styles.content}>
      <OfflineBanner />

      {/* Top row: avatar, greeting, bell */}
      <View style={styles.topRow}>
        <Avatar
          uri={(creator as any)?.profileImage}
          name={firstName || 'U'}
          size={48}
        />
        <Text variant="heading" numberOfLines={1} style={styles.greeting}>
          {firstName ? `Mabuhay, ${firstName}` : 'Mabuhay'}
        </Text>
        <Pressable
          onPress={() => router.push('/(app)/notifications' as any)}
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          accessibilityRole="button"
          hitSlop={4}
          style={[styles.bell, shadow.soft]}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.ink} />
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text variant="chip" tone="onDark" style={styles.badgeText}>
                {unread > 99 ? '99+' : String(unread)}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {justCertified ? (
        <Banner tone="ok" icon="ribbon-outline" title="You're certified" body="Welcome aboard. Find your first shop." />
      ) : null}

      {/* Balance */}
      <View style={styles.balance}>
        <SectionLabel>Available balance</SectionLabel>
        <BigNumber
          size="lg"
          value={formatPeso(balance)}
          label={`${formatPeso(totalEarnings)} earned · ${formatPeso(totalWithdrawn)} withdrawn`}
        />
      </View>

      {/* Shops near you: opens the leads screens (Finds / map) */}
      <Card
        variant="dark"
        onPress={() => router.push('/(app)/leads' as any)}
        accessibilityLabel="View team leads"
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroText}>
            <Text variant="title" tone="onDark">
              Shops near you
            </Text>
            <Text variant="body" tone="onDark" style={styles.heroSub}>
              Every shop the team has met, including yours.
            </Text>
          </View>
          <View style={styles.heroGo}>
            <Ionicons name="arrow-forward" size={24} color={colors.onAccent} />
          </View>
        </View>
        <View style={styles.heroStats}>
          {leadStats.map((stat) => (
            <View key={stat.label} style={styles.heroStat}>
              <Text variant="heading" tone="onDark" tabular>
                {String(stat.value)}
              </Text>
              <Text variant="label" tone="onDark" style={styles.heroStatLabel}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Submissions */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>Your sites</SectionLabel>
          <TextLink
            label="View all"
            align="right"
            onPress={() => router.push('/(app)/submissions' as any)}
            accessibilityHint="Opens all your submissions"
          />
        </View>

        <Card style={styles.summary} accessible accessibilityLabel={`${totalSubs} total, ${pendingSubs} in review, ${approvedSubs} verified`}>
          {summary.map((stat, idx) => (
            <View key={stat.label} style={[styles.summaryCell, idx > 0 ? styles.summaryDivider : null]}>
              <Text variant="display" tabular>
                {String(stat.value)}
              </Text>
              <Text variant="label" tone="muted">
                {stat.label}
              </Text>
            </View>
          ))}
        </Card>

        {recentSubmissions.length === 0 ? (
          <Card>
            <EmptyState
              icon="storefront-outline"
              title="No sites yet"
              body="Visit a shop and start earning."
              actionLabel="Submit a shop"
              onAction={() => router.push('/(app)/submit/info' as any)}
            />
          </Card>
        ) : (
          <Card style={styles.listCard}>
            {recentSubmissions.map((sub: any, idx: number) => {
              const isIncomplete = !sub.photos || sub.photos.length === 0 || (!sub.videoStorageId && !sub.audioStorageId);
              const status = submissionStatus(sub.status, isIncomplete);
              const hasSite = WEBSITE_READY_STATUSES.includes(sub.status) && !!sub.websiteUrl;
              const isLast = idx === recentSubmissions.length - 1;
              return (
                <View key={sub._id} style={[styles.subRow, !isLast ? styles.subDivider : null]}>
                  <ListRow
                    title={sub.businessName}
                    subtitle={shortDate(sub._creationTime)}
                    icon="storefront-outline"
                    trailing={<Chip label={status.label} tone={status.tone} />}
                    onPress={() => router.push(`/(app)/submissions/${sub._id}` as any)}
                    accessibilityLabel={`Submission: ${sub.businessName}, status: ${status.label}`}
                  />
                  {hasSite ? (
                    <Pressable
                      onPress={() => void openExternalUrl(sub.websiteUrl)}
                      hitSlop={6}
                      accessibilityRole="link"
                      accessibilityLabel={`View ${sub.businessName} website`}
                      style={styles.siteLink}
                    >
                      <Ionicons name="globe-outline" size={20} color={colors.ink} />
                      <Text variant="label" weight="bold" style={styles.siteLinkText}>
                        View website
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </Card>
        )}
      </View>

      {/* Recent activity */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>Recent activity</SectionLabel>
          <TextLink
            label="See all"
            align="right"
            onPress={() => router.push('/(app)/notifications' as any)}
            accessibilityHint="Opens all notifications"
          />
        </View>

        {!isOffline && notifications === undefined ? (
          <Card>
            <Loading fill={false} />
          </Card>
        ) : recentActivity.length === 0 ? (
          <Card style={styles.emptyActivity}>
            <Ionicons name="pulse-outline" size={28} color={colors.ink3} />
            <Text variant="bodyLg" tone="ink2" align="center">
              Updates will show up here.
            </Text>
          </Card>
        ) : (
          <Card style={styles.listCard}>
            {recentActivity.map((notif: any, idx: number) => (
              <ListRow
                key={notif._id}
                title={notif.title}
                subtitle={notif.body}
                leading={<NotificationIcon type={notif.type} />}
                divider={idx < recentActivity.length - 1}
                trailing={
                  <View style={styles.when}>
                    <Text variant="label" tone="muted">
                      {timeAgo(notif.sentAt ?? notif._creationTime ?? notif.createdAt)}
                    </Text>
                    {!notif.read ? <View style={styles.unreadDot} accessibilityLabel="Unread" /> : null}
                  </View>
                }
              />
            ))}
          </Card>
        )}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.xl, paddingBottom: space.xxl + 96 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  greeting: { flex: 1 },
  bell: {
    width: hit.icon,
    height: hit.icon,
    borderRadius: 999,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { lineHeight: 20 },
  balance: { gap: space.xs },
  hero: { gap: space.lg, padding: space.xl - 4 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroText: { flex: 1, gap: space.xs },
  heroSub: { opacity: 0.8 },
  heroGo: {
    width: hit.icon,
    height: hit.icon,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStats: { flexDirection: 'row', gap: space.sm },
  heroStat: { flex: 1, gap: 2 },
  heroStatLabel: { opacity: 0.7 },
  section: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summary: { flexDirection: 'row', paddingHorizontal: space.sm },
  summaryCell: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.ruleStrong },
  listCard: { paddingVertical: space.xs, paddingHorizontal: space.md },
  subRow: { paddingBottom: 0 },
  subDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  siteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: hit.min,
    marginLeft: hit.icon + space.lg - 2 + space.xs,
  },
  siteLinkText: { textDecorationLine: 'underline' },
  emptyActivity: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  when: { alignItems: 'flex-end', gap: space.xs },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
});
