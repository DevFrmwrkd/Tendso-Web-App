import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { Alert, BackHandler } from 'react-native';
import SubmitPhotosScreen from '../app/(app)/submit/photos';
import { Button } from '../components/v2';
import type { ShotGuideProps } from '../components/v2/capture/ShotGuide';
import { retainCapturePhoto } from '../services/capturePhotoFiles';
import { CapturePhotoPager } from '../components/field-agent/CapturePhotoPager';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockUpload = jest.fn();
const mockUpdate = jest.fn();
const mockFetch = jest.fn();
const mockPermission = jest.fn();
const mockLibrary = jest.fn();
const mockImageSave = jest.fn();
const mockWrite = jest.fn();
const mockFileInfo = jest.fn();
const mockFileCopy = jest.fn();
const mockFileDirectory = jest.fn();
let mockParams: Record<string, string>;
let mockActor: string;
let mockOnline: boolean;
let mockRevision: number;
let mockFocused: boolean;
let mockGuide: ShotGuideProps;
let mockCache: Record<string, Record<string, any>>;
let mockSubmissions: Record<string, any>;
const mockClone = (value: unknown) => value == null ? null : JSON.parse(JSON.stringify(value));

jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useFocusEffect: (effect: () => void | (() => void)) => {
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]);
} }));
jest.mock('../hooks/useCaptureProgress', () => ({ useCaptureProgress: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///documents/',
  getInfoAsync: (uri: string) => mockFileInfo(uri), copyAsync: (options: unknown) => mockFileCopy(options),
  makeDirectoryAsync: (uri: string, options: unknown) => mockFileDirectory(uri, options),
}));
jest.mock('../hooks/useCaptureSession', () => ({ useCaptureSession: () => {
  const actor = mockActor;
  const isCurrent = () => mockActor === actor;
  return {
    actor: { creatorId: actor, clerkId: `clerk-${actor}` }, actorKey: actor, isReady: true, revision: mockRevision,
    isOffline: !mockOnline, canQuery: mockOnline, isCurrent, canMutate: () => isCurrent() && mockOnline,
    read: async (key: string) => isCurrent() ? mockClone(mockCache[actor]?.[key]) : null,
    write: async (key: string, value: unknown) => { if (!isCurrent()) throw new Error('Account changed'); await mockWrite(actor, key, value); mockCache[actor][key] = mockClone(value); },
    remove: async (key: string) => { if (isCurrent()) delete mockCache[actor][key]; },
  };
} }));
jest.mock('@tendso/convex-client', () => ({ api: {
  submissions: { getById: 'submission', update: 'update' }, files: { getMultipleUrls: 'urls' }, r2: { generateUploadUrl: 'upload' },
} }));
jest.mock('convex/react', () => ({
  useQuery: (reference: string, args: any) => args === 'skip' ? undefined : reference === 'submission'
    ? mockSubmissions[args.id] == null ? mockSubmissions[args.id] : { status: 'draft', ...mockSubmissions[args.id] }
    : args.storageIds.map((key: string) => `https://images.example.com/${key}`),
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
const LOCAL_URI = 'file:///documents/capture-photos/agent-1/draft-1/';
const localItems = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `local-${index}`, uri: `${LOCAL_URI}photo-${index}.jpg`, taskIndex: index }));
const photoDraft = (items: unknown[], submissionId = 'draft-1') => ({ version: 1, submissionId, businessType: 'Barber/Salon', items, removedExistingPhotos: [] });
const copiedUri = (source: string) => mockFileCopy.mock.calls.find(call => call[0].from === source)?.[0].to;
const screenReady = async () => {
  const screen = render(<SubmitPhotosScreen />);
  await waitFor(() => expect(screen.getByText('Show us the shop')).toBeTruthy());
  if (screen.queryByRole('button', { name: 'Save reviewed photos' })) return screen;
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save changes' }) ?? screen.queryByRole('button', { name: 'Continue to interview' })
    ?? screen.queryByRole('button', { name: 'Replace missing photos' }) ?? screen.getByRole('button', { name: 'Start taking photos' })).toBeEnabled());
  return screen;
};
const measurePhotoPreview = (screen: ReturnType<typeof render>) => {
  fireEvent(screen.getByTestId('capture-photo-pager'), 'layout', { nativeEvent: { layout: { width: 390, height: 500 } } });
};
const openPhotoPreview = (screen: ReturnType<typeof render>, name: string | RegExp) => {
  fireEvent.press(screen.getByRole('button', { name }));
  measurePhotoPreview(screen);
};
const nativePhotoScroll = (screen: ReturnType<typeof render>, index: number) => {
  const pager = screen.UNSAFE_getByType(CapturePhotoPager);
  const from = pager.props.photoIds.indexOf(pager.props.selectedPhotoId);
  fireEvent(screen.getByTestId('capture-photo-pager'), 'layout', { nativeEvent: { layout: { width: 390, height: 500 } } });
  const scroll = screen.getByTestId('capture-photo-pager-scroll');
  const event = (page: number) => ({ nativeEvent: { contentOffset: { x: page * 390, y: 0 },
    layoutMeasurement: { width: 390, height: 500 }, contentSize: { width: pager.props.photoIds.length * 390, height: 500 },
    velocity: { x: 0, y: 0 }, targetContentOffset: { x: page * 390, y: 0 } } });
  fireEvent(scroll, 'scrollBeginDrag', event(from));
  fireEvent.scroll(scroll, event(index));
  fireEvent(scroll, 'scrollEndDrag', event(index));
  fireEvent(scroll, 'momentumScrollEnd', event(index));
};
beforeEach(() => {
  jest.clearAllMocks(); mockActor = 'agent-1'; mockOnline = true; mockRevision = 0; mockFocused = true; mockParams = {};
  mockWrite.mockReset();
  mockCache = { 'agent-1': { current_submission_id: 'draft-1' } };
  mockSubmissions = { 'draft-1': { _id: 'draft-1', creatorId: 'agent-1', businessType: 'Barber/Salon', photos: [] } };
  mockUpload.mockReset().mockImplementation(async () => ({ uploadUrl: 'https://upload.example.com', fileKey: `uploaded-${mockUpload.mock.calls.length}` }));
  mockUpdate.mockReset().mockResolvedValue(undefined);
  mockPermission.mockReset().mockResolvedValue({ status: 'granted' });
  mockLibrary.mockReset().mockResolvedValue({ canceled: false, assets: [{ uri: 'file://library.heic' }] });
  mockFileInfo.mockReset().mockImplementation(async (uri: string) => ({ exists: true, isDirectory: false, uri }));
  mockFileCopy.mockReset().mockResolvedValue(undefined); mockFileDirectory.mockReset().mockResolvedValue(undefined);
  mockFetch.mockReset().mockImplementation(async (url: string) => url.startsWith('file:') ? { blob: async () => ({ type: 'image/jpeg' }) } : { ok: true });
  global.fetch = mockFetch as unknown as typeof fetch;
});
afterAll(() => { global.fetch = originalFetch; });

