import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { Redirect } from 'expo-router';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { GuardedLink } from '../../../components/GuardedLink';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { UnlockPricingBar } from '../../../components/UnlockPricingBar';
import { colors, fonts, radius, space } from '../../../theme/tokens';
import { Display, Body, Label, Door, Rule, Card, Avatar } from '../../../components/ui/primitives';
import { openExternalUrl } from '../../../services/links';

function generateReferralCode(firstName: string, lastName: string): string {
  const namePrefix = ((firstName || 'U').substring(0, 2) + (lastName || 'U').substring(0, 1)).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${namePrefix}${random}`;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  === 1) return 'Yesterday';
  return `${days}d ago`;
}

const NOTIFICATION_META: Record<string, { icon: any; color: string; bg: string }> = {
  submission_approved: { icon: 'checkmark-circle',      color: colors.accent,       bg: colors.accentBg },
  submission_rejected: { icon: 'close-circle',          color: colors.danger,       bg: colors.dangerBg },
  payout_sent:         { icon: 'cash-outline',          color: colors.accent,       bg: colors.accentBg },
  new_lead:            { icon: 'person-add-outline',    color: colors.business,     bg: colors.businessBg },
  website_live:        { icon: 'globe-outline',         color: '#6D28D9',           bg: '#EDE9FE' },
  submission_created:  { icon: 'add-circle-outline',    color: colors.business,     bg: colors.businessBg },
  profile_updated:     { icon: 'person-circle-outline', color: colors.warn,         bg: colors.warnBg },
  password_changed:    { icon: 'lock-closed',           color: colors.ink3,         bg: colors.paper2 },
  certification:       { icon: 'ribbon',                color: colors.accent,       bg: colors.accentBg },
  system:              { icon: 'information-circle',    color: colors.ink3,         bg: colors.paper2 },
};

function statusTone(sub: any) {
  const isIncomplete = !sub.photos || sub.photos.length === 0 || (!sub.videoStorageId && !sub.audioStorageId);
  const isDraft = sub.status === 'draft' || isIncomplete;
  if (sub.status === 'approved')  return { label: 'Verified', bg: colors.accentBg,   ink: colors.accentInk, icon: 'checkmark-circle' as const,    tintBg: colors.accentBg,   tintFg: colors.accent };
  if (sub.status === 'rejected')  return { label: 'Rejected', bg: colors.dangerBg,   ink: colors.danger,    icon: 'close-circle' as const,        tintBg: colors.dangerBg,   tintFg: colors.danger };
  if (isDraft)                    return { label: 'Draft',    bg: colors.paper2,     ink: colors.ink3,      icon: 'time-outline' as const,        tintBg: colors.paper2,     tintFg: colors.ink3 };
  if (sub.status === 'submitted') return { label: 'In Review',bg: colors.businessBg, ink: colors.business,  icon: 'hourglass-outline' as const,   tintBg: colors.businessBg, tintFg: colors.business };
  // Later lifecycle statuses. Home used to fall through to "Pending" here, so a
  // paid submission read "Pending" on Home but "Paid" under View All (the
  // submissions list already handles these). Keep the two in sync.
  if (sub.status === 'website_generated') return { label: 'Website Ready', bg: colors.businessBg, ink: colors.business,  icon: 'globe-outline' as const,     tintBg: colors.businessBg, tintFg: colors.business };
  if (sub.status === 'deployed')          return { label: 'Deployed',      bg: colors.accentBg,   ink: colors.accentInk, icon: 'globe-outline' as const,     tintBg: colors.accentBg,   tintFg: colors.accent };
  if (sub.status === 'paid' || sub.status === 'completed') return { label: 'Paid', bg: colors.accentBg, ink: colors.accentInk, icon: 'cash-outline' as const, tintBg: colors.accentBg, tintFg: colors.accent };
  return { label: 'Pending', bg: colors.warnBg, ink: colors.warn, icon: 'storefront-outline' as const, tintBg: colors.warnBg, tintFg: colors.warn };
}

// Dashboard-tile groupings. "Verified" is approval AND everything downstream of
// it — a paid/deployed/completed submission is still verified — so it mustn't
// drop out the moment its status advances past 'approved'. Mirrors the approved
// set in submissions.getPricingContext so the counts agree across the app.
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
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoaded, isSignedIn } = useUser();
  const { isConnected } = useNetwork();
  const createCreator = useMutation(api.creators.create);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
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

  useEffect(() => {
    const autoCreate = async () => {
      if (isLoaded && isSignedIn && user && creator === null && !isCreatingProfile) {
        setIsCreatingProfile(true);
        try {
          await createCreator({
            clerkId: user.id,
            email: user.primaryEmailAddress?.emailAddress || '',
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
            referralCode: generateReferralCode(user.firstName || '', user.lastName || ''),
          });
        } catch (err) {
          console.error('Failed to auto-create profile:', err);
        } finally {
          setIsCreatingProfile(false);
        }
      }
    };
    autoCreate();
  }, [isLoaded, isSignedIn, user, creator, isCreatingProfile, createCreator]);

  if (!isOffline && (!isLoaded || !isSignedIn || creator === undefined || isCreatingProfile)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!isOffline && !creator) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Complete-profile gate — must come BEFORE the onboarding redirects below,
  // which key off certification, not name. A social sign-up (Apple withholding
  // the name on a repeat authorization, or "Hide My Email") lands here with a
  // blank name; send them to collect it before onboarding. Once the creator has
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
    // Checked BEFORE the pending branch because a rejected creator
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <OfflineBanner />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial header */}
        <View style={{
          paddingTop: insets.top + 20,
          paddingBottom: 20,
          paddingHorizontal: 24,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Label tracking={1.8}>DASHBOARD</Label>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(app)/notifications' as any)}
              accessibilityLabel="Notifications"
              accessibilityRole="button"
              hitSlop={8}
            >
              <View>
                <Ionicons name="notifications-outline" size={22} color={colors.ink2} />
                {(unreadCount ?? 0) > 0 && (
                  <View style={{
                    position: 'absolute', top: -3, right: -3,
                    backgroundColor: colors.danger, borderRadius: 8,
                    minWidth: 16, height: 16, paddingHorizontal: 3,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontFamily: fonts.sansBold }}>
                      {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 }}>
            {(creator as any)?.profileImage ? (
              <Image
                source={{ uri: (creator as any).profileImage }}
                style={{ width: 48, height: 48, borderRadius: 24 }}
                accessibilityLabel="Profile picture"
              />
            ) : (
              <Avatar name={firstName || 'U'} size={48} bg={colors.ink} fg={colors.paper3} />
            )}
            <View style={{ flex: 1 }}>
              <Label tracking={1.6}>WELCOME BACK</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
                <Display size="sm">Mabuhay, </Display>
                <Display size="sm" italic color={colors.accent}>
                  {firstName ? `${firstName}.` : 'creator.'}
                </Display>
              </View>
            </View>
          </View>
        </View>

        <Rule strong />

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 20 }}>
          {/* Price-tier progress — unlock higher pricing (matches the web dashboard) */}
          <UnlockPricingBar creatorId={creator?._id} />

          {/* Balance card — ink dark surface */}
          <View style={{
            backgroundColor: colors.ink,
            borderRadius: radius.lg,
            padding: 22,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18,
            shadowRadius: 18,
            elevation: 6,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontFamily: fonts.monoMed,
                  fontSize: 11,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.55)',
                }}>
                  Available balance
                </Text>
                <Text style={{
                  fontFamily: fonts.serif,
                  fontSize: 44,
                  lineHeight: 48,
                  color: colors.paper3,
                  marginTop: 6,
                  letterSpacing: -0.6,
                }}>
                  ₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{
                width: 42, height: 42, borderRadius: 21,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                backgroundColor: 'rgba(255,255,255,0.04)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="wallet" size={20} color={colors.accentSolid} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: radius.sm,
                padding: 12,
              }}>
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 9, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                  Total earned
                </Text>
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.paper3, marginTop: 4 }}>
                  ₱{totalEarnings.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: radius.sm,
                padding: 12,
              }}>
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 9, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                  Withdrawn
                </Text>
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.paper3, marginTop: 4 }}>
                  ₱{totalWithdrawn.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick stats — editorial tiles */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'Total',    value: totalSubs,    icon: 'layers-outline' as const,           tintBg: colors.businessBg, tintFg: colors.business },
              { label: 'In Review', value: pendingSubs,  icon: 'hourglass-outline' as const,        tintBg: colors.warnBg,     tintFg: colors.warn },
              { label: 'Verified', value: approvedSubs, icon: 'checkmark-circle-outline' as const, tintBg: colors.accentBg,   tintFg: colors.accent },
            ].map((stat) => (
              <Card key={stat.label} padded={false} style={{ flex: 1, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center', gap: 8 }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 17,
                  backgroundColor: stat.tintBg,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={stat.icon} size={17} color={stat.tintFg} />
                </View>
                <Display size="sm" color={colors.ink}>{String(stat.value)}</Display>
                <Label tracking={1.4}>{stat.label}</Label>
              </Card>
            ))}
          </View>

          {/* Team Leads — hero card */}
          <TouchableOpacity
            onPress={() => router.push('/(app)/leads' as any)}
            activeOpacity={0.92}
            accessibilityLabel="View team leads"
            accessibilityRole="button"
          >
            <Card padded={false} large style={{ overflow: 'hidden' }}>
              <View style={{ padding: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Label tracking={1.8}>TEAM LEADS</Label>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color={colors.ink2} />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', marginTop: 6 }}>
                  <Display size="sm">
                    {leadsData?.stats?.total ?? 0} leads,{' '}
                  </Display>
                  <Display size="sm" italic color={colors.accent}>
                    browse the feed.
                  </Display>
                </View>
                <Body size="sm" color={colors.ink2} style={{ marginTop: 6 }}>
                  See every business the team has interviewed — including yours.
                </Body>
              </View>

              {/* Mini stat strip */}
              <View style={{
                flexDirection: 'row',
                borderTopWidth: 1,
                borderTopColor: colors.rule,
                backgroundColor: colors.paper2,
              }}>
                {[
                  { label: 'Total',     value: leadsData?.stats?.total     ?? 0, color: colors.ink },
                  { label: 'Hot',       value: (leadsData?.leads ?? []).filter((l: any) => l.isHot).length, color: colors.danger },
                  { label: 'Yours',     value: leadsData?.stats?.mine      ?? 0, color: colors.business },
                  { label: 'Converted', value: leadsData?.stats?.converted ?? 0, color: colors.accent },
                ].map((stat, idx) => (
                  <View
                    key={stat.label}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      alignItems: 'center',
                      borderRightWidth: idx < 3 ? 1 : 0,
                      borderRightColor: colors.rule,
                    }}
                  >
                    <Text style={{
                      fontFamily: fonts.serif,
                      fontSize: 22,
                      lineHeight: 24,
                      color: stat.color,
                      letterSpacing: -0.3,
                    }}>
                      {stat.value}
                    </Text>
                    <Text style={{
                      fontFamily: fonts.monoMed,
                      fontSize: 9,
                      letterSpacing: 1.2,
                      color: colors.ink3,
                      textTransform: 'uppercase',
                      marginTop: 2,
                    }}>
                      {stat.label}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </TouchableOpacity>

          {/* Submissions */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <View>
                <Display size="sm">Submissions</Display>
              </View>
              <GuardedLink href="/(app)/submissions" asChild>
                <TouchableOpacity accessibilityLabel="View all submissions" accessibilityRole="button" hitSlop={8}>
                  <Body size="sm" weight="medium" color={colors.accent}>View all →</Body>
                </TouchableOpacity>
              </GuardedLink>
            </View>

            {recentSubmissions.length === 0 ? (
              <Card large style={{ padding: 28, alignItems: 'center' }}>
                <View style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: colors.paper2,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="storefront-outline" size={26} color={colors.ink3} />
                </View>
                <View style={{ marginTop: 12, alignItems: 'center' }}>
                  <Display size="sm">No submissions</Display>
                  <Display size="sm" italic color={colors.accent}>yet.</Display>
                </View>
                <Body size="sm" color={colors.ink3} style={{ textAlign: 'center', marginTop: 6, maxWidth: 240 }}>
                  Tap below to list your first business and start earning.
                </Body>
                <View style={{ width: '100%', marginTop: 16 }}>
                  <Door
                    caption="START HERE"
                    label="Submit a business"
                    variant="solid"
                    onPress={() => router.push('/(app)/submit/info' as any)}
                    accessibilityLabel="Get started with first submission"
                  />
                </View>
              </Card>
            ) : (
              <View style={{ gap: 10 }}>
                {recentSubmissions.map((sub: any) => {
                  const tone = statusTone(sub);
                  return (
                    <GuardedLink key={sub._id} href={`/(app)/submissions/${sub._id}`} asChild>
                      <TouchableOpacity
                        accessibilityLabel={`Submission: ${sub.businessName}, status: ${tone.label}`}
                        accessibilityRole="button"
                      >
                        <Card padded={false} style={{
                          padding: 14,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                            <View style={{
                              width: 44, height: 44, borderRadius: radius.sm,
                              backgroundColor: tone.tintBg,
                              alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Ionicons name={tone.icon} size={21} color={tone.tintFg} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Body size="md" weight="bold" color={colors.ink} numberOfLines={1}>
                                {sub.businessName}
                              </Body>
                              <Body size="xs" color={colors.ink3} style={{ marginTop: 2 }}>
                                {new Date(sub._creationTime).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </Body>
                              {WEBSITE_READY_STATUSES.includes(sub.status) && sub.websiteUrl && (
                                <TouchableOpacity
                                  onPress={() => void openExternalUrl(sub.websiteUrl)}
                                  hitSlop={6}
                                  accessibilityRole="link"
                                  accessibilityLabel={`View ${sub.businessName} website`}
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}
                                >
                                  <Ionicons name="globe-outline" size={13} color="#8b5cf6" />
                                  <Body size="xs" weight="medium" color="#7e22ce">View website</Body>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                          <View style={{
                            paddingHorizontal: 10, paddingVertical: 4,
                            borderRadius: radius.pill,
                            backgroundColor: tone.bg,
                          }}>
                            <Text style={{
                              fontFamily: fonts.monoMed,
                              fontSize: 10,
                              letterSpacing: 1.0,
                              textTransform: 'uppercase',
                              color: tone.ink,
                            }}>
                              {tone.label}
                            </Text>
                          </View>
                        </Card>
                      </TouchableOpacity>
                    </GuardedLink>
                  );
                })}
              </View>
            )}
          </View>

          {/* Recent activity */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <View>
                <Display size="sm">Recent activity</Display>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(app)/notifications' as any)}
                accessibilityLabel="See all activity"
                accessibilityRole="button"
                hitSlop={8}
              >
                <Body size="sm" weight="medium" color={colors.accent}>See all →</Body>
              </TouchableOpacity>
            </View>

            {!isOffline && notifications === undefined ? (
              <Card large style={{ padding: 24, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={colors.accent} />
              </Card>
            ) : recentActivity.length === 0 ? (
              <Card large style={{ padding: 24, alignItems: 'center' }}>
                <View style={{
                  width: 50, height: 50, borderRadius: 25,
                  backgroundColor: colors.paper2,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="pulse-outline" size={22} color={colors.ink3} />
                </View>
                <View style={{ marginTop: 10, alignItems: 'center' }}>
                  <Display size="sm">Nothing</Display>
                  <Display size="sm" italic color={colors.accent}>yet.</Display>
                </View>
                <Body size="sm" color={colors.ink3} style={{ textAlign: 'center', marginTop: 6 }}>
                  Your recent actions and updates{'\n'}will appear here.
                </Body>
              </Card>
            ) : (
              <Card padded={false} large style={{ overflow: 'hidden' }}>
                {recentActivity.map((notif: any, idx: number) => {
                  const meta = NOTIFICATION_META[notif.type] ?? { icon: 'notifications-outline', color: colors.ink3, bg: colors.paper2 };
                  const isLast = idx === recentActivity.length - 1;
                  return (
                    <View key={notif._id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                        <View style={{
                          width: 40, height: 40, borderRadius: 20,
                          backgroundColor: meta.bg,
                          alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Body size="sm" weight="bold" color={colors.ink} numberOfLines={1}>
                            {notif.title}
                          </Body>
                          <Body size="xs" color={colors.ink3} style={{ marginTop: 1 }} numberOfLines={2}>
                            {notif.body}
                          </Body>
                        </View>
                        <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                          <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink3 }}>
                            {timeAgo(notif._creationTime ?? notif.createdAt)}
                          </Text>
                          {!notif.read && (
                            <View style={{
                              width: 6, height: 6, borderRadius: 3,
                              backgroundColor: colors.accent, marginTop: 4,
                            }} />
                          )}
                        </View>
                      </View>
                      {!isLast && <Rule style={{ marginHorizontal: 14 }} />}
                    </View>
                  );
                })}
              </Card>
            )}
          </View>

          {/* Bottom brand mark — Google Sans Flex wordmark */}
          <View style={{ marginTop: space.md, alignItems: 'center', opacity: 0.5 }}>
            <Body size="xs" color={colors.ink3} style={{ fontFamily: fonts.wordmarkMed, letterSpacing: 2.4, textTransform: 'uppercase' }}>
              Tendso
            </Body>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
