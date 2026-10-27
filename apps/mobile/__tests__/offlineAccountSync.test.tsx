import { Alert } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { captureStorageKey } from '../services/captureSession';
import type { Id } from '@tendso/convex-client';

const mockStorage = new Map<string, string>();
const mockRows = new Map<string, Record<string, unknown>>();
const mockMutation = jest.fn();
const mockUpload = jest.fn();
const mockQuery = jest.fn();
const mockFetch = jest.fn();
const mockClient = { query: mockQuery };
const mockCallbacks = Object.fromEntries(['create', 'update', 'submit', 'setDomainTier'].map(name =>
  [`submissions:${name}`, (args: unknown) => mockMutation(`submissions:${name}`, args)]));
const originalFetch = global.fetch;
let mockOnline = true;
jest.mock('@tendso/convex-client', () => ({ api: {
  submissions: { create: 'submissions:create', update: 'submissions:update', submit: 'submissions:submit',
    setDomainTier: 'submissions:setDomainTier', getById: 'submissions:getById', getDraftByCreatorId: 'submissions:getDraftByCreatorId' },
  r2: { generateUploadUrl: 'r2:generateUploadUrl' },
} }));
jest.mock('convex/react', () => ({
  useMutation: (reference: string) => mockCallbacks[reference], useAction: () => mockUpload, useConvex: () => mockClient,
}));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockOnline }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }),
}));

const creatorId = 'current-creator' as Id<'creators'>;
const formData = { businessName: 'Nena Shop', businessType: 'Restaurant', ownerName: 'Nena Cruz', ownerPhone: '9171234567',
  ownerEmail: 'nena@example.com', address: '12 Main Street', city: 'Marikina' };
const scoped = (key: Parameters<typeof captureStorageKey>[1], value: unknown) => mockStorage.set(captureStorageKey(creatorId, key), JSON.stringify(value));
const read = (key: Parameters<typeof captureStorageKey>[1]) => {
  const value = mockStorage.get(captureStorageKey(creatorId, key)); return value == null ? null : JSON.parse(value);
};
const row = (id = 'my-submission', patch: Record<string, unknown> = {}) => {
  const data = { _id: id, creatorId, status: 'draft', ...formData, ...patch }; mockRows.set(id, data); return data;
};
const info = (patch = {}) => ({ creatorId, formData, savedAt: Date.now(), ...patch });
const photos = (submissionId = 'my-submission') => ({ submissionId, photoUris: ['file://one.jpg', 'file://two.jpg', 'file://three.jpg'],
  existingPhotos: [], entries: [1, 2, 3].map(value => ({ id: `p${value}`, uri: `file://${value}.jpg` })) });
function defaultMutation(reference: string, args: Record<string, unknown>) {
  if (reference === 'submissions:create') {
    const id = `new-submission-${mockMutation.mock.calls.filter(([name]) => name === reference).length}`;
    mockRows.set(id, { _id: id, status: 'draft', ...args }); return id;
  }
  if (args.id && mockRows.has(String(args.id))) {
    const current = mockRows.get(String(args.id))!;
    mockRows.set(String(args.id), { ...current, ...args, ...(reference === 'submissions:submit' ? { status: 'submitted' } : {}) });
  }
  return undefined;
}
async function sync(result: { current: { attemptSync: () => Promise<void> } }) { await act(async () => { await result.current.attemptSync(); }); }

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockStorage.clear(); mockRows.clear(); mockOnline = true;
  mockQuery.mockReset().mockImplementation(async (reference: string, args: { id?: string; creatorId?: string }) =>
    reference === 'submissions:getDraftByCreatorId' ? [...mockRows.values()].find(value => value.creatorId === args.creatorId && value.status === 'draft') ?? null
      : mockRows.get(args.id ?? '') ?? null);
  mockMutation.mockReset().mockImplementation(defaultMutation);
  mockUpload.mockReset().mockImplementation(async ({ folder, filename }: { folder: string; filename: string }) =>
    ({ uploadUrl: `https://upload.example/${folder}/${filename}`, fileKey: `${folder}/${filename}` }));
  mockFetch.mockReset().mockImplementation(async (_url: string, options?: { method?: string }) =>
    options?.method === 'PUT' ? { ok: true } : { blob: async () => ({ bytes: 'media' }) });
  global.fetch = mockFetch;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); jest.useRealTimers(); });

