/**
 * Field-agent photo step — design v2. Photos are taken with the shared guided camera
 * (components/v2/capture/ShotGuide: 10 tasks for this kind of shop, no outlines); the
 * phone's library stays as a secondary option.
 *
 * The upload + submission contract is unchanged: 3–10 photos, each uploaded to R2
 * (images/), then submissions.update({ photos: [...existing, ...new keys] }). Offline: the
 * uris are kept in `submission_pending_photos` for useOfflineSync, exactly as before.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Id } from '@tendso/convex-client';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { Button, ScreenShell, Text } from '../../../components/v2';
import { Buddy } from '../../../components/v2/owner/OwnerUI';
import { ShotGuide } from '../../../components/v2/capture';
import { MAX_PHOTOS, MIN_PHOTOS, shotList, shotListKeyForBusinessType } from '../../../lib/v2/captureContent';
import { colors, space } from '../../../theme/v2';
import { useGuardedPress } from '../../../hooks/useGuardedPress';

export default function SubmitPhotosScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, isLoaded } = useUser();
  const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : 'skip');
  const { isConnected } = useNetwork();
  const generateR2UploadUrl = useAction(api.r2.generateUploadUrl);
  const updateSubmission = useMutation(api.submissions.update);

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ uri: string; uploaded: boolean; storageId?: string }[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [hasExistingPhotos, setHasExistingPhotos] = useState(false);
  const [removedExistingPhotos, setRemovedExistingPhotos] = useState<Set<string>>(new Set());
  const [camera, setCamera] = useState(false);

  const isOfflinePending = submissionId === 'offline_pending';
  const submission = useQuery(
    api.submissions.getById,
    submissionId && !isOfflinePending ? { id: submissionId as Id<'submissions'> } : 'skip',
  );

  const activeExistingPhotos = existingPhotos.filter((p) => !removedExistingPhotos.has(p));
  const hasChanges = photos.length > 0 || removedExistingPhotos.size > 0;
  const photoUrls = useQuery(api.files.getMultipleUrls, activeExistingPhotos.length > 0 ? { storageIds: activeExistingPhotos } : 'skip');

  useEffect(() => {
    (async () => {
      let id = await AsyncStorage.getItem('current_submission_id');
      if (!id) {
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
    })();
  }, []);

  useEffect(() => {
    if (submission?.photos && submission.photos.length > 0) {
      setExistingPhotos(submission.photos);
      setHasExistingPhotos(true);
    }
  }, [submission]);

  const totalCount = photos.length + activeExistingPhotos.length;
  const remaining = MAX_PHOTOS - totalCount;

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant access to your photos to upload images.', [{ text: 'OK' }]);
      return;
    }
    if (remaining <= 0) {
      setError('You can only have a maximum of 10 photos total.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: remaining,
      });
      if (!result.canceled && result.assets.length > 0) {
        setPhotos((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri, uploaded: false }))]);
        setError(null);
      }
    } catch (err) {
      console.error('Error picking images:', err);
      setError('Failed to select images');
    }
  };
  const onPickImages = useGuardedPress(pickImages);
  const goBack = useGuardedPress(() => router.back());

  const addTaken = (taken: (string | null)[]) => {
    setCamera(false);
    const uris = taken.filter((u): u is string => !!u);
    if (uris.length === 0) return;
    const fit = uris.slice(0, Math.max(0, remaining));
    setPhotos((prev) => [...prev, ...fit.map((uri) => ({ uri, uploaded: false }))]);
    setError(uris.length > fit.length ? `Only ${MAX_PHOTOS} photos fit. We kept the first ${fit.length}.` : null);
  };

  const handleNext = async () => {
    if (!submissionId) return;
    if (hasExistingPhotos && !hasChanges) {
      router.push('/(app)/submit/interview');
      return;
    }
    if (totalCount < MIN_PHOTOS) {
      setError('Please upload at least 3 photos.');
      return;
    }

    // OFFLINE PATH: Save photo URIs locally and navigate
    if (!isConnected) {
      try {
        await AsyncStorage.setItem('submission_pending_photos', JSON.stringify({
          photoUris: photos.map((p) => p.uri),
          existingPhotos: activeExistingPhotos,
          submissionId,
          savedAt: Date.now(),
        }));
        router.push('/(app)/submit/interview');
      } catch {
        setError('Failed to save photos locally');
      }
      return;
    }

    // Only removals: update the submission with the remaining existing photos.
    if (photos.length === 0 && removedExistingPhotos.size > 0) {
      setLoading(true);
      setError(null);
      try {
        await updateSubmission({ id: submissionId as Id<'submissions'>, photos: activeExistingPhotos });
        setRemovedExistingPhotos(new Set());
        router.push('/(app)/submit/interview');
      } catch (err: any) {
        setError(err.message || 'Failed to update photos');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (photos.length === 0) {
      router.push('/(app)/submit/interview');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const uploadedKeys: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        if (photo.uploaded) continue;
        const { uploadUrl, fileKey } = await generateR2UploadUrl({ folder: 'images', filename: `photo-${i}.jpg`, contentType: 'image/jpeg' });
        const blob = await (await fetch(photo.uri)).blob();
        const uploadResult = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
        if (!uploadResult.ok) throw new Error(`Failed to upload photo ${i + 1}`);
        uploadedKeys.push(fileKey);
      }
      await updateSubmission({ id: submissionId as Id<'submissions'>, photos: [...activeExistingPhotos, ...uploadedKeys] });
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

  if ((isConnected && (!isLoaded || creator === undefined)) || !submissionId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  const tasks = shotList(shotListKeyForBusinessType(submission?.businessType));
  const tile = (width - space.gutter * 2 - space.sm * 2) / 3;
  const enough = totalCount >= MIN_PHOTOS;
  const existingShown = activeExistingPhotos.map((key, i) => ({ key, url: photoUrls?.[i] ?? null }));

  return (
    <ScreenShell
      title={totalCount === 0 ? 'Now 10 photos.' : `${totalCount} of ${MAX_PHOTOS} photos`}
      subtitle={totalCount === 0 ? "We'll tell you what to take." : enough ? undefined : `${MIN_PHOTOS - totalCount} more to go.`}
      onBack={goBack}
      footer={
        <>
          {error ? <Text tone="danger" align="center">{error}</Text> : null}
          {enough ? (
            <>
              <Button title="Continue to interview" loading={loading} onPress={handleNext} />
              {remaining > 0 ? <Button title="Take more photos" variant="ghost" disabled={loading} onPress={() => setCamera(true)} /> : null}
            </>
          ) : (
            <>
              <Button title="Take photos" onPress={() => setCamera(true)} />
              <Pressable onPress={onPickImages} accessibilityRole="button" hitSlop={8} style={styles.link}>
                <Text weight="bold" align="center">From the phone's photos</Text>
              </Pressable>
            </>
          )}
        </>
      }
    >
      <OfflineBanner />
      {totalCount === 0 ? (
        <View style={styles.empty}><Buddy size={168} /></View>
      ) : (
        <View style={styles.grid}>
          {existingShown.map((p) => (
            <Thumb key={p.key} uri={p.url && !p.url.startsWith('convex:') ? p.url : null} size={tile} onRemove={() => setRemovedExistingPhotos((prev) => new Set([...prev, p.key]))} />
          ))}
          {photos.map((p, i) => (
            <Thumb key={`${p.uri}-${i}`} uri={p.uri} size={tile} onRemove={() => setPhotos((prev) => prev.filter((_, k) => k !== i))} />
          ))}
        </View>
      )}
      {enough && remaining > 0 ? (
        <Pressable onPress={onPickImages} accessibilityRole="button" hitSlop={8} style={[styles.link, { marginTop: space.lg }]}>
          <Text weight="bold" align="center">From the phone's photos</Text>
        </Pressable>
      ) : null}

      <Modal visible={camera} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setCamera(false)} statusBarTranslucent>
        {camera ? <ShotGuide tasks={tasks.slice(0, Math.max(1, remaining))} onDone={addTaken} onClose={addTaken} /> : null}
      </Modal>
    </ScreenShell>
  );
}

function Thumb({ uri, size, onRemove }: { uri: string | null; size: number; onRemove: () => void }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.thumb, { width: size, height: size }]}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <ActivityIndicator color={colors.ink3} />}
      </View>
      <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remove photo" hitSlop={10} style={styles.remove}>
        <Ionicons name="close" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 280 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  thumb: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  remove: { position: 'absolute', top: 6, right: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(12,10,8,0.7)', alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: 48, justifyContent: 'center' },
});
