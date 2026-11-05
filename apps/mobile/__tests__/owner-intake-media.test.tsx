import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OwnerMediaPreview } from '../components/v2/owner/OwnerMediaPreview';
import CheckSite from '../app/(owner)/check';
import { ownerIntake } from '../lib/v2/ownerIntake';

const mockApprove = jest.fn();
const mockReplace = jest.fn(); const mockPush = jest.fn();
const mockAudioMode = jest.fn(); const mockCreateSound = jest.fn();
let mockSubject = 'owner-a'; let mockConnected = true;
let mockSite: any;
let mockStatus: (status: any) => void;
const mockSound = { getStatusAsync: jest.fn(), pauseAsync: jest.fn(), playAsync: jest.fn(),
  replayAsync: jest.fn(), unloadAsync: jest.fn() };
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject }) }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => ({ id: mockSite.submissionId, site: mockSite,
  me: { owner: { _id: mockSubject }, sites: [mockSite] } }) }));
jest.mock('../lib/v2/ownerData', () => ({
  usePreview: () => ({ ready: true, htmlUrl: 'https://private.example/preview', inlineHtml: null }),
  useApprovePreview: () => mockApprove,
}));
jest.mock('expo-av', () => ({ Video: 'Video', ResizeMode: { CONTAIN: 'contain' }, Audio: {
  setAudioModeAsync: (...args: unknown[]) => mockAudioMode(...args),
  Sound: { createAsync: (...args: unknown[]) => mockCreateSound(...args) },
} }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);
function deferred<T>() {
  let resolve!: (result: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  jest.clearAllMocks(); ownerIntake.clear(); mockSubject = 'owner-a'; mockConnected = true;
  mockSite = { submissionId: 'site-a', businessName: 'Ben Barber', phase: 'ready_to_check' };
  mockApprove.mockReset().mockResolvedValue({ next: 'pay' });
  mockAudioMode.mockReset().mockResolvedValue(undefined);
  Object.values(mockSound).forEach(method => method.mockReset().mockResolvedValue(undefined));
  mockCreateSound.mockReset().mockImplementation(async (_source, _options, callback) => {
    mockStatus = callback;
    callback({ isLoaded: true, isPlaying: true });
    return { sound: mockSound };
  });
});

it('replays a completed audio answer even after didJustFinish has cleared', async () => {
  const screen = wrap(<OwnerMediaPreview uri="file://answer.m4a" kind="audio" label="My answer" onClose={jest.fn()} />);
  await act(async () => { fireEvent.press(screen.getByText('Listen to this answer')); });
  act(() => mockStatus({ isLoaded: true, isPlaying: false, didJustFinish: true, positionMillis: 8000, durationMillis: 8000 }));
  mockSound.getStatusAsync.mockResolvedValue({ isLoaded: true, isPlaying: false, didJustFinish: false, positionMillis: 8000, durationMillis: 8000 });
  await act(async () => { fireEvent.press(screen.getByText('Listen to this answer')); });
  expect(mockSound.replayAsync).toHaveBeenCalledTimes(1);
  expect(mockSound.playAsync).not.toHaveBeenCalled();
});

it('unloads a late audio player when the media preview has already closed', async () => {
  const creation = deferred<{ sound: typeof mockSound }>();
  mockCreateSound.mockReturnValue(creation.promise);
  const screen = wrap(<OwnerMediaPreview uri="file://answer.m4a" kind="audio" label="My answer" onClose={jest.fn()} />);
  await act(async () => { fireEvent.press(screen.getByText('Listen to this answer')); });
  expect(mockCreateSound).toHaveBeenCalledTimes(1);
  screen.unmount();
  await act(async () => creation.resolve({ sound: mockSound }));
  expect(mockSound.unloadAsync).toHaveBeenCalledTimes(1);
});

it('recovers the full photo preview when a replacement photo arrives', () => {
  const preview = (uri: string) => <OwnerMediaPreview uri={uri} kind="image" label="My shop" onClose={jest.fn()} />;
  const screen = wrap(preview('https://failed.example/photo.jpg'));
  fireEvent(screen.getByTestId('owner-full-photo'), 'error');
  expect(screen.queryByTestId('owner-full-photo')).toBeNull();
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}>{preview('https://working.example/photo.jpg')}</SafeAreaProvider>);
  expect(screen.getByTestId('owner-full-photo').props.source.uri).toBe('https://working.example/photo.jpg');
});

it('keeps a cached site preview visible while blocking offline approval and change actions', () => {
  mockConnected = false;
  const screen = wrap(<CheckSite />);
  expect(screen.getByTestId('owner-preview')).toBeTruthy();
  const approve = screen.getByRole('button', { name: 'Looks good' });
  const change = screen.getByRole('button', { name: 'Ask for a change' });
  expect(approve).toBeDisabled(); expect(change).toBeDisabled();
  fireEvent.press(approve); fireEvent.press(change);
  expect(mockApprove).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled();
});

it.each(['account', 'site'])('does not apply an old approval completion to a new %s', async (change) => {
  const oldApproval = deferred<{ next: string }>(); const nextApproval = deferred<{ next: string }>();
  mockApprove.mockReturnValueOnce(oldApproval.promise).mockReturnValueOnce(nextApproval.promise);
  const screen = wrap(<CheckSite />);
  fireEvent.press(screen.getByRole('button', { name: 'Looks good' }));
  if (change === 'account') mockSubject = 'owner-b'; else mockSite = { ...mockSite, submissionId: 'site-b' };
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><CheckSite /></SafeAreaProvider>);
  fireEvent.press(screen.getByRole('button', { name: 'Looks good' }));
  expect(mockApprove).toHaveBeenCalledTimes(2);
  await act(async () => oldApproval.resolve({ next: 'pay' }));
  expect(mockReplace).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Looks good' }).props.accessibilityState.busy).toBe(true);
  await act(async () => nextApproval.resolve({ next: 'publish' }));
  expect(mockReplace).toHaveBeenCalledWith('/(owner)/live');
});

it('renders a structured approval failure as readable error text', async () => {
  mockApprove.mockRejectedValue(Object.assign(new Error('Please try again later.'), { data: { code: 'TEMPORARY' } }));
  const screen = wrap(<CheckSite />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Looks good' })); });
  expect(screen.getByText('Please try again later.')).toBeTruthy();
});
