import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ownerIntake } from '../lib/v2/ownerIntake';
import { ownerAnswersFor, ownerPhotosFor } from '../lib/v2/ownerMedia';
import type { OwnerMe, OwnerSubmission, SubmissionId } from '../lib/v2/ownerTypes';

const mockPush = jest.fn(); const mockReplace = jest.fn(); const mockBack = jest.fn();
const mockSavePhoto = jest.fn(); const mockRemember = jest.fn(); const mockPick = jest.fn();
const mockCreate = jest.fn(); const mockUpdate = jest.fn(); const mockRequestVisit = jest.fn();
let mockSubject = 'owner-a'; let mockConnected = true; let mockParams: Record<string, string> = {};
let mockQueue = { pending: 0, failed: 0, total: 0, done: 0 };
let mockMe: OwnerMe; let mockSub: OwnerSubmission;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject }) }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }), useLocalSearchParams: () => mockParams }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', PROVIDER_GOOGLE: 'google' }));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('expo-av', () => ({ Video: 'Video', ResizeMode: { CONTAIN: 'contain' }, Audio: { Sound: { createAsync: jest.fn() }, setAudioModeAsync: jest.fn() } }));
jest.mock('../lib/v2/useOwnerSite', () => ({
  useOwnerSite: () => ({ me: mockMe, site: mockMe.sites[0] ?? null, id: mockMe.sites[0]?.submissionId ?? null }),
  firstName: () => mockMe.owner.name?.split(' ')[0] ?? '', greeting: () => 'Morning',
}));
jest.mock('../lib/v2/ownerData', () => ({
  useOwnerSubmission: () => mockSub, useCreateDraft: () => mockCreate, useUpdateDraft: () => mockUpdate,
  useRequestVisit: () => mockRequestVisit,
}));
jest.mock('../lib/v2/ownerPhotos', () => ({ MAX_EXTRAS: 10, useSaveOwnerPhoto: () => mockSavePhoto, pickFromLibrary: (...args: unknown[]) => mockPick(...args) }));
jest.mock('../lib/v2/ownerUploads', () => ({ useOwnerUploads: () => ({ remember: mockRemember }) }));
jest.mock('../lib/v2/uploadQueue', () => ({ useUploadQueue: () => mockQueue, uploadQueue: { retry: jest.fn() } }));
jest.mock('../components/v2/capture', () => ({
  InterviewCam: (props: object) => require('react').createElement(require('react-native').View, { testID: 'owner-interview-camera', ...props }),
  ShotGuide: (props: object) => require('react').createElement(require('react-native').View, { testID: 'owner-shot-camera', ...props }),
}));
jest.mock('../components/field-agent/CaptureLocationPicker', () => ({
  validCaptureCoordinates: (value: { lat?: number; lng?: number } | undefined) => typeof value?.lat === 'number' && typeof value?.lng === 'number',
  CaptureLocationPicker: (props: object) => require('react').createElement(require('react-native').View, { testID: 'owner-location-picker', ...props }),
}));

import Place from '../app/(owner)/start/place';
import TalkIntro from '../app/(owner)/talk';
import TalkDone from '../app/(owner)/talk/done';
import TalkRecord from '../app/(owner)/talk/record';
import PhotosIntro from '../app/(owner)/photos';
import PhotosDone from '../app/(owner)/photos/done';
import PhotosShoot from '../app/(owner)/photos/shoot';
import Inbox from '../app/(owner)/me/inbox';
import BookVisit from '../app/(owner)/agents/book';
import { OwnerDesignGallery } from '../components/v2/owner/OwnerDesignGallery';
import { designsFor } from '../lib/v2/ownerContent';

