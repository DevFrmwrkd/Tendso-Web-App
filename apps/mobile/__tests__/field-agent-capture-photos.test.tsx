import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import SubmitPhotosScreen from '../app/(app)/submit/photos';
import { Button } from '../components/v2';
import type { ShotGuideProps } from '../components/v2/capture/ShotGuide';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockUpload = jest.fn();
const mockUpdate = jest.fn();
const mockFetch = jest.fn();
const mockPermission = jest.fn();
const mockLibrary = jest.fn();
const mockImageSave = jest.fn();
const mockWrite = jest.fn();
let mockActor: string;
let mockOnline: boolean;
let mockRevision: number;
let mockFocused: boolean;
let mockGuide: ShotGuideProps;
let mockCache: Record<string, Record<string, any>>;
let mockSubmissions: Record<string, any>;
const mockClone = (value: unknown) => value == null ? null : JSON.parse(JSON.stringify(value));

jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => {
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]);
} }));
jest.mock('../hooks/useCaptureSession', () => ({ useCaptureSession: () => {
  const actor = mockActor;
  const isCurrent = () => mockActor === actor;
  return {
    actor: { creatorId: actor, clerkId: `clerk-${actor}` }, actorKey: actor, isReady: true, revision: mockRevision,
    isOffline: !mockOnline, canQuery: mockOnline, isCurrent, canMutate: () => isCurrent() && mockOnline,
    read: async (key: string) => isCurrent() ? mockClone(mockCache[actor]?.[key]) : null,
    write: async (key: string, value: unknown) => { if (!isCurrent()) throw new Error('Account changed'); mockWrite(actor, key, value); mockCache[actor][key] = mockClone(value); },
    remove: async (key: string) => { if (isCurrent()) delete mockCache[actor][key]; },
  };
} }));
jest.mock('@tendso/convex-client', () => ({ api: {
  submissions: { getById: 'submission', update: 'update' }, files: { getMultipleUrls: 'urls' }, r2: { generateUploadUrl: 'upload' },
} }));
jest.mock('convex/react', () => ({
  useQuery: (reference: string, args: any) => args === 'skip' ? undefined : reference === 'submission'
    ? mockSubmissions[args.id] : args.storageIds.map((key: string) => `https://images.example.com/${key}`),
  useMutation: () => mockUpdate, useAction: () => mockUpload,
}));
jest.mock('../components/OfflineBanner', () => ({ OfflineBanner: () => null }));
jest.mock('../components/v2/capture', () => ({ ShotGuide: (props: ShotGuideProps) => {
  mockGuide = props;
  return require('react').createElement(require('react-native').View, { testID: 'guided-camera' });
} }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: () => mockPermission(),
  launchImageLibraryAsync: (...args: unknown[]) => mockLibrary(...args),
}));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (uri: string) => ({ resize: () => ({ renderAsync: async () => ({
    saveAsync: async (options: unknown) => { mockImageSave(options); return { uri: `file://jpeg-${uri.split('/').at(-1)}` }; },
  }) }) }) }, SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Defs: 'Defs', LinearGradient: 'Gradient', Rect: 'Rect', Stop: 'Stop' }));

const originalFetch = global.fetch;
const localItems = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `local-${index}`, uri: `file://photo-${index}.jpg`, taskIndex: index }));
const photoDraft = (items: unknown[], submissionId = 'draft-1') => ({ version: 1, submissionId, businessType: 'Barber/Salon', items, removedExistingPhotos: [] });
const screenReady = async () => {
  const screen = render(<SubmitPhotosScreen />);
  await waitFor(() => expect(screen.getByText('Show us the shop')).toBeTruthy());
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Continue to interview' })
    ?? screen.getByRole('button', { name: 'Start taking photos' })).toBeEnabled());
  return screen;
};
beforeEach(() => {
  jest.clearAllMocks(); mockActor = 'agent-1'; mockOnline = true; mockRevision = 0; mockFocused = true;
  mockCache = { 'agent-1': { current_submission_id: 'draft-1' } };
  mockSubmissions = { 'draft-1': { _id: 'draft-1', creatorId: 'agent-1', businessType: 'Barber/Salon', photos: [] } };
  mockUpload.mockReset().mockImplementation(async () => ({ uploadUrl: 'https://upload.example.com', fileKey: `uploaded-${mockUpload.mock.calls.length}` }));
  mockUpdate.mockReset().mockResolvedValue(undefined);
  mockPermission.mockReset().mockResolvedValue({ status: 'granted' });
  mockLibrary.mockReset().mockResolvedValue({ canceled: false, assets: [{ uri: 'file://library.heic' }] });
  mockFetch.mockReset().mockImplementation(async (url: string) => url.startsWith('file:') ? { blob: async () => ({ type: 'image/jpeg' }) } : { ok: true });
  global.fetch = mockFetch as unknown as typeof fetch;
});
afterAll(() => { global.fetch = originalFetch; });