it('keeps all stored photos on a rejected capture and saves the same ID without requiring new pictures', async () => {
  mockSubmissions['draft-1'] = { _id: 'draft-1', creatorId: 'agent-1', status: 'rejected',
    businessType: 'Barber/Salon', photos: ['kept-one', 'kept-two', 'kept-three'], rejectionReason: 'Correct the owner name.' };
  const screen = await screenReady();
  await waitFor(() => expect(screen.getByText('3 of 10 photos added')).toBeTruthy());
  expect(screen.getByText('Correct the owner name.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ id: 'draft-1', photos: ['kept-one', 'kept-two', 'kept-three'] }));
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockRouter.back).toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
});

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
  expect(mockFileCopy).toHaveBeenCalledWith({ from: 'file://jpeg-camera.heic', to: expect.stringMatching(/^file:\/\/\/documents\/capture-photos\/agent-1\/draft-1\/.+\.jpg$/) });
  expect(mockCache['agent-1'].submission_photo_tasks.items).toEqual([expect.objectContaining({ uri: mockFileCopy.mock.calls[0][0].to, taskIndex: 2 })]);
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
  await act(async () => { mockGuide.onShot!(0, 'file://retake.jpg'); mockGuide.onDone([]); });
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

  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  expect(screen.getByTestId('capture-photo-preview')).toBeTruthy();
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: `${LOCAL_URI}photo-0.jpg` });
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

it('browses the photo sequence in full screen with counters and no wrapping or capture writes', async () => {
  mockOnline = false; mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  const writes = mockWrite.mock.calls.length;
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  expect(screen.getByText('1 of 3')).toBeTruthy(); expect(screen.queryByText('Photo 1')).toBeNull();
  expect(screen.getByRole('button', { name: 'Previous photo' })).toBeDisabled();
  nativePhotoScroll(screen, 1);
  expect(screen.getByText('2 of 3')).toBeTruthy();
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: localItems(3)[1].uri });
  fireEvent.press(screen.getByRole('button', { name: 'Next photo' }));
  expect(screen.getByText('3 of 3')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Next photo' })).toBeDisabled();
  nativePhotoScroll(screen, 3);
  expect(screen.getByText('3 of 3')).toBeTruthy();
  nativePhotoScroll(screen, 1);
  expect(screen.getByText('2 of 3')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Previous photo' }));
  expect(screen.getByText('1 of 3')).toBeTruthy();
  expect(mockWrite).toHaveBeenCalledTimes(writes); expect(mockUpdate).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
});

it('ignores the previous image load failure after swiping to the next photo', async () => {
  mockOnline = false; mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  const oldFailure = screen.getByTestId('capture-photo-full-image').props.onError;
  fireEvent.press(screen.getByRole('button', { name: 'Next photo' }));
  act(() => oldFailure());
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: localItems(3)[1].uri });
  expect(screen.queryByRole('alert')).toBeNull();
});

it('pauses editing during native paging and replaces only the photo where the gallery settles', async () => {
  mockOnline = false; mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  fireEvent(screen.getByTestId('capture-photo-pager'), 'layout', { nativeEvent: { layout: { width: 390, height: 500 } } });
  const scroll = screen.getByTestId('capture-photo-pager-scroll');
  fireEvent(scroll, 'scrollBeginDrag', { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
  expect(screen.getByRole('button', { name: 'Retake photo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Replace photo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next photo' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Replace photo' }));
  expect(mockLibrary).not.toHaveBeenCalled();
  const end = { nativeEvent: { contentOffset: { x: 390, y: 0 }, layoutMeasurement: { width: 390, height: 500 },
    contentSize: { width: 1170, height: 500 }, velocity: { x: 0, y: 0 }, targetContentOffset: { x: 390, y: 0 } } };
  fireEvent.scroll(scroll, end); fireEvent(scroll, 'scrollEndDrag', end); fireEvent(scroll, 'momentumScrollEnd', end);
  expect(screen.getByText('2 of 3')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Replace photo' })).toBeEnabled();
  fireEvent.press(screen.getByRole('button', { name: 'Replace photo' }));
  await waitFor(() => expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: copiedUri('file://jpeg-library.heic') }));
  const saved = mockCache['agent-1'].submission_photo_tasks.items;
  expect(saved[1]).toMatchObject({ id: 'local-1', taskIndex: 1, label: 'Profile picture' });
  expect(saved[0]).toEqual(localItems(3)[0]); expect(saved[2]).toEqual(localItems(3)[2]);
  expect(screen.getByText('2 of 3')).toBeTruthy();
});

it('retakes the viewed photo at the ten-photo limit and returns to that same image and position', async () => {
  mockOnline = false;
  const items = Array.from({ length: 10 }, (_, i) => ({ id: `view-${i}`, storageId: `key-${i}`, label: `Shop view ${i + 1}` }));
  mockCache['agent-1'].submission_photo_tasks = photoDraft(items);
  const screen = await screenReady();
  openPhotoPreview(screen, 'View photo 4: Shop view 4');
  fireEvent.press(screen.getByRole('button', { name: 'Retake photo' }));
  expect(mockGuide.tasks[0].t).toBe('Shop view 4'); expect(mockGuide.singleShot).toBe(true);
  act(() => { mockGuide.onShot!(0, 'file://full-retake.heic'); mockGuide.onClose([]); });
  await waitFor(() => expect(screen.getByTestId('capture-photo-pager')).toBeTruthy());
  measurePhotoPreview(screen);
  await waitFor(() => expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: copiedUri('file://jpeg-full-retake.heic') }));
  expect(screen.getByText('4 of 10')).toBeTruthy();
  const saved = mockCache['agent-1'].submission_photo_tasks;
  expect(saved.items).toHaveLength(10); expect(saved.items[3]).toMatchObject({ id: 'view-3', label: 'Shop view 4' });
  expect(saved.items[2]).toEqual(items[2]); expect(saved.items[4]).toEqual(items[4]);
  expect(saved.removedExistingPhotos).toContain('key-3');
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  const fileChecks = mockFileInfo.mock.calls.length;
  mockRevision++; screen.rerender(<SubmitPhotosScreen />);
  // A same-capture refresh must neither dismiss the selected retake nor
  // temporarily replace its full-screen viewer with the initial loader.
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: copiedUri('file://jpeg-full-retake.heic') });
  expect(screen.getByText('4 of 10')).toBeTruthy();
  await waitFor(() => expect(mockFileInfo.mock.calls.length).toBeGreaterThan(fileChecks));
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: copiedUri('file://jpeg-full-retake.heic') });
  expect(screen.getByText('4 of 10')).toBeTruthy();
});

