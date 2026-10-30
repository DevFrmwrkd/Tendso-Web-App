import { act, renderHook } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCaptureSession } from '../hooks/useCaptureSession';
import { useFormDraftCache } from '../hooks/useFormDraftCache';
import { captureActorCacheKey, captureStorageKey, writeCaptureCache, type CaptureActor } from '../services/captureSession';

const mockStorage = new Map<string, string>();
let mockAuth: Record<string, unknown>;
let mockSession: Record<string, unknown>;
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => mockAuth }));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => mockSession }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }),
}));

const actor = { creatorId: 'agent-mika', clerkId: 'clerk-mika' } as CaptureActor;
const nextActor = { creatorId: 'agent-joy', clerkId: 'clerk-joy' } as CaptureActor;
const form = { businessName: 'Nena Shop', businessType: 'Restaurant', ownerName: 'Nena Cruz', ownerPhone: '9171234567',
  ownerEmail: '', address: '12 Main St', city: 'Marikina', prospectLeadId: 'community-nena' };
const account = (value = actor) => ({ _id: value.creatorId, clerkId: value.clerkId, role: 'creator', status: 'active', certifiedAt: 1 });
async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockStorage.clear();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => mockStorage.get(key) ?? null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => { mockStorage.set(key, value); });
  mockAuth = { userId: actor.clerkId, isLoaded: true, isSignedIn: true };
  mockSession = { account: account(), role: 'creator', isAuthenticated: true, isOffline: false,
    isLoading: false, isBlocked: false, isPreview: false };
});
afterEach(() => jest.useRealTimers());

it('scopes local records to the live approved actor without reading legacy globals', async () => {
  mockStorage.set('current_submission_id', 'unowned-global-draft');
  mockStorage.set(captureStorageKey(actor.creatorId, 'current_submission_id'), JSON.stringify('mika-draft'));
  mockStorage.set(captureStorageKey(nextActor.creatorId, 'current_submission_id'), JSON.stringify('joy-draft'));
  const { result } = renderHook(() => useCaptureSession()); await settle();
  expect(result.current.actor).toEqual(actor);
  expect(result.current.canMutate()).toBe(true);
  expect(await result.current.read('current_submission_id')).toBe('mika-draft');
  expect(AsyncStorage.getItem).not.toHaveBeenCalledWith('current_submission_id');
  expect(AsyncStorage.getItem).not.toHaveBeenCalledWith(captureStorageKey(nextActor.creatorId, 'current_submission_id'));
});

it('restores an actor offline only for the same explicitly signed-in Clerk identity', async () => {
  mockSession = { ...mockSession, account: undefined, isOffline: true, isAuthenticated: false };
  mockStorage.set(captureActorCacheKey(actor.clerkId), JSON.stringify(actor));
  mockStorage.set(captureStorageKey(actor.creatorId, 'submission_snapshot'), JSON.stringify({ businessName: 'Private capture' }));
  const { result } = renderHook(() => useCaptureSession()); await settle();
  expect(result.current.isReady).toBe(true); expect(result.current.actor).toEqual(actor);
  expect(result.current.canQuery).toBe(false); expect(result.current.canMutate()).toBe(false);
  expect(await result.current.read('submission_snapshot')).toEqual({ businessName: 'Private capture' });
});

it('rejects a cached actor whose Clerk identity does not match the current signed-in account', async () => {
  mockAuth = { ...mockAuth, userId: nextActor.clerkId };
  mockSession = { ...mockSession, account: undefined, isOffline: true, isAuthenticated: false };
  mockStorage.set(captureActorCacheKey(nextActor.clerkId), JSON.stringify(actor));
  const { result } = renderHook(() => useCaptureSession()); await settle();
  expect(result.current.actor).toBeNull(); expect(result.current.canMutate()).toBe(false);
  expect(await result.current.read('submission_snapshot')).toBeNull();
});

it('keeps the remembered same-actor form mounted during reconnect without permitting remote mutations', async () => {
  const { result, rerender } = renderHook(() => useCaptureSession()); await settle();
  const key = result.current.actorKey;
  mockSession = { ...mockSession, account: undefined, role: null, isAuthenticated: false, isLoading: true };
  rerender(); await settle();
  expect(result.current.actorKey).toBe(key); expect(result.current.actor).toEqual(actor);
  expect(result.current.isReady).toBe(true); expect(result.current.isCurrent()).toBe(true);
  expect(result.current.canQuery).toBe(false); expect(result.current.canMutate()).toBe(false);
});