it('offers ten real suggestions and records a camera photo against its actual task without requiring all ten', async () => {
  const screen = await screenReady();
  expect(screen.getAllByRole('button', { name: /, not taken$/ })).toHaveLength(10);
  fireEvent.press(screen.getByRole('button', { name: 'Haircut in progress, not taken' }));
  expect(mockGuide.initialIndex).toBe(2);
  act(() => { mockGuide.onShot!(2, 'file://camera.heic'); mockGuide.onClose([]); });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Haircut in progress, taken. Retake photo' })).toBeTruthy());
  expect(screen.getByText('1 of 10 photos added')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Continue to interview' })).toBeNull();
  expect(mockImageSave).toHaveBeenCalledWith({ compress: 0.85, format: 'jpeg' });
  expect(mockCache['agent-1'].submission_photo_tasks.items).toEqual([expect.objectContaining({ uri: 'file://jpeg-camera.heic', taskIndex: 2 })]);
});

it('continues with three existing photos without inventing which suggestions they fulfill', async () => {
  mockSubmissions['draft-1'].photos = ['old-a', 'old-b', 'old-c'];
  const screen = await screenReady();
  await waitFor(() => expect(screen.getByText('3 of 10 photos added')).toBeTruthy());
  expect(screen.getAllByRole('button', { name: /, not taken$/ })).toHaveLength(10);
  fireEvent.press(screen.getByRole('button', { name: 'Continue to interview' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submit/interview'));
  expect(mockUpdate).toHaveBeenCalledWith({ id: 'draft-1', photos: ['old-a', 'old-b', 'old-c'] });
  expect(mockUpload).not.toHaveBeenCalled();
});

it('keeps an existing draft below three photos on the photo step', async () => {
  mockSubmissions['draft-1'].photos = ['old-a', 'old-b'];
  const screen = await screenReady();
  await waitFor(() => expect(screen.getByText('2 of 10 photos added')).toBeTruthy());
  expect(screen.queryByRole('button', { name: 'Continue to interview' })).toBeNull();
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it('caps owner extras at the remaining capacity and normalizes imported HEIC images', async () => {
  mockSubmissions['draft-1'].photos = Array.from({ length: 8 }, (_, index) => `old-${index}`);
  mockLibrary.mockResolvedValue({ canceled: false, assets: [1, 2, 3].map((index) => ({ uri: `file://extra-${index}.heic` })) });
  const screen = await screenReady();
  await waitFor(() => expect(screen.getByText('8 of 10 photos added')).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Add your own photos' }));
  await waitFor(() => expect(screen.getByText('10 of 10 photos added')).toBeTruthy());
  expect(mockLibrary).toHaveBeenCalledWith(expect.objectContaining({ selectionLimit: 2 }));
  expect(mockImageSave).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: 'Add your own photos' })).toBeDisabled();
});

it('retakes an assigned photo at the ten-photo limit without appending an eleventh or keeping its old key', async () => {
  const items = Array.from({ length: 10 }, (_, index) => ({ id: `old-${index}`, storageId: `key-${index}`, ...(index === 0 ? { taskIndex: 0 } : {}) }));
  mockCache['agent-1'].submission_photo_tasks = photoDraft(items);
  mockSubmissions['draft-1'].photos = items.map((item) => item.storageId);
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('button', { name: 'Owner headshot, taken. Retake photo' }));
  expect(mockGuide.singleShot).toBe(true); expect(mockGuide.maxCaptured).toBe(1);
  act(() => { mockGuide.onShot!(0, 'file://retake.jpg'); mockGuide.onDone([]); });
  await waitFor(() => expect(screen.queryByTestId('guided-camera')).toBeNull());
  expect(screen.getByText('10 of 10 photos added')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Continue to interview' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
  const saved = mockUpdate.mock.calls[0][0].photos;
  expect(saved).toHaveLength(10); expect(saved).not.toContain('key-0'); expect(saved).toContain('uploaded-1');
});

it('resumes assigned local photos offline and queues the existing pending-photo contract', async () => {
  mockOnline = false;
  mockCache['agent-1'] = { current_submission_id: 'offline_pending', submission_photo_tasks: photoDraft(localItems(3), 'offline_pending') };
  const screen = await screenReady();
  expect(screen.getByRole('button', { name: 'Owner headshot, taken. Retake photo' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Continue to interview' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submit/interview'));
  expect(mockCache['agent-1'].submission_pending_photos).toEqual(expect.objectContaining({
    submissionId: 'offline_pending', photoUris: localItems(3).map((item) => item.uri), existingPhotos: [], entries: localItems(3),
  }));
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
});

it('previews a local photo offline without cropping and closes without changing or sending the draft', async () => {
  mockOnline = false;
  mockCache['agent-1'] = { current_submission_id: 'offline_pending', submission_photo_tasks: photoDraft(localItems(3), 'offline_pending') };
  const screen = await screenReady();
  const saved = mockClone(mockCache['agent-1']);
  const writes = mockWrite.mock.calls.length;
  expect(screen.queryByTestId('capture-photo-preview')).toBeNull();
  expect(screen.queryByTestId('capture-photo-full-image')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'View photo 1: Owner headshot' }));
  expect(screen.getByTestId('capture-photo-preview')).toBeTruthy();
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: 'file://photo-0.jpg' });
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('resizeMode', 'contain');
  fireEvent.press(screen.getByRole('button', { name: 'Close photo' }));

  expect(screen.queryByTestId('capture-photo-preview')).toBeNull();
  expect(screen.queryByTestId('capture-photo-full-image')).toBeNull();
  expect(screen.getByText('3 of 10 photos added')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Owner headshot, taken. Retake photo' })).toBeTruthy();
  expect(mockCache['agent-1']).toEqual(saved);
  expect(mockWrite).toHaveBeenCalledTimes(writes);
  expect(mockUpload).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockFetch).not.toHaveBeenCalled(); expect(mockLibrary).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
});

it('dismisses the preview through the native Android back request without navigating away or losing photos', async () => {
  mockOnline = false;
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  const saved = mockClone(mockCache['agent-1']);
  const writes = mockWrite.mock.calls.length;
  fireEvent.press(screen.getByRole('button', { name: 'View photo 1: Owner headshot' }));
  fireEvent(screen.getByTestId('capture-photo-preview'), 'requestClose');

  expect(screen.queryByTestId('capture-photo-preview')).toBeNull();
  expect(screen.getByRole('button', { name: 'Continue to interview' })).toBeEnabled();
  expect(mockCache['agent-1']).toEqual(saved); expect(mockWrite).toHaveBeenCalledTimes(writes);
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  expect(mockRouter.back).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('previews the selected stored extra using its resolved remote URL without adding or uploading a photo', async () => {
  mockSubmissions['draft-1'].photos = ['stored-a', 'stored-b', 'stored-c'];
  const screen = await screenReady();
  await waitFor(() => expect(screen.getByRole('button', { name: 'View photo 2: Added photo' })).toBeTruthy());
  await waitFor(() => expect(mockCache['agent-1'].submission_photo_tasks?.items).toHaveLength(3));
  const saved = mockClone(mockCache['agent-1']);
  const writes = mockWrite.mock.calls.length;

  fireEvent.press(screen.getByRole('button', { name: 'View photo 2: Added photo' }));
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: 'https://images.example.com/stored-b' });
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('resizeMode', 'contain');
  fireEvent.press(screen.getByRole('button', { name: 'Close photo' }));

  expect(screen.queryByTestId('capture-photo-preview')).toBeNull();
  expect(mockCache['agent-1']).toEqual(saved); expect(mockWrite).toHaveBeenCalledTimes(writes);
  expect(mockSubmissions['draft-1'].photos).toEqual(['stored-a', 'stored-b', 'stored-c']);
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
});

it('ignores a previous photo’s delayed load error and recovers from the current photo’s failure without changing the draft', async () => {
  mockOnline = false;
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  const saved = mockClone(mockCache['agent-1']);
  const writes = mockWrite.mock.calls.length;
  const failure = { nativeEvent: { error: 'Photo could not load' } };

  fireEvent.press(screen.getByRole('button', { name: 'View photo 1: Owner headshot' }));
  const previousError = screen.getByTestId('capture-photo-full-image').props.onError;
  expect(typeof previousError).toBe('function');
  fireEvent.press(screen.getByRole('button', { name: 'Close photo' }));
  fireEvent.press(screen.getByRole('button', { name: /^View photo 2:/ }));
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: 'file://photo-1.jpg' });

  act(() => { previousError(failure); });
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: 'file://photo-1.jpg' });
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('resizeMode', 'contain');
  expect(screen.queryByRole('alert')).toBeNull();

  fireEvent(screen.getByTestId('capture-photo-full-image'), 'error', failure);
  expect(screen.queryByTestId('capture-photo-full-image')).toBeNull();
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load this photo. Close the preview and try again.');
  fireEvent.press(screen.getByRole('button', { name: 'Close photo' }));

  expect(screen.queryByTestId('capture-photo-preview')).toBeNull();
  expect(screen.getByText('3 of 10 photos added')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Continue to interview' })).toBeEnabled();
  expect(mockCache['agent-1']).toEqual(saved); expect(mockWrite).toHaveBeenCalledTimes(writes);
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
});