it('returns to the unchanged viewed photo when a retake is cancelled', async () => {
  mockOnline = false; mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady(); const saved = mockClone(mockCache['agent-1']);
  openPhotoPreview(screen, 'View photo 2: Profile picture');
  fireEvent.press(screen.getByRole('button', { name: 'Retake photo' }));
  act(() => mockGuide.onClose([]));
  await waitFor(() => expect(screen.getByTestId('capture-photo-pager')).toBeTruthy());
  measurePhotoPreview(screen);
  await waitFor(() => expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: localItems(3)[1].uri }));
  expect(screen.getByText('2 of 3')).toBeTruthy(); expect(mockCache['agent-1']).toEqual(saved);
});

it('replaces the viewed image in place and preserves its label and every other photo', async () => {
  mockOnline = false;
  const items = ['owner', 'front', 'tools'].map((storageId, i) => ({ id: `stored-${i}`, storageId, label: ['The owner', 'Shop front', 'Tools'][i] }));
  mockCache['agent-1'].submission_photo_tasks = photoDraft(items);
  const screen = await screenReady();
  openPhotoPreview(screen, 'View photo 2: Shop front');
  fireEvent.press(screen.getByRole('button', { name: 'Replace photo' }));
  await waitFor(() => expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: copiedUri('file://jpeg-library.heic') }));
  expect(screen.getByText('2 of 3')).toBeTruthy();
  expect(mockLibrary).toHaveBeenCalledWith(expect.objectContaining({ allowsMultipleSelection: false, selectionLimit: 1 }));
  const saved = mockCache['agent-1'].submission_photo_tasks;
  expect(saved.items[1]).toMatchObject({ id: 'stored-1', label: 'Shop front' });
  expect(saved.items[0]).toEqual(items[0]); expect(saved.items[2]).toEqual(items[2]);
  expect(saved.removedExistingPhotos).toContain('front');
  const fileChecks = mockFileInfo.mock.calls.length;
  mockRevision++; screen.rerender(<SubmitPhotosScreen />);
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: copiedUri('file://jpeg-library.heic') });
  expect(screen.getByText('2 of 3')).toBeTruthy();
  await waitFor(() => expect(mockFileInfo.mock.calls.length).toBeGreaterThan(fileChecks));
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: copiedUri('file://jpeg-library.heic') });
  expect(screen.getByText('2 of 3')).toBeTruthy();
});

