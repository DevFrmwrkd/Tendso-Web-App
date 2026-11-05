import React, { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useConvexAuth, useQuery, useMutation } from 'convex/react';
import { Redirect } from 'expo-router';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { api } from '@tendso/convex-client';
import { Avatar, Banner, Button, Field, Loading, ScreenShell } from '../../components/v2';
import { space } from '../../theme/v2';
import { isCreatorAccount } from '../../../../lib/accounts';
import { clearPendingSignupProfile, signupAccountHome } from '../../services/signupProfile';

// Same shape the signup screen validates against: +63 / 0 prefix optional, then
// a 10-digit mobile number starting 9.
const PHONE_REGEX = /^(\+63|0)?9\d{9}$/;

/**
 * Complete-profile gate for existing field agents missing a name.
 *
 * Sign in with Apple returns the name only on a user's first-ever authorization,
 * so a re-installing (or "Hide My Email") user lands with a blank profile. Home
 * redirects such a creator here BEFORE onboarding. New accounts finish through
 * account-setup after Convex authenticates. Apple already handled auth,
 * so there is no password step — this collects the name (required) plus an
 * optional phone and referral code. The email is shown locked, straight from the
 * Apple identity.
 *
 * Writes go to already-deployed public functions (creators.update,
 * creators.applyReferralCode), so no backend change is needed.
 */
export default function CompleteProfileScreen() {
  const router = useGuardedRouter();
  const { user } = useUser();
  const { isAuthenticated, isLoading } = useConvexAuth();

  const authenticatedSession = useQuery(api.adminAccess.me, isAuthenticated && user ? {} : 'skip');
  const ownSession = authenticatedSession?.clerkId === user?.id ? authenticatedSession : undefined;
  const creator = ownSession?.creator;
  const updateCreator = useMutation(api.creators.update);
  const applyReferral = useMutation(api.creators.applyReferralCode);

  const email = useMemo(
    () => user?.primaryEmailAddress?.emailAddress ?? '',
    [user],
  );

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [referral, setReferral] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Referral is one-shot server-side (it throws "already applied" on a second
  // call). If the name-save below fails after the referral succeeded, a retry
  // must NOT re-apply it, or the user is trapped on that error.
  const referralApplied = useRef(false);

  if (!isAuthenticated || isLoading || creator === undefined) {
    return <Loading />;
  }
  if (!creator) return <Redirect href="/(app)/account-setup" />;
  if (!isCreatorAccount(creator)) return <Redirect href={signupAccountHome(creator.role)} />;
  const showReferral = !creator.fieldAgentOnboardingCompletedAt && !creator.referredByCode && !creator.recruitedByCreatorId;

  const save = async () => {
    const first = firstName.trim();
    const last = lastName.trim();
    const rawPhone = phone.replace(/\s/g, '');
    const code = showReferral ? referral.trim() : '';

    if (!first) {
      setError('Please enter your first name.');
      return;
    }
    if (rawPhone && !PHONE_REGEX.test(rawPhone)) {
      setError('Please enter a valid PH mobile number, or leave it blank.');
      return;
    }
    if (!isAuthenticated || !creator?._id || !isCreatorAccount(creator)) return;

    setSaving(true);
    setError('');
    try {
      // Referral first, so an invalid code surfaces BEFORE we commit the name —
      // applyReferralCode throws on invalid/self/already-referred. It's optional,
      // so an empty field just skips it; a bad code stops here and the user can
      // fix or clear it (the name isn't lost because nothing is saved yet).
      if (code && !referralApplied.current) {
        await applyReferral({ id: creator._id, referredByCode: code });
        referralApplied.current = true;
      }

      // Best-effort Clerk update keeps user.firstName consistent; a Clerk hiccup
      // must not block the Convex write, which is what the app displays.
      try {
        await user?.update({ firstName: first, lastName: last || undefined });
      } catch (e) {
        console.warn('Clerk name update failed (non-fatal):', e);
      }

      await updateCreator({
        id: creator._id,
        firstName: first,
        lastName: last || undefined,
        phone: rawPhone || undefined,
      });

      await clearPendingSignupProfile({ clerkId: user?.id, email });

      // Back to Home — now that the creator has a name, its gate passes and the
      // normal onboarding redirect (training) takes over.
      router.replace('/(app)/(tabs)');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenShell
        title="Your field agent profile"
        subtitle="Shops see this when you visit."
        footer={<Button title="Save and continue" loading={saving} disabled={saving} onPress={save} />}
      >
        <View style={styles.avatar}>
          <Avatar uri={user?.imageUrl} name={firstName || user?.firstName || email} size={104} ring />
        </View>
        <View style={styles.stack}>
          <Field
            label="First name"
            icon="person-outline"
            placeholder="First name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            editable={!saving}
            autoFocus
            accessibilityLabel="First name"
          />
          <Field
            label="Last name (optional)"
            icon="person-outline"
            placeholder="Last name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            editable={!saving}
            accessibilityLabel="Last name"
          />
          <Field
            label="Mobile (optional)"
            prefix="+63"
            placeholder="9XX XXX XXXX"
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={11}
            editable={!saving}
            accessibilityLabel="Phone number"
          />
          {showReferral ? <Field
            label="Referral code (optional)"
            icon="gift-outline"
            placeholder="If you have one"
            value={referral}
            onChangeText={(v) => setReferral(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!saving}
            accessibilityLabel="Referral code"
          /> : null}
          <Field
            label="Email"
            icon="lock-closed-outline"
            value={email || 'From your Apple ID'}
            editable={false}
            accessibilityLabel="Email"
            helper="From your sign-in. Can't be changed here."
          />
        </View>
        {error ? <Banner tone="danger" body={error} style={styles.error} /> : null}
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  avatar: { alignItems: 'center', marginBottom: space.xl },
  stack: { gap: space.md },
  error: { marginTop: space.lg },
});
