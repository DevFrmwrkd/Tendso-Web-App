import React from 'react';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCreatorAttribution } from '../hooks/useCreatorAttribution';
import { attributionStateKey, loadNativeAttribution, saveNativeAttribution, suggestNativeAttribution } from '../services/creatorAttribution';
import { CreatorAttributionGate } from '../components/CreatorAttributionGate';

const mockStorage = new Map<string, string>();
const mockClaim = jest.fn();
const mockGetToken = jest.fn();
const mockFetch = jest.fn();
let mockSubject: string | null;
let mockOnline: boolean;
let mockRole: string | null;
let mockOwner: boolean;
let mockBlocked: boolean;
let mockAccountSubject: string | null;
let mockExisting: Record<string, unknown>;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  },
}));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({
  userId: mockSubject, isLoaded: true, isSignedIn: !!mockSubject, getToken: mockGetToken,
}) }));
jest.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: !!mockSubject }),
  useQuery: (_reference: string, args: unknown) => args === 'skip' ? undefined : mockExisting[mockSubject!] ?? null,
  useMutation: () => mockClaim,
}));
jest.mock('@tendso/convex-client', () => ({ api: { attribution: {
  myAttribution: 'my-attribution', claimAttribution: 'claim-attribution',
} } }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockOnline }) }));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => ({
  account: mockSubject && mockAccountSubject ? { clerkId: mockAccountSubject, role: mockRole } : null,
  role: mockRole, isOwner: mockOwner, isLoading: false, isBlocked: mockBlocked,
  isAdmin: mockRole === 'admin', isPreview: false,
}) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Defs: 'Defs', LinearGradient: 'Gradient', Rect: 'Rect', Stop: 'Stop' }));

const suggestion = { creator: { handle: 'mika', name: 'Mika Reyes', photo: 'https://images.example.test/mika.jpg' },
  kind: 'earn' as const, clickedAt: 1792000000000, matchedBy: 'network' as const };
const originalFetch = global.fetch;
const originalCloud = process.env.EXPO_PUBLIC_CONVEX_URL;
const originalSite = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
const flush = async () => { for (let index = 0; index < 25; index++) await Promise.resolve(); };
const state = (subject: string | null) => JSON.parse(mockStorage.get(attributionStateKey(subject)) ?? 'null');
const signIn = (subject = 'clerk-a') => { mockSubject = subject; mockAccountSubject = subject; mockRole = 'creator'; };

beforeEach(() => {
  jest.clearAllMocks(); mockStorage.clear(); mockSubject = null; mockAccountSubject = null;
  mockOnline = true; mockRole = null; mockOwner = false; mockBlocked = false; mockExisting = {};
  mockClaim.mockReset().mockResolvedValue({ status: 'claimed', linked: true });
  mockGetToken.mockReset().mockResolvedValue('own-convex-token');
  mockFetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ suggestion }) });
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => { mockStorage.set(key, value); });
  global.fetch = mockFetch as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_CONVEX_URL = 'https://native-dev.convex.cloud'; delete process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
});
afterEach(() => jest.useRealTimers());
afterAll(() => {
  global.fetch = originalFetch;
  if (originalCloud === undefined) delete process.env.EXPO_PUBLIC_CONVEX_URL; else process.env.EXPO_PUBLIC_CONVEX_URL = originalCloud;
  if (originalSite === undefined) delete process.env.EXPO_PUBLIC_CONVEX_SITE_URL; else process.env.EXPO_PUBLIC_CONVEX_SITE_URL = originalSite;
});

it('asks about a real same-network suggestion without claiming or persisting Yes automatically', async () => {
  const hook = renderHook(() => useCreatorAttribution());
  await waitFor(() => expect(hook.result.current.candidate).toEqual(suggestion));
  expect(mockFetch).toHaveBeenCalledWith('https://native-dev.convex.site/attribution/suggest', expect.objectContaining({
    method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' }, signal: expect.anything(),
  }));
  expect(mockClaim).not.toHaveBeenCalled(); expect(state(null)).toBeNull();
});

