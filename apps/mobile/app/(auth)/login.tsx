import React, { useState, useCallback, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSignIn, useSignUp, useSSO } from '@clerk/clerk-expo';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { GuardedLink } from '../../components/GuardedLink';
import { useAppleAuth } from '../../hooks/useAppleAuth';
import { openExternalUrl, TERMS_URL, PRIVACY_URL } from '../../services/links';
import { Banner, Button, Field, ScreenShell, TendsoMark, Text } from '../../components/v2';
import {
  AuthLink,
  GooglePill,
  SocialPill,
  OrDivider,
  PasswordEye,
  SOCIAL_HEIGHT,
  SOCIAL_RADIUS,
  TikTokProfileSheet,
} from '../../components/v2/AuthParts';
import { TikTokLogo } from '@/components/TikTokLogo';
import { space } from '../../theme/v2';

WebBrowser.maybeCompleteAuthSession();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+63|0)?9\d{9}$/;

// The TikTok button is switched off today (it was commented out before the restyle too). The handler
// and the profile sheet stay wired so turning it on is a one-line change.
const TIKTOK_ENABLED = false;

export default function LoginScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive } = useSignUp();
  const { startSSOFlow: startGoogleSSOFlow } = useSSO();
  const { startSSOFlow: startTikTokSSOFlow } = useSSO();
  // Native Apple sign-in. Required by App Store Guideline 4.8 because we
  // offer Google sign-in. Uses our own hook rather than Clerk's
  // useSignInWithApple, which discards the name Apple returns.
  const { startAppleAuth } = useAppleAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  // Sign in with Apple is iOS-only (and unavailable on older iOS / some
  // simulators), so we only render the button once the device confirms support.
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [error, setError] = useState('');

  // TikTok complete profile modal
  const ssoSignUpRef = useRef<any>(null);
  const ssoSetActiveRef = useRef<any>(null);
  const [showTikTokProfile, setShowTikTokProfile] = useState(false);
  const [ttStep, setTtStep] = useState<'profile' | 'verify'>('profile');
  const [ttFirstName, setTtFirstName] = useState('');
  const [ttLastName, setTtLastName] = useState('');
  const [ttEmail, setTtEmail] = useState('');
  const [ttPhone, setTtPhone] = useState('');
  const [ttCode, setTtCode] = useState('');
  const [ttLoading, setTtLoading] = useState(false);
  const [ttError, setTtError] = useState('');

  const handleLogin = async () => {
    if (!isLoaded) return;
    if (!email.trim() || !password) { setError('Please fill in all fields'); return; }

    setLoading(true);
    setError('');
    try {
      let result = await signIn.create({ identifier: email.trim(), password });

      // On a COLD Clerk client, create({ identifier, password }) doesn't always
      // verify the password inline — it returns needs_first_factor and expects an
      // explicit attemptFirstFactor to finish. That's the reported bug: password
      // login failed on a fresh app but worked after any successful sign-in
      // (Google) warmed the client. Complete the password factor explicitly
      // instead of giving up. A wrong password throws here → handled by catch.
      if (result.status !== 'complete') {
        const canPassword = ((result as any).supportedFirstFactors ?? []).some(
          (f: any) => f.strategy === 'password',
        );
        if (canPassword) {
          result = await signIn.attemptFirstFactor({ strategy: 'password', password });
        }
      }

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
      } else {
        // Still not complete without throwing. The common case: an Apple/Google
        // account with NO password — the strategy can't complete (password is
        // absent from supportedFirstFactors). Telling the user to "try again" is
        // wrong; point them at the real path.
        const hasPasswordFactor = ((result as any).supportedFirstFactors ?? []).some(
          (f: any) => f.strategy === 'password',
        );
        if (!hasPasswordFactor) {
          setError(
            "This account signs in with Apple or Google — use the Apple or Google button below. To use a password, sign in that way first, then set one from your profile.",
          );
        } else {
          setError('Sign in incomplete. Please try again.');
        }
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to sign in');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const handleAppleSignIn = useCallback(async () => {
    if (appleLoading) return;
    setAppleLoading(true);
    setError('');
    try {
      const { createdSessionId, setActive } = await startAppleAuth();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      } else {
        // A null session is NOT a failure — it means the user dismissed
        // Apple's sheet (or Clerk wasn't loaded yet). Showing an error here
        // would scold someone for tapping Cancel. Genuine failures throw and
        // are handled in the catch below.
        setAppleLoading(false);
      }
    } catch (err: any) {
      // Tapping Cancel on the Apple sheet throws — that's not an error state.
      const code = err?.code ?? '';
      if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') {
        setAppleLoading(false);
        return;
      }
      console.error('Apple sign in error:', JSON.stringify(err, null, 2));
      setError(
        err?.errors?.[0]?.longMessage ||
          err?.errors?.[0]?.message ||
          err?.message ||
          'Failed to sign in with Apple',
      );
      setAppleLoading(false);
    }
  }, [appleLoading, startAppleAuth]);

  const handleGoogleSignIn = useCallback(async () => {
    if (googleLoading) return;
    if (!isLoaded) {
      setError('Authentication is still loading. Please wait a moment and try again.');
      return;
    }
    setGoogleLoading(true);
    setError('');
    try {
      const redirectUrl = Linking.createURL('/', { scheme: 'negosyodigital' });
      console.log('[Google SignIn] Starting SSO flow, isLoaded:', isLoaded, 'redirect:', redirectUrl);

      const result = await startGoogleSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });

      console.log('[Google SignIn] SSO result:', JSON.stringify({
        createdSessionId: result.createdSessionId,
        signInStatus: result.signIn?.status,
        signUpStatus: result.signUp?.status,
      }));
      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
      } else {
        setError('Google sign-in did not complete. Please try again.');
        setGoogleLoading(false);
      }
    } catch (err: any) {
      console.error('Google sign in error:', JSON.stringify(err, null, 2));
      const rawMsg = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || err.message || 'Failed to sign in with Google';
      // Clerk throws this exact string when Google OAuth isn't configured on
      // the production Clerk instance (custom Google OAuth credentials missing).
      // Surface a creator-friendly message instead of the raw SDK error.
      const friendly = /Missing external verification redirect URL/i.test(rawMsg)
        ? 'Google sign-in is temporarily unavailable. Please use email sign-in or contact support.'
        : rawMsg;
      setError(friendly);
      setGoogleLoading(false);
    }
  }, [googleLoading, startGoogleSSOFlow]);

  const handleTikTokSignIn = useCallback(async () => {
    if (tiktokLoading) return;
    setTiktokLoading(true);
    setError('');

    try {
      const result = await startTikTokSSOFlow({
        strategy: 'oauth_tiktok',
        redirectUrl: Linking.createURL('/', { scheme: 'negosyodigital' }),
      });

      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        return;
      }

      // TikTok OAuth succeeded but missing fields (email, name)
      // Store the SSO signUp + setActive references for the modal
      if (result.signUp?.status === 'missing_requirements') {
        ssoSignUpRef.current = result.signUp;
        ssoSetActiveRef.current = result.setActive;
        setTtFirstName(result.signUp.firstName || '');
        setTtLastName(result.signUp.lastName || '');
        setTtEmail('');
        setTtPhone('');
        setTtCode('');
        setTtError('');
        setTtStep('profile');
        setShowTikTokProfile(true);
        setTiktokLoading(false);
        return;
      }

      setTiktokLoading(false);
    } catch (err: any) {
      console.error('TikTok sign in error:', err);
      setError(err.errors?.[0]?.message || 'Failed to sign in with TikTok');
      setTiktokLoading(false);
    }
  }, [tiktokLoading, startTikTokSSOFlow]);

  // Step 1: Submit profile info
  const handleTikTokSubmitProfile = async () => {
    if (!ttFirstName.trim() || ttFirstName.trim().length < 2) {
      setTtError('First name is required (min 2 characters)'); return;
    }
    if (!ttLastName.trim() || ttLastName.trim().length < 2) {
      setTtError('Last name is required (min 2 characters)'); return;
    }
    if (!ttEmail.trim() || !EMAIL_REGEX.test(ttEmail.trim())) {
      setTtError('Please enter a valid email address'); return;
    }
    if (ttPhone.trim() && !PHONE_REGEX.test(ttPhone.replace(/\s/g, ''))) {
      setTtError('Please enter a valid PH phone number'); return;
    }

    setTtLoading(true);
    setTtError('');

    try {
      const su = ssoSignUpRef.current;
      if (!su) { setTtError('Session expired. Please try again.'); setTtLoading(false); return; }

      // Update the SSO sign-up with the missing fields
      await su.update({
        firstName: ttFirstName.trim(),
        lastName: ttLastName.trim(),
        emailAddress: ttEmail.trim(),
      });

      console.log('After update - status:', su.status, 'missing:', su.missingFields, 'unverified:', su.unverifiedFields, 'sessionId:', su.createdSessionId);

      // If session is ready (no email verification required)
      if (su.createdSessionId) {
        const setActiveFn = ssoSetActiveRef.current || setSignUpActive;
        await setActiveFn({ session: su.createdSessionId });
        setShowTikTokProfile(false);
        return;
      }

      // If email needs verification, prepare it and show code input
      if (su.status === 'missing_requirements' && su.unverifiedFields?.includes('email_address')) {
        await su.prepareEmailAddressVerification({ strategy: 'email_code' });
        setTtStep('verify');
        setTtLoading(false);
        return;
      }

      // Check what's still missing
      console.log('Still missing:', su.missingFields, 'Status:', su.status);
      setTtError(`Missing: ${(su.missingFields || []).join(', ') || 'unknown'}. Try again.`);
      setTtLoading(false);
    } catch (err: any) {
      console.error('TikTok profile error:', err);
      setTtError(err.errors?.[0]?.message || 'Failed to update profile');
      setTtLoading(false);
    }
  };

  // Step 2: Verify email code
  const handleTikTokVerifyEmail = async () => {
    if (!ttCode || ttCode.length < 6) {
      setTtError('Please enter the 6-digit code'); return;
    }

    setTtLoading(true);
    setTtError('');

    try {
      const su = ssoSignUpRef.current;
      if (!su) { setTtError('Session expired. Please try again.'); setTtLoading(false); return; }

      const result = await su.attemptEmailAddressVerification({ code: ttCode });

      console.log('After verify - status:', result.status, 'sessionId:', result.createdSessionId);

      if (result.status === 'complete' && result.createdSessionId) {
        const setActiveFn = ssoSetActiveRef.current || setSignUpActive;
        await setActiveFn({ session: result.createdSessionId });
        setShowTikTokProfile(false);
        return;
      }

      // Also check original signUp object
      if (su.createdSessionId) {
        const setActiveFn = ssoSetActiveRef.current || setSignUpActive;
        await setActiveFn({ session: su.createdSessionId });
        setShowTikTokProfile(false);
        return;
      }

      setTtError('Verification failed. Please try again.');
      setTtLoading(false);
    } catch (err: any) {
      console.error('TikTok verify error:', err);
      setTtError(err.errors?.[0]?.message || 'Invalid code');
      setTtLoading(false);
    }
  };

  const closeTikTokModal = () => {
    setShowTikTokProfile(false);
    setTiktokLoading(false);
    ssoSignUpRef.current = null;
    ssoSetActiveRef.current = null;
  };

  const busy = loading || googleLoading || tiktokLoading || appleLoading;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenShell>
        <View style={styles.head}>
          <TendsoMark size={52} />
          <Text variant="display" accessibilityRole="header">
            Welcome back
          </Text>
          <Text variant="bodyLg" tone="ink2">
            Sign in to see your sites and what you earned.
          </Text>
        </View>

        {error ? <Banner tone="danger" body={error} style={styles.banner} /> : null}

        <View style={styles.fields}>
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
            accessibilityLabel="Email"
          />
          <Field
            label="Password"
            icon="lock-closed-outline"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
            accessibilityLabel="Password"
            right={<PasswordEye shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
          />
        </View>

        <GuardedLink href="/(auth)/forgot-password" asChild>
          <AuthLink label="Forgot password?" align="right" accessibilityLabel="Forgot password" />
        </GuardedLink>

        <Button
          title="Sign in"
          loading={loading}
          disabled={busy}
          onPress={handleLogin}
          style={styles.primary}
        />

        <OrDivider />

        {/* Sign in with Apple is required by App Store Guideline 4.8 since we offer Google. Apple's
            OFFICIAL button: the HIG mandates their exact mark and wording, so we don't draw our own.
            It sits ABOVE Google (HIG: at least as prominent) and shares its height and pill radius. */}
        <View style={styles.social}>
          {Platform.OS === 'ios' && appleAvailable && (
            <View style={{ opacity: appleLoading ? 0.6 : 1 }}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={SOCIAL_RADIUS}
                style={styles.apple}
                onPress={handleAppleSignIn}
              />
            </View>
          )}
          <GooglePill onPress={handleGoogleSignIn} disabled={busy} loading={googleLoading} />
          {TIKTOK_ENABLED ? (
            <SocialPill
              logo={<TikTokLogo size={22} />}
              label="Continue with TikTok"
              onPress={handleTikTokSignIn}
              disabled={busy}
              loading={tiktokLoading}
            />
          ) : null}
        </View>

        {/* Consent line. Apple/Google sign-in silently creates an account when none exists (Clerk
            transfers the OAuth identity into a signUp), so a first-time user can reach the app without
            seeing the signup screen's terms checkbox. This line is that user's consent. */}
        <Text variant="label" weight="medium" tone="muted" align="center" style={styles.consent}>
          By continuing, you agree to our{' '}
          <Text
            variant="label"
            weight="bold"
            accessibilityRole="link"
            style={styles.underline}
            onPress={() => void openExternalUrl(TERMS_URL)}
          >
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text
            variant="label"
            weight="bold"
            accessibilityRole="link"
            style={styles.underline}
            onPress={() => void openExternalUrl(PRIVACY_URL)}
          >
            Privacy Policy
          </Text>
          .
        </Text>

        <View style={styles.alt}>
          <Text variant="body" weight="semibold" tone="ink2">
            New to Tendso?
          </Text>
          <GuardedLink href="/(auth)/signup" asChild>
            <AuthLink label="Make an account" />
          </GuardedLink>
        </View>
      </ScreenShell>

      <TikTokProfileSheet
          visible={showTikTokProfile}
          step={ttStep}
          firstName={ttFirstName}
          lastName={ttLastName}
          email={ttEmail}
          phone={ttPhone}
          code={ttCode}
          onChangeFirstName={setTtFirstName}
          onChangeLastName={setTtLastName}
          onChangeEmail={setTtEmail}
          onChangePhone={setTtPhone}
          onChangeCode={setTtCode}
          loading={ttLoading}
          error={ttError}
          onSubmitProfile={handleTikTokSubmitProfile}
          onVerify={handleTikTokVerifyEmail}
          onBackToProfile={() => {
            setTtStep('profile');
            setTtError('');
            setTtCode('');
          }}
          onClose={closeTikTokModal}
        />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { gap: space.sm, marginBottom: space.xl },
  banner: { marginBottom: space.lg },
  fields: { gap: space.md },
  primary: { marginTop: space.sm },
  social: { gap: space.md },
  apple: { height: SOCIAL_HEIGHT, width: '100%' },
  consent: { marginTop: space.xl - 4, paddingHorizontal: space.sm, lineHeight: 24 },
  underline: { textDecorationLine: 'underline' },
  alt: {
    marginTop: space.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