it('keeps the viewer and its original photo when the library is cancelled', async () => {
  mockOnline = false; mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  mockLibrary.mockResolvedValueOnce({ canceled: true, assets: [] });
  const screen = await screenReady(); const saved = mockClone(mockCache['agent-1']);
  openPhotoPreview(screen, 'View photo 2: Profile picture');
  fireEvent.press(screen.getByRole('button', { name: 'Replace photo' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Replace photo' })).toBeEnabled());
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: localItems(3)[1].uri });
  expect(screen.getByText('2 of 3')).toBeTruthy(); expect(mockCache['agent-1']).toEqual(saved);
});

it('shows a replacement failure inside the viewer and retains the original image', async () => {
  mockOnline = false; mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  mockLibrary.mockRejectedValueOnce(new Error('The photo library could not open.'));
  const screen = await screenReady();
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  fireEvent.press(screen.getByRole('button', { name: 'Replace photo' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not prepare those photos. Please choose them again.'));
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: localItems(3)[0].uri });
  expect(screen.getByRole('button', { name: 'Retake photo' })).toBeEnabled();
  expect(mockCache['agent-1'].submission_photo_tasks.items).toEqual(localItems(3));
});

it('rejects old viewer actions after navigation and disables browsing during a replacement', async () => {
  mockOnline = false; mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  // RN/NativeWind can wrap Pressable, so capture the original action from the
  // accessible button's own ancestry rather than matching a component type.
  const viewerAction = (name: string): (() => void) => {
    let node: ReturnType<typeof screen.getByRole> | null = screen.getByRole('button', { name });
    while (node) {
      if (node.props.accessibilityLabel === name && typeof node.props.onPress === 'function') return node.props.onPress;
      node = node.parent;
    }
    throw new Error(`Could not find the rendered ${name} action`);
  };
  const staleRetake = viewerAction('Retake photo');
  const staleReplace = viewerAction('Replace photo');
  fireEvent.press(screen.getByRole('button', { name: 'Next photo' }));
  act(() => { staleRetake(); staleReplace(); });
  expect(screen.queryByTestId('guided-camera')).toBeNull(); expect(mockLibrary).not.toHaveBeenCalled();
  let release!: (result: { status: string }) => void;
  mockPermission.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  mockLibrary.mockResolvedValueOnce({ canceled: true, assets: [] });
  fireEvent.press(screen.getByRole('button', { name: 'Replace photo' }));
  await waitFor(() => expect(mockPermission).toHaveBeenCalled());
  expect(screen.getByRole('button', { name: 'Next photo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Close photo' })).toBeDisabled();
  nativePhotoScroll(screen, 2);
  expect(screen.getByText('2 of 3')).toBeTruthy();
  await act(async () => release({ status: 'granted' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next photo' })).toBeEnabled());
});

it('does not replace a photo in a new account when permission resolves after an account change', async () => {
  mockOnline = false; mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  let release!: (result: { status: string }) => void;
  mockPermission.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const screen = await screenReady();
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  fireEvent.press(screen.getByRole('button', { name: 'Replace photo' }));
  const original = mockClone(mockCache['agent-1']);
  mockActor = 'agent-2';
  mockCache['agent-2'] = { current_submission_id: 'draft-2', submission_photo_tasks: photoDraft(localItems(3), 'draft-2') };
  screen.rerender(<SubmitPhotosScreen />);
  await act(async () => release({ status: 'granted' }));
  await waitFor(() => expect(screen.queryByTestId('capture-photo-preview')).toBeNull());
  expect(mockLibrary).not.toHaveBeenCalled(); expect(mockCache['agent-1']).toEqual(original);
  expect(mockCache['agent-2'].submission_photo_tasks.items).toEqual(localItems(3));
});

it('offers Add label for an unassigned photo and keeps it unlabeled when replacing its image', async () => {
  mockOnline = false;
  mockCache['agent-1'].submission_photo_tasks = photoDraft([{ id: 'extra', storageId: 'extra-key', label: 'Added photo' }]);
  const screen = await screenReady();
  expect(screen.queryByText('Photo 1')).toBeNull();
  expect(screen.getByRole('button', { name: 'Add label to photo 1' })).toBeTruthy();
  openPhotoPreview(screen, 'View photo 1: Unlabeled photo');
  fireEvent.press(screen.getByRole('button', { name: 'Replace photo' }));
  await waitFor(() => expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: copiedUri('file://jpeg-library.heic') }));
  fireEvent.press(screen.getByRole('button', { name: 'Close photo' }));
  expect(screen.getByRole('button', { name: 'Add label to photo 1' })).toBeTruthy();
  expect(mockCache['agent-1'].submission_photo_tasks.items[0].label).toBeUndefined();
});

it('dismisses the preview through the native Android back request without navigating away or losing photos', async () => {
  mockOnline = false;
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  const saved = mockClone(mockCache['agent-1']);
  const writes = mockWrite.mock.calls.length;
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
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
  await waitFor(() => expect(screen.getByRole('button', { name: 'View photo 2: Unlabeled photo' })).toBeTruthy());
  await waitFor(() => expect(mockCache['agent-1'].submission_photo_tasks?.items).toHaveLength(3));
  const saved = mockClone(mockCache['agent-1']);
  const writes = mockWrite.mock.calls.length;

  openPhotoPreview(screen, 'View photo 2: Unlabeled photo');
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
  const continueAction = screen.UNSAFE_getAllByType(Button).find(button => button.props.title === 'Continue to interview')!.props.onPress;

  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  const previousError = screen.getByTestId('capture-photo-full-image').props.onError;
  expect(typeof previousError).toBe('function');
  fireEvent.press(screen.getByRole('button', { name: 'Close photo' }));
  openPhotoPreview(screen, /^View photo 2:/);
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: `${LOCAL_URI}photo-1.jpg` });

  act(() => { previousError(failure); });
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: `${LOCAL_URI}photo-1.jpg` });
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('resizeMode', 'contain');
  expect(screen.queryByRole('alert')).toBeNull();

  fireEvent(screen.getByTestId('capture-photo-full-image'), 'error', failure);
  expect(screen.queryByTestId('capture-photo-full-image')).toBeNull();
  expect(screen.getByRole('alert')).toHaveTextContent('This photo is no longer on this device. Retake it or choose a replacement.');
  fireEvent.press(screen.getByRole('button', { name: 'Close photo' }));

  expect(screen.queryByTestId('capture-photo-preview')).toBeNull();
  expect(screen.getByText('3 of 10 photos added')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Replace missing photos' })).toBeEnabled();
  await act(async () => continueAction());
  expect(screen.getByRole('alert')).toHaveTextContent('Replace or remove the unavailable photos before you continue.');
  expect(mockCache['agent-1']).toEqual(saved); expect(mockWrite).toHaveBeenCalledTimes(writes);
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
});

