import React from 'react';
import { affiliateUrl } from '../components/affiliate/model';
import { Share } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CopyButton, ShareTools } from '../components/affiliate/ShareTools';

const mockClipboard = jest.fn();
const mockCapture = jest.fn();
const mockShareImage = jest.fn();
const mockSharingAvailable = jest.fn();
jest.mock('expo-clipboard', () => ({ setStringAsync: (...args: unknown[]) => mockClipboard(...args) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: () => mockSharingAvailable(), shareAsync: (...args: unknown[]) => mockShareImage(...args) }));
jest.mock('react-native-view-shot', () => ({ captureRef: (...args: unknown[]) => mockCapture(...args) }));
jest.mock('../components/affiliate/Screen', () => ({ Notice: require('react-native').Text }));
jest.mock('../components/affiliate/Offer', () => ({ OfferPrice: () => null }));
jest.mock('../components/ui/primitives', () => {
  const makeElement = require('react').createElement;
  const { View, Text, Pressable } = require('react-native');
  return { Body: Text, Display: Text, Label: Text, Card: View,
    Door: ({ label, disabled, loading, onPress }: { label: string; disabled?: boolean; loading?: boolean; onPress?: () => void }) => makeElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: label, disabled: disabled || loading, accessibilityState: { disabled: !!disabled || !!loading }, onPress }, makeElement(Text, null, label)),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClipboard.mockResolvedValue(true);
  mockCapture.mockResolvedValue('file:///affiliate-poster.png');
  mockSharingAvailable.mockResolvedValue(true);
  mockShareImage.mockResolvedValue(undefined);
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

it('shares a printable PNG using the A4 aspect and the native share sheet', async () => {
  const view = render(<ShareTools handle="my-page" displayName="My saved offer" price={3999} disabled={false} />);
  fireEvent.press(view.getByLabelText('Share printable poster PNG'));
  await waitFor(() => expect(mockCapture).toHaveBeenCalledWith(expect.anything(), { format: 'png', quality: 1, width: 1240, height: 1754 }));
  expect(mockShareImage).toHaveBeenCalledWith('file:///affiliate-poster.png', { mimeType: 'image/png', dialogTitle: 'Share printable creator poster' });
});

it('does not invoke native sharing or image capture for a disabled offer', () => {
  const link = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const view = render(<ShareTools handle="my-page" displayName="Preview" price={4999} disabled />);
  for (const label of ['Share page link', 'Share QR PNG', 'Share printable poster PNG']) fireEvent.press(view.getByLabelText(label));
  expect(link).not.toHaveBeenCalled();
  expect(mockCapture).not.toHaveBeenCalled();
  expect(mockShareImage).not.toHaveBeenCalled();
  link.mockRestore();
});

it('generates v2 creator share links for links and QR codes', () => {
  expect(affiliateUrl('my-page')).toBe('https://tendso.com/v2/a/my-page');
  expect(affiliateUrl('a/b')).toBe('https://tendso.com/v2/a/a%2Fb');
});
