import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import * as Clipboard from 'expo-clipboard';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useNetwork } from '../../providers/NetworkProvider';
import { useMobileAccount } from '../../hooks/useMobileAccount';
import { AffiliateRecruits } from '../../components/affiliate/Recruits';
import { colors, space } from '../../theme/v2';
import {
  Avatar,
  Banner,
  Button,
  Card,
  CheckRow,
  Chip,
  Loading,
  ScreenShell,
  SectionLabel,
  Text,
  formatPeso,
  type ChipTone,
} from '../../components/v2';

const STATUS_META: Record<string, { label: string; tone: ChipTone }> = {
  pending: { label: 'Signed up', tone: 'info' },
  qualified: { label: 'Qualified', tone: 'ok' },
  paid: { label: 'Rewarded', tone: 'ok' },
};

function timeAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 86_400_000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

function Count({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.count} accessible accessibilityLabel={`${label}, ${value}`}>
      <Text variant="title" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text variant="label" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

export default function ReferralsScreen() {
  const router = useGuardedRouter();
  const { user } = useUser();
  const { isConnected } = useNetwork();
  const isOffline = isConnected === false;
  const { account, isAuthenticated } = useMobileAccount();
  const isAffiliate = account?.role === 'affiliate';
  const [copied, setCopied] = useState(false);

  const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : 'skip');

  const creatorReferrals = useQuery(
    api.referrals.getByReferrer,
    creator?._id && !isAffiliate ? { referrerId: creator._id } : 'skip'
  );
  const creatorStats = useQuery(
    api.referrals.getStats,
    creator?._id && !isAffiliate ? { referrerId: creator._id } : 'skip'
  );
  const portal = useQuery(api.affiliates.portal, isAffiliate && isAuthenticated && !isOffline ? {} : 'skip');
  const referralList = isAffiliate ? portal?.referrals : creatorReferrals;
  const stats = isAffiliate ? portal?.referralStats : creatorStats;

  const handleCopy = async () => {
    if (!creator?.referralCode) return;
    await Clipboard.setStringAsync(creator.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    if (!creator?.referralCode) return;
    try {
      await Share.share({
        message: `Become a Tendso field agent!\n\nUse my code: ${creator.referralCode}\n\nDownload the app and enter this code when you sign up as a field agent.`,
        title: 'Join Tendso',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const isLoading = !isOffline && (creator === undefined || referralList === undefined || stats === undefined);

  if (isLoading) return <Loading />;

  const qualifiedCount = (stats?.qualified ?? 0) + (stats?.paid ?? 0);
  const people: any[] = referralList ?? [];

  // How it works. Creators earn a share of sales; field agents get no peso claim here.
  const steps = isAffiliate
    ? [
        { title: 'Share your code', subtitle: 'Send it to someone who visits shops.' },
        { title: 'They join with it', subtitle: 'They choose a field agent account and enter your code.' },
        {
          title: 'You earn 5% of their sales',
          subtitle: 'For 12 months, one level only, paid once the shop has paid in full.',
        },
      ]
    : [
        { title: 'Share your code', subtitle: 'Send it to someone who visits shops.' },
        { title: 'They join with it', subtitle: 'They choose a field agent account and enter your code.' },
        { title: 'They get started', subtitle: 'They complete training and build their first site.' },
      ];

  return (
    <ScreenShell
      title="Invite field agents"
      subtitle={isAffiliate ? 'They join with your code. You earn from their sales.' : 'Bring a friend to Tendso.'}
      onBack={() => router.back()}
      contentStyle={styles.content}
    >
      {isOffline ? <Banner tone="warn" icon="cloud-offline-outline" body="You're offline. Reconnect to see your list." /> : null}

      {/* Code card */}
      <Card variant="lg" style={styles.codeCard}>
        <View style={styles.codeHead}>
          <Text variant="label" tone="muted">
            Your code
          </Text>
          <Text variant="number" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} accessibilityLabel={`Your code is ${creator?.referralCode ?? 'not ready'}`}>
            {creator?.referralCode ?? '———'}
          </Text>
        </View>
        <View style={styles.buttons}>
          <Button
            title="Share"
            icon="share-social-outline"
            onPress={handleShare}
            accessibilityLabel="Share referral code"
          />
          <Button
            title={copied ? 'Copied' : 'Copy code'}
            variant="ghost"
            icon={copied ? 'checkmark' : 'copy-outline'}
            onPress={handleCopy}
            accessibilityLabel="Copy referral code"
          />
        </View>
      </Card>

      {isAffiliate && portal ? <AffiliateRecruits portal={portal} /> : null}

      {isAffiliate && people.length > 0 ? <SectionLabel>Earlier ₱1,000 referrals</SectionLabel> : null}
      {/* Earlier bonuses are not counted as new 5% recruits. */}
      {!isAffiliate || people.length > 0 ? <>
      <View style={styles.counts}>
        <Count label="Invited" value={String(stats?.total ?? 0)} />
        <Count label="Qualified" value={String(qualifiedCount)} />
        {isAffiliate || (stats?.totalEarned ?? 0) > 0 ? <Count label="Earned" value={formatPeso(stats?.totalEarned ?? 0)} /> : null}
      </View>

      {/* People */}
      <View style={styles.section}>
        <SectionLabel>{isAffiliate ? 'Earlier invitations' : 'People you invited'}</SectionLabel>
        {people.length === 0 ? (
          <Card style={styles.empty}>
            <Text variant="heading">No one yet</Text>
            <Text variant="body" tone="ink2">
              Share your code to invite your first field agent.
            </Text>
          </Card>
        ) : (
          <Card style={styles.list}>
            {people.map((ref: any, idx: number) => {
              const meta = STATUS_META[ref.status] ?? STATUS_META.pending;
              const bonus = ref.status === 'pending' && (ref.bonusAmount ?? 0) > 0 ? ref.bonusAmount : 0;
              const name = ref.referredName || 'Unknown';
              return (
                <View key={ref._id} style={[styles.person, idx < people.length - 1 ? styles.divider : null]}>
                  <Avatar name={name} size={48} />
                  <View style={styles.personText}>
                    <Text variant="bodyLg" weight="semibold" numberOfLines={1}>
                      {name}
                    </Text>
                    <Text variant="label" weight="medium" tone="muted">
                      Joined {timeAgo(ref.createdAt ?? ref._creationTime ?? 0)}
                    </Text>
                    {bonus > 0 ? (
                      <Text variant="label" weight="medium" tone="muted">
                        {formatPeso(bonus)} bonus pending
                      </Text>
                    ) : null}
                  </View>
                  <Chip label={meta.label} tone={meta.tone} />
                </View>
              );
            })}
          </Card>
        )}
      </View>
      </> : null}

      {/* How it works */}
      <View style={styles.section}>
        <SectionLabel>How it works</SectionLabel>
        <View style={styles.steps}>
          {steps.map((s) => (
            <CheckRow key={s.title} title={s.title} subtitle={s.subtitle} state="todo" />
          ))}
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.lg },
  codeCard: { gap: space.lg },
  codeHead: { gap: space.xs },
  buttons: { gap: space.sm },
  counts: { flexDirection: 'row', gap: space.sm },
  count: { flex: 1, gap: space.xs, paddingHorizontal: space.md },
  section: { gap: space.md, marginTop: space.sm },
  empty: { gap: space.xs },
  list: { paddingVertical: space.xs, paddingHorizontal: space.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.xs },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  personText: { flex: 1, minWidth: 0, gap: 2 },
  steps: { gap: space.sm },
});