it.each([
  { isBlocked: true }, { isPreview: true }, { account: { ...account(), rejectedAt: 2 } },
  { account: { ...account(), certifiedAt: undefined } }, { account: { ...account(), status: 'suspended' } },
  { account: { ...account(), role: 'affiliate' }, role: 'affiliate' },
])('denies capture after an explicit access change: %p', async (patch) => {
  const { result, rerender } = renderHook(() => useCaptureSession()); await settle();
  const oldMutate = result.current.canMutate;
  mockSession = { ...mockSession, ...patch }; rerender(); await settle();
  expect(result.current.actor).toBeNull(); expect(oldMutate()).toBe(false);
  expect(await result.current.read('submission_snapshot')).toBeNull();
});

it('never restores the cached actor after explicit sign-out', async () => {
  mockStorage.set(captureActorCacheKey(actor.clerkId), JSON.stringify(actor));
  mockAuth = { ...mockAuth, isSignedIn: false };
  mockSession = { ...mockSession, account: undefined, isOffline: true, isAuthenticated: false };
  const { result } = renderHook(() => useCaptureSession()); await settle();
  expect(result.current.actor).toBeNull(); expect(result.current.isCurrent()).toBe(false);
});

it('drops a delayed cache read after the actor changes and blocks old action closures', async () => {
  let finish!: (value: string) => void;
  const pending = new Promise<string>(resolve => { finish = resolve; });
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) =>
    key === captureStorageKey(actor.creatorId, 'submission_snapshot') ? pending : mockStorage.get(key) ?? null);
  const { result, rerender } = renderHook(() => useCaptureSession()); await settle();
  const oldRead = result.current.read; const oldWrite = result.current.write;
  let task!: Promise<unknown>;
  act(() => { task = oldRead('submission_snapshot'); });
  mockAuth = { ...mockAuth, userId: nextActor.clerkId };
  mockSession = { ...mockSession, account: account(nextActor) };
  rerender(); await settle();
  await act(async () => { finish(JSON.stringify({ businessName: 'Mika private capture' })); });
  expect(await task).toBeNull();
  await expect(oldWrite('current_submission_id', 'mika-draft')).rejects.toThrow('capture account changed');
  expect(result.current.actor).toEqual(nextActor);
  expect(mockStorage.has(captureStorageKey(nextActor.creatorId, 'current_submission_id'))).toBe(false);
});

it('notifies only the matching actor when a sync migrates the current submission pointer', async () => {
  const { result } = renderHook(() => useCaptureSession()); await settle();
  const initial = result.current.revision;
  await act(async () => { await writeCaptureCache(nextActor.creatorId, 'current_submission_id', 'joy-draft'); });
  expect(result.current.revision).toBe(initial);
  await act(async () => { await writeCaptureCache(actor.creatorId, 'current_submission_id', 'real-server-id'); });
  expect(result.current.revision).toBe(initial + 1);
  expect(await result.current.read('current_submission_id')).toBe('real-server-id');
});

it('cancels the debounced form write before clearing so a quick Continue cannot resurrect the old form', async () => {
  const { result } = renderHook(() => useFormDraftCache(actor));
  act(() => result.current.saveDraft(form));
  await act(async () => { await result.current.clearDraft(); jest.advanceTimersByTime(600); });
  expect(mockStorage.has(captureStorageKey(actor.creatorId, 'submission_draft_form'))).toBe(false);
});

it('cancels the previous actor timer when the form cache switches accounts', async () => {
  const { result, rerender } = renderHook(({ current }) => useFormDraftCache(current), { initialProps: { current: actor } });
  act(() => result.current.saveDraft(form));
  rerender({ current: nextActor });
  await act(async () => { jest.advanceTimersByTime(600); });
  expect(mockStorage.has(captureStorageKey(actor.creatorId, 'submission_draft_form'))).toBe(false);
  expect(mockStorage.has(captureStorageKey(nextActor.creatorId, 'submission_draft_form'))).toBe(false);
  act(() => result.current.saveDraft({ ...form, ownerName: 'Joy' }));
  await act(async () => { jest.advanceTimersByTime(600); });
  expect(JSON.parse(mockStorage.get(captureStorageKey(nextActor.creatorId, 'submission_draft_form'))!).ownerName).toBe('Joy');
});
