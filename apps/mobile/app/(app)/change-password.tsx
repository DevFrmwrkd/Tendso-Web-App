import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
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
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#E4B05E" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={20} color="#71717a" />
          <Text style={{ color: '#71717a', marginLeft: 8, fontSize: 15 }}>Back</Text>
        </TouchableOpacity>

        {/* Title */}
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#18181b' }}>
            {hasPassword ? 'Change Password' : 'Set a Password'}
          </Text>
          <Text style={{ fontSize: 14, color: '#71717a', marginTop: 4 }}>
            {hasPassword
              ? 'Choose a strong password to keep your account secure.'
              : 'Add a password so you can also sign in with your email — a backup for your Apple or Google login.'}
          </Text>
        </View>

        {/* Success banner */}
        {success && (
          <View style={{
            backgroundColor: '#F5E4C0', borderWidth: 1, borderColor: '#F2D8A0',
            borderRadius: 14, padding: 14, marginBottom: 20,
            flexDirection: 'row', alignItems: 'center', gap: 8,
          }}>
            <Ionicons name="checkmark-circle" size={18} color="#E4B05E" />
            <Text style={{ color: '#6B4A12', fontWeight: '600', fontSize: 13 }}>
              {hasPassword ? 'Password changed! Redirecting…' : 'Password set! Redirecting…'}
            </Text>
          </View>
        )}

        {/* Error banner */}
        {!!error && (
          <View style={{
            backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5',
            borderRadius: 14, padding: 14, marginBottom: 20,
          }}>
            <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Current Password — only when one exists (not for social sign-ups) */}
        {hasPassword && (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 8 }}>
            Current Password
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e4e4e7',
            borderRadius: 14, paddingHorizontal: 14, height: 52,
          }}>
            <Ionicons name="lock-closed-outline" size={18} color="#a1a1aa" />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#18181b' }}
              placeholder="Enter current password"
              placeholderTextColor="#a1a1aa"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrent}
              editable={!loading}
              accessibilityLabel="Current password"
            />
            <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} accessibilityLabel={showCurrent ? "Hide current password" : "Show current password"} accessibilityRole="button">
              <Ionicons
                name={showCurrent ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color="#a1a1aa"
              />
            </TouchableOpacity>
          </View>
        </View>
        )}

        {/* New Password */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 8 }}>
            {hasPassword ? 'New Password' : 'Password'}
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e4e4e7',
            borderRadius: 14, paddingHorizontal: 14, height: 52,
          }}>
            <Ionicons name="lock-open-outline" size={18} color="#a1a1aa" />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#18181b' }}
              placeholder="At least 8 characters"
              placeholderTextColor="#a1a1aa"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNew}
              editable={!loading}
              accessibilityLabel="New password"
            />
            <TouchableOpacity onPress={() => setShowNew(!showNew)} accessibilityLabel={showNew ? "Hide new password" : "Show new password"} accessibilityRole="button">
              <Ionicons
                name={showNew ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color="#a1a1aa"
              />
            </TouchableOpacity>
          </View>

          {/* Strength hint */}
          {newPassword.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              {[1, 2, 3, 4].map((level) => {
                const strength =
                  newPassword.length >= 12 && /[^a-zA-Z0-9]/.test(newPassword) ? 4
                  : newPassword.length >= 10 ? 3
                  : newPassword.length >= 8  ? 2
                  : 1;
                return (
                  <View
                    key={level}
                    style={{
                      flex: 1, height: 3, borderRadius: 2,
                      backgroundColor: level <= strength
                        ? strength <= 1 ? '#ef4444'
                          : strength === 2 ? '#f59e0b'
                          : strength === 3 ? '#E4B05E'
                          : '#6366f1'
                        : '#e4e4e7',
                    }}
                  />
                );
              })}
              <Text style={{ fontSize: 10, color: '#71717a', marginLeft: 4, fontWeight: '600' }}>
                {newPassword.length < 8 ? 'Weak' : newPassword.length < 10 ? 'Fair' : newPassword.length < 12 ? 'Good' : 'Strong'}
              </Text>
            </View>
          )}
        </View>

        {/* Confirm New Password */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 8 }}>
            {hasPassword ? 'Confirm New Password' : 'Confirm Password'}
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb',
            borderWidth: 1,
            borderColor: confirmPassword && confirmPassword !== newPassword ? '#fca5a5' : '#e4e4e7',
            borderRadius: 14, paddingHorizontal: 14, height: 52,
          }}>
            <Ionicons name="lock-closed-outline" size={18} color="#a1a1aa" />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#18181b' }}
              placeholder="Re-enter new password"
              placeholderTextColor="#a1a1aa"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showNew}
              editable={!loading}
              accessibilityLabel="Confirm new password"
            />
            {confirmPassword.length > 0 && (
              <Ionicons
                name={confirmPassword === newPassword ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={confirmPassword === newPassword ? '#E4B05E' : '#ef4444'}
              />
            )}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleChangePassword}
          disabled={loading || success}
          style={{
            height: 52, borderRadius: 14,
            backgroundColor: loading || success ? '#a1a1aa' : '#18181b',
            alignItems: 'center', justifyContent: 'center',
          }}
          accessibilityLabel={hasPassword ? 'Change password' : 'Set password'}
          accessibilityRole="button"
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{hasPassword ? 'Change Password' : 'Set Password'}</Text>
          }
        </TouchableOpacity>

        <Text style={{ fontSize: 11, color: '#a1a1aa', textAlign: 'center', marginTop: 14, lineHeight: 16 }}>
          {hasPassword
            ? 'All other active sessions will be signed out\nafter changing your password.'
            : 'You can then sign in with your email and this\npassword, alongside Apple or Google.'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