it('does not sync when the live account is ineligible or foreground capture pauses sync', async () => {
  mockStorage.set('submission_pending_submit', 'true');
  const { result } = renderHook(() => useOfflineSync({ enabled: false, creatorId }));
  await sync(result);
  expect(mockQuery).not.toHaveBeenCalled(); expect(mockMutation).not.toHaveBeenCalled();
  expect(mockStorage.get('submission_pending_submit')).toBe('true');
});

it('retains another creator saved form without creating, migrating, or updating it', async () => {
  const pending = JSON.stringify(info({ creatorId: 'previous-creator' }));
  mockStorage.set('submission_pending_sync', pending);
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId }));
  await sync(result);
  expect(mockMutation).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  expect(mockStorage.get('submission_pending_sync')).toBe(pending); expect(read('submission_pending_sync')).toBeNull();
});

it('checks the stored submission owner before uploading or moving legacy photos', async () => {
  row('old-submission', { creatorId: 'previous-creator' });
  const pending = JSON.stringify(photos('old-submission'));
  mockStorage.set('current_submission_id', 'old-submission');
  mockStorage.set('submission_pending_photos', pending); mockStorage.set('submission_pending_submit', 'true');
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId }));
  await sync(result);
  expect(mockQuery).toHaveBeenCalledWith('submissions:getById', { id: 'old-submission' });
  expect(mockMutation).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  expect(mockStorage.get('submission_pending_photos')).toBe(pending); expect(read('submission_pending_photos')).toBeNull();
});

it('still submits an owned legacy boolean queue and cleans its old global pointers', async () => {
  row(); mockStorage.set('current_submission_id', 'my-submission'); mockStorage.set('submission_pending_submit', 'true');
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId }));
  await sync(result);
  expect(mockMutation).toHaveBeenCalledWith('submissions:submit', { id: 'my-submission' });
  expect(mockMutation.mock.calls.some(([name]) => name === 'submissions:setDomainTier')).toBe(false);
  expect(mockStorage.has('submission_pending_submit')).toBe(false); expect(mockStorage.has('current_submission_id')).toBe(false);
  expect(read('submission_pending_submit')).toBeNull(); expect(read('submission_last_sent')).toMatchObject({ submissionId: 'my-submission', queued: false });
});

it('never reads another actor scoped media into the current account', async () => {
  mockStorage.set(captureStorageKey('previous-creator', 'submission_pending_photos'), JSON.stringify(photos()));
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
  expect(mockQuery).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled(); expect(mockMutation).not.toHaveBeenCalled();
  expect(mockStorage.has(captureStorageKey('previous-creator', 'submission_pending_photos'))).toBe(true);
});

it('keeps partial photo uploads and reuses their keys on the next attempt', async () => {
  row(); scoped('current_submission_id', 'my-submission'); scoped('submission_pending_photos', photos());
  let fail = true;
  mockFetch.mockImplementation(async (url: string, options?: { method?: string }) => {
    if (options?.method !== 'PUT') return { blob: async () => ({}) };
    if (url.includes('photo-p2') && fail) { fail = false; return { ok: false }; }
    return { ok: true };
  });
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
  expect(read('submission_pending_photos').entries[0].storageId).toBe('images/photo-p1.jpg');
  expect(read('submission_pending_photos').entries[1].storageId).toBeUndefined();
  expect(mockMutation).not.toHaveBeenCalled();
  await sync(result);
  expect(mockUpload.mock.calls.filter(([args]) => args.filename === 'photo-p1.jpg')).toHaveLength(1);
  expect(mockMutation).toHaveBeenCalledWith('submissions:update', { id: 'my-submission', photos: [
    'images/photo-p1.jpg', 'images/photo-p2.jpg', 'images/photo-p3.jpg',
  ] });
  expect(read('submission_pending_photos')).toBeNull();
});

