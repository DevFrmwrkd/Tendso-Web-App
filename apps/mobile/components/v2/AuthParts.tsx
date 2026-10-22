import React, { forwardRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, hit, radius, shadow, space } from '../../theme/v2';
import { TikTokLogo } from '../TikTokLogo';
import { Banner } from './Banner';
import { Button } from './Button';
import { Field } from './Field';
import { Text } from './Text';

/**
 * Pieces shared by the three auth screens (login, signup, forgot password). Presentation only:
 * every handler, state and Clerk call stays in the screen that owns it.
 */

/** Height shared by the Apple and Google pills so the pair lines up (mock `.cm-sso`). */
export const SOCIAL_HEIGHT = 56;
export const SOCIAL_RADIUS = SOCIAL_HEIGHT / 2;

export function GoogleLogo({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

/** White pill with a brand logo: the second half of the matched pair under Apple's native button. */
export function SocialPill({
  logo,
  label,
  onPress,
  disabled,
  loading,
  dimmed,
}: {
  logo: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Visual 0.6 opacity without changing whether it can be pressed (terms not accepted yet). */
  dimmed?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.google,
        shadow.soft,
        { opacity: loading || dimmed ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <>
          {logo}
          <Text variant="button" numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function GooglePill(props: Omit<React.ComponentProps<typeof SocialPill>, 'logo' | 'label'> & { label?: string }) {
  return <SocialPill {...props} logo={<GoogleLogo />} label={props.label ?? 'Continue with Google'} />;
}

/** "or" between the email form and the social pills (mock `.cm-or`). */
export function OrDivider() {
  return (
    <View style={styles.or} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.orLine} />
      <Text variant="label" tone="muted" weight="bold">
        or
      </Text>
      <View style={styles.orLine} />
    </View>
  );
}

/**
 * Quiet underlined text link. A forwardRef Pressable so it can sit under `<GuardedLink asChild>`
 * (the Link clones its onPress / href into this element).
 */
export const AuthLink = forwardRef<
  View,
  Omit<PressableProps, 'children' | 'style'> & {
    label: string;
    tone?: 'ink' | 'muted';
    align?: 'left' | 'center' | 'right';
  }
>(function AuthLink({ label, tone = 'ink', align = 'center', accessibilityLabel, ...rest }, ref) {
  return (
    <Pressable
      ref={ref}
      hitSlop={8}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      {...rest}
      style={{
        minHeight: hit.min,
        justifyContent: 'center',
        alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
      }}
    >
      <Text
        variant="label"
        weight="bold"
        tone={tone}
        style={{ textDecorationLine: 'underline', textDecorationColor: colors.ink }}
      >
        {label}
      </Text>
    </Pressable>
  );
});

/** Eye toggle for a password Field's `right` slot. */
export function PasswordEye({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={shown ? 'Hide password' : 'Show password'}
      style={styles.eye}
    >
      <Ionicons name={shown ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.ink3} />
    </Pressable>
  );
}

/**
 * Six digit boxes (mock `.cm-code6`) driven by ONE real TextInput laid over them, so paste,
 * SMS / email autofill and the number pad all keep working.
 */
export function CodeBoxes({
  value,
  onChangeText,
  accessibilityLabel,
  editable = true,
  length = 6,
}: {
  value: string;
  onChangeText: (v: string) => void;
  accessibilityLabel: string;
  editable?: boolean;
  length?: number;
}) {
  const [focused, setFocused] = useState(false);
  const current = Math.min(value.length, length - 1);
  return (
    <View style={styles.codeWrap}>
      <View style={styles.codeRow} pointerEvents="none">
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.codeBox, shadow.soft, focused && i === current ? styles.codeBoxOn : null]}>
            <Text variant="heading" weight="bold">
              {value[i] ?? ''}
            </Text>
          </View>
        ))}
      </View>
      <TextInput
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={length}
        editable={editable}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        caretHidden
        selectionColor="transparent"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={accessibilityLabel}
        style={styles.codeInput}
      />
    </View>
  );
}

/**
 * One account-type choice (same look as `OptionRow`: white card, 2pt ink border and accent tick when
 * selected) but with an explicit accessibility label ("Field agent account") for the tests and screen readers.
 */
