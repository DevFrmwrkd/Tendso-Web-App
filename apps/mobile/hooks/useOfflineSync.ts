import { useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useAction, useConvex } from 'convex/react';
import { api, type Doc, type Id } from '@tendso/convex-client';
import { useNetwork } from '../providers/NetworkProvider';
import { readCaptureCache, writeCaptureCache, removeCaptureCache, type CaptureStorageKey } from '../services/captureSession';

type Info = { businessName: string; businessType: string; ownerName: string; ownerPhone: string; ownerEmail?: string; address: string; city: string };
type PendingInfo = { formData: Info; creatorId: string; existingDraftId?: string | null; prospectLeadId?: string; savedAt: number; legacyMigration?: boolean };
type PhotoEntry = { id: string; uri: string; storageId?: string; taskIndex?: number };
type PendingPhotos = { submissionId: string; photoUris: string[]; existingPhotos: string[]; entries?: PhotoEntry[]; savedAt?: number };
type PendingInterview = { submissionId: string; recordingUri: string; parallelAudioUri?: string | null; type: 'video' | 'audio'; storageId?: string; audioStorageId?: string; savedAt?: number };
type SubmitChoice = { submissionId: string; sellPrice?: number; submissionType?: 'standard' | 'with_custom_domain'; requestedDomain?: string; domainPricePHP?: number; savedAt?: number };
type QueuedSubmit = boolean | SubmitChoice;
const PARTS = ['submission_pending_sync', 'submission_pending_photos', 'submission_pending_interview', 'submission_pending_submit'] as const;
const META = ['submission_photo_tasks', 'submission_interview_draft', 'submission_snapshot'] as const;
const clean = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';

/** Recover a response lost after create without reusing another business's draft. */
function sameCapture(row: Doc<'submissions'>, info: PendingInfo) {
  return ['businessName', 'businessType', 'ownerName', 'ownerPhone', 'ownerEmail', 'address', 'city']
    .every(key => clean(row[key as keyof Doc<'submissions'>]) === clean(info.formData[key as keyof Info]))
    && (row.prospectLeadId ?? null) === (info.prospectLeadId ?? null);
}