const id = 'owner-draft' as SubmissionId;
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);
function fixture(): OwnerSubmission {
  return { submissionId: id, businessName: 'Forge', businessType: 'Barber/Salon', contentSource: 'owner_app', publishPolicy: 'pay_then_publish',
    status: 'draft', phase: 'draft', publishedUrl: null, total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false, openChangeRequests: 0, createdAt: 1,
    address: '12 Main St', city: 'Marikina', province: null, barangay: null, coordinates: null, shotListKey: 'barber', interview: [], shots: [],
    templateId: null, templateIds: [], fontChoice: null, colorChoice: null, ownerApprovedAt: null, previewReadyAt: null };
}
beforeEach(() => {
  jest.clearAllMocks(); mockSubject = 'owner-a'; mockConnected = true; mockParams = {};
  mockQueue = { pending: 0, failed: 0, total: 0, done: 0 };
  mockSub = fixture(); mockMe = { owner: { _id: 'owner-a', name: 'Ben Reyes', email: 'ben@example.test', phone: '09171234567' }, sites: [mockSub] };
  ownerIntake.clear(); ownerIntake.set({ submissionId: id, kind: 'barber', businessName: 'Forge', address: '12 Main St', city: 'Marikina' });
  mockPick.mockResolvedValue([]); mockRequestVisit.mockResolvedValue({ ok: true }); mockUpdate.mockResolvedValue({ ok: true });
});

it('merges only this owned draft’s media and never reuses a transcript for a new take', () => {
  mockSub.interview = [{ index: 0, questionEn: 'Name', questionTl: 'Pangalan', lang: 'en', mediaUrl: 'https://old', answerText: 'Old words', updatedAt: 1 }];
  mockSub.shots = [{ index: 0, extra: false, url: 'https://server-photo', updatedAt: 1 }];
  const intake = { submissionId: id, shots: ['file://local-photo'], uploads: [
    { kind: 'answer' as const, submissionId: id, index: 0, uri: 'file://new-answer', mediaType: 'audio' as const, lang: 'tl' as const, durationSec: 8 },
    { kind: 'photo' as const, submissionId: 'foreign' as SubmissionId, index: 1, uri: 'file://private-other', extra: true },
  ] };
  expect(ownerPhotosFor(id, mockSub, intake).map(photo => photo.uri)).toEqual(['file://local-photo']);
  expect(ownerAnswersFor(id, mockSub, intake)[0]).toMatchObject({ mediaUrl: 'file://new-answer', answerText: undefined });
  expect(ownerPhotosFor(id, { ...mockSub, submissionId: 'foreign' as SubmissionId }, { ...intake, submissionId: 'foreign' as SubmissionId })).toEqual([]);
});

it('shows all bilingual questions and real completion without recording on list taps', () => {
  mockSub.interview = [{ index: 0, questionEn: 'Name', questionTl: 'Pangalan', lang: 'en', mediaUrl: 'https://answer', updatedAt: 1 }];
  const screen = wrap(<TalkIntro />);
  expect(screen.getByText('1 of 10 answered')).toBeTruthy();
  expect(screen.getByText('Ano ang pangalan ng tindahan mo?')).toBeTruthy();
  expect(screen.getByText('What should people know?')).toBeTruthy();
  expect(mockRemember).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Voice only, no video'));
  expect(ownerIntake.get().audioOnly).toBe(true);
  expect(mockPush).toHaveBeenCalledWith('/(owner)/talk/record');
});

