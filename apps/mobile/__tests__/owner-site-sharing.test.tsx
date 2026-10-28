import React from 'react';
import { Share } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { OwnerSiteQr } from '../components/v2/owner/OwnerSiteQr';
import { publicSiteUrl } from '../components/v2/owner/OwnerSiteSummary';
import Live from '../app/(owner)/live';
import PayMethod from '../app/(owner)/pay/method';

const mockSaveImage = jest.fn();
const mockPermission = jest.fn();
const mockShareImage = jest.fn();
const mockSharingAvailable = jest.fn();
const mockCapture = jest.fn();
const mockCreateToken = jest.fn();
const mockCheckout = jest.fn();
const mockBrowser = jest.fn();
const mockReplace = jest.fn();
const mockRequestDomain = jest.fn();
let mockCurrent = true;
let mockId = 'owner-site';
let mockSubject = 'owner-clerk';
let mockSite: any;
let mockPreview: any;
let mockPay: any;

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject }) }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-view-shot', () => ({ captureRef: (...args: unknown[]) => mockCapture(...args) }));
jest.mock('expo-media-library', () => ({ requestPermissionsAsync: (...args: unknown[]) => mockPermission(...args), saveToLibraryAsync: (...args: unknown[]) => mockSaveImage(...args) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: () => mockSharingAvailable(), shareAsync: (...args: unknown[]) => mockShareImage(...args) }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: (...args: unknown[]) => mockBrowser(...args) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }), useLocalSearchParams: () => ({ kind: 'full', amount: '4999' }) }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => ({ id: mockId, site: mockSite, me: { owner: { _id: 'owner', name: 'Ben', email: 'ben@example.com' } } }) }));
jest.mock('../lib/v2/ownerData', () => ({
  usePreview: () => mockPreview, useRequestDomain: () => mockRequestDomain, usePaymentState: () => mockPay,
  useCreatePayToken: () => mockCreateToken, useCreateCheckout: () => mockCheckout, wisePayUrl: (token: string) => `https://www.tendso.com/pay/${token}`,
}));

beforeEach(() => {
  jest.clearAllMocks(); mockCurrent = true; mockId = 'owner-site'; mockSubject = 'owner-clerk';
  mockSite = { businessName: 'Ben Barber', phase: 'live', publishedUrl: 'https://ben.sites.tendso.com' };
  mockPreview = { ready: true, htmlUrl: null, inlineHtml: null, publishedUrl: mockSite.publishedUrl, isLive: true };
  mockPay = { billable: true, total: 4999, balanceDue: 4999, paidInFull: false, needsApproval: false, xenditEnabled: true };
  mockPermission.mockResolvedValue({ granted: true }); mockSaveImage.mockResolvedValue(undefined);
  mockCapture.mockResolvedValue('file://qr.png'); mockSharingAvailable.mockResolvedValue(true); mockShareImage.mockResolvedValue(undefined);
  mockCreateToken.mockResolvedValue({ token: 'payment-token' }); mockCheckout.mockResolvedValue({ enabled: true, checkoutUrl: 'https://checkout.example.com' });
  mockBrowser.mockResolvedValue({ type: 'cancel' });
});

it('renders a real QR and saves an undistorted image after photo permission', async () => {
  const view = render(<OwnerSiteQr name="Ben Barber" url="https://ben.sites.tendso.com" isCurrent={() => mockCurrent} />);
  expect(view.getByLabelText('QR code for Ben Barber website')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Save QR'));
  await waitFor(() => expect(mockSaveImage).toHaveBeenCalledWith('file://qr.png'));
  expect(mockCapture).toHaveBeenCalledWith(expect.anything(), { format: 'png', quality: 1, width: 1000 });
  expect(view.getByText('QR code saved to your photos.')).toBeTruthy();
});

it('shares a PNG without asking for photo access', async () => {
  const view = render(<OwnerSiteQr name="Ben Barber" url="https://ben.sites.tendso.com" isCurrent={() => mockCurrent} />);
  fireEvent.press(view.getByLabelText('Share QR'));
  await waitFor(() => expect(mockShareImage).toHaveBeenCalledWith('file://qr.png', expect.objectContaining({ mimeType: 'image/png' })));
  expect(mockPermission).not.toHaveBeenCalled();
});

it('retains the card and explains denied permission without capturing', async () => {
  mockPermission.mockResolvedValue({ granted: false });
  const view = render(<OwnerSiteQr name="Ben" url="https://ben.sites.tendso.com" isCurrent={() => mockCurrent} />);
  fireEvent.press(view.getByLabelText('Save QR'));
  await waitFor(() => expect(view.getByText(/Allow photo access/)).toBeTruthy());
  expect(mockCapture).not.toHaveBeenCalled(); expect(mockSaveImage).not.toHaveBeenCalled();
});

it('stops a delayed QR save when the account or selected site changes', async () => {
  let finish!: (value: unknown) => void;
  mockPermission.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<OwnerSiteQr name="Ben" url="https://ben.sites.tendso.com" isCurrent={() => mockCurrent} />);
  fireEvent.press(view.getByLabelText('Save QR'));
  mockCurrent = false;
  await act(async () => { finish({ granted: true }); });
  expect(mockCapture).not.toHaveBeenCalled(); expect(mockSaveImage).not.toHaveBeenCalled();
});

