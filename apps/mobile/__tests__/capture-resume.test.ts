import { hasOtherCaptureWork } from '../services/captureResume';

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