it('plays the saved answer and opens an individual redo without changing the other answers', () => {
  mockSub.interview = [{ index: 4, questionEn: 'Story', questionTl: 'Kuwento', lang: 'en', mediaUrl: 'https://answer.mp4', mediaType: 'video', answerText: 'Started in 2010.', updatedAt: 1 }];
  const screen = wrap(<TalkDone />);
  expect(screen.getByText('Started in 2010.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Play answer 5'));
  expect(screen.getByTestId('owner-answer-video').props.source).toEqual({ uri: 'https://answer.mp4' });
  fireEvent.press(screen.getByLabelText('Close media preview'));
  fireEvent.press(screen.getByLabelText('Redo answer 5'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(owner)/talk/record', params: { answer: '4' } });
  expect(mockRemember).not.toHaveBeenCalled();
});

it('configures a single-answer recorder and ignores late callbacks after an account change', () => {
  mockParams = { answer: '4' };
  const screen = wrap(<TalkRecord />);
  const old = screen.getByTestId('owner-interview-camera').props;
  expect(old).toMatchObject({ startAt: 4, stopAfterQuestion: 4 });
  const clip = { index: 4, uri: 'file://replacement', kind: 'audio', lang: 'en', durationSec: 8 };
  act(() => old.onClip(clip));
  expect(mockRemember).toHaveBeenCalledWith(expect.objectContaining({ submissionId: id, index: 4 }));
  mockSubject = 'owner-b';
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><TalkRecord /></SafeAreaProvider>);
  act(() => { old.onClip(clip); old.onFinish({ lang: 'en' }); });
  expect(mockRemember).toHaveBeenCalledTimes(1); expect(mockReplace).not.toHaveBeenCalled();
});

it('shows ten photo ideas and opens a saved thumbnail in a contained full view', () => {
  mockSub.shots = [{ index: 0, extra: false, label: 'Owner headshot', url: 'https://headshot', updatedAt: 1 }];
  const screen = wrap(<PhotosIntro />);
  expect(screen.getByText('Price list')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('View Owner headshot photo'));
  expect(screen.getByTestId('owner-full-photo').props).toMatchObject({ resizeMode: 'contain', source: { uri: 'https://headshot' } });
  fireEvent.press(screen.getByLabelText('Close media preview'));
  fireEvent.press(screen.getByLabelText('Retake Owner headshot'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(owner)/photos/shoot', params: { shot: '0' } });
});

it('retakes the selected photo slot instead of appending another photo', () => {
  mockParams = { shot: '0' };
  mockSub.shots = [{ index: 0, extra: false, url: 'https://old-photo', updatedAt: 1 }];
  const screen = wrap(<PhotosShoot />);
  const camera = screen.getByTestId('owner-shot-camera').props;
  expect(camera).toMatchObject({ initialIndex: 0, singleShot: true });
  act(() => camera.onShot(0, 'file://replacement'));
  expect(mockSavePhoto).toHaveBeenCalledWith(id, 'file://replacement', expect.objectContaining({ index: 0, extra: false }));
});

it('does not attach photos returned by a picker after the account changed', async () => {
  let finish!: (uris: string[]) => void;
  mockPick.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const screen = wrap(<PhotosDone />);
  fireEvent.press(screen.getByText('Add from my phone'));
  mockSubject = 'owner-b';
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><PhotosDone /></SafeAreaProvider>);
  await act(async () => { finish(['file://old-account-photo']); });
  expect(mockSavePhoto).not.toHaveBeenCalled();
});

it('keeps sent-site capture summaries read-only and never opens a recording deep link', () => {
  mockSub = { ...mockSub, phase: 'live', status: 'approved' };
  mockMe = { ...mockMe, sites: [mockSub] };
  const screen = wrap(<PhotosDone />);
  expect(screen.queryByText('Add from my phone')).toBeNull();
  expect(screen.getByText('Back to my site')).toBeTruthy();
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><TalkRecord /></SafeAreaProvider>);
  expect(screen.queryByTestId('owner-interview-camera')).toBeNull();
  expect(screen.getByText('Your interview is saved')).toBeTruthy();
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><PhotosShoot /></SafeAreaProvider>);
  expect(screen.queryByTestId('owner-shot-camera')).toBeNull();
  expect(screen.getByText('Your shop photos are saved')).toBeTruthy();
  expect(mockRemember).not.toHaveBeenCalled(); expect(mockSavePhoto).not.toHaveBeenCalled();
});

it('ignores a late native photo after the same site leaves draft status', () => {
  const screen = wrap(<PhotosShoot />);
  const old = screen.getByTestId('owner-shot-camera').props;
  mockSub = { ...mockSub, phase: 'building', status: 'submitted' };
  mockMe = { ...mockMe, sites: [mockSub] };
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><PhotosShoot /></SafeAreaProvider>);
  act(() => old.onShot(0, 'file://late-photo'));
  expect(mockSavePhoto).not.toHaveBeenCalled();
});

