import React, { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Avatar, Button, Card, CheckRow, Loading, ScreenShell, Text } from '../../components/v2';
import { colors, hit, radius, shadow, space } from '../../theme/v2';

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

  // Block hardware back — this is a locked screen until the field agent
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
      `My field agent account was not approved and I'd like to ask for another review.\n\n` +
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

  // Loading state while the field agent profile resolves
  if (creator === undefined) {
    return <Loading />;
  }

  const firstName = (creator as any)?.firstName ?? '';
  const lastName = (creator as any)?.lastName ?? '';
  const phone = (creator as any)?.phone as string | undefined;
  const rejectedAt = (creator as any)?.rejectedAt as number | undefined;
  const rejectionReason = (creator as any)?.rejectionReason as string | undefined;
  const profileImage = (creator as any)?.profileImage as string | undefined;
  const photo = profileImage && /^https?:/.test(profileImage) ? profileImage : user?.imageUrl;
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  return (
    <ScreenShell
      title={firstName ? `Almost there, ${firstName}` : 'Almost there'}
      subtitle="We couldn't approve your profile yet."
      headerRight={
        <Pressable
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
          style={[styles.signOut, shadow.soft]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.ink} />
          <Text variant="label" weight="bold">Sign out</Text>
        </Pressable>
      }
      footer={
        <>
          <Button
            title={retrying ? 'Resetting…' : 'Fix and resend'}
            loading={retrying}
            disabled={retrying}
            onPress={handleTryAgain}
            accessibilityLabel="Retake the certification quiz"
          />
          <Button
            title="Ask the team"
            variant="ghost"
            onPress={handleContactSupport}
            accessibilityLabel="Contact support"
          />
        </>
      }
    >
      <Card style={styles.reason}>
        <View>
          <Avatar uri={photo} name={firstName} size={64} />
          <View style={styles.cross}>
            <Ionicons name="close" size={16} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.reasonText}>
          <Text variant="body" weight="bold">{rejectionReason || 'No reason was given'}</Text>
          <Text variant="label" tone="muted" weight="medium">
            {rejectionReason ? '' : 'Ask the team for details. '}
            {rejectedAt ? `Reviewed ${timeAgo(rejectedAt)}.` : ''}
          </Text>
        </View>
      </Card>
      <View style={styles.checks}>
        {fullName ? <CheckRow title="Full name" subtitle={fullName} state="ok" /> : null}
        {phone ? <CheckRow title="Mobile" subtitle={phone} state="ok" /> : null}
        <CheckRow title="Certification quiz" subtitle="Take it again. It is free." state="bad" right="Fix" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: hit.icon,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  reasonText: { flex: 1, gap: space.xs },
  cross: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checks: { gap: space.sm, marginTop: space.lg },
});
