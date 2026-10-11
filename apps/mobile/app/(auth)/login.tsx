import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSignIn, useSignUp, useSSO } from '@clerk/clerk-expo';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GuardedLink } from '../../components/GuardedLink';
import { useAppleAuth } from '../../hooks/useAppleAuth';
import { openExternalUrl, TERMS_URL, PRIVACY_URL } from '../../services/links';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { TikTokLogo } from '@/components/TikTokLogo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Display, Body, Label, Door, Rule } from '@/components/ui/primitives';
import { colors, fonts, radius } from '@/theme/tokens';

WebBrowser.maybeCompleteAuthSession();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+63|0)?9\d{9}$/;

// Shared geometry for the social sign-in buttons so Apple's native button and
// our Google button stay identical in shape.
//
// NOTE: Apple's AppleAuthenticationButton renders its corners fully rounded
// regardless of a smaller `cornerRadius`, so we pin BOTH buttons to the pill
// radius (height / 2). Passing the same explicit value to each guarantees they
// match whether or not Apple honours the prop.
const BUTTON_HEIGHT = 54;
const BUTTON_RADIUS = BUTTON_HEIGHT / 2;
// Apple's button auto-sizes its own label (~0.4 x height) and exposes NO font
// control, so we can only approximate it on the Google side. Onest reads a
// little wider than SF Pro, so we sit just under Apple's ratio.
const BUTTON_LABEL_SIZE = 19;

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

