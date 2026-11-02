import type { CaptureStorageKey } from './captureSession';
import { looksLikeConvexId } from './prospectPrefill';
import { MIN_PHOTOS } from '../lib/v2/captureContent';
import { validCaptureDesignCode } from '../../../lib/captureDesign';
import { capturePhotoReviewFor, needsCapturePhotoReview } from './capturePhotoReview';
import { capturePhotosNeedSave } from './capturePhotoChanges';

export const CAPTURE_RESUME_KEYS = [
  'current_submission_id', 'submission_pending_sync', 'submission_pending_photos',
  'submission_pending_interview', 'submission_pending_submit', 'submission_photo_tasks',
  'submission_interview_draft', 'submission_draft_form', 'submission_design',
  'submission_snapshot', 'submission_progress', 'submission_last_sent', 'submission_photo_review',
] as const satisfies readonly CaptureStorageKey[];

export type CaptureResumeCache = Partial<Record<CaptureStorageKey, unknown>>;
type Cache = CaptureResumeCache;
const record = (value: unknown): Record<string, any> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;

export const CAPTURE_STEPS = ['info', 'photos', 'interview', 'design', 'review'] as const;
export type CaptureStep = typeof CAPTURE_STEPS[number];
export type CaptureProgress = { submissionId: string; step: CaptureStep; savedAt: number };

export function validCaptureResumeId(value: unknown): string | null {
  return typeof value === 'string' && (value === 'offline_pending' || looksLikeConvexId(value)) ? value : null;
}

/** Never use an untagged form or stale progress record to select a different shop. */
export function activeCaptureId(cache: CaptureResumeCache, creatorId: string): string | null {
  const pointer = validCaptureResumeId(cache.current_submission_id);
  if (pointer) return pointer;
  const pending = record(cache.submission_pending_sync);
  if (pending?.creatorId === creatorId && record(pending.formData)) {
    return pending.existingDraftId == null ? 'offline_pending' : validCaptureResumeId(pending.existingDraftId);
  }
  const form = record(cache.submission_draft_form);
  const formId = validCaptureResumeId(form?.submissionId);
  const age = typeof form?.savedAt === 'number' ? Date.now() - form.savedAt : NaN;
  if (!formId || !Number.isFinite(age) || age < 0 || age > 7 * 24 * 60 * 60 * 1000
    || !['businessName', 'ownerName', 'ownerPhone', 'ownerEmail', 'address', 'city']
      .some(key => typeof form?.[key] === 'string' && form[key].trim())) return null;
  const sent = record(cache.submission_last_sent);
  if (sent?.submissionId === formId && (formId !== 'offline_pending'
    || typeof sent.sentAt !== 'number' || !Number.isFinite(sent.sentAt) || form!.savedAt <= sent.sentAt)) return null;
  return formId;
}

export function captureProgressFor(value: unknown, submissionId: string): CaptureProgress | null {
  const progress = record(value);
  return progress?.submissionId === submissionId && CAPTURE_STEPS.includes(progress.step)
    && typeof progress.savedAt === 'number' && Number.isFinite(progress.savedAt)
    ? progress as CaptureProgress : null;
}

