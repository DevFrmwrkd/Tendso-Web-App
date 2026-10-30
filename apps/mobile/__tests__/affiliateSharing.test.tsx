import React from 'react';
import { affiliateUrl } from '../components/affiliate/model';
import { Share } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { CopyButton, ShareTools } from '../components/affiliate/ShareTools';

const mockClipboard = jest.fn();
const mockCapture = jest.fn();
const mockShareImage = jest.fn();
const mockSharingAvailable = jest.fn();
const mockPosterExport = jest.fn();
const mockPoster = jest.fn();
const mockWrite = jest.fn();
const mockDelete = jest.fn();
const mockReleaseCapture = jest.fn();
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
jest.mock('expo-clipboard', () => ({ setStringAsync: (...args: unknown[]) => mockClipboard(...args) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: () => mockSharingAvailable(), shareAsync: (...args: unknown[]) => mockShareImage(...args) }));
jest.mock('react-native-view-shot', () => ({ captureRef: (...args: unknown[]) => mockCapture(...args), releaseCapture: (...args: unknown[]) => mockReleaseCapture(...args) }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///test-cache/', EncodingType: { Base64: 'base64' },
  writeAsStringAsync: (...args: unknown[]) => mockWrite(...args),
  deleteAsync: (...args: unknown[]) => mockDelete(...args),
}));
jest.mock('../components/affiliate/Screen', () => ({ Notice: require('react-native').Text }));
jest.mock('../components/affiliate/BoldOfferPoster', () => {
  const React = require('react');
  const makeElement = require('react').createElement;
  const { View } = require('react-native');
  return { BoldOfferPoster: React.forwardRef((props: object, ref: React.Ref<unknown>) => {
    mockPoster(props);
    React.useImperativeHandle(ref, () => ({ exportPng: () => mockPosterExport() }));
    return makeElement(View, { testID: 'prepared-bold-offer' });
  }) };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClipboard.mockResolvedValue(true);
  mockCapture.mockResolvedValue('file:///affiliate-poster.png');
  mockSharingAvailable.mockResolvedValue(true);
  mockShareImage.mockResolvedValue(undefined);
  mockPosterExport.mockReset().mockResolvedValue(PNG);
  mockWrite.mockReset().mockResolvedValue(undefined);
  mockDelete.mockReset().mockResolvedValue(undefined);
});

it('copies the canonical personal URL and confirms completion', async () => {
  const view = render(<CopyButton value="https://tendso.com/v2/a/my-page" label="Copy link" />);
  fireEvent.press(view.getByLabelText('Copy link'));
  await waitFor(() => expect(mockClipboard).toHaveBeenCalledWith('https://tendso.com/v2/a/my-page'));
  expect(view.getByText('Copied.')).toBeTruthy();
});

it('reports clipboard failures and keeps preview copying disabled', async () => {
  mockClipboard.mockRejectedValue(new Error('Clipboard unavailable'));
  const view = render(<CopyButton value="AFFTEST" label="Copy code" />);
  fireEvent.press(view.getByLabelText('Copy code'));
  await waitFor(() => expect(view.getByText('Could not copy. Please try again.')).toBeTruthy());
  view.rerender(<CopyButton value="AFFTEST" label="Copy code" disabled />);
  mockClipboard.mockClear();
  fireEvent.press(view.getByLabelText('Copy code'));
  expect(mockClipboard).not.toHaveBeenCalled();
});

it('shares the vector-exported PNG and removes the temporary file after the share sheet finishes', async () => {
  const view = render(<ShareTools handle="my-page" displayName="My saved offer" photo="https://photos.example.com/saved.jpg" referralCode="LEGACY27" price={3999} disabled={false} />);
  fireEvent.press(view.getByLabelText('Share printable poster PNG'));
  await waitFor(() => expect(mockShareImage).toHaveBeenCalled());
  expect(mockCapture).not.toHaveBeenCalled();
  expect(mockPosterExport).toHaveBeenCalledTimes(1);
  expect(mockPoster.mock.calls.at(-1)![0].model).toMatchObject({ name: 'My saved offer', photo: 'https://photos.example.com/saved.jpg',
    price: 3999, code: 'LEGACY27', url: 'https://tendso.com/v2/a/my-page' });
  const uri = mockWrite.mock.calls[0][0];
  expect(mockWrite).toHaveBeenCalledWith(uri, PNG, { encoding: 'base64' });
  expect(mockShareImage).toHaveBeenCalledWith(uri, { mimeType: 'image/png', dialogTitle: 'Share printable creator poster' });
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(uri, { idempotent: true }));
});