it('clears a preview when the capture actor changes and only opens the new actor’s own photo', async () => {
  mockOnline = false;
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: `${LOCAL_URI}photo-0.jpg` });
  const original = mockClone(mockCache['agent-1']);

  mockActor = 'agent-2';
  mockCache['agent-2'] = { current_submission_id: 'draft-2', submission_photo_tasks: photoDraft(
    localItems(3).map(item => ({ ...item, uri: `file://other-${item.id}.jpg` })), 'draft-2') };
  screen.rerender(<SubmitPhotosScreen />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'View photo 1: Owner headshot' })).toBeTruthy());
  expect(screen.queryByTestId('capture-photo-preview')).toBeNull();
  expect(screen.queryByTestId('capture-photo-full-image')).toBeNull();
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: copiedUri('file://other-local-0.jpg') });
  expect(mockCache['agent-1']).toEqual(original);
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('dismisses an open preview when the same actor switches to a different capture draft', async () => {
  mockOnline = false;
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  expect(screen.getByTestId('capture-photo-preview')).toBeTruthy();

  mockCache['agent-1'] = { current_submission_id: 'draft-2', submission_photo_tasks: photoDraft(
    localItems(3).map(item => ({ ...item, uri: `file://next-${item.id}.jpg` })), 'draft-2') };
  // A revision is only a refresh signal. Wait for its asynchronous pointer
  // read to identify the different capture before expecting dismissal.
  await act(async () => { mockRevision += 1; screen.rerender(<SubmitPhotosScreen />); });
  await waitFor(() => expect(screen.queryByTestId('capture-photo-preview')).toBeNull());
  expect(screen.queryByTestId('capture-photo-full-image')).toBeNull();
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: copiedUri('file://next-local-0.jpg') });
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('dismisses the preview on focus loss and returns to the same saved draft without reopening it', async () => {
  mockOnline = false;
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  const saved = mockClone(mockCache['agent-1']);
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
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
  expect(screen.getByText('Capture unavailable')).toBeTruthy();
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

it('keeps a library JPEG in durable draft storage and restores it after unmounting', async () => {
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('button', { name: 'Add your own photos' }));
  await waitFor(() => expect(mockCache['agent-1'].submission_photo_tasks?.items).toHaveLength(1));
  const saved = mockClone(mockCache['agent-1'].submission_photo_tasks.items[0]);
  expect(saved.uri).toMatch(/^file:\/\/\/documents\/capture-photos\/agent-1\/draft-1\/.+\.jpg$/);
  expect(mockFileCopy).toHaveBeenCalledWith({ from: 'file://jpeg-library.heic', to: saved.uri });
  expect(mockFileDirectory).toHaveBeenCalledWith(`${LOCAL_URI}`, { intermediates: true });
  screen.unmount();
  const reopened = await screenReady();
  openPhotoPreview(reopened, 'View photo 1: Unlabeled photo');
  expect(reopened.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: saved.uri });
  expect(mockFileCopy).toHaveBeenCalledTimes(1);
});

it('migrates an old cache photo once and keeps its file when shop suggestions change and reopen', async () => {
  const legacy = 'file:///cache/ImageManipulator/legacy.jpg';
  const items = localItems(3); items[0].uri = legacy;
  mockCache['agent-1'].submission_photo_tasks = photoDraft(items);
  const screen = await screenReady();
  await waitFor(() => expect(mockCache['agent-1'].submission_photo_tasks.items[0].uri).toBe(copiedUri(legacy)));
  const retained = mockCache['agent-1'].submission_photo_tasks.items.map((item: any) => item.uri);
  mockSubmissions['draft-1'] = { ...mockSubmissions['draft-1'], businessType: 'Restaurant' };
  screen.rerender(<SubmitPhotosScreen />);
  await waitFor(() => expect(mockCache['agent-1'].submission_photo_tasks.items.every((item: any) => item.taskIndex === undefined)).toBe(true));
  expect(mockCache['agent-1'].submission_photo_tasks.items.map((item: any) => item.uri)).toEqual(retained);
  screen.unmount();
  const reopened = await screenReady();
  openPhotoPreview(reopened, 'View photo 1: Owner headshot');
  expect(reopened.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: retained[0] });
  expect(mockFileCopy).toHaveBeenCalledTimes(1);
  expect(reopened.getByText('3 of 10 photos added')).toBeTruthy();
});

function changedLawPhotos() {
  const items = [
    { id: 'office-portrait', storageId: 'portrait-key', taskIndex: 0, label: 'Lawyer portrait' },
    { id: 'office-sign', storageId: 'sign-key', taskIndex: 3, label: 'Office sign' },
    { id: 'office-room', storageId: 'room-key', taskIndex: 5, label: 'Consultation space' },
  ];
  mockSubmissions['draft-1'] = { ...mockSubmissions['draft-1'], businessType: 'Auto Shop', photos: items.map(item => item.storageId), videoUrl: 'https://example.test/kept-interview.mp4' };
  mockCache['agent-1'].submission_snapshot = { submissionId: 'draft-1', creatorId: 'agent-1', businessType: 'Auto Shop' };
  mockCache['agent-1'].submission_photo_tasks = { ...photoDraft(items), businessType: 'Law Office', shotListKey: 'law' };
  mockCache['agent-1'].submission_photo_review = { submissionId: 'draft-1', previousBusinessType: 'Law Office', businessType: 'Auto Shop', requiredAt: 100 };
  return items;
}

it('keeps old labels and photos but requires explicit review against the new shop guide', async () => {
  const items = changedLawPhotos(); mockParams = { returnTo: 'review' };
  const screen = await screenReady();
  await waitFor(() => expect(screen.getByText('Review photos for Auto Shop')).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Work bay, not taken' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'View photo 2: Office sign' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save reviewed photos' })).toBeDisabled();
  fireEvent.press(screen.getByRole('checkbox', { name: 'I reviewed these photos for Auto Shop' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save reviewed photos' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ id: 'draft-1', photos: items.map(item => item.storageId) }));
  await waitFor(() => expect(mockCache['agent-1'].submission_photo_review.confirmedAt).toEqual(expect.any(Number)));
  expect(mockRouter.back).toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockCache['agent-1'].submission_photo_tasks.items.map((item: any) => item.label)).toEqual(items.map(item => item.label));
});