it('shows the real portrait in a full-screen confirmation and treats Android Back as No', async () => {
  const screen = render(<CreatorAttributionGate />);
  await waitFor(() => expect(screen.getByText('Did Mika Reyes send you?')).toBeTruthy());
  const modal = screen.getByTestId('creator-attribution-confirmation');
  expect(modal).toHaveProp('presentationStyle', 'fullScreen');
  expect(screen.getByLabelText("Mika Reyes's profile photo")).toHaveProp('source', { uri: suggestion.creator.photo });
  expect(screen.getByRole('button', { name: 'Yes, they sent me' })).toBeEnabled();
  fireEvent(modal, 'requestClose');
  await waitFor(() => expect(screen.queryByTestId('creator-attribution-confirmation')).toBeNull());
  expect(state(null)).toEqual({ acknowledged: true, pending: null }); expect(mockClaim).not.toHaveBeenCalled();
});

it('uses an honest avatar fallback when a real creator photo fails', async () => {
  const screen = render(<CreatorAttributionGate />);
  await waitFor(() => expect(screen.getByLabelText("Mika Reyes's profile photo")).toBeTruthy());
  fireEvent(screen.getByLabelText("Mika Reyes's profile photo"), 'error');
  expect(screen.queryByLabelText("Mika Reyes's profile photo")).toBeNull();
  expect(screen.getByRole('image', { name: "Mika Reyes's photo" })).toBeTruthy(); expect(screen.getByText('M')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'No' }));
  await waitFor(() => expect(screen.queryByTestId('creator-attribution-confirmation')).toBeNull());
  expect(mockClaim).not.toHaveBeenCalled();
});

it('stores signed-out Yes locally and claims only after an explicit authenticated agent flow', async () => {
  let claimAs: 'agent' | undefined;
  const hook = renderHook(() => useCreatorAttribution({ claimAs }));
  await waitFor(() => expect(hook.result.current.candidate).toEqual(suggestion));
  await act(async () => { await hook.result.current.confirm(); });
  expect(mockClaim).not.toHaveBeenCalled(); expect(hook.result.current.candidate).toBeNull();
  expect(state(null)).toMatchObject({ acknowledged: true, pending: { creator: { handle: 'mika' }, confirmedAt: expect.any(Number) } });
  signIn(); hook.rerender({});
  await waitFor(() => expect(state('clerk-a')).toMatchObject({ pending: { creator: { handle: 'mika' } } }));
  expect(mockClaim).not.toHaveBeenCalled();
  claimAs = 'agent'; hook.rerender({});
  await waitFor(() => expect(mockClaim).toHaveBeenCalledWith({ handle: 'mika', source: 'confirmed', as: 'agent' }));
  await waitFor(() => expect(state('clerk-a')).toEqual({ acknowledged: true, pending: null }));
  expect(mockClaim).toHaveBeenCalledTimes(1); expect(state(null).consumedBy).toBe('clerk-a');
  signIn('clerk-b'); hook.rerender({});
  await waitFor(() => expect(hook.result.current.candidate).toEqual(suggestion));
  expect(mockClaim).toHaveBeenCalledTimes(1); expect(state('clerk-b')?.pending).toBeUndefined();
});