it('does not invoke native sharing or image capture for a disabled offer', () => {
  const link = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const view = render(<ShareTools handle="my-page" displayName="Preview" price={4999} disabled />);
  for (const label of ['Share page link', 'Share QR PNG', 'Share printable poster PNG']) fireEvent.press(view.getByLabelText(label));
  expect(link).not.toHaveBeenCalled();
  expect(mockCapture).not.toHaveBeenCalled();
  expect(mockPosterExport).not.toHaveBeenCalled();
  expect(mockShareImage).not.toHaveBeenCalled();
  link.mockRestore();
});

it('still shares a standalone QR at its own resolution and releases that screenshot', async () => {
  const view = render(<ShareTools handle="my-page" displayName="Saved" price={3999} disabled={false} />);
  fireEvent.press(view.getByLabelText('Share QR PNG'));
  await waitFor(() => expect(mockShareImage).toHaveBeenCalled());
  expect(mockCapture).toHaveBeenCalledWith(expect.anything(), { format: 'png', quality: 1, width: 768, height: 768 });
  expect(mockPosterExport).not.toHaveBeenCalled();
  await waitFor(() => expect(mockReleaseCapture).toHaveBeenCalledWith('file:///affiliate-poster.png'));
});

it('does not export or write a poster when native image sharing is unavailable', async () => {
  mockSharingAvailable.mockResolvedValueOnce(false);
  const view = render(<ShareTools handle="my-page" displayName="Saved" price={3999} disabled={false} />);
  fireEvent.press(view.getByLabelText('Share printable poster PNG'));
  await waitFor(() => expect(view.getByText('Could not create the image. Please try again.')).toBeTruthy());
  expect(mockPosterExport).not.toHaveBeenCalled();
  expect(mockWrite).not.toHaveBeenCalled();
  expect(mockShareImage).not.toHaveBeenCalled();
});

it('cleans up a poster file when native sharing fails and permits a retry', async () => {
  mockShareImage.mockRejectedValueOnce(new Error('Share failed'));
  const view = render(<ShareTools handle="my-page" displayName="Saved" price={3999} disabled={false} />);
  fireEvent.press(view.getByLabelText('Share printable poster PNG'));
  await waitFor(() => expect(view.getByText('Could not create the image. Please try again.')).toBeTruthy());
  const uri = mockWrite.mock.calls[0][0];
  expect(mockDelete).toHaveBeenCalledWith(uri, { idempotent: true });
  fireEvent.press(view.getByLabelText('Share printable poster PNG'));
  await waitFor(() => expect(mockPosterExport).toHaveBeenCalledTimes(2));
});

it('ignores repeated taps while the same poster is being exported', async () => {
  let finish!: (value: string) => void;
  mockPosterExport.mockReturnValueOnce(new Promise<string>(resolve => { finish = resolve; }));
  const view = render(<ShareTools handle="my-page" displayName="Saved" price={3999} disabled={false} />);
  fireEvent.press(view.getByLabelText('Share printable poster PNG'));
  await waitFor(() => expect(mockPosterExport).toHaveBeenCalledTimes(1));
  fireEvent.press(view.getByLabelText('Share printable poster PNG'));
  expect(mockPosterExport).toHaveBeenCalledTimes(1);
  await act(async () => { finish(PNG); });
  await waitFor(() => expect(mockShareImage).toHaveBeenCalledTimes(1));
});

it('does not share an abandoned export after saved details or access change', async () => {
  let finish!: (value: string) => void;
  mockPosterExport.mockReturnValueOnce(new Promise<string>(resolve => { finish = resolve; }));
  const view = render(<ShareTools handle="my-page" displayName="Saved" price={3999} disabled={false} />);
  fireEvent.press(view.getByLabelText('Share printable poster PNG'));
  await waitFor(() => expect(mockPosterExport).toHaveBeenCalledTimes(1));
  view.rerender(<ShareTools handle="my-page" displayName="Changed saved name" price={2200} disabled />);
  await act(async () => { finish(PNG); });
  expect(mockWrite).not.toHaveBeenCalled();
  expect(mockShareImage).not.toHaveBeenCalled();
});

it('generates v2 creator share links for links and QR codes', () => {
  expect(affiliateUrl('my-page')).toBe('https://tendso.com/v2/a/my-page');
  expect(affiliateUrl('a/b')).toBe('https://tendso.com/v2/a/a%2Fb');
});
