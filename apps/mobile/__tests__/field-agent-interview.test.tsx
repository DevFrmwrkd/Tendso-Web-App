import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import SubmitInterviewScreen from '../app/(app)/submit/interview';
import { Button } from '../components/v2';
import { INTERVIEW_QUESTIONS } from '../lib/v2/captureContent';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockUpload = jest.fn();
const mockUpdate = jest.fn();
const mockFetch = jest.fn();
const mockWrite = jest.fn();
let mockActor = 'agent-1';
let mockOffline = false;
let mockRevision = 0;
let mockSubmission: Record<string, unknown> | null | undefined;
let mockCameraProps: any;
const mockStorage = new Map<string, unknown>();

jest.mock('../hooks/useCaptureSession', () => ({ useCaptureSession: () => {
  const actorKey = mockActor;
  const key = (name: string) => actorKey + ':' + name;
  return {
    actor: { creatorId: actorKey, clerkId: 'clerk-' + actorKey }, actorKey, revision: mockRevision,
    isReady: true, isOffline: mockOffline, canQuery: !mockOffline,
    isCurrent: () => actorKey === mockActor,
    canMutate: () => actorKey === mockActor && !mockOffline,
    read: async (name: string) => mockStorage.get(key(name)) ?? null,
    write: async (name: string, value: unknown) => {
      if (actorKey !== mockActor) throw new Error('Account changed');
      await mockWrite(name, value);
      mockStorage.set(key(name), value);
    },
    remove: async (name: string) => { if (actorKey === mockActor) mockStorage.delete(key(name)); },
  };
} }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('convex/react', () => ({
  useQuery: (_ref: unknown, args: unknown) => args === 'skip' ? undefined : mockSubmission,
  useAction: () => mockUpload,
  useMutation: () => mockUpdate,
}));
jest.mock('@tendso/convex-client', () => ({ api: {
  r2: { generateUploadUrl: 'upload' }, submissions: { update: 'update', getById: 'get' },
} }));
jest.mock('../components/OfflineBanner', () => ({ OfflineBanner: () => null }));
jest.mock('../components/v2/capture', () => ({ InterviewCam: (props: any) => {
  mockCameraProps = props;
  return require('react').createElement(require('react-native').View, { testID: 'recording-camera' });
} }));
jest.mock('expo-av', () => ({
  Video: () => null, ResizeMode: { CONTAIN: 'contain' },
  Audio: { Sound: { createAsync: jest.fn() }, setAudioModeAsync: jest.fn(async () => {}) },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));

const originalFetch = global.fetch;
const result = { kind: 'video', uri: 'file://interview.mp4', parallelAudioUri: 'file://parallel.m4a',
  durationSec: 72, marks: [{ index: 0, atSec: 0 }], answered: 11, lang: 'en' };
const draft = { submissionId: 'draft-1', recordingUri: result.uri, parallelAudioUri: result.parallelAudioUri,
  type: 'video', durationSec: 72, lang: 'en', savedAt: 100 };

const flush = async () => { for (let count = 0; count < 15; count++) await Promise.resolve(); };
async function open() {
  const screen = render(<SubmitInterviewScreen />);
  await waitFor(() => expect(screen.getByText('Now ask the owner.')).toBeTruthy());
  return screen;
}
async function record(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByRole('button', { name: 'Start' }));
  expect(screen.getByTestId('recording-camera')).toBeTruthy();
  await act(async () => { mockCameraProps.onFinish(result); await flush(); });
  await waitFor(() => expect(screen.getByText('Interview recorded.')).toBeTruthy());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled());
}
beforeEach(() => {
  jest.clearAllMocks();
  mockActor = 'agent-1'; mockOffline = false; mockRevision = 0; mockCameraProps = null;
  mockSubmission = { _id: 'draft-1', creatorId: mockActor, status: 'draft' };
  mockStorage.clear(); mockStorage.set('agent-1:current_submission_id', 'draft-1');
  mockWrite.mockReset().mockResolvedValue(undefined);
  mockUpload.mockReset().mockImplementation(async ({ folder }: { folder: string }) => ({
    uploadUrl: 'https://upload.example.com/' + folder, fileKey: folder === 'videos' ? 'videos/take.mp4' : 'audio/take.m4a',
  }));
  mockUpdate.mockReset().mockResolvedValue(undefined);
  mockFetch.mockReset().mockImplementation(async (uri: string) => uri.startsWith('file:')
    ? { blob: async () => ({ type: 'media' }) } : { ok: true });
  global.fetch = mockFetch as unknown as typeof fetch;
});
afterAll(() => { global.fetch = originalFetch; });

it('previews all ten English and Tagalog prompts plus Anything else without recording or uploading', async () => {
  const screen = await open();
  for (let index = 0; index < 10; index++) {
    expect(screen.getByText(INTERVIEW_QUESTIONS[index].en)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Switch to Tagalog' }));
    expect(screen.getByText(INTERVIEW_QUESTIONS[index].tl)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Switch to English' }));
    fireEvent.press(screen.getByRole('button', { name: 'Preview next question' }));
  }
  expect(screen.getByText('Anything else?')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Preview next question' })).toBeDisabled();
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('persists a completed take immediately and restores it after leaving and reopening', async () => {
  const screen = await open();
  await record(screen);
  expect(mockStorage.get('agent-1:submission_interview_draft')).toMatchObject({ ...draft, savedAt: expect.any(Number), attached: false });
  expect(mockStorage.get('agent-1:submission_pending_interview')).toBeUndefined();
  screen.unmount();
  const reopened = render(<SubmitInterviewScreen />);
  await waitFor(() => expect(reopened.getByText('Interview recorded.')).toBeTruthy());
  expect(mockUpload).not.toHaveBeenCalled();
});

it('queues an offline take for its same capture and never calls live APIs', async () => {
  mockOffline = true;
  mockStorage.set('agent-1:current_submission_id', 'offline_pending');
  mockStorage.set('agent-1:submission_interview_draft', { ...draft, submissionId: 'offline_pending' });
  const screen = render(<SubmitInterviewScreen />);
  await waitFor(() => expect(screen.getByText('Interview recorded.')).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Save and continue' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submit/review'));
  expect(mockStorage.get('agent-1:submission_pending_interview')).toMatchObject({ recordingUri: result.uri, submissionId: 'offline_pending' });
  expect(mockUpload).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
});

it('uploads one video and its parallel audio without a browser-supplied payout', async () => {
  const screen = await open();
  await record(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submit/review'));
  expect(mockUpload).toHaveBeenCalledTimes(2);
  expect(mockUpdate).toHaveBeenCalledWith({ id: 'draft-1', videoStorageId: 'videos/take.mp4', audioStorageId: 'audio/take.m4a' });
  expect(mockStorage.get('agent-1:submission_interview_draft')).toMatchObject({ storageId: 'videos/take.mp4', audioStorageId: 'audio/take.m4a', attached: true });
});

it('retains the uploaded video on a parallel-audio failure and retries only that audio', async () => {
  const screen = await open();
  await record(screen);
  mockFetch.mockImplementation(async (uri: string) => uri.startsWith('file:')
    ? { blob: async () => ({}) } : { ok: !uri.endsWith('/audio') });
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(screen.getByText('Could not upload the recording. Your saved take is ready to retry.')).toBeTruthy());
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockStorage.get('agent-1:submission_interview_draft')).toMatchObject({ storageId: 'videos/take.mp4' });
  expect((mockStorage.get('agent-1:submission_interview_draft') as any).attached).not.toBe(true);
  mockFetch.mockImplementation(async (uri: string) => uri.startsWith('file:') ? { blob: async () => ({}) } : { ok: true });
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
  expect(mockUpload.mock.calls.map(call => call[0].folder)).toEqual(['videos', 'audio', 'audio']);
});

it('deduplicates Continue while an upload is pending', async () => {
  let finish!: (value: { uploadUrl: string; fileKey: string }) => void;
  const pending = new Promise<{ uploadUrl: string; fileKey: string }>(resolve => { finish = resolve; });
  const screen = await open();
  await record(screen);
  mockUpload.mockReturnValueOnce(pending);
  const button = screen.UNSAFE_getAllByType(Button).find(node => node.props.title === 'Continue')!;
  act(() => { button.props.onPress(); button.props.onPress(); });
  await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
  await act(async () => { finish({ uploadUrl: 'https://upload.example.com/videos', fileKey: 'videos/take.mp4' }); await pending; await flush(); });
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
});

it('drops a stale upload after the active actor changes and clears the visible take', async () => {
  let finish!: (value: { uploadUrl: string; fileKey: string }) => void;
  const pending = new Promise<{ uploadUrl: string; fileKey: string }>(resolve => { finish = resolve; });
  const screen = await open();
  await record(screen);
  mockUpload.mockReturnValueOnce(pending);
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
  mockActor = 'agent-2';
  mockStorage.set('agent-2:current_submission_id', 'draft-2');
  mockSubmission = { _id: 'draft-2', creatorId: mockActor, status: 'draft' };
  screen.rerender(<SubmitInterviewScreen />);
  await waitFor(() => expect(screen.getByText('Now ask the owner.')).toBeTruthy());
  await act(async () => { finish({ uploadUrl: 'https://upload.example.com/videos', fileKey: 'videos/take.mp4' }); await pending; await flush(); });
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
});

it('ignores a cached take belonging to another capture of the same actor', async () => {
  mockStorage.set('agent-1:submission_interview_draft', { ...draft, submissionId: 'some-other-draft' });
  const screen = await open();
  expect(screen.queryByText('Interview recorded.')).toBeNull();
  expect(mockUpload).not.toHaveBeenCalled();
});

it('follows a migrated offline capture id without dropping its saved take', async () => {
  mockOffline = true;
  mockStorage.set('agent-1:current_submission_id', 'offline_pending');
  mockStorage.set('agent-1:submission_interview_draft', { ...draft, submissionId: 'offline_pending' });
  const screen = render(<SubmitInterviewScreen />);
  await waitFor(() => expect(screen.getByText('Interview recorded.')).toBeTruthy());
  mockOffline = false; mockRevision++;
  mockStorage.set('agent-1:current_submission_id', 'draft-1');
  mockStorage.set('agent-1:submission_interview_draft', draft);
  screen.rerender(<SubmitInterviewScreen />);
  await act(flush);
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'draft-1' })));
});

it('does not reupload or reattach a take already saved on the server', async () => {
  mockStorage.set('agent-1:submission_interview_draft', { ...draft, storageId: 'videos/take.mp4', audioStorageId: 'audio/take.m4a' });
  mockSubmission = { ...mockSubmission, videoStorageId: 'videos/take.mp4', audioStorageId: 'audio/take.m4a' };
  const screen = render(<SubmitInterviewScreen />);
  await waitFor(() => expect(screen.getByText('Interview recorded.')).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
  expect(mockUpload).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
});
