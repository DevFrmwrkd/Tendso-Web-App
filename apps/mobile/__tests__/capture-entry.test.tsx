import React from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import SubmitEntry from '../app/(app)/submit';
import { useCaptureProgress } from '../hooks/useCaptureProgress';
import { captureStorageKey } from '../services/captureSession';

const mockRouter = { replace: jest.fn(), back: jest.fn() };
const mockRead = jest.fn();
const mockWrite = jest.fn();
const mockQuery = jest.fn();
let mockCache: Record<string, any>;
let mockSession: any;
let mockParams: Record<string, unknown>;
let mockServer: any;
let mockNewest: any;
let mockFocused: boolean;
const id = 'a'.repeat(24), newestId = 'b'.repeat(24);
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../hooks/useCaptureSession', () => ({ useCaptureSession: () => mockSession }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]),
}));
jest.mock('@tendso/convex-client', () => ({ api: { submissions: { getById: 'byId', getDraftByCreatorId: 'newest' } } }));
jest.mock('convex/react', () => ({ useQuery: (query: string, args: any) => {
  mockQuery(query, args); return args === 'skip' ? undefined : query === 'byId' ? mockServer : mockNewest;
} }));
jest.mock('../components/v2', () => {
  const ReactModule = require('react'), Native = require('react-native');
  return { Loading: ({ label }: any) => ReactModule.createElement(Native.Text, null, label || 'Loading'),
    ScreenShell: ({ children }: any) => ReactModule.createElement(Native.View, null, children),
    Banner: ({ body }: any) => ReactModule.createElement(Native.Text, null, body),
    Button: ({ title, onPress }: any) => ReactModule.createElement(Native.Pressable, { onPress, accessibilityRole: 'button', accessibilityLabel: title }, ReactModule.createElement(Native.Text, null, title)) };
});

beforeEach(() => {
  jest.clearAllMocks(); mockParams = {}; mockFocused = true;
  mockCache = { current_submission_id: id };
  mockRead.mockReset().mockImplementation(async (key: string) => mockCache[key] ?? null);
  mockWrite.mockReset().mockImplementation(async (key: string, value: any) => { mockCache[key] = value; });
  mockSession = { actor: { creatorId: 'agent-mika' }, actorKey: 'clerk-mika:agent-mika', isReady: true,
    isOffline: false, canQuery: true, isCurrent: () => true, read: mockRead, write: mockWrite };
  mockServer = { _id: id, creatorId: 'agent-mika', status: 'draft', photos: [] };
  mockNewest = { ...mockServer, _id: newestId };
});

it.each(['info', 'photos', 'interview', 'design', 'review'])('reopens the persisted %s screen for the exact active target', async step => {
  mockCache.submission_progress = { submissionId: id, step, savedAt: 1 };
  render(<SubmitEntry />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: `/(app)/submit/${step}`, params: { draftId: id, resumed: '1' } }));
  expect(mockQuery.mock.calls.some(([query, args]) => query === 'newest' && args !== 'skip')).toBe(false);
  expect(mockWrite).not.toHaveBeenCalled();
});

