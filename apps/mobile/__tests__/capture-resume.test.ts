import { activeCaptureId, captureResumeStep, captureProgressFor, hasOtherCaptureWork,
  type CaptureResumeCache } from '../services/captureResume';

const activeId = 'a'.repeat(24);
const otherId = 'b'.repeat(24);
const creatorId = 'agent-mika';
const server = { _id: activeId, creatorId, status: 'draft', photos: ['one', 'two', 'three'] };

it('chooses the active pointer ahead of unrelated form/progress data and recovers only owned offline info', () => {
  expect(activeCaptureId({ current_submission_id: activeId, submission_draft_form: { businessName: 'Another shop' },
    submission_progress: { submissionId: otherId, step: 'review', savedAt: 1 } }, creatorId)).toBe(activeId);
  expect(activeCaptureId({ submission_pending_sync: { creatorId, formData: {} } }, creatorId)).toBe('offline_pending');
  expect(activeCaptureId({ submission_pending_sync: { creatorId, existingDraftId: activeId, formData: {} } }, creatorId)).toBe(activeId);
  expect(activeCaptureId({ current_submission_id: 'bad-id', submission_pending_sync: { creatorId: 'other', formData: {} } }, creatorId)).toBeNull();
  expect(activeCaptureId({ submission_draft_form: { businessName: 'Shop' }, submission_progress: { submissionId: activeId } }, creatorId)).toBeNull();
});

it('recovers only meaningful recent tagged forms when the pointer is missing, ahead of newest-server fallback', () => {
  const form = { submissionId: activeId, businessName: 'Saved shop', savedAt: Date.now() };
  expect(activeCaptureId({ submission_draft_form: form }, creatorId)).toBe(activeId);
  expect(activeCaptureId({ submission_draft_form: { ...form, submissionId: 'offline_pending' } }, creatorId)).toBe('offline_pending');
  expect(activeCaptureId({ submission_draft_form: { ...form, submissionId: undefined } }, creatorId)).toBeNull();
  expect(activeCaptureId({ submission_draft_form: { ...form, businessName: '  ' } }, creatorId)).toBeNull();
  for (const savedAt of [NaN, Infinity, Date.now() + 60_000, Date.now() - 8 * 24 * 60 * 60 * 1000]) {
    expect(activeCaptureId({ submission_draft_form: { ...form, savedAt } }, creatorId)).toBeNull();
  }
});

it.each([false, true])('does not revive a stale form behind a sent/queued receipt (queued=%s)', queued => {
  const savedAt = Date.now() - 1000;
  for (const submissionId of [activeId, 'offline_pending']) {
    expect(activeCaptureId({ submission_draft_form: { submissionId, businessName: 'Old shop', savedAt },
      submission_last_sent: { submissionId, queued, sentAt: savedAt + 100 } }, creatorId)).toBeNull();
  }
  expect(activeCaptureId({ submission_draft_form: { submissionId: 'offline_pending', businessName: 'New shop', savedAt: savedAt + 200 },
    submission_last_sent: { submissionId: 'offline_pending', queued, sentAt: savedAt + 100 } }, creatorId)).toBe('offline_pending');
});

it.each(['info', 'photos', 'interview', 'design', 'review'] as const)('restores the exact persisted %s step', step => {
  const cache: CaptureResumeCache = { submission_progress: { submissionId: activeId, step, savedAt: 1 } };
  expect(captureResumeStep(activeId, creatorId, cache, server)).toBe(step);
});

it('does not restore another capture or malformed progress, and rejected corrections resume review', () => {
  expect(captureProgressFor({ submissionId: otherId, step: 'review', savedAt: 1 }, activeId)).toBeNull();
  expect(captureProgressFor({ submissionId: activeId, step: 'success', savedAt: 1 }, activeId)).toBeNull();
  expect(captureProgressFor({ submissionId: activeId, step: 'review', savedAt: NaN }, activeId)).toBeNull();
  expect(captureResumeStep(activeId, creatorId, { submission_progress: { submissionId: activeId, step: 'info', savedAt: 1 } },
    { ...server, status: 'rejected' })).toBe('review');
});

it('derives the first incomplete step for older drafts without progress metadata', () => {
  expect(captureResumeStep(activeId, creatorId, {}, { ...server, photos: [] })).toBe('photos');
  expect(captureResumeStep(activeId, creatorId, {}, server)).toBe('interview');
  expect(captureResumeStep(activeId, creatorId, {}, { ...server, videoStorageId: 'video' })).toBe('design');
  expect(captureResumeStep(activeId, creatorId, {}, { ...server, audioStorageId: 'audio', templateId: 'barbershop:F' })).toBe('review');
  expect(captureResumeStep(activeId, creatorId, { submission_photo_tasks: { submissionId: activeId,
    items: [{ uri: 'file://unsynced' }] } }, { ...server, videoStorageId: 'video' })).toBe('photos');
  expect(captureResumeStep(activeId, creatorId, { submission_interview_draft: { submissionId: activeId,
    recordingUri: 'file://replacement', attached: false } }, { ...server, videoStorageId: 'old-video' })).toBe('interview');
});