it('does not retry or show another draft’s upload queue on a sent interview summary', () => {
  mockSub = { ...mockSub, phase: 'live', status: 'approved' };
  mockMe = { ...mockMe, sites: [mockSub] };
  mockQueue = { pending: 2, failed: 1, total: 4, done: 1 };
  const screen = wrap(<TalkDone />);
  expect(screen.getByText('Back to my site')).toBeTruthy();
  expect(screen.queryByText('Retry saving answers')).toBeNull();
  expect(screen.queryByText('Saving your answers…')).toBeNull();
  expect(screen.queryByText('Some answers have not uploaded. Your local recordings are kept on this phone.')).toBeNull();
});

it('pins the shop through the existing map picker and saves the confirmed coordinates', async () => {
  const screen = wrap(<Place />);
  fireEvent.press(screen.getByLabelText('Choose shop location on map'));
  act(() => screen.getByTestId('owner-location-picker').props.onConfirm({ coordinates: { lat: 14.65, lng: 121.1 }, address: '20 Rizal St', city: 'Marikina' }));
  await act(async () => { fireEvent.press(screen.getByText('Next')); });
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ submissionId: id, address: '20 Rizal St', coordinates: { lat: 14.65, lng: 121.1 } }));
  expect(mockPush).toHaveBeenCalledWith('/(owner)/start/how');
});

it('opens the site selected in Inbox rather than the newest site', () => {
  const second = { ...mockSub, submissionId: 'second-owned-site' as SubmissionId, businessName: 'Second shop', phase: 'ready_to_check' as const };
  mockMe = { ...mockMe, sites: [mockSub, second] };
  const screen = wrap(<Inbox />);
  fireEvent.press(screen.getByText('Second shop'));
  expect(ownerIntake.get().submissionId).toBe('second-owned-site');
  expect(mockPush).toHaveBeenCalledWith('/(owner)/check');
});

it('sends a preferred visit time without claiming an appointment is confirmed', async () => {
  const screen = wrap(<BookVisit />);
  fireEvent.press(screen.getByText('Tomorrow'));
  await act(async () => { fireEvent.press(screen.getByText('Send request')); });
  expect(mockRequestVisit).toHaveBeenCalledWith(expect.objectContaining({ phone: '09171234567', when: 'Tomorrow', shopName: 'Forge' }));
  expect(screen.getByText('The team will call you to confirm an agent and time.')).toBeTruthy();
  expect(screen.queryByText(/is coming/)).toBeNull();
});

it('restores a saved gallery choice after hydration and previews without saving', async () => {
  const onUse = jest.fn(); const designs = designsFor('barber');
  const gallery = (selectedCode: string | null) => <OwnerDesignGallery designs={designs} selectedCode={selectedCode} onSelect={jest.fn()} onUse={onUse} onBack={jest.fn()} />;
  const screen = wrap(gallery(null));
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}>{gallery(designs[2].code)}</SafeAreaProvider>);
  fireEvent.press(screen.getByLabelText(`${designs[2].name} design. Preview sample website.`));
  expect(screen.getByTestId('owner-design-full-site')).toBeTruthy();
  expect(screen.UNSAFE_getAllByProps({ samplePreview: true }).length).toBeGreaterThan(0);
  fireEvent.press(screen.getByLabelText('Close design preview'));
  expect(onUse).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(screen.getByText('Use this design')); });
  expect(onUse).toHaveBeenCalledWith(designs[2].code);
});

it('keeps offline samples readable while disabling the use action', () => {
  const onUse = jest.fn(); const designs = designsFor('barber');
  const screen = wrap(<OwnerDesignGallery designs={designs} selectedCode={designs[0].code} onSelect={jest.fn()} onUse={onUse} onBack={jest.fn()} isOffline canUse={false} />);
  expect(screen.getAllByText('Reconnect to preview this sample.').length).toBeGreaterThan(0);
  fireEvent.press(screen.getByText('Use this design'));
  expect(onUse).not.toHaveBeenCalled();
});
