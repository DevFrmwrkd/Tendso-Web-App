import { captureInterviewNeedsSave } from '../services/captureInterviewChanges';

const draft = { submissionId: 'shop', type: 'video', recordingUri: 'file://new.mp4', parallelAudioUri: 'file://new.m4a' };
it('requires saving a new take even when the shop already has an older interview', () => {
  expect(captureInterviewNeedsSave(draft, 'shop', null, { videoStorageId: 'old-video' })).toBe(true);
});
it('accepts the same take already saved in this capture’s upload queue', () => {
  expect(captureInterviewNeedsSave(draft, 'shop', { ...draft, storageId: 'uploaded' })).toBe(false);
});
it('preserves a legacy queue’s additional audio when old metadata omitted the parallel field', () => {
  const { parallelAudioUri: _unused, ...legacy } = draft;
  expect(captureInterviewNeedsSave(legacy, 'shop', draft)).toBe(false);
});
it.each([{ recordingUri: 'file://older.mp4' }, { parallelAudioUri: 'file://older.m4a' }, { type: 'audio' }, { submissionId: 'other' }])(
  'rejects an older or different queued interview: %j', changed => {
    expect(captureInterviewNeedsSave(draft, 'shop', { ...draft, ...changed })).toBe(true);
  });
it('compares confirmed primary and parallel media against the saved recording', () => {
  const attached = { ...draft, attached: true, storageId: 'video', audioStorageId: 'audio' };
  expect(captureInterviewNeedsSave(attached, 'shop', null, { videoStorageId: 'video', audioStorageId: 'audio' })).toBe(false);
  expect(captureInterviewNeedsSave(attached, 'shop', null, { videoStorageId: 'old', audioStorageId: 'audio' })).toBe(true);
  expect(captureInterviewNeedsSave(attached, 'shop', null, { videoStorageId: 'video', audioStorageId: 'old' })).toBe(true);
  expect(captureInterviewNeedsSave(attached, 'shop', null)).toBe(false);
});
it('accepts the confirmed voice-only source and ignores another capture’s metadata', () => {
  expect(captureInterviewNeedsSave({ ...draft, type: 'audio', attached: true, storageId: 'audio' }, 'shop', null,
    { audioStorageId: 'audio' })).toBe(false);
  expect(captureInterviewNeedsSave(draft, 'other', null)).toBe(false);
  expect(captureInterviewNeedsSave(null, 'shop', null)).toBe(false);
});