it('clears a preview when the capture actor changes and only opens the new actor’s own photo', async () => {
  mockOnline = false;
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('button', { name: 'View photo 1: Owner headshot' }));
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: 'file://photo-0.jpg' });
  const original = mockClone(mockCache['agent-1']);

  mockActor = 'agent-2';
  mockCache['agent-2'] = { current_submission_id: 'draft-2', submission_photo_tasks: photoDraft(
    localItems(3).map(item => ({ ...item, uri: `file://other-${item.id}.jpg` })), 'draft-2') };
  screen.rerender(<SubmitPhotosScreen />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'View photo 1: Owner headshot' })).toBeTruthy());
  expect(screen.queryByTestId('capture-photo-preview')).toBeNull();
  expect(screen.queryByTestId('capture-photo-full-image')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'View photo 1: Owner headshot' }));
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: 'file://other-local-0.jpg' });
  expect(mockCache['agent-1']).toEqual(original);
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('dismisses an open preview when the same actor switches to a different capture draft', async () => {
  mockOnline = false;
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('button', { name: 'View photo 1: Owner headshot' }));
  expect(screen.getByTestId('capture-photo-preview')).toBeTruthy();

  mockCache['agent-1'] = { current_submission_id: 'draft-2', submission_photo_tasks: photoDraft(
    localItems(3).map(item => ({ ...item, uri: `file://next-${item.id}.jpg` })), 'draft-2') };
  mockRevision += 1;
  screen.rerender(<SubmitPhotosScreen />);
  await waitFor(() => expect(screen.queryByTestId('capture-photo-preview')).toBeNull());
  expect(screen.queryByTestId('capture-photo-full-image')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'View photo 1: Owner headshot' }));
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: 'file://next-local-0.jpg' });
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('dismisses the preview on focus loss and returns to the same saved draft without reopening it', async () => {
  mockOnline = false;
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  const saved = mockClone(mockCache['agent-1']);
  fireEvent.press(screen.getByRole('button', { name: 'View photo 1: Owner headshot' }));
  expect(screen.getByTestId('capture-photo-preview')).toBeTruthy();

  mockFocused = false;
  screen.rerender(<SubmitPhotosScreen />);
  await waitFor(() => expect(screen.queryByTestId('capture-photo-preview')).toBeNull());
  mockFocused = true;
  screen.rerender(<SubmitPhotosScreen />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'View photo 1: Owner headshot' })).toBeTruthy());
  expect(screen.queryByTestId('capture-photo-preview')).toBeNull();
  expect(screen.getByText('3 of 10 photos added')).toBeTruthy(); expect(mockCache['agent-1']).toEqual(saved);
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
});