export function AccountTypeOption({
  title,
  subtitle,
  icon,
  selected,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={subtitle}
      accessibilityState={{ checked: selected, selected, disabled: !!disabled }}
      style={({ pressed }) => [
        styles.option,
        shadow.soft,
        selected ? styles.optionOn : null,
        disabled ? { opacity: 0.5 } : null,
        pressed ? { transform: [{ scale: 0.99 }] } : null,
      ]}
    >
      <View style={[styles.optionTile, selected ? { backgroundColor: colors.accent } : null]}>
        <Ionicons name={icon} size={22} color={colors.ink} />
      </View>
      <View style={styles.optionText}>
        <Text variant="bodyLg" weight="semibold">
          {title}
        </Text>
        <Text variant="label" weight="medium" tone="muted">
          {subtitle}
        </Text>
      </View>
      {selected ? (
        <View style={styles.tick}>
          <Ionicons name="checkmark" size={16} color={colors.onAccent} />
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * The terms checkbox row. The checkbox itself is one control (label "Accept Terms of Service");
 * the two links inside the sentence open the Terms / Privacy pages.
 */
export function TermsCheck({
  checked,
  onToggle,
  onOpenTerms,
  onOpenPrivacy,
}: {
  checked: boolean;
  onToggle: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel="Accept Terms of Service"
      style={[styles.terms, shadow.soft]}
    >
      <View style={[styles.box, checked ? styles.boxOn : null]}>
        {checked ? <Ionicons name="checkmark" size={18} color={colors.onAccent} /> : null}
      </View>
      <Text variant="label" weight="medium" tone="ink2" style={styles.termsText}>
        I agree to the{' '}
        <Text
          variant="label"
          weight="bold"
          accessibilityRole="link"
          style={styles.underline}
          onPress={onOpenTerms}
        >
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text
          variant="label"
          weight="bold"
          accessibilityRole="link"
          style={styles.underline}
          onPress={onOpenPrivacy}
        >
          Privacy Policy
        </Text>
      </Text>
    </Pressable>
  );
}

export interface TikTokProfileSheetProps {
  visible: boolean;
  step: 'profile' | 'verify';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  code: string;
  onChangeFirstName: (v: string) => void;
  onChangeLastName: (v: string) => void;
  onChangeEmail: (v: string) => void;
  onChangePhone: (v: string) => void;
  onChangeCode: (v: string) => void;
  loading: boolean;
  error: string;
  /** Shows "Last name (optional)" placeholder instead of the required one. */
  lastNameOptional?: boolean;
  onSubmitProfile: () => void;
  onVerify: () => void;
  onBackToProfile: () => void;
  onClose: () => void;
}

/**
 * TikTok sign-in finishing sheet: TikTok does not hand over name / email, so we collect them here and
 * verify the email code. Presentation only; the screen owns the SSO sign-up object and the handlers.
 */
export function TikTokProfileSheet(p: TikTokProfileSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.scrim}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
            <View style={styles.grab} />
            <ScrollView
              contentContainerStyle={styles.sheetBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sheetHead}>
                <View style={styles.sheetLogo}>
                  <TikTokLogo size={28} />
                </View>
                <Text variant="title" align="center" accessibilityRole="header">
                  {p.step === 'profile' ? 'Finish your profile' : 'Check your email'}
                </Text>
                <Text variant="bodyLg" tone="ink2" align="center">
                  {p.step === 'profile'
                    ? "TikTok doesn't share your details. Add them to finish."
                    : `We sent a 6-digit code to ${p.email}`}
                </Text>
              </View>

              {p.error ? <Banner tone="danger" body={p.error} /> : null}

              {p.step === 'profile' ? (
                <>
                  <Field
                    label="First name"
                    icon="person-outline"
                    placeholder="Juan"
                    value={p.firstName}
                    onChangeText={p.onChangeFirstName}
                    autoCapitalize="words"
                    editable={!p.loading}
                    accessibilityLabel="First Name"
                  />
                  <Field
                    label="Last name"
                    placeholder={p.lastNameOptional ? 'Optional' : 'Dela Cruz'}
                    value={p.lastName}
                    onChangeText={p.onChangeLastName}
                    autoCapitalize="words"
                    editable={!p.loading}
                    accessibilityLabel="Last Name"
                  />
                  <Field
                    label="Email"
                    icon="mail-outline"
                    placeholder="your@email.com"
                    value={p.email}
                    onChangeText={p.onChangeEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!p.loading}
                    accessibilityLabel="Email"
                  />
                  <Field
                    label="Mobile"
                    prefix="+63"
                    placeholder="912 345 6789"
                    value={p.phone}
                    onChangeText={p.onChangePhone}
                    keyboardType="number-pad"
                    maxLength={15}
                    editable={!p.loading}
                    accessibilityLabel="Mobile Number"
                    helper="Optional"
                  />
                  <Button title="Continue" loading={p.loading} onPress={p.onSubmitProfile} />
                </>
              ) : (
                <>
                  <CodeBoxes value={p.code} onChangeText={p.onChangeCode} editable={!p.loading} accessibilityLabel="Verification Code" />
                  <Button title="Verify email" loading={p.loading} onPress={p.onVerify} />
                  <AuthLink label="Back to profile" onPress={p.onBackToProfile} />
                </>
              )}
              <AuthLink label="Cancel" tone="muted" onPress={p.onClose} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    height: SOCIAL_HEIGHT,
    paddingHorizontal: space.xl,
    borderRadius: SOCIAL_RADIUS,
    backgroundColor: colors.card,
  },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xl - 4 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.ruleStrong },
  eye: { width: hit.min, height: hit.min, marginRight: -space.sm, alignItems: 'center', justifyContent: 'center' },
  codeWrap: { height: 64 },
  codeRow: { flexDirection: 'row', gap: space.sm, height: 64 },
  codeBox: {
    flex: 1,
    height: 64,
    borderRadius: radius.tick,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxOn: { borderColor: colors.ink },
  codeInput: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    fontFamily: fonts.bold,
    fontSize: 28,
    backgroundColor: 'transparent',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md + 2,
    minHeight: hit.large + 4,
    paddingVertical: space.sm + 2,
    paddingLeft: space.sm + 2,
    paddingRight: space.lg,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionOn: { borderColor: colors.ink },
  optionTile: {
    width: 44,
    height: 44,
    borderRadius: radius.tick,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 2, paddingLeft: space.xs },
  tick: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terms: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: hit.large,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.card - 2,
    backgroundColor: colors.card,
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.ink },
  termsText: { flex: 1, lineHeight: 24 },
  underline: { textDecorationLine: 'underline', textDecorationColor: colors.ink },
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  grab: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    marginTop: space.md,
    backgroundColor: colors.ruleStrong,
  },
  sheetBody: { padding: space.xl, gap: space.md },
  sheetHead: { alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  sheetLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
});
