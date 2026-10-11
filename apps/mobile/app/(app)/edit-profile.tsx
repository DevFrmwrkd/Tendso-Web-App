import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useGuardedRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const updateCreator = useMutation(api.creators.update);
  const deleteAccount = useMutation(api.creators.deleteAccount);
  const generateR2UploadUrl = useAction(api.r2.generateUploadUrl);

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const [firstName, setFirstName]           = useState('');
  const [lastName,  setLastName]            = useState('');
  const [phone,     setPhone]               = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [loading,   setLoading]             = useState(false);
  const [deleting,  setDeleting]            = useState(false);
  const [error,     setError]               = useState('');
  const [success,   setSuccess]             = useState(false);

  // Pre-fill from loaded creator
  useEffect(() => {
    if (creator) {
      setFirstName(creator.firstName  ?? '');
      setLastName(creator.lastName   ?? '');
      setPhone(creator.phone        ?? '');
    }
  }, [creator]);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Your account will be deleted and you will be signed out immediately. You will not be able to sign in again. Records are kept for 30 days to meet our legal obligations, then permanently erased. If you sign up again you will start fresh, with no prior data or certification.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'After 30 days your data will be permanently removed. If you re-register, you will start as a brand new creator.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    if (!creator?._id) return;
                    const creatorId = creator._id;
                    setDeleting(true);
                    try {
                      // ORDER IS LOad-BEARING. deleteAccount runs requireAuth()
                      // on the Convex side, so it must go first — deleting the
                      // Clerk user invalidates the token and it would fail.
                      await deleteAccount({ id: creatorId });

                      // Guideline 5.1.1(v) requires the account to actually be
                      // gone, not deactivated. The Convex mutation is a SOFT
                      // delete (flags isDeleted, keeps the row for 30-day
                      // retention), so without this the login credentials keep
                      // working and a reviewer testing "delete, then sign in
                      // again" gets straight back into the app.
                      //
                      // Deliberately NOT wrapped in its own try/catch: a
                      // soft-deleted row with a live Clerk user is the exact
                      // state the guideline prohibits, so a failure here must
                      // surface rather than be swallowed.
                      await user?.delete();

                      await signOut();
                      router.replace('/(auth)/login');
                    } catch (err: any) {
                      Alert.alert('Error', err?.message || 'Failed to delete account. Please try again.');
                      setDeleting(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant access to your photos to update your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      // Normalize the picked/cropped image so the round avatar is deterministic
      // on every device. expo-image-picker's built-in editor alone doesn't
      // guarantee this, which is why "centered in the square cropper" didn't
      // match the round avatar:
      //   • center-square crop — guards against a non-square result (some
      //     Android crop intents return the full image / wrong aspect)
      //   • bake EXIF orientation — iPhone photos carry a rotation flag the
      //     native crop preview honors but a raw <Image> renders shifted/rotated
      //   • downscale + re-encode as REAL JPEG — iPhones hand back HEIC, which
      //     we were uploading mislabeled as image/jpeg (renders inconsistently)
      try {
        const side = Math.min(asset.width, asset.height);
        const originX = Math.round((asset.width - side) / 2);
        const originY = Math.round((asset.height - side) / 2);

        const rendered = await ImageManipulator.manipulate(asset.uri)
          .crop({ originX, originY, width: side, height: side })
          .resize({ width: 512, height: 512 })
          .renderAsync();
        const output = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
        setProfileImageUri(output.uri);
      } catch (e) {
        // If normalization ever fails, fall back to the raw cropped uri so the
        // user can still set a photo.
        console.warn('Avatar normalization failed, using raw crop:', e);
        setProfileImageUri(asset.uri);
      }
    }
  };

  const handleSave = async () => {
    if (!user || !creator?._id) return;

    const trimFirst = firstName.trim();
    const trimLast  = lastName.trim();

    if (!trimFirst) {
      setError('First name is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let profileImageUrl: string | undefined;

      // Upload new profile image to R2 if one was picked
      if (profileImageUri) {
        const { uploadUrl, publicUrl } = await generateR2UploadUrl({
          folder: 'profile',
          filename: `avatar-${creator._id}.jpg`,
          contentType: 'image/jpeg',
        });

        const response = await fetch(profileImageUri);
        const blob = await response.blob();

        const uploadResult = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });

        if (!uploadResult.ok) {
          throw new Error('Failed to upload profile image. Please try again.');
        }

        profileImageUrl = publicUrl;
      }

      // Update Clerk profile
      await user.update({ firstName: trimFirst, lastName: trimLast || undefined });

      // Update Convex creator record
      await updateCreator({
        id: creator._id,
        firstName: trimFirst || undefined,
        lastName:  trimLast  || undefined,
        phone:     phone.trim() || undefined,
        ...(profileImageUrl ? { profileImage: profileImageUrl } : {}),
      });

      setSuccess(true);
      setTimeout(() => router.back(), 1200);
    } catch (err: any) {
      console.error('Edit profile error:', err);
      setError(err?.errors?.[0]?.message ?? err?.message ?? 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || creator === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#E4B05E" />
      </View>
    );
  }

  // After soft-delete, getByClerkId returns null — redirect to login
  if (creator === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#E4B05E" />
      </View>
    );
  }

  // Avatar: local picked URI > existing profile image > initial letter
  const avatarUri     = profileImageUri ?? creator.profileImage ?? null;
  const displayInitial = (firstName || 'U').charAt(0).toUpperCase();

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
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#18181b' }}>Edit Profile</Text>
          <Text style={{ fontSize: 14, color: '#71717a', marginTop: 4 }}>
            Update your name, contact details and photo.
          </Text>
        </View>

        {/* Success banner */}
        {success && (
          <View style={{
            backgroundColor: '#F5E4C0', borderWidth: 1, borderColor: '#F2D8A0',
            borderRadius: 14, padding: 14, marginBottom: 16,
            flexDirection: 'row', alignItems: 'center', gap: 8,
          }}>
            <Ionicons name="checkmark-circle" size={18} color="#E4B05E" />
            <Text style={{ color: '#6B4A12', fontWeight: '600', fontSize: 13 }}>
              Profile updated successfully!
            </Text>
          </View>
        )}

        {/* Error banner */}
        {!!error && (
          <View style={{
            backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5',
            borderRadius: 14, padding: 14, marginBottom: 16,
          }}>
            <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Avatar picker */}
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <TouchableOpacity onPress={handlePickImage} disabled={loading} activeOpacity={0.8} accessibilityLabel="Change profile photo" accessibilityRole="button">
            <View style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: '#18181b',
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: 88, height: 88, borderRadius: 44 }}
                  accessibilityLabel="Profile photo"
                  accessibilityRole="image"
                />
              ) : (
                <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>
                  {displayInitial}
                </Text>
              )}
            </View>

            {/* Camera badge */}
            <View style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: '#E4B05E',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: '#fff',
            }}>
              <Ionicons name="camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={{ color: '#a1a1aa', fontSize: 12, marginTop: 10 }}>
            {user?.primaryEmailAddress?.emailAddress}
          </Text>
          <Text style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>
            Tap photo to change
          </Text>
        </View>

        {/* First Name */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 8 }}>
            First Name
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e4e4e7',
            borderRadius: 14, paddingHorizontal: 14, height: 52,
          }}>
            <Ionicons name="person-outline" size={18} color="#a1a1aa" />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#18181b' }}
              placeholder="First name"
              placeholderTextColor="#a1a1aa"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              editable={!loading}
              accessibilityLabel="First name"
            />
          </View>
        </View>

        {/* Last Name */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 8 }}>
            Last Name
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e4e4e7',
            borderRadius: 14, paddingHorizontal: 14, height: 52,
          }}>
            <Ionicons name="person-outline" size={18} color="#a1a1aa" />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#18181b' }}
              placeholder="Last name"
              placeholderTextColor="#a1a1aa"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              editable={!loading}
              accessibilityLabel="Last name"
            />
          </View>
        </View>

        {/* Phone */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#3f3f46', marginBottom: 8 }}>
            Phone Number
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e4e4e7',
            borderRadius: 14, paddingHorizontal: 14, height: 52,
          }}>
            <Ionicons name="call-outline" size={18} color="#a1a1aa" />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#18181b' }}
              placeholder="e.g. 09171234567"
              placeholderTextColor="#a1a1aa"
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={15}
              editable={!loading}
              accessibilityLabel="Phone number"
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading || success}
          style={{
            height: 52, borderRadius: 14,
            backgroundColor: loading || success ? '#a1a1aa' : '#18181b',
            alignItems: 'center', justifyContent: 'center',
          }}
          accessibilityLabel="Save changes"
          accessibilityRole="button"
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save Changes</Text>
          }
        </TouchableOpacity>

        {/* Delete Account — intentionally buried at the bottom with extra spacing */}
        <View style={{ marginTop: 60, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#fee2e2' }}>
          <View style={{
            backgroundColor: '#fef2f2', borderRadius: 14, padding: 16, marginBottom: 16,
            flexDirection: 'row', alignItems: 'flex-start', gap: 10,
          }}>
            <Ionicons name="warning-outline" size={18} color="#dc2626" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#dc2626' }}>Danger Zone</Text>
              <Text style={{ fontSize: 12, color: '#991b1b', marginTop: 4, lineHeight: 17 }}>
                Your account will be deleted immediately and you will not be able to sign in again. Records are kept for 30 days to meet our legal obligations, then permanently erased. If you sign up again with the same email or Google account, you will start completely fresh with no prior submissions, earnings, or certification.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={deleting || loading}
            style={{
              height: 48, borderRadius: 14,
              backgroundColor: '#fff',
              borderWidth: 1.5, borderColor: '#fca5a5',
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 8,
            }}
            accessibilityLabel="Delete account"
            accessibilityRole="button"
          >
            {deleting
              ? <ActivityIndicator size="small" color="#ef4444" />
              : <Ionicons name="trash-outline" size={16} color="#ef4444" />
            }
            <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 14 }}>
              {deleting ? 'Deleting account...' : 'Delete My Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