it('reuses uploaded keys on retry instead of uploading the same photos twice', async () => {
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  mockUpdate.mockRejectedValueOnce(new Error('Temporary server failure')).mockResolvedValueOnce(undefined);
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('button', { name: 'Continue to interview' }));
  await waitFor(() => expect(screen.getByText('Temporary server failure')).toBeTruthy());
  expect(mockUpload).toHaveBeenCalledTimes(3);
  fireEvent.press(screen.getByRole('button', { name: 'Continue to interview' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(1));
  expect(mockUpload).toHaveBeenCalledTimes(3);
  expect(mockUpdate.mock.calls[1][0].photos).toEqual(mockUpdate.mock.calls[0][0].photos);
});

it('deduplicates direct Continue taps while an upload is pending', async () => {
  let release!: (value: { uploadUrl: string; fileKey: string }) => void;
  mockUpload.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  const next = screen.UNSAFE_getAllByType(Button).find((button) => button.props.title === 'Continue to interview')!;
  act(() => { void next.props.onPress(); void next.props.onPress(); });
  await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
  await act(async () => { release({ uploadUrl: 'https://upload.example.com', fileKey: 'first-key' }); });
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(1));
  expect(mockUpdate).toHaveBeenCalledTimes(1); expect(mockUpload).toHaveBeenCalledTimes(3);
});

