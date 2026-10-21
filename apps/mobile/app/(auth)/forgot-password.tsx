import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { GuardedLink } from '../../components/GuardedLink';
import { useConvex } from 'convex/react';
import { api } from '@tendso/convex-client';
import { Banner, Button, Field, ScreenShell, Text } from '../../components/v2';
import { AuthLink, CodeBoxes, PasswordEye } from '../../components/v2/AuthParts';
import { space } from '../../theme/v2';

// One thing per step: the email, then the 6-digit code, then the new password.
// Clerk takes the code and the new password in ONE call (attemptFirstFactor), so the code step only
// checks the code looks complete and moves on; the call happens on the password step.
type Step = 'email' | 'code' | 'password';

export default function ForgotPasswordScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useGuardedRouter();
  const convex = useConvex();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // ── Step 1: Send reset code ──────────────────────────────────────────────
  const handleSendCode = async () => {
    if (!isLoaded) return;

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isDeleted = await convex.query(api.creators.isDeletedByEmail, {
        email: email.trim().toLowerCase(),
      });
      if (isDeleted) {
        setError('Account does not exist.');
        setLoading(false);
        return;
      }

      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setStep('code');
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setError(err.errors?.[0]?.message || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend code ──────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!isLoaded || resendLoading) return;
    setResendLoading(true);
    setError('');
    setResendSuccess(false);

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to resend code');
    } finally {
      setResendLoading(false);
    }
  };

  // ── Step 2: Verify code + set new password ───────────────────────────────
  const handleReset = async () => {
    if (!isLoaded) return;

    if (!code.trim()) {
      setError('Please enter the reset code');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password: newPassword,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else {
        setError('Reset incomplete. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err.errors?.[0]?.message || 'Failed to reset password');
      setLoading(false);
    }
  };

  // ── Step 2: the 6-digit code (checked for length here; Clerk checks it with the new password) ──
  const handleCodeNext = () => {
    if (code.trim().length < 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setError('');
    setStep('password');
  };

  const errorBanner = error ? <Banner tone="danger" body={error} style={styles.banner} /> : null;

  // ── Email step ────────────────────────────────────────────────────────────
  if (step === 'email') {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenShell
          title="Forgot your password?"
          subtitle="Type your email. We'll send a 6-digit code."
          onBack={() => router.back()}
          footer={<Button title="Send code" loading={loading} onPress={handleSendCode} />}
        >
          {errorBanner}
          <Field
            label="Email"
            icon="mail-outline"
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            accessibilityLabel="Email Address"
          />
          <View style={styles.alt}>
            <Text variant="body" weight="semibold" tone="ink2">
              Remembered it?
            </Text>
            <GuardedLink href="/(auth)/login" asChild>
              <AuthLink label="Sign in" accessibilityLabel="Sign In" />
            </GuardedLink>
          </View>
        </ScreenShell>
      </KeyboardAvoidingView>
    );
  }

  // ── Code step ─────────────────────────────────────────────────────────────
  if (step === 'code') {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenShell
          title="Type the code"
          subtitle={`We sent 6 digits to ${email}`}
          onBack={() => {
            setStep('email');
            setCode('');
            setNewPassword('');
            setConfirmPassword('');
            setError('');
          }}
          footer={<Button title="Continue" onPress={handleCodeNext} />}
        >
          {errorBanner}
          {resendSuccess ? <Banner tone="ok" body="A new code is on its way." style={styles.banner} /> : null}
          <CodeBoxes value={code} onChangeText={setCode} accessibilityLabel="Reset Code" />
          <View style={styles.resend}>
            <AuthLink
              label={resendLoading ? 'Sending…' : "Didn't receive it? Resend code"}
              accessibilityLabel="Resend Code"
              onPress={handleResend}
              disabled={loading || resendLoading}
            />
            <AuthLink
              label="Use a different email"
              tone="muted"
              onPress={() => {
                setStep('email');
                setCode('');
                setNewPassword('');
                setConfirmPassword('');
                setError('');
              }}
            />
          </View>
        </ScreenShell>
      </KeyboardAvoidingView>
    );
  }

  // ── New password step ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenShell
        title="Choose a new password"
        subtitle="At least 8 characters."
        onBack={() => {
          setStep('code');
          setError('');
        }}
        footer={<Button title="Reset password" loading={loading} onPress={handleReset} />}
      >
        {errorBanner}
        <View style={styles.fields}>
          <Field
            label="New password"
            icon="lock-closed-outline"
            placeholder="At least 8 characters"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
            accessibilityLabel="New Password"
            right={<PasswordEye shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
          />
          <Field
            label="Confirm password"
            icon="lock-closed-outline"
            placeholder="Type it again"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
            accessibilityLabel="Confirm New Password"
          />
        </View>
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: { marginBottom: space.lg },
  fields: { gap: space.md },
  resend: { marginTop: space.lg, gap: space.xs },
  alt: {
    marginTop: space.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