it('reuses an uploaded video after parallel audio fails and preserves the attached offline recording', async () => {
  row(); scoped('current_submission_id', 'my-submission');
  scoped('submission_pending_interview', { submissionId: 'my-submission', recordingUri: 'file://interview.mp4',
    parallelAudioUri: 'file://backup.m4a', type: 'video' });
  scoped('submission_interview_draft', { submissionId: 'my-submission', durationSec: 90, recordingUri: 'file://interview.mp4', type: 'video' });
  let fail = true;
  mockFetch.mockImplementation(async (url: string, options?: { method?: string }) => {
    if (options?.method !== 'PUT') return { blob: async () => ({}) };
    if (url.includes('interview-audio') && fail) { fail = false; return { ok: false }; } return { ok: true };
  });
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
  expect(read('submission_pending_interview').storageId).toBe('videos/interview.mp4');
  await sync(result);
  expect(mockUpload.mock.calls.filter(([args]) => args.filename === 'interview.mp4')).toHaveLength(1);
  expect(mockMutation).toHaveBeenCalledWith('submissions:update', { id: 'my-submission', videoStorageId: 'videos/interview.mp4', audioStorageId: 'audio/interview-audio.m4a' });
  expect(read('submission_pending_interview')).toBeNull();
  expect(read('submission_interview_draft')).toMatchObject({ attached: true, durationSec: 90,
    storageId: 'videos/interview.mp4', audioStorageId: 'audio/interview-audio.m4a' });
});

it('sets the exact queued price and domain before submitting and then clears final metadata', async () => {
  row(); scoped('current_submission_id', 'my-submission');
  scoped('submission_pending_submit', { submissionId: 'my-submission', sellPrice: 2499, submissionType: 'with_custom_domain', requestedDomain: 'nena.shop', domainPricePHP: 450 });
  scoped('submission_interview_draft', { submissionId: 'my-submission', attached: true });
  scoped('submission_photo_tasks', { submissionId: 'my-submission', items: [] });
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
  expect(mockMutation.mock.calls).toEqual([
    ['submissions:setDomainTier', { id: 'my-submission', sellPrice: 2499, submissionType: 'with_custom_domain', requestedDomain: 'nena.shop', domainPricePHP: 450 }],
    ['submissions:submit', { id: 'my-submission' }],
  ]);
  expect(read('submission_interview_draft')).toBeNull(); expect(read('submission_photo_tasks')).toBeNull();
});

it.each([undefined, '', '   ', 'not-an-email', 'owner@example', `${'a'.repeat(310)}@example.com`])(
  'keeps a legacy draft queued until its owner email is valid (%p)', async ownerEmail => {
    row('my-submission', { ownerEmail }); scoped('current_submission_id', 'my-submission');
    const choice = { submissionId: 'my-submission', sellPrice: 2499, submissionType: 'standard' };
    scoped('submission_pending_submit', choice);
    scoped('submission_photo_tasks', { submissionId: 'my-submission', items: [{ id: 'p1', uri: 'file://one.jpg', storageId: 'images/one.jpg' }] });
    scoped('submission_interview_draft', { submissionId: 'my-submission', recordingUri: 'file://interview.mp4', attached: true });
    const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
    expect(mockMutation).not.toHaveBeenCalled();
    expect(read('submission_pending_submit')).toEqual(choice);
    expect(read('submission_photo_tasks').items[0]).toMatchObject({ uri: 'file://one.jpg', storageId: 'images/one.jpg' });
    expect(read('submission_interview_draft')).toMatchObject({ recordingUri: 'file://interview.mp4', attached: true });
    expect(read('submission_last_sent')).toBeNull();
    expect(Alert.alert).toHaveBeenCalledWith('Email needed to send', expect.stringContaining('Open About the shop'), [{ text: 'OK' }]);
    await sync(result); await sync(result);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(mockMutation).not.toHaveBeenCalled();
  },
);

