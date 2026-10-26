import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useLocalSearchParams } from 'expo-router';
import { useDeleteAccount } from '../../hooks/useDeleteAccount';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { colors, radius, shadow, space } from '../../theme/v2';
import { Avatar, Banner, Button, Field, Loading, ScreenShell, Text, TextLink } from '../../components/v2';
import { isCreatorAccount } from '../../../../lib/accounts';

const PHONE_REGEX = /^(\+63|0)?9\d{9}$/;

export default function EditProfileScreen() {
  const router = useGuardedRouter();
  const { review } = useLocalSearchParams<{ review?: string }>();
  const { user, isLoaded } = useUser();
  const { busy: deleting, canDelete, requestDelete } = useDeleteAccount();
  const updateCreator = useMutation(api.creators.update);
  const resubmitProfileForReview = useMutation(api.creators.resubmitProfileForReview);
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
  const [error,     setError]               = useState('');
  const [success,   setSuccess]             = useState(false);
  const initializedId = useRef<string | null>(null);
  const saving = useRef(false);
  const reviewing = review === '1' && isCreatorAccount(creator);

  useEffect(() => {
    if (!reviewing || !creator) return;
    if (creator.certifiedAt) router.replace('/(app)/(tabs)/');
    else if (creator.rejectedAt && !creator.quizPassedAt) router.replace('/(app)/verification-rejected');
    else if (!creator.rejectedAt) {
      router.replace(creator.quizPassedAt ? '/(app)/pending-review' : '/(app)/training');
    }
  }, [reviewing, creator, router]);

  // Pre-fill from loaded creator
  useEffect(() => {
    // Live last-active/status updates must not overwrite an unsaved correction.
    if (creator && initializedId.current !== creator._id) {
      initializedId.current = creator._id;
      setFirstName(creator.firstName  ?? '');
      setLastName(creator.lastName   ?? '');
      setPhone(creator.phone        ?? '');
    }
  }, [creator]);

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
    if (!user || !creator?._id || saving.current) return;

    const trimFirst = firstName.trim();
    const trimLast  = lastName.trim();
    const trimPhone = phone.trim();

    if (!trimFirst) {
      setError('First name is required.');
      return;
    }
    if (reviewing && trimPhone && !PHONE_REGEX.test(trimPhone)) {
      setError('Please enter a valid PH mobile number, or leave it blank.');
      return;
    }

    saving.current = true;
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

      const updates = {
        id: creator._id,
        firstName: trimFirst,
        lastName: trimLast,
        phone: trimPhone,
        ...(profileImageUrl ? { profileImage: profileImageUrl } : {}),
      };
      if (reviewing) {
        // Profile corrections and re-entering review are one server transaction.
        // A passed quiz is preserved; this does not grant certification.
        await resubmitProfileForReview(updates);
      } else {
        await updateCreator(updates);
      }

      // Convex is the profile displayed in the app. A Clerk sync failure must
      // not make a successful resubmission look like it failed.
      void user.update({ firstName: trimFirst, lastName: trimLast || '' }).catch(() => {});

      if (reviewing) {
        router.replace('/(app)/pending-review');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.back(), 1200);
    } catch (err: any) {
      console.error('Edit profile error:', err);
      setError(err?.errors?.[0]?.message ?? err?.message ?? 'Failed to update profile.');
    } finally {
      saving.current = false;
      setLoading(false);
    }
  };

  if (!isLoaded || creator === undefined) {
    return <Loading />;
  }

  // After soft-delete, getByClerkId returns null — redirect to login
  if (creator === null) {
    return <Loading />;
  }
  if (reviewing && !creator.quizPassedAt) return <Loading />;

  // Avatar: local picked URI > existing profile image > initial letter
  const avatarUri     = profileImageUri ?? creator.profileImage ?? null;
  const email         = creator.email || user?.primaryEmailAddress?.emailAddress || '';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenShell
        title={reviewing ? 'Fix your profile' : 'Edit profile'}
        subtitle={reviewing ? "Update your details and send them for review. Your quiz pass is saved." : undefined}
        onBack={() => router.back()}
        contentStyle={styles.content}
        footer={
          <Button
            title={reviewing ? 'Resubmit for review' : success ? 'Saved' : 'Save changes'}
            onPress={handleSave}
            loading={loading}
            disabled={loading || success}
            accessibilityLabel={reviewing ? 'Resubmit for review' : 'Save changes'}
          />
        }
      >
        {success ? <Banner tone="ok" title="Profile updated" /> : null}
        {error ? <Banner tone="danger" body={error} /> : null}
        {reviewing && creator.rejectionReason ? <Banner tone="warn" title="What needs fixing" body={creator.rejectionReason} /> : null}

        {/* Avatar picker */}
        <View style={styles.avatarBlock}>
          <Pressable
            onPress={handlePickImage}
            disabled={loading}
            accessibilityLabel="Change profile photo"
            accessibilityRole="button"
            style={styles.avatarPress}
          >
            <Avatar uri={avatarUri} name={firstName || undefined} size={96} />
            <View style={[styles.camera, shadow.soft]}>
              <Ionicons name="camera" size={18} color={colors.onAccent} />
            </View>
          </Pressable>
          <Text variant="label" tone="muted" weight="medium">
            Tap the photo to change it
          </Text>
        </View>

        <Field
          label="First name"
          placeholder="First name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          editable={!loading}
          accessibilityLabel="First name"
        />
        <Field
          label="Last name"
          placeholder="Last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          editable={!loading}
          accessibilityLabel="Last name"
        />
        <Field
          label="Mobile"
          icon="call-outline"
          placeholder="e.g. 09171234567"
          value={phone}
          onChangeText={(v) => setPhone(v.replace(/[^0-9+]/g, ''))}
          keyboardType="number-pad"
          maxLength={15}
          editable={!loading}
          accessibilityLabel="Phone number"
        />
        <Field
          label="Email"
          icon="mail-outline"
          value={email}
          editable={false}
          helper="Can't change"
          right={<Ionicons name="lock-closed" size={20} color={colors.ink3} />}
          accessibilityLabel="Email"
        />

        {/* Delete account: intentionally buried at the bottom. The confirmation alerts explain what happens. */}
        <View style={styles.danger}>
          <TextLink
            label={deleting ? 'Deleting account…' : 'Delete my account'}
            tone="danger"
            onPress={() => {
              if (deleting || loading || !canDelete) return;
              requestDelete();
            }}
          />
        </View>
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.md, paddingTop: space.lg, paddingBottom: space.xxl },
  avatarBlock: { alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  avatarPress: { width: 96, height: 96 },
  camera: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  danger: { marginTop: space.huge, alignItems: 'center' },
});
