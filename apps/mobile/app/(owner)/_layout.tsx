/** The owner workspace shares Clerk and account-role resolution with the app. */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Banner, Button, ScreenShell, Text } from '../../components/v2';
import { useEnsureOwner, useOwnerMe, useOwnerSubmission } from '../../lib/v2/ownerData';
import { OWNER_SAMPLE_DATA } from '../../lib/v2/ownerFlags';
import { ownerIntake, useOwnerIntake } from '../../lib/v2/ownerIntake';
import { useOwnerUploads } from '../../lib/v2/ownerUploads';
import { useOwnerSite } from '../../lib/v2/useOwnerSite';
import { useMobileAccount } from '../../hooks/useMobileAccount';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { colors } from '../../theme/v2';
import { CreatorAttributionGate } from '../../components/CreatorAttributionGate';
import { OwnerNotificationBridge, unregisterOwnerPush } from '../../components/v2/owner/OwnerNotificationBridge';
import { useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';

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

function OpeningAccount() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
    <ActivityIndicator color={colors.ink} accessibilityLabel="Loading" />
    <Text tone="muted" style={{ marginTop: 16 }}>One moment…</Text>
  </View>;
}

export default function OwnerLayout() {
  const auth = useAuth();
  const account = useMobileAccount();
  if (!OWNER_SAMPLE_DATA && auth.isLoaded && !auth.isSignedIn) return <Redirect href="/(auth)/owner" />;
  if (!OWNER_SAMPLE_DATA && (!auth.isLoaded || !auth.userId || account.isLoading)) return <OpeningAccount />;
  // A deep link cannot turn a field agent, creator or admin into an owner.
  if (!OWNER_SAMPLE_DATA && (account.account || account.role)) return <Redirect href="/(app)/(tabs)/" />;
  return <OwnerAccount key={`${auth.userId ?? 'sample-owner'}:${auth.sessionId ?? ''}`}
    actorId={OWNER_SAMPLE_DATA ? 'sample-owner' : auth.userId!} signOut={auth.signOut} offline={account.isOffline} />;
}