it('syncs an incomplete offline draft and its media without pricing, submitting or losing the queued choice', async () => {
  scoped('current_submission_id', 'offline_pending');
  scoped('submission_pending_sync', info({ formData: { ...formData, ownerEmail: '' } }));
  scoped('submission_pending_submit', { submissionId: 'offline_pending', sellPrice: 2499, submissionType: 'standard' });
  scoped('submission_pending_photos', photos('offline_pending'));
  scoped('submission_photo_tasks', { submissionId: 'offline_pending', items: photos().entries });
  scoped('submission_pending_interview', { submissionId: 'offline_pending', recordingUri: 'file://interview.mp4',
    parallelAudioUri: 'file://backup.m4a', type: 'video' });
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
  expect(mockRows.get('new-submission-1')).toMatchObject({ status: 'draft', ownerEmail: '', photos: [
    'images/photo-p1.jpg', 'images/photo-p2.jpg', 'images/photo-p3.jpg',
  ], videoStorageId: 'videos/interview.mp4', audioStorageId: 'audio/interview-audio.m4a' });
  expect(read('submission_pending_submit')).toEqual({ submissionId: 'new-submission-1', sellPrice: 2499, submissionType: 'standard' });
  expect(read('submission_snapshot')).toMatchObject({ submissionId: 'new-submission-1', ownerEmail: '' });
  expect(read('submission_photo_tasks').items).toEqual(expect.arrayContaining([
    expect.objectContaining({ uri: 'file://1.jpg', storageId: 'images/photo-p1.jpg' }),
  ]));
  expect(read('submission_interview_draft')).toMatchObject({ recordingUri: 'file://interview.mp4', attached: true });
  expect(read('submission_last_sent')).toBeNull();
  expect(mockMutation.mock.calls.some(([name]) => name === 'submissions:setDomainTier' || name === 'submissions:submit')).toBe(false);
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalledWith('Email needed to send', expect.stringContaining('Your capture and media are saved'), [{ text: 'OK' }]);

  scoped('submission_pending_sync', info({ existingDraftId: 'new-submission-1',
    formData: { ...formData, ownerEmail: 'corrected@example.com' } }));
  await sync(result);
  expect(mockRows.get('new-submission-1')).toMatchObject({ status: 'submitted', ownerEmail: 'corrected@example.com' });
  expect(mockMutation.mock.calls.filter(([name]) => name === 'submissions:create')).toHaveLength(1);
  expect(mockUpload.mock.calls).toHaveLength(5);
  expect(mockMutation).toHaveBeenCalledWith('submissions:setDomainTier', { id: 'new-submission-1', sellPrice: 2499,
    submissionType: 'standard', requestedDomain: undefined, domainPricePHP: undefined });
  expect(read('submission_pending_submit')).toBeNull();
  expect(read('submission_last_sent')).toMatchObject({ submissionId: 'new-submission-1', queued: false });
});

it('checks the newest owned server email rather than a stale initial row before sending', async () => {
  const initial = row(); scoped('current_submission_id', 'my-submission');
  scoped('submission_pending_submit', { submissionId: 'my-submission', sellPrice: 2499 });
  mockQuery.mockResolvedValueOnce(initial).mockResolvedValueOnce({ ...initial, ownerEmail: '' });
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
  expect(mockQuery).toHaveBeenCalledTimes(2);
  expect(mockMutation).not.toHaveBeenCalled();
  expect(read('submission_pending_submit')).not.toBeNull(); expect(read('submission_last_sent')).toBeNull();
  expect(Alert.alert).toHaveBeenCalledWith('Email needed to send', expect.any(String), expect.any(Array));
});

it('resumes the retained queue when the owner email is corrected on the server', async () => {
  row('my-submission', { ownerEmail: '' }); scoped('current_submission_id', 'my-submission');
  scoped('submission_pending_submit', { submissionId: 'my-submission', sellPrice: 2499 });
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
  mockRows.set('my-submission', { ...mockRows.get('my-submission'), ownerEmail: 'fixed@example.com' });
  await sync(result);
  expect(mockMutation).toHaveBeenCalledWith('submissions:submit', { id: 'my-submission' });
  expect(read('submission_pending_submit')).toBeNull(); expect(read('submission_last_sent')).not.toBeNull();
});

