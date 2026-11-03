/** Business signup and sign-in share Clerk email codes, with distinct forms. */
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';
import { Banner, Button, Field, ScreenShell, TendsoMark, Text } from '../../components/v2';
import { AuthLink, CodeBoxes } from '../../components/v2/AuthParts';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { ownerIntake, setOwnerIntent } from '../../lib/v2/ownerIntake';
import { openExternalUrl, PRIVACY_URL, TERMS_URL } from '../../services/links';
import { space } from '../../theme/v2';
import { useNetwork } from '../../providers/NetworkProvider';

type Mode = 'signup' | 'signin';

function hasClerkCode(error: any, code: string): boolean {
  return error?.errors?.some((item: any) => item.code === code) ?? false;
}

function clerkMessage(error: any, fallback: string): string {
  return error?.errors?.[0]?.longMessage || error?.errors?.[0]?.message || error?.message || fallback;
}

function signInSecurityMessage(status: string | null | undefined): string | null {
  if (status === 'needs_second_factor' || status === 'needs_client_trust') {
    return 'Your account needs another security check. Continue with more sign-in options.';
  }
  if (status === 'needs_new_password') {
    return 'Your account needs a password update. Continue with more sign-in options.';
  }
  return null;
}

export default function OwnerAuthScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { userId, sessionId } = useAuth();
  const formMode: Mode = mode === 'signup' ? 'signup' : 'signin';
  const [email, setEmail] = useState('');
  // Keep the address when switching modes, but reset verification and errors.
  if (userId) return <Redirect href="/(app)/(tabs)/" />;
  return <OwnerAuthForm key={`${formMode}:${userId ?? ''}:${sessionId ?? ''}`} mode={formMode} guest={!userId} email={email} onChangeEmail={setEmail} />;
}