function OwnerAccount({ actorId, signOut, offline }: {
  actorId: string;
  signOut: ReturnType<typeof useAuth>['signOut'];
  offline: boolean;
}) {
  const router = useGuardedRouter();
  const me = useOwnerMe(true);
  const intake = useOwnerIntake();
  const ensure = useEnsureOwner();
  const removePush = useMutation(api.ownerInbox.removePushToken);
  const asked = useRef(false);
  const mounted = useRef(true);
  const logoutBusy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [intakeReady, setIntakeReady] = useState(false);
  const [migrated, setMigrated] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const liveMe = useRef(me);
  liveMe.current = me;
  const membership = me ? `${me.owner._id}:${me.sites.map(site => site.submissionId).sort().join(',')}` : null;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setIntakeReady(false);
    const binding = ownerIntake.bindActor(actorId);
    const scope = ownerIntake.scope();
    void binding.then(() => {
      if (active && ownerIntake.isCurrent(scope)) setIntakeReady(true);
    }).catch(() => {
      if (active && ownerIntake.isCurrent(scope)) setError('We could not load your saved progress. Please try again.');
    });
    return () => { active = false; };
  }, [actorId, attempt]);

  useEffect(() => {
    if (!intakeReady || !me || !membership) return;
    if (intake.newBusiness) { setMigrated(membership); return; }
    let active = true;
    const scope = ownerIntake.scope();
    void ownerIntake.migrateLegacy(me.sites.map(site => site.submissionId)).then(() => {
      if (!active || !mounted.current || !ownerIntake.isCurrent(scope)) return;
      const owned = liveMe.current;
      if (!owned || owned.owner._id !== me.owner._id) return;
      const workspace = ownerIntake.get();
      if (!workspace.newBusiness) {
        if (workspace.submissionId && owned.sites.some(site => site.submissionId === workspace.submissionId)) {
          ownerIntake.confirmBusiness(workspace.submissionId);
        } else if (!ownerIntake.isAwaitingBusiness(workspace.submissionId)) {
          if (owned.sites.length === 0) ownerIntake.beginBusiness();
          else ownerIntake.selectBusiness(owned.sites[0].submissionId);
        }
      }
      // Replacing a foreign selection intentionally advances the journal epoch.
      // The new owned pointer must be ready before capture/upload children mount.
      const selectedScope = ownerIntake.scope();
      if (active && mounted.current && ownerIntake.isCurrent(selectedScope)) setMigrated(membership);
    }).catch(() => {
      if (active && ownerIntake.isCurrent(scope)) setError('We could not restore your saved progress. Please try again.');
    });
    return () => { active = false; };
  }, [intakeReady, membership, attempt, intake.newBusiness]);

  useEffect(() => {
    if (error || !intakeReady || offline || me !== null || asked.current) return;
    asked.current = true;
    const scope = ownerIntake.scope();
    void ensure({ name: ownerIntake.get().ownerName }).catch((e: any) => {
      if (!mounted.current || !ownerIntake.isCurrent(scope)) return;
      asked.current = false;
      if (liveMe.current == null) setError(String(e?.data ?? e?.message ?? 'Something went wrong.'));
    });
  }, [error, intakeReady, offline, me, ensure, attempt]);

  const logout = async () => {
    if (!mounted.current || logoutBusy.current) return;
    logoutBusy.current = true;
    setSigningOut(true);
    const scope = ownerIntake.scope();
    try {
      if(!OWNER_SAMPLE_DATA) await unregisterOwnerPush(removePush,actorId,()=>mounted.current&&ownerIntake.isCurrent(scope));
      if(!mounted.current||!ownerIntake.isCurrent(scope)) return;
      await signOut();
      if (!ownerIntake.isCurrent(scope)) return;
      await ownerIntake.bindActor(null);
      if (mounted.current) router.replace('/(auth)/owner');
    } catch {
      if (mounted.current && ownerIntake.isCurrent(scope)) setError('Could not sign out. Please try again.');
    } finally {
      logoutBusy.current = false;
      if (mounted.current) setSigningOut(false);
    }
  };

  if (error || (offline && !me)) return <ScreenShell title={error ? 'We could not open your account' : 'Reconnect to continue'}
    subtitle={error ?? 'Connect to load your owner account and saved progress.'} footer={
      <View style={{ gap: 12 }}>
        <Button title="Try again" disabled={signingOut || offline} onPress={() => {
          if (!mounted.current || logoutBusy.current) return;
          asked.current = false;
          setError(null);
          setMigrated(null);
          setAttempt(value => value + 1);
        }} />
        <Button title="Sign out" variant="dark" loading={signingOut} onPress={logout} />
      </View>
    }>{offline ? <Banner tone="warn" body="You're offline. Reconnect to try again." /> : null}</ScreenShell>;

  // A newly created site changes membership while Place is still finishing.
  // Reconcile its legacy cache without removing the live navigation stack.
  if (!me || !intakeReady || migrated === null) return <OpeningAccount />;
  const cam = { gestureEnabled: false, animation: 'fade' as const, presentation: 'fullScreenModal' as const };
  return <>
    <CreatorAttributionGate enabled={!OWNER_SAMPLE_DATA} claimAs="owner" />
    <UploadRecovery />
    {!OWNER_SAMPLE_DATA?<OwnerNotificationBridge ownerId={me.owner._id} subject={actorId}/>:null}
    <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right' }}>
      <Stack.Screen name="talk/record" options={cam} />
      <Stack.Screen name="photos/shoot" options={cam} />
      <Stack.Screen name="building" options={{ gestureEnabled: false }} />
      <Stack.Screen name="live" options={{ gestureEnabled: false }} />
    </Stack>
  </>;
}
