/**
 * The shop-owner section. Signed in (Clerk email code) + an owner row (owners.ensure
 * creates or re-links it, and links any site a field agent made for this email).
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Button, ScreenShell, Text } from '../../components/v2';
import { useEnsureOwner, useOwnerMe, useOwnerSubmission } from '../../lib/v2/ownerData';
import { OWNER_SAMPLE_DATA } from '../../lib/v2/ownerFlags';
import { ownerIntake, setOwnerIntent, useOwnerIntake } from '../../lib/v2/ownerIntake';
import { useOwnerUploads } from '../../lib/v2/ownerUploads';
import { useOwnerSite } from '../../lib/v2/useOwnerSite';
import { colors } from '../../theme/v2';

function UploadRecovery() {
  const { id, site } = useOwnerSite();
  const intake = useOwnerIntake();
  const sub = useOwnerSubmission(site?.phase === 'draft' ? id : null);
  const { resume } = useOwnerUploads();
  useEffect(() => {
    if (id && sub && site?.phase === 'draft') void resume(id, sub).catch(() => {});
  }, [id, sub, site?.phase, intake.uploads, resume]);
  return null;
}

export default function OwnerLayout() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const signedIn = OWNER_SAMPLE_DATA || !!isSignedIn;
  const me = useOwnerMe(signedIn);
  const ensure = useEnsureOwner();
  const asked = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [intakeReady, setIntakeReady] = useState(false);

  useEffect(() => { void ownerIntake.load().then(() => setIntakeReady(true)); }, []);

  useEffect(() => {
    if (!signedIn || me !== null || asked.current) return;
    asked.current = true;
    (async () => {
      const intake = await ownerIntake.load();
      try {
        await ensure({ name: intake.ownerName });
      } catch (e: any) {
        setError(e?.data ?? e?.message ?? 'Something went wrong.');
      }
    })();
  }, [signedIn, me, ensure]);

  if (!OWNER_SAMPLE_DATA && isLoaded && !isSignedIn) return <Redirect href="/(auth)/owner" />;

  if (error) {
    return (
      <ScreenShell
        title="We could not open your account"
        subtitle={String(error)}
        footer={
          <Button
            title="Sign out"
            variant="dark"
            onPress={() => {
              void setOwnerIntent(false);
              ownerIntake.clear();
              void signOut();
            }}
          />
        }
      />
    );
  }

  if (!me || !intakeReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.ink} accessibilityLabel="Loading" />
        <Text tone="muted" style={{ marginTop: 16 }}>One moment…</Text>
      </View>
    );
  }

  const cam = { gestureEnabled: false, animation: 'fade' as const, presentation: 'fullScreenModal' as const };
  return (
    <>
      <UploadRecovery />
      <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right' }}>
        <Stack.Screen name="talk/record" options={cam} />
        <Stack.Screen name="photos/shoot" options={cam} />
        <Stack.Screen name="building" options={{ gestureEnabled: false }} />
        <Stack.Screen name="live" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