it('silently stops if the account changes during the final email check', async () => {
  const initial = row('my-submission', { ownerEmail: '' }); scoped('current_submission_id', 'my-submission');
  scoped('submission_pending_submit', { submissionId: 'my-submission', sellPrice: 2499 });
  let finish!: (value: unknown) => void;
  mockQuery.mockResolvedValueOnce(initial).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { result, rerender } = renderHook(({ actor }) => useOfflineSync({ enabled: true, creatorId: actor }), { initialProps: { actor: creatorId } });
  let task!: Promise<void>;
  await act(async () => { task = result.current.attemptSync(); await Promise.resolve(); });
  for (let count = 0; count < 20 && !finish; count++) await act(async () => { await Promise.resolve(); });
  expect(finish).toBeDefined(); rerender({ actor: 'next-creator' as Id<'creators'> });
  await act(async () => { finish(initial); await task; });
  expect(mockMutation).not.toHaveBeenCalled(); expect(Alert.alert).not.toHaveBeenCalled();
  expect(read('submission_pending_submit')).not.toBeNull();
  expect(mockStorage.has(captureStorageKey('next-creator', 'submission_pending_submit'))).toBe(false);
});

it('carries the source lead through creation and migrates every offline pointer to the owned server id', async () => {
  scoped('current_submission_id', 'offline_pending'); scoped('submission_pending_sync', info({ prospectLeadId: 'community-lead' }));
  scoped('submission_photo_tasks', { submissionId: 'offline_pending', items: [] });
  scoped('submission_interview_draft', { submissionId: 'offline_pending', recordingUri: 'file://interview.m4a' });
  scoped('submission_snapshot', { submissionId: 'offline_pending', creatorId, ...formData });
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
  expect(mockMutation).toHaveBeenCalledWith('submissions:create', { creatorId, ...formData, prospectLeadId: 'community-lead' });
  expect(read('current_submission_id')).toBe('new-submission-1');
  expect(read('submission_photo_tasks').submissionId).toBe('new-submission-1');
  expect(read('submission_interview_draft').submissionId).toBe('new-submission-1');
  expect(read('submission_snapshot')).toMatchObject({ submissionId: 'new-submission-1', creatorId, businessName: formData.businessName });
});

it('recovers the same owned draft if the create response was lost after the server committed it', async () => {
  scoped('current_submission_id', 'offline_pending'); scoped('submission_pending_sync', info({ prospectLeadId: 'community-lead' }));
  let uncertain = true;
  mockMutation.mockImplementation((reference, args) => {
    const value = defaultMutation(reference, args);
    if (reference === 'submissions:create' && uncertain) { uncertain = false; throw new Error('Response lost'); } return value;
  });
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
  expect(read('submission_pending_sync')).not.toBeNull();
  await sync(result);
  expect(mockMutation.mock.calls.filter(([name]) => name === 'submissions:create')).toHaveLength(1);
  expect(read('current_submission_id')).toBe('new-submission-1');
});

it('does not overwrite a different unfinished server business when reconciling a fresh offline form', async () => {
  row('different-draft', { businessName: 'Another Shop' });
  scoped('current_submission_id', 'offline_pending'); scoped('submission_pending_sync', info());
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
  expect(mockMutation).not.toHaveBeenCalled(); expect(read('submission_pending_sync')).not.toBeNull();
});

it('keeps the chosen map point through offline creation, update and the saved snapshot', async () => {
  const coordinates = { lat: 14.6507, lng: 121.1029 };
  scoped('current_submission_id', 'offline_pending');
  scoped('submission_pending_sync', info({ formData: { ...formData, coordinates } }));
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId }));
  await sync(result);
  expect(mockMutation).toHaveBeenCalledWith('submissions:create', { creatorId, ...formData, coordinates });
  expect(mockMutation).toHaveBeenCalledWith('submissions:update', { id: 'new-submission-1', ...formData, coordinates });
  expect(read('submission_snapshot')).toMatchObject({ submissionId: 'new-submission-1', coordinates });
});

