import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  StyleSheet,
  ScrollView,
  TextInput,
  useWindowDimensions,
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
import { colors, hit, radius, space } from '../../theme/v2';
import { Avatar, Banner, Button, Field, Loading, ScreenShell, Text } from '../../components/v2';
import { ProfileReviewNotice } from '../../components/profile/ProfileReviewNotice';
import { isCreatorAccount } from '../../../../lib/accounts';

const PHONE_REGEX = /^(\+63|0)?9\d{9}$/;

export default function EditProfileScreen() {
  const { user, isLoaded } = useUser();
  return <EditProfileForm key={user?.id ?? 'signed-out'} user={user} isLoaded={isLoaded} />;
}

function EditProfileForm({ user, isLoaded }: {
  user: ReturnType<typeof useUser>['user'];
  isLoaded: boolean;
}) {
  const router = useGuardedRouter();
  const { review, field } = useLocalSearchParams<{ review?: string; field?: string }>();
  const { width, fontScale } = useWindowDimensions();
  const { busy: deleting, canDelete, requestDelete } = useDeleteAccount();
  const updateCreator = useMutation(api.creators.update);
  const resubmitProfileForReview = useMutation(api.creators.resubmitProfileForReview);
  const generateR2UploadUrl = useAction(api.r2.generateUploadUrl);

  const result = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );
  const creator = result && result.clerkId !== user?.id ? undefined : result;

  const [firstName, setFirstName]           = useState('');
  const [lastName,  setLastName]            = useState('');
  const [phone,     setPhone]               = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [loading,   setLoading]             = useState(false);
  const [picking, setPicking] = useState(false);
  const [error,     setError]               = useState('');
  const [success,   setSuccess]             = useState(false);
  const initializedId = useRef<string | null>(null);
  const saving = useRef(false);
  const pickingPhoto = useRef(false);
  const saved = useRef(false);
  const mounted = useRef(true);
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const firstNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const focusedTarget = useRef<string | null>(null);
  const pendingKeyboardReveal = useRef<{ key: string; y: number } | null>(null);
  const [fieldPositions, setFieldPositions] = useState<{ name?: number; phone?: number }>({});
  const targetField = field === 'name' || field === 'phone' ? field : null;
  const reviewing = review === '1' && isCreatorAccount(creator);
  const canEdit = isLoaded && !!user && !!creator && !creator.isDeleted
    && creator.status !== 'deleted' && creator.status !== 'suspended'
    && (!reviewing || (!!creator.rejectedAt && !!creator.quizPassedAt && !creator.certifiedAt));
  const current = useRef({ userId: user?.id, creatorId: creator?._id, canEdit, reviewing, deleting, canDelete });
  current.current = { userId: user?.id, creatorId: creator?._id, canEdit, reviewing, deleting, canDelete };
  const isCurrent = () => mounted.current && current.current.userId === user?.id
    && current.current.creatorId === creator?._id;
  const canWrite = () => isCurrent() && current.current.canEdit
    && current.current.reviewing === reviewing && !current.current.deleting;
  const busy = loading || picking || deleting;
  const splitNames = !reviewing && width >= 360 && fontScale <= 1.3;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (backTimer.current !== null) clearTimeout(backTimer.current);
    };
  }, []);

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

  useEffect(() => {
    let frame: number | undefined;
    const listener = Keyboard.addListener('keyboardDidShow', () => {
      const pending = pendingKeyboardReveal.current;
      pendingKeyboardReveal.current = null;
      if (!pending) return;
      // Focus opens the keyboard after the first scroll. Reveal again once
      // KeyboardAvoidingView has reduced the space above the pinned action.
      frame = requestAnimationFrame(() => {
        if (focusedTarget.current === pending.key) {
          scrollRef.current?.scrollTo({ y: pending.y, animated: false });
        }
      });
    });
    return () => {
      listener.remove();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

  // An Edit action opens the shared form at the chosen field, once per visit.
  // Wait for layout and profile prefill before opening the keyboard.
  useEffect(() => {
    if (!isLoaded || !creator?._id || !targetField || loading || deleting) return;
    const position = fieldPositions[targetField];
    const key = `${creator._id}:${targetField}`;
    if (position === undefined || focusedTarget.current === key) return;
    const frame = requestAnimationFrame(() => {
      const input = targetField === 'name' ? firstNameRef.current : phoneRef.current;
      if (!input) return;
      focusedTarget.current = key;
      const y = Math.max(0, position - space.md);
      pendingKeyboardReveal.current = Keyboard.isVisible() ? null : { key, y };
      scrollRef.current?.scrollTo({ y, animated: false });
      input.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isLoaded, creator?._id, targetField, fieldPositions, loading, deleting]);

  const recordFieldPosition = (name: 'name' | 'phone', y: number) => {
    setFieldPositions((positions) => positions[name] === y ? positions : { ...positions, [name]: y });
  };

  const handlePickImage = async () => {
    if (!canWrite() || saving.current || pickingPhoto.current || saved.current) return;
    pickingPhoto.current = true;
    setPicking(true);
    setError('');
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!canWrite()) return;
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
      if (!canWrite()) return;

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // Normalize the square crop and EXIF orientation before resizing and
        // encoding, so the saved photo matches the circular avatar preview.
        try {
          const side = Math.min(asset.width, asset.height);
          const originX = Math.round((asset.width - side) / 2);
          const originY = Math.round((asset.height - side) / 2);
          const rendered = await ImageManipulator.manipulate(asset.uri)
            .crop({ originX, originY, width: side, height: side })
            .resize({ width: 512, height: 512 })
            .renderAsync();
          if (!canWrite()) return;
          const output = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
          if (!canWrite()) return;
          setProfileImageUri(output.uri);
        } catch (e) {
          // Keep the existing cropped-photo fallback if normalization fails.
          if (canWrite()) {
            console.warn('Avatar normalization failed, using raw crop:', e);
            setProfileImageUri(asset.uri);
          }
        }
      }
    } catch (err) {
      if (canWrite()) setError(err instanceof Error ? err.message : 'Could not open your photos. Please try again.');
    } finally {
      pickingPhoto.current = false;
      if (mounted.current) setPicking(false);
    }
  };

  const handleSave = async () => {
    if (!user || !creator?._id || !canWrite() || saving.current || pickingPhoto.current || saved.current) return;

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
        if (!canWrite()) return;

        const response = await fetch(profileImageUri);
        if (!canWrite()) return;
        const blob = await response.blob();
        if (!canWrite()) return;

        const uploadResult = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });
        if (!canWrite()) return;

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
      if (!canWrite()) return;

      // Convex is the profile displayed in the app. A Clerk sync failure must
      // not make a successful resubmission look like it failed.
      void user.update({ firstName: trimFirst, lastName: trimLast || '' }).catch(() => {});

      if (reviewing) {
        router.replace('/(app)/pending-review');
        return;
      }

      saved.current = true;
      setSuccess(true);
      backTimer.current = setTimeout(() => {
        if (canWrite()) router.back();
      }, 1200);
    } catch (err: any) {
      if (!canWrite()) return;
      console.error('Edit profile error:', err);
      setError(err?.errors?.[0]?.message ?? err?.message ?? 'Failed to update profile.');
    } finally {
      saving.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  if (!isLoaded || creator === undefined) {
    return <Loading />;
  }

  // After soft-delete, getByClerkId returns null — redirect to login
  if (creator === null) {
    return <Loading />;
  }
  if (reviewing && !canEdit) return <Loading />;

  // Use the saved profile photo, with the Clerk avatar as a fallback.
  const savedPhoto = creator.profileImage && /^https?:\/\//.test(creator.profileImage)
    ? creator.profileImage
    : user?.imageUrl;
  const avatarUri = profileImageUri ?? savedPhoto ?? null;
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const email         = creator.email || user?.primaryEmailAddress?.emailAddress || '';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenShell
        title={reviewing ? 'Fix your profile' : undefined}
        subtitle={reviewing ? 'Correct your details below. Your quiz pass stays saved.' : undefined}
        onBack={() => router.back()}
        headerRight={!reviewing ? (
          <View pointerEvents="none" style={styles.headerTitle}>
            <Text variant="bodyLg" weight="bold" accessibilityRole="header">Edit profile</Text>
          </View>
        ) : undefined}
        contentStyle={styles.content}
        scrollRef={scrollRef}
        footer={
          <Button
            title={reviewing ? 'Resubmit for review' : success ? 'Saved' : 'Save changes'}
            onPress={handleSave}
            loading={loading}
            disabled={busy || success || !canEdit}
            accessibilityLabel={reviewing ? 'Resubmit for review' : 'Save changes'}
          />
        }
      >
        {success ? <Banner tone="ok" title="Profile updated" /> : null}
        {error ? <Banner tone="danger" body={error} /> : null}
        {reviewing ? (
          <ProfileReviewNotice
            reason={creator.rejectionReason}
            rejectedAt={creator.rejectedAt}
            instruction="Update the details below, then tap Resubmit for review."
          />
        ) : null}

        {/* Avatar picker */}
        <View style={styles.photoSection}>
          <Pressable
            onPress={handlePickImage}
            disabled={busy || success || !canEdit}
            accessibilityLabel="Change profile photo"
            accessibilityRole="button"
            accessibilityState={{ disabled: busy || success || !canEdit, busy: picking }}
            style={styles.photo}
          >
            <Avatar uri={avatarUri} name={fullName || undefined} size={96} />
            <View style={styles.camera}>
              <Ionicons name="camera" size={18} color={colors.onAccent} />
            </View>
          </Pressable>
          <Text variant="label" weight="medium" tone="muted" style={styles.photoHint}>
            {picking ? 'Preparing your photo…' : 'Tap the photo to change it'}
          </Text>
        </View>

        <View
          onLayout={(event) => recordFieldPosition('name', event.nativeEvent.layout.y)}
          style={[styles.names, splitNames ? styles.namesSplit : null]}
        >
          <Field
            ref={firstNameRef}
            label="First name"
            placeholder="First name"
            value={firstName}
            onChangeText={setFirstName}
            onBlur={() => { pendingKeyboardReveal.current = null; }}
            autoCapitalize="words"
            editable={!busy && !success && canEdit}
            containerStyle={splitNames ? styles.nameColumn : undefined}
            accessibilityLabel="First name"
          />
          <Field
            label="Last name"
            placeholder="Last name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            editable={!busy && !success && canEdit}
            containerStyle={splitNames ? styles.nameColumn : undefined}
            accessibilityLabel="Last name"
          />
        </View>
        <View onLayout={(event) => recordFieldPosition('phone', event.nativeEvent.layout.y)}>
          <Field
            ref={phoneRef}
            label="Mobile"
            icon="call-outline"
            placeholder="e.g. 09171234567"
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/[^0-9+]/g, ''))}
            onBlur={() => { pendingKeyboardReveal.current = null; }}
            keyboardType="number-pad"
            maxLength={15}
            editable={!busy && !success && canEdit}
            accessibilityLabel="Phone number"
          />
        </View>
        <View style={styles.emailRow} accessible accessibilityLabel={`Email: ${email}. Can't change.`}>
          <Ionicons name="mail-outline" size={22} color={colors.ink3} />
          <View style={styles.rowBody}>
            <View style={styles.emailLabel}>
              <Text variant="label" tone="muted">Email</Text>
              <Text variant="label" weight="medium" tone="muted">Can't change</Text>
            </View>
            <Text variant="body" weight="medium">{email}</Text>
          </View>
          <Ionicons name="lock-closed-outline" size={18} color={colors.ink3} />
        </View>

        {/* Delete account: intentionally buried at the bottom. The confirmation alerts explain what happens. */}
        <View style={styles.danger}>
          <Button
            title={deleting ? 'Deleting account…' : 'Delete my account'}
            accessibilityLabel="Delete my account"
            variant="danger"
            size="md"
            icon="trash-outline"
            loading={deleting}
            disabled={busy || success || !canDelete}
            onPress={() => {
              if (!isCurrent() || saving.current || pickingPhoto.current || saved.current
                || current.current.deleting || !current.current.canDelete) return;
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
  headerTitle: {
    position: 'absolute', left: space.gutter + hit.icon + space.sm,
    right: space.gutter + hit.icon + space.sm, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  photoSection: { alignItems: 'center', gap: space.md, marginBottom: space.lg },
  photo: { width: 96, height: 96 },
  photoHint: { textAlign: 'center' },
  names: { gap: space.md },
  namesSplit: { flexDirection: 'row', alignItems: 'flex-start' },
  nameColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  rowBody: { flex: 1, minWidth: 0, gap: space.xs },
  camera: {
    position: 'absolute', right: -2, bottom: 2,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.bg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.bg2,
  },
  emailLabel: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.xs },
  danger: { marginTop: space.xl },
});
