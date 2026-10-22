import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DesignPicker from '../app/(owner)/design';
import { ownerIntake } from '../lib/v2/ownerIntake';
import { uploadQueue } from '../lib/v2/uploadQueue';

const mockChoose = jest.fn(async () => {});
const mockSubmit = jest.fn(async () => {});
const mockReplace = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: jest.fn() }) }));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => ({ id: 'draft' }) }));
jest.mock('../lib/v2/ownerData', () => ({
  WEB_ORIGIN: 'https://tendso.com', useOwnerSubmission: () => null,
  useChooseDesign: () => mockChoose, useSubmitSite: () => mockSubmit,
}));
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

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