it('does not mistake another map pin for the capture whose create response was lost', async () => {
  row('other-location', { coordinates: { lat: 14.65, lng: 121.1 } });
  scoped('current_submission_id', 'offline_pending');
  scoped('submission_pending_sync', info({ formData: { ...formData, coordinates: { lat: 14.66, lng: 121.11 } } }));
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId }));
  await sync(result);
  expect(mockMutation).not.toHaveBeenCalled();
  expect(read('submission_pending_sync')).not.toBeNull();
  expect(mockRows.get('other-location')?.coordinates).toEqual({ lat: 14.65, lng: 121.1 });
});

it('retains a migrated legacy offline photo queue after a partial upload and resumes it', async () => {
  mockStorage.set('submission_pending_sync', JSON.stringify(info())); mockStorage.set('current_submission_id', 'offline_pending');
  mockStorage.set('submission_pending_photos', JSON.stringify(photos('offline_pending')));
  let fail = true;
  mockFetch.mockImplementation(async (url: string, options?: { method?: string }) => {
    if (options?.method !== 'PUT') return { blob: async () => ({}) };
    if (url.includes('photo-p2') && fail) { fail = false; return { ok: false }; } return { ok: true };
  });
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
  expect(read('submission_pending_photos').submissionId).toBe('new-submission-1');
  expect(read('submission_pending_photos').entries[0].storageId).toBe('images/photo-p1.jpg');
  await sync(result);
  expect(mockMutation.mock.calls.filter(([name]) => name === 'submissions:create')).toHaveLength(1);
  expect(read('submission_pending_photos')).toBeNull();
  expect(mockMutation).toHaveBeenCalledWith('submissions:update', expect.objectContaining({ id: 'new-submission-1', photos: expect.any(Array) }));
});

it('retries cache migration after an intermediate local write fails without creating twice', async () => {
  scoped('current_submission_id', 'offline_pending'); scoped('submission_pending_sync', info());
  scoped('submission_photo_tasks', { submissionId: 'offline_pending', items: [] });
  const originalSet = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
  let fail = true;
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
    if (key === captureStorageKey(creatorId, 'submission_photo_tasks') && fail) { fail = false; throw new Error('Disk busy'); }
    return originalSet(key, value);
  });
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
  expect(read('submission_pending_sync').existingDraftId).toBe('new-submission-1');
  await sync(result);
  expect(mockMutation.mock.calls.filter(([name]) => name === 'submissions:create')).toHaveLength(1);
  expect(read('submission_photo_tasks').submissionId).toBe('new-submission-1');
});

it('finishes cleanup after an accepted legacy submit even without email, without re-pricing or re-submitting', async () => {
  row('my-submission', { status: 'submitted', ownerEmail: undefined });
  scoped('current_submission_id', 'my-submission'); scoped('submission_pending_submit', { submissionId: 'my-submission', sellPrice: 1999, submissionType: 'standard' });
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId })); await sync(result);
  expect(mockMutation).not.toHaveBeenCalled(); expect(read('submission_pending_submit')).toBeNull();
  expect(read('submission_last_sent')).toMatchObject({ submissionId: 'my-submission', queued: false });
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('retains the old actor media and stops mutations when accounts switch during upload', async () => {
  row(); scoped('current_submission_id', 'my-submission'); scoped('submission_pending_photos', photos());
  let finish!: (value: unknown) => void;
  mockFetch.mockImplementation(async (_url: string, options?: { method?: string }) => options?.method === 'PUT'
    ? new Promise(resolve => { finish = resolve; }) : { blob: async () => ({}) });
  const { result, rerender } = renderHook(({ actor }) => useOfflineSync({ enabled: true, creatorId: actor }), { initialProps: { actor: creatorId } });
  let task!: Promise<void>;
  await act(async () => { task = result.current.attemptSync(); await Promise.resolve(); await Promise.resolve(); });
  // Flush the local reads and presigned URL request until the PUT is pending.
  for (let count = 0; count < 20 && !finish; count++) await act(async () => { await Promise.resolve(); });
  expect(finish).toBeDefined();
  rerender({ actor: 'next-creator' as Id<'creators'> });
  await act(async () => { finish({ ok: true }); await task; });
  expect(mockMutation).not.toHaveBeenCalled(); expect(read('submission_pending_photos')).not.toBeNull();
  expect(mockStorage.has(captureStorageKey('next-creator', 'submission_pending_photos'))).toBe(false);
});