it('keeps review pending after a failed photo save and after reopening', async () => {
  changedLawPhotos(); mockUpdate.mockRejectedValueOnce(new Error('Could not save photos'));
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('checkbox', { name: 'I reviewed these photos for Auto Shop' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save reviewed photos' }));
  await waitFor(() => expect(screen.getByText('Could not save photos')).toBeTruthy());
  expect(mockCache['agent-1'].submission_photo_review.confirmedAt).toBeUndefined();
  screen.unmount(); const reopened = await screenReady();
  expect(reopened.getByRole('checkbox', { name: 'I reviewed these photos for Auto Shop' })).toHaveAccessibilityState({ checked: false });
  expect(reopened.getByRole('button', { name: 'Save reviewed photos' })).toBeDisabled();
});

it('cannot confirm a newer business-type change that appeared during photo saving', async () => {
  changedLawPhotos();
  mockUpdate.mockImplementationOnce(async () => {
    mockCache['agent-1'].submission_photo_review = { submissionId: 'draft-1', previousBusinessType: 'Auto Shop', businessType: 'Clinic', requiredAt: 101 };
  });
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('checkbox', { name: 'I reviewed these photos for Auto Shop' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save reviewed photos' }));
  await waitFor(() => expect(screen.getByText('The business type changed again. Review your photos before continuing.')).toBeTruthy());
  expect(mockCache['agent-1'].submission_photo_review).toMatchObject({ businessType: 'Clinic', requiredAt: 101 });
  expect(mockCache['agent-1'].submission_photo_review.confirmedAt).toBeUndefined();
  expect(mockRouter.back).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
});

it('keeps the queued local shop guide while reconnecting to an older server category', async () => {
  changedLawPhotos();
  mockSubmissions['draft-1'].businessType = 'Law Office';
  mockCache['agent-1'].submission_pending_sync = { creatorId: 'agent-1', existingDraftId: 'draft-1', formData: { businessType: 'Auto Shop' } };
  const screen = await screenReady();
  expect(screen.getByRole('button', { name: 'Work bay, not taken' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Reference books, not taken' })).toBeNull();
  expect(screen.getByText('Review photos for Auto Shop')).toBeTruthy();
});

it.each(['Law Office', 'Clinic'])('does not relabel older general-shop photos when installing the new %s guide', async businessType => {
  mockSubmissions['draft-1'].businessType = businessType;
  mockCache['agent-1'].submission_photo_tasks = { ...photoDraft(localItems(3)), businessType };
  const screen = await screenReady();
  await waitFor(() => expect(screen.getByRole('button', { name: 'View photo 1: Owner headshot' })).toBeTruthy());
  expect(screen.getByRole('button', { name: `${businessType === 'Clinic' ? 'Practitioner' : 'Lawyer'} portrait, not taken` })).toBeTruthy();
  const saved = mockCache['agent-1'].submission_photo_tasks;
  expect(saved.shotListKey).toBe(businessType === 'Clinic' ? 'clinic' : 'law');
  expect(saved.items.every((item: any) => item.taskIndex === undefined)).toBe(true);
  expect(saved.items.map((item: any) => item.label)).toEqual(['Owner headshot', 'Profile picture', 'Outside']);
});

it('removes only the selected photos after confirmation and remembers removed uploaded keys', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const items = ['owner', 'front', 'tools'].map((storageId, i) => ({ id: storageId, storageId, label: ['Owner', 'Shop front', 'Tools'][i] }));
  mockSubmissions['draft-1'].photos = items.map(item => item.storageId);
  mockCache['agent-1'].submission_photo_tasks = photoDraft(items);
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('button', { name: 'Select photos' }));
  fireEvent.press(screen.getByRole('checkbox', { name: 'Select photo 1: Owner' }));
  fireEvent.press(screen.getByRole('checkbox', { name: 'Select photo 3: Tools' }));
  fireEvent.press(screen.getByRole('button', { name: 'Remove 2 selected photos' }));
  expect(mockCache['agent-1'].submission_photo_tasks.items).toHaveLength(3);
  act(() => alert.mock.calls.at(-1)![2]!.find(button => button.style === 'destructive')!.onPress?.());
  await waitFor(() => expect(screen.getByText('1 of 10 photos added')).toBeTruthy());
  expect(mockCache['agent-1'].submission_photo_tasks.items).toEqual([expect.objectContaining({ id: 'front', label: 'Shop front' })]);
  expect(mockCache['agent-1'].submission_photo_tasks.removedExistingPhotos).toEqual(expect.arrayContaining(['owner', 'tools']));
  expect(mockUpdate).not.toHaveBeenCalled(); alert.mockRestore();
});

it('saves a descriptive label with its photo and retains it when reopening', async () => {
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('button', { name: 'Photo 2 options' }));
  fireEvent.press(screen.getByRole('button', { name: 'Edit label' }));
  fireEvent.changeText(screen.getByLabelText('Photo label'), '  Shop front and sign  ');
  fireEvent.press(screen.getByRole('button', { name: 'Save label' }));
  await waitFor(() => expect(mockCache['agent-1'].submission_photo_tasks.items[1].label).toBe('Shop front and sign'));
  screen.unmount(); const reopened = await screenReady();
  expect(reopened.getByRole('button', { name: 'View photo 2: Shop front and sign' })).toBeTruthy();
});

it('retakes an individually labelled added photo at the 10-photo limit without altering the others', async () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ id: `image-${i}`, storageId: `key-${i}`, label: `Saved view ${i + 1}` }));
  mockCache['agent-1'].submission_photo_tasks = photoDraft(items);
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('button', { name: 'Photo 4 options' }));
  fireEvent.press(screen.getByRole('button', { name: 'Retake photo' }));
  expect(mockGuide.tasks).toEqual([expect.objectContaining({ t: 'Saved view 4' })]);
  expect(mockGuide.singleShot).toBe(true); expect(mockGuide.maxCaptured).toBe(1);
  act(() => { mockGuide.onShot!(0, 'file://retake.heic'); mockGuide.onClose([]); });
  await waitFor(() => expect(mockCache['agent-1'].submission_photo_tasks.items[3].uri).toEqual(expect.any(String)));
  const saved = mockCache['agent-1'].submission_photo_tasks;
  expect(saved.items).toHaveLength(10);
  expect(saved.items[3]).toMatchObject({ id: 'image-3', label: 'Saved view 4' });
  expect(saved.items[2]).toEqual(items[2]); expect(saved.items[4]).toEqual(items[4]);
  expect(saved.removedExistingPhotos).toContain('key-3');
});