it('does not upload or update the next actor after the account changes during upload preparation', async () => {
  let release!: (value: { uploadUrl: string; fileKey: string }) => void;
  mockUpload.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('button', { name: 'Continue to interview' }));
  await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
  mockActor = 'agent-2'; mockCache['agent-2'] = { current_submission_id: 'draft-2' };
  mockSubmissions['draft-2'] = { ...mockSubmissions['draft-1'], _id: 'draft-2', creatorId: 'agent-2' };
  screen.rerender(<SubmitPhotosScreen />);
  await act(async () => { release({ uploadUrl: 'https://upload.example.com', fileKey: 'stale-key' }); });
  await waitFor(() => expect(screen.getByText('0 of 10 photos added')).toBeTruthy());
  expect(mockFetch).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
});

it('ignores metadata for another draft and refuses a server draft owned by another creator', async () => {
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3), 'different-draft');
  const screen = await screenReady();
  expect(screen.getByText('0 of 10 photos added')).toBeTruthy();
  mockSubmissions['draft-1'] = { ...mockSubmissions['draft-1'], creatorId: 'someone-else' };
  screen.rerender(<SubmitPhotosScreen />);
  expect(screen.getByText('Draft unavailable')).toBeTruthy();
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('does not redirect a later screen when the hidden photo step observes the final draft pointer being cleared', async () => {
  const screen = await screenReady();
  mockFocused = false;
  screen.rerender(<SubmitPhotosScreen />);
  delete mockCache['agent-1'].current_submission_id;
  mockRevision += 1;
  screen.rerender(<SubmitPhotosScreen />);
  await act(async () => { await Promise.resolve(); });
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('keeps photos as extras when a changed shop kind makes the old suggestion assignments inaccurate', async () => {
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  expect(screen.getByRole('button', { name: 'Haircut in progress, taken. Retake photo' })).toBeTruthy();
  mockSubmissions['draft-1'] = { ...mockSubmissions['draft-1'], businessType: 'Restaurant' };
  screen.rerender(<SubmitPhotosScreen />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Owner cooking, not taken' })).toBeTruthy());
  expect(screen.getAllByRole('button', { name: /, not taken$/ })).toHaveLength(10);
  expect(screen.getByText('3 of 10 photos added')).toBeTruthy();
  await waitFor(() => expect(mockCache['agent-1'].submission_photo_tasks.items.every((item: any) => item.taskIndex === undefined)).toBe(true));
  expect(mockCache['agent-1'].submission_photo_tasks.items.map((item: any) => item.uri)).toEqual(localItems(3).map((item) => item.uri));
});

it('uses the saved shop snapshot for an online-created draft opened offline', async () => {
  mockOnline = false;
  mockCache['agent-1'].submission_snapshot = { submissionId: 'draft-1', businessType: 'Restaurant' };
  const screen = await screenReady();
  expect(screen.getByRole('button', { name: 'Owner cooking, not taken' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Haircut in progress, not taken' })).toBeNull();
});
