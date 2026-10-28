/** Optional photo suggestions; the submission still accepts 3–10 photos total. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { Banner, Button, Card, EmptyState, Loading, ScreenShell, Text } from '../../../components/v2';
import { ShotGuide } from '../../../components/v2/capture';
import { MAX_PHOTOS, MIN_PHOTOS, shotList, shotListKeyForBusinessType, type ShotKind } from '../../../lib/v2/captureContent';
import { colors, radius, space } from '../../../theme/v2';
import { useCaptureSession } from '../../../hooks/useCaptureSession';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';

type CaptureSession = ReturnType<typeof useCaptureSession>;
type PhotoItem = { id: string; uri?: string; storageId?: string; taskIndex?: number };
type PhotoDraft = { version: 1; submissionId: string; businessType?: string; items: PhotoItem[]; removedExistingPhotos: string[] };
type PendingPhotos = { submissionId: string; photoUris: string[]; existingPhotos: string[]; savedAt: number; entries?: PhotoItem[] };
type CameraRun = { id: number; initial: (string | null)[]; index: number; singleShot: boolean };
const TASK_ICONS: Record<ShotKind, React.ComponentProps<typeof Ionicons>['name']> = {
  head: 'person-outline', half: 'body-outline', front: 'storefront-outline', sign: 'reader-outline', room: 'business-outline', object: 'cube-outline',
};
const localPhotoId = () => `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
function validItems(value: unknown): PhotoItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PhotoItem => item && typeof item.id === 'string'
    && ((typeof item.uri === 'string' && !!item.uri) || (typeof item.storageId === 'string' && !!item.storageId)))
    .map((item) => ({ ...item, taskIndex: Number.isInteger(item.taskIndex) && item.taskIndex! >= 0 && item.taskIndex! < 10 ? item.taskIndex : undefined }));
}

export default function SubmitPhotosScreen() {
  const session = useCaptureSession();
  const router = useGuardedRouter();
  if (!session.actor || !session.actorKey) {
    if (!session.isReady) return <Loading label="Loading your photo draft" />;
    return <ScreenShell onBack={() => router.back()}><EmptyState icon="cloud-offline-outline" title="Photo draft unavailable"
      body="Reconnect with your approved field-agent account to open this draft." actionLabel="Back to the map"
      onAction={() => router.replace('/(app)/(tabs)/' as never)} /></ScreenShell>;
  }
  return <PhotoTasks key={session.actorKey} session={session} />;
}

function PhotoTasks({ session }: { session: CaptureSession }) {
  const router = useGuardedRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const generateR2UploadUrl = useAction(api.r2.generateUploadUrl);
  const updateSubmission = useMutation(api.submissions.update);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | undefined>();
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState<CameraRun | null>(null);
  const [preview, setPreview] = useState<{ id: string; submissionId: string } | null>(null);
  const [failedPreviewUri, setFailedPreviewUri] = useState<string | null>(null);
  const [finishingCamera, setFinishingCamera] = useState(false);
  const mounted = useRef(true);
  const busy = useRef(false);
  const pickerBusy = useRef(false);
  const cameraBusy = useRef(false);
  const finishing = useRef(false);
  const removed = useRef<string[]>([]);
  const itemsRef = useRef(items);
  const idRef = useRef(submissionId);
  const typeRef = useRef(businessType);
  const sessionRef = useRef(session);
  const persistQueue = useRef<Promise<void>>(Promise.resolve());
  const photoQueue = useRef<Promise<void>>(Promise.resolve());
  const normalizing = useRef(0);
  const cameraSequence = useRef(0);
  const hydrationVersion = useRef(0);
  sessionRef.current = session;
  const current = () => mounted.current && sessionRef.current.actorKey === session.actorKey && session.isCurrent();
  const canMutate = () => current() && sessionRef.current.canMutate();
  const offlinePending = submissionId === 'offline_pending';
  const submission = useQuery(api.submissions.getById,
    session.canQuery && submissionId && !offlinePending ? { id: submissionId as Id<'submissions'> } : 'skip');
  const storedKeys = items.filter((item) => !!item.storageId).map((item) => item.storageId!);
  const photoUrls = useQuery(api.files.getMultipleUrls,
    session.canQuery && storedKeys.length ? { storageIds: storedKeys } : 'skip');
  const urlByKey = new Map(storedKeys.map((key, index) => [key, photoUrls?.[index] ?? null]));
  const tasks = shotList(shotListKeyForBusinessType(businessType));
  const total = items.length;
  const enough = total >= MIN_PHOTOS && total <= MAX_PHOTOS;
  const remaining = Math.max(0, MAX_PHOTOS - total);
  const taskItems = tasks.map((_, index) => items.find((item) => item.taskIndex === index));
  const nextTask = taskItems.findIndex((item) => !item);
  const extras = items.filter((item) => item.taskIndex === undefined);
  const discoveringType = session.canQuery && !offlinePending && !businessType;
  const locked = saving || preparing || finishingCamera || discoveringType;
  const awaitingRemote = session.canQuery && !!submissionId && !offlinePending && submission === undefined;
  const tileSize = Math.max(48, (width - space.gutter * 2 - space.sm * 4) / 5);
  const uriFor = (item?: PhotoItem) => item?.uri || (item?.storageId ? urlByKey.get(item.storageId) : null) || null;
  const photoLabel = (item: PhotoItem) => item.taskIndex === undefined ? 'Added photo' : tasks[item.taskIndex]?.t ?? 'Photo';
  const previewItem = preview?.submissionId === submissionId ? items.find((item) => item.id === preview.id) : undefined;
  const previewUri = uriFor(previewItem);
  const previewOpen = !!previewItem && !!previewUri && !camera && current();
  const closePreview = () => setPreview(null);

  const snapshot = (next: PhotoItem[]): PhotoDraft => ({ version: 1, submissionId: idRef.current!,
    businessType: typeRef.current, items: next, removedExistingPhotos: [...removed.current] });
  const persist = (next: PhotoItem[]) => {
    const draft = snapshot(next); const writer = sessionRef.current;
    persistQueue.current = persistQueue.current.catch(() => {}).then(async () => {
      if (current() && draft.submissionId) await writer.write('submission_photo_tasks', draft);
    });
    void persistQueue.current.catch(() => { if (current()) setError('Could not save these photos on this device. Keep this screen open and try again.'); });
    return persistQueue.current;
  };
  const commit = (next: PhotoItem[]) => { itemsRef.current = next; setItems(next); return persist(next); };

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    mounted.current = true;
    const version = ++hydrationVersion.current;
    const currentLoad = () => active && current() && version === hydrationVersion.current;
    void (async () => {
      try {
        const [storedId, pendingInfo, taskDraft, pendingPhotos, form, savedShop] = await Promise.all([
          session.read<string>('current_submission_id'),
          session.read<{ formData?: { businessType?: string } }>('submission_pending_sync'),
          session.read<PhotoDraft>('submission_photo_tasks'), session.read<PendingPhotos>('submission_pending_photos'),
          session.read<{ businessType?: string }>('submission_draft_form'),
          session.read<{ submissionId: string; businessType?: string }>('submission_snapshot'),
        ]);
        if (!currentLoad()) return;
        const id = storedId || (pendingInfo ? 'offline_pending' : null);
        if (!id) { router.replace('/(app)/(tabs)/' as never); return; }
        if (!storedId) await session.write('current_submission_id', id);
        if (!currentLoad()) return;
        const migrating = idRef.current === 'offline_pending' && id !== 'offline_pending';
        if (idRef.current && idRef.current !== id) {
          setPreview(null);
          if (!migrating) setCamera(null);
        }
        const ownDraft = taskDraft?.submissionId === id || (migrating && taskDraft?.submissionId === 'offline_pending') ? taskDraft : null;
        const ownPending = pendingPhotos?.submissionId === id || (migrating && pendingPhotos?.submissionId === 'offline_pending') ? pendingPhotos : null;
        let restored = validItems(ownDraft?.items ?? ownPending?.entries);
        if (!ownDraft && !ownPending?.entries && Array.isArray(ownPending?.photoUris)) {
          ownPending.photoUris.forEach((uri, index) => { if (typeof uri === 'string' && uri) restored.push({ id: `restored-${index}`, uri }); });
        }
        for (const key of ownPending?.existingPhotos ?? []) {
          if (typeof key === 'string' && !restored.some((item) => item.storageId === key)) restored.push({ id: `stored-${key}`, storageId: key });
        }
        removed.current = Array.isArray(ownDraft?.removedExistingPhotos) ? ownDraft.removedExistingPhotos : [];
        const snapshotType = savedShop?.submissionId === id || (migrating && savedShop?.submissionId === 'offline_pending') ? savedShop?.businessType : undefined;
        const restoredType = pendingInfo?.formData?.businessType || form?.businessType || snapshotType || ownDraft?.businessType;
        const differentSuggestions = ownDraft?.businessType && restoredType
          && shotListKeyForBusinessType(ownDraft.businessType) !== shotListKeyForBusinessType(restoredType);
        if (differentSuggestions) restored = restored.map((item) => ({ ...item, taskIndex: undefined }));
        typeRef.current = restoredType; setBusinessType(restoredType);
        idRef.current = id; setSubmissionId(id); itemsRef.current = restored; setItems(restored); setHydrated(true);
        if (differentSuggestions) void persist(restored);
      } catch { if (currentLoad()) setError('Could not load your photo draft. Reopen this step to try again.'); }
    })();
    return () => { active = false; setPreview(null); };
  }, [session.revision, session.actorKey]));

  useEffect(() => {
    if (!hydrated || !submission || String(submission.creatorId) !== String(session.actor?.creatorId)) return;
    let active = true;
    const differentSuggestions = typeRef.current && shotListKeyForBusinessType(typeRef.current) !== shotListKeyForBusinessType(submission.businessType);
    typeRef.current = submission.businessType; setBusinessType(submission.businessType);
    if (differentSuggestions) {
      setCamera(null);
      void commit(itemsRef.current.map((item) => ({ ...item, taskIndex: undefined })));
    }
    void session.read<PhotoDraft>('submission_photo_tasks').then((cached) => {
      if (!active || !current()) return;
      const synchronized = cached?.submissionId === idRef.current ? validItems(cached.items) : [];
      const next = itemsRef.current.map((item) => {
        const uploaded = synchronized.find((saved) => saved.id === item.id && saved.storageId);
        return uploaded && !item.storageId ? { ...item, storageId: uploaded.storageId } : item;
      });
      for (const key of submission.photos ?? []) {
        if (!removed.current.includes(key) && !next.some((item) => item.storageId === key)) next.push({ id: `stored-${key}`, storageId: key });
      }
      if (JSON.stringify(next) !== JSON.stringify(itemsRef.current)) void commit(next);
    }).catch(() => {});
    return () => { active = false; };
  }, [submission, hydrated]);

  const normalize = async (uri: string) => {
    // Render bakes EXIF orientation into an actual JPEG, including HEIC imports.
    const rendered = await ImageManipulator.manipulate(uri).resize({ width: 1600 }).renderAsync();
    return (await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG })).uri;
  };
  const addCameraShot = (taskIndex: number, uri: string) => {
    const fromDraft = idRef.current;
    const fromSuggestions = shotListKeyForBusinessType(typeRef.current);
    normalizing.current += 1; setPreparing(true);
    photoQueue.current = photoQueue.current.catch(() => {}).then(async () => {
      const normalized = await normalize(uri);
      if (!current() || (idRef.current !== fromDraft && fromDraft !== 'offline_pending')) return;
      const assignedIndex = fromSuggestions === shotListKeyForBusinessType(typeRef.current) ? taskIndex : undefined;
      const previous = assignedIndex === undefined ? undefined : itemsRef.current.find((item) => item.taskIndex === assignedIndex);
      if (!previous && itemsRef.current.length >= MAX_PHOTOS) throw new Error('Keep up to 10 photos. Remove one before adding another.');
      if (previous?.storageId) removed.current = [...new Set([...removed.current, previous.storageId])];
      await commit([...itemsRef.current.filter((item) => item.id !== previous?.id), { id: previous?.id ?? localPhotoId(), uri: normalized, taskIndex: assignedIndex }]);
    }).catch((cause) => { if (current()) setError(cause instanceof Error ? cause.message : 'Could not prepare that photo. Please try again.'); })
      .finally(() => { normalizing.current -= 1; if (current()) setPreparing(normalizing.current > 0); });
  };
  const finishCamera = async () => {
    if (finishing.current || cameraBusy.current || !current()) return;
    finishing.current = true; setFinishingCamera(true); await photoQueue.current;
    if (current()) { setCamera(null); setFinishingCamera(false); }
    finishing.current = false;
  };
  const openCamera = (index = nextTask, singleShot = false) => {
    if (busy.current || pickerBusy.current || normalizing.current > 0 || !current() || index < 0) return;
    if (itemsRef.current.length >= MAX_PHOTOS && !taskItems[index]) return;
    setPreview(null); setError(null); setCamera({ id: ++cameraSequence.current, initial: taskItems.map(uriFor), index, singleShot });
  };
  const pickImages = async () => {
    if (busy.current || pickerBusy.current || normalizing.current > 0 || !current()) return;
    const capacity = MAX_PHOTOS - itemsRef.current.length;
    const fromDraft = idRef.current;
    const sameDraft = () => current() && (idRef.current === fromDraft || fromDraft === 'offline_pending');
    if (capacity <= 0) { setError('Keep up to 10 photos. Remove one before adding another.'); return; }
    setPreview(null); pickerBusy.current = true; setPreparing(true); setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!sameDraft()) return;
      if (permission.status !== 'granted') { Alert.alert('Photo access needed', 'Allow photo access to add pictures, or use the guided camera.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8, selectionLimit: capacity });
      if (!sameDraft() || result.canceled) return;
      const added: PhotoItem[] = [];
      for (const asset of result.assets.slice(0, capacity)) { const uri = await normalize(asset.uri); if (!sameDraft()) return; added.push({ id: localPhotoId(), uri }); }
      const fit = Math.min(added.length, MAX_PHOTOS - itemsRef.current.length);
      await commit([...itemsRef.current, ...added.slice(0, fit)]);
      if (sameDraft() && result.assets.length > fit) setError('Only the photos that fit within the 10-photo limit were added.');
    } catch { if (current()) setError('Could not prepare those photos. Please choose them again.'); }
    finally { pickerBusy.current = false; if (current()) setPreparing(false); }
  };
  const removePhoto = (item: PhotoItem) => {
    if (busy.current || pickerBusy.current || normalizing.current > 0 || !current()) return;
    if (item.storageId) removed.current = [...new Set([...removed.current, item.storageId])];
    void commit(itemsRef.current.filter((photo) => photo.id !== item.id));
  };

  const handleNext = async () => {
    if (busy.current || pickerBusy.current || normalizing.current > 0 || !current() || !idRef.current) return;
    if (itemsRef.current.length < MIN_PHOTOS || itemsRef.current.length > MAX_PHOTOS) { setError('Add 3–10 photos to continue.'); return; }
    const savingId = idRef.current;
    const sameDraft = () => current() && idRef.current === savingId;
    setPreview(null); busy.current = true; setSaving(true); setError(null);
    try {
      await persist(itemsRef.current); if (!sameDraft()) return;
      if (!canMutate() || savingId === 'offline_pending') {
        await session.write('submission_pending_photos', {
          submissionId: savingId, photoUris: itemsRef.current.filter((item) => !item.storageId && item.uri).map((item) => item.uri!),
          existingPhotos: itemsRef.current.filter((item) => item.storageId).map((item) => item.storageId!),
          entries: itemsRef.current.filter((item) => item.uri), savedAt: Date.now(),
        } satisfies PendingPhotos);
        if (sameDraft()) router.push('/(app)/submit/interview'); return;
      }
      if (!submission || String(submission.creatorId) !== String(session.actor?.creatorId)) throw new Error('Reconnect to confirm this draft before saving photos.');
      for (const item of [...itemsRef.current]) {
        if (item.storageId || !item.uri) continue;
        if (!sameDraft() || !canMutate()) throw new Error('Your connection changed. Your photos remain on this device; try again.');
        const target = await generateR2UploadUrl({ folder: 'images', filename: `${item.id}.jpg`, contentType: 'image/jpeg' });
        if (!sameDraft() || !canMutate()) return;
        const blob = await (await fetch(item.uri)).blob(); if (!sameDraft() || !canMutate()) return;
        const response = await fetch(target.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
        if (!sameDraft()) return;
        if (!response.ok) throw new Error('A photo could not upload. Your photos are kept here; try again.');
        await commit(itemsRef.current.map((photo) => photo.id === item.id ? { ...photo, storageId: target.fileKey } : photo));
      }
      if (!sameDraft() || !canMutate()) return;
      await updateSubmission({ id: savingId as Id<'submissions'>, photos: itemsRef.current.map((item) => item.storageId!) });
      if (!sameDraft()) return;
      removed.current = []; await persist(itemsRef.current); await session.remove('submission_pending_photos');
      if (sameDraft()) router.push('/(app)/submit/interview');
    } catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : 'Could not save these photos. Please try again.'); }
    finally { busy.current = false; if (current()) setSaving(false); }
  };

  if (!hydrated) return <ScreenShell onBack={() => router.back()}>{error ? <Banner tone="danger" body={error} /> : <Loading fill={false} label="Loading your photo draft" />}</ScreenShell>;
  if (submission === null || (submission && String(submission.creatorId) !== String(session.actor?.creatorId))) return <ScreenShell onBack={() => router.back()}><EmptyState icon="lock-closed-outline" title="Draft unavailable" body="Open a draft from your account to add photos." /></ScreenShell>;

  return <ScreenShell title="Show us the shop" subtitle="Ten suggestions. Add 3–10 photos in total." progress={0.4} onBack={() => { if (!busy.current && !pickerBusy.current) router.back(); }}
    contentStyle={styles.body} footer={<>
      {error ? <Text tone="danger" align="center" accessibilityRole="alert">{error}</Text> : null}
      {enough ? <Button title="Continue to interview" onPress={handleNext} loading={saving} disabled={locked || awaitingRemote} />
        : <Button title="Start taking photos" onPress={() => openCamera()} disabled={locked || remaining === 0} />}
      <Button title="Add your own photos" variant="ghost" icon="images-outline" onPress={pickImages} disabled={locked || remaining === 0} />
    </>}>
    <OfflineBanner />
    <View style={styles.between}><Text variant="label" tone="muted">Step 2 of 5</Text><Text variant="label" weight="bold">{`${total} of ${MAX_PHOTOS} photos added`}</Text></View>
    <View style={styles.grid}>{tasks.map((task, index) => {
      const item = taskItems[index]; const uri = uriFor(item); const disabled = locked || (!item && remaining === 0);
      return <Pressable key={index} onPress={() => openCamera(index, !!item)} disabled={disabled} accessibilityRole="button"
        accessibilityLabel={`${task.t}${item ? ', taken. Retake photo' : ', not taken'}`} accessibilityState={{ disabled }}
        style={[styles.taskTile, { width: tileSize, height: tileSize }, nextTask === index && remaining > 0 ? styles.nextTile : null, disabled && !item ? styles.dim : null]}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Ionicons name={TASK_ICONS[task.kind]} size={28} color={colors.ink2} />}
        {item ? <View style={styles.tick}><Ionicons name="checkmark" size={15} color={colors.ink} /></View> : <View style={styles.taskNumber}><Text variant="label" tone="muted">{index + 1}</Text></View>}
      </Pressable>;
    })}</View>
    {nextTask >= 0 && remaining > 0 ? <Card onPress={() => { if (!locked) openCamera(nextTask); }} accessibilityLabel={`Take ${tasks[nextTask].t}`} style={styles.nextCard}>
      <View style={styles.nextIcon}><Ionicons name={TASK_ICONS[tasks[nextTask].kind]} size={28} color={colors.ink} /></View>
      <View style={styles.grow}><Text variant="label" tone="muted">Next suggestion</Text><Text variant="bodyLg" weight="bold">{tasks[nextTask].t}</Text><Text variant="label" tone="ink2" weight="medium">{tasks[nextTask].h}</Text></View>
      <Ionicons name="chevron-forward" size={22} color={colors.ink3} />
    </Card> : <Banner tone="neutral" title={remaining === 0 ? 'You have 10 photos' : 'Suggestions covered'} body="Keep the photos that show this shop best. You can retake a suggestion or replace an added photo." />}
    <Text variant="label" tone="muted" weight="medium">Suggestions are optional. Three clear photos are enough to continue; extras share the same 10-photo limit.</Text>
    {items.length ? <View style={styles.photoSection}><Text variant="heading">Your photos</Text><View style={styles.addedGrid}>{items.map((item, index) => <View key={item.id} style={styles.addedPhoto}>
      <Pressable style={styles.addedThumb} accessibilityRole="button" accessibilityLabel={`View photo ${index + 1}: ${photoLabel(item)}`}
        accessibilityHint="Opens the full photo" disabled={!uriFor(item) || locked || awaitingRemote}
        onPress={() => { if (current() && !camera && !locked && !awaitingRemote && submissionId && uriFor(item)) { setFailedPreviewUri(null); setPreview({ id: item.id, submissionId }); } }}>
        {uriFor(item) ? <Image source={{ uri: uriFor(item)! }} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} /> : <ActivityIndicator color={colors.ink3} />}
      </Pressable>
      <Text variant="label" numberOfLines={2}>{photoLabel(item)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.taskIndex === undefined ? 'added photo' : tasks[item.taskIndex]?.t ?? 'photo'}`} disabled={locked} onPress={() => removePhoto(item)} style={styles.removeButton}><Ionicons name="trash-outline" size={20} color={colors.danger} /><Text variant="label" tone="danger">Remove</Text></Pressable>
    </View>)}</View></View> : null}
    <Modal visible={!!camera || previewOpen} testID={previewOpen ? 'capture-photo-preview' : undefined}
      animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => { if (previewOpen) closePreview(); else void finishCamera(); }}>
      {previewOpen && previewItem && previewUri ? <View style={[styles.preview, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        accessibilityViewIsModal onAccessibilityEscape={closePreview}>
        <StatusBar style="light" />
        <View style={styles.previewHeader}>
          <View style={styles.grow}><Text variant="label" style={styles.previewText}>{`Photo ${items.indexOf(previewItem) + 1} of ${total}`}</Text>
            <Text variant="body" weight="bold" style={styles.previewText}>{photoLabel(previewItem)}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close photo" onPress={closePreview} style={styles.previewClose}>
            <Ionicons name="close" size={28} color={colors.onDark} />
          </Pressable>
        </View>
        {failedPreviewUri === previewUri ? <View style={styles.previewFallback}><Text variant="body" align="center" style={styles.previewText} accessibilityRole="alert">Could not load this photo. Close the preview and try again.</Text></View>
          : <Image key={previewUri} testID="capture-photo-full-image" source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain"
            accessible accessibilityLabel={photoLabel(previewItem)} onError={() => setFailedPreviewUri(previewUri)} />}
      </View> : null}
      {camera ? <ShotGuide key={camera.id} tasks={tasks} initial={camera.initial} initialIndex={camera.index} singleShot={camera.singleShot}
        maxCaptured={Math.max(0, MAX_PHOTOS - extras.length)} onBusyChange={(value) => { cameraBusy.current = value; }}
        onShot={addCameraShot} onDone={() => { cameraBusy.current = false; void finishCamera(); }} onClose={() => { void finishCamera(); }} /> : null}
      {finishingCamera ? <View style={styles.cameraSaving}><ActivityIndicator color={colors.ink} /><Text variant="body" weight="bold">Saving your photos…</Text></View> : null}
    </Modal>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  body: { gap: space.lg }, between: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  taskTile: { borderRadius: radius.field, backgroundColor: colors.bg2, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  nextTile: { borderColor: colors.ink, backgroundColor: colors.accentSoft }, dim: { opacity: 0.45 },
  taskNumber: { position: 'absolute', bottom: 1, right: 4 }, tick: { position: 'absolute', right: 2, bottom: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: space.md }, nextIcon: { width: 56, height: 64, backgroundColor: colors.bg2, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, minWidth: 0, gap: 2 }, photoSection: { gap: space.md }, addedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  addedPhoto: { width: '46%', gap: space.sm }, addedThumb: { height: 112, borderRadius: radius.field, overflow: 'hidden', backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  removeButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  preview: { flex: 1, backgroundColor: colors.camera }, previewText: { color: colors.onDark },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.gutter, paddingVertical: space.sm },
  previewClose: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.onDarkMuted, alignItems: 'center', justifyContent: 'center' },
  previewImage: { flex: 1, width: '100%' }, previewFallback: { flex: 1, justifyContent: 'center', padding: space.gutter },
  cameraSaving: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: space.md },
});
