import React, { useState, useCallback, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSignUp, useSSO } from '@clerk/clerk-expo';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { GuardedLink } from '../../components/GuardedLink';
import { useAppleAuth } from '../../hooks/useAppleAuth';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import {
  activateSignupSession, normalizeSignupProfile, savePendingSignupProfile, signupProfileErrors,
} from '../../services/signupProfile';
import type { SignupAccountType } from '../../services/signupProfile';
import { openExternalUrl, TERMS_URL, PRIVACY_URL } from '../../services/links';
import { Banner, Button, Field, ScreenShell, SectionLabel, Text } from '../../components/v2';
import {
  AccountTypeOption,
  AuthLink,
  CodeBoxes,
  GooglePill,
  OrDivider,
  PasswordEye,
  SocialPill,
  SOCIAL_HEIGHT,
  SOCIAL_RADIUS,
  TermsCheck,
  TikTokProfileSheet,
} from '../../components/v2/AuthParts';
import { TikTokLogo } from '@/components/TikTokLogo';
import { space } from '../../theme/v2';

WebBrowser.maybeCompleteAuthSession();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The TikTok button is switched off today (it was commented out before the restyle too). The handler
// and the profile sheet stay wired so turning it on is a one-line change.
const TIKTOK_ENABLED = false;

