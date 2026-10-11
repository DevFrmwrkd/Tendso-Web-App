import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { api } from '@tendso/convex-client';
import { Display, Body, Label, Door } from '../../components/ui/primitives';
import { colors, fonts, radius } from '../../theme/tokens';

// Same shape the signup screen validates against: +63 / 0 prefix optional, then
// a 10-digit mobile number starting 9.
const PHONE_REGEX = /^(\+63|0)?9\d{9}$/;

/**
 * Complete-profile gate for social sign-ups missing a name.
 *
 * Sign in with Apple returns the name only on a user's first-ever authorization,
 * so a re-installing (or "Hide My Email") user lands with a blank profile. Home
 * redirects such a creator here BEFORE onboarding. Apple already handled auth,
 * so there is no password step — this collects the name (required) plus an
 * optional phone and referral code. The email is shown locked, straight from the
 * Apple identity.
 *
 * Writes go to already-deployed public functions (creators.update,
 * creators.applyReferralCode), so no backend change is needed.
 */
export default function CompleteProfileScreen() {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip',
  );
  const updateCreator = useMutation(api.creators.update);
  const applyReferral = useMutation(api.creators.applyReferralCode);

  const email = useMemo(
    () => user?.primaryEmailAddress?.emailAddress ?? '',
    [user],
  );

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [referral, setReferral] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Referral is one-shot server-side (it throws "already applied" on a second
  // call). If the name-save below fails after the referral succeeded, a retry
  // must NOT re-apply it, or the user is trapped on that error.
  const referralApplied = useRef(false);

  // Still resolving the creator row (Home creates it before redirecting here).
  if (creator === undefined) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  const save = async () => {
    const first = firstName.trim();
    const last = lastName.trim();
    const rawPhone = phone.replace(/\s/g, '');
    const code = referral.trim();

    if (!first) {
      setError('Please enter your first name.');
      return;
    }
    if (rawPhone && !PHONE_REGEX.test(rawPhone)) {
      setError('Please enter a valid PH mobile number, or leave it blank.');
      return;
    }
    if (!creator?._id) return;

    setSaving(true);
    setError('');
    try {
      // Referral first, so an invalid code surfaces BEFORE we commit the name —
      // applyReferralCode throws on invalid/self/already-referred. It's optional,
      // so an empty field just skips it; a bad code stops here and the user can
      // fix or clear it (the name isn't lost because nothing is saved yet).
      if (code && !referralApplied.current) {
        await applyReferral({ id: creator._id, referredByCode: code });
        referralApplied.current = true;
      }

      // Best-effort Clerk update keeps user.firstName consistent; a Clerk hiccup
      // must not block the Convex write, which is what the app displays.
      try {
        await user?.update({ firstName: first, lastName: last || undefined });
      } catch (e) {
        console.warn('Clerk name update failed (non-fatal):', e);
      }

      await updateCreator({
        id: creator._id,
        firstName: first,
        lastName: last || undefined,
        phone: rawPhone || undefined,
      });

      // Back to Home — now that the creator has a name, its gate passes and the
      // normal onboarding redirect (training) takes over.
      router.replace('/(app)/(tabs)');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ marginBottom: 6 }}>
            <Label tracking={1.8}>ONE LAST STEP</Label>
          </View>
          <View style={{ marginBottom: 8 }}>
            <Display size="md">Tell us your</Display>
            <Display size="md" italic color={colors.accent}>name.</Display>
          </View>
          <Body size="sm" color={colors.ink3} style={{ marginBottom: 24 }}>
            You're signed in — we just need a name for your profile. Phone and referral code are optional.
          </Body>

          {/* Email — locked, straight from the Apple sign-in */}
          <FieldLabel>Email</FieldLabel>
          <View style={[fieldBox, { backgroundColor: colors.paper2 }]}>
            <Ionicons name="lock-closed-outline" size={17} color={colors.ink3} />
            <Text
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: colors.ink2, fontFamily: fonts.sans }}
              numberOfLines={1}
            >
              {email || 'From your Apple ID'}
            </Text>
          </View>
          <Body size="xs" color={colors.ink3} style={{ marginTop: 6, marginBottom: 18 }}>
            From your Apple sign-in — can't be changed here.
          </Body>

          {/* First name — required */}
          <FieldLabel>First name</FieldLabel>
          <View style={fieldBox}>
            <Ionicons name="person-outline" size={17} color={colors.ink3} />
            <TextInput
              style={inputStyle}
              placeholder="First name"
              placeholderTextColor={colors.ink3}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              editable={!saving}
              autoFocus
              accessibilityLabel="First name"
            />
          </View>

          {/* Last name — optional */}
          <FieldLabel style={{ marginTop: 16 }}>Last name</FieldLabel>
          <View style={fieldBox}>
            <Ionicons name="person-outline" size={17} color={colors.ink3} />
            <TextInput
              style={inputStyle}
              placeholder="Last name (optional)"
              placeholderTextColor={colors.ink3}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              editable={!saving}
              accessibilityLabel="Last name"
            />
          </View>

          {/* Phone — optional, +63 */}
          <FieldLabel style={{ marginTop: 16 }}>Phone (optional)</FieldLabel>
          <View style={fieldBox}>
            <Text style={{ fontFamily: fonts.monoMed, fontSize: 14, color: colors.ink2, letterSpacing: 0.5 }}>+63</Text>
            <TextInput
              style={[inputStyle, { marginLeft: 8 }]}
              placeholder="9XX XXX XXXX"
              placeholderTextColor={colors.ink3}
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={11}
              editable={!saving}
              accessibilityLabel="Phone number"
            />
          </View>

          {/* Referral — optional */}
          <FieldLabel style={{ marginTop: 16 }}>Referral code (optional)</FieldLabel>
          <View style={fieldBox}>
            <Ionicons name="gift-outline" size={17} color={colors.ink3} />
            <TextInput
              style={inputStyle}
              placeholder="Enter a code if you have one"
              placeholderTextColor={colors.ink3}
              value={referral}
              onChangeText={(v) => setReferral(v.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!saving}
              accessibilityLabel="Referral code"
            />
          </View>

          {error ? (
            <Body size="sm" color={colors.danger} style={{ marginTop: 16 }}>
              {error}
            </Body>
          ) : null}

          <View style={{ marginTop: 28 }}>
            <Door
              caption={saving ? 'SAVING…' : 'CONTINUE'}
              label="Save and continue"
              variant="accent"
              loading={saving}
              disabled={saving}
              onPress={save}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <Text style={[{ fontFamily: fonts.sansMed, fontSize: 13, color: colors.ink2, marginBottom: 8 }, style]}>
      {children}
    </Text>
  );
}

const fieldBox = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  backgroundColor: colors.paper3,
  borderWidth: 1,
  borderColor: colors.rule,
  borderRadius: 14,
  paddingHorizontal: 14,
  height: 52,
};

const inputStyle = {
  flex: 1,
  marginLeft: 10,
  fontSize: 15,
  color: colors.ink,
  fontFamily: fonts.sans,
};
