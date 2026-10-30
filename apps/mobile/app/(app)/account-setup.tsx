import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { SignupIdentity, SignupProfile } from '../../services/signupProfile';
import { creatorCodeError, normalizeCreatorCode } from '../../../../lib/creatorCodes';
import { CreatorCodeConfirmation } from '../../components/affiliate/CreatorCodeConfirmation';

type SetupSubmission = { profile: SignupProfile; identity: SignupIdentity; actorKey: string; formKey: string; code: string };

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
  const inFlight = useRef<{ token: symbol; submission: SetupSubmission } | null>(null);
  const mounted = useRef(true);
  const [confirmation, setConfirmation] = useState<SetupSubmission | null>(null);
  const activeConfirmation = useRef<SetupSubmission | null>(null);
  const [codeCheck, setCodeCheck] = useState<{ subject: string; value: string } | null>(null);
  const codeCandidate = normalizeCreatorCode(profile.creatorCode ?? '');
  const codeFormatError = codeCandidate ? creatorCodeError(codeCandidate) : null;
  const canCheckCode = profile.accountType === 'affiliate' && draftLoaded && isAuthenticated && !isLoading
    && !!identity.clerkId && !!ownSession && !isOwner && account === null && isConnected === true;

  useEffect(() => {
    setCodeCheck(null);
    if (!canCheckCode || !codeCandidate || codeFormatError || !identity.clerkId) return;
    const subject = identity.clerkId;
    const timer = setTimeout(() => setCodeCheck({ subject, value: codeCandidate }), 350);
    return () => clearTimeout(timer);
  }, [canCheckCode, codeCandidate, codeFormatError, identity.clerkId]);
  const matchingCheck = canCheckCode && codeCheck?.subject === identity.clerkId && codeCheck?.value === codeCandidate;
  const availability = useQuery(api.creatorProgram.checkAvailability, matchingCheck ? { code: codeCandidate } : 'skip');
  const codeResult = matchingCheck && availability?.code?.value === codeCandidate ? availability.code : undefined;
  const codeReady = !!codeCandidate && !codeFormatError && codeResult?.available === true;
  const creatorCodeProblem = fieldErrors.creatorCode || codeFormatError || (codeResult && !codeResult.available ? codeResult.error : null);
  const creatorCodeHelper = !codeCandidate ? 'Choose your own code, such as ALEX30. Owners save 30% with it.'
    : codeReady ? 'This code is available. Owners save 30% with it.'
    : isConnected !== true ? 'Connect to check whether this code is available.' : 'Checking code availability…';
  const actorKey = JSON.stringify([identity.clerkId ?? null, identity.email?.trim().toLowerCase() ?? null,
    identity.sessionId ?? null, ownSession?.clerkId ?? null]);
  const formKey = JSON.stringify(normalizeSignupProfile(profile));
  const sessionReady = isAuthenticated && !isLoading && !!ownSession && !isOwner && account === null
    && !!identity.clerkId && draftLoaded;
  const live = useRef({ actorKey, formKey, sessionReady, connected: isConnected === true, codeReady, codeCandidate });
  live.current = { actorKey, formKey, sessionReady, connected: isConnected === true, codeReady, codeCandidate };
  const matches = useCallback((submission: SetupSubmission) => mounted.current && live.current.sessionReady
    && live.current.actorKey === submission.actorKey && live.current.formKey === submission.formKey, []);
  if (activeConfirmation.current && !matches(activeConfirmation.current)) activeConfirmation.current = null;
  const maySubmit = useCallback((submission: SetupSubmission) => matches(submission) && live.current.connected
    && (submission.profile.accountType !== 'affiliate' || activeConfirmation.current === submission
      && live.current.codeReady && live.current.codeCandidate === submission.code), [matches]);
  const confirmationCurrent = !!confirmation && activeConfirmation.current === confirmation
    && confirmation.profile.accountType === 'affiliate' && matches(confirmation);
  const confirmationReady = !!confirmation && maySubmit(confirmation);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; inFlight.current = null; activeConfirmation.current = null; };
  }, []);

  useEffect(() => {
    if (confirmation && (!matches(confirmation) || activeConfirmation.current !== confirmation)) setConfirmation(null);
    if (inFlight.current && !matches(inFlight.current.submission)) {
      inFlight.current = null;
      setSaving(false);
    }
  }, [actorKey, formKey, sessionReady, confirmation, matches]);

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
    if (inFlight.current) return;
    activeConfirmation.current = null;
    setConfirmation(null);
    setProfile((previous) => ({ ...previous, [field]: value }));
    setFieldErrors({});
    setError('');
  };

  const createAccount = async (submission: SetupSubmission) => {
    if (inFlight.current || !maySubmit(submission)) return;
    const token = Symbol('signup');
    inFlight.current = { token, submission };
    const active = () => mounted.current && inFlight.current?.token === token && matches(submission);
    setSaving(true);
    setError('');
    try {
      // Keep every edit available after a failed request or an app restart.
      await savePendingSignupProfile(submission.profile, submission.identity);
      // Storage can yield while the account, session, connection or code check changes.
      if (!active() || !maySubmit(submission)) return;
      await createSignupAccount(submission.profile, submission.identity, { isAuthenticated: true, hasAccount: false }, { createCreator, createAffiliate });
      if (!active()) return;
      activeConfirmation.current = null;
      setConfirmation(null);
      router.replace(signupAccountHome(submission.profile.accountType));
    } catch (failure) {
      if (active()) setError(signupErrorMessage(failure));
    } finally {
      if (mounted.current && inFlight.current?.token === token) {
        inFlight.current = null;
        setSaving(false);
      }
    }
  };

  const save = () => {
    if (inFlight.current || !sessionReady || isConnected !== true) return;
    const normalized = normalizeSignupProfile(profile);
    const errors = signupProfileErrors(normalized);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email?.trim() ?? '')) {
      setError('Add a verified email to your sign-in account before continuing.');
      return;
    }
    if (normalized.accountType === 'affiliate' && !codeReady) return;
    const submission = { profile: normalized, identity: { ...identity }, actorKey, formKey, code: codeCandidate };
    setError('');
    if (normalized.accountType === 'affiliate') {
      // Object identity is the review token, even if a later popup has identical fields.
      activeConfirmation.current = submission;
      setConfirmation(submission);
    }
    else void createAccount(submission);
  };

  const cancelConfirmation = () => {
    if (inFlight.current) return;
    activeConfirmation.current = null;
    setConfirmation(null);
    setError('');
  };

  const leave = async () => {
    activeConfirmation.current = null;
    inFlight.current = null;
    setConfirmation(null);
    setSaving(false);
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
        <Button title={`Create ${accountLabel} account`} onPress={save} disabled={saving || isConnected !== true || (profile.accountType === 'affiliate' && !codeReady)} loading={saving} />
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
        {profile.accountType === 'affiliate' ? <><Field label="Page handle" accessibilityLabel="Page handle" icon="link-outline"
          placeholder="your-page" value={profile.handle}
          onChangeText={(value: string) => change('handle', value.toLowerCase())} autoCapitalize="none" autoCorrect={false}
          editable={!saving} error={fieldErrors.handle}
          helper={`tendso.com/a/${profile.handle || 'your-page'} after approval. Lowercase letters, numbers, hyphens.`} />
          <Field label="Creator code" accessibilityLabel="Creator code" icon="pricetag-outline"
            placeholder="ALEX30" value={profile.creatorCode ?? ''}
            onChangeText={(value: string) => change('creatorCode', normalizeCreatorCode(value))}
            autoCapitalize="characters" autoCorrect={false} maxLength={16} editable={!saving}
            error={creatorCodeProblem} helper={creatorCodeHelper} />
          <Text variant="label" tone="muted">Choose carefully. You can’t change this code after creating your account.</Text>
          </>
        : null}
      </View>
      <Text variant="label" tone="muted" style={styles.note}>To use both, sign up with different emails.</Text>
      {error && !confirmationCurrent ? <Banner tone="danger" body={error} style={styles.note} /> : null}
    </ScreenShell>
    <CreatorCodeConfirmation visible={confirmationCurrent} code={confirmation?.code ?? ''} creatingAccount
      busy={saving} disabled={!confirmationReady}
      error={error || (isConnected !== true ? 'Connect to the internet before creating your account.'
        : !codeReady ? creatorCodeProblem || 'Check that this code is still available before continuing.' : undefined)}
      onConfirm={() => { if (confirmation) void createAccount(confirmation); }} onCancel={cancelConfirmation} />
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
