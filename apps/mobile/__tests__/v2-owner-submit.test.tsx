import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DesignPicker from '../app/(owner)/design';
import { ownerIntake } from '../lib/v2/ownerIntake';
import { uploadQueue } from '../lib/v2/uploadQueue';

const mockChoose = jest.fn(async () => {});
const mockSubmit = jest.fn(async () => {});
const mockReplace = jest.fn();
const mockUpload = jest.fn(async () => 'https://images.test/photo.jpg');
const mockSaveShot = jest.fn(async () => {});
const mockSaveAnswer = jest.fn(async () => {});
let mockSub: any = null;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: 'owner-subject' }) }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: true }) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: jest.fn() }) }));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => ({ id: 'draft' }) }));
jest.mock('../lib/v2/ownerData', () => ({
  WEB_ORIGIN: 'https://tendso.com', useOwnerSubmission: () => mockSub,
  useChooseDesign: () => mockChoose, useSubmitSite: () => mockSubmit,
  useUploadFile: () => mockUpload,
  useSaveShot: () => mockSaveShot, useSaveAnswer: () => mockSaveAnswer,
}));
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

beforeEach(() => {
  jest.clearAllMocks();
  mockSub = { submissionId: 'draft', shots: [], interview: [] };
  mockUpload.mockImplementation(async () => 'https://images.test/photo.jpg');
  uploadQueue.reset();
  ownerIntake.clear();
});

it('keeps photos and blocks submission when retried uploads still fail, then allows another try', async () => {
  uploadQueue.reset();
  ownerIntake.set({ kind: 'barber', shots: ['file://photo.jpg'] });
  let failing = true;
  const upload = jest.fn(async () => { if (failing) throw new Error('Offline'); });
  uploadQueue.add('photo', 'Photo', upload);
  await uploadQueue.drain();
  const screen = render(<SafeAreaProvider initialMetrics={metrics}><DesignPicker /></SafeAreaProvider>);
  await act(async () => { fireEvent.press(screen.getByText('Use this design')); });
  expect(upload).toHaveBeenCalledTimes(6);
  expect(screen.getByText('Some answers or photos could not upload. Please try again.')).toBeTruthy();
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  // Local photos remain available for retry.
  expect(ownerIntake.get().shots).toEqual(['file://photo.jpg']);
  failing = false;
  await act(async () => { fireEvent.press(screen.getByText('Use this design')); });
  expect(mockSubmit).toHaveBeenCalledWith({ submissionId: 'draft' });
  expect(mockReplace).toHaveBeenCalledWith('/(owner)/building');
  expect(ownerIntake.get().shots).toBeUndefined();
  screen.unmount();
  uploadQueue.reset();
});

it('rebuilds the empty process queue before submitting a restored draft, and blocks until recovered uploads save', async () => {
  mockSub = { submissionId: 'draft', shots: [], interview: [] };
  ownerIntake.set({
    submissionId: 'draft' as never, kind: 'barber', shots: ['file://one.jpg', 'file://two.jpg', 'file://three.jpg'],
    uploads: [{ kind: 'answer', submissionId: 'draft' as never, index: 0, uri: 'file://answer.m4a', mediaType: 'audio', lang: 'tl', durationSec: 12 }],
  });
  mockUpload.mockRejectedValue(new Error('Still offline'));
  expect(uploadQueue.snapshot().total).toBe(0);
  const screen = render(<SafeAreaProvider initialMetrics={metrics}><DesignPicker /></SafeAreaProvider>);
  await act(async () => { fireEvent.press(screen.getByText('Use this design')); });
  expect(uploadQueue.snapshot().failed).toBe(4);
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(ownerIntake.get().uploads).toHaveLength(4);

  mockUpload.mockImplementation(async () => 'https://images.test/recovered');
  await act(async () => { fireEvent.press(screen.getByText('Use this design')); });
  expect(mockSaveShot).toHaveBeenCalledTimes(3);
  expect(mockSaveAnswer).toHaveBeenCalledWith(expect.objectContaining({ index: 0, mediaType: 'audio', lang: 'tl' }));
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('/(owner)/building');
  expect(ownerIntake.get().uploads).toBeUndefined();
  screen.unmount();
  uploadQueue.reset();
});

it('cannot submit before the server draft has loaded for reconciliation', async () => {
  mockSub = undefined;
  const screen = render(<SafeAreaProvider initialMetrics={metrics}><DesignPicker /></SafeAreaProvider>);
  fireEvent.press(screen.getByText('Use this design'));
  expect(mockChoose).not.toHaveBeenCalled();
  expect(mockSubmit).not.toHaveBeenCalled();
  screen.unmount();
});
