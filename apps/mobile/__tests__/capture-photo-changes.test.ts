import { capturePhotosNeedSave } from '../services/capturePhotoChanges';

const id = 'my-capture';
const draft = (items: unknown[]) => ({ submissionId: id, items });

it('detects an unsaved deletion after remount even when enough photos remain', () => {
  expect(capturePhotosNeedSave(draft(['one', 'two', 'three'].map(storageId => ({ storageId }))), id,
    ['one', 'two', 'three', 'deleted'])).toBe(true);
});

it('detects same-count replacements instead of checking only the photo count', () => {
  expect(capturePhotosNeedSave(draft([{ storageId: 'one' }, { storageId: 'two' }, { uri: 'file://replacement' }]), id,
    ['one', 'two', 'old-three'])).toBe(true);
});

it('ignores labels, ordering and duplicate references to the same saved photo', () => {
  expect(capturePhotosNeedSave(draft([{ storageId: 'two', label: 'New title' }, { storageId: 'one', uri: 'file://original' },
    { storageId: 'one' }]), id, ['one', 'two'])).toBe(false);
});

it('compares the complete queued selection, preferring upload checkpoints over stale local URIs', () => {
  const pending = { submissionId: id, existingPhotos: ['one', 'two'],
    entries: [{ storageId: 'new-three', uri: 'file://three' }], photoUris: ['file://stale-three'] };
  expect(capturePhotosNeedSave(draft([{ storageId: 'one' }, { storageId: 'two' }, { storageId: 'new-three' }]), id, pending)).toBe(false);
  expect(capturePhotosNeedSave(draft([{ storageId: 'one' }, { storageId: 'new-three' }]), id, pending)).toBe(true);
});

it('supports old queues without entries while detecting unqueued additions', () => {
  const pending = { submissionId: id, existingPhotos: ['one'], photoUris: ['file://two'] };
  expect(capturePhotosNeedSave(draft([{ storageId: 'one' }, { uri: 'file://two' }]), id, pending)).toBe(false);
  expect(capturePhotosNeedSave(draft([{ uri: 'file://new-photo' }]), id, undefined)).toBe(true);
});

it('ignores malformed and foreign capture records', () => {
  for (const value of [null, {}, { submissionId: id }, draft([{}]), { submissionId: 'other', items: [] }])
    expect(capturePhotosNeedSave(value, id, ['one'])).toBe(false);
  expect(capturePhotosNeedSave(draft([]), id, { submissionId: 'other', existingPhotos: ['one'] })).toBe(false);
});