it('does not restore a removed uploaded photo from an older offline queue when reopened', async () => {
  mockOnline = false;
  mockCache['agent-1'].submission_pending_photos = { submissionId: 'draft-1', photoUris: [], existingPhotos: ['keep-1', 'remove-me', 'keep-2', 'keep-3'] };
  mockCache['agent-1'].submission_photo_tasks = { ...photoDraft(['keep-1', 'keep-2', 'keep-3'].map(storageId => ({ id: storageId, storageId }))), removedExistingPhotos: ['remove-me'] };
  const screen = await screenReady();
  expect(screen.getByText('3 of 10 photos added')).toBeTruthy();
  expect(mockCache['agent-1'].submission_photo_tasks.items.some((item: any) => item.storageId === 'remove-me')).toBe(false);
  screen.unmount(); const reopened = await screenReady();
  expect(reopened.getByText('3 of 10 photos added')).toBeTruthy();
  expect(mockCache['agent-1'].submission_photo_tasks.removedExistingPhotos).toContain('remove-me');
});

it('confirms reviewed photos offline only after saving their updated queue and labels', async () => {
  const items = changedLawPhotos(); mockOnline = false;
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('checkbox', { name: 'I reviewed these photos for Auto Shop' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save reviewed photos' }));
  await waitFor(() => expect(mockCache['agent-1'].submission_photo_review.confirmedAt).toEqual(expect.any(Number)));
  expect(mockCache['agent-1'].submission_pending_photos).toMatchObject({ submissionId: 'draft-1', businessType: 'Auto Shop', shotListKey: 'repair', existingPhotos: items.map(item => item.storageId) });
  expect(mockCache['agent-1'].submission_photo_tasks.items.map((item: any) => item.label)).toEqual(items.map(item => item.label));
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
});

it('finishes a pending removal write before Back can return to Review', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  mockWrite.mockImplementation(async (_actor, key) => { if (key === 'submission_photo_tasks') await blocked; });
  fireEvent.press(screen.getByRole('button', { name: 'Select photos' }));
  fireEvent.press(screen.getByRole('checkbox', { name: 'Select photo 1: Owner headshot' }));
  fireEvent.press(screen.getByRole('button', { name: 'Remove 1 selected photos' }));
  act(() => alert.mock.calls.at(-1)![2]!.find(button => button.style === 'destructive')!.onPress?.());
  fireEvent.press(screen.getByRole('button', { name: 'Back', exact: true }));
  expect(mockRouter.back).not.toHaveBeenCalled();
  await act(async () => { release(); await blocked; });
  await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  expect(mockCache['agent-1'].submission_photo_tasks.items).toHaveLength(2);
  alert.mockRestore();
});

it('does not resurrect a saved removal while the live query still contains the older photo set', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const items = ['remove-me', 'keep-1', 'keep-2', 'keep-3'].map(storageId => ({ id: storageId, storageId, label: storageId }));
  mockSubmissions['draft-1'].photos = items.map(item => item.storageId);
  mockCache['agent-1'].submission_photo_tasks = photoDraft(items);
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('button', { name: 'Select photos' }));
  fireEvent.press(screen.getByRole('checkbox', { name: 'Select photo 1: remove-me' }));
  fireEvent.press(screen.getByRole('button', { name: 'Remove 1 selected photos' }));
  act(() => alert.mock.calls.at(-1)![2]!.find(button => button.style === 'destructive')!.onPress?.());
  await waitFor(() => expect(screen.getByText('3 of 10 photos added')).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Continue to interview' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ id: 'draft-1', photos: ['keep-1', 'keep-2', 'keep-3'] }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
  screen.unmount(); const reopened = await screenReady();
  expect(reopened.getByText('3 of 10 photos added')).toBeTruthy();
  expect(mockCache['agent-1'].submission_photo_tasks.removedExistingPhotos).toContain('remove-me');
  alert.mockRestore();
});

it('recovers a missing cached local photo from its uploaded URL', async () => {
  const missing = 'file:///cache/ImageManipulator/missing.jpg';
  const items = [{ ...localItems(3)[0], uri: missing, storageId: 'uploaded-photo' }, ...localItems(3).slice(1)];
  mockFileInfo.mockImplementation(async (uri: string) => ({ exists: uri !== missing, isDirectory: false }));
  mockCache['agent-1'].submission_photo_tasks = photoDraft(items);
  const screen = await screenReady();
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: 'https://images.example.com/uploaded-photo' });
  expect(screen.getByRole('button', { name: 'Continue to interview' })).toBeEnabled();
  expect(mockCache['agent-1'].submission_photo_tasks.items[0]).toEqual(items[0]);
  expect(mockFileCopy).not.toHaveBeenCalled();
});

it('falls back after a local decode error and ignores a delayed thumbnail failure after recovery', async () => {
  const items = [{ ...localItems(3)[0], storageId: 'uploaded-photo' }, ...localItems(3).slice(1)];
  mockCache['agent-1'].submission_photo_tasks = photoDraft(items);
  const screen = await screenReady();
  const thumbnail = screen.getByRole('button', { name: 'View photo 1: Owner headshot' });
  const oldThumbnailError = within(thumbnail).UNSAFE_getByType(require('react-native').Image).props.onError;
  fireEvent.press(thumbnail);
  measurePhotoPreview(screen);
  fireEvent(screen.getByTestId('capture-photo-full-image'), 'error', { nativeEvent: { error: 'Missing local file' } });
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: 'https://images.example.com/uploaded-photo' });
  act(() => oldThumbnailError());
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: 'https://images.example.com/uploaded-photo' });
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Close photo' }));
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: 'https://images.example.com/uploaded-photo' });
  expect(mockCache['agent-1'].submission_photo_tasks.items).toEqual(items);
});