/** Server authorization is checked by the entry route; this only picks a local screen. */
export function captureResumeStep(submissionId: string, creatorId: string, cache: CaptureResumeCache,
  server?: Record<string, any> | null): CaptureStep {
  const snapshot = record(cache.submission_snapshot);
  const saved = snapshot?.submissionId === submissionId && snapshot.creatorId === creatorId ? snapshot : null;
  const submission = server?.creatorId === creatorId && server._id === submissionId ? server : saved;
  const matching = (key: CaptureStorageKey) => {
    const value = record(cache[key]);
    return value?.submissionId === submissionId ? value : null;
  };
  const pendingInfo = record(cache.submission_pending_sync);
  const ownInfo = pendingInfo?.creatorId === creatorId && (submissionId === 'offline_pending'
    ? pendingInfo.existingDraftId == null || pendingInfo.existingDraftId === 'offline_pending'
    : pendingInfo.existingDraftId === submissionId) ? pendingInfo : null;
  const form = matching('submission_draft_form');
  const businessType = ownInfo?.formData?.businessType ?? form?.businessType ?? submission?.businessType;
  if (needsCapturePhotoReview(cache.submission_photo_review, submissionId, businessType)) return 'photos';
  const photos = matching('submission_pending_photos');
  const photoDraft = matching('submission_photo_tasks');
  if (capturePhotosNeedSave(photoDraft, submissionId, photos ?? submission?.photos)) return 'photos';
  if (submission?.status === 'rejected') return 'review';
  const progress = captureProgressFor(cache.submission_progress, submissionId);
  if (progress) return progress.step;
  if (!submission && !ownInfo) return matching('submission_photo_tasks') ? 'photos' : 'info';
  if (!photos && (photoDraft?.removedExistingPhotos?.length || photoDraft?.items?.some((item: any) => item?.uri && !item.storageId))) return 'photos';
  const photoCount = Array.isArray(submission?.photos) ? submission.photos.filter((key: unknown) => typeof key === 'string' && key).length : 0;
  const queuedPhotos = photos ? new Set([
    ...(Array.isArray(photos.existingPhotos) ? photos.existingPhotos : []),
    ...(Array.isArray(photos.photoUris) ? photos.photoUris : []),
    ...(Array.isArray(photos.entries) ? photos.entries.map((item: any) => item?.storageId || item?.uri) : []),
  ].filter((key: unknown) => typeof key === 'string' && key)).size : 0;
  if (photoCount < MIN_PHOTOS && queuedPhotos < MIN_PHOTOS) return 'photos';
  const pendingInterview = matching('submission_pending_interview');
  const interview = matching('submission_interview_draft');
  if (!pendingInterview && interview?.recordingUri && !interview.attached) return 'interview';
  const hasInterview = submission?.videoStorageId || submission?.audioStorageId
    || pendingInterview?.recordingUri || (interview?.attached && (interview.storageId || interview.audioStorageId));
  if (!hasInterview) return 'interview';
  const design = matching('submission_design');
  const queued = matching('submission_pending_submit');
  return validCaptureDesignCode(queued?.templateId) || validCaptureDesignCode(design?.templateId)
    || validCaptureDesignCode(submission?.templateId) ? 'review' : 'design';
}

/** A single active cache must not strand another shop's unsynced corrections. */
export function hasOtherCaptureWork(targetId: string, cache: Cache): boolean {
  const review = record(cache.submission_photo_review);
  const photoReview = typeof review?.submissionId === 'string' ? capturePhotoReviewFor(review, review.submissionId) : null;
  if (photoReview && photoReview.submissionId !== targetId
    && needsCapturePhotoReview(photoReview, photoReview.submissionId, photoReview.businessType)) return true;
  const info = record(cache.submission_pending_sync);
  if (info && info.existingDraftId !== targetId) return true;
  for (const key of ['submission_pending_photos', 'submission_pending_interview', 'submission_pending_submit'] as const) {
    const pending = record(cache[key]);
    if (cache[key] && (pending ? pending.submissionId : cache.current_submission_id) !== targetId) return true;
  }
  const photos = record(cache.submission_photo_tasks);
  if (photos && photos.submissionId !== targetId && (
    photos.removedExistingPhotos?.length > 0 || photos.items?.some((item: any) => item?.uri && !item.storageId)
  )) return true;
  const interview = record(cache.submission_interview_draft);
  if (interview && interview.submissionId !== targetId && interview.recordingUri && !interview.attached) return true;
  const form = record(cache.submission_draft_form);
  if (cache.current_submission_id !== targetId && form && ['businessName', 'ownerName', 'ownerPhone', 'ownerEmail', 'address', 'city']
    .some(key => typeof form[key] === 'string' && form[key].trim())) return true;
  const design = record(cache.submission_design);
  return !!design && design.submissionId !== targetId && cache.current_submission_id === design.submissionId && !!design.templateId;
}
