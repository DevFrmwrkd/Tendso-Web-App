import React from 'react';
import { Animated } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Button } from '../components/v2';
import AskChange from '../app/(owner)/change';
import BookVisit from '../app/(owner)/agents/book';
import Building from '../app/(owner)/building';
import PayPart from '../app/(owner)/pay/part';
import PayMethod from '../app/(owner)/pay/method';

const mockPush = jest.fn(), mockReplace = jest.fn(), mockBack = jest.fn();
const mockRequestChange = jest.fn(), mockRequestVisit = jest.fn(), mockCreateToken = jest.fn(), mockCheckout = jest.fn(), mockBrowser = jest.fn(), mockRetry = jest.fn();
let mockId: string | null, mockSubject: string, mockFocused: boolean, mockConnected: boolean;
let mockSite: any, mockPayment: any, mockBuild: any, mockParams: Record<string, string>;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: (...args: unknown[]) => mockBrowser(...args) }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]),
  Redirect: ({ href }: { href: string }) => require('react').createElement(require('react-native').Text, { testID: 'owner-redirect' }, href),
}));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
jest.mock('../lib/v2/ownerIntake', () => ({ useOwnerIntake: () => ({ businessName: 'Intake shop', ownerName: 'Ben' }),
  ownerIntake: { scope: () => 0, isCurrent: (scope: number) => scope === 0 },
}));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => ({ id: mockId, site: mockSite,
  me: { owner: { _id: mockSubject, name: 'Ben Reyes', phone: '09171234567', email: 'ben@example.com' } } }) }));
jest.mock('../lib/v2/ownerData', () => ({
  useRequestChange: () => mockRequestChange, useRequestVisit: () => mockRequestVisit, useBuild: () => mockBuild,
  usePaymentState: () => mockPayment, useCreatePayToken: () => mockCreateToken, useCreateCheckout: () => mockCheckout,
  useRetryOwnerPayment: () => mockRetry,
  wisePayUrl: (token: string) => `https://www.tendso.com/pay/${encodeURIComponent(token)}`,
}));
jest.mock('../components/v2/owner/OwnerSiteSummary', () => ({ OwnerSiteSummary: () => null }));

const payment = { billable: true, status: 'approved', total: 4999, amountPaid: 0, balanceDue: 4999,
  paidInFull: false, depositPaid: false, minDownPayment: 500, canPayFull: true, canPayDeposit: true,
  canPayBalance: false, needsApproval: false, xenditEnabled: true, pendingTokens: [] };
const settle = async () => { await act(async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); }); };
beforeEach(() => {
  jest.clearAllMocks(); mockId = 'site-a'; mockSubject = 'owner-a'; mockFocused = true; mockConnected = true;
  mockSite = { submissionId: mockId, businessName: 'Ben Barber', phase: 'ready_to_check' };
  mockParams = { kind: 'full', amount: '4999' }; mockPayment = { ...payment };
  mockBuild = { phase: 'ready_to_check', steps: [], doneCount: 4 };
  mockRequestChange.mockReset().mockResolvedValue(undefined); mockRequestVisit.mockReset().mockResolvedValue(undefined);
  mockCreateToken.mockReset().mockResolvedValue({ token: 'pay-token', referenceCode: 'TND-TEST', kind: 'full', amount: 4999, expiresAt: Date.now() + 60000 });
  mockCheckout.mockReset().mockResolvedValue({ enabled: true, checkoutUrl: 'https://checkout.example.com/invoice' });
  mockBrowser.mockReset().mockResolvedValue({ type: 'cancel' });
  jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() } as any);
});
afterEach(() => jest.restoreAllMocks());

it.each([
  ['ready_to_check', 'Check my site', '/(owner)/check'], ['awaiting_payment', 'Pay to publish', '/(owner)/pay'],
  ['publishing', 'See progress', '/(owner)/live'], ['live', 'View my site', '/(owner)/(tabs)/site'],
])('uses the correct completed-build action for %s', (phase, label, route) => {
  mockBuild.phase = phase;
  const screen = render(<Building />);
  fireEvent.press(screen.getByRole('button', { name: label }));
  expect(mockReplace).toHaveBeenCalledWith(route);
  if (phase !== 'ready_to_check') expect(screen.queryByRole('header', { name: 'Ready to check' })).toBeNull();
});

it('does not show an invented deposit price while billing is loading', () => {
  mockPayment = undefined;
  const screen = render(<PayPart />);
  expect(screen.queryByRole('button', { name: /^Pay/ })).toBeNull();
  expect(mockPush).not.toHaveBeenCalled();
});

it.each([['deposit', PayPart], ['payment method', PayMethod]] as const)('lets an owner without a selected site leave the %s screen', (_, Screen) => {
  mockId = null; mockSite = null; mockPayment = undefined;
  const screen = render(<Screen />);
  fireEvent.press(screen.getByRole('button', { name: 'Back to home' }));
  expect(mockReplace).toHaveBeenCalledWith('/(owner)/(tabs)/today');
  expect(mockCreateToken).not.toHaveBeenCalled(); expect(mockBrowser).not.toHaveBeenCalled();
});

