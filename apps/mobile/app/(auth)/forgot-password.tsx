import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { GuardedLink } from '../../components/GuardedLink';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConvex } from 'convex/react';
import { api } from '@tendso/convex-client';
import { Display, Body, Label, Door, EditorialField } from '@/components/ui/primitives';
import { colors, fonts, radius } from '@/theme/tokens';

type Step = 'email' | 'reset';

export default function ForgotPasswordScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
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
      setStep('reset');
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

  // ── Email step ────────────────────────────────────────────────────────────
  if (step === 'email') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.paper }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 28,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back link */}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Back to Sign In"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={16} color={colors.ink3} />
            <View style={{ marginLeft: 8 }}>
              <Label color={colors.ink3} tracking={1.4}>BACK</Label>
            </View>
          </TouchableOpacity>

          {/* Editorial header */}
          <Label tracking={1.8} style={{ marginBottom: 18 }}>RECOVERY</Label>

          <View style={{ marginBottom: 12 }}>
            <Display size="lg">Forgot it</Display>
            <Display size="lg" italic color={colors.accent}>happens.</Display>
          </View>

          <Body size="md" color={colors.ink2} style={{ marginBottom: 32, maxWidth: 340 }}>
            Drop your email and we'll send a 6-digit code to get you back in.
          </Body>

          {error ? (
            <View
              style={{
                backgroundColor: colors.dangerBg,
                borderColor: colors.danger,
                borderWidth: 1,
                borderRadius: radius.sm,
                padding: 14,
                marginBottom: 18,
              }}
            >
              <Body size="sm" color={colors.danger} weight="medium">{error}</Body>
            </View>
          ) : null}

          <View style={{ marginBottom: 28 }}>
            <EditorialField
              icon="mail-outline"
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              accessibilityLabel="Email Address"
              label="EMAIL ADDRESS"
            />
          </View>

          <Door
            caption="SEND CODE"
            label={loading ? 'Sending…' : 'Send reset code'}
            variant="solid"
            loading={loading}
            disabled={loading}
            onPress={handleSendCode}
            rightIcon={loading ? <ActivityIndicator color={colors.paper3} /> : undefined}
          />

          <View
            style={{
              marginTop: 28,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'baseline',
            }}
          >
            <Body size="sm" color={colors.ink3}>Remembered it? </Body>
            <GuardedLink href="/(auth)/login" asChild>
              <TouchableOpacity hitSlop={6} accessibilityLabel="Sign In" accessibilityRole="button">
                <Body size="sm" weight="medium" color={colors.accent}>Sign in →</Body>
              </TouchableOpacity>
            </GuardedLink>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Reset step ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back link */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}
          onPress={() => {
            setStep('email');
            setCode('');
            setNewPassword('');
            setConfirmPassword('');
            setError('');
          }}
          hitSlop={8}
          accessibilityLabel="Use a different email"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={16} color={colors.ink3} />
          <View style={{ marginLeft: 8 }}>
            <Label color={colors.ink3} tracking={1.4}>USE A DIFFERENT EMAIL</Label>
          </View>
        </TouchableOpacity>

        {/* Editorial header */}
        <Label tracking={1.8} style={{ marginBottom: 18 }}>RECOVERY</Label>

        <View style={{ marginBottom: 12 }}>
          <Display size="lg">Reset</Display>
          <Display size="lg" italic color={colors.accent}>your password.</Display>
        </View>

        <Body size="md" color={colors.ink2} style={{ marginBottom: 28 }}>
          We sent a 6-digit code to{' '}
          <Body size="md" weight="medium" color={colors.ink}>{email}</Body>
          . Enter it below with your new password.
        </Body>

        {error ? (
          <View
            style={{
              backgroundColor: colors.dangerBg,
              borderColor: colors.danger,
              borderWidth: 1,
              borderRadius: radius.sm,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <Body size="sm" color={colors.danger} weight="medium">{error}</Body>
          </View>
        ) : null}

        {resendSuccess ? (
          <View
            style={{
              backgroundColor: colors.accentBg,
              borderColor: colors.accent,
              borderWidth: 1,
              borderRadius: radius.sm,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <Body size="sm" color={colors.accentInk} weight="medium">
              A new code has been sent to your email.
            </Body>
          </View>
        ) : null}

        {/* Code Input */}
        <View style={{ marginBottom: 18 }}>
          <TextInput
            style={{
              backgroundColor: colors.paper3,
              borderColor: colors.rule,
              borderWidth: 1,
              borderRadius: radius.sm,
              paddingHorizontal: 16,
              height: 68,
              textAlign: 'center',
              fontFamily: fonts.mono,
              fontSize: 28,
              letterSpacing: 12,
              color: colors.ink,
            }}
            placeholder="000000"
            placeholderTextColor={colors.ink3}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            accessibilityLabel="Reset Code"
          />
          <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
            <Label>6-DIGIT CODE</Label>
          </View>
        </View>

        {/* New Password */}
        <View style={{ marginBottom: 18 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.paper3,
              borderColor: colors.rule,
              borderWidth: 1,
              borderRadius: radius.sm,
              paddingHorizontal: 14,
              height: 54,
            }}
          >
            <Ionicons name="lock-closed-outline" size={18} color={colors.ink3} />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontFamily: fonts.sans, fontSize: 15, color: colors.ink }}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.ink3}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
              accessibilityLabel="New Password"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.ink3} />
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
            <Label>NEW PASSWORD</Label>
          </View>
        </View>

        {/* Confirm Password */}
        <View style={{ marginBottom: 28 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.paper3,
              borderColor: colors.rule,
              borderWidth: 1,
              borderRadius: radius.sm,
              paddingHorizontal: 14,
              height: 54,
            }}
          >
            <Ionicons name="lock-closed-outline" size={18} color={colors.ink3} />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontFamily: fonts.sans, fontSize: 15, color: colors.ink }}
              placeholder="Confirm your new password"
              placeholderTextColor={colors.ink3}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
              accessibilityLabel="Confirm New Password"
            />
          </View>
          <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
            <Label>CONFIRM</Label>
          </View>
        </View>

        <Door
          caption="RESET"
          label={loading ? 'Resetting…' : 'Reset password'}
          variant="accent"
          loading={loading}
          disabled={loading}
          onPress={handleReset}
          rightIcon={loading ? <ActivityIndicator color="#fff" /> : undefined}
        />

        <TouchableOpacity
          style={{
            marginTop: 16,
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: colors.rule,
            borderWidth: 1,
            borderRadius: radius.sm,
          }}
          onPress={handleResend}
          disabled={loading || resendLoading}
          accessibilityLabel="Resend Code"
          accessibilityRole="button"
        >
          {resendLoading ? (
            <ActivityIndicator color={colors.ink3} size="small" />
          ) : (
            <Body size="sm" color={colors.ink2}>Didn't receive it? Resend code</Body>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