it('keeps an unavailable unsynced record and replaces it atomically even at the ten-photo limit', async () => {
  const missing = `${LOCAL_URI}missing.jpg`;
  const items = localItems(10); items[0].uri = missing;
  mockFileInfo.mockImplementation(async (uri: string) => ({ exists: uri !== missing, isDirectory: false }));
  mockCache['agent-1'].submission_photo_tasks = photoDraft(items);
  const screen = await screenReady();
  expect(screen.queryByRole('button', { name: 'Continue to interview' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Owner headshot, unavailable. Retake photo' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add your own photos' })).toBeDisabled();
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  const preview = within(screen.getByTestId('capture-photo-preview'));
  expect(preview.getByRole('alert')).toHaveTextContent('This photo is no longer on this device. Retake it or choose a replacement.');
  mockLibrary.mockResolvedValueOnce({ canceled: true, assets: [] });
  fireEvent.press(preview.getByRole('button', { name: 'Replace photo' }));
  await waitFor(() => expect(preview.getByRole('button', { name: 'Replace photo' })).toBeEnabled());
  expect(mockCache['agent-1'].submission_photo_tasks.items).toEqual(items);
  fireEvent.press(preview.getByRole('button', { name: 'Replace photo' }));
  await waitFor(() => expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: copiedUri('file://jpeg-library.heic') }));
  fireEvent.press(screen.getByRole('button', { name: 'Close photo' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to interview' })).toBeEnabled());
  const saved = mockCache['agent-1'].submission_photo_tasks.items;
  expect(saved).toHaveLength(10);
  expect(saved[0]).toMatchObject({ id: items[0].id, taskIndex: 0, uri: copiedUri('file://jpeg-library.heic') });
  expect(mockLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ selectionLimit: 1, allowsMultipleSelection: false }));
  expect(mockUpload).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
});

it('does not commit an in-flight file copy into the next signed-in account', async () => {
  let finishCopy!: () => void;
  mockFileCopy.mockImplementationOnce(() => new Promise<void>(resolve => { finishCopy = resolve; }));
  const screen = await screenReady();
  fireEvent.press(screen.getByRole('button', { name: 'Owner headshot, not taken' }));
  act(() => mockGuide.onShot!(0, 'file://camera.jpg'));
  await waitFor(() => expect(mockFileCopy).toHaveBeenCalledTimes(1));
  mockActor = 'agent-2'; mockCache['agent-2'] = { current_submission_id: 'draft-2' };
  mockSubmissions['draft-2'] = { ...mockSubmissions['draft-1'], _id: 'draft-2', creatorId: 'agent-2' };
  screen.rerender(<SubmitPhotosScreen />);
  await act(async () => finishCopy());
  await waitFor(() => expect(screen.getByText('0 of 10 photos added')).toBeTruthy());
  expect(mockCache['agent-1'].submission_photo_tasks).toBeUndefined();
  expect(mockCache['agent-2'].submission_photo_tasks).toBeUndefined();
});

it('uses only this draft’s tagged form and pending details for the photo suggestions', async () => {
  mockOnline = false;
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  mockCache['agent-1'].submission_draft_form = { submissionId: 'another-draft', businessType: 'Restaurant' };
  mockCache['agent-1'].submission_pending_sync = { creatorId: 'agent-1', existingDraftId: 'another-draft', formData: { businessType: 'Restaurant' } };
  const screen = await screenReady();
  expect(screen.getByRole('button', { name: 'Haircut in progress, taken. Retake photo' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Owner cooking, not taken' })).toBeNull();
});

it('returns a resumed capture to its own info step while full-screen Back just closes the photo', async () => {
  mockParams = { resumed: '1' };
  mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
  const screen = await screenReady();
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  fireEvent(screen.getByTestId('capture-photo-preview'), 'requestClose');
  expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/(app)/submit/info', params: { draftId: 'draft-1', resumed: '1' } }));
});

it('rejects unsafe media scopes without reading or copying a file', async () => {
  await expect(retainCapturePhoto('file://photo.jpg', { creatorId: '../another-user', submissionId: 'draft-1', isCurrent: () => true })).rejects.toThrow('Could not identify this photo draft');
  expect(mockFileInfo).not.toHaveBeenCalled(); expect(mockFileCopy).not.toHaveBeenCalled();
});

it('uses an uploaded URL when checking a legacy local file fails without blocking other photos', async () => {
  const legacy = 'file:///cache/ImageManipulator/unreadable.jpg';
  mockCache['agent-1'].submission_photo_tasks = photoDraft([
    { ...localItems(3)[0], uri: legacy, storageId: 'uploaded-photo' }, ...localItems(3).slice(1),
  ]);
  mockFileInfo.mockImplementation(async (uri: string) => {
    if (uri === legacy) throw new Error('Local storage could not be read');
    return { exists: true, isDirectory: false };
  });
  const screen = await screenReady();
  expect(screen.getByText('3 of 10 photos added')).toBeTruthy();
  openPhotoPreview(screen, 'View photo 1: Owner headshot');
  expect(screen.getByTestId('capture-photo-full-image')).toHaveProp('source', { uri: 'https://images.example.com/uploaded-photo' });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(mockCache['agent-1'].submission_photo_tasks.items[0].uri).toBe(legacy);
});

it('handles resumed hardware Back only outside full-screen media and waits for file preparation', async () => {
  const listeners: Array<() => boolean | null | undefined> = [];
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, listener) => {
    listeners.push(listener); return { remove: jest.fn() };
  });
  try {
    mockParams = { resumed: '1' };
    mockCache['agent-1'].submission_photo_tasks = photoDraft(localItems(3));
    const screen = await screenReady();
    openPhotoPreview(screen, 'View photo 1: Owner headshot');
    expect(listeners.at(-1)!()).toBe(false);
    expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
    fireEvent(screen.getByTestId('capture-photo-preview'), 'requestClose');
    let finishCopy!: () => void;
    mockFileCopy.mockImplementationOnce(() => new Promise<void>(resolve => { finishCopy = resolve; }));
    fireEvent.press(screen.getByRole('button', { name: 'Add your own photos' }));
    await waitFor(() => expect(mockFileCopy).toHaveBeenCalledTimes(1));
    expect(listeners.at(-1)!()).toBe(true);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => finishCopy());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to interview' })).toBeEnabled());
    expect(listeners.at(-1)!()).toBe(true);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/(app)/submit/info', params: { draftId: 'draft-1', resumed: '1' } }));
  } finally { spy.mockRestore(); }
});
