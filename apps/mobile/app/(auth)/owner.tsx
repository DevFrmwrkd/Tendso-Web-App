/**
 * Owner sign up / sign in with Clerk EMAIL CODE (no password, no SMS — Theo, Q12).
 * One screen, two steps: name + email → the 6-digit code. Existing owners get a
 * sign-in code, new ones a sign-up code; the root layout then routes to /(owner).
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import { Button, ScreenShell, Text } from '../../components/v2';
import { Field } from '../../components/v2/owner/OwnerUI';
import { ownerIntake, setOwnerIntent } from '../../lib/v2/ownerIntake';
import { PRIVACY_URL, TERMS_URL } from '../../services/links';
import { space } from '../../theme/v2';

type Mode = 'signIn' | 'signUp';

function clerkMessage(err: any, fallback: string): string {
  return err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || fallback;
}

export default function OwnerAuthScreen() {
  const router = useRouter();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState(ownerIntake.get().ownerName ?? '');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // This person has a business: the root layout sends them to the owner app after sign-in.
  useEffect(() => { void setOwnerIntent(true); }, []);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const sendCode = async () => {
    if (!signInLoaded || !signUpLoaded || !signIn || !signUp) return;
    setBusy(true);
    setError(null);
    ownerIntake.set({ ownerName: name.trim() || undefined });
    const address = email.trim().toLowerCase();
    try {
      const attempt = await signIn.create({ identifier: address });
      const factor: any = attempt.supportedFirstFactors?.find((f: any) => f.strategy === 'email_code');
      if (!factor) throw new Error('This email signs in another way. Use "I already have an account".');
      await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
      setMode('signIn');
      setStep('code');
    } catch (err: any) {
      const notFound = err?.errors?.some((e: any) => e.code === 'form_identifier_not_found');
      if (!notFound) {
        setError(clerkMessage(err, 'We could not send a code. Try again.'));
        setBusy(false);
        return;
      }
      try {
        const [firstName, ...rest] = name.trim().split(/\s+/);
        await signUp.create({ emailAddress: address, ...(firstName ? { firstName, lastName: rest.join(' ') || undefined } : {}) });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setMode('signUp');
        setStep('code');
      } catch (e: any) {
        setError(clerkMessage(e, 'We could not send a code. Try again.'));
      }
    }
    setBusy(false);
  };

  const verify = async () => {
    if (!signIn || !signUp) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signIn') {
        const res = await signIn.attemptFirstFactor({ strategy: 'email_code', code: code.trim() });
        if (res.status === 'complete' && res.createdSessionId) {
          await setSignInActive?.({ session: res.createdSessionId });
          return;
        }
        setError('That code did not work. Try again.');
      } else {
        const res = await signUp.attemptEmailAddressVerification({ code: code.trim() });
        if (res.status === 'complete' && res.createdSessionId) {
          await setSignUpActive?.({ session: res.createdSessionId });
          return;
        }
        // The Clerk instance asks for more than an email (e.g. a password): owners cannot finish here.
        setError(`We need a little more: ${(res.missingFields || []).join(', ') || 'please try again'}.`);
      }
    } catch (err: any) {
      setError(clerkMessage(err, 'That code did not work. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const back = async () => {
    if (step === 'code') {
      setStep('email');
      setCode('');
      setError(null);
      return;
    }
    await setOwnerIntent(false);
    router.replace({ pathname: '/', params: { welcome: '1' } });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {step === 'email' ? (
        <ScreenShell
          title="Make your account"
          subtitle="We email you a code. No password."
          onBack={back}
          footer={
            <>
              <Button title="Send my code" onPress={sendCode} disabled={!emailOk} loading={busy} />
              <Text variant="label" tone="muted" align="center">
                {'By going on you agree to the '}
                <Text variant="label" weight="bold" onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link">Terms</Text>
                {' and '}
                <Text variant="label" weight="bold" onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">Privacy</Text>
              </Text>
            </>
          }
        >
          <View style={{ gap: space.lg }}>
            <Field label="Your name" icon="person-outline" value={name} onChangeText={setName} autoComplete="name" textContentType="name" returnKeyType="next" />
            <Field
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={emailOk ? sendCode : undefined}
            />
            {error ? <Text tone="danger">{error}</Text> : null}
          </View>
        </ScreenShell>
      ) : (
        <ScreenShell
          title="Check your email"
          subtitle={`We sent a code to ${email.trim()}.`}
          onBack={back}
          footer={<Button title="Continue" onPress={verify} disabled={code.trim().length < 6} loading={busy} />}
        >
          <View style={{ gap: space.lg }}>
            <Field
              label="Code"
              icon="key-outline"
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoFocus
              maxLength={6}
            />
            {error ? <Text tone="danger">{error}</Text> : null}
            <Pressable onPress={sendCode} accessibilityRole="button" hitSlop={8} style={{ minHeight: 48, justifyContent: 'center' }}>
              <Text weight="bold">Send a new code</Text>
            </Pressable>
          </View>
        </ScreenShell>
      )}
    </KeyboardAvoidingView>
  );
}