export function useOfflineSync({ enabled = true, creatorId }: { enabled?: boolean; creatorId?: Id<'creators'> } = {}) {
  const { isConnected } = useNetwork();
  const client = useConvex();
  const create = useMutation(api.submissions.create);
  const update = useMutation(api.submissions.update);
  const submit = useMutation(api.submissions.submit);
  const setTier = useMutation(api.submissions.setDomainTier);
  const uploadTarget = useAction(api.r2.generateUploadUrl);
  const busy = useRef(false);
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
      const scoped = await Promise.all(PARTS.map(key => readCaptureCache<unknown>(actor, key)));
      const [scopedId, legacyId, ...legacyRaw] = await Promise.all([
        readCaptureCache<string>(actor, 'current_submission_id'), AsyncStorage.getItem('current_submission_id'),
        ...PARTS.map(key => AsyncStorage.getItem(key)),
      ]);
      if (!current()) return;
      const decode = (value: string | null | undefined) => { try { return value ? JSON.parse(value) : null; } catch { return null; } };
      const scopedInfo = scoped[0] as PendingInfo | null;
      const legacyInfo = decode(legacyRaw[0]) as PendingInfo | null;
      const useScoped = !!scopedId || scoped.some(Boolean);
      let info = useScoped ? scopedInfo : legacyInfo;
      let photos = (useScoped ? scoped[1] : decode(legacyRaw[1])) as PendingPhotos | null;
      let interview = (useScoped ? scoped[2] : decode(legacyRaw[2])) as PendingInterview | null;
      let queued = (useScoped ? scoped[3] : decode(legacyRaw[3])) as QueuedSubmit | null;
      if (!info && !photos && !interview && !queued) return;
      if (info && info.creatorId !== actor) return;
      let id = scopedId ?? (useScoped ? null : legacyId);
      if ((!id || id === 'offline_pending') && typeof queued === 'object' && queued?.submissionId !== 'offline_pending') id = queued?.submissionId ?? id;
      const save = async <T,>(key: CaptureStorageKey, value: T) => {
        if (!current()) throw new Error('Capture account changed');
        await writeCaptureCache(actor, key, value);
      };
      const remove = async (key: CaptureStorageKey) => {
        if (current()) await removeCaptureCache(actor, key);
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
              id = await create({ creatorId: actor, ...info.formData,
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
      if (submission.status !== 'draft' && !queued) return;
      // Checkpoint the successful create first. A partial cache migration can
      // then be retried without creating another submission or losing media.
      if (info) {
        info = { ...info, existingDraftId: id, ...(!useScoped ? { legacyMigration: true } : {}) };
        await save('submission_pending_sync', info);
      }
      await save('current_submission_id', id);
      if (photos) { photos = { ...photos, submissionId: id }; await save('submission_pending_photos', photos); }
      if (interview) { interview = { ...interview, submissionId: id }; await save('submission_pending_interview', interview); }
      if (queued) { queued = typeof queued === 'object' ? { ...queued, submissionId: id } : { submissionId: id }; await save('submission_pending_submit', queued); }
      for (const key of META) {
        const part = await readCaptureCache<Record<string, unknown>>(actor, key);
        if (!current()) return;
        if (part && matches(String(part.submissionId))) await save(key, { ...part, submissionId: id });
      }
      if (info) await save('submission_snapshot', { ...info.formData, creatorId: actor, submissionId: id });
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
          'submission_photo_tasks', 'submission_interview_draft', 'submission_snapshot', 'current_submission_id', 'submission_pending_submit'] as const) await remove(key);
      };
      if (submission.status !== 'draft') {
        // The server accepted a previous submit whose local cleanup failed.
        // Do not re-price, edit or re-submit an already-sent capture.
        if (queued) await finishSent();
        return;
      }
      const synced: string[] = [];
      if (info) {
        if (!current()) return;
        await update({ id: id as Id<'submissions'>, ...info.formData,
          ...(info.prospectLeadId ? { prospectLeadId: info.prospectLeadId as Id<'leads'> } : {}) });
        if (!current()) return;
        await remove('submission_pending_sync'); await remove('submission_draft_form'); synced.push('shop details');
      }
      const upload = async (uri: string, folder: string, filename: string, contentType: string) => {
        if (!current()) throw new Error('Capture account changed');
        const target = await uploadTarget({ folder, filename, contentType });
        if (!current()) throw new Error('Capture account changed');
        const local = await fetch(uri.startsWith('/') ? `file://${uri}` : uri);
        const body = await local.blob();
        if (!current()) throw new Error('Capture account changed');
        const result = await fetch(target.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
        if (!result.ok) throw new Error('Upload failed. Your capture is saved for retry.');
        if (!current()) throw new Error('Capture account changed');
        return target.fileKey;
      };
      if (photos) {
        const entries: PhotoEntry[] = photos.entries ?? photos.photoUris.map((uri, index) => ({ id: `legacy-${index}`, uri }));
        for (const entry of entries) {
          if (!entry.storageId) {
            entry.storageId = await upload(entry.uri, 'images', `photo-${entry.id}.jpg`, 'image/jpeg');
            photos = { ...photos, entries }; await save('submission_pending_photos', photos);
            const meta = await readCaptureCache<{ submissionId: string; items: PhotoEntry[] }>(actor, 'submission_photo_tasks');
            if (meta?.submissionId === id) await save('submission_photo_tasks', { ...meta,
              items: meta.items.map(item => item.id === entry.id ? { ...item, storageId: entry.storageId } : item) });
          }
        }
        const finalPhotos = [...new Set([...(photos.existingPhotos ?? []), ...entries.map(entry => entry.storageId!)])];
        if (finalPhotos.length < 3 || finalPhotos.length > 10 || !current()) return;
        await update({ id: id as Id<'submissions'>, photos: finalPhotos });
        if (!current()) return;
        await remove('submission_pending_photos'); synced.push('photos');
      }
      if (interview) {
        if (!interview.storageId) {
          interview.storageId = await upload(interview.recordingUri, interview.type === 'video' ? 'videos' : 'audio',
            interview.type === 'video' ? 'interview.mp4' : 'interview.m4a', interview.type === 'video' ? 'video/mp4' : 'audio/m4a');
          await save('submission_pending_interview', interview);
        }
        if (interview.type === 'video' && interview.parallelAudioUri && !interview.audioStorageId) {
          interview.audioStorageId = await upload(interview.parallelAudioUri, 'audio', 'interview-audio.m4a', 'audio/m4a');
          await save('submission_pending_interview', interview);
        }
        if (!current()) return;
        await update({ id: id as Id<'submissions'>,
          ...(interview.type === 'video' ? { videoStorageId: interview.storageId, audioStorageId: interview.audioStorageId }
            : { audioStorageId: interview.storageId }) });
        if (!current()) return;
        const previous = await readCaptureCache<Record<string, unknown>>(actor, 'submission_interview_draft');
        await save('submission_interview_draft', { ...(previous?.submissionId === id ? previous : {}), ...interview, attached: true });
        await remove('submission_pending_interview'); synced.push('interview');
      }
      if (queued && typeof queued === 'object' && current()) {
        if (queued.sellPrice != null || queued.submissionType || queued.requestedDomain) {
          await setTier({ id: id as Id<'submissions'>, submissionType: queued.submissionType ?? 'standard',
            sellPrice: queued.sellPrice, requestedDomain: queued.requestedDomain, domainPricePHP: queued.domainPricePHP });
        }
        if (!current()) return;
        await submit({ id: id as Id<'submissions'> });
        if (!current()) return;
        await finishSent(); synced.push('submission');
      }
      if (current() && synced.length) Alert.alert('Capture synced', `Your ${synced.join(', ')} are saved.`, [{ text: 'OK' }]);
    } catch (error) {
      console.warn('[OfflineSync] Capture retained for retry:', error instanceof Error ? error.message : 'Sync failed');
    } finally { busy.current = false; }
  }, [creatorId, client, create, update, submit, setTier, uploadTarget]);
  useEffect(() => {
    if (isConnected && enabled) {
      const timer = setTimeout(() => { void attemptSync(); }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, enabled, attemptSync]);
  return { attemptSync };
}