import { useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useAction, useConvex } from 'convex/react';
import { api, type Doc, type Id } from '@tendso/convex-client';
import { useNetwork } from '../providers/NetworkProvider';
import { readCaptureCache, writeCaptureCache, removeCaptureCache, type CaptureStorageKey, type CaptureDesignDraft } from '../services/captureSession';
import { captureEmailError } from '../../../lib/captureEmail';
import { commissionFor } from '@tendso/shared/pricing';
import { validCapturePrice } from '../services/capturePrice';
import { isEditableCaptureStatus } from '../services/captureEdit';
import { captureDesignMatchesBusinessType } from '../services/captureDesign';
import { capturePhotoReviewFor, needsCapturePhotoReview } from '../services/capturePhotoReview';
import { capturePhotosNeedSave } from '../services/capturePhotoChanges';
import { captureInterviewNeedsSave } from '../services/captureInterviewChanges';

type Info = { businessName: string; businessType: string; ownerName: string; ownerPhone: string; ownerEmail?: string; address: string; city: string; coordinates?: { lat: number; lng: number } };
type PendingInfo = { formData: Info; creatorId: string; existingDraftId?: string | null; prospectLeadId?: string;
  initialSellPrice?: number; savedAt: number; legacyMigration?: boolean };
type PhotoEntry = { id: string; uri: string; storageId?: string; taskIndex?: number; label?: string };
type PendingPhotos = { submissionId: string; photoUris: string[]; existingPhotos: string[]; entries?: PhotoEntry[]; savedAt?: number };
type PendingInterview = { submissionId: string; recordingUri: string; parallelAudioUri?: string | null; type: 'video' | 'audio'; storageId?: string; audioStorageId?: string; savedAt?: number };
type SubmitChoice = { submissionId: string; templateId?: string; sellPrice?: number; submissionType?: 'standard' | 'with_custom_domain'; requestedDomain?: string; domainPricePHP?: number; savedAt?: number };
type QueuedSubmit = boolean | SubmitChoice;
const PARTS = ['submission_pending_sync', 'submission_pending_photos', 'submission_pending_interview', 'submission_pending_submit'] as const;
const META = ['submission_photo_tasks', 'submission_interview_draft', 'submission_snapshot', 'submission_design', 'submission_progress', 'submission_draft_form', 'submission_photo_review'] as const;
const clean = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';

/** Recover a response lost after create without reusing another business's draft. */
function sameCapture(row: Doc<'submissions'>, info: PendingInfo) {
  return ['businessName', 'businessType', 'ownerName', 'ownerPhone', 'ownerEmail', 'address', 'city']
    .every(key => clean(row[key as keyof Doc<'submissions'>]) === clean(info.formData[key as keyof Info]))
    && (row.prospectLeadId ?? null) === (info.prospectLeadId ?? null)
    && (!info.formData.coordinates || (row.coordinates?.lat === info.formData.coordinates.lat
      && row.coordinates.lng === info.formData.coordinates.lng));
}