it('deduplicates quick QR taps and lets a failed capture retry', async () => {
  mockCapture.mockRejectedValueOnce(new Error('Capture failed'));
  const view = render(<OwnerSiteQr name="Ben" url="https://ben.sites.tendso.com" isCurrent={() => mockCurrent} />);
  fireEvent.press(view.getByLabelText('Share QR')); fireEvent.press(view.getByLabelText('Share QR'));
  await waitFor(() => expect(view.getByText(/Could not create/)).toBeTruthy());
  expect(mockCapture).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByLabelText('Share QR'));
  await waitFor(() => expect(mockShareImage).toHaveBeenCalledTimes(1));
});

it('does not invent a live address or QR while publication metadata is missing', () => {
  mockSite.publishedUrl = null; mockPreview.publishedUrl = null;
  const view = render(<Live />);
  expect(view.getByText('Getting your address ready…')).toBeTruthy();
  expect(view.queryByTestId('owner-site-qr-artwork')).toBeNull();
  expect(view.getByRole('button', { name: 'Copy' }).props.accessibilityState.disabled).toBe(true);
});

it('keeps the live URL’s scheme/path when sharing and hides the QR before going live', () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  mockSite.publishedUrl = 'https://ben.example.com/shop'; mockPreview.publishedUrl = mockSite.publishedUrl;
  const view = render(<Live />);
  fireEvent.press(view.getByRole('button', { name: 'Share' }));
  expect(share).toHaveBeenCalledWith({ message: 'Ben Barber: https://ben.example.com/shop' });
  mockSite = { ...mockSite, phase: 'awaiting_payment' }; view.rerender(<Live />);
  expect(view.queryByTestId('owner-site-qr-artwork')).toBeNull(); share.mockRestore();
});

it('rejects credentials, scripts and guessed bare hostnames for public sharing', () => {
  for (const url of ['javascript:alert(1)', 'https://user:secret@example.com', 'ben.sites.tendso.com', '']) expect(publicSiteUrl(url)).toBeNull();
  expect(publicSiteUrl('https://ben.example.com/path')).toBe('https://ben.example.com/path');
});

it('deduplicates checkout creation and waits for billing/preview approval', async () => {
  const view = render(<PayMethod />);
  fireEvent.press(view.getByLabelText('Pay ₱4,999')); fireEvent.press(view.getByLabelText('Pay ₱4,999'));
  await waitFor(() => expect(mockBrowser).toHaveBeenCalledTimes(1));
  expect(mockCreateToken).toHaveBeenCalledTimes(1);
  expect(mockCreateToken).toHaveBeenCalledWith({ submissionId: 'owner-site', kind: 'full', amount: undefined, expectedTotal: 4999 });
  mockPay = { ...mockPay, needsApproval: true }; view.rerender(<PayMethod />);
  expect(view.getByLabelText('Pay ₱4,999').props.accessibilityState.disabled).toBe(true);
});

it('does not open checkout or navigate after the selected site changes during token creation', async () => {
  let finish!: (value: unknown) => void;
  mockCreateToken.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<PayMethod />);
  fireEvent.press(view.getByLabelText('Pay ₱4,999'));
  mockId = 'another-site'; view.rerender(<PayMethod />);
  await act(async () => { finish({ token: 'old-payment-token' }); });
  expect(mockCheckout).not.toHaveBeenCalled(); expect(mockBrowser).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});

it('does not open another account’s checkout while the old selected site id is retained', async () => {
  let finish!: (value: unknown) => void;
  mockCreateToken.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<PayMethod />);
  fireEvent.press(view.getByLabelText('Pay ₱4,999'));
  mockSubject = 'different-clerk'; view.rerender(<PayMethod />);
  await act(async () => { finish({ token: 'old-payment-token' }); });
  expect(mockCheckout).not.toHaveBeenCalled(); expect(mockBrowser).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});
