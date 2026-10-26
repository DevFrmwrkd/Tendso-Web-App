import React, { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Avatar, Button, Card, CheckRow, ListRow, Loading, ScreenShell, Text } from '../../components/v2';
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
  const profileImage = (creator as any)?.profileImage as string | undefined;
  const photo = profileImage && /^https?:\/\//.test(profileImage) ? profileImage : user?.imageUrl;
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
      <Card style={styles.reason}>
        <View>
          <Avatar uri={photo} name={fullName} size={64} />
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
        {creator?.quizPassedAt
          ? <CheckRow title="Certification quiz" subtitle="Passed. You don't need to take it again." state="ok" />
          : <CheckRow title="Certification quiz" subtitle="Complete certification before submitting for review." state="todo" />}
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
  editRow: {
    paddingHorizontal: space.lg,
    backgroundColor: colors.card,
    borderRadius: radius.card,
  },
});
