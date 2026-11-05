/** Optional photo suggestions; the submission still accepts 3–10 photos total. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { Banner, Button, Card, EmptyState, Loading, ScreenShell, Text } from '../../../components/v2';
import { ShotGuide } from '../../../components/v2/capture';
import { MAX_PHOTOS, MIN_PHOTOS, shotList, shotListKeyForBusinessType, type ShotKind, type ShotListKey, type ShotTask } from '../../../lib/v2/captureContent';
import { colors, radius, space } from '../../../theme/v2';
import { useCaptureSession } from '../../../hooks/useCaptureSession';
import { useCaptureProgress } from '../../../hooks/useCaptureProgress';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { isEditableCaptureStatus, cachedRejectedCapture, type CaptureSnapshot } from '../../../services/captureEdit';
import { isLocalCapturePhoto, retainCapturePhoto, type RetainedCapturePhoto } from '../../../services/capturePhotoFiles';
import { capturePhotoReviewFor, needsCapturePhotoReview, type CapturePhotoReview } from '../../../services/capturePhotoReview';
import { normalizeCaptureBusinessType } from '../../../../../lib/captureDesign';
import { CapturePhotoGrid } from '../../../components/field-agent/CapturePhotoGrid';
import { CapturePhotoPager } from '../../../components/field-agent/CapturePhotoPager';

type CaptureSession = ReturnType<typeof useCaptureSession>;
type PhotoItem = { id: string; uri?: string; storageId?: string; taskIndex?: number; label?: string };
type PhotoDraft = { version: 1; submissionId: string; businessType?: string; shotListKey?: ShotListKey; items: PhotoItem[]; removedExistingPhotos: string[] };
type PendingPhotos = { submissionId: string; photoUris: string[]; existingPhotos: string[]; savedAt: number; entries?: PhotoItem[]; businessType?: string; shotListKey?: ShotListKey };
type CameraRun = { id: number; initial: (string | null)[]; index: number; singleShot: boolean; replacementId?: string; tasks?: readonly ShotTask[] };
const TASK_ICONS: Record<ShotKind, React.ComponentProps<typeof Ionicons>['name']> = {
  head: 'person-outline', half: 'body-outline', front: 'storefront-outline', sign: 'reader-outline', room: 'business-outline', object: 'cube-outline',
};
const localPhotoId = () => `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
function validItems(value: unknown): PhotoItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PhotoItem => item && typeof item.id === 'string'
    && ((typeof item.uri === 'string' && !!item.uri) || (typeof item.storageId === 'string' && !!item.storageId)))
    .map((item) => ({ ...item, taskIndex: Number.isInteger(item.taskIndex) && item.taskIndex! >= 0 && item.taskIndex! < 10 ? item.taskIndex : undefined,
      label: typeof item.label === 'string' ? item.label.trim().replace(/\s+/g, ' ').slice(0, 60) || undefined : undefined }));
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
  const { resumed, returnTo, draftId: requestedDraftId } = useLocalSearchParams<{ resumed?: string; returnTo?: string; draftId?: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const generateR2UploadUrl = useAction(api.r2.generateUploadUrl);
  const updateSubmission = useMutation(api.submissions.update);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | undefined>();
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [unavailableTarget, setUnavailableTarget] = useState(false);
  const [savedCapture, setSavedCapture] = useState<CaptureSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState<CameraRun | null>(null);
  const [preview, setPreview] = useState<{ id: string; submissionId: string } | null>(null);
  const previewRef = useRef(preview);
  const [previewPaging, setPreviewPaging] = useState(false);
  const previewPagingRef = useRef(false);
  const [failedPreviewUri, setFailedPreviewUri] = useState<string | null>(null);
  const [missingLocalUris, setMissingLocalUris] = useState<ReadonlySet<string>>(() => new Set());
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [finishingCamera, setFinishingCamera] = useState(false);
  const [photoReview, setPhotoReview] = useState<CapturePhotoReview | null>(null);
  const [reviewChecked, setReviewChecked] = useState(false);
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
  const photoVersion = useRef(0);
  const normalizing = useRef(0);
  const cameraSequence = useRef(0);
  const hydrationVersion = useRef(0);
  const previewVersion = useRef(0);
  const migration = useRef<string | null>(null);
  const migratedRoute = useRef<string | null>(null);
  const missingUrisRef = useRef<ReadonlySet<string>>(new Set());
  const pendingTypeRef = useRef<string | null>(null);
  sessionRef.current = session;
  previewRef.current = preview;
  const current = () => mounted.current && sessionRef.current.actorKey === session.actorKey && session.isCurrent();
  const sameCapture = (id: string | null) => current() && !!id && (idRef.current === id
    || (id === 'offline_pending' && migration.current === idRef.current));
  const canMutate = () => current() && sessionRef.current.canMutate();
  const offlinePending = submissionId === 'offline_pending';
  const serverSubmission = useQuery(api.submissions.getById,
    session.canQuery && submissionId && !offlinePending ? { id: submissionId as Id<'submissions'> } : 'skip');
  const submission = serverSubmission ?? (session.isOffline ? cachedRejectedCapture(savedCapture, submissionId, session.actor?.creatorId) ?? serverSubmission : serverSubmission);
  const storedKeys = items.filter((item) => !!item.storageId).map((item) => item.storageId!);
  const photoUrls = useQuery(api.files.getMultipleUrls,
    session.canQuery && storedKeys.length ? { storageIds: storedKeys } : 'skip');
  const urlByKey = new Map(storedKeys.map((key, index) => [key, photoUrls?.[index] ?? null]));
  const tasks = shotList(shotListKeyForBusinessType(businessType));
  const total = items.length;
  const missingPhotos = items.filter(item => !item.storageId && item.uri && missingLocalUris.has(item.uri));
  const enough = total >= MIN_PHOTOS && total <= MAX_PHOTOS && missingPhotos.length === 0;
  const remaining = Math.max(0, MAX_PHOTOS - total);
  const reviewRequired = !!submissionId && needsCapturePhotoReview(photoReview, submissionId, businessType);
  const taskItems = tasks.map((_, index) => items.find((item) => item.taskIndex === index));
  const nextTask = taskItems.findIndex((item) => !item);
  const extras = items.filter((item) => item.taskIndex === undefined);
  const discoveringType = session.canQuery && !offlinePending && !businessType;
  const locked = saving || preparing || finishingCamera || discoveringType || (!!submission && !isEditableCaptureStatus(submission.status));
  const awaitingRemote = session.canQuery && !!submissionId && !offlinePending && submission === undefined;
  const previewActionsDisabled = locked || awaitingRemote || previewPaging;
  const tileSize = Math.max(48, (width - space.gutter * 2 - space.sm * 4) / 5);
  const uriFor = (item?: PhotoItem) => (item?.uri && !missingUrisRef.current.has(item.uri) ? item.uri : null)
    || (item?.storageId ? urlByKey.get(item.storageId) : null) || null;
  const descriptivePhotoLabel = (item: PhotoItem) => (item.label && !['Added photo', 'Unlabeled photo'].includes(item.label) ? item.label : '')
    || (item.taskIndex !== undefined ? tasks[item.taskIndex]?.t : '') || '';
  const photoLabel = (item: PhotoItem) => descriptivePhotoLabel(item) || 'Unlabeled photo';
  const previewItem = preview?.submissionId === submissionId ? items.find((item) => item.id === preview.id) : undefined;
  const previewOpen = !!previewItem && !camera && current();
  const previewIndex = previewItem ? items.indexOf(previewItem) : -1;
  const updatePreviewPaging = (value: boolean) => { previewPagingRef.current = value; setPreviewPaging(value); };
  const closePreview = () => { previewVersion.current++; previewRef.current = null; setPreview(null); updatePreviewPaging(false); };
  const openPreview = (item: PhotoItem) => {
    if (!current() || camera || locked || awaitingRemote || busy.current || pickerBusy.current || normalizing.current > 0 || !submissionId) return;
    setPreviewAttempt(++previewVersion.current); setFailedPreviewUri(null); setError(null);
    const next = { id: item.id, submissionId }; previewRef.current = next; setPreview(next);
  };
  const navigatePreview = (direction: -1 | 1) => {
    if (previewPagingRef.current) return;
    const selected = previewRef.current;
    if (!selected || selected.submissionId !== idRef.current || !sameCapture(selected.submissionId)) return;
    const index = itemsRef.current.findIndex(item => item.id === selected.id);
    const next = itemsRef.current[index + direction];
    if (index >= 0 && next) openPreview(next);
  };
  const selectPreviewPhoto = (photoId: string) => {
    const selected = previewRef.current;
    if (!selected || selected.submissionId !== idRef.current || !sameCapture(selected.submissionId)) return;
    const next = itemsRef.current.find(item => item.id === photoId);
    if (next && next.id !== selected.id) openPreview(next);
  };
  const previewActionCurrent = (id: string, draftId: string) => sameCapture(draftId)
    && !previewPagingRef.current && previewRef.current?.submissionId === draftId && previewRef.current.id === id;
  const requestClosePreview = () => {
    if (!busy.current && !pickerBusy.current && normalizing.current === 0) closePreview();
  };
  const photoFailed = (itemId: string, uri: string, draftId: string | null) => {
    if (!sameCapture(draftId)) return;
    const item = itemsRef.current.find(photo => photo.id === itemId);
    if (!item || uriFor(item) !== uri) return;
    if (item.uri === uri && isLocalCapturePhoto(uri)) {
      const next = new Set([...missingUrisRef.current, uri]); missingUrisRef.current = next; setMissingLocalUris(next);
    }
    else setFailedPreviewUri(uri);
  };
  const goBack = () => {
    if (busy.current || pickerBusy.current || normalizing.current > 0 || !current()) return;
    busy.current = true; setSaving(true);
    void (async () => {
      try {
        // Labels/removals are queued device writes. Finish them before leaving
        // so Review and offline sync see the same photo set as this screen.
        await photoQueue.current; await persistQueue.current;
        if (!current()) return;
        if (resumed === '1' && idRef.current) router.replace({ pathname: '/(app)/submit/info',
          params: { draftId: idRef.current, resumed: '1' } } as never);
        else router.back();
      } catch { if (current()) setError('Could not save your photo changes. Keep this screen open and try again.'); }
      finally { busy.current = false; if (current()) setSaving(false); }
    })();
  };
  useFocusEffect(useCallback(() => {
    if (resumed !== '1' || !submissionId) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (camera || previewOpen) return false; // Full-screen modals own their Back request.
      if (busy.current || pickerBusy.current || normalizing.current > 0 || preparing || finishingCamera) return true;
      goBack(); return true;
    });
    return () => listener.remove();
  }, [resumed, submissionId, camera, previewOpen, preparing, finishingCamera, router]));
  useCaptureProgress(session, 'photos', submissionId, hydrated && !!submissionId
    && (offlinePending || session.isOffline || (!!submission && String(submission.creatorId) === String(session.actor?.creatorId)
      && isEditableCaptureStatus(submission.status))));

  const snapshot = (next: PhotoItem[]): PhotoDraft => ({ version: 1, submissionId: idRef.current!,
    businessType: typeRef.current, shotListKey: shotListKeyForBusinessType(typeRef.current), items: next, removedExistingPhotos: [...removed.current] });
  const persist = (next: PhotoItem[]) => {
    const draft = snapshot(next); const writer = sessionRef.current;
    persistQueue.current = persistQueue.current.catch(() => {}).then(async () => {
      if (!sameCapture(draft.submissionId)) return;
      const pointer = await writer.read<string>('current_submission_id');
      if (sameCapture(draft.submissionId) && pointer === idRef.current) {
        await writer.write('submission_photo_tasks', { ...draft, submissionId: idRef.current });
      }
    });
    void persistQueue.current.catch(() => { if (current()) setError('Could not save these photos on this device. Keep this screen open and try again.'); });
    return persistQueue.current;
  };
  const commit = (next: PhotoItem[]) => { photoVersion.current++; itemsRef.current = next; setItems(next); return persist(next); };
  const requirePhotoReview = async (id: string, previousType: string, nextType: string, stored: unknown) => {
    const existing = capturePhotoReviewFor(stored, id);
    if (existing && normalizeCaptureBusinessType(existing.businessType) === normalizeCaptureBusinessType(nextType)) {
      setPhotoReview(existing); return;
    }
    // Info writes the new requirement before the server type update. An older
    // server row must not overwrite that still-pending transition.
    if (existing && existing.previousBusinessType === normalizeCaptureBusinessType(nextType)
      && (existing.confirmedAt === undefined || existing.confirmedAt < existing.requiredAt)) {
      setPhotoReview(existing); return;
    }
    const marker: CapturePhotoReview = { submissionId: id, previousBusinessType: previousType,
      businessType: nextType, requiredAt: Math.max(Date.now(), (existing?.requiredAt ?? 0) + 1) };
    setPhotoReview(marker); setReviewChecked(false);
    if (sameCapture(id)) await sessionRef.current.write('submission_photo_review', marker);
  };
  useEffect(() => { setReviewChecked(false); }, [submissionId, businessType, photoReview?.requiredAt]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useFocusEffect(useCallback(() => () => {
    // Only leaving this screen/account dismisses the viewer. Cache refreshes
    // below may restart hydration while the same photo remains selected.
    previewVersion.current++; previewRef.current = null; setPreview(null); updatePreviewPaging(false);
  }, [session.actorKey]));
  useFocusEffect(useCallback(() => {
    let active = true;
    mounted.current = true;
    if (!idRef.current) setHydrated(false);
    const version = ++hydrationVersion.current;
    const startedPhotoVersion = photoVersion.current;
    const currentLoad = () => active && current() && version === hydrationVersion.current;
    void (async () => {
      try {
        const [storedId, pendingInfo, taskDraft, pendingPhotos, form, savedShop, storedReview] = await Promise.all([
          session.read<string>('current_submission_id'),
          session.read<{ creatorId?: string; existingDraftId?: string; formData?: { businessType?: string } }>('submission_pending_sync'),
          session.read<PhotoDraft>('submission_photo_tasks'), session.read<PendingPhotos>('submission_pending_photos'),
          session.read<{ submissionId?: string; businessType?: string }>('submission_draft_form'),
          session.read<CaptureSnapshot>('submission_snapshot'),
          session.read<CapturePhotoReview>('submission_photo_review'),
        ]);
        if (!currentLoad()) return;
        const pendingActor = pendingInfo?.creatorId === session.actor?.creatorId;
        const id = storedId || (pendingActor ? 'offline_pending' : null);
        if (!id) { router.replace('/(app)/(tabs)/' as never); return; }
        const ownedCheckpoint = id !== 'offline_pending' && pendingActor && pendingInfo?.existingDraftId === id;
        if (requestedDraftId === 'offline_pending' && ownedCheckpoint) migratedRoute.current = id;
        const followsOfflineRoute = requestedDraftId === 'offline_pending' && migratedRoute.current === id;
        if (requestedDraftId !== undefined && (typeof requestedDraftId !== 'string' || (requestedDraftId !== id && !followsOfflineRoute))) {
          closePreview(); setCamera(null); setUnavailableTarget(true); setHydrated(true); return;
        }
        if (!storedId) await session.write('current_submission_id', id);
        if (!currentLoad()) return;
        const migrating = id !== 'offline_pending' && ((idRef.current === 'offline_pending'
          && (ownedCheckpoint || (taskDraft?.submissionId === id && itemsRef.current.length > 0
            && itemsRef.current.every(item => taskDraft.items?.some(saved => saved.id === item.id)))))
          || (ownedCheckpoint && (followsOfflineRoute || taskDraft?.submissionId === 'offline_pending' || pendingPhotos?.submissionId === 'offline_pending')));
        migration.current = migrating ? id : null;
        setSavedCapture(savedShop?.submissionId === id && savedShop.creatorId === session.actor?.creatorId ? savedShop : null);
        if (idRef.current && idRef.current !== id) {
          previewVersion.current++; previewRef.current = null; setPreview(null); updatePreviewPaging(false);
          if (!migrating) { setHydrated(false); setCamera(null); }
        }
        const ownDraft = taskDraft?.submissionId === id || (migrating && taskDraft?.submissionId === 'offline_pending') ? taskDraft : null;
        const ownPending = pendingPhotos?.submissionId === id || (migrating && pendingPhotos?.submissionId === 'offline_pending') ? pendingPhotos : null;
        let restored = validItems(ownDraft?.items ?? ownPending?.entries);
        if (!ownDraft && !ownPending?.entries && Array.isArray(ownPending?.photoUris)) {
          ownPending.photoUris.forEach((uri, index) => { if (typeof uri === 'string' && uri) restored.push({ id: `restored-${index}`, uri }); });
        }
        const restoredRemoved = Array.isArray(ownDraft?.removedExistingPhotos) ? ownDraft.removedExistingPhotos : [];
        for (const key of ownPending?.existingPhotos ?? []) {
          if (typeof key === 'string' && !restoredRemoved.includes(key) && !restored.some((item) => item.storageId === key)) restored.push({ id: `stored-${key}`, storageId: key });
        }
        const snapshotType = savedShop?.submissionId === id || (migrating && savedShop?.submissionId === 'offline_pending') ? savedShop?.businessType : undefined;
        const ownPendingInfo = pendingActor && (id === 'offline_pending'
          ? !pendingInfo?.existingDraftId || pendingInfo.existingDraftId === 'offline_pending'
          : pendingInfo?.existingDraftId === id) ? pendingInfo : null;
        const ownForm = form?.submissionId === id || (migrating && form?.submissionId === 'offline_pending') ? form : null;
        const sameIdentity = idRef.current === id || migrating;
        const restoredType = ownPendingInfo?.formData?.businessType || ownForm?.businessType || snapshotType || ownDraft?.businessType || ownPending?.businessType
          || (sameIdentity ? typeRef.current : undefined);
        pendingTypeRef.current = ownPendingInfo?.formData?.businessType ?? null;
        const oldGuide = ownDraft?.shotListKey ?? ownPending?.shotListKey
          ?? (ownDraft?.businessType && ['law', 'clinic'].includes(shotListKeyForBusinessType(ownDraft.businessType))
            ? 'shop' : shotListKeyForBusinessType(ownDraft?.businessType));
        const differentSuggestions = (!!ownDraft || !!ownPending?.entries) && !!restoredType && oldGuide !== shotListKeyForBusinessType(restoredType);
        if (differentSuggestions) restored = restored.map((item) => ({ ...item,
          label: item.label || (item.taskIndex !== undefined ? shotList(oldGuide)[item.taskIndex]?.t : undefined), taskIndex: undefined }));
        const missing = new Set<string>();
        let migratedFiles = false;
        restored = await Promise.all(restored.map(async item => {
          if (!item.uri) return item;
          let retained: RetainedCapturePhoto | null;
          try {
            retained = await retainCapturePhoto(item.uri, { creatorId: String(session.actor!.creatorId),
              submissionId: id, isCurrent: currentLoad });
          } catch (cause) {
            // An uploaded photo is still recoverable when local storage cannot be read/copied.
            if (!item.storageId) throw cause;
            if (currentLoad()) missing.add(item.uri);
            return item;
          }
          if (!retained || !currentLoad()) return item;
          if (retained.missing) missing.add(retained.uri);
          if (retained.uri !== item.uri) migratedFiles = true;
          return { ...item, uri: retained.uri };
        }));
        if (!currentLoad()) return;
        // A same-capture refresh may be reading files while Retake/Replace or
        // a label edit finishes. The newer live edit owns the photo selection.
        const keepLivePhotos = sameIdentity && photoVersion.current !== startedPhotoVersion;
        if (keepLivePhotos) {
          restored = differentSuggestions ? itemsRef.current.map(item => ({ ...item,
            label: item.label || (item.taskIndex !== undefined ? shotList(oldGuide)[item.taskIndex]?.t : undefined), taskIndex: undefined })) : itemsRef.current;
        } else {
          removed.current = restoredRemoved;
          missingUrisRef.current = missing; setMissingLocalUris(missing);
        }
        typeRef.current = restoredType; setBusinessType(restoredType);
        idRef.current = id; setSubmissionId(id); itemsRef.current = restored; setItems(restored);
        const restoredReview = capturePhotoReviewFor(storedReview, id);
        setPhotoReview(restoredReview);
        const previousType = ownDraft?.businessType ?? restoredReview?.businessType;
        if (restored.length && restoredType && ((previousType
          && normalizeCaptureBusinessType(previousType) !== normalizeCaptureBusinessType(restoredType))
          || (restoredReview && normalizeCaptureBusinessType(restoredReview.businessType) !== normalizeCaptureBusinessType(restoredType)))) {
          await requirePhotoReview(id, previousType ?? restoredReview!.businessType, restoredType, storedReview);
          if (!currentLoad()) return;
        }
        if (differentSuggestions || migratedFiles) await persist(restored);
        if (currentLoad()) { setUnavailableTarget(false); setHydrated(true); }
      } catch { if (currentLoad()) setError('Could not load your photo draft. Reopen this step to try again.'); }
    })();
    return () => { active = false; };
  }, [session.revision, session.actorKey, requestedDraftId]));

  useEffect(() => {
    if (!hydrated || !submission || String(submission.creatorId) !== String(session.actor?.creatorId)) return;
    const serverId = String(submission._id);
    if (serverId !== idRef.current) return;
    let active = true;
    // A queued local type edit wins over the older server row until it syncs.
    const pendingType = pendingTypeRef.current;
    const currentType = pendingType && normalizeCaptureBusinessType(pendingType) !== normalizeCaptureBusinessType(submission.businessType)
      ? pendingType : submission.businessType;
    if (currentType === submission.businessType) pendingTypeRef.current = null;
    const previousType = typeRef.current;
    const differentSuggestions = previousType && shotListKeyForBusinessType(previousType) !== shotListKeyForBusinessType(currentType);
    typeRef.current = currentType; setBusinessType(currentType);
    if (itemsRef.current.length && ((previousType && normalizeCaptureBusinessType(previousType) !== normalizeCaptureBusinessType(currentType))
      || (photoReview && normalizeCaptureBusinessType(photoReview.businessType) !== normalizeCaptureBusinessType(currentType)))) {
      void session.read<CapturePhotoReview>('submission_photo_review').then(stored => {
        if (active && sameCapture(serverId) && typeRef.current === currentType) return requirePhotoReview(serverId, previousType ?? photoReview!.businessType, currentType, stored);
      }).catch(() => { if (current()) setError('Could not save the photo review reminder. Try again.'); });
    }
    if (differentSuggestions) {
      setCamera(null);
      void commit(itemsRef.current.map((item) => ({ ...item,
        label: item.label || (item.taskIndex !== undefined ? shotList(shotListKeyForBusinessType(previousType))[item.taskIndex]?.t : undefined), taskIndex: undefined })));
    }
    void session.read<PhotoDraft>('submission_photo_tasks').then((cached) => {
      if (!active || !current() || idRef.current !== serverId) return;
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

  const normalize = async (uri: string, draftId: string) => {
    // Render bakes EXIF orientation into an actual JPEG, including HEIC imports.
    const rendered = await ImageManipulator.manipulate(uri).resize({ width: 1600 }).renderAsync();
    const normalized = (await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG })).uri;
    const retained = await retainCapturePhoto(normalized, { creatorId: String(session.actor!.creatorId),
      submissionId: draftId, isCurrent: () => sameCapture(draftId) });
    if (retained?.missing) throw new Error('Could not save this photo. Please take it again.');
    return retained?.uri ?? null;
  };
  const addCameraShot = (taskIndex: number, uri: string, replacementId?: string) => {
    const fromDraft = idRef.current;
    const fromSuggestions = shotListKeyForBusinessType(typeRef.current);
    const replacing = replacementId ? itemsRef.current.find(item => item.id === replacementId) : undefined;
    const capturedLabel = replacing ? descriptivePhotoLabel(replacing) || undefined : tasks[taskIndex]?.t;
    normalizing.current += 1; setPreparing(true);
    photoQueue.current = photoQueue.current.catch(() => {}).then(async () => {
      if (!fromDraft || !sameCapture(fromDraft)) return;
      const normalized = await normalize(uri, fromDraft);
      if (!normalized || !sameCapture(fromDraft)) return;
      const assignedIndex = fromSuggestions === shotListKeyForBusinessType(typeRef.current)
        ? replacementId ? replacing?.taskIndex : taskIndex : undefined;
      const previous = replacementId ? itemsRef.current.find(item => item.id === replacementId)
        : assignedIndex === undefined ? undefined : itemsRef.current.find((item) => item.taskIndex === assignedIndex);
      if (replacementId && !previous) return;
      if (!previous && itemsRef.current.length >= MAX_PHOTOS) throw new Error('Keep up to 10 photos. Remove one before adding another.');
      if (previous?.storageId) removed.current = [...new Set([...removed.current, previous.storageId])];
      const photo: PhotoItem = { id: previous?.id ?? localPhotoId(), uri: normalized, taskIndex: assignedIndex, label: capturedLabel };
      await commit(previous ? itemsRef.current.map(item => item.id === previous.id ? photo : item) : [...itemsRef.current, photo]);
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
    closePreview(); setError(null); setCamera({ id: ++cameraSequence.current, initial: taskItems.map(uriFor), index, singleShot });
  };
  const retakePhoto = (id: string, keepPreview = false) => {
    const item = itemsRef.current.find(photo => photo.id === id);
    if (!item || locked || awaitingRemote || busy.current || pickerBusy.current || normalizing.current > 0 || !current()) return;
    if (!keepPreview) closePreview();
    else { setPreviewAttempt(++previewVersion.current); setFailedPreviewUri(null); }
    setError(null);
    setCamera({ id: ++cameraSequence.current, index: 0, singleShot: true, replacementId: id,
      initial: [uriFor(item)], tasks: [{ t: photoLabel(item), h: 'Retake this photo clearly. The new image will replace this one.', kind: item.taskIndex !== undefined ? tasks[item.taskIndex]?.kind ?? 'object' : 'object' }] });
  };
  const pickImages = async (replacement?: PhotoItem, keepPreview = false) => {
    if (busy.current || pickerBusy.current || normalizing.current > 0 || !current()) return;
    const replacing = replacement ? itemsRef.current.find(item => item.id === replacement.id) : undefined;
    const capacity = replacing ? 1 : MAX_PHOTOS - itemsRef.current.length;
    const fromDraft = idRef.current;
    const fromSuggestions = shotListKeyForBusinessType(typeRef.current);
    const sameDraft = () => sameCapture(fromDraft);
    if (capacity <= 0) { setError('Keep up to 10 photos. Remove one before adding another.'); return; }
    if (!keepPreview) closePreview();
    else { setPreviewAttempt(++previewVersion.current); setFailedPreviewUri(null); }
    pickerBusy.current = true; setPreparing(true); setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!sameDraft()) return;
      if (permission.status !== 'granted') { Alert.alert('Photo access needed', 'Allow photo access to add pictures, or use the guided camera.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: !replacing, quality: 0.8, selectionLimit: capacity });
      if (!sameDraft() || result.canceled) return;
      const added: PhotoItem[] = [];
      for (const asset of result.assets.slice(0, capacity)) {
        if (!fromDraft) return;
        const uri = await normalize(asset.uri, fromDraft);
        if (!uri || !sameDraft()) return;
        const taskIndex = fromSuggestions === shotListKeyForBusinessType(typeRef.current) ? replacing?.taskIndex : undefined;
        added.push({ id: replacing?.id ?? localPhotoId(), uri, ...(taskIndex !== undefined ? { taskIndex } : {}),
          ...(replacing ? { label: descriptivePhotoLabel(replacing) || undefined } : {}) });
      }
      if (replacing) {
        if (!added[0] || !itemsRef.current.some(item => item.id === replacing.id)) return;
        if (replacing.storageId) removed.current = [...new Set([...removed.current, replacing.storageId])];
        await commit(itemsRef.current.map(item => item.id === replacing.id ? added[0] : item));
        return;
      }
      const fit = Math.min(added.length, MAX_PHOTOS - itemsRef.current.length);
      await commit([...itemsRef.current, ...added.slice(0, fit)]);
      if (sameDraft() && result.assets.length > fit) setError('Only the photos that fit within the 10-photo limit were added.');
    } catch { if (current()) setError('Could not prepare those photos. Please choose them again.'); }
    finally { pickerBusy.current = false; if (current()) setPreparing(false); }
  };
  const removePhotos = (ids: string[]) => {
    if (locked || awaitingRemote || busy.current || pickerBusy.current || normalizing.current > 0 || !current()) return;
    const selected = new Set(ids);
    removed.current = [...new Set([...removed.current, ...itemsRef.current.filter(item => selected.has(item.id) && item.storageId).map(item => item.storageId!)])];
    closePreview(); setReviewChecked(false);
    void commit(itemsRef.current.filter(photo => !selected.has(photo.id)));
  };
  const renamePhoto = (id: string, value: string) => {
    const label = value.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!label || locked || awaitingRemote || busy.current || pickerBusy.current || normalizing.current > 0 || !current()) return;
    void commit(itemsRef.current.map(photo => photo.id === id ? { ...photo, label } : photo));
  };

  const handleNext = async () => {
    if (busy.current || pickerBusy.current || normalizing.current > 0 || !current() || !idRef.current) return;
    if (itemsRef.current.some(item => !item.storageId && item.uri && missingUrisRef.current.has(item.uri))) {
      setError('Replace or remove the unavailable photos before you continue.'); return;
    }
    if (itemsRef.current.length < MIN_PHOTOS || itemsRef.current.length > MAX_PHOTOS) { setError('Add 3–10 photos to continue.'); return; }
    const savingId = idRef.current;
    const savingType = typeRef.current;
    const sameDraft = () => current() && idRef.current === savingId
      && normalizeCaptureBusinessType(typeRef.current) === normalizeCaptureBusinessType(savingType);
    const continueAfterPhotos = () => {
      if (returnTo === 'review') router.back();
      else if (submission?.status === 'rejected') router.back();
      else router.push('/(app)/submit/interview');
    };
    setPreview(null); busy.current = true; setSaving(true); setError(null);
    try {
      const startedReview = capturePhotoReviewFor(await session.read('submission_photo_review'), savingId);
      if (!sameDraft()) return;
      if (needsCapturePhotoReview(startedReview, savingId, savingType)
        && (!reviewChecked || startedReview?.requiredAt !== photoReview?.requiredAt)) {
        setPhotoReview(startedReview); setReviewChecked(false);
        throw new Error('Review your photos for this business type before continuing.');
      }
      const confirmReview = async () => {
        const latest = capturePhotoReviewFor(await session.read('submission_photo_review'), savingId);
        if (!sameDraft()) return false;
        if (needsCapturePhotoReview(latest, savingId, savingType)) {
          if (!reviewChecked || latest?.requiredAt !== startedReview?.requiredAt
            || normalizeCaptureBusinessType(latest?.businessType) !== normalizeCaptureBusinessType(savingType)) {
            setPhotoReview(latest); setReviewChecked(false);
            throw new Error('The business type changed again. Review your photos before continuing.');
          }
          const confirmed = { ...latest!, confirmedAt: Math.max(Date.now(), latest!.requiredAt) };
          await session.write('submission_photo_review', confirmed);
          if (!sameDraft()) return false;
          setPhotoReview(confirmed);
        }
        return true;
      };
      await persist(itemsRef.current); if (!sameDraft()) return;
      if (!canMutate() || savingId === 'offline_pending') {
        await session.write('submission_pending_photos', {
          submissionId: savingId, photoUris: itemsRef.current.filter((item) => !item.storageId && item.uri).map((item) => item.uri!),
          existingPhotos: itemsRef.current.filter((item) => item.storageId).map((item) => item.storageId!),
          entries: itemsRef.current.filter((item) => item.uri), savedAt: Date.now(), businessType: savingType,
          shotListKey: shotListKeyForBusinessType(savingType),
        } satisfies PendingPhotos);
        if (sameDraft() && await confirmReview()) continueAfterPhotos(); return;
      }
      if (!submission || String(submission.creatorId) !== String(session.actor?.creatorId) || !isEditableCaptureStatus(submission.status)) throw new Error('Reconnect to confirm this editable capture before saving photos.');
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
      const savedCapture = await session.read<CaptureSnapshot>('submission_snapshot');
      if (!sameDraft()) return;
      if (savedCapture?.submissionId === savingId && savedCapture.creatorId === session.actor?.creatorId) {
        await session.write('submission_snapshot', { ...savedCapture, photos: itemsRef.current.map(item => item.storageId!),
          resolvedPhotoUrls: itemsRef.current.map(uriFor).filter((uri): uri is string => !!uri) });
        if (!sameDraft()) return;
      }
      // Keep removed-key tombstones with this draft until it is sent. A stale
      // query/queued baseline must not add an explicitly removed photo back.
      await persist(itemsRef.current); await session.remove('submission_pending_photos');
      if (sameDraft() && await confirmReview()) continueAfterPhotos();
    } catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : 'Could not save these photos. Please try again.'); }
    finally { busy.current = false; if (current()) setSaving(false); }
  };

  if (unavailableTarget) return <ScreenShell onBack={() => router.back()}><EmptyState icon="lock-closed-outline" title="Photo draft unavailable"
    body="Open this capture again from your submissions before editing its photos." actionLabel="Back to the map"
    onAction={() => router.replace('/(app)/(tabs)/' as never)} /></ScreenShell>;
  if (!hydrated) return <ScreenShell onBack={goBack}>{error ? <Banner tone="danger" body={error} /> : <Loading fill={false} label="Loading your photo draft" />}</ScreenShell>;
  if (submission === null || (submission && (String(submission.creatorId) !== String(session.actor?.creatorId) || !isEditableCaptureStatus(submission.status)))) return <ScreenShell onBack={goBack}><EmptyState icon="lock-closed-outline" title="Capture unavailable" body="Open a draft or rejected capture from your account to edit photos." /></ScreenShell>;

  return <ScreenShell title="Show us the shop" subtitle="Ten suggestions. Add 3–10 photos in total." progress={0.4} onBack={() => {
    if (!busy.current && !pickerBusy.current && normalizing.current === 0 && !preparing && !finishingCamera) goBack();
  }}
    contentStyle={styles.body} footer={<>
      {error && !previewOpen ? <Text tone="danger" align="center" accessibilityRole="alert">{error}</Text> : null}
      {missingPhotos.length ? <Button title="Replace missing photos" onPress={() => { void pickImages(missingPhotos[0]); }} disabled={locked} />
        : enough ? <Button title={reviewRequired ? 'Save reviewed photos' : submission?.status === 'rejected' ? 'Save changes' : 'Continue to interview'} onPress={handleNext} loading={saving} disabled={locked || awaitingRemote || (reviewRequired && !reviewChecked)} />
        : <Button title="Start taking photos" onPress={() => openCamera()} disabled={locked || remaining === 0} />}
      <Button title="Add your own photos" variant="ghost" icon="images-outline" onPress={() => { void pickImages(); }} disabled={locked || remaining === 0} />
    </>}>
    <OfflineBanner />
    {submission?.status === 'rejected' ? <Banner tone="danger" title="What needs fixing" body={submission.rejectionReason || 'Review the feedback and replace only the photos that need correcting.'} /> : null}
    {reviewRequired ? <Banner tone="warn" title={`Review photos for ${businessType}`}
      body={`The business type changed from ${photoReview?.previousBusinessType}. Your photos and interview are saved. Check the new suggestions, then keep, add or replace photos.`} /> : null}
    <View style={styles.between}><Text variant="label" tone="muted">Step 2 of 5</Text><Text variant="label" weight="bold">{`${total} of ${MAX_PHOTOS} photos added`}</Text></View>
    <View style={styles.grid}>{tasks.map((task, index) => {
      const item = taskItems[index]; const uri = uriFor(item); const disabled = locked || (!item && remaining === 0);
      const missing = !!item && !item.storageId && !!item.uri && missingLocalUris.has(item.uri);
      return <Pressable key={index} onPress={() => openCamera(index, !!item)} disabled={disabled} accessibilityRole="button"
        accessibilityLabel={`${task.t}${item ? missing ? ', unavailable. Retake photo' : ', taken. Retake photo' : ', not taken'}`} accessibilityState={{ disabled }}
        style={[styles.taskTile, { width: tileSize, height: tileSize }, nextTask === index && remaining > 0 ? styles.nextTile : null, disabled && !item ? styles.dim : null]}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => photoFailed(item!.id, uri, submissionId)} /> : <Ionicons name={item ? 'image-outline' : TASK_ICONS[task.kind]} size={28} color={colors.ink2} />}
        {item ? <View style={[styles.tick, missing && { backgroundColor: colors.danger }]}><Ionicons name={missing ? 'alert' : 'checkmark'} size={15} color={missing ? colors.onDark : colors.ink} /></View> : <View style={styles.taskNumber}><Text variant="label" tone="muted">{index + 1}</Text></View>}
      </Pressable>;
    })}</View>
    {nextTask >= 0 && remaining > 0 ? <Card onPress={() => { if (!locked) openCamera(nextTask); }} accessibilityLabel={`Take ${tasks[nextTask].t}`} style={styles.nextCard}>
      <View style={styles.nextIcon}><Ionicons name={TASK_ICONS[tasks[nextTask].kind]} size={28} color={colors.ink} /></View>
      <View style={styles.grow}><Text variant="label" tone="muted">Next suggestion</Text><Text variant="bodyLg" weight="bold">{tasks[nextTask].t}</Text><Text variant="label" tone="ink2" weight="medium">{tasks[nextTask].h}</Text></View>
      <Ionicons name="chevron-forward" size={22} color={colors.ink3} />
    </Card> : <Banner tone="neutral" title={remaining === 0 ? 'You have 10 photos' : 'Suggestions covered'} body="Keep the photos that show this shop best. You can retake a suggestion or replace an added photo." />}
    <Text variant="label" tone="muted" weight="medium">Suggestions are optional. Three clear photos are enough to continue; extras share the same 10-photo limit.</Text>
    <CapturePhotoGrid key={`${session.actorKey}:${submissionId}`} items={items.map(item => ({ id: item.id, uri: uriFor(item),
      label: descriptivePhotoLabel(item), missing: !item.storageId && !!item.uri && missingLocalUris.has(item.uri) }))}
      disabled={locked || awaitingRemote} suggestedLabels={tasks.map(task => task.t)} onRetake={retakePhoto}
      onPreview={id => { const item = itemsRef.current.find(photo => photo.id === id); if (item) openPreview(item); }}
      onReplace={id => { const item = itemsRef.current.find(photo => photo.id === id); if (item) void pickImages(item); }}
      onRename={renamePhoto} onRemove={removePhotos}
      onImageError={(id, uri) => photoFailed(id, uri, submissionId)} />
    {reviewRequired ? <Pressable accessibilityRole="checkbox" accessibilityLabel={`I reviewed these photos for ${businessType}`}
      accessibilityState={{ checked: reviewChecked, disabled: locked || awaitingRemote }} disabled={locked || awaitingRemote}
      onPress={() => setReviewChecked(value => !value)} style={styles.reviewConfirmation}>
      <Ionicons name={reviewChecked ? 'checkbox' : 'square-outline'} size={26} color={colors.ink} />
      <View style={styles.grow}><Text weight="semibold">{`I reviewed these photos for ${businessType}`}</Text>
        <Text variant="label" tone="muted">Keep only photos of this business. You can continue with 3–10 photos.</Text></View>
    </Pressable> : null}
    <Modal visible={!!camera || previewOpen} testID={previewOpen ? 'capture-photo-preview' : undefined}
      animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => { if (previewOpen) requestClosePreview(); else void finishCamera(); }}>
      {previewOpen && previewItem ? <View style={[styles.preview, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}
        accessibilityViewIsModal onAccessibilityEscape={requestClosePreview}>
        <StatusBar style="light" />
        <View style={styles.previewHeader}>
          <View style={styles.grow}><Text variant="label" style={styles.previewText} accessibilityLiveRegion="polite">{`${previewIndex + 1} of ${total}`}</Text>
            <Text variant="body" weight="bold" style={styles.previewText}>{photoLabel(previewItem)}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close photo" onPress={requestClosePreview}
            disabled={preparing || saving} accessibilityState={{ disabled: preparing || saving }} style={styles.previewClose}>
            <Ionicons name="close" size={28} color={colors.onDark} />
          </Pressable>
        </View>
        <CapturePhotoPager key={`${session.actorKey}:${submissionId}`} photoIds={items.map(item => item.id)} selectedPhotoId={previewItem.id}
          disabled={locked || awaitingRemote} onSelectPhoto={selectPreviewPhoto}
          onInteractionChange={value => { if (current()) updatePreviewPaging(value); }} style={styles.previewSurface}
          renderPhoto={id => {
            const item = items.find(photo => photo.id === id);
            if (!item) return null;
            const uri = uriFor(item); const active = item.id === previewItem.id;
            return !item.storageId && item.uri && missingLocalUris.has(item.uri)
              ? <View style={styles.previewFallback}><Text variant="body" align="center" style={styles.previewText} accessibilityRole={active ? 'alert' : undefined}>This photo is no longer on this device. Retake it or choose a replacement.</Text></View>
              : !uri || (active && failedPreviewUri === uri) ? <View style={styles.previewFallback}>
                {!uri && session.canQuery && photoUrls === undefined ? <ActivityIndicator color={colors.onDark} />
                  : <><Text variant="body" align="center" style={styles.previewText} accessibilityRole={active ? 'alert' : undefined}>Could not load this photo. Reconnect and try again.</Text>
                    {active ? <Button title="Try again" onPress={() => { setFailedPreviewUri(null); setPreviewAttempt(++previewVersion.current); }} /> : null}</>}
              </View>
                : <Image key={`${item.id}:${uri}:${active ? previewAttempt : 'adjacent'}`} testID={active ? 'capture-photo-full-image' : undefined}
                  source={{ uri }} style={styles.previewImage} resizeMode="contain" accessible={active} accessibilityLabel={photoLabel(item)} onError={() => {
                    if (previewRef.current?.id === item.id && previewVersion.current === previewAttempt) photoFailed(item.id, uri, submissionId);
                  }} />;
          }} />
        <View style={styles.previewFooter}>
          {total > 1 ? <View style={styles.previewNavigation}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous photo" accessibilityState={{ disabled: previewIndex <= 0 || previewActionsDisabled }}
              disabled={previewIndex <= 0 || previewActionsDisabled} onPress={() => navigatePreview(-1)}
              style={[styles.previewClose, (previewIndex <= 0 || previewActionsDisabled) && styles.previewDisabled]}>
              <Ionicons name="chevron-back" size={25} color={colors.onDark} /></Pressable>
            <Text variant="label" style={styles.previewText}>Swipe between photos</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next photo" accessibilityState={{ disabled: previewIndex >= total - 1 || previewActionsDisabled }}
              disabled={previewIndex >= total - 1 || previewActionsDisabled} onPress={() => navigatePreview(1)}
              style={[styles.previewClose, (previewIndex >= total - 1 || previewActionsDisabled) && styles.previewDisabled]}>
              <Ionicons name="chevron-forward" size={25} color={colors.onDark} /></Pressable>
          </View> : null}
          {error ? <Text align="center" style={styles.previewText} accessibilityRole="alert">{error}</Text> : null}
          <View style={styles.previewActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Retake photo" disabled={previewActionsDisabled}
              accessibilityState={{ disabled: previewActionsDisabled }} style={[styles.previewAction, previewActionsDisabled && styles.previewDisabled]}
              onPress={() => { if (previewActionCurrent(previewItem.id, submissionId!)) retakePhoto(previewItem.id, true); }}>
              <Ionicons name="camera-outline" size={23} color={colors.onDark} /><Text weight="semibold" style={styles.previewText}>Retake</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Replace photo" disabled={previewActionsDisabled}
              accessibilityState={{ disabled: previewActionsDisabled }} style={[styles.previewAction, previewActionsDisabled && styles.previewDisabled]}
              onPress={() => { if (previewActionCurrent(previewItem.id, submissionId!)) void pickImages(previewItem, true); }}>
              <Ionicons name="images-outline" size={23} color={colors.onDark} /><Text weight="semibold" style={styles.previewText}>Replace</Text></Pressable>
          </View>
        </View>
      </View> : null}
      {camera ? <ShotGuide key={camera.id} tasks={camera.tasks ?? tasks} initial={camera.initial} initialIndex={camera.index} singleShot={camera.singleShot}
        maxCaptured={camera.replacementId ? 1 : Math.max(0, MAX_PHOTOS - extras.length)} onBusyChange={(value) => { cameraBusy.current = value; }}
        onShot={(index, uri) => addCameraShot(index, uri, camera.replacementId)} onDone={() => { cameraBusy.current = false; void finishCamera(); }} onClose={() => { void finishCamera(); }} /> : null}
      {finishingCamera ? <View style={styles.cameraSaving}><ActivityIndicator color={colors.ink} /><Text variant="body" weight="bold">Saving your photos…</Text></View> : null}
    </Modal>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  reviewConfirmation: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, backgroundColor: colors.card, borderRadius: radius.card },
  body: { gap: space.lg }, between: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  taskTile: { borderRadius: radius.field, backgroundColor: colors.bg2, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  nextTile: { borderColor: colors.ink, backgroundColor: colors.accentSoft }, dim: { opacity: 0.45 },
  taskNumber: { position: 'absolute', bottom: 1, right: 4 }, tick: { position: 'absolute', right: 2, bottom: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: space.md }, nextIcon: { width: 56, height: 64, backgroundColor: colors.bg2, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  preview: { flex: 1, backgroundColor: colors.camera }, previewText: { color: colors.onDark },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.gutter, paddingVertical: space.sm },
  previewClose: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.onDarkMuted, alignItems: 'center', justifyContent: 'center' },
  previewImage: { flex: 1, width: '100%' }, previewFallback: { flex: 1, justifyContent: 'center', padding: space.gutter },
  previewSurface: { flex: 1, minHeight: 0 }, previewFooter: { paddingHorizontal: space.gutter, paddingTop: space.sm, paddingBottom: space.sm, gap: space.md },
  previewNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  previewActions: { flexDirection: 'row', gap: space.md }, previewAction: { flex: 1, minHeight: 52, padding: space.md, borderRadius: radius.pill,
    backgroundColor: colors.onDarkMuted, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  previewDisabled: { opacity: 0.35 },
  cameraSaving: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: space.md },
});
