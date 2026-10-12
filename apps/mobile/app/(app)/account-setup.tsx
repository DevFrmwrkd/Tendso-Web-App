import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { useClerk, useSession, useUser } from '@clerk/clerk-expo';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@tendso/convex-client';
import { Body, Display, Door, EditorialField, Label } from '../../components/ui/primitives';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useNetwork } from '../../providers/NetworkProvider';
import { colors } from '../../theme/tokens';
import {
  clearPendingSignupProfile, clearPendingSignupProfiles, createSignupAccount, loadPendingSignupProfile,
  normalizeSignupProfile, savePendingSignupProfile, signupAccountHome, signupErrorMessage, signupProfileErrors,
} from '../../services/signupProfile';
import type { SignupProfile } from '../../services/signupProfile';

/** Authentication is complete before either account creation mutation can run. */
export default function AccountSetupScreen() {
  const { user } = useUser();
  const { session } = useSession();
  const { signOut } = useClerk();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isConnected } = useNetwork();
  const insets = useSafeAreaInsets();
  const router = useGuardedRouter();
  const authenticatedSession = useQuery(api.adminAccess.me, isAuthenticated && user ? {} : 'skip');
  const ownSession = authenticatedSession?.clerkId === user?.id ? authenticatedSession : undefined;
  const account = ownSession?.creator;
  const isOwner = !!ownSession?.isOwner;
  const createCreator = useMutation(api.creators.create);
  const createAffiliate = useMutation(api.affiliates.create);
  const identity = useMemo(() => ({
    clerkId: user?.id, email: user?.primaryEmailAddress?.emailAddress, sessionId: session?.id,
  }), [user?.id, user?.primaryEmailAddress?.emailAddress, session?.id]);
  const [profile, setProfile] = useState<SignupProfile>(() => normalizeSignupProfile({}));
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !identity.clerkId || !ownSession || isOwner) return;
    let current = true;
    setDraftLoaded(false);
    loadPendingSignupProfile(identity).then((pending) => {
      if (!current) return;
      setProfile(normalizeSignupProfile({ ...pending,
        firstName: pending?.firstName || user?.firstName || '',
        lastName: pending?.lastName || user?.lastName || '',
      }));
      setDraftLoaded(true);
    }).catch(() => {
      if (!current) return;
      setProfile(normalizeSignupProfile({ firstName: user?.firstName || '', lastName: user?.lastName || '' }));
      setError('Your saved details could not be loaded. Please enter them again.');
      setDraftLoaded(true);
    });
    return () => { current = false; };
  }, [isAuthenticated, identity, ownSession?.clerkId, isOwner, user?.firstName, user?.lastName]);

  useEffect(() => {
    if (!account) return;
    void clearPendingSignupProfile(identity).catch(() => undefined);
    router.replace(signupAccountHome(account.role));
  }, [account?._id, account?.role, identity, router]);

  const change = (field: keyof SignupProfile, value: string) => {
    setProfile((previous) => ({ ...previous, [field]: value }));
    setFieldErrors({});
    setError('');
  };

  const save = async () => {
    if (inFlight.current || !isAuthenticated || isLoading || !ownSession || isOwner || account !== null || !identity.clerkId || isConnected !== true) return;
    const normalized = normalizeSignupProfile(profile);
    const errors = signupProfileErrors(normalized);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      // Keep every edit available after a failed request or an app restart.
      await savePendingSignupProfile(normalized, identity);
      await createSignupAccount(normalized, identity, { isAuthenticated, hasAccount: account !== null }, { createCreator, createAffiliate });
      router.replace(signupAccountHome(normalized.accountType));
    } catch (failure) {
      setError(signupErrorMessage(failure));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const leave = async () => {
    try {
      await clearPendingSignupProfiles();
    } finally {
      await signOut();
    }
  };

  if (isAuthenticated && !isLoading && isOwner) {
    return <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: colors.paper }}>
      <Display size="md">Business owner account</Display>
      <Body size="sm" color={colors.ink2}>Manage your website at tendso.com. To become a creator or affiliate, use a different email.</Body>
      <Door caption="SIGN OUT" label="Use a different login" onPress={() => { void leave().catch((failure) => setError(signupErrorMessage(failure))); }} />
      {error ? <Body size="sm" color={colors.danger}>{error}</Body> : null}
    </SafeAreaView>;
  }

  if (!isAuthenticated || isLoading || account === undefined || account || !draftLoaded) {
    return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Body size="sm">Preparing your secure account...</Body>
    </SafeAreaView>;
  }

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32, gap: 18 }}>
        <Label>FINISH YOUR ACCOUNT</Label>
        <Display size="md">How will you earn?</Display>
        <Body size="sm" color={colors.ink2}>Signed in as {identity.email || 'your sign-in account'}. Choose one account type for this login.</Body>
        {(['creator', 'affiliate'] as const).map((type) => <TouchableOpacity
          key={type} accessibilityRole="radio" accessibilityLabel={`${type === 'creator' ? 'Creator' : 'Affiliate'} account`}
          accessibilityState={{ checked: profile.accountType === type }} disabled={saving}
          onPress={() => change('accountType', type)}
          style={{ padding: 16, borderWidth: 1, borderColor: profile.accountType === type ? colors.accent : colors.rule, borderRadius: 12 }}>
          <Body weight="bold">{type === 'creator' ? 'Creator' : 'Affiliate'}</Body>
          <Body size="sm" color={colors.ink2}>{type === 'creator' ? 'Take photos and interview business owners.' : 'Share your page and earn a commission on sales. No interviews or photos.'}</Body>
        </TouchableOpacity>)}
        <EditorialField label={profile.accountType === 'affiliate' ? 'NAME' : 'FIRST NAME'} accessibilityLabel="Name"
          value={profile.firstName} onChangeText={(value: string) => change('firstName', value)}
          autoCapitalize="words" editable={!saving} error={fieldErrors.firstName} />
        <EditorialField label="LAST NAME (OPTIONAL)" accessibilityLabel="Last name" value={profile.lastName}
          onChangeText={(value: string) => change('lastName', value)} autoCapitalize="words" editable={!saving} />
        <EditorialField label={profile.accountType === 'affiliate' ? 'MOBILE NUMBER' : 'MOBILE NUMBER (OPTIONAL)'}
          accessibilityLabel="Mobile number" placeholder="09171234567" value={profile.phone}
          onChangeText={(value: string) => change('phone', value.replace(/[^0-9+]/g, ''))}
          keyboardType="phone-pad" editable={!saving} error={fieldErrors.phone} />
        {profile.accountType === 'affiliate' ? <>
          <EditorialField label="PAGE HANDLE" accessibilityLabel="Page handle" placeholder="your-page" value={profile.handle}
            onChangeText={(value: string) => change('handle', value.toLowerCase())} autoCapitalize="none" autoCorrect={false}
            editable={!saving} error={fieldErrors.handle} />
          <Body size="xs" color={colors.ink3}>After admin approval: tendso.com/a/{profile.handle || 'your-page'}. Use lowercase letters, numbers, and hyphens.</Body>
        </> : <EditorialField label="REFERRAL CODE (OPTIONAL)" accessibilityLabel="Referral code" value={profile.referredByCode}
          onChangeText={(value: string) => change('referredByCode', value.toUpperCase())} autoCapitalize="characters"
          autoCorrect={false} editable={!saving} />}
        <Body size="xs" color={colors.ink3}>To use both account types, sign up with different emails.</Body>
        {isConnected !== true ? <Body size="sm" color={colors.ink2}>Connect to the internet to finish setup.</Body> : null}
        {error ? <Body size="sm" color={colors.danger}>{error}</Body> : null}
        <Door caption="GET STARTED" label={`Create ${profile.accountType} account`} accessibilityLabel={`Create ${profile.accountType} account`}
          variant="accent" onPress={save} disabled={saving || isConnected !== true} loading={saving} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Use a different login" disabled={saving}
          onPress={() => { void leave().catch((failure) => setError(signupErrorMessage(failure))); }}>
          <Body size="sm" color={colors.ink2}>Use a different login</Body>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
