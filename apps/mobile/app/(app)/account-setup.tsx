import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useClerk, useSession, useUser } from '@clerk/clerk-expo';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { Banner, Button, Card, Field, Loading, OptionRow, ScreenShell, Text, TextLink } from '../../components/v2';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useNetwork } from '../../providers/NetworkProvider';
import { space } from '../../theme/v2';
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

  const accountLabel = profile.accountType === 'creator' ? 'field agent' : 'creator';

  if (isAuthenticated && !isLoading && isOwner) {
    return <ScreenShell
      scroll={false}
      contentStyle={styles.center}
      footer={<>
        {error ? <Text variant="label" tone="danger">{error}</Text> : null}
        <Button title="Use a different login" variant="dark" onPress={() => { void leave().catch((failure) => setError(signupErrorMessage(failure))); }} />
      </>}>
      <Card variant="lg" style={styles.ownerCard}>
        <Text variant="title">Business owner account</Text>
        <Text variant="bodyLg" tone="ink2">Manage your website at tendso.com. To become a field agent or creator, use a different email.</Text>
      </Card>
    </ScreenShell>;
  }

  if (!isAuthenticated || isLoading || account === undefined || account || !draftLoaded) {
    return <Loading label="Preparing your secure account..." />;
  }

  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenShell
      title="How will you earn?"
      subtitle={`Signed in as ${identity.email || 'your sign-in account'}.`}
      footer={<>
        {isConnected !== true ? <Text variant="label" tone="muted" align="center">Connect to the internet to finish setup.</Text> : null}
        <Button title={`Create ${accountLabel} account`} onPress={save} disabled={saving || isConnected !== true} loading={saving} />
        <TextLink label="Use a different login" tone="muted" onPress={() => { void leave().catch((failure) => setError(signupErrorMessage(failure))); }} />
      </>}>
      <View style={styles.stack} accessibilityRole="radiogroup">
        <OptionRow
          icon="storefront-outline" title="Field agent" subtitle="Visit shops, take photos."
          selected={profile.accountType === 'creator'} disabled={saving} onPress={() => change('accountType', 'creator')} />
        <OptionRow
          icon="share-social-outline" title="Creator" subtitle="Share your page. No photos."
          selected={profile.accountType === 'affiliate'} disabled={saving} onPress={() => change('accountType', 'affiliate')} />
      </View>
      <View style={[styles.stack, styles.fields]}>
        <Field label={profile.accountType === 'affiliate' ? 'Name' : 'First name'} accessibilityLabel="Name" icon="person-outline"
          value={profile.firstName} onChangeText={(value: string) => change('firstName', value)}
          autoCapitalize="words" editable={!saving} error={fieldErrors.firstName} />
        <Field label="Last name (optional)" accessibilityLabel="Last name" icon="person-outline" value={profile.lastName}
          onChangeText={(value: string) => change('lastName', value)} autoCapitalize="words" editable={!saving} />
        <Field label={profile.accountType === 'affiliate' ? 'Mobile number' : 'Mobile number (optional)'}
          accessibilityLabel="Mobile number" icon="call-outline" placeholder="09171234567" value={profile.phone}
          onChangeText={(value: string) => change('phone', value.replace(/[^0-9+]/g, ''))}
          keyboardType="phone-pad" editable={!saving} error={fieldErrors.phone} />
        {profile.accountType === 'affiliate' ? <Field label="Page handle" accessibilityLabel="Page handle" icon="link-outline"
          placeholder="your-page" value={profile.handle}
          onChangeText={(value: string) => change('handle', value.toLowerCase())} autoCapitalize="none" autoCorrect={false}
          editable={!saving} error={fieldErrors.handle}
          helper={`tendso.com/a/${profile.handle || 'your-page'} after approval. Lowercase letters, numbers, hyphens.`} />
        : <Field label="Referral code (optional)" accessibilityLabel="Referral code" icon="gift-outline" value={profile.referredByCode}
          onChangeText={(value: string) => change('referredByCode', value.toUpperCase())} autoCapitalize="characters"
          autoCorrect={false} editable={!saving} />}
      </View>
      <Text variant="label" tone="muted" style={styles.note}>To use both, sign up with different emails.</Text>
      {error ? <Banner tone="danger" body={error} style={styles.note} /> : null}
    </ScreenShell>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.md },
  fields: { marginTop: space.xl },
  note: { marginTop: space.lg },
  center: { flex: 1, justifyContent: 'center' },
  ownerCard: { gap: space.md },
});