it('persists No without claiming and does not ask the same person again after sign-in', async () => {
  const hook = renderHook(() => useCreatorAttribution({ claimAs: 'agent' }));
  await waitFor(() => expect(hook.result.current.candidate).toEqual(suggestion));
  await act(async () => { await hook.result.current.decline(); });
  expect(state(null)).toEqual({ acknowledged: true, pending: null }); expect(mockClaim).not.toHaveBeenCalled();
  signIn(); hook.rerender({});
  await waitFor(() => expect(state('clerk-a')).toEqual({ acknowledged: true, pending: null }));
  expect(hook.result.current.candidate).toBeNull(); expect(mockClaim).not.toHaveBeenCalled(); expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('uses the explicit owner role even when the visitor followed an earn link', async () => {
  signIn(); mockRole = null; mockOwner = true; mockAccountSubject = null;
  const hook = renderHook(() => useCreatorAttribution({ claimAs: 'owner' }));
  await waitFor(() => expect(hook.result.current.candidate).toEqual(suggestion));
  await act(async () => { await hook.result.current.confirm(); });
  expect(mockClaim).toHaveBeenCalledWith({ handle: 'mika', source: 'confirmed', as: 'owner' });
  expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer own-convex-token');
});

it.each(['affiliate', 'admin', 'blocked', 'foreign', 'owner-as-agent'])('does not show or claim for an ineligible %s session', async mode => {
  signIn();
  if (mode === 'blocked') mockBlocked = true;
  else if (mode === 'foreign') mockAccountSubject = 'different-clerk-subject';
  else if (mode === 'owner-as-agent') mockOwner = true;
  else mockRole = mode;
  const hook = renderHook(() => useCreatorAttribution({ claimAs: 'agent' }));
  await act(flush);
  expect(hook.result.current.candidate).toBeNull(); expect(mockFetch).not.toHaveBeenCalled(); expect(mockClaim).not.toHaveBeenCalled();
});

it('keeps a failed confirmed claim for retry and respects the server first-claim result', async () => {
  signIn(); mockClaim.mockRejectedValueOnce(new Error('Network failed')).mockResolvedValueOnce({ status: 'already_attributed', creator: { handle: 'first-creator' } });
  const hook = renderHook(() => useCreatorAttribution({ claimAs: 'agent' }));
  await waitFor(() => expect(hook.result.current.candidate).toEqual(suggestion));
  await act(async () => { await hook.result.current.confirm(); });
  expect(hook.result.current.error).toBeTruthy(); expect(hook.result.current.pending).toBe(true);
  expect(state('clerk-a')).toMatchObject({ pending: { creator: { handle: 'mika' } } });
  act(() => hook.result.current.retry());
  await waitFor(() => expect(state('clerk-a')).toEqual({ acknowledged: true, pending: null }));
  expect(mockClaim).toHaveBeenCalledTimes(2); expect(hook.result.current.candidate).toBeNull();
  expect(mockClaim.mock.calls.every(([args]) => args.source === 'confirmed')).toBe(true);
});

it('clears pending consent on No after a failure instead of silently retrying later', async () => {
  signIn(); mockClaim.mockRejectedValueOnce(new Error('Unavailable'));
  const hook = renderHook(() => useCreatorAttribution({ claimAs: 'agent' }));
  await waitFor(() => expect(hook.result.current.candidate).toEqual(suggestion));
  await act(async () => { await hook.result.current.confirm(); });
  await act(async () => { await hook.result.current.decline(); });
  expect(state('clerk-a')).toEqual({ acknowledged: true, pending: null });
  act(() => hook.result.current.retry()); await act(flush);
  expect(mockClaim).toHaveBeenCalledTimes(1); expect(hook.result.current.candidate).toBeNull();
});

it('does not copy or claim the prior actor consent after a pending Clerk token resolves', async () => {
  signIn(); let finish!: (token: string) => void;
  const hook = renderHook(() => useCreatorAttribution({ claimAs: 'agent' }));
  await waitFor(() => expect(hook.result.current.candidate).toEqual(suggestion));
  mockGetToken.mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve; }));
  let confirmation!: Promise<void>;
  act(() => { confirmation = hook.result.current.confirm(); });
  await waitFor(() => expect(state('clerk-a')).toMatchObject({ pending: { creator: { handle: 'mika' } } }));
  signIn('clerk-b'); hook.rerender({});
  await act(async () => { finish('prior-actor-token'); await confirmation; await flush(); });
  expect(mockClaim).not.toHaveBeenCalled();
  expect(state('clerk-a')).toMatchObject({ pending: { creator: { handle: 'mika' } } });
  expect(state('clerk-b')?.pending).toBeUndefined();
});

it('ignores retained Yes and No callbacks after the visible question moves to another account', async () => {
  signIn();
  const hook = renderHook(() => useCreatorAttribution({ claimAs: 'agent' }));
  await waitFor(() => expect(hook.result.current.candidate).toEqual(suggestion));
  const oldConfirm = hook.result.current.confirm; const oldDecline = hook.result.current.decline;
  signIn('clerk-b'); hook.rerender({});
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(hook.result.current.candidate).toEqual(suggestion));
  await act(async () => { await oldConfirm(); await oldDecline(); });
  expect(mockClaim).not.toHaveBeenCalled(); expect(state('clerk-a')).toBeNull(); expect(state('clerk-b')).toBeNull();
  expect(hook.result.current.candidate).toEqual(suggestion);
});

it('ignores retained confirmation, decline, and retry actions after the gate unmounts', async () => {
  signIn();
  const hook = renderHook(() => useCreatorAttribution({ claimAs: 'agent' }));
  await waitFor(() => expect(hook.result.current.candidate).toEqual(suggestion));
  const old = hook.result.current; hook.unmount();
  await act(async () => { await old.confirm(); await old.decline(); old.retry(); await flush(); });
  expect(mockClaim).not.toHaveBeenCalled(); expect(mockStorage.size).toBe(0);
});

