import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  BackHandler,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { Display, Body, Label, Door, Card, Rule } from '../../components/ui/primitives';

const SUPPORT_EMAIL = 'support@negosyo-digital.com';

function timeAgo(ts: number | null | undefined): string {
  if (!ts) return '';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function VerificationRejectedScreen() {
  const router = useGuardedRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [retrying, setRetrying] = useState(false);

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );
  const requestRecertification = useMutation(api.creators.requestRecertification);

  // Block hardware back — this is a locked screen until the creator
  // either retakes the quiz or signs out.
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => true;
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [])
  );

  // If the admin reverses the rejection (or somehow approves the creator),
  // auto-route away.
  useEffect(() => {
    if (!creator) return;
    if ((creator as any).certifiedAt) {
      AsyncStorage.removeItem('ndm_just_quiz_passed');
      router.replace('/(app)/(tabs)/' as any);
    } else if (!(creator as any).rejectedAt) {
      // Rejection cleared (e.g., creator successfully called requestRecertification
      // from another device). Send them back to training.
      router.replace('/(app)/training' as any);
    }
  }, [creator, router]);

  const handleTryAgain = async () => {
    if (!creator?._id) return;
    Alert.alert(
      'Retake the quiz?',
      'This will clear your previous quiz pass and let you take the certification quiz again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retake quiz',
          style: 'default',
          onPress: async () => {
            setRetrying(true);
            try {
              await requestRecertification({ id: creator._id });
              await AsyncStorage.removeItem('ndm_just_quiz_passed');
              router.replace('/(app)/training' as any);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not start retake. Please try again.');
              setRetrying(false);
            }
          },
        },
      ]
    );
  };

  const handleContactSupport = () => {
    const firstName = (creator as any)?.firstName ?? '';
    const email = (creator as any)?.email ?? user?.primaryEmailAddress?.emailAddress ?? '';
    const subject = encodeURIComponent('Verification rejected — request for review');
    const body = encodeURIComponent(
      `Hello Tendso team,\n\n` +
      `My creator account was not approved and I'd like to ask for another review.\n\n` +
      `Name: ${firstName}\nEmail: ${email}\n\n` +
      `[ Please add anything you'd like the team to know here. ]\n`
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('Email unavailable', `Please email us at ${SUPPORT_EMAIL}`);
    });
  };

  const handleSignOut = async () => {
    try {
      await AsyncStorage.removeItem('ndm_just_quiz_passed');
      await signOut();
      router.replace('/(auth)/login' as any);
    } catch {}
  };

  // Loading state while the creator profile resolves
  if (creator === undefined) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  const firstName = (creator as any)?.firstName ?? '';
  const rejectedAt = (creator as any)?.rejectedAt as number | undefined;
  const rejectionReason = (creator as any)?.rejectionReason as string | undefined;
  const quizPassedAt = (creator as any)?.quizPassedAt as number | undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      {/* Sign-out chip (only escape hatch) */}
      <View style={{
        paddingHorizontal: 20, paddingVertical: 12,
        flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
      }}>
        <TouchableOpacity
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 12, paddingVertical: 6,
            borderRadius: radius.pill,
            backgroundColor: colors.paper3,
            borderWidth: 1, borderColor: colors.rule,
          }}
        >
          <Ionicons name="log-out-outline" size={13} color={colors.ink2} />
          <Text style={{
            fontFamily: fonts.monoMed,
            fontSize: 10, letterSpacing: 1.2,
            color: colors.ink2,
            textTransform: 'uppercase',
          }}>
            Sign out
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial eyebrow */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger }} />
          <Label tracking={1.8} color={colors.danger}>NOT APPROVED</Label>
        </View>

        {/* Headline */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 12 }}>
          <Display size="md">Your application </Display>
          <Display size="md" italic color={colors.danger}>wasn't approved.</Display>
        </View>

        <Body size="md" color={colors.ink2} style={{ marginBottom: 24, maxWidth: 340 }}>
          {firstName ? `Hi ${firstName}, ` : ''}
          our team reviewed your account and unfortunately couldn't verify you this time.
          {' '}You can retake the certification quiz or get in touch with us if you think this was a mistake.
        </Body>

        {/* Rejection reason card (only when admin supplied one) */}
        {rejectionReason ? (
          <Card large style={{
            marginBottom: 18,
            padding: 18,
            borderColor: colors.dangerBg,
            borderLeftWidth: 3,
            borderLeftColor: colors.danger,
          }}>
            <Label tracking={1.6} color={colors.danger}>REVIEWER NOTE</Label>
            <Body size="md" color={colors.ink} style={{ marginTop: 8, lineHeight: 22 }}>
              {rejectionReason}
            </Body>
            {rejectedAt ? (
              <Text style={{
                fontFamily: fonts.mono,
                fontSize: 10, letterSpacing: 0.6,
                color: colors.ink3,
                marginTop: 10,
                textTransform: 'uppercase',
              }}>
                Reviewed {timeAgo(rejectedAt)}
              </Text>
            ) : null}
          </Card>
        ) : (
          <Card large style={{
            marginBottom: 18,
            padding: 18,
            borderStyle: 'dashed',
          }}>
            <Label tracking={1.6}>NO REASON GIVEN</Label>
            <Body size="sm" color={colors.ink3} style={{ marginTop: 6 }}>
              The reviewer didn't leave a specific note. If you'd like more detail, reach out to support below.
            </Body>
            {rejectedAt ? (
              <Text style={{
                fontFamily: fonts.mono,
                fontSize: 10, letterSpacing: 0.6,
                color: colors.ink3,
                marginTop: 10,
                textTransform: 'uppercase',
              }}>
                Reviewed {timeAgo(rejectedAt)}
              </Text>
            ) : null}
          </Card>
        )}

        {/* Timeline strip */}
        <Card padded={false} large style={{ marginBottom: 22, overflow: 'hidden' }}>
          {/* Step 1 — done */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
            <View style={{
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: colors.accent,
              alignItems: 'center', justifyContent: 'center',
              marginRight: 12,
            }}>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Body size="sm" weight="bold" color={colors.ink}>Quiz passed</Body>
              {quizPassedAt ? (
                <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink3, marginTop: 1, letterSpacing: 0.5 }}>
                  {timeAgo(quizPassedAt)}
                </Text>
              ) : null}
            </View>
          </View>

          <Rule />

          {/* Step 2 — rejected */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
            <View style={{
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: colors.danger,
              alignItems: 'center', justifyContent: 'center',
              marginRight: 12,
            }}>
              <Ionicons name="close" size={14} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Body size="sm" weight="bold" color={colors.ink}>Admin review — not approved</Body>
              {rejectedAt ? (
                <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink3, marginTop: 1, letterSpacing: 0.5 }}>
                  {timeAgo(rejectedAt)}
                </Text>
              ) : null}
            </View>
          </View>

          <Rule />

          {/* Step 3 — locked */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
            <View style={{
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: colors.paper2,
              borderWidth: 1, borderColor: colors.ruleStrong,
              alignItems: 'center', justifyContent: 'center',
              marginRight: 12,
            }}>
              <Ionicons name="lock-closed" size={11} color={colors.ink3} />
            </View>
            <View style={{ flex: 1 }}>
              <Body size="sm" weight="bold" color={colors.ink3}>Account activation locked</Body>
              <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink3, marginTop: 1, letterSpacing: 0.5 }}>
                Retake the quiz or contact support
              </Text>
            </View>
          </View>
        </Card>

        {/* Actions */}
        <View style={{ gap: 10, marginBottom: 18 }}>
          <Door
            caption="TRY AGAIN"
            label={retrying ? 'Resetting…' : 'Retake the certification quiz'}
            variant="solid"
            loading={retrying}
            disabled={retrying}
            onPress={handleTryAgain}
            accessibilityLabel="Retake the certification quiz"
          />
          <Door
            caption="SUPPORT"
            label="Email the team"
            variant="ghost"
            onPress={handleContactSupport}
            accessibilityLabel="Contact support"
            rightIcon={<Ionicons name="mail-outline" size={18} color={colors.ink} style={{ marginLeft: 12 }} />}
          />
        </View>

        {/* Soft reassurance */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-start', gap: 10,
          padding: 14,
          backgroundColor: colors.paper2,
          borderRadius: radius.sm,
          borderLeftWidth: 3,
          borderLeftColor: colors.ink3,
        }}>
          <Ionicons name="information-circle-outline" size={16} color={colors.ink2} style={{ marginTop: 1 }} />
          <Body size="sm" color={colors.ink2} style={{ flex: 1, lineHeight: 20 }}>
            Retaking the quiz is free. Once you submit again, an admin will re-review your account — usually within 24 hours.
          </Body>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
