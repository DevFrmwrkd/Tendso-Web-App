import type { CaptureStorageKey } from './captureSession';

export const CAPTURE_RESUME_KEYS = [
  'current_submission_id', 'submission_pending_sync', 'submission_pending_photos',
  'submission_pending_interview', 'submission_pending_submit', 'submission_photo_tasks',
  'submission_interview_draft', 'submission_draft_form', 'submission_design',
] as const satisfies readonly CaptureStorageKey[];

type Cache = Partial<Record<CaptureStorageKey, unknown>>;
const record = (value: unknown): Record<string, any> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;

/** A single active cache must not strand another shop's unsynced corrections. */
export function hasOtherCaptureWork(targetId: string, cache: Cache): boolean {
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