it('does not let a queued old Yes callback replace the user’s completed No answer', async () => {
  signIn();
  const hook = renderHook(() => useCreatorAttribution({ claimAs: 'agent' }));
  await waitFor(() => expect(hook.result.current.candidate).toEqual(suggestion));
  const oldConfirm = hook.result.current.confirm;
  await act(async () => { await hook.result.current.decline(); });
  await act(async () => { await oldConfirm(); });
  expect(state('clerk-a')).toEqual({ acknowledged: true, pending: null }); expect(mockClaim).not.toHaveBeenCalled();
});

it('does not ask again or overwrite the existing server attribution', async () => {
  signIn(); mockExisting['clerk-a'] = { kind: 'agent', status: 'applied', creator: { handle: 'first-creator' } };
  const hook = renderHook(() => useCreatorAttribution({ claimAs: 'agent' }));
  await waitFor(() => expect(state('clerk-a')).toEqual({ acknowledged: true, pending: null }));
  expect(hook.result.current.candidate).toBeNull(); expect(mockFetch).not.toHaveBeenCalled(); expect(mockClaim).not.toHaveBeenCalled();
});

it('reconnects a previously confirmed answer without inventing a referral while offline', async () => {
  await saveNativeAttribution(null, suggestion, () => true);
  signIn(); mockOnline = false;
  const hook = renderHook(() => useCreatorAttribution({ claimAs: 'agent' }));
  await waitFor(() => expect(hook.result.current.pending).toBe(true));
  expect(mockClaim).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled();
  mockOnline = true; hook.rerender({});
  await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(hook.result.current.candidate).toBeNull());
});

it('does not claim or report success when device consent storage fails', async () => {
  signIn();
  const hook = renderHook(() => useCreatorAttribution({ claimAs: 'agent' }));
  await waitFor(() => expect(hook.result.current.candidate).toEqual(suggestion));
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Disk full'));
  await act(async () => { await hook.result.current.confirm(); });
  expect(mockClaim).not.toHaveBeenCalled(); expect(state('clerk-a')).toBeNull(); expect(hook.result.current.error).toBeTruthy();
});

it('keeps anonymous consent reserved to its first actor if the account changes between adoption writes', async () => {
  await saveNativeAttribution(null, suggestion, () => true);
  let current = true;
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, value) => { mockStorage.set(key, value); current = false; });
  expect(await loadNativeAttribution('clerk-a', () => current)).toBeNull();
  expect(state(null).consumedBy).toBe('clerk-a');
  expect((await loadNativeAttribution('clerk-b', () => true))?.pending).toBeNull();
  expect((await loadNativeAttribution('clerk-a', () => true))?.pending?.creator.handle).toBe('mika');
});

it('stops a first-open lookup after six seconds and ignores a late network response', async () => {
  jest.useFakeTimers(); let finish!: (value: unknown) => void;
  mockFetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const lookup = suggestNativeAttribution();
  const rejected = expect(lookup).rejects.toThrow('timed out');
  await jest.advanceTimersByTimeAsync(6000); await rejected;
  expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
  finish({ ok: true, json: async () => ({ suggestion }) }); await flush();
  expect(mockStorage.size).toBe(0); expect(mockClaim).not.toHaveBeenCalled();
});

it('also bounds a stalled response body by the same six-second lookup deadline', async () => {
  jest.useFakeTimers();
  mockFetch.mockResolvedValueOnce({ ok: true, json: () => new Promise(() => {}) });
  const lookup = suggestNativeAttribution(); const rejected = expect(lookup).rejects.toThrow('timed out');
  await jest.advanceTimersByTimeAsync(6000); await rejected;
  expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true); expect(mockStorage.size).toBe(0);
});

it.each([null, { creator: { handle: 'mika', name: 'Mika' }, kind: 'unknown' }, { ...suggestion, creator: { ...suggestion.creator, handle: '../evil' } }])
('shows no guess when the endpoint returns %j', async returned => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ suggestion: returned }) });
  const hook = renderHook(() => useCreatorAttribution());
  await waitFor(() => expect(state(null)).toEqual({ acknowledged: true, pending: null }));
  expect(hook.result.current.candidate).toBeNull(); expect(mockClaim).not.toHaveBeenCalled();
});
