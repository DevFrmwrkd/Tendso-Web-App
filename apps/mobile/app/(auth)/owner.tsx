/** Business signup and sign-in share Clerk email codes, with distinct forms. */
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import { Banner, Button, Field, ScreenShell, TendsoMark, Text } from '../../components/v2';
import { AuthLink, CodeBoxes } from '../../components/v2/AuthParts';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { ownerIntake, setOwnerIntent } from '../../lib/v2/ownerIntake';
import { openExternalUrl, PRIVACY_URL, TERMS_URL } from '../../services/links';
import { space } from '../../theme/v2';

type Mode = 'signup' | 'signin';

function hasClerkCode(error: any, code: string): boolean {
  return error?.errors?.some((item: any) => item.code === code) ?? false;
}

function clerkMessage(error: any, fallback: string): string {
  return error?.errors?.[0]?.longMessage || error?.errors?.[0]?.message || error?.message || fallback;
}

export default function OwnerAuthScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const formMode: Mode = mode === 'signup' ? 'signup' : 'signin';
  const [email, setEmail] = useState('');
  // Keep the address when switching modes, but reset verification and errors.
  return <OwnerAuthForm key={formMode} mode={formMode} email={email} onChangeEmail={setEmail} />;
}

function OwnerAuthForm({ mode, email, onChangeEmail }: { mode: Mode; email: string; onChangeEmail: (value: string) => void }) {
  const router = useGuardedRouter();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [name, setName] = useState(ownerIntake.get().ownerName ?? '');
  const [code, setCode] = useState('');
  const [emailAddressId, setEmailAddressId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsAlternativeSignIn, setNeedsAlternativeSignIn] = useState(false);
  const emailInput = useRef<TextInput>(null);
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const inFlight = useRef(false);
  const signingUp = mode === 'signup';
  const authReady = signingUp ? signUpLoaded : signInLoaded;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nameOk = name.trim().length > 0 && name.trim().length <= 100;

  useEffect(() => {
    mounted.current = true;
    void setOwnerIntent(true);
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
    };
  }, []);

  // Ignore late responses after Back or mode changes; prevent duplicate sends.
  const runRequest = async (work: (current: () => boolean) => Promise<void>, fallback: string) => {
    if (inFlight.current) return;
    const version = ++requestVersion.current;
    const current = () => mounted.current && version === requestVersion.current;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work(current);
    } catch (err: any) {
      if (!current()) return;
      if (!signingUp && hasClerkCode(err, 'form_identifier_not_found')) {
        setError('We could not find an account with that email. Check it or make an account below.');
      } else if (signingUp && hasClerkCode(err, 'form_identifier_exists')) {
        setError('That email already has an account. Log in below.');
      } else {
        setError(clerkMessage(err, fallback));
      }
    } finally {
      if (current()) {
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
      if (signingUp) {
        if (!signUp) return;
        const [firstName, ...rest] = name.trim().split(/\s+/);
        ownerIntake.set({ ownerName: name.trim() });
        await signUp.create({ emailAddress: address, firstName, lastName: rest.join(' ') || undefined });
        if (!current()) return;
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      } else {
        if (!signIn) return;
        const attempt = await signIn.create({ identifier: address });
        if (!current()) return;
        const factor = attempt.supportedFirstFactors?.find((item) => item.strategy === 'email_code');
        if (!factor || factor.strategy !== 'email_code') {
          setError('This account uses a different sign-in method. Use your password, Apple or Google to continue.');
          setNeedsAlternativeSignIn(true);
          return;
        }
        setEmailAddressId(factor.emailAddressId);
        await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
      }
      if (current()) {
        setCode('');
        setStep('code');
      }
    }, 'We could not send a code. Please try again.');
  };

  const verify = async () => {
    if (!authReady || code.length !== 6) return;
    await runRequest(async (current) => {
      if (signingUp ? !signUp : !signIn) return;
      const result = signingUp
        ? await signUp!.attemptEmailAddressVerification({ code })
        : await signIn!.attemptFirstFactor({ strategy: 'email_code', code });
      if (!current()) return;
      const activate = signingUp ? setSignUpActive : setSignInActive;
      if (result.status === 'complete' && result.createdSessionId && activate) {
        await activate({ session: result.createdSessionId });
      } else {
        setError(signingUp ? 'We could not finish creating your account. Please try again.' : 'That code did not work. Please try again.');
      }
    }, 'We could not verify that code. Please try again.');
  };

  const resendCode = async () => {
    if (!authReady) return;
    await runRequest(async (current) => {
      if (signingUp) {
        if (!signUp) return;
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      } else {
        if (!signIn || !emailAddressId) return;
        await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId });
      }
      if (current()) {
        setCode('');
        setNotice('We sent a new code. Check your email.');
      }
    }, 'We could not send another code. Please try again.');
  };

  const back = () => {
    requestVersion.current += 1;
    inFlight.current = false;
    setBusy(false);
    if (step === 'code') {
      setStep('form');
      setCode('');
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
                  editable={!busy}
                />
              ) : null}
              <Field
                ref={emailInput}
                label="Email"
                variant="outlined"
                icon="mail-outline"
                placeholder="you@example.com"
                value={email}
                onChangeText={onChangeEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={sendCode}
                helper="We'll email you a 6-digit code."
                editable={!busy}
              />
            </>
          ) : (
            <CodeBoxes value={code} onChangeText={(value) => setCode(value.slice(0, 6))} editable={!busy} accessibilityLabel="Verification code" />
          )}
          {error ? <Banner tone="danger" body={error} /> : null}
          {notice ? <Banner tone="info" body={notice} /> : null}
          {needsAlternativeSignIn ? (
            <AuthLink label="Use password, Apple or Google" disabled={busy} onPress={() => router.replace('/(auth)/login')} />
          ) : null}
          {step === 'form' ? (
            <>
              <Text variant="label" weight="medium" tone="muted" align="center" style={styles.consent}>
                {'By continuing, you agree to our '}
                <Text variant="label" weight="bold" style={styles.underline} accessibilityRole="link" onPress={() => void openExternalUrl(TERMS_URL)}>Terms of Service</Text>
                {' and '}
                <Text variant="label" weight="bold" style={styles.underline} accessibilityRole="link" onPress={() => void openExternalUrl(PRIVACY_URL)}>Privacy Policy</Text>.
              </Text>
              <Button title={signingUp ? 'Create account' : 'Send sign-in code'} onPress={sendCode} disabled={!authReady || !emailOk || (signingUp && !nameOk)} loading={busy} />
              <View style={styles.modeSwitch}>
                <Text variant="label" weight="medium" tone="muted">{signingUp ? 'Already have an account?' : 'New to Tendso?'}</Text>
                <AuthLink label={signingUp ? 'Log in' : 'Make an account'} disabled={busy} onPress={() => router.replace({ pathname: '/(auth)/owner', params: { mode: signingUp ? 'signin' : 'signup' } })} />
              </View>
            </>
          ) : (
            <>
              <Button title="Continue" onPress={verify} disabled={!authReady || code.length !== 6} loading={busy} />
              <AuthLink label="Send a new code" disabled={busy} onPress={resendCode} />
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
