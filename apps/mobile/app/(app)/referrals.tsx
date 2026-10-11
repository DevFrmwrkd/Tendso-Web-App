import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useNetwork } from '../../providers/NetworkProvider';
import { OfflineBanner } from '../../components/OfflineBanner';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { Display, Body, Label, Door, Card, Rule, Avatar } from '../../components/ui/primitives';

const HOW_IT_WORKS = [
  { step: '01', title: 'Share your code', desc: 'Send your referral code to fellow business owners.', icon: 'share-social-outline' as const, tintBg: colors.paper2,    tintFg: colors.ink2 },
  { step: '02', title: 'They sign up',    desc: 'They create an account and enter your referral code.', icon: 'person-add-outline' as const, tintBg: colors.businessBg, tintFg: colors.business },
  { step: '03', title: 'You both earn',   desc: 'Earn a bonus when their first submission is approved.', icon: 'cash-outline' as const,       tintBg: colors.accentBg,   tintFg: colors.accent },
];

const STATUS_META: Record<string, { label: string; bg: string; ink: string; icon: any }> = {
  pending:   { label: 'Signed up', bg: colors.businessBg, ink: colors.business,   icon: 'time-outline' },
  qualified: { label: 'Qualified', bg: colors.accentBg,   ink: colors.accentInk,  icon: 'checkmark-circle' },
  paid:      { label: 'Rewarded',  bg: colors.liveSoft,   ink: colors.live,       icon: 'gift' },
};

function timeAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 86_400_000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const router = useGuardedRouter();
  const { user } = useUser();
  const { isConnected } = useNetwork();
  const isOffline = isConnected === false;
  const [copied, setCopied] = useState(false);

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const referralList = useQuery(
    api.referrals.getByReferrer,
    creator?._id ? { referrerId: creator._id } : 'skip'
  );
  const stats = useQuery(
    api.referrals.getStats,
    creator?._id ? { referrerId: creator._id } : 'skip'
  );

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
        message: `Join Tendso and digitalize your business!\n\nUse my referral code: ${creator.referralCode}\n\nDownload the app and enter this code when signing up.`,
        title: 'Join Tendso',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const isLoading = !isOffline && (creator === undefined || referralList === undefined || stats === undefined);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const qualifiedCount = (stats?.qualified ?? 0) + (stats?.paid ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <OfflineBanner />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Editorial header */}
        <View style={{
          paddingTop: insets.top + 20,
          paddingBottom: 20,
          paddingHorizontal: 24,
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Back"
            accessibilityRole="button"
            style={{
              width: 40, height: 40, borderRadius: radius.pill,
              backgroundColor: colors.paper3, borderWidth: 1, borderColor: colors.rule,
              alignItems: 'center', justifyContent: 'center', marginBottom: 14,
            }}
          >
            <Ionicons name="arrow-back" size={18} color={colors.ink} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Label tracking={1.8}>REFERRAL</Label>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <Display size="md">Bring a </Display>
            <Display size="md" italic color={colors.accent}>friend.</Display>
          </View>
          <Body size="md" color={colors.ink2} style={{ marginTop: 10, maxWidth: 320 }}>
            Invite businesses and earn rewards together.
          </Body>
        </View>

        <Rule strong />

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 20 }}>
          {/* Referral code hero — paper magazine pull-quote */}
          <Card large style={{ padding: 22, gap: 16 }}>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Label tracking={1.8}>YOUR CODE</Label>
              <Text style={{
                fontFamily: fonts.serif,
                fontSize: 38,
                lineHeight: 44,
                color: colors.ink,
                letterSpacing: 2,
                marginTop: 4,
              }}>
                {creator?.referralCode ?? '———'}
              </Text>
              <Text style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                letterSpacing: 1.4,
                color: copied ? colors.live : colors.ink3,
                textTransform: 'uppercase',
                marginTop: 2,
              }}>
                {copied ? '✓ Copied to clipboard' : 'Tap below to copy or share'}
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              <Door
                caption="SHARE"
                label="Send your code"
                variant="solid"
                onPress={handleShare}
                accessibilityLabel="Share referral code"
                rightIcon={<Ionicons name="share-social-outline" size={18} color={colors.paper3} style={{ marginLeft: 12 }} />}
              />
              <Door
                caption="COPY"
                label={copied ? 'Copied!' : 'Copy to clipboard'}
                variant="ghost"
                onPress={handleCopy}
                accessibilityLabel="Copy referral code"
                rightIcon={
                  <Ionicons
                    name={copied ? 'checkmark' : 'copy-outline'}
                    size={18}
                    color={copied ? colors.live : colors.ink}
                    style={{ marginLeft: 12 }}
                  />
                }
              />
            </View>
          </Card>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { label: 'Referred',  value: String(stats?.total ?? 0),                                       icon: 'people-outline' as const,           tintBg: colors.businessBg, tintFg: colors.business },
              { label: 'Qualified', value: String(qualifiedCount),                                          icon: 'checkmark-circle-outline' as const, tintBg: colors.accentBg,   tintFg: colors.accent },
              { label: 'Earned',    value: `₱${(stats?.totalEarned ?? 0).toLocaleString('en-PH')}`,         icon: 'cash-outline' as const,             tintBg: colors.liveSoft,   tintFg: colors.live },
            ].map((stat) => (
              <Card key={stat.label} padded={false} style={{ flex: 1, paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', gap: 8 }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 17,
                  backgroundColor: stat.tintBg,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={stat.icon} size={16} color={stat.tintFg} />
                </View>
                <Text style={{
                  fontFamily: fonts.serif,
                  fontSize: 22,
                  lineHeight: 24,
                  color: colors.ink,
                  letterSpacing: -0.3,
                }}>
                  {stat.value}
                </Text>
                <Label tracking={1.4}>{stat.label}</Label>
              </Card>
            ))}
          </View>

          {/* Referred creators list */}
          <View>
            <View style={{ marginBottom: 12 }}>
              <Display size="sm">People you referred</Display>
            </View>

            {(referralList?.length ?? 0) === 0 ? (
              <Card large style={{ padding: 28, alignItems: 'center' }}>
                <View style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: colors.paper2,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="people-outline" size={26} color={colors.ink3} />
                </View>
                <View style={{ marginTop: 10, alignItems: 'center' }}>
                  <Display size="sm">No one</Display>
                  <Display size="sm" italic color={colors.accent}>yet.</Display>
                </View>
                <Body size="sm" color={colors.ink3} style={{ textAlign: 'center', marginTop: 6, maxWidth: 260 }}>
                  Share your code above to start earning referral rewards.
                </Body>
                <View style={{ width: '100%', marginTop: 16 }}>
                  <Door
                    label="Share your code"
                    variant="solid"
                    onPress={handleShare}
                  />
                </View>
              </Card>
            ) : (
              <Card padded={false} large style={{ overflow: 'hidden' }}>
                {(referralList ?? []).map((ref: any, idx: number) => {
                  const meta = STATUS_META[ref.status] ?? STATUS_META.pending;
                  const isLast = idx === (referralList ?? []).length - 1;
                  return (
                    <View key={ref._id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                        <Avatar name={ref.referredName || 'U'} size={40} bg={colors.paper2} fg={colors.ink2} />
                        <View style={{ flex: 1 }}>
                          <Body size="md" weight="bold" color={colors.ink} numberOfLines={1}>
                            {ref.referredName || 'Unknown'}
                          </Body>
                          <Text style={{
                            fontFamily: fonts.mono,
                            fontSize: 10,
                            letterSpacing: 1.0,
                            color: colors.ink3,
                            textTransform: 'uppercase',
                            marginTop: 2,
                          }}>
                            Joined {timeAgo(ref.createdAt ?? ref._creationTime ?? 0)}
                          </Text>
                        </View>
                        <View style={{
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                          paddingHorizontal: 10, paddingVertical: 4,
                          borderRadius: radius.pill,
                          backgroundColor: meta.bg,
                        }}>
                          <Ionicons name={meta.icon} size={11} color={meta.ink} />
                          <Text style={{
                            fontFamily: fonts.monoMed,
                            fontSize: 10,
                            letterSpacing: 1.0,
                            textTransform: 'uppercase',
                            color: meta.ink,
                          }}>
                            {meta.label}
                          </Text>
                        </View>
                      </View>
                      {!isLast && <Rule style={{ marginHorizontal: 14 }} />}
                    </View>
                  );
                })}
              </Card>
            )}
          </View>

          {/* How it works — editorial step list */}
          <Card large style={{ padding: 18 }}>
            <View style={{ marginBottom: 14 }}>
              <Display size="sm">How it works</Display>
            </View>
            <View style={{ gap: 0 }}>
              {HOW_IT_WORKS.map((item, idx) => (
                <View key={item.title}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 12 }}>
                    <View style={{ width: 36, alignItems: 'center', paddingTop: 4 }}>
                      <Text style={{
                        fontFamily: fonts.serif,
                        fontSize: 22,
                        lineHeight: 24,
                        color: colors.ink3,
                        letterSpacing: -0.4,
                      }}>
                        {item.step}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{
                          width: 32, height: 32, borderRadius: 16,
                          backgroundColor: item.tintBg,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Ionicons name={item.icon} size={16} color={item.tintFg} />
                        </View>
                        <Body size="md" weight="bold" color={colors.ink}>{item.title}</Body>
                      </View>
                      <Body size="sm" color={colors.ink2} style={{ marginTop: 6 }}>{item.desc}</Body>
                    </View>
                  </View>
                  {idx < HOW_IT_WORKS.length - 1 && <Rule />}
                </View>
              ))}
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