it.each<[typeof payment, string]>([
  [{ ...payment, canPayDeposit: false }, '/(owner)/pay'], [{ ...payment, needsApproval: true }, '/(owner)/check'],
  [{ ...payment, paidInFull: true }, '/(owner)/live'],
])('does not offer a deposit when billing disallows it', (state, route) => {
  mockPayment = state;
  const screen = render(<PayPart />);
  expect(screen.getByTestId('owner-redirect')).toHaveTextContent(route);
  expect(screen.queryByRole('button', { name: /^Pay/ })).toBeNull();
});

it('uses the real deposit minimum and navigates with the displayed amount', () => {
  mockPayment = { ...payment, minDownPayment: 1500 };
  const screen = render(<PayPart />);
  fireEvent.press(screen.getByRole('button', { name: 'Less' }));
  fireEvent.press(screen.getByRole('button', { name: 'Pay ₱1,500 now' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(owner)/pay/method', params: { kind: 'deposit', amount: '1500' } });
});

it.each(['javascript:alert(1)', 'http://checkout.example.com', 'https://name:secret@checkout.example.com', 'not a URL'])(
  'blocks the unsafe hosted checkout address %s', async checkoutUrl => {
    mockCheckout.mockResolvedValue({ enabled: true, checkoutUrl });
    const screen = render(<PayMethod />);
    fireEvent.press(screen.getByRole('button', { name: 'Pay ₱4,999' }));
    await waitFor(() => expect(screen.getByText('The payment link is unavailable. Please try again.')).toBeTruthy());
    expect(mockBrowser).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
  },
);

it.each(['quote', 'approval', 'paid', 'network'])('does not open stale checkout when %s changes during token creation', async change => {
  let finish!: (value: unknown) => void;
  mockCreateToken.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const screen = render(<PayMethod />);
  fireEvent.press(screen.getByRole('button', { name: 'Pay ₱4,999' }));
  if (change === 'quote') mockPayment = { ...payment, total: 3499, balanceDue: 3499 };
  if (change === 'approval') mockPayment = { ...payment, needsApproval: true };
  if (change === 'paid') mockPayment = { ...payment, paidInFull: true, balanceDue: 0 };
  if (change === 'network') mockConnected = false;
  screen.rerender(<PayMethod />);
  await act(async () => { finish({ token: 'old-token' }); });
  expect(mockCheckout).not.toHaveBeenCalled(); expect(mockBrowser).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});

it('does not open an old payment after leaving and returning during checkout creation', async () => {
  let finish!: (value: unknown) => void;
  mockCheckout.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const screen = render(<PayMethod />);
  fireEvent.press(screen.getByRole('button', { name: 'Pay ₱4,999' }));
  await waitFor(() => expect(mockCheckout).toHaveBeenCalledTimes(1));
  mockFocused = false; screen.rerender(<PayMethod />);
  mockFocused = true; screen.rerender(<PayMethod />);
  await act(async () => { finish({ enabled: true, checkoutUrl: 'https://checkout.example.com/old' }); });
  expect(mockBrowser).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});

it('retains a valid browser-return navigation when the webhook makes the site paid', async () => {
  let finish!: (value: unknown) => void;
  mockBrowser.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const screen = render(<PayMethod />);
  fireEvent.press(screen.getByRole('button', { name: 'Pay ₱4,999' }));
  await waitFor(() => expect(mockBrowser).toHaveBeenCalledTimes(1));
  mockPayment = { ...payment, paidInFull: true, balanceDue: 0 }; screen.rerender(<PayMethod />);
  await act(async () => { finish({ type: 'cancel' }); });
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(owner)/live', params: { paymentToken: 'pay-token', paymentFor: 'owner-a:owner-a:site-a' } });
});

it('deduplicates change requests and does not navigate after the selected site changes', async () => {
  let finish!: () => void;
  mockRequestChange.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const screen = render(<AskChange />);
  fireEvent.changeText(screen.getByLabelText('Tell us in your own words'), 'Please update the hours.');
  const send = screen.UNSAFE_getAllByType(Button).find(button => button.props.title === 'Send')!.props.onPress;
  act(() => { void send(); void send(); });
  expect(mockRequestChange).toHaveBeenCalledTimes(1);
  mockId = 'site-b'; mockSite = { ...mockSite, submissionId: mockId }; screen.rerender(<AskChange />);
  await act(async () => { finish(); });
  expect(mockReplace).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Tell us in your own words').props.value).toBe('');
});

it('does not send a change while offline', () => {
  mockConnected = false;
  const screen = render(<AskChange />);
  fireEvent.changeText(screen.getByLabelText('Tell us in your own words'), 'Please update the hours.');
  fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(mockRequestChange).not.toHaveBeenCalled();
});

it('does not display an old site visit request as sent for a newly selected shop', async () => {
  let finish!: () => void;
  mockRequestVisit.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const screen = render(<BookVisit />);
  fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
  expect(mockRequestVisit).toHaveBeenCalledWith(expect.objectContaining({ shopName: 'Ben Barber' }));
  mockId = 'site-b'; mockSite = { ...mockSite, submissionId: mockId, businessName: 'Second shop' }; screen.rerender(<BookVisit />);
  await act(async () => { finish(); }); await settle();
  expect(screen.queryByText('Your visit request is sent')).toBeNull();
  expect(screen.getByText('Second shop')).toBeTruthy();
});