it('derives offline progress from only the target’s queued attachments and snapshot', () => {
  const cache: CaptureResumeCache = { submission_pending_sync: { creatorId, formData: {} },
    submission_pending_photos: { submissionId: 'offline_pending', photoUris: ['file://one', 'file://two', 'file://three'] },
    submission_pending_interview: { submissionId: 'offline_pending', recordingUri: 'file://voice' },
    submission_design: { submissionId: 'offline_pending', templateId: 'foodcraft:AL' } };
  expect(captureResumeStep('offline_pending', creatorId, cache)).toBe('review');
  expect(captureResumeStep('offline_pending', creatorId, { ...cache, submission_pending_photos: { submissionId: otherId, photoUris: ['1', '2', '3'] } })).toBe('photos');
  expect(captureResumeStep(activeId, creatorId, { submission_snapshot: { ...server, submissionId: activeId, audioStorageId: 'audio' } })).toBe('design');
});

it('keeps legacy photo edits ahead of a stale queued-photo record', () => {
  const info = { creatorId, formData: {} };
  const items = ['file://one', 'file://two', 'file://three'].map(uri => ({ uri }));
  const cache: CaptureResumeCache = { submission_pending_sync: info,
    submission_pending_photos: { submissionId: 'offline_pending', entries: items },
    submission_photo_tasks: { submissionId: 'offline_pending', items } };
  expect(captureResumeStep('offline_pending', creatorId, cache)).toBe('interview');
  expect(captureResumeStep('offline_pending', creatorId, { ...cache,
    submission_photo_tasks: { submissionId: 'offline_pending', items: [...items.slice(0, 2), { uri: 'file://replacement' }] } })).toBe('photos');
  expect(captureResumeStep('offline_pending', creatorId, { ...cache,
    submission_photo_tasks: { submissionId: 'offline_pending', items: items.slice(0, 2) } })).toBe('photos');
});

it('allows another ordinary server draft without erasing its record or requiring a new submission', () => {
  expect(hasOtherCaptureWork('rejected', { current_submission_id: 'another-draft',
    submission_photo_tasks: { submissionId: 'another-draft', items: [{ storageId: 'saved-photo' }] },
    submission_interview_draft: { submissionId: 'another-draft', recordingUri: 'local-file', attached: true },
  })).toBe(false);
});

it.each([
  { submission_pending_sync: { existingDraftId: 'other', formData: { businessName: 'Unsynced shop' } } },
  { submission_pending_sync: { formData: { businessName: 'New offline shop' } } },
  { submission_pending_photos: { submissionId: 'other', photoUris: ['file://photo'] } },
  { submission_pending_interview: { submissionId: 'other', recordingUri: 'file://interview' } },
  { submission_pending_submit: { submissionId: 'other', sellPrice: 2499 } },
  { current_submission_id: 'other', submission_pending_submit: true },
  { submission_photo_tasks: { submissionId: 'other', items: [{ uri: 'file://unsynced-photo' }] } },
  { submission_photo_tasks: { submissionId: 'other', items: [], removedExistingPhotos: ['old-photo'] } },
  { submission_interview_draft: { submissionId: 'other', recordingUri: 'file://interview', attached: false } },
  { current_submission_id: 'other', submission_draft_form: { businessName: 'Unsaved shop' } },
  { current_submission_id: 'other', submission_design: { submissionId: 'other', templateId: 'generic:A' } },
])('protects another capture’s local work: %o', cache => {
  expect(hasOtherCaptureWork('rejected', cache)).toBe(true);
});

it('does not treat a completed capture’s leftover design metadata as active unsaved work', () => {
  expect(hasOtherCaptureWork('rejected', { submission_design: { submissionId: 'completed', templateId: 'generic:A' } })).toBe(false);
});

it('continues the same rejected capture with its own local corrections intact', () => {
  expect(hasOtherCaptureWork('rejected', { current_submission_id: 'rejected',
    submission_pending_sync: { existingDraftId: 'rejected' },
    submission_pending_photos: { submissionId: 'rejected' }, submission_pending_interview: { submissionId: 'rejected' },
    submission_pending_submit: { submissionId: 'rejected' },
    submission_photo_tasks: { submissionId: 'rejected', items: [{ uri: 'file://replacement' }] },
    submission_interview_draft: { submissionId: 'rejected', recordingUri: 'file://interview' },
    submission_draft_form: { businessName: 'Corrected name' },
    submission_design: { submissionId: 'rejected', templateId: 'generic:A' },
  })).toBe(false);
});
