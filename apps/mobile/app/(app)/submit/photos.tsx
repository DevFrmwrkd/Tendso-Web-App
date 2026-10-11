import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Id } from '@tendso/convex-client';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { colors, fonts, radius, space, shadow } from '../../../theme/tokens';
import { Display, Body, Label, Door, Card, Rule } from '../../../components/ui/primitives';
import { useGuardedPress } from '../../../hooks/useGuardedPress';

export default function SubmitPhotosScreen() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const { isConnected } = useNetwork();
  const insets = useSafeAreaInsets();
  const generateR2UploadUrl = useAction(api.r2.generateUploadUrl);
  const updateSubmission = useMutation(api.submissions.update);

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ uri: string; uploaded: boolean; storageId?: string }[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [hasExistingPhotos, setHasExistingPhotos] = useState(false);
  const [wantsToAddMore, setWantsToAddMore] = useState(false);
  const [removedExistingPhotos, setRemovedExistingPhotos] = useState<Set<string>>(new Set());

  const isOfflinePending = submissionId === 'offline_pending';

  const submission = useQuery(
    api.submissions.getById,
    submissionId && !isOfflinePending ? { id: submissionId as Id<'submissions'> } : 'skip'
  );

  // Existing photos minus any the user removed
  const activeExistingPhotos = existingPhotos.filter(p => !removedExistingPhotos.has(p));
  const hasChanges = photos.length > 0 || removedExistingPhotos.size > 0;

  const photoUrls = useQuery(
    api.files.getMultipleUrls,
    activeExistingPhotos.length > 0 ? { storageIds: activeExistingPhotos } : 'skip'
  );

  // Load submission ID from storage
  useEffect(() => {
    const loadSubmissionId = async () => {
      let id = await AsyncStorage.getItem('current_submission_id');
      if (!id) {
        // Check if there's pending offline data
        const pendingSync = await AsyncStorage.getItem('submission_pending_sync');
        if (pendingSync) {
          id = 'offline_pending';
          await AsyncStorage.setItem('current_submission_id', id);
        } else {
          router.replace('/(app)/dashboard');
          return;
        }
      }
      setSubmissionId(id);
    };
    loadSubmissionId();
  }, []);

  // Load existing photos and check if photos already uploaded
  useEffect(() => {
    if (submission?.photos && submission.photos.length > 0) {
      setExistingPhotos(submission.photos);
      setHasExistingPhotos(true);
    }
  }, [submission]);

  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant access to your photos to upload images.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const pickImages = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    const currentTotal = photos.length + activeExistingPhotos.length;
    const remaining = 10 - currentTotal;

    if (remaining <= 0) {
      setError('You can only have a maximum of 10 photos total.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: remaining,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newPhotos = result.assets.map((asset) => ({
          uri: asset.uri,
          uploaded: false,
        }));
        setPhotos((prev) => [...prev, ...newPhotos]);
        setError(null);
      }
    } catch (err) {
      console.error('Error picking images:', err);
      setError('Failed to select images');
    }
  };

  const onPickImages = useGuardedPress(pickImages);
  const goBack = useGuardedPress(() => router.back());

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = (r2Key: string) => {
    setRemovedExistingPhotos(prev => new Set([...prev, r2Key]));
  };

  const handleNext = async () => {
    if (!submissionId) return;

    const totalPhotos = photos.length + activeExistingPhotos.length;

    // No changes made — just navigate, no re-upload
    if (hasExistingPhotos && !hasChanges) {
      router.push('/(app)/submit/interview');
      return;
    }

    if (totalPhotos < 3) {
      setError('Please upload at least 3 photos.');
      return;
    }

    // OFFLINE PATH: Save photo URIs locally and navigate
    if (!isConnected) {
      try {
        const photoUris = photos.map(p => p.uri);
        await AsyncStorage.setItem('submission_pending_photos', JSON.stringify({
          photoUris,
          existingPhotos: activeExistingPhotos,
          submissionId,
          savedAt: Date.now(),
        }));
        router.push('/(app)/submit/interview');
      } catch (err) {
        setError('Failed to save photos locally');
      }
      return;
    }

    // Only removals, no new photos — update the submission with remaining existing photos
    if (photos.length === 0 && removedExistingPhotos.size > 0) {
      setLoading(true);
      setError(null);
      try {
        await updateSubmission({
          id: submissionId as Id<'submissions'>,
          photos: activeExistingPhotos,
        });
        setRemovedExistingPhotos(new Set());
        router.push('/(app)/submit/interview');
      } catch (err: any) {
        console.error('Error updating photos:', err);
        setError(err.message || 'Failed to update photos');
      } finally {
        setLoading(false);
      }
      return;
    }

    // If no new photos to upload, just proceed
    if (photos.length === 0) {
      router.push('/(app)/submit/interview');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const uploadedKeys: string[] = [];

      // Upload only NEW photos to R2
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        if (!photo.uploaded) {
          // Get R2 presigned upload URL
          const { uploadUrl, fileKey } = await generateR2UploadUrl({
            folder: "images",
            filename: `photo-${i}.jpg`,
            contentType: "image/jpeg",
          });

          // Fetch the image and upload to R2
          const response = await fetch(photo.uri);
          const blob = await response.blob();

          const uploadResult = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: blob,
          });

          if (!uploadResult.ok) {
            throw new Error(`Failed to upload photo ${i + 1}`);
          }

          // Store the R2 file key (not storage ID)
          uploadedKeys.push(fileKey);
        }
      }

      // Combine remaining existing + newly uploaded photos
      const finalPhotoList = [...activeExistingPhotos, ...uploadedKeys];

      await updateSubmission({
        id: submissionId as Id<'submissions'>,
        photos: finalPhotoList,
      });

      // Clear local state so photos aren't treated as "new" if user navigates back
      setPhotos([]);
      setRemovedExistingPhotos(new Set());

      router.push('/(app)/submit/interview');
    } catch (err: any) {
      console.error('Error uploading photos:', err);
      setError(err.message || 'Failed to upload photos');
    } finally {
      setLoading(false);
    }
  };

  // When offline, skip Clerk/Convex loading gates — layout already verified auth
  if (!isConnected && (!isLoaded || creator === undefined)) {
    // Offline: allow page to render without creator data
  } else if (!isLoaded || creator === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!submissionId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const totalCount = photos.length + activeExistingPhotos.length;
  const meetsMinimum = totalCount >= 3;
  const progressPct = Math.min(100, (totalCount / 10) * 100);
  const ctaDisabled = loading || (!hasExistingPhotos && totalCount < 3) || (hasExistingPhotos && hasChanges && totalCount < 3);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      {/* Top bar */}
      <View
        style={{
          paddingHorizontal: space.lg,
          paddingTop: space.sm,
          paddingBottom: space.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TouchableOpacity
          onPress={goBack}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={{
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.pill,
            backgroundColor: colors.paper3,
            borderColor: colors.rule,
            borderWidth: 1,
          }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <OfflineBanner />

      {/* Progress rule */}
      <View style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>
        <View
          style={{
            height: 3,
            backgroundColor: colors.rule,
            borderRadius: radius.pill,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: '50%',
              height: '100%',
              backgroundColor: colors.accent,
              borderRadius: radius.pill,
            }}
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: space.md,
          }}
        >
          <Label tracking={1.8}>PHOTOS</Label>
          <Label tracking={1.8} color={colors.ink3}>
            {totalCount} / 10
          </Label>
        </View>

        <View style={{ marginBottom: space.sm }}>
          <Display size="lg">Show us</Display>
          <Display size="lg" italic color={colors.accent}>the storefront.</Display>
        </View>

        <Body size="md" color={colors.ink2} style={{ marginTop: space.sm, marginBottom: space.lg, maxWidth: 340 }}>
          Upload three to ten photos — storefront, interior, products, signage. The
          more honest the frame, the better the story.
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
              marginBottom: space.md,
            }}
          >
            <Body size="sm" color={colors.danger} weight="medium">{error}</Body>
          </View>
        ) : null}

        {/* Offline notice */}
        {!isConnected && (
          <View
            style={{
              backgroundColor: colors.warnBg,
              borderColor: colors.warn,
              borderWidth: 1,
              borderRadius: radius.sm,
              padding: 14,
              marginBottom: space.md,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Ionicons name="cloud-offline-outline" size={18} color={colors.warn} style={{ marginTop: 2 }} />
            <Body size="sm" color={colors.warn} weight="medium" style={{ flex: 1 }}>
              You're offline. Select your photos now — they'll upload automatically when you're back online.
            </Body>
          </View>
        )}

        {/* Existing photos notice — quiet editorial card */}
        {hasExistingPhotos && !wantsToAddMore && (
          <Card padded large style={{ marginBottom: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.sm }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accentBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="checkmark" size={18} color={colors.accent} />
              </View>
              <Label tracking={1.6} color={colors.accent}>SAVED</Label>
            </View>

            <Display size="sm" style={{ marginBottom: 4 }}>
              {activeExistingPhotos.length} photo{activeExistingPhotos.length !== 1 ? 's' : ''} on file.
            </Display>
            <Body size="sm" color={colors.ink3} style={{ marginBottom: space.md }}>
              Continue to the interview, or add a few more frames.
            </Body>

            {/* Saved photo preview row */}
            {photoUrls && photoUrls.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3, marginBottom: space.md }}>
                {photoUrls.map((url, index) => (
                  <View
                    key={`preview-${index}`}
                    style={{
                      width: 56,
                      height: 56,
                      margin: 3,
                      borderRadius: radius.sm,
                      overflow: 'hidden',
                      backgroundColor: colors.paper2,
                      borderColor: colors.rule,
                      borderWidth: 1,
                    }}
                  >
                    {url && !url.startsWith('convex:') ? (
                      <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="small" color={colors.ink3} />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              onPress={() => setWantsToAddMore(true)}
              accessibilityRole="button"
              accessibilityLabel="Add more photos"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderColor: colors.ink,
                borderWidth: 1,
                borderRadius: radius.pill,
                gap: 6,
              }}
            >
              <Ionicons name="add" size={16} color={colors.ink} />
              <Text
                style={{
                  fontFamily: fonts.monoMed,
                  fontSize: 11,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  color: colors.ink,
                }}
              >
                Add More
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Upload area + grid */}
        {(!hasExistingPhotos || wantsToAddMore) && (
          <>
            {/* Dashed placeholder tile */}
            <TouchableOpacity
              onPress={onPickImages}
              activeOpacity={0.7}
              disabled={loading || totalCount >= 10}
              accessibilityRole="button"
              accessibilityLabel="Tap to select photos"
              style={{
                backgroundColor: colors.paper3,
                borderColor: colors.ruleStrong,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderRadius: radius.md,
                paddingVertical: 36,
                paddingHorizontal: space.lg,
                alignItems: 'center',
                marginBottom: space.md,
                opacity: loading || totalCount >= 10 ? 0.5 : 1,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radius.pill,
                  backgroundColor: colors.paper2,
                  borderColor: colors.rule,
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: space.sm,
                }}
              >
                <Ionicons name="camera-outline" size={24} color={colors.ink3} />
              </View>
              <Body size="md" color={colors.ink} weight="medium" style={{ marginBottom: 2 }}>
                Tap to add photos
              </Body>
              <Label color={colors.ink3} tracking={1.4}>JPG · PNG · UP TO 5MB</Label>
            </TouchableOpacity>

            {/* Photo grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: space.md }}>
              {/* Existing (saved) photos */}
              {photoUrls?.map((url, index) => (
                <View key={`existing-${index}`} style={{ width: '33.333%', padding: 4 }}>
                  <View
                    style={{
                      aspectRatio: 1,
                      borderRadius: radius.sm,
                      overflow: 'hidden',
                      backgroundColor: colors.paper2,
                      borderColor: colors.accent,
                      borderWidth: 1,
                    }}
                  >
                    {url && !url.startsWith('convex:') ? (
                      <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="small" color={colors.ink3} />
                      </View>
                    )}

                    {/* Delete pill */}
                    <TouchableOpacity
                      onPress={() => removeExistingPhoto(activeExistingPhotos[index])}
                      accessibilityRole="button"
                      accessibilityLabel="Remove saved photo"
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 24,
                        height: 24,
                        borderRadius: radius.pill,
                        backgroundColor: colors.ink,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>

                    {/* Saved badge */}
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 6,
                        left: 6,
                        backgroundColor: colors.accent,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: radius.pill,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.monoMed,
                          fontSize: 9,
                          letterSpacing: 1.2,
                          color: '#fff',
                          textTransform: 'uppercase',
                        }}
                      >
                        Saved
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* New photos */}
              {photos.map((photo, index) => (
                <View key={`new-${index}`} style={{ width: '33.333%', padding: 4 }}>
                  <View
                    style={{
                      aspectRatio: 1,
                      borderRadius: radius.sm,
                      overflow: 'hidden',
                      backgroundColor: colors.paper2,
                      borderColor: colors.rule,
                      borderWidth: 1,
                    }}
                  >
                    <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />

                    {/* Delete pill */}
                    <TouchableOpacity
                      onPress={() => removePhoto(index)}
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 24,
                        height: 24,
                        borderRadius: radius.pill,
                        backgroundColor: colors.ink,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>

                    {/* Upload progress overlay (visible while uploading new photos) */}
                    {loading && !photo.uploaded && (
                      <View
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: 3,
                          backgroundColor: 'rgba(255,255,255,0.4)',
                        }}
                      >
                        <View
                          style={{
                            height: '100%',
                            width: '60%',
                            backgroundColor: colors.accent,
                          }}
                        />
                      </View>
                    )}
                  </View>
                </View>
              ))}

              {/* Empty placeholder tiles to suggest grid capacity (up to 3 placeholders) */}
              {totalCount < 3 &&
                Array.from({ length: Math.max(0, 3 - totalCount) }).map((_, i) => (
                  <View key={`placeholder-${i}`} style={{ width: '33.333%', padding: 4 }}>
                    <TouchableOpacity
                      onPress={onPickImages}
                      activeOpacity={0.7}
                      disabled={loading}
                      accessibilityRole="button"
                      accessibilityLabel="Add photo"
                      style={{
                        aspectRatio: 1,
                        borderRadius: radius.sm,
                        backgroundColor: colors.paper3,
                        borderColor: colors.ruleStrong,
                        borderWidth: 1.5,
                        borderStyle: 'dashed',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="camera-outline" size={22} color={colors.ink3} />
                    </TouchableOpacity>
                  </View>
                ))}
            </View>

            {/* Count rule + status */}
            <Rule />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: space.md,
              }}
            >
              <Label tracking={1.6}>
                {totalCount} OF 10
              </Label>
              <Label
                tracking={1.6}
                color={meetsMinimum ? colors.accent : colors.warn}
              >
                {meetsMinimum ? 'READY' : `NEED ${3 - totalCount} MORE`}
              </Label>
            </View>

            {/* Bottom-of-grid progress bar */}
            <View
              style={{
                height: 2,
                backgroundColor: colors.rule,
                borderRadius: radius.pill,
                overflow: 'hidden',
                marginBottom: space.md,
              }}
            >
              <View
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  backgroundColor: colors.accent,
                }}
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom door footer */}
      <View
        style={{
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          backgroundColor: colors.paper,
          borderTopColor: colors.rule,
          borderTopWidth: 1,
          paddingBottom: Math.max(insets.bottom, space.md),
          gap: space.sm,
        }}
      >
        <Door
          variant="solid"
          caption={loading ? `UPLOADING ${photos.length}` : 'CONTINUE'}
          label={
            loading
              ? `Uploading ${photos.length} photo${photos.length !== 1 ? 's' : ''}…`
              : hasExistingPhotos && !hasChanges
                ? 'Continue to interview'
                : hasChanges
                  ? photos.length > 0
                    ? `Upload ${photos.length} & continue`
                    : 'Save changes & continue'
                  : 'Continue to interview'
          }
          onPress={handleNext}
          disabled={ctaDisabled}
          loading={loading}
          accessibilityLabel="Continue to interview step"
        />

        {/* Ghost back action */}
        <Door
          variant="ghost"
          label="Back to business info"
          onPress={() => router.back()}
          rightIcon={<Ionicons name="arrow-back" size={18} color={colors.ink} style={{ marginLeft: 12 }} />}
          accessibilityLabel="Go back to business info step"
        />
      </View>
    </SafeAreaView>
  );
}