export default function LoginScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive } = useSignUp();
  const { startSSOFlow: startGoogleSSOFlow } = useSSO();
  const { startSSOFlow: startTikTokSSOFlow } = useSSO();
  // Native Apple sign-in. Required by App Store Guideline 4.8 because we
  // offer Google sign-in. Uses our own hook rather than Clerk's
  // useSignInWithApple, which discards the name Apple returns.
  const { startAppleAuth } = useAppleAuth();
  const insets = useSafeAreaInsets();

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
            "This account signs in with Apple or Google — use that button above. To use a password, sign in that way first, then set one from your profile.",
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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial header — mono eyebrow + serif display */}
        {/* No LIVE badge here — that marker signals streaming data (Leads, Home,
            Wallet). Nothing on a sign-in screen is live, so it was just noise. */}
        <View style={{ marginBottom: 24 }}>
          <Label tracking={1.8}>SIGN IN</Label>
        </View>

        <View style={{ marginBottom: 8 }}>
          <Display size="lg">Welcome</Display>
          <Display size="lg" italic color={colors.accent}>back.</Display>
        </View>

        <Body size="md" color={colors.ink2} style={{ marginTop: 12, marginBottom: 32, maxWidth: 320 }}>
          Pick up where you left off. Your businesses are waiting.
        </Body>

        {/* Error banner */}
        {error ? (
          <View
            style={{
              backgroundColor: colors.dangerBg,
              borderColor: colors.danger,
              borderWidth: 1,
              borderRadius: radius.sm,
              padding: 14,
              marginBottom: 20,
            }}
          >
            <Body size="sm" color={colors.danger} weight="medium">{error}</Body>
          </View>
        ) : null}

        {/* Email */}
        <View style={{ marginBottom: 18 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.paper3,
              borderColor: colors.rule,
              borderWidth: 1,
              borderRadius: radius.sm,
              paddingHorizontal: 16,
              height: 54,
            }}
          >
            <Ionicons name="mail-outline" size={18} color={colors.ink3} />
            <TextInput
              style={{
                flex: 1,
                marginLeft: 12,
                fontFamily: fonts.sans,
                fontSize: 15,
                color: colors.ink,
              }}
              placeholder="your@email.com"
              placeholderTextColor={colors.ink3}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>
          <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
            <Label>EMAIL</Label>
          </View>
        </View>

        {/* Password */}
        <View style={{ marginBottom: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.paper3,
              borderColor: colors.rule,
              borderWidth: 1,
              borderRadius: radius.sm,
              paddingHorizontal: 16,
              height: 54,
            }}
          >
            <Ionicons name="lock-closed-outline" size={18} color={colors.ink3} />
            <TextInput
              style={{
                flex: 1,
                marginLeft: 12,
                fontFamily: fonts.sans,
                fontSize: 15,
                color: colors.ink,
              }}
              placeholder="Enter your password"
              placeholderTextColor={colors.ink3}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.ink3} />
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 6, paddingHorizontal: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>PASSWORD</Label>
            <GuardedLink href="/(auth)/forgot-password" asChild>
              <TouchableOpacity hitSlop={8}>
                <Label color={colors.accent} tracking={1.4}>FORGOT?</Label>
              </TouchableOpacity>
            </GuardedLink>
          </View>
        </View>

        {/* Primary door — Sign In */}
        <View style={{ marginTop: 28 }}>
          <Door
            caption="CONTINUE"
            label={loading ? 'Signing in…' : 'Sign in with email'}
            variant="solid"
            loading={loading}
            disabled={loading || googleLoading || tiktokLoading || appleLoading}
            onPress={handleLogin}
            rightIcon={loading ? <ActivityIndicator color={colors.paper3} /> : undefined}
          />
        </View>

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
          <View style={{ flex: 1 }}><Rule /></View>
          <View style={{ marginHorizontal: 14 }}>
            <Label>OR</Label>
          </View>
          <View style={{ flex: 1 }}><Rule /></View>
        </View>

        {/* Sign in with Apple — required by App Store Guideline 4.8 since we
            offer Google. Uses Apple's OFFICIAL button component: the HIG
            mandates their exact mark/wording, so don't swap in a custom one.
            Placed ABOVE Google per Apple's HIG, which asks for Sign in with
            Apple to be at least as prominent as other sign-in options. */}
        {Platform.OS === 'ios' && appleAvailable && (
          <View style={{ marginBottom: 12, opacity: appleLoading ? 0.6 : 1 }}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={BUTTON_RADIUS}
              style={{ height: BUTTON_HEIGHT, width: '100%' }}
              onPress={handleAppleSignIn}
            />
          </View>
        )}

        {/* Google — keeps its own light "ghost door" colours; only the SHAPE is
            matched to Apple's button (same BUTTON_HEIGHT + same radius.md
            corners) so the two line up as a pair. */}
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={loading || googleLoading || tiktokLoading || appleLoading}
          onPress={handleGoogleSignIn}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: BUTTON_HEIGHT,
            paddingHorizontal: 22,
            backgroundColor: colors.paper3,
            borderColor: colors.ink,
            borderWidth: 1,
            borderRadius: BUTTON_RADIUS,
            opacity: googleLoading ? 0.6 : 1,
          }}
          accessibilityLabel="Continue with Google"
          accessibilityRole="button"
        >
          {googleLoading ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <>
              <GoogleLogo size={20} />
              <Text style={{ fontFamily: fonts.sansMed, fontSize: BUTTON_LABEL_SIZE, color: colors.ink, marginLeft: 10 }}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* <TouchableOpacity className={`h-14 rounded-xl items-center justify-center flex-row border mt-3 ${tiktokLoading ? 'bg-zinc-100 border-zinc-200' : 'bg-white border-zinc-300'}`}
          onPress={handleTikTokSignIn} disabled={loading || googleLoading || tiktokLoading || appleLoading}>
          {tiktokLoading ? <ActivityIndicator color="#71717a" /> : <><TikTokLogo size={20} /><Text className="text-zinc-700 font-semibold text-base ml-3">Continue with TikTok</Text></>}
        </TouchableOpacity> */}

        {/* Consent notice. Apple/Google sign-in silently creates an account when
            none exists (Clerk transfers the OAuth identity into a signUp), so a
            first-time user can reach the app without ever seeing the signup
            screen's terms checkbox. This line is that user's consent. */}
        <View style={{ marginTop: 20, paddingHorizontal: 8 }}>
          <Body size="xs" color={colors.ink3} style={{ textAlign: 'center', lineHeight: 18 }}>
            By continuing, you agree to our{' '}
            <Body
              size="xs"
              weight="medium"
              color={colors.ink2}
              style={{ textDecorationLine: 'underline' }}
              onPress={() => void openExternalUrl(TERMS_URL)}
            >
              Terms of Service
            </Body>
            {' '}and{' '}
            <Body
              size="xs"
              weight="medium"
              color={colors.ink2}
              style={{ textDecorationLine: 'underline' }}
              onPress={() => void openExternalUrl(PRIVACY_URL)}
            >
              Privacy Policy
            </Body>
            .
          </Body>
        </View>

        {/* Bottom signup link */}
        <View style={{ marginTop: 'auto', paddingTop: 32, flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline' }}>
          <Body size="sm" color={colors.ink3}>No account yet? </Body>
          <GuardedLink href="/(auth)/signup" asChild>
            <TouchableOpacity hitSlop={6}>
              <Body size="sm" weight="medium" color={colors.accent}>Get started →</Body>
            </TouchableOpacity>
          </GuardedLink>
        </View>

        {/* Bottom brand mark — text wordmark only, no icon */}
        <View style={{ marginTop: 24, alignItems: 'center', opacity: 0.6 }}>
          <Body
            size="xs"
            color={colors.ink3}
            style={{ fontFamily: fonts.wordmarkMed, letterSpacing: 2.4, textTransform: 'uppercase' }}
          >
            Tendso
          </Body>
        </View>
      </ScrollView>

      {/* TikTok Complete Profile Modal */}
      <Modal visible={showTikTokProfile} transparent animationType="slide" onRequestClose={closeTikTokModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 24 }}>
              <View className="items-center pt-3 pb-2">
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#d4d4d8' }} />
              </View>
              <ScrollView className="px-6 pt-2 pb-4" keyboardShouldPersistTaps="handled">
                <View className="items-center mb-6">
                  <View className="w-14 h-14 bg-zinc-100 rounded-full items-center justify-center mb-3">
                    <TikTokLogo size={28} />
                  </View>
                  <Text className="text-xl font-bold text-zinc-900 text-center">
                    {ttStep === 'profile' ? 'Complete Your Profile' : 'Verify Your Email'}
                  </Text>
                  <Text className="text-zinc-500 text-center mt-1 px-4">
                    {ttStep === 'profile'
                      ? "TikTok doesn't share your details. Please provide them to finish signing up."
                      : `We sent a 6-digit code to ${ttEmail}`}
                  </Text>
                </View>

                {ttError ? (<View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4"><Text className="text-red-600 text-sm font-medium">{ttError}</Text></View>) : null}

                {ttStep === 'profile' ? (
                  <>
                    <View className="flex-row mb-4">
                      <View className="flex-1 mr-2">
                        <Text className="text-zinc-700 font-medium mb-2">First Name *</Text>
                        <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
                          <Ionicons name="person-outline" size={20} color="#71717a" />
                          <TextInput className="flex-1 ml-3 text-base text-zinc-900" placeholder="Juan" placeholderTextColor="#a1a1aa"
                            value={ttFirstName} onChangeText={setTtFirstName} autoCapitalize="words" editable={!ttLoading} />
                        </View>
                      </View>
                      <View className="flex-1 ml-2">
                        <Text className="text-zinc-700 font-medium mb-2">Last Name *</Text>
                        <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
                          <TextInput className="flex-1 text-base text-zinc-900" placeholder="Dela Cruz" placeholderTextColor="#a1a1aa"
                            value={ttLastName} onChangeText={setTtLastName} autoCapitalize="words" editable={!ttLoading} />
                        </View>
                      </View>
                    </View>

                    <View className="mb-4">
                      <Text className="text-zinc-700 font-medium mb-2">Email *</Text>
                      <View className="flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
                        <Ionicons name="mail-outline" size={20} color="#71717a" />
                        <TextInput className="flex-1 ml-3 text-base text-zinc-900" placeholder="your@email.com" placeholderTextColor="#a1a1aa"
                          value={ttEmail} onChangeText={setTtEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!ttLoading} />
                      </View>
                    </View>

                    <View className="mb-6">
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-zinc-700 font-medium">Mobile Number</Text>
                        <Text className="text-xs text-zinc-400">Optional</Text>
                      </View>
                      <View className="flex-row">
                        <View className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14 items-center justify-center mr-2">
                          <Text className="text-zinc-700 font-medium">+63</Text>
                        </View>
                        <View className="flex-1 flex-row items-center bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14">
                          <Ionicons name="call-outline" size={20} color="#71717a" />
                          <TextInput className="flex-1 ml-3 text-base text-zinc-900" placeholder="912 345 6789" placeholderTextColor="#a1a1aa"
                            value={ttPhone} onChangeText={setTtPhone} keyboardType="number-pad" maxLength={15} editable={!ttLoading} />
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity className={`h-14 rounded-xl items-center justify-center ${ttLoading ? 'bg-zinc-400' : 'bg-zinc-900'}`}
                      onPress={handleTikTokSubmitProfile} disabled={ttLoading}>
                      {ttLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Continue</Text>}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View className="mb-6">
                      <Text className="text-zinc-700 font-medium mb-2">Verification Code</Text>
                      <TextInput className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 h-14 text-center text-2xl tracking-widest text-zinc-900"
                        placeholder="000000" placeholderTextColor="#a1a1aa" value={ttCode} onChangeText={setTtCode}
                        keyboardType="number-pad" maxLength={6} editable={!ttLoading} />
                    </View>

                    <TouchableOpacity className={`h-14 rounded-xl items-center justify-center ${ttLoading ? 'bg-emerald-400' : 'bg-emerald-600'}`}
                      onPress={handleTikTokVerifyEmail} disabled={ttLoading}>
                      {ttLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Verify Email</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity className="mt-3 items-center" onPress={() => { setTtStep('profile'); setTtError(''); setTtCode(''); }}>
                      <Text className="text-zinc-500 text-sm">Back to profile</Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity className="mt-3 items-center pb-4" onPress={closeTikTokModal}>
                  <Text className="text-zinc-400 text-sm">Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}
