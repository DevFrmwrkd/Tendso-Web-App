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
  Image,
  Modal,
} from 'react-native';
import { useSignUp, useSSO } from '@clerk/clerk-expo';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GuardedLink } from '../../components/GuardedLink';
import { useAppleAuth } from '../../hooks/useAppleAuth';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { TikTokLogo } from '@/components/TikTokLogo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { Display, Body, Label, Door, Rule, EditorialField } from '@/components/ui/primitives';
import { colors, fonts, radius } from '@/theme/tokens';
import { openExternalUrl, TERMS_URL, PRIVACY_URL } from '../../services/links';

WebBrowser.maybeCompleteAuthSession();

// Actual Google logo in 4 official brand colors
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
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

function generateReferralCode(firstName: string, lastName: string): string {
  const namePrefix = (firstName.substring(0, 2) + lastName.substring(0, 1)).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${namePrefix}${random}`;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startSSOFlow: startGoogleSSOFlow } = useSSO();
  const { startSSOFlow: startTikTokSSOFlow } = useSSO();
  // Native Apple sign-in — required by App Store Guideline 4.8 since we offer
  // Google. Our own hook rather than Clerk's useSignInWithApple, which drops
  // the name Apple returns on a first authorization.
  const { startAppleAuth } = useAppleAuth();
  const createCreator = useMutation(api.creators.create);
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [referredByCode, setReferredByCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  // iOS-only, and unavailable on older iOS / some simulators — only render the
  // button once the device confirms support.
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Per-field validation errors (shown inline under each input)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [code, setCode] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

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

  const handleSignup = async () => {
    if (!isLoaded) return;

    // Per-field inline validation
    const errors: Record<string, string> = {};
    if (!firstName.trim()) errors.firstName = 'First name is required';
    if (!lastName.trim()) errors.lastName = 'Last name is required';
    if (!email.trim()) errors.email = 'Email is required';
    else if (!EMAIL_REGEX.test(email.trim())) errors.email = 'Invalid email address';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 8) errors.password = 'At least 8 characters';
    if (!confirmPassword) errors.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError('Please fix the highlighted fields above');
      return;
    }

    setLoading(true);
    setError('');
    setFieldErrors({});

    try {
      // NOTE: there used to be a "restore soft-deleted account" branch here that
      // signed the user back in with their OLD password. That is precisely what
      // Guideline 5.1.1(v) forbids — a deleted account must not be recoverable
      // by signing in again.
      //
      // It is also now dead in a harmful way: deleting the account deletes the
      // Clerk user, so signIn.create() always throws, and the branch's catch
      // returned early with "Unable to restore account" — permanently blocking
      // a deleted user from ever signing up again.
      //
      // Plain signup is the correct path. creators.create already handles the
      // leftover soft-deleted row: it matches on clerkId, and a re-registered
      // user gets a brand new Clerk id, so a fresh creator row is inserted and
      // the old one is left untouched for its 30-day retention.
      await signUp.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        emailAddress: email.trim(),
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      console.error('Sign up error:', err);
      const errorMessage = err.errors?.[0]?.message || err.message || 'Failed to sign up';

      if (errorMessage.toLowerCase().includes('already') || err.errors?.[0]?.code === 'form_identifier_exists') {
        setError('An account with this email already exists. Please log in instead.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;

    if (!code) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === 'complete') {
        if (!result.createdSessionId || !result.createdUserId) {
          setError('Verification succeeded but session creation failed. Please try logging in.');
          setLoading(false);
          return;
        }

        // Create the Convex creator row BEFORE setActive. If Convex creation
        // throws, the user is at least in Clerk — they can sign in later and
        // the home-screen auto-create will retry. We surface the error so QA
        // sees it clearly (the previous generic "verification failed" message
        // hid real Convex problems).
        const referralCode = generateReferralCode(firstName, lastName);
        try {
          await createCreator({
            clerkId: result.createdUserId,
            email: email.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim() || undefined,
            referralCode,
            referredByCode: referredByCode.trim() || undefined,
          });
          console.log('[SignUp] Convex creator created for', email);
        } catch (createErr: any) {
          // Don't block sign-in. Surface in console + Sentry for diagnosis.
          console.error(
            '[SignUp] createCreator failed AFTER Clerk verification — home-screen safety net will retry on first home visit:',
            createErr?.message ?? createErr,
          );
        }

        await setActive({ session: result.createdSessionId });
      } else {
        setError(`Verification incomplete (${result.status}). Please try again.`);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      const errorMessage = err.errors?.[0]?.message || err.message || 'Failed to verify email';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded || resendLoading) return;
    setResendLoading(true);
    setError('');
    setResendSuccess(false);

    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const handleAppleSignUp = useCallback(async () => {
    if (appleLoading) return;
    // Apple's button has no `disabled` prop, so enforce the terms gate here to
    // match the email/Google paths.
    if (!acceptedTerms) {
      setError('Please accept the terms to continue.');
      return;
    }

    setAppleLoading(true);
    setError('');

    try {
      const result = await startAppleAuth();

      if (result.createdSessionId && result.setActive) {
        // Best-effort Convex creator row, same as the Google path. NOTE: Apple
        // only returns name/email on the FIRST authorization ever, and the
        // email is often a private relay — so these are frequently missing on
        // re-installs. The home-screen auto-create useEffect is the safety net.
        const appleUserId =
          (result as any).createdUserId ??
          result.signUp?.createdUserId ??
          (result.signIn as any)?.userData?.id;
        // Prefer what Apple just handed us over what Clerk echoes back: on a
        // first authorization the credential is the ONLY place the name and
        // the real (non-relay) email exist.
        const appleEmail =
          result.email ??
          (result.signUp as any)?.emailAddress ??
          (result.signIn as any)?.userData?.emailAddresses?.[0]?.emailAddress ??
          '';
        const appleFirstName =
          result.firstName ??
          (result.signUp as any)?.firstName ??
          (result.signIn as any)?.userData?.firstName ??
          undefined;
        const appleLastName =
          result.lastName ??
          (result.signUp as any)?.lastName ??
          (result.signIn as any)?.userData?.lastName ??
          undefined;

        if (appleUserId && appleEmail) {
          try {
            const referralCode = generateReferralCode(appleFirstName || 'AP', appleLastName || 'PL');
            await createCreator({
              clerkId: appleUserId,
              email: appleEmail,
              firstName: appleFirstName,
              lastName: appleLastName,
              referralCode,
              referredByCode: referredByCode.trim() || undefined,
            });
          } catch (createErr: any) {
            console.error(
              '[Apple SignUp] createCreator failed (home-screen safety net will retry):',
              createErr?.message ?? createErr,
            );
          }
        } else {
          console.warn(
            '[Apple SignUp] No userId/email from Apple (expected on repeat sign-ins) — home-screen safety net will create',
          );
        }

        await result.setActive({ session: result.createdSessionId });
      } else {
        setAppleLoading(false);
      }
    } catch (err: any) {
      // Tapping Cancel on the Apple sheet throws — not an error state.
      const code = err?.code ?? '';
      if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') {
        setAppleLoading(false);
        return;
      }
      console.error('Apple sign up error:', JSON.stringify(err, null, 2));
      setError(
        err?.errors?.[0]?.longMessage ||
          err?.errors?.[0]?.message ||
          err?.message ||
          'Failed to sign up with Apple',
      );
      setAppleLoading(false);
    }
  }, [appleLoading, acceptedTerms, startAppleAuth, createCreator, referredByCode]);

  const handleGoogleSignUp = useCallback(async () => {
    if (googleLoading) return;

    setGoogleLoading(true);
    setError('');

    try {
      const redirectUrl = Linking.createURL('/', { scheme: 'negosyodigital' });
      console.log('[Google SignUp] Starting SSO flow with redirect:', redirectUrl);

      const result = await startGoogleSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });

      console.log('[Google SignUp] SSO result:', {
        createdSessionId: result.createdSessionId,
        signUpStatus: result.signUp?.status,
        signInStatus: result.signIn?.status,
        createdUserId: (result as any).createdUserId,
      });

      if (result.createdSessionId && result.setActive) {
        // Best-effort: create the Convex creator row from the Google profile.
        // If this throws (Convex down, network blip, etc.), we still sign the
        // user in — the home-screen auto-create useEffect is the safety net.
        // BUT we surface the error in the console so QA / Sentry can find it.
        const googleUserId =
          (result as any).createdUserId ??
          result.signUp?.createdUserId ??
          (result.signIn as any)?.userData?.id;
        const googleEmail =
          (result.signUp as any)?.emailAddress ??
          (result.signUp as any)?.unsafeMetadata?.email ??
          (result.signIn as any)?.userData?.emailAddresses?.[0]?.emailAddress ??
          '';
        const googleFirstName =
          (result.signUp as any)?.firstName ??
          (result.signIn as any)?.userData?.firstName ??
          undefined;
        const googleLastName =
          (result.signUp as any)?.lastName ??
          (result.signIn as any)?.userData?.lastName ??
          undefined;

        if (googleUserId && googleEmail) {
          try {
            const referralCode = generateReferralCode(
              googleFirstName || 'GO',
              googleLastName || 'OG',
            );
            await createCreator({
              clerkId: googleUserId,
              email: googleEmail,
              firstName: googleFirstName,
              lastName: googleLastName,
              referralCode,
              referredByCode: referredByCode.trim() || undefined,
            });
            console.log('[Google SignUp] Convex creator created for', googleEmail);
          } catch (createErr: any) {
            // Don't block sign-in on this — home-screen safety net will retry.
            // Log loudly so the failure is visible in Sentry/console.
            console.error(
              '[Google SignUp] createCreator failed (home-screen safety net will retry):',
              createErr?.message ?? createErr,
            );
          }
        } else {
          console.warn(
            '[Google SignUp] Missing userId or email from Google result — home-screen safety net will create',
          );
        }

        await result.setActive({ session: result.createdSessionId });
      } else {
        setGoogleLoading(false);
      }
    } catch (err: any) {
      console.error('Google sign up error:', JSON.stringify(err, null, 2));
      const msg = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || err.message || 'Failed to sign up with Google';
      setError(msg);
      setGoogleLoading(false);
    }
  }, [googleLoading, startGoogleSSOFlow, createCreator, referredByCode]);

  const handleTikTokSignUp = useCallback(async () => {
    if (tiktokLoading) return;

    setTiktokLoading(true);
    setError('');

    try {
      const result = await startTikTokSSOFlow({
        strategy: 'oauth_tiktok',
        redirectUrl: Linking.createURL('/', { scheme: 'negosyodigital' }),
      });

      // Direct session — user already exists or all fields satisfied
      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        return;
      }

      // TikTok doesn't provide email — Clerk returns missing_requirements
      // Show complete profile modal to collect what's missing
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
      console.error('TikTok sign up error:', err);
      setError(err.errors?.[0]?.message || 'Failed to sign up with TikTok');
      setTiktokLoading(false);
    }
  }, [tiktokLoading, startTikTokSSOFlow]);

  const PHONE_REGEX = /^(\+63|0)?9\d{9}$/;

  const handleTikTokSubmitProfile = async () => {
    if (!ttFirstName.trim() || ttFirstName.trim().length < 2) { setTtError('First name is required (min 2 characters)'); return; }
    if (!ttLastName.trim() || ttLastName.trim().length < 2) { setTtError('Last name is required (min 2 characters)'); return; }
    if (!ttEmail.trim() || !EMAIL_REGEX.test(ttEmail.trim())) { setTtError('Please enter a valid email address'); return; }
    if (ttPhone.trim() && !PHONE_REGEX.test(ttPhone.replace(/\s/g, ''))) { setTtError('Please enter a valid PH phone number'); return; }

    setTtLoading(true);
    setTtError('');

    try {
      const su = ssoSignUpRef.current;
      if (!su) { setTtError('Session expired. Please try again.'); setTtLoading(false); return; }

      await su.update({
        firstName: ttFirstName.trim(),
        lastName: ttLastName.trim(),
        emailAddress: ttEmail.trim(),
      });

      console.log('After update - status:', su.status, 'missing:', su.missingFields, 'unverified:', su.unverifiedFields, 'sessionId:', su.createdSessionId);

      if (su.createdSessionId) {
        const setActiveFn = ssoSetActiveRef.current || setActive;
        await setActiveFn({ session: su.createdSessionId });
        setShowTikTokProfile(false);
        return;
      }

      if (su.status === 'missing_requirements' && su.unverifiedFields?.includes('email_address')) {
        await su.prepareEmailAddressVerification({ strategy: 'email_code' });
        setTtStep('verify');
        setTtLoading(false);
        return;
      }

      console.log('Still missing:', su.missingFields, 'Status:', su.status);
      setTtError(`Missing: ${(su.missingFields || []).join(', ') || 'unknown'}. Try again.`);
      setTtLoading(false);
    } catch (err: any) {
      console.error('TikTok profile error:', err);
      setTtError(err.errors?.[0]?.message || 'Failed to update profile');
      setTtLoading(false);
    }
  };

  const handleTikTokVerifyEmail = async () => {
    if (!ttCode || ttCode.length < 6) { setTtError('Please enter the 6-digit code'); return; }

    setTtLoading(true);
    setTtError('');

    try {
      const su = ssoSignUpRef.current;
      if (!su) { setTtError('Session expired. Please try again.'); setTtLoading(false); return; }

      const result = await su.attemptEmailAddressVerification({ code: ttCode });

      if (result.status === 'complete' && result.createdSessionId) {
        const setActiveFn = ssoSetActiveRef.current || setActive;
        await setActiveFn({ session: result.createdSessionId });
        setShowTikTokProfile(false);
        return;
      }

      if (su.createdSessionId) {
        const setActiveFn = ssoSetActiveRef.current || setActive;
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

  // ── Verification screen ────────────────────────────────────────────────────
  if (pendingVerification) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.paper }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 32,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 28,
            justifyContent: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginBottom: 28 }}>
            <Label tracking={1.8} style={{ marginBottom: 18 }}>VERIFY EMAIL</Label>
            <Display size="md">Check your</Display>
            <Display size="md" italic color={colors.accent}>inbox.</Display>
          </View>

          <Body size="md" color={colors.ink2} style={{ marginBottom: 28 }}>
            We sent a 6-digit code to{' '}
            <Body size="md" weight="medium" color={colors.ink}>{email}</Body>
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

          <View style={{ marginBottom: 24 }}>
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
              accessibilityLabel="Verification Code"
            />
            <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
              <Label>6-DIGIT CODE</Label>
            </View>
          </View>

          <Door
            caption="VERIFY"
            label={loading ? 'Verifying…' : 'Verify email'}
            variant="solid"
            loading={loading}
            disabled={loading || resendLoading}
            onPress={handleVerify}
            rightIcon={loading ? <ActivityIndicator color={colors.paper3} /> : undefined}
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
            onPress={handleResendCode}
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

          <TouchableOpacity
            style={{ marginTop: 16, alignItems: 'center' }}
            onPress={() => {
              setPendingVerification(false);
              setCode('');
              setError('');
            }}
            accessibilityLabel="Back to signup"
            accessibilityRole="button"
          >
            <Label color={colors.ink3}>← BACK TO SIGNUP</Label>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Signup form ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
        {/* Editorial header */}
        <Label tracking={1.8} style={{ marginBottom: 18 }}>GET STARTED</Label>

        <View style={{ marginBottom: 8 }}>
          <Display size="lg">Make</Display>
          <Display size="lg" italic color={colors.accent}>your account.</Display>
        </View>

        <Body size="md" color={colors.ink2} style={{ marginTop: 12, marginBottom: 28, maxWidth: 320 }}>
          Start your digital business journey. Two minutes, one form.
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

        {/* Name row */}
        <View style={{ flexDirection: 'row', marginBottom: 18, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <EditorialField
              icon="person-outline"
              placeholder="Juan"
              value={firstName}
              onChangeText={(t: string) => { setFirstName(t); setFieldErrors((e) => { const n = {...e}; delete n.firstName; return n; }); }}
              autoCapitalize="words"
              editable={!loading}
              accessibilityLabel="First Name"
              label="FIRST NAME"
              error={fieldErrors.firstName}
            />
          </View>
          <View style={{ flex: 1 }}>
            <EditorialField
              placeholder="Dela Cruz"
              value={lastName}
              onChangeText={(t: string) => { setLastName(t); setFieldErrors((e) => { const n = {...e}; delete n.lastName; return n; }); }}
              autoCapitalize="words"
              editable={!loading}
              accessibilityLabel="Last Name"
              label="LAST NAME"
              error={fieldErrors.lastName}
            />
          </View>
        </View>

        {/* Email */}
        <View style={{ marginBottom: 18 }}>
          <EditorialField
            icon="mail-outline"
            placeholder="your@email.com"
            value={email}
            onChangeText={(t: string) => { setEmail(t); setFieldErrors((e) => { const n = {...e}; delete n.email; return n; }); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            accessibilityLabel="Email"
            label="EMAIL"
            error={fieldErrors.email}
          />
        </View>

        {/* Phone with +63 prefix */}
        <View style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View
              style={{
                backgroundColor: colors.paper3,
                borderColor: colors.rule,
                borderWidth: 1,
                borderRadius: radius.sm,
                paddingHorizontal: 14,
                height: 54,
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: fonts.monoMed, fontSize: 14, color: colors.ink2, letterSpacing: 0.5 }}>+63</Text>
            </View>
            <View style={{ flex: 1 }}>
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
                <Ionicons name="call-outline" size={18} color={colors.ink3} />
                <TextInput
                  style={{ flex: 1, marginLeft: 10, fontFamily: fonts.sans, fontSize: 15, color: colors.ink }}
                  placeholder="912 345 6789"
                  placeholderTextColor={colors.ink3}
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={15}
                  editable={!loading}
                  accessibilityLabel="Mobile Number"
                />
              </View>
            </View>
          </View>
          <View style={{ marginTop: 6, paddingHorizontal: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>MOBILE</Label>
            <Label color={colors.ink3}>OPTIONAL</Label>
          </View>
        </View>

        {/* Password */}
        <View style={{ marginBottom: 18 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.paper3,
              borderColor: fieldErrors.password ? colors.danger : colors.rule,
              borderWidth: 1,
              borderRadius: radius.sm,
              paddingHorizontal: 14,
              height: 54,
            }}
          >
            <Ionicons name="lock-closed-outline" size={18} color={fieldErrors.password ? colors.danger : colors.ink3} />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontFamily: fonts.sans, fontSize: 15, color: colors.ink }}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.ink3}
              value={password}
              onChangeText={(t) => { setPassword(t); setFieldErrors((e) => { const n = {...e}; delete n.password; return n; }); }}
              secureTextEntry={!showPassword}
              editable={!loading}
              accessibilityLabel="Password"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.ink3} />
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
            <Label color={fieldErrors.password ? colors.danger : colors.ink3}>
              {fieldErrors.password ? fieldErrors.password.toUpperCase() : 'PASSWORD'}
            </Label>
          </View>
        </View>

        {/* Confirm Password */}
        <View style={{ marginBottom: 18 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.paper3,
              borderColor: fieldErrors.confirmPassword ? colors.danger : colors.rule,
              borderWidth: 1,
              borderRadius: radius.sm,
              paddingHorizontal: 14,
              height: 54,
            }}
          >
            <Ionicons name="lock-closed-outline" size={18} color={fieldErrors.confirmPassword ? colors.danger : colors.ink3} />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontFamily: fonts.sans, fontSize: 15, color: colors.ink }}
              placeholder="Confirm your password"
              placeholderTextColor={colors.ink3}
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setFieldErrors((e) => { const n = {...e}; delete n.confirmPassword; return n; }); }}
              secureTextEntry={!showPassword}
              editable={!loading}
              accessibilityLabel="Confirm Password"
            />
          </View>
          <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
            <Label color={fieldErrors.confirmPassword ? colors.danger : colors.ink3}>
              {fieldErrors.confirmPassword ? fieldErrors.confirmPassword.toUpperCase() : 'CONFIRM PASSWORD'}
            </Label>
          </View>
        </View>

        {/* Referral Code */}
        <View style={{ marginBottom: 24 }}>
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
            <Ionicons name="gift-outline" size={18} color={colors.ink3} />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontFamily: fonts.mono, fontSize: 15, color: colors.ink, letterSpacing: 1 }}
              placeholder="Enter referral code"
              placeholderTextColor={colors.ink3}
              value={referredByCode}
              onChangeText={(text) => setReferredByCode(text.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!loading}
              accessibilityLabel="Referral Code"
            />
          </View>
          <View style={{ marginTop: 6, paddingHorizontal: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>REFERRAL CODE</Label>
            <Label color={colors.ink3}>OPTIONAL</Label>
          </View>
        </View>

        {/* Terms checkbox */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 }}
          onPress={() => setAcceptedTerms(!acceptedTerms)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acceptedTerms }}
          accessibilityLabel="Accept Terms of Service"
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: radius.xs,
              borderWidth: 1.5,
              borderColor: acceptedTerms ? colors.accent : colors.ruleStrong,
              backgroundColor: acceptedTerms ? colors.accent : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
              marginTop: 2,
            }}
          >
            {acceptedTerms && <Ionicons name="checkmark" size={14} color={colors.paper3} />}
          </View>
          <View style={{ flex: 1 }}>
            <Body size="sm" color={colors.ink2}>
              I agree to the{' '}
              <Body
                size="sm"
                weight="medium"
                color={colors.accent}
                style={{ textDecorationLine: 'underline' }}
                onPress={() => void openExternalUrl(TERMS_URL)}
              >
                Terms of Service
              </Body>
              {' '}and{' '}
              <Body
                size="sm"
                weight="medium"
                color={colors.accent}
                style={{ textDecorationLine: 'underline' }}
                onPress={() => void openExternalUrl(PRIVACY_URL)}
              >
                Privacy Policy
              </Body>
            </Body>
          </View>
        </TouchableOpacity>

        {/* Create account door — accent variant (this is the earning moment) */}
        <Door
          caption="CREATE ACCOUNT"
          label={loading ? 'Creating…' : 'Get started'}
          variant="accent"
          loading={loading}
          disabled={loading || googleLoading || tiktokLoading || !acceptedTerms}
          onPress={handleSignup}
          rightIcon={loading ? <ActivityIndicator color="#fff" /> : undefined}
        />

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
          <View style={{ flex: 1 }}><Rule /></View>
          <View style={{ marginHorizontal: 14 }}>
            <Label>OR</Label>
          </View>
          <View style={{ flex: 1 }}><Rule /></View>
        </View>

        {!acceptedTerms && (
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Label color={colors.ink3}>ACCEPT TERMS TO CONTINUE</Label>
          </View>
        )}

        {/* Sign up with Apple — required by App Store Guideline 4.8 since we
            offer Google. Apple's OFFICIAL button component: the HIG mandates
            their exact mark/wording, so don't swap in a custom one. The terms
            gate is enforced in the handler (this component has no `disabled`).
            Placed ABOVE Google per Apple's HIG, which asks for Sign in with
            Apple to be at least as prominent as other sign-in options. */}
        {Platform.OS === 'ios' && appleAvailable && (
          <View style={{ marginBottom: 12, opacity: appleLoading || !acceptedTerms ? 0.55 : 1 }}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={BUTTON_RADIUS}
              style={{ height: BUTTON_HEIGHT, width: '100%' }}
              onPress={handleAppleSignUp}
            />
          </View>
        )}

        {/* Google — keeps its own light "ghost door" colours; only the SHAPE is
            matched to Apple's button (same BUTTON_HEIGHT + same radius.md
            corners) so the two line up as a pair. */}
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={loading || googleLoading || tiktokLoading || appleLoading || !acceptedTerms}
          onPress={handleGoogleSignUp}
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
            opacity: googleLoading || !acceptedTerms ? 0.55 : 1,
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

        {/* <TouchableOpacity
          className={`h-14 rounded-xl items-center justify-center flex-row border mt-3 ${
            tiktokLoading ? 'bg-zinc-100 border-zinc-200' : 'bg-white border-zinc-300'
          }`}
          onPress={handleTikTokSignUp}
          disabled={loading || googleLoading || tiktokLoading}
          accessibilityLabel="Continue with TikTok"
          accessibilityRole="button"
        >
          {tiktokLoading ? (
            <ActivityIndicator color="#71717a" />
          ) : (
            <>
              <TikTokLogo size={20} />
              <Text className="text-zinc-700 font-semibold text-base ml-3">
                Continue with TikTok
              </Text>
            </>
          )}
        </TouchableOpacity> */}

        {/* Footer */}
        <View style={{ marginTop: 32, flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline' }}>
          <Body size="sm" color={colors.ink3}>Already with us? </Body>
          <GuardedLink href="/(auth)/login" asChild>
            <TouchableOpacity hitSlop={6} accessibilityLabel="Sign In" accessibilityRole="button">
              <Body size="sm" weight="medium" color={colors.accent}>Sign in →</Body>
            </TouchableOpacity>
          </GuardedLink>
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
                            value={ttPhone} onChangeText={(v) => setTtPhone(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={15} editable={!ttLoading} />
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