export function useOfflineSync({ enabled = true, creatorId }: { enabled?: boolean; creatorId?: Id<'creators'> } = {}) {
  const { isConnected } = useNetwork();
  const client = useConvex();
  const create = useMutation(api.submissions.create);
  const update = useMutation(api.submissions.update);
  const submit = useMutation(api.submissions.submit);
  const setTier = useMutation(api.submissions.setDomainTier);
  const chooseDesign = useMutation(api.submissions.chooseDesign);
  const uploadTarget = useAction(api.r2.generateUploadUrl);
  const busy = useRef(false);
  const emailWarning = useRef<string | null>(null);
  const designWarning = useRef<string | null>(null);
  const photoReviewWarning = useRef<string | null>(null);
  const photoChangesWarning = useRef<string | null>(null);
  const interviewChangesWarning = useRef<string | null>(null);
  const mounted = useRef(true);
  const live = useRef({ enabled, creatorId, isConnected });
  live.current = { enabled, creatorId, isConnected };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const attemptSync = useCallback(async () => {
    const actor = creatorId;
    const current = () => mounted.current && live.current.enabled && live.current.creatorId === actor && live.current.isConnected === true;
    if (!actor || !current() || busy.current) return;
    busy.current = true;
    try {
      const [scoped, cachedDesign] = await Promise.all([
        Promise.all(PARTS.map(key => readCaptureCache<unknown>(actor, key))),
        readCaptureCache<CaptureDesignDraft>(actor, 'submission_design'),
      ]);
      const [scopedId, legacyId, ...legacyRaw] = await Promise.all([
        readCaptureCache<string>(actor, 'current_submission_id'), AsyncStorage.getItem('current_submission_id'),
        ...PARTS.map(key => AsyncStorage.getItem(key)),
      ]);
      if (!current()) return;
      const decode = (value: string | null | undefined) => { try { return value ? JSON.parse(value) : null; } catch { return null; } };
      const scopedInfo = scoped[0] as PendingInfo | null;
      const legacyInfo = decode(legacyRaw[0]) as PendingInfo | null;
      const design = cachedDesign && typeof cachedDesign.submissionId === 'string'
        && typeof cachedDesign.templateId === 'string' && cachedDesign.templateId.trim()
        && Number.isFinite(cachedDesign.savedAt) ? cachedDesign : null;
      const useScoped = !!scopedId || scoped.some(Boolean) || !!design;
      let info = useScoped ? scopedInfo : legacyInfo;
      let photos = (useScoped ? scoped[1] : decode(legacyRaw[1])) as PendingPhotos | null;
      let interview = (useScoped ? scoped[2] : decode(legacyRaw[2])) as PendingInterview | null;
      let queued = (useScoped ? scoped[3] : decode(legacyRaw[3])) as QueuedSubmit | null;
      if (!info && !photos && !interview && !queued && !design) return;
      if (info && info.creatorId !== actor) return;
      let id = scopedId ?? (useScoped ? null : legacyId);
      if ((!id || id === 'offline_pending') && typeof queued === 'object' && queued?.submissionId !== 'offline_pending') id = queued?.submissionId ?? id;
      let boundId: string | null = null;
      const boundCurrent = async () => current() && (!boundId || await readCaptureCache<string>(actor, 'current_submission_id') === boundId);
      const save = async <T,>(key: CaptureStorageKey, value: T) => {
        if (!await boundCurrent()) throw new Error('Capture changed');
        await writeCaptureCache(actor, key, value);
      };
      const remove = async (key: CaptureStorageKey) => {
        if (await boundCurrent()) await removeCaptureCache(actor, key);
      };
      const checkOwner = async (target: string) => {
        const row = await client.query(api.submissions.getById, { id: target as Id<'submissions'> });
        return current() && row?.creatorId === actor ? row : null;
      };
      let submission: Doc<'submissions'> | null = null;
      if (info) {
        if (Date.now() - info.savedAt > 7 * 24 * 60 * 60 * 1000) return;
        if (info.existingDraftId) {
          id = info.existingDraftId;
          submission = await checkOwner(id);
          if (!submission) return;
        } else {
          if (id && id !== 'offline_pending') {
            submission = await checkOwner(id);
            if (!submission || !sameCapture(submission, info)) return;
          } else {
            const candidate = await client.query(api.submissions.getDraftByCreatorId, { creatorId: actor });
            if (!current()) return;
            if (candidate) {
              if (candidate.creatorId !== actor || !sameCapture(candidate, info)) return;
              submission = candidate; id = candidate._id;
            } else {
              if (!current()) return;
              const initialPrice = validCapturePrice(info.initialSellPrice);
              id = await create({ creatorId: actor, ...info.formData,
                ...(initialPrice !== null ? { amount: initialPrice, creatorPayout: commissionFor(initialPrice) } : {}),
                ...(info.prospectLeadId ? { prospectLeadId: info.prospectLeadId as Id<'leads'> } : {}) });
              if (!current() || !id) return;
              submission = await checkOwner(id);
              if (!submission) return;
            }
          }
        }
      } else if (id && id !== 'offline_pending') submission = await checkOwner(id);
      if (!id || id === 'offline_pending' || !submission || !current()) return;
      const migration = !useScoped || info?.legacyMigration === true || legacyId === id;
      if (migration && (!legacyInfo || legacyInfo.creatorId === actor)) {
        info ??= legacyInfo && sameCapture(submission, legacyInfo) ? legacyInfo : null;
        photos ??= decode(legacyRaw[1]) as PendingPhotos | null;
        interview ??= decode(legacyRaw[2]) as PendingInterview | null;
        queued ??= decode(legacyRaw[3]) as QueuedSubmit | null;
      }
      const matches = (target: string) => target === id || (!!info && target === 'offline_pending');
      if ((photos && !matches(photos.submissionId)) || (interview && !matches(interview.submissionId))
        || (typeof queued === 'object' && queued && !matches(queued.submissionId))) return;
      if (!isEditableCaptureStatus(submission.status) && !queued) return;
      if (useScoped && await readCaptureCache<string>(actor, 'current_submission_id') !== scopedId) return;
      // Checkpoint the successful create first. A partial cache migration can
      // then be retried without creating another submission or losing media.
      if (info) {
        info = { ...info, existingDraftId: id, ...(!useScoped ? { legacyMigration: true } : {}) };
        await save('submission_pending_sync', info);
      }
      await save('current_submission_id', id);
      boundId = id;
      if (photos) { photos = { ...photos, submissionId: id }; await save('submission_pending_photos', photos); }
      if (interview) { interview = { ...interview, submissionId: id }; await save('submission_pending_interview', interview); }
      if (queued) { queued = typeof queued === 'object' ? { ...queued, submissionId: id } : { submissionId: id }; await save('submission_pending_submit', queued); }
      for (const key of META) {
        const part = await readCaptureCache<Record<string, unknown>>(actor, key);
        if (!current()) return;
        if (part && matches(String(part.submissionId))) await save(key, { ...part, submissionId: id });
      }
      if (info) {
        const previousSnapshot = await readCaptureCache<Record<string, unknown>>(actor, 'submission_snapshot');
        await save('submission_snapshot', { ...(previousSnapshot?.submissionId === id ? previousSnapshot : {}),
          ...info.formData, creatorId: actor, submissionId: id,
          ...(validCapturePrice(info.initialSellPrice) !== null ? { initialSellPrice: info.initialSellPrice } : {}) });
      }
      // Legacy globals are removed only after every matching part is copied to
      // the owned scope. Never touch another login's remaining global records.
      if (migration && (!legacyInfo || legacyInfo.creatorId === actor)) {
        for (let index = 0; index < PARTS.length; index++) {
          if (!current()) return;
          const raw = legacyRaw[index];
          if (raw != null && await AsyncStorage.getItem(PARTS[index]) === raw) await AsyncStorage.removeItem(PARTS[index]);
        }
        if (current() && legacyId != null && await AsyncStorage.getItem('current_submission_id') === legacyId)
          await AsyncStorage.removeItem('current_submission_id');
      }
      const finishSent = async () => {
        await save('submission_last_sent', { submissionId: id, queued: false, sentAt: Date.now(), businessName: submission?.businessName });
        for (const key of ['submission_pending_sync', 'submission_draft_form', 'submission_pending_photos', 'submission_pending_interview',
          'submission_photo_tasks', 'submission_interview_draft', 'submission_snapshot', 'submission_pending_submit', 'submission_progress'] as const) await remove(key);
        const savedDesign = await readCaptureCache<CaptureDesignDraft>(actor, 'submission_design');
        if (await boundCurrent() && savedDesign?.submissionId === id) await remove('submission_design');
        const savedPhotoReview = await readCaptureCache<unknown>(actor, 'submission_photo_review');
        if (await boundCurrent() && capturePhotoReviewFor(savedPhotoReview, id!)) await remove('submission_photo_review');
        await remove('current_submission_id');
      };
      if (!isEditableCaptureStatus(submission.status)) {
        // The server accepted a previous submit whose local cleanup failed.
        // Do not re-price, edit or re-submit an already-sent capture.
        if (queued) await finishSent();
        return;
      }
      const synced: string[] = [];
      const photoChangesBlocked = async (baseline: unknown) => {
        const draft = await readCaptureCache<unknown>(actor, 'submission_photo_tasks');
        if (!await boundCurrent()) return true;
        if (!capturePhotosNeedSave(draft, id!, baseline)) { photoChangesWarning.current = null; return false; }
        const warning = `${actor}:${id}`;
        if (photoChangesWarning.current !== warning) {
          photoChangesWarning.current = warning;
          Alert.alert('Save your photo changes', 'Open Photos and save your latest changes before sending. Your capture and interview are saved.');
        }
        return true;
      };
      const interviewChangesBlocked = async (baseline: unknown, expectedPending?: PendingInterview) => {
        const [draft, pending] = await Promise.all([
          readCaptureCache<unknown>(actor, 'submission_interview_draft'),
          readCaptureCache<unknown>(actor, 'submission_pending_interview'),
        ]);
        if (!await boundCurrent()) return true;
        if (!captureInterviewNeedsSave(draft, id!, pending, baseline)
          && (!expectedPending || (pending !== null && typeof pending === 'object'
            && (pending as { submissionId?: string }).submissionId === id && !captureInterviewNeedsSave(expectedPending, id!, pending)))) {
          interviewChangesWarning.current = null; return false;
        }
        const warning = `${actor}:${id}`;
        if (interviewChangesWarning.current !== warning) {
          interviewChangesWarning.current = warning;
          Alert.alert('Save your interview changes', 'Open Interview and save your latest take before sending. Your recording stays on this phone.');
        }
        return true;
      };
      if (info) {
        if (!await boundCurrent()) return;
        await update({ id: id as Id<'submissions'>, ...info.formData,
          ...(info.prospectLeadId ? { prospectLeadId: info.prospectLeadId as Id<'leads'> } : {}) });
        if (!await boundCurrent()) return;
        await remove('submission_pending_sync');
        // The agent may have edited Info again after queuing these details.
        // Syncing the older payload must not erase those unsaved local changes.
        const localForm = await readCaptureCache<Record<string, unknown>>(actor, 'submission_draft_form');
        const sentForm = { ...info.formData, prospectLeadId: info.prospectLeadId };
        if (localForm?.submissionId === id && ['businessName', 'businessType', 'ownerName', 'ownerPhone', 'ownerEmail',
          'address', 'city', 'coordinates', 'prospectLeadId'].every(key =>
          JSON.stringify(localForm[key] ?? null) === JSON.stringify(sentForm[key as keyof typeof sentForm] ?? null))) {
          await remove('submission_draft_form');
        }
        synced.push('shop details');
      }
      const upload = async (uri: string, folder: string, filename: string, contentType: string) => {
        if (!await boundCurrent()) throw new Error('Capture account changed');
        const target = await uploadTarget({ folder, filename, contentType });
        if (!await boundCurrent()) throw new Error('Capture account changed');
        const local = await fetch(uri.startsWith('/') ? `file://${uri}` : uri);
        const body = await local.blob();
        if (!await boundCurrent()) throw new Error('Capture account changed');
        const result = await fetch(target.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
        if (!result.ok) throw new Error('Upload failed. Your capture is saved for retry.');
        if (!await boundCurrent()) throw new Error('Capture account changed');
        return target.fileKey;
      };
      if (photos) {
        if (await photoChangesBlocked(photos)) return;
        const entries: PhotoEntry[] = photos.entries ?? photos.photoUris.map((uri, index) => ({ id: `legacy-${index}`, uri }));
        for (const entry of entries) {
          if (!entry.storageId) {
            if (await photoChangesBlocked(photos)) return;
            entry.storageId = await upload(entry.uri, 'images', `photo-${entry.id}.jpg`, 'image/jpeg');
            photos = { ...photos, entries }; await save('submission_pending_photos', photos);
            const meta = await readCaptureCache<{ submissionId: string; items: PhotoEntry[] }>(actor, 'submission_photo_tasks');
            if (meta?.submissionId === id) await save('submission_photo_tasks', { ...meta,
              items: meta.items.map(item => item.id === entry.id ? { ...item, storageId: entry.storageId } : item) });
          }
        }
        const finalPhotos = [...new Set([...(photos.existingPhotos ?? []), ...entries.map(entry => entry.storageId!)])];
        if (finalPhotos.length < 3 || finalPhotos.length > 10 || !await boundCurrent()) return;
        if (await photoChangesBlocked(photos)) return;
        await update({ id: id as Id<'submissions'>, photos: finalPhotos });
        if (!await boundCurrent()) return;
        await remove('submission_pending_photos'); synced.push('photos');
      }
      if (interview) {
        if (await interviewChangesBlocked(submission, interview)) return;
        if (!interview.storageId) {
          interview.storageId = await upload(interview.recordingUri, interview.type === 'video' ? 'videos' : 'audio',
            interview.type === 'video' ? 'interview.mp4' : 'interview.m4a', interview.type === 'video' ? 'video/mp4' : 'audio/m4a');
          if (await interviewChangesBlocked(submission, interview)) return;
          await save('submission_pending_interview', interview);
        }
        if (interview.type === 'video' && interview.parallelAudioUri && !interview.audioStorageId) {
          interview.audioStorageId = await upload(interview.parallelAudioUri, 'audio', 'interview-audio.m4a', 'audio/m4a');
          if (await interviewChangesBlocked(submission, interview)) return;
          await save('submission_pending_interview', interview);
        }
        if (!await boundCurrent() || await interviewChangesBlocked(submission, interview)) return;
        await update({ id: id as Id<'submissions'>,
          ...(interview.type === 'video' ? { videoStorageId: interview.storageId, audioStorageId: interview.audioStorageId }
            : { audioStorageId: interview.storageId }) });
        if (!await boundCurrent() || await interviewChangesBlocked(submission, interview)) return;
        const previous = await readCaptureCache<Record<string, unknown>>(actor, 'submission_interview_draft');
        if (await interviewChangesBlocked(submission, interview)) return;
        await save('submission_interview_draft', { ...(previous?.submissionId === id ? previous : {}), ...interview, attached: true });
        await remove('submission_pending_interview'); synced.push('interview');
      }
      // Selecting a design does not request a submission. Only the final queued
      // choice may send; it also wins over a subsequently cached draft preview.
      const templateId = queued && typeof queued === 'object' && queued.templateId !== undefined
        ? queued.templateId : design && matches(design.submissionId) ? design.templateId : undefined;
      const photoReviewBlocked = async (businessType: string, savedPhotos: unknown, savedInterview: unknown) => {
        const marker = await readCaptureCache<unknown>(actor, 'submission_photo_review');
        if (!await boundCurrent()) return true;
        if (!needsCapturePhotoReview(marker, id!, businessType)) {
          photoReviewWarning.current = null;
          return await photoChangesBlocked(savedPhotos) || await interviewChangesBlocked(savedInterview);
        }
        const review = capturePhotoReviewFor(marker, id!);
        const warning = `${actor}:${id}:${review?.businessType}:${review?.requiredAt}`;
        if (photoReviewWarning.current !== warning) {
          photoReviewWarning.current = warning;
          Alert.alert('Review your photos', 'The business type changed. Open this capture and check the updated photo suggestions before sending. Your photos and interview are saved.');
        }
        return true;
      };
      if (queued && typeof queued === 'object' && await boundCurrent()) {
        // Re-read after syncing pending details and media: the initial row may
        // still have the old email, or another screen may have corrected it.
        const latest = await checkOwner(id);
        if (!latest || !await boundCurrent()) return;
        if (!isEditableCaptureStatus(latest.status)) {
          await finishSent();
          return;
        }
        if (await photoReviewBlocked(latest.businessType, latest.photos, latest)) return;
        const candidate = templateId ?? latest.templateId;
        if (candidate && !captureDesignMatchesBusinessType(latest.businessType, candidate)) {
          const warning = `${actor}:${id}:${latest.businessType}:${candidate}`;
          if (designWarning.current !== warning) {
            designWarning.current = warning;
            Alert.alert('Choose a matching design', 'The business type changed. Open this capture and choose a matching design before sending. Your details and media are saved.');
          }
          return;
        }
        designWarning.current = null;
        const emailError = captureEmailError(latest.ownerEmail);
        if (emailError) {
          const warningKey = `${actor}:${id}:${emailError}`;
          if (emailWarning.current !== warningKey) {
            emailWarning.current = warningKey;
            Alert.alert('Email needed to send', `${emailError} Open About the shop to add or correct it. Your capture and media are saved.`, [{ text: 'OK' }]);
          }
          // Keep the queued choice and the owned draft for a later correction.
          // A draft/media sync must not turn an invalid legacy queue into Sent.
          return;
        }
        emailWarning.current = null;
        if (templateId !== undefined) {
          if (await photoReviewBlocked(latest.businessType, latest.photos, latest)) return;
          await chooseDesign({ id: id as Id<'submissions'>, templateId });
          if (!await boundCurrent()) return;
        }
        if (queued.sellPrice != null || queued.submissionType || queued.requestedDomain) {
          const submissionType = queued.submissionType ?? (latest.status === 'rejected' ? latest.submissionType : undefined) ?? 'standard';
          const requestedDomain = queued.requestedDomain ?? (latest.status === 'rejected' && submissionType === 'with_custom_domain' ? latest.requestedDomain : undefined);
          const unchanged = latest.status === 'rejected' && submissionType === (latest.submissionType ?? 'standard')
            && (requestedDomain ?? '') === (latest.requestedDomain ?? '')
            && (queued.sellPrice == null || queued.sellPrice + (latest.domainCostPHP ?? 0) === latest.amount)
            && (queued.domainPricePHP == null || queued.domainPricePHP === latest.domainCostPHP);
          if (!unchanged) {
            if (await photoReviewBlocked(latest.businessType, latest.photos, latest)) return;
            await setTier({ id: id as Id<'submissions'>, submissionType,
              sellPrice: queued.sellPrice, requestedDomain, domainPricePHP: queued.domainPricePHP });
          }
        }
        if (!await boundCurrent() || await photoReviewBlocked(latest.businessType, latest.photos, latest)) return;
        await submit({ id: id as Id<'submissions'> });
        if (!await boundCurrent()) return;
        await finishSent(); synced.push('submission');
      } else if (templateId !== undefined && await boundCurrent()) {
        const latest = await checkOwner(id);
        if (!latest || !isEditableCaptureStatus(latest.status) || !await boundCurrent()) return;
        if (await photoReviewBlocked(latest.businessType, latest.photos, latest)) return;
        if (!captureDesignMatchesBusinessType(latest.businessType, templateId)) return;
        if (latest.templateId !== templateId) {
          await chooseDesign({ id: id as Id<'submissions'>, templateId });
          if (!await boundCurrent()) return;
          synced.push('design');
        }
      }
      if (await boundCurrent() && synced.length) Alert.alert('Capture synced', `Your ${synced.join(', ')} are saved.`, [{ text: 'OK' }]);
    } catch (error) {
      console.warn('[OfflineSync] Capture retained for retry:', error instanceof Error ? error.message : 'Sync failed');
    } finally { busy.current = false; }
  }, [creatorId, client, create, update, submit, setTier, chooseDesign, uploadTarget]);
  useEffect(() => {
    if (isConnected && enabled) {
      const timer = setTimeout(() => { void attemptSync(); }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, enabled, attemptSync]);
  return { attemptSync };
}
