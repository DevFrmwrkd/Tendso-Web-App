import React, { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, ListRow, Loading, ScreenShell, Text } from '../../components/v2';
import { ProfileReviewNotice } from '../../components/profile/ProfileReviewNotice';
import { colors, hit, radius, shadow, space } from '../../theme/v2';

const SUPPORT_EMAIL = 'support@negosyo-digital.com';

export default function VerificationRejectedScreen() {
  const router = useGuardedRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [finishingCertification, setFinishingCertification] = useState(false);

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );
  const requestRecertification = useMutation(api.creators.requestRecertification);
  // Back must not bypass review. The profile editor is opened explicitly below.
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
    if (creator.certifiedAt) {
      void AsyncStorage.removeItem('ndm_just_quiz_passed').catch(() => {});
      router.replace('/(app)/(tabs)/' as any);
    } else if (!creator.rejectedAt) {
      // A corrected profile returns to review with its original quiz pass.
      // Older app versions can still explicitly reset their certification.
      router.replace(creator.quizPassedAt ? '/(app)/pending-review' : '/(app)/training');
    }
  }, [creator, router]);

  const handleFixProfile = (field?: 'name' | 'phone') => {
    router.push({
      pathname: '/(app)/edit-profile',
      params: {
        ...(creator?.quizPassedAt ? { review: '1' } : {}),
        ...(field ? { field } : {}),
      },
    });
  };

  // Legacy rejected records can lack a quiz pass. Keep that exceptional path
  // explicit; a passed quiz never uses the reset endpoint.
  const handleFinishCertification = async () => {
    if (!creator?._id || creator.quizPassedAt || finishingCertification) return;
    setFinishingCertification(true);
    try {
      await requestRecertification({ id: creator._id });
      router.replace('/(app)/training');
    } catch (err: any) {
      Alert.alert('Could not continue', err?.message || 'Please try again.');
    } finally {
      setFinishingCertification(false);
    }
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
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const nextStep = creator?.quizPassedAt
    ? 'Edit your details, then resubmit for review.'
    : 'Edit your details, then finish certification to request review.';

  return (
    <ScreenShell
      title="Update your profile"
      subtitle="Your profile wasn't approved. Review the feedback below."
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
            title={creator?.quizPassedAt ? 'Edit profile' : 'Finish certification'}
            onPress={creator?.quizPassedAt ? () => handleFixProfile() : handleFinishCertification}
            loading={finishingCertification}
            disabled={finishingCertification}
            accessibilityLabel={creator?.quizPassedAt ? 'Edit profile' : 'Finish certification'}
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
      <ProfileReviewNotice
        reason={rejectionReason}
        rejectedAt={rejectedAt}
        instruction={nextStep}
      />
      <View style={styles.checks}>
        {fullName ? (
          <ListRow
            title="Full name"
            subtitle={fullName}
            icon="person-outline"
            trailing={<Text variant="label" weight="bold" tone="muted">Edit</Text>}
            onPress={() => handleFixProfile('name')}
            accessibilityLabel="Edit full name"
            accessibilityHint="Opens your profile at the name fields."
            style={[styles.editRow, shadow.soft]}
          />
        ) : null}
        {phone ? (
          <ListRow
            title="Mobile"
            subtitle={phone}
            icon="call-outline"
            trailing={<Text variant="label" weight="bold" tone="muted">Edit</Text>}
            onPress={() => handleFixProfile('phone')}
            accessibilityLabel="Edit mobile"
            accessibilityHint="Opens your profile at the mobile field."
            style={[styles.editRow, shadow.soft]}
          />
        ) : null}
        <ListRow
          title="Certification quiz"
          subtitleNumberOfLines={0}
          subtitle={creator?.quizPassedAt
            ? "Passed. You don't need to take it again."
            : 'Complete certification before submitting for review.'}
          leading={
            <View style={[styles.quizCircle, creator?.quizPassedAt ? styles.quizPassed : null]}>
              {creator?.quizPassedAt ? <Ionicons name="checkmark" size={22} color={colors.onAccent} /> : null}
            </View>
          }
          style={[styles.editRow, shadow.soft]}
        />
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
  checks: { gap: space.sm, marginTop: space.lg },
  quizCircle: {
    width: hit.icon,
    height: hit.icon,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizPassed: { backgroundColor: colors.accent, borderColor: colors.accent },
  editRow: {
    paddingHorizontal: space.lg,
    backgroundColor: colors.card,
    borderRadius: radius.card,
  },
});
