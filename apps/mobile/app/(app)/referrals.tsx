import React, { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { REFERRAL_BONUS } from '@tendso/shared/pricing';
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
const referralBonus = formatPeso(REFERRAL_BONUS);

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
  const { user } = useUser();
  const { account, isAuthenticated, isPreview } = useMobileAccount();
  return <ReferralDetails key={`${user?.id ?? 'signed-out'}:${account?.role ?? 'creator'}:${isPreview}`}
    actorId={user?.id} authenticated={isAuthenticated && !isPreview} />;
}

function ReferralDetails({ actorId, authenticated }: { actorId?: string; authenticated: boolean }) {
  const router = useGuardedRouter();
  const { isConnected } = useNetwork();
  const isOffline = isConnected === false;
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const copyBusy = useRef(false);
  const shareBusy = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const result = useQuery(api.creators.getByClerkId, authenticated && actorId ? { clerkId: actorId } : 'skip');
  const creator = result?.clerkId === actorId && actorId && authenticated ? result : undefined;
  const isAffiliate = creator?.role === 'affiliate';
  const eligible = !!creator && !creator.isDeleted && creator.status !== 'deleted'
    && creator.status !== 'suspended' && (!creator.role || creator.role === 'creator' || isAffiliate)
    && (!isAffiliate || creator.status === 'active');
  const code = eligible ? creator.referralCode?.trim() ?? '' : '';
  const live = useRef({ actorId, creatorId: creator?._id, code, eligible });
  live.current = { actorId, creatorId: creator?._id, code, eligible };
  const current = () => mounted.current && live.current.actorId === actorId
    && live.current.creatorId === creator?._id && live.current.code === code && live.current.eligible && !!code;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    };
  }, []);
  useEffect(() => {
    setCopied(false);
    setError('');
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
  }, [code]);

  const creatorReferrals = useQuery(
    api.referrals.getByReferrer,
    eligible && !isAffiliate ? { referrerId: creator!._id } : 'skip'
  );
  const creatorStats = useQuery(
    api.referrals.getStats,
    eligible && !isAffiliate ? { referrerId: creator!._id } : 'skip'
  );
  const portal = useQuery(api.affiliates.portal, eligible && isAffiliate && !isOffline ? {} : 'skip');
  const referralList = isAffiliate ? portal?.referrals : creatorReferrals;
  const stats = isAffiliate ? portal?.referralStats : creatorStats;

  const handleCopy = async () => {
    if (!current() || copyBusy.current || shareBusy.current) return;
    copyBusy.current = true;
    setCopying(true);
    setError('');
    try {
      await Clipboard.setStringAsync(code);
      if (!current()) return;
      setCopied(true);
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => { if (current()) setCopied(false); }, 2500);
    } catch {
      if (current()) setError('Could not copy your code. Please try again.');
    } finally {
      copyBusy.current = false;
      if (mounted.current) setCopying(false);
    }
  };

  const handleShare = async () => {
    if (!current() || copyBusy.current || shareBusy.current) return;
    shareBusy.current = true;
    setSharing(true);
    setError('');
    try {
      await Share.share({
        message: `Become a Tendso field agent!\n\nUse my code: ${code}\n\nDownload the app and enter this code when you sign up as a field agent.`,
        title: 'Join Tendso',
      });
    } catch {
      if (current()) setError('Could not open sharing. Please try again.');
    } finally {
      shareBusy.current = false;
      if (mounted.current) setSharing(false);
    }
  };

  const isLoading = authenticated && !!actorId && !isOffline
    && (result === undefined || (eligible && (referralList === undefined || stats === undefined)));

  if (isLoading) return <Loading />;
  if (!eligible) return (
    <ScreenShell title="Invite field agents" onBack={() => router.back()}>
      <Banner tone="warn" body={isOffline
        ? 'Reconnect to load your account and invitation code.'
        : 'Invitations are not available for this account.'} />
    </ScreenShell>
  );

  const qualifiedCount = (stats?.qualified ?? 0) + (stats?.paid ?? 0);
  const people: any[] = referralList ?? [];

  // Affiliate inviters earn a sales share; field-agent invites earn a one-time bonus.
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
        {
          title: `You earn ${referralBonus}`,
          subtitle: 'Once their first website is fully paid, the one-time bonus is added to your Earn balance.',
        },
      ];

  return (
    <ScreenShell
      title="Invite field agents"
      subtitle={isAffiliate ? 'They join with your code. You earn from their sales.' : `Earn ${referralBonus} when a friend’s first site is fully paid.`}
      onBack={() => router.back()}
      contentStyle={styles.content}
    >
      {isOffline ? <Banner tone="warn" icon="cloud-offline-outline" body="You're offline. Reconnect to see your list." /> : null}
      {error ? <Banner tone="danger" body={error} /> : null}

      {!isAffiliate ? <Card variant="tint" style={styles.bonusCard}>
        <Text variant="title" accessibilityRole="header">{referralBonus} per friend</Text>
        <Text tone="ink2">A one-time bonus when their first website is fully paid. It’s added to your Earn balance.</Text>
      </Card> : null}

      {/* Code card */}
      <Card variant="lg" style={styles.codeCard}>
        <View style={styles.codeHead}>
          <Text variant="label" tone="muted">
            Your code
          </Text>
          <Text variant="number" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} accessibilityLabel={`Your code is ${code || 'not ready'}`}>
            {code || '———'}
          </Text>
        </View>
        <View style={styles.buttons}>
          <Button
            title="Share"
            icon="share-social-outline"
            onPress={handleShare}
            disabled={!code || copying || sharing}
            loading={sharing}
            accessibilityLabel="Share referral code"
          />
          <Button
            title={copied ? 'Copied' : 'Copy code'}
            variant="ghost"
            icon={copied ? 'checkmark' : 'copy-outline'}
            onPress={handleCopy}
            disabled={!code || copying || sharing}
            loading={copying}
            accessibilityLabel="Copy referral code"
          />
        </View>
        {!code ? <Text variant="label" tone="muted">Your invitation code is not ready yet. Please try again later.</Text> : null}
      </Card>

      {isAffiliate && portal ? <AffiliateRecruits portal={portal} /> : null}

      {isAffiliate && people.length > 0 ? <SectionLabel>Earlier ₱1,000 referrals</SectionLabel> : null}
      {/* Earlier bonuses are not counted as new 5% recruits. */}
      {!isAffiliate || people.length > 0 ? <>
      <View style={styles.counts}>
        <Count label="Invited" value={stats ? String(stats.total) : '—'} />
        <Count label="Qualified" value={stats ? String(qualifiedCount) : '—'} />
        {isAffiliate || (stats?.totalEarned ?? 0) > 0 ? <Count label="Earned" value={stats ? formatPeso(stats.totalEarned) : '—'} /> : null}
      </View>

      {/* People */}
      <View style={styles.section}>
        <SectionLabel>{isAffiliate ? 'Earlier invitations' : 'People you invited'}</SectionLabel>
        {referralList === undefined ? (
          <Card style={styles.empty}><Text tone="ink2">Reconnect to load your invitations.</Text></Card>
        ) : people.length === 0 ? (
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
                    {!isAffiliate ? <Text variant="label" weight="medium" tone="muted">
                      {ref.status === 'qualified' || ref.status === 'paid'
                        ? 'Bonus added to your Earn balance'
                        : 'Waiting for their first fully paid site'}
                    </Text> : null}
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
        <Card style={styles.steps}>
          {steps.map((s, index) => (
            <View key={s.title} accessible accessibilityLabel={`Step ${index + 1}. ${s.title}. ${s.subtitle}`}
              style={[styles.step, index > 0 && styles.stepDivider]}>
              <View style={styles.stepNumber} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text variant="label" weight="bold" align="center">{index + 1}</Text>
              </View>
              <View style={styles.stepText}>
                <Text variant="label" weight="semibold">{s.title}</Text>
                <Text variant="label" weight="medium" tone="muted">{s.subtitle}</Text>
              </View>
            </View>
          ))}
        </Card>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.lg },
  bonusCard: { gap: space.sm },
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
  steps: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.lg },
  stepDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  stepNumber: { minWidth: 32, minHeight: 32, paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: 16,
    flexShrink: 0, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  stepText: { flex: 1, minWidth: 0, gap: space.xs },
});