function OwnerAuthForm({ mode, guest, email, onChangeEmail }: { mode: Mode; guest: boolean; email: string; onChangeEmail: (value: string) => void }) {
  const router = useGuardedRouter();
  const { isConnected } = useNetwork();
  const isOffline = isConnected === false;
  const online = useRef(!isOffline);
  online.current = !isOffline;
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [name, setName] = useState('');
  const [intakeReady, setIntakeReady] = useState(false);
  const [code, setCode] = useState('');
  const [emailAddressId, setEmailAddressId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsAlternativeSignIn, setNeedsAlternativeSignIn] = useState(false);
  const signInAddress = useRef<string | null>(null);
  const verificationEmail = useRef<string | null>(null);
  const emailInput = useRef<TextInput>(null);
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const inFlight = useRef(false);
  const activating = useRef(false);
  const completedSession = useRef<string | null>(null);
  const completedEmail = useRef<string | null>(null);
  const signingUp = mode === 'signup';
  const authReady = intakeReady && (signingUp ? signUpLoaded : signInLoaded);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nameOk = name.trim().length > 0 && name.trim().length <= 100;

  useEffect(() => {
    mounted.current = true;
    void setOwnerIntent(true);
    if (guest) {
      const binding = ownerIntake.bindActor(null);
      const scope = ownerIntake.scope();
      void binding.then(() => {
        if (!mounted.current || !ownerIntake.isCurrent(scope)) return;
        setName(ownerIntake.get().ownerName ?? '');
        setIntakeReady(true);
      }).catch(() => {
        if (mounted.current && ownerIntake.isCurrent(scope)) setError('We could not load the signup form. Please go back and try again.');
      });
    }
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
    };
  }, []);

  // Ignore late responses after Back or mode changes; prevent duplicate sends.
  const runRequest = async (work: (current: () => boolean, owned: () => boolean) => Promise<void>, fallback: string) => {
    if (!mounted.current || !online.current || inFlight.current) return;
    const version = ++requestVersion.current;
    const owned = () => mounted.current && version === requestVersion.current;
    const current = () => owned() && online.current;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work(current, owned);
    } catch (err: any) {
      if (!current()) return;
      if (!signingUp && hasClerkCode(err, 'form_identifier_not_found')) {
        setError('We could not find an account with that email. Check it or make an account below.');
      } else if (signingUp && hasClerkCode(err, 'form_identifier_exists')) {
        setError('That email already has an account. Log in below.');
      } else if (!signingUp && hasClerkCode(err, 'strategy_for_user_invalid')) {
        setError('Email codes are not available for this account. Try another sign-in option.');
        setNeedsAlternativeSignIn(true);
      } else {
        setError(clerkMessage(err, fallback));
      }
    } finally {
      // Losing connectivity must not leave a completed request locked forever.
      if (mounted.current && version === requestVersion.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };

  const sendCode = async () => {
    if (!authReady || !emailOk || (signingUp && !nameOk)) return;
    await runRequest(async (current) => {
      setNeedsAlternativeSignIn(false);
      const address = email.trim().toLowerCase();
      if (completedEmail.current !== address) {
        completedSession.current = null;
        completedEmail.current = null;
      }
      if (signingUp) {
        if (!signUp) return;
        const [firstName, ...rest] = name.trim().split(/\s+/);
        ownerIntake.set({ ownerName: name.trim() });
        await signUp.create({ emailAddress: address, firstName, lastName: rest.join(' ') || undefined });
        if (!current()) return;
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      } else {
        if (!signIn) return;
        if (completedSession.current && setSignInActive) {
          activating.current = true;
          try { await setSignInActive({ session: completedSession.current }); }
          finally { activating.current = false; }
          return;
        }
        setEmailAddressId(null);
        signInAddress.current = null;
        // Clerk prepares and sends the email code in this request. Factor lists
        // can be empty after a strategy is selected; do not infer a password or
        // social account from that list or send a second code with prepare().
        const attempt = await signIn.create({ identifier: address, strategy: 'email_code' });
        if (!current()) return;
        if (attempt.status === 'complete' && attempt.createdSessionId && setSignInActive) {
          completedSession.current = attempt.createdSessionId;
          completedEmail.current = address;
          activating.current = true;
          try { await setSignInActive({ session: attempt.createdSessionId }); }
          finally { activating.current = false; }
          return;
        }
        const security = signInSecurityMessage(attempt.status);
        if (security) { setError(security); setNeedsAlternativeSignIn(true); return; }
        const factor = attempt.supportedFirstFactors?.find((item) => item.strategy === 'email_code');
        const verification = attempt.firstFactorVerification;
        if (attempt.status !== 'needs_first_factor' || verification?.strategy !== 'email_code'
          || verification.status !== 'unverified') {
          const otherFactors = attempt.supportedFirstFactors?.some(item => item.strategy === 'password' || item.strategy.startsWith('oauth_'));
          setError(otherFactors ? 'Email codes are not available for this account. Try another sign-in option.'
            : 'We could not start email sign-in. Check your email address and try again.');
          setNeedsAlternativeSignIn(!!otherFactors);
          return;
        }
        if (factor?.strategy === 'email_code') setEmailAddressId(factor.emailAddressId);
        signInAddress.current = address;
      }
      if (current()) {
        completedSession.current = null;
        completedEmail.current = null;
        verificationEmail.current = address;
        setCode('');
        setStep('code');
      }
    }, 'We could not send a code. Please try again.');
  };

  const verify = async () => {
    if (!authReady || code.length !== 6 || needsAlternativeSignIn) return;
    const address = email.trim().toLowerCase();
    if (verificationEmail.current !== address || (completedSession.current && completedEmail.current !== address)) {
      completedSession.current = null;
      completedEmail.current = null;
      setStep('form');
      setError('Your email address changed. Send a new sign-in code.');
      return;
    }
    await runRequest(async (current, owned) => {
      if (signingUp ? !signUp : !signIn) return;
      const activate = signingUp ? setSignUpActive : setSignInActive;
      if (!completedSession.current) {
        const result = signingUp
          ? await signUp!.attemptEmailAddressVerification({ code })
          : await signIn!.attemptFirstFactor({ strategy: 'email_code', code });
        if (!owned()) return;
        if (result.status === 'complete' && result.createdSessionId) {
          completedSession.current = result.createdSessionId;
          completedEmail.current = address;
        }
        else if (!signingUp && current()) {
          const security = signInSecurityMessage(result.status);
          if (security) { setError(security); setNeedsAlternativeSignIn(true); return; }
        }
      }
      if (!current()) return;
      if (!completedSession.current || !activate) {
        setError(signingUp ? 'We could not finish creating your account. Please try again.' : 'That code did not work. Please try again.');
        return;
      }
      // A verified code is consumed. If session activation fails, retry that
      // session instead of attempting the same one-time code a second time.
      activating.current = true;
      try {
        await activate({ session: completedSession.current });
      } finally {
        activating.current = false;
      }
    }, 'We could not verify that code. Please try again.');
  };

  const resendCode = async () => {
    if (!authReady || completedSession.current || needsAlternativeSignIn) return;
    await runRequest(async (current) => {
      if (signingUp) {
        if (!signUp) return;
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      } else {
        if (!signIn || !signInAddress.current) return;
        const attempt = emailAddressId
          ? await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId })
          : await signIn.create({ identifier: signInAddress.current, strategy: 'email_code' });
        if (!current()) return;
        const security = signInSecurityMessage(attempt.status);
        if (security) { setError(security); setNeedsAlternativeSignIn(true); return; }
        if (attempt.status !== 'needs_first_factor' || attempt.firstFactorVerification?.strategy !== 'email_code'
          || attempt.firstFactorVerification.status !== 'unverified') {
          setError('We could not send another code. Go back and try signing in again.');
          return;
        }
        const factor = attempt.supportedFirstFactors?.find(item => item.strategy === 'email_code');
        setEmailAddressId(factor?.strategy === 'email_code' ? factor.emailAddressId : null);
      }
      if (current()) {
        setCode('');
        setNotice('We sent a new code. Check your email.');
      }
    }, 'We could not send another code. Please try again.');
  };

  const back = () => {
    if (!mounted.current || activating.current) return;
    requestVersion.current += 1;
    inFlight.current = false;
    setBusy(false);
    if (step === 'code') {
      setStep('form');
      setCode('');
      completedSession.current = null;
      completedEmail.current = null;
      verificationEmail.current = null;
      signInAddress.current = null;
      setEmailAddressId(null);
      setNeedsAlternativeSignIn(false);
      setError(null);
      setNotice(null);
      return;
    }
    router.replace({ pathname: '/', params: { welcome: 'business' } });
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenShell
        title={step === 'code' ? 'Check your email' : signingUp ? 'Make your account' : 'Welcome back'}
        subtitle={step === 'code' ? 'We sent a 6-digit code to ' + email.trim() + '.' : signingUp ? 'Two minutes. No card needed.' : 'Sign in to manage your website.'}
        onBack={back}
        headerRight={<TendsoMark />}
      >
        <View style={styles.form}>
          {step === 'form' ? (
            <>
              {signingUp ? (
                <Field
                  label="Your name"
                  variant="outlined"
                  icon="person-outline"
                  placeholder="Your full name"
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                  textContentType="name"
                  autoCapitalize="words"
                  maxLength={100}
                  returnKeyType="next"
                  onSubmitEditing={() => emailInput.current?.focus()}
                  editable={intakeReady && !busy}
                />
              ) : null}
              <Field
                ref={emailInput}
                label="Email"
                variant="outlined"
                icon="mail-outline"
                placeholder="you@example.com"
                value={email}
                onChangeText={value => {
                  if (value.trim().toLowerCase() !== email.trim().toLowerCase()) {
                    completedSession.current = null;
                    completedEmail.current = null;
                    verificationEmail.current = null;
                    signInAddress.current = null;
                    setEmailAddressId(null);
                    setNeedsAlternativeSignIn(false);
                  }
                  onChangeEmail(value);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={sendCode}
                helper="We'll email you a 6-digit code."
                editable={intakeReady && !busy}
              />
            </>
          ) : (
            <CodeBoxes value={code} onChangeText={(value) => setCode(value.slice(0, 6))} editable={!busy && !completedSession.current && !needsAlternativeSignIn} accessibilityLabel="Verification code" />
          )}
          {error ? <Banner tone="danger" body={error} /> : null}
          {isOffline ? <Banner tone="warn" body="You're offline. Reconnect to sign in or request an email code." /> : null}
          {notice ? <Banner tone="info" body={notice} /> : null}
          {needsAlternativeSignIn ? (
            <AuthLink label="More sign-in options" disabled={busy} onPress={() => router.replace('/(auth)/login')} />
          ) : null}
          {step === 'form' ? (
            <>
              <Text variant="label" weight="medium" tone="muted" align="center" style={styles.consent}>
                {'By continuing, you agree to our '}
                <Text variant="label" weight="bold" style={styles.underline} accessibilityRole="link" onPress={() => void openExternalUrl(TERMS_URL)}>Terms of Service</Text>
                {' and '}
                <Text variant="label" weight="bold" style={styles.underline} accessibilityRole="link" onPress={() => void openExternalUrl(PRIVACY_URL)}>Privacy Policy</Text>.
              </Text>
              <Button title={signingUp ? 'Create account' : completedSession.current ? 'Finish sign-in' : 'Send sign-in code'} onPress={sendCode} disabled={isOffline || !authReady || !emailOk || (signingUp && !nameOk)} loading={busy} />
              <View style={styles.modeSwitch}>
                <Text variant="label" weight="medium" tone="muted">{signingUp ? 'Already have an account?' : 'New to Tendso?'}</Text>
                <AuthLink label={signingUp ? 'Log in' : 'Make an account'} disabled={busy} onPress={() => router.replace({ pathname: '/(auth)/owner', params: { mode: signingUp ? 'signin' : 'signup' } })} />
              </View>
            </>
          ) : (
            <>
              <Button title="Continue" onPress={verify} disabled={isOffline || !authReady || code.length !== 6 || needsAlternativeSignIn} loading={busy} />
              <AuthLink label="Send a new code" disabled={isOffline || busy || !!completedSession.current || needsAlternativeSignIn} onPress={resendCode} />
            </>
          )}
        </View>
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: space.lg },
  consent: { lineHeight: 24 },
  underline: { textDecorationLine: 'underline' },
  modeSwitch: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: space.sm },
});