it('uses the newest owned server draft only when the active pointer is absent', async () => {
  mockCache = {}; render(<SubmitEntry />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/(app)/submit/photos', params: { draftId: newestId, resumed: '1' } }));
  expect(mockWrite).toHaveBeenCalledWith('current_submission_id', newestId);
});

it('opens a new form without an explicit ID when there is no existing capture', async () => {
  mockCache = {}; mockNewest = null; render(<SubmitEntry />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/submit/info'));
});

it.each([id, 'offline_pending'])('recovers a tagged Info form without picking a newer unrelated draft: %s', async submissionId => {
  mockCache = { submission_draft_form: { submissionId, businessName: 'Saved shop', savedAt: Date.now() } };
  mockServer = { ...mockServer, photos: [], _id: id };
  mockCache.submission_progress = { submissionId, step: 'review', savedAt: 1 };
  render(<SubmitEntry />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/(app)/submit/info', params: { draftId: submissionId, resumed: '1' } }));
  expect(mockQuery.mock.calls.some(([query, args]) => query === 'newest' && args !== 'skip')).toBe(false);
  expect(mockWrite).toHaveBeenCalledWith('current_submission_id', submissionId);
});

it('opens a newer placeholder form offline after an older receipt without reviving the old progress', async () => {
  mockSession.isOffline = true; mockSession.canQuery = false;
  const savedAt = Date.now() - 100;
  mockCache = { submission_draft_form: { submissionId: 'offline_pending', businessName: 'New shop', savedAt },
    submission_last_sent: { submissionId: 'offline_pending', queued: false, sentAt: savedAt - 100 },
    submission_progress: { submissionId: 'offline_pending', step: 'review', savedAt: savedAt - 100 } };
  render(<SubmitEntry />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/(app)/submit/info', params: { draftId: 'offline_pending', resumed: '1' } }));
});

it('keeps offline progress local without querying a server or picking an unrelated form', async () => {
  mockSession.isOffline = true; mockSession.canQuery = false;
  mockCache = { current_submission_id: 'offline_pending', submission_progress: { submissionId: 'offline_pending', step: 'interview', savedAt: 1 },
    submission_draft_form: { businessName: 'Unrelated form' } };
  render(<SubmitEntry />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/(app)/submit/interview', params: { draftId: 'offline_pending', resumed: '1' } }));
  expect(mockQuery.mock.calls.every(([, args]) => args === 'skip')).toBe(true);
});

it.each([null, { creatorId: 'other', status: 'draft' }, { creatorId: 'agent-mika', status: 'submitted' },
  { creatorId: 'agent-mika', status: 'draft', contentSource: 'owner_app' }])('never resumes unavailable/sent/foreign/owner records: %j', async server => {
  mockServer = server; const screen = render(<SubmitEntry />);
  await waitFor(() => expect(screen.getByText(/no longer editable/)).toBeTruthy());
  expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockWrite).not.toHaveBeenCalled();
});

it('starts rejected corrections at review even when progress says Info', async () => {
  mockServer.status = 'rejected'; mockCache.submission_progress = { submissionId: id, step: 'info', savedAt: 1 };
  render(<SubmitEntry />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/(app)/submit/review', params: { draftId: id, resumed: '1' } }));
});

it('never lets URL params replace the active capture with another target', async () => {
  mockParams = { draftId: newestId }; render(<SubmitEntry />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/(app)/submit/photos', params: { draftId: id, resumed: '1' } }));
  expect(mockQuery.mock.calls.some(([query, args]) => query === 'byId' && args.id === newestId)).toBe(false);
});

it('ignores old async cache reads after the account changes', async () => {
  let resolve!: (value: any) => void;
  const delayed = new Promise(done => { resolve = done; });
  mockRead.mockReturnValue(delayed);
  const screen = render(<SubmitEntry />);
  mockSession = { ...mockSession, actor: null, actorKey: null, isCurrent: () => false };
  screen.rerender(<SubmitEntry />);
  await act(async () => { resolve(id); });
  expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockWrite).not.toHaveBeenCalled();
});

it('records progress only for the current hydrated focused draft, and ignores a late pointer read after blur', async () => {
  const hook = renderHook(({ ready }) => useCaptureProgress(mockSession, 'design', id, ready), { initialProps: { ready: false } });
  await act(async () => {}); expect(mockWrite).not.toHaveBeenCalled();
  hook.rerender({ ready: true });
  await waitFor(() => expect(mockWrite).toHaveBeenCalledWith('submission_progress', { submissionId: id, step: 'design', savedAt: expect.any(Number) }));
  hook.unmount(); mockWrite.mockClear();
  let resolve!: (value: any) => void;
  mockRead.mockImplementation(() => new Promise(done => { resolve = done; }));
  const next = renderHook(() => useCaptureProgress(mockSession, 'review', id, true));
  next.unmount(); await act(async () => { resolve(id); });
  expect(mockWrite).not.toHaveBeenCalled();
  expect(captureStorageKey('agent-mika', 'submission_progress')).not.toBe(captureStorageKey('agent-joy', 'submission_progress'));
});