export default function SignupScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startSSOFlow: startGoogleSSOFlow } = useSSO();
  const { startSSOFlow: startTikTokSSOFlow } = useSSO();
  // Native Apple sign-in — required by App Store Guideline 4.8 since we offer
  // Google. Our own hook rather than Clerk's useSignInWithApple, which drops
  // the name Apple returns on a first authorization.
  const { startAppleAuth } = useAppleAuth();
  const router = useGuardedRouter();

  const [accountType, setAccountType] = useState<SignupAccountType>('creator');
  const [handle, setHandle] = useState('');
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
  const profile = normalizeSignupProfile({ accountType, firstName, lastName, phone, handle, referredByCode });

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
    if (accountType === 'creator' && !lastName.trim()) errors.lastName = 'Last name is required';
    Object.assign(errors, signupProfileErrors(profile));
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
    if (!acceptedTerms) { setError('Please accept the terms to continue.'); return; }

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

      await savePendingSignupProfile(profile, { email: email.trim() });
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
    if (!code) { setError('Please enter the verification code'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status !== 'complete' || !result.createdSessionId || !result.createdUserId) {
        throw new Error('Verification is incomplete. Please try again or log in.');
      }
      await activateSignupSession(profile, { clerkId: result.createdUserId, email: email.trim() }, result.createdSessionId, setActive);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || 'Failed to verify email');
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
    if (!acceptedTerms) { setError('Please accept the terms to continue.'); return; }
    setAppleLoading(true);
    setError('');
    try {
      const result = await startAppleAuth();
      if (result.createdSessionId && result.setActive) {
        const appleProfile = normalizeSignupProfile({ ...profile,
          firstName: profile.firstName || result.firstName || result.signUp?.firstName || '',
          lastName: profile.lastName || result.lastName || result.signUp?.lastName || '',
        });
        await activateSignupSession(appleProfile, {
          clerkId: result.isNewUser ? result.signUp?.createdUserId || undefined : undefined,
          email: result.email || (result.isNewUser ? result.signUp?.emailAddress || undefined : undefined),
        }, result.createdSessionId, result.setActive);
      } else { setAppleLoading(false); }
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED' || err?.code === 'ERR_CANCELED') { setAppleLoading(false); return; }
      setError(err?.errors?.[0]?.message || err?.message || 'Failed to sign up with Apple');
      setAppleLoading(false);
    }
  }, [appleLoading, acceptedTerms, startAppleAuth, profile]);

  const handleGoogleSignUp = useCallback(async () => {
    if (googleLoading) return;
    if (!acceptedTerms) { setError('Please accept the terms to continue.'); return; }
    setGoogleLoading(true);
    setError('');
    try {
      const result = await startGoogleSSOFlow({ strategy: 'oauth_google', redirectUrl: Linking.createURL('/', { scheme: 'negosyodigital' }) });
      if (result.createdSessionId && result.setActive) {
        const googleProfile = normalizeSignupProfile({ ...profile,
          firstName: profile.firstName || result.signUp?.firstName || '',
          lastName: profile.lastName || result.signUp?.lastName || '',
        });
        await activateSignupSession(googleProfile, {
          clerkId: result.signUp?.createdUserId || undefined,
          email: result.signUp?.emailAddress || undefined,
        }, result.createdSessionId, result.setActive);
      } else { setGoogleLoading(false); }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || 'Failed to sign up with Google');
      setGoogleLoading(false);
    }
  }, [googleLoading, acceptedTerms, startGoogleSSOFlow, profile]);

  const handleTikTokSignUp = useCallback(async () => {
    if (tiktokLoading) return;
    if (!acceptedTerms) { setError('Please accept the terms to continue.'); return; }

    setTiktokLoading(true);
    setError('');

    try {
      const result = await startTikTokSSOFlow({
        strategy: 'oauth_tiktok',
        redirectUrl: Linking.createURL('/', { scheme: 'negosyodigital' }),
      });

      // Direct session — user already exists or all fields satisfied
      if (result.createdSessionId && result.setActive) {
        await activateSignupSession(profile, { clerkId: result.signUp?.createdUserId || undefined, email: result.signUp?.emailAddress || undefined }, result.createdSessionId, result.setActive);
        return;
      }

      // TikTok doesn't provide email — Clerk returns missing_requirements
      // Show complete profile modal to collect what's missing
      if (result.signUp?.status === 'missing_requirements') {
        ssoSignUpRef.current = result.signUp;
        ssoSetActiveRef.current = result.setActive;
        setTtFirstName(firstName.trim() || result.signUp.firstName || '');
        setTtLastName(lastName.trim() || result.signUp.lastName || '');
        setTtEmail(email.trim());
        setTtPhone(phone.trim());
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
  }, [tiktokLoading, acceptedTerms, startTikTokSSOFlow, profile]);

  const PHONE_REGEX = /^(\+63|0)?9\d{9}$/;

  const handleTikTokSubmitProfile = async () => {
    if (!ttFirstName.trim() || ttFirstName.trim().length < 2) { setTtError('First name is required (min 2 characters)'); return; }
    if (accountType === 'creator' && ttLastName.trim().length < 2) { setTtError('Last name is required (min 2 characters)'); return; }
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

      await savePendingSignupProfile({ ...profile, firstName: ttFirstName, lastName: ttLastName, phone: ttPhone }, { email: ttEmail });

      if (su.createdSessionId) {
        const setActiveFn = ssoSetActiveRef.current || setActive;
        await activateSignupSession({ ...profile, firstName: ttFirstName, lastName: ttLastName, phone: ttPhone }, { clerkId: su.createdUserId || undefined, email: ttEmail }, su.createdSessionId, setActiveFn);
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
        await activateSignupSession({ ...profile, firstName: ttFirstName, lastName: ttLastName, phone: ttPhone }, { clerkId: result.createdUserId || undefined, email: ttEmail }, result.createdSessionId, setActiveFn);
        setShowTikTokProfile(false);
        return;
      }

      if (su.createdSessionId) {
        const setActiveFn = ssoSetActiveRef.current || setActive;
        await activateSignupSession({ ...profile, firstName: ttFirstName, lastName: ttLastName, phone: ttPhone }, { clerkId: su.createdUserId || undefined, email: ttEmail }, su.createdSessionId, setActiveFn);
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

  const clearFieldError = (key: string) =>
    setFieldErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  const busy = loading || googleLoading || tiktokLoading || appleLoading;

  // ── Verification screen ────────────────────────────────────────────────────
  if (pendingVerification) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenShell
          title="Check your email"
          subtitle={`We sent a 6-digit code to ${email}`}
          onBack={() => {
            setPendingVerification(false);
            setCode('');
            setError('');
          }}
          footer={
            <Button
              title="Verify email"
              loading={loading}
              disabled={resendLoading}
              onPress={handleVerify}
            />
          }
        >
          {error ? <Banner tone="danger" body={error} style={styles.banner} /> : null}
          {resendSuccess ? (
            <Banner tone="ok" body="A new code is on its way." style={styles.banner} />
          ) : null}

          <CodeBoxes value={code} onChangeText={setCode} accessibilityLabel="Verification Code" />

          <View style={styles.resend}>
            <AuthLink
              label={resendLoading ? 'Sending…' : "Didn't receive it? Resend code"}
              accessibilityLabel="Resend Code"
              onPress={handleResendCode}
              disabled={loading || resendLoading}
            />
          </View>
        </ScreenShell>
      </KeyboardAvoidingView>
    );
  }

  // ── Signup form ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenShell title="Make your account" subtitle="Two minutes, one form." onBack={() => router.back()}>
        <View style={styles.section} accessibilityLabel="Choose an account type">
          <SectionLabel>Account type</SectionLabel>
          <AccountTypeOption
            title="Field agent"
            subtitle="Visit shops, take photos, interview"
            icon="camera-outline"
            selected={accountType === 'creator'}
            disabled={busy}
            accessibilityLabel="Field agent account"
            onPress={() => { setAccountType('creator'); setFieldErrors({}); setError(''); }}
          />
          <AccountTypeOption
            title="Creator"
            subtitle="Share my link with shop owners"
            icon="link-outline"
            selected={accountType === 'affiliate'}
            disabled={busy}
            accessibilityLabel="Creator account"
            onPress={() => { setAccountType('affiliate'); setFieldErrors({}); setError(''); }}
          />
          <Text variant="label" weight="medium" tone="muted" style={styles.note}>
            One login, one account type. Use another email for a second account.
          </Text>
        </View>

        {error ? <Banner tone="danger" body={error} style={styles.banner} /> : null}

        <View style={styles.section}>
          <SectionLabel>Your name</SectionLabel>
          <View style={styles.split}>
            <Field
              containerStyle={styles.half}
              label="First name"
              placeholder="Juan"
              value={firstName}
              onChangeText={(t: string) => { setFirstName(t); clearFieldError('firstName'); }}
              autoCapitalize="words"
              editable={!loading}
              accessibilityLabel="First Name"
              error={fieldErrors.firstName}
            />
            <Field
              containerStyle={styles.half}
              label="Last name"
              placeholder={accountType === 'affiliate' ? 'Optional' : 'Dela Cruz'}
              value={lastName}
              onChangeText={(t: string) => { setLastName(t); clearFieldError('lastName'); }}
              autoCapitalize="words"
              editable={!loading}
              accessibilityLabel="Last Name"
              error={fieldErrors.lastName}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>Contact</SectionLabel>
          <Field
            label="Email"
            icon="mail-outline"
            placeholder="your@email.com"
            value={email}
            onChangeText={(t: string) => { setEmail(t); clearFieldError('email'); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            accessibilityLabel="Email"
            error={fieldErrors.email}
          />
          <Field
            label="Mobile"
            prefix="+63"
            placeholder="912 345 6789"
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={15}
            editable={!loading}
            accessibilityLabel="Mobile Number"
            error={fieldErrors.phone}
            helper={accountType === 'affiliate' ? 'Required' : 'Optional'}
          />
        </View>

        {accountType === 'affiliate' ? (
          <View style={styles.section}>
            <SectionLabel>Your page</SectionLabel>
            <Field
              label="Page handle"
              placeholder="your-page"
              value={handle}
              onChangeText={(value: string) => setHandle(value.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              accessibilityLabel="Page handle"
              error={fieldErrors.handle}
              helper={`After admin approval, your page will be tendso.com/a/${handle || 'your-page'}`}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionLabel>Password</SectionLabel>
          <Field
            label="Password"
            icon="lock-closed-outline"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={(t) => { setPassword(t); clearFieldError('password'); }}
            secureTextEntry={!showPassword}
            editable={!loading}
            accessibilityLabel="Password"
            error={fieldErrors.password}
            right={<PasswordEye shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
          />
          <Field
            label="Confirm password"
            icon="lock-closed-outline"
            placeholder="Type it again"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); clearFieldError('confirmPassword'); }}
            secureTextEntry={!showPassword}
            editable={!loading}
            accessibilityLabel="Confirm Password"
            error={fieldErrors.confirmPassword}
          />
        </View>

        {accountType === 'creator' ? (
          <View style={styles.section}>
            <SectionLabel>Referral</SectionLabel>
            <Field
              label="Referral code"
              icon="gift-outline"
              placeholder="Enter code"
              value={referredByCode}
              onChangeText={(text) => setReferredByCode(text.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!loading}
              accessibilityLabel="Referral Code"
              helper="Optional"
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <TermsCheck
            checked={acceptedTerms}
            onToggle={() => setAcceptedTerms(!acceptedTerms)}
            onOpenTerms={() => void openExternalUrl(TERMS_URL)}
            onOpenPrivacy={() => void openExternalUrl(PRIVACY_URL)}
          />
          <Button
            title="Get started"
            loading={loading}
            disabled={loading || googleLoading || tiktokLoading || !acceptedTerms}
            onPress={handleSignup}
          />
        </View>

        <OrDivider />

        {!acceptedTerms && (
          <Text variant="label" weight="medium" tone="muted" align="center" style={styles.gate}>
            Accept the terms to continue.
          </Text>
        )}

        {/* Sign up with Apple is required by App Store Guideline 4.8 since we offer Google. Apple's
            OFFICIAL button: the HIG mandates their exact mark and wording, so we don't draw our own.
            The terms gate is enforced in the handler (this component has no `disabled`). It sits
            ABOVE Google (HIG: at least as prominent) and shares its height and pill radius. */}
        <View style={styles.social}>
          {Platform.OS === 'ios' && appleAvailable && (
            <View style={{ opacity: appleLoading || !acceptedTerms ? 0.55 : 1 }}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={SOCIAL_RADIUS}
                style={styles.apple}
                onPress={handleAppleSignUp}
              />
            </View>
          )}
          <GooglePill
            onPress={handleGoogleSignUp}
            disabled={busy || !acceptedTerms}
            loading={googleLoading}
            dimmed={!acceptedTerms}
          />
          {TIKTOK_ENABLED ? (
            <SocialPill
              logo={<TikTokLogo size={22} />}
              label="Continue with TikTok"
              onPress={handleTikTokSignUp}
              disabled={loading || googleLoading || tiktokLoading}
              loading={tiktokLoading}
            />
          ) : null}
        </View>

        <View style={styles.alt}>
          <Text variant="body" weight="semibold" tone="ink2">
            Already with us?
          </Text>
          <GuardedLink href="/(auth)/login" asChild>
            <AuthLink label="Sign in" accessibilityLabel="Sign In" />
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
        onChangePhone={(v) => setTtPhone(v.replace(/[^0-9]/g, ''))}
        onChangeCode={setTtCode}
        loading={ttLoading}
        error={ttError}
        lastNameOptional={accountType === 'affiliate'}
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
  banner: { marginBottom: space.lg },
  section: { gap: space.md, marginBottom: space.xl },
  note: { paddingHorizontal: space.xs },
  split: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  half: { flex: 1, minWidth: 0 },
  resend: { marginTop: space.lg },
  gate: { marginBottom: space.md },
  social: { gap: space.md },
  apple: { height: SOCIAL_HEIGHT, width: '100%' },
  alt: {
    marginTop: space.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
