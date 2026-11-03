import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PayMethod from '../app/(owner)/pay/method';
import Live from '../app/(owner)/live';
import { ownerIntake } from '../lib/v2/ownerIntake';
import type { OwnerMe, OwnerPaymentAttempt, PaymentState, SiteSummary, SubmissionId } from '../lib/v2/ownerTypes';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
const mockRetry = jest.fn(), mockCreate = jest.fn(), mockCheckout = jest.fn(), mockBrowser = jest.fn(), mockAttemptQuery = jest.fn();
let mockSubject = 'owner-a', mockFocused = true, mockConnected = true;
let mockMe: OwnerMe, mockPay: PaymentState, mockAttempt: OwnerPaymentAttempt | null | undefined;
let mockParams: Record<string, string>;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject }) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: (...args: unknown[]) => mockBrowser(...args) }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]),
}));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
jest.mock('../components/v2/owner/OwnerSiteQr', () => ({ OwnerSiteQr: () => null }));
jest.mock('../components/v2/owner/OwnerSiteSummary', () => ({
  OwnerSiteSummary: ({ name }: { name: string }) => require('react').createElement(require('react-native').Text, null, name),
  publicSiteUrl: () => null,
}));
jest.mock('../lib/v2/ownerData', () => ({
  useOwnerMe: () => mockMe,
  newestSite: (me: OwnerMe | undefined) => me?.sites[0] ?? null,
  usePaymentState: () => mockPay,
  useOwnerPaymentAttempt: (...args: unknown[]) => { mockAttemptQuery(...args); return mockAttempt; },
  useRetryOwnerPayment: () => mockRetry,
  useCreatePayToken: () => mockCreate,
  useCreateCheckout: () => mockCheckout,
  usePreview: () => undefined, useRequestDomain: () => jest.fn(),
  wisePayUrl: (token: string) => `https://www.tendso.com/pay/${encodeURIComponent(token)}`,
}));

const id = 'site-a' as SubmissionId;
const actor = 'owner-a:db-owner-a:site-a';
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);
const rerender = (screen: ReturnType<typeof wrap>, ui: React.ReactElement) => screen.rerender(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);
function methodParams(kind = 'full', amount = 4999) {
  return { retryToken: 'old-token', retryFor: actor, kind, amount: String(amount) };
}
function fresh(kind = 'full', amount = 4999) {
  return { status: 'ready', submissionId: id, token: 'fresh-token', referenceCode: 'TND-FRESH', kind, amount, expiresAt: Date.now() + 60000 };
}
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(async () => {
  jest.clearAllMocks(); mockSubject = 'owner-a'; mockFocused = true; mockConnected = true;
  const site: SiteSummary = { submissionId: id, businessName: 'Kanto Cuts', businessType: 'Barber/Salon', contentSource: 'owner_app',
    publishPolicy: 'pay_then_publish', status: 'website_generated', phase: 'awaiting_payment', publishedUrl: null,
    total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false, openChangeRequests: 0, createdAt: 1 };
  mockMe = { owner: { _id: 'db-owner-a', email: 'owner-a@example.test', name: 'Pablo', phone: null }, sites: [site] };
  mockPay = { billable: true, status: 'website_generated', total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false,
    depositPaid: false, minDownPayment: 500, canPayFull: true, canPayDeposit: true, canPayBalance: false,
    needsApproval: false, xenditEnabled: true, pendingTokens: [] };
  mockAttempt = { status: 'expired', submissionId: id, kind: 'full', amount: 4999, expiresAt: 1 };
  mockParams = { paymentToken: 'old-token', paymentFor: actor };
  await ownerIntake.bindActor(mockSubject); ownerIntake.clear(); ownerIntake.selectBusiness(id); await ownerIntake.flush();
  mockRetry.mockReset().mockResolvedValue(fresh()); mockCreate.mockReset().mockResolvedValue(fresh());
  mockCheckout.mockReset().mockResolvedValue({ enabled: true, checkoutUrl: 'https://checkout.example.com/fresh', invoiceId: 'fresh-invoice', expiresAt: null, amount: 4999 });
  mockBrowser.mockReset().mockResolvedValue({ type: 'cancel' });
});
afterEach(() => jest.restoreAllMocks());

