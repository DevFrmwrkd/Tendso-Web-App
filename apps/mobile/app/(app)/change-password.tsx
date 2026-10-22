import React, { useState } from 'react';
import { View, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space } from '../../theme/v2';
import { Banner, Button, Field, Loading, ScreenShell, Text } from '../../components/v2';

function EyeToggle({ shown, onPress, label }: { shown: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={shown ? `Hide ${label}` : `Show ${label}`}
      accessibilityRole="button"
      style={styles.eye}
    >
      <Ionicons name={shown ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.ink3} />
    </Pressable>
  );
}

export default function ChangePasswordScreen() {
  const router = useGuardedRouter();
  const { user, isLoaded } = useUser();
  const createNotification = useMutation(api.notifications.createForClient);
  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const [currentPassword,    setCurrentPassword]    = useState('');
  const [newPassword,        setNewPassword]        = useState('');
  const [confirmPassword,    setConfirmPassword]    = useState('');
  const [showCurrent,        setShowCurrent]        = useState(false);
  const [showNew,            setShowNew]            = useState(false);
  const [loading,            setLoading]            = useState(false);
  const [error,              setError]              = useState('');
  const [success,            setSuccess]            = useState(false);

  // Apple / Google users have no password (Clerk's passwordEnabled is false), so
  // there's nothing to "change" and no current password to ask for. This screen
  // becomes "Set a password" for them — after which they can ALSO sign in with
  // email + password, a fallback if they lose their social login.
  const hasPassword = !!user?.passwordEnabled;

  const handleChangePassword = async () => {
    if (!user) return;

    setError('');

    if (hasPassword && !currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setError(hasPassword ? 'Please enter a new password.' : 'Please enter a password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (hasPassword && currentPassword === newPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);

    try {
      // Clerk requires currentPassword only when one already exists; for a
      // passwordless (social) user, omitting it sets the first password.
      await user.updatePassword({
        ...(hasPassword ? { currentPassword } : {}),
        newPassword,
        signOutOfOtherSessions: true,
      });

      // Create password notification
      if (creator?._id) {
        await createNotification({
          creatorId: creator._id,
          type: 'password_changed',
          title: hasPassword ? 'Password Changed' : 'Password Set',
          body: hasPassword
            ? 'Your password has been updated successfully. All other active sessions have been signed out.'
            : 'You can now also sign in with your email and password.',
          data: {},
        });
      }

      setSuccess(true);
      setTimeout(() => router.back(), 1500);
    } catch (err: any) {
      console.error('Change password error:', err);
      const msg = err?.errors?.[0]?.message ?? err?.message ?? 'Failed to change password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return <Loading />;
  }

  const strength =
    newPassword.length >= 12 && /[^a-zA-Z0-9]/.test(newPassword) ? 4
    : newPassword.length >= 10 ? 3
    : newPassword.length >= 8 ? 2
    : 1;
  const strengthColor = strength <= 1 ? colors.danger : strength === 2 ? colors.warn : colors.ink;
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const buttonTitle = hasPassword ? 'Change password' : 'Set password';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenShell
        title={hasPassword ? 'Change password' : 'Set a password'}
        subtitle={
          hasPassword
            ? 'Pick a strong one.'
            : 'Add a password so you can also sign in with your email.'
        }
        onBack={() => router.back()}
        contentStyle={styles.content}
        footer={
          <>
            <Button
              title={success ? 'Done' : buttonTitle}
              onPress={handleChangePassword}
              loading={loading}
              disabled={loading || success}
              accessibilityLabel={hasPassword ? 'Change password' : 'Set password'}
            />
            <Text variant="label" tone="muted" align="center">
              {hasPassword
                ? 'Your other devices will be signed out.'
                : 'Apple or Google sign-in keeps working.'}
            </Text>
          </>
        }
      >
        {success ? (
          <Banner tone="ok" title={hasPassword ? 'Password changed' : 'Password set'} />
        ) : null}
        {error ? <Banner tone="danger" body={error} /> : null}

        {/* Current password: only when one exists (not for social sign-ups) */}
        {hasPassword ? (
          <Field
            label="Current password"
            icon="lock-closed-outline"
            placeholder="Enter current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry={!showCurrent}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            accessibilityLabel="Current password"
            right={<EyeToggle shown={showCurrent} onPress={() => setShowCurrent(!showCurrent)} label="current password" />}
          />
        ) : null}

        <View style={styles.group}>
          <Field
            label={hasPassword ? 'New password' : 'Password'}
            icon="lock-open-outline"
            placeholder="At least 8 characters"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNew}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            accessibilityLabel="New password"
            right={<EyeToggle shown={showNew} onPress={() => setShowNew(!showNew)} label="new password" />}
          />

          {/* Strength hint */}
          {newPassword.length > 0 ? (
            <View style={styles.strength}>
              {[1, 2, 3, 4].map((level) => (
                <View
                  key={level}
                  style={[styles.bar, { backgroundColor: level <= strength ? strengthColor : colors.bg2 }]}
                />
              ))}
              <Text variant="label" weight="bold" style={styles.strengthLabel}>
                {newPassword.length < 8 ? 'Weak' : newPassword.length < 10 ? 'Fair' : newPassword.length < 12 ? 'Good' : 'Strong'}
              </Text>
            </View>
          ) : null}
        </View>

        <Field
          label={hasPassword ? 'Confirm new password' : 'Confirm password'}
          icon="lock-closed-outline"
          placeholder="Re-enter new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showNew}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          error={mismatch ? 'Passwords do not match.' : null}
          accessibilityLabel="Confirm new password"
          right={
            confirmPassword.length > 0 ? (
              <Ionicons
                name={confirmPassword === newPassword ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={confirmPassword === newPassword ? colors.ink : colors.danger}
              />
            ) : undefined
          }
        />
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.md, paddingTop: space.lg, paddingBottom: space.xxl },
  group: { gap: space.sm },
  eye: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: -space.sm },
  strength: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs },
  bar: { flex: 1, height: 6, borderRadius: radius.pill },
  strengthLabel: { marginLeft: space.sm },
});
