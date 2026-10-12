import { act, renderHook } from '@testing-library/react-native';
import { useOfflineSync } from '../hooks/useOfflineSync';
import type { Id } from '@tendso/convex-client';

const mockStorage = new Map<string, string>();
const mockMutation = jest.fn();
const mockUpload = jest.fn();
const mockQuery = jest.fn();
jest.mock('@tendso/convex-client', () => ({ api: {
  submissions: { create: 'submissions:create', update: 'submissions:update', submit: 'submissions:submit', getById: 'submissions:getById' },
  r2: { generateUploadUrl: 'r2:generateUploadUrl' },
} }));
jest.mock('convex/react', () => ({
  useMutation: () => mockMutation,
  useAction: () => mockUpload,
  useConvex: () => ({ query: mockQuery }),
}));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: true }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }),
}));

const creatorId = 'current-creator' as Id<'creators'>;
beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();
  mockQuery.mockResolvedValue({ creatorId });
  mockMutation.mockResolvedValue(undefined);
});

it('does not sync when the live account is not an eligible creator', async () => {
  mockStorage.set('submission_pending_submit', 'true');
  const { result } = renderHook(() => useOfflineSync({ enabled: false, creatorId }));
  await act(async () => { await result.current.attemptSync(); });
  expect(mockQuery).not.toHaveBeenCalled();
  expect(mockMutation).not.toHaveBeenCalled();
  expect(mockStorage.get('submission_pending_submit')).toBe('true');
});

it('retains another creator’s saved business form without creating or updating it', async () => {
  const pending = JSON.stringify({ creatorId: 'previous-creator', savedAt: Date.now(), formData: { businessName: 'Private draft' } });
  mockStorage.set('submission_pending_sync', pending);
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId }));
  await act(async () => { await result.current.attemptSync(); });
  expect(mockMutation).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockStorage.get('submission_pending_sync')).toBe(pending);
});

it('checks the stored submission owner before uploading photos or submitting', async () => {
  const pending = JSON.stringify({ submissionId: 'old-submission', photoUris: ['file://private.jpg'], existingPhotos: [] });
  mockStorage.set('current_submission_id', 'old-submission');
  mockStorage.set('submission_pending_photos', pending);
  mockStorage.set('submission_pending_submit', 'true');
  mockQuery.mockResolvedValue({ creatorId: 'previous-creator' });
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId }));
  await act(async () => { await result.current.attemptSync(); });
  expect(mockQuery).toHaveBeenCalledWith(expect.anything(), { id: 'old-submission' });
  expect(mockMutation).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockStorage.get('submission_pending_photos')).toBe(pending);
  expect(mockStorage.get('submission_pending_submit')).toBe('true');
});

it('still submits the current creator’s owned queued draft', async () => {
  mockStorage.set('current_submission_id', 'my-submission');
  mockStorage.set('submission_pending_submit', 'true');
  const { result } = renderHook(() => useOfflineSync({ enabled: true, creatorId }));
  await act(async () => { await result.current.attemptSync(); });
  expect(mockMutation).toHaveBeenCalledWith({ id: 'my-submission' });
  expect(mockStorage.has('submission_pending_submit')).toBe(false);
  expect(mockStorage.has('current_submission_id')).toBe(false);
});