it('shows confirmed expiry and carries the selected business into a secure fresh-checkout retry', async () => {
  const screen = wrap(<Live />);
  expect(screen.getByRole('header', { name: 'Payment link expired' })).toBeTruthy();
  expect(mockAttemptQuery).toHaveBeenCalledWith(id, 'old-token');
  fireEvent.press(screen.getByRole('button', { name: 'Pay again' }));
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/(owner)/pay/method', params: methodParams() });
  mockParams = methodParams(); rerender(screen, <PayMethod />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Pay again' })); });
  expect(mockRetry).toHaveBeenCalledWith({ token: 'old-token', expectedSubmissionId: id, expectedTotal: 4999 });
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockCheckout).toHaveBeenCalledWith('fresh-token');
  expect(mockBrowser).toHaveBeenCalledWith('https://checkout.example.com/fresh', expect.anything());
  expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: '/(owner)/live', params: { paymentToken: 'fresh-token', paymentFor: actor } });
});

it.each(['deposit', 'balance'] as const)('preserves the server’s current %s amount and uses only the renewed token', async kind => {
  if (kind === 'balance') mockPay = { ...mockPay, amountPaid: 1000, balanceDue: 3999, depositPaid: true, canPayFull: false, canPayDeposit: false, canPayBalance: true };
  const amount = kind === 'balance' ? 3999 : 1000;
  mockAttempt = { ...mockAttempt!, kind, amount };
  mockRetry.mockResolvedValue(fresh(kind, amount));
  const screen = wrap(<Live />);
  fireEvent.press(screen.getByRole('button', { name: 'Pay again' }));
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/(owner)/pay/method', params: methodParams(kind, amount) });
  mockParams = methodParams(kind, amount); rerender(screen, <PayMethod />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Pay again' })); });
  expect(mockRetry).toHaveBeenCalledWith({ token: 'old-token', expectedSubmissionId: id, expectedTotal: 4999 });
  expect(mockCheckout).toHaveBeenCalledWith('fresh-token');
  expect(mockCreate).not.toHaveBeenCalled();
});

it('uses the renewed payment request for Wise rather than opening an expired token page', async () => {
  mockParams = methodParams(); const screen = wrap(<PayMethod />);
  fireEvent.press(screen.getByRole('radio', { name: 'Bank transfer (Wise)' }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Pay again' })); });
  expect(mockCheckout).not.toHaveBeenCalled();
  expect(mockBrowser).toHaveBeenCalledWith('https://www.tendso.com/pay/fresh-token', expect.anything());
});

it('does not infer expiry, cancellation or no charge from dismissing the payment browser', async () => {
  mockParams = { kind: 'full', amount: '4999' };
  const screen = wrap(<PayMethod />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Pay ₱4,999' })); });
  expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: '/(owner)/live', params: { paymentToken: 'fresh-token', paymentFor: actor } });
  mockParams = { paymentToken: 'fresh-token', paymentFor: actor };
  mockAttempt = { ...mockAttempt!, status: 'ready', expiresAt: Date.now() + 60000 };
  rerender(screen, <Live />);
  expect(screen.getByRole('header', { name: 'Waiting for your payment' })).toBeTruthy();
  expect(screen.queryByText(/not charged|no charge|expired/i)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Pay again' })).toBeNull();
});

it('acknowledges a paid deposit and offers only the current remaining balance', () => {
  mockAttempt = { ...mockAttempt!, status: 'paid', kind: 'balance', amount: 3999 };
  mockPay = { ...mockPay, amountPaid: 1000, balanceDue: 3999, depositPaid: true, canPayFull: false, canPayDeposit: false, canPayBalance: true };
  const screen = wrap(<Live />);
  expect(screen.getByRole('header', { name: 'Down payment received' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Pay again' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Pay the rest · ₱3,999' }));
  expect(mockRouter.replace).toHaveBeenCalledWith('/(owner)/pay');
  expect(mockRetry).not.toHaveBeenCalled(); expect(mockCreate).not.toHaveBeenCalled();
});

it.each(['processing', 'paid', 'cancelled', 'needs_approval'] as const)('does not renew an attempt that is %s', status => {
  mockAttempt = { ...mockAttempt!, status };
  const screen = wrap(<Live />);
  expect(screen.queryByRole('button', { name: 'Pay again' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Continue payment' })).toBeNull();
  if (status === 'processing') expect(screen.getByText('An earlier checkout may still be open. Wait for its status to update before trying again.')).toBeTruthy();
  if (status === 'needs_approval') {
    fireEvent.press(screen.getByRole('button', { name: 'Check my site' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(owner)/check');
  }
  expect(mockRetry).not.toHaveBeenCalled(); expect(mockCreate).not.toHaveBeenCalled();
});

it('returns a cancelled request with changed approval to the latest private preview', () => {
  mockAttempt = { ...mockAttempt!, status: 'cancelled' }; mockPay = { ...mockPay, needsApproval: true };
  const screen = wrap(<Live />);
  fireEvent.press(screen.getByRole('button', { name: 'Check my site' }));
  expect(mockRouter.replace).toHaveBeenCalledWith('/(owner)/check');
  expect(mockRetry).not.toHaveBeenCalled();
});

it('does not query or retry an old actor’s checkout when business selection is retained', () => {
  mockSubject = 'owner-b';
  const screen = wrap(<Live />);
  expect(mockAttemptQuery).not.toHaveBeenCalled();
  expect(screen.queryByRole('header', { name: 'Payment link expired' })).toBeNull();
  mockParams = methodParams(); rerender(screen, <PayMethod />);
  expect(screen.getByRole('button', { name: 'Pay ₱4,999' })).toBeDisabled();
  expect(mockRetry).not.toHaveBeenCalled();
});

it('keeps Pay again visible but disabled while offline', () => {
  mockConnected = false;
  const screen = wrap(<Live />);
  expect(screen.getByRole('button', { name: 'Pay again' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Pay again' }));
  expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockRetry).not.toHaveBeenCalled();
  expect(screen.getByText('Reconnect to check the latest payment status.')).toBeTruthy();
});

it('handles an unknown or foreign attempt without exposing a retry or checkout', () => {
  mockAttempt = null;
  const screen = wrap(<Live />);
  expect(screen.getByRole('header', { name: 'Payment unavailable' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Pay again' })).toBeNull();
  expect(mockRetry).not.toHaveBeenCalled(); expect(mockCheckout).not.toHaveBeenCalled();
});

it.each(['business', 'actor', 'quote', 'approval', 'network', 'blur'] as const)('ignores a late retry response after %s changes', async change => {
  const pending = deferred(); mockRetry.mockReturnValue(pending.promise);
  mockParams = methodParams(); const screen = wrap(<PayMethod />);
  fireEvent.press(screen.getByRole('button', { name: 'Pay again' }));
  if (change === 'business') {
    const next = { ...mockMe.sites[0], submissionId: 'site-b' as SubmissionId };
    mockMe = { ...mockMe, sites: [next] };
    act(() => ownerIntake.selectBusiness(next.submissionId));
  } else if (change === 'actor') mockSubject = 'owner-b';
  else if (change === 'quote') mockPay = { ...mockPay, total: 3499, balanceDue: 3499 };
  else if (change === 'approval') mockPay = { ...mockPay, needsApproval: true };
  else if (change === 'network') mockConnected = false;
  else mockFocused = false;
  rerender(screen, <PayMethod />);
  await act(async () => pending.resolve(fresh()));
  expect(mockCheckout).not.toHaveBeenCalled(); expect(mockBrowser).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it.each(['paid', 'needs_approval', 'processing'] as const)('obeys a %s retry response without opening checkout', async status => {
  mockRetry.mockResolvedValue({ status, submissionId: id });
  mockParams = methodParams(); const screen = wrap(<PayMethod />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Pay again' })); });
  expect(mockCheckout).not.toHaveBeenCalled(); expect(mockBrowser).not.toHaveBeenCalled();
  if (status === 'needs_approval') expect(mockRouter.replace).toHaveBeenCalledWith('/(owner)/check');
  if (status === 'paid') expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/(owner)/live', params: { paymentToken: 'old-token', paymentFor: actor } });
  if (status === 'processing') expect(screen.getByText('An earlier checkout may still be open. Check its payment status before trying again.')).toBeTruthy();
});

it('blocks changed retry amounts and duplicate presses before opening the provider', async () => {
  const pending = deferred(); mockRetry.mockReturnValue(pending.promise);
  mockParams = methodParams(); const screen = wrap(<PayMethod />);
  const button = screen.getByRole('button', { name: 'Pay again' });
  fireEvent.press(button); fireEvent.press(button);
  expect(mockRetry).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(fresh('full', 3499)));
  expect(screen.getByText('Payment details changed. Return to your site to check the latest amount before paying.')).toBeTruthy();
  expect(mockCheckout).not.toHaveBeenCalled(); expect(mockBrowser).not.toHaveBeenCalled();
});
