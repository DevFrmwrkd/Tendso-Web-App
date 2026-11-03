import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import PaymentSimulator from '../app/(owner)/payment-simulator';
import { OwnerPaymentSimulatorEntry } from '../components/v2/owner/OwnerPaymentSimulatorEntry';
import { simulationAmount } from '../lib/v2/ownerPaymentSimulator';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockRun = jest.fn(), mockQuery = jest.fn(), mockRealPayment = jest.fn(() => { throw new Error('Real payment APIs must never run in the simulator'); });
const mockConvexQuery = jest.fn();
const originalConvexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
let mockSubject: string, mockSession: string, mockBusiness: string, mockOwner: string;
let mockConnected: boolean, mockFocused: boolean, mockSimulation: any;
let mockUuid = 0;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject, sessionId: mockSession }) }));
jest.mock('convex/react', () => ({ useQuery: (ref: string, args: unknown) => { mockConvexQuery(ref, args); return mockSimulation; }, useMutation: () => mockRun }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `simulation-request-${++mockUuid}` }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]),
}));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => ({ id: mockBusiness, me: { owner: { _id: mockOwner } } }) }));
jest.mock('../lib/v2/ownerPaymentSimulator', () => ({
  ...jest.requireActual('../lib/v2/ownerPaymentSimulator'),
  useOwnerPaymentSimulation: (id: string) => { mockQuery(id); return mockSimulation; },
  useRunOwnerPaymentSimulation: () => mockRun,
}));
jest.mock('../lib/v2/ownerData', () => ({ useCreatePayToken: () => mockRealPayment, useCreateCheckout: () => mockRealPayment,
  useApprovePreview: () => mockRealPayment, useRetryOwnerPayment: () => mockRealPayment,
}));

function snapshot(changes: Record<string, unknown> = {}) {
  return { simulationOnly: true, withdrawable: false, actorClerkId: mockSubject, ownerId: mockOwner, submissionId: mockBusiness,
    businessName: '[TEST] Kanto Cuts', sessionId: null, currency: 'PHP', total: 4999, amountPaid: 0, balanceDue: 4999,
    minDeposit: 500, revision: 0, attempt: 1, referenceCode: 'SIM-TEST-1', paymentStatus: 'unpaid', requestStatus: 'open',
    reviewStatus: 'none', pendingReview: null, lastReceiptId: null, priceChanged: false, canReset: true, events: [], ...changes };
}
function event(message: string, action = 'full', outcome = 'applied') {
  return { id: `event-${action}`, action, outcome, amount: 4999, createdAt: 1000, message };
}
function respond(changes: Record<string, unknown>) {
  mockRun.mockImplementationOnce(async () => { mockSimulation = { ...mockSimulation, revision: mockSimulation.revision + 1, ...changes }; return mockSimulation; });
}
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (cause: Error) => void;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function press(screen: ReturnType<typeof render>, name: string) {
  await act(async () => { fireEvent.press(screen.getByRole('button', { name })); });
}
beforeEach(() => {
  jest.clearAllMocks(); mockSubject = 'owner-clerk'; mockSession = 'clerk-session'; mockBusiness = 'test-business'; mockOwner = 'owner-row';
  process.env.EXPO_PUBLIC_CONVEX_URL = 'https://diligent-ibex-454.convex.cloud';
  mockConnected = true; mockFocused = true; mockUuid = 0; mockSimulation = snapshot(); mockRun.mockReset().mockResolvedValue(mockSimulation);
});
afterEach(() => {
  if (originalConvexUrl === undefined) delete process.env.EXPO_PUBLIC_CONVEX_URL; else process.env.EXPO_PUBLIC_CONVEX_URL = originalConvexUrl;
  jest.restoreAllMocks(); expect(mockRealPayment).not.toHaveBeenCalled();
});

it('queries eligibility before showing the test-business entry and hides it when access is denied', () => {
  mockSimulation = undefined;
  const screen = render(<OwnerPaymentSimulatorEntry submissionId={mockBusiness as never} businessName="[TEST] Kanto Cuts" ownerId={mockOwner} />);
  expect(mockQuery).toHaveBeenCalledWith(mockBusiness); expect(screen.queryByText('PHP payment simulator')).toBeNull();
  mockSimulation = null; screen.rerender(<OwnerPaymentSimulatorEntry submissionId={mockBusiness as never} businessName="[TEST] Kanto Cuts" ownerId={mockOwner} />);
  expect(screen.queryByText('PHP payment simulator')).toBeNull();
  mockSimulation = snapshot(); screen.rerender(<OwnerPaymentSimulatorEntry submissionId={mockBusiness as never} businessName="[TEST] Kanto Cuts" ownerId={mockOwner} />);
  fireEvent.press(screen.getByText('PHP payment simulator'));
  expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/payment-simulator');
});

it('does not query or show simulator entry for an ordinary business', () => {
  const screen = render(<OwnerPaymentSimulatorEntry submissionId={mockBusiness as never} businessName="Kanto Cuts" ownerId={mockOwner} />);
  expect(mockQuery).not.toHaveBeenCalled(); expect(screen.queryByText('PHP payment simulator')).toBeNull();
});

it('never queries the simulator backend or shows its entry in a production build', () => {
  process.env.EXPO_PUBLIC_CONVEX_URL = 'https://energetic-panther-693.convex.cloud';
  const screen = render(<OwnerPaymentSimulatorEntry submissionId={mockBusiness as never} businessName="[TEST] Kanto Cuts" ownerId={mockOwner} />);
  expect(mockQuery).not.toHaveBeenCalled(); expect(screen.queryByText('PHP payment simulator')).toBeNull();
  const actualHook = jest.requireActual('../lib/v2/ownerPaymentSimulator').useOwnerPaymentSimulation;
  const hook = renderHook(() => actualHook(mockBusiness));
  expect(hook.result.current).toBeNull();
  expect(mockConvexQuery).toHaveBeenCalledWith('paymentSimulator:get', 'skip');
});

it.each(['denied', 'foreign actor', 'foreign owner', 'foreign business', 'withdrawable'])('blocks direct simulator access for %s', reason => {
  mockSimulation = reason === 'denied' ? null : snapshot(reason === 'foreign actor' ? { actorClerkId: 'another-clerk' }
    : reason === 'foreign owner' ? { ownerId: 'another-owner' } : reason === 'foreign business' ? { submissionId: 'another-site' } : { withdrawable: true });
  const screen = render(<PaymentSimulator />);
  expect(screen.getByRole('header', { name: 'Simulator unavailable' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Simulate full payment' })).toBeNull(); expect(mockRun).not.toHaveBeenCalled();
});

it('clearly labels the PHP ledger and simulates full payment without real money or navigation', async () => {
  respond({ amountPaid: 4999, balanceDue: 0, paymentStatus: 'paid', requestStatus: 'paid', lastReceiptId: 'receipt-1', events: [event('Simulated payment confirmed.')] });
  const screen = render(<PaymentSimulator />);
  expect(screen.getByText('PHP simulation · No real money')).toBeTruthy();
  expect(screen.getByText('Test payments only. No payouts, website publication, emails or domain purchases.')).toBeTruthy();
  await press(screen, 'Simulate full payment');
  expect(mockRun).toHaveBeenCalledWith({ submissionId: mockBusiness, action: 'full', requestId: 'simulation-request-1', expectedRevision: 0, expectedTotal: 4999 });
  expect(screen.getByText('Simulated paid')).toBeTruthy(); expect(screen.getAllByText('₱0')).toHaveLength(1);
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('preserves simulated deposit credit and then pays only the remaining balance', async () => {
  respond({ amountPaid: 1000, balanceDue: 3999, paymentStatus: 'deposit_paid', lastReceiptId: 'deposit-1', events: [event('Deposit simulated.', 'deposit')] });
  const screen = render(<PaymentSimulator />);
  fireEvent.changeText(screen.getByLabelText('Test transfer amount (PHP)'), '1000');
  await press(screen, 'Simulate deposit');
  expect(mockRun).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'deposit', amount: 1000, expectedTotal: 4999, expectedRevision: 0 }));
  expect(screen.getByText('Simulated deposit')).toBeTruthy(); expect(screen.getByText('₱3,999')).toBeTruthy();
  respond({ amountPaid: 4999, balanceDue: 0, paymentStatus: 'paid', requestStatus: 'paid', events: [event('Balance simulated.', 'balance')] });
  await press(screen, 'Simulate balance payment');
  expect(mockRun).toHaveBeenLastCalledWith({ submissionId: mockBusiness, action: 'balance', requestId: 'simulation-request-2', expectedRevision: 1, expectedTotal: 4999 });
  expect(screen.getByText('Simulated paid')).toBeTruthy();
});

it('keeps a missing-reference receipt uncredited until simulated team confirmation', async () => {
  respond({ reviewStatus: 'needs_review', pendingReview: { receiptId: 'unmatched-1', amount: 500, kind: 'deposit' },
    events: [event('Test receipt needs review.', 'unmatched', 'needs_review')] });
  const screen = render(<PaymentSimulator />);
  await press(screen, 'Simulate missing reference');
  expect(mockRun).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'unmatched', amount: 500 }));
  expect(screen.getByText('Needs team review · ₱500')).toBeTruthy(); expect(screen.getByText('Simulated unpaid')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Expire test payment' }).props.accessibilityState.disabled).toBe(true);
  respond({ amountPaid: 500, balanceDue: 4499, paymentStatus: 'deposit_paid', reviewStatus: 'approved', pendingReview: null,
    lastReceiptId: 'unmatched-1', events: [event('Test receipt confirmed by team.', 'approve_review')] });
  await press(screen, 'Confirm test receipt');
  expect(mockRun).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'approve_review', expectedRevision: 1 }));
  expect(screen.getByText('Simulated deposit')).toBeTruthy(); expect(screen.getByText('₱4,499')).toBeTruthy();
});

it('expires a simulated request and renews it using Pay again without real checkout', async () => {
  respond({ requestStatus: 'expired', events: [event('Test link expired.', 'expire', 'expired')] });
  const screen = render(<PaymentSimulator />); await press(screen, 'Expire test payment');
  expect(screen.getByRole('button', { name: 'Simulate full payment' }).props.accessibilityState.disabled).toBe(true);
  respond({ requestStatus: 'open', referenceCode: 'SIM-TEST-2', attempt: 2, events: [event('New simulated link ready.', 'renew', 'renewed')] });
  await press(screen, 'Pay again');
  expect(mockRun).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'renew', expectedRevision: 1 }));
  expect(screen.getByText('Test reference: SIM-TEST-2')).toBeTruthy(); expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('shows a duplicate receipt as a no-op without increasing simulated credit', async () => {
  mockSimulation = snapshot({ amountPaid: 500, balanceDue: 4499, paymentStatus: 'deposit_paid', lastReceiptId: 'receipt-1' });
  respond({ events: [event('Duplicate ignored. No extra credit.', 'duplicate', 'duplicate')] });
  const screen = render(<PaymentSimulator />); await press(screen, 'Repeat receipt');
  expect(mockRun).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'duplicate' }));
  expect(screen.getByText('₱4,499')).toBeTruthy(); expect(screen.getAllByText('Duplicate ignored. No extra credit.').length).toBeGreaterThan(0);
});

it('requires confirmation before resetting only this simulation', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const screen = render(<PaymentSimulator />); await press(screen, 'Reset simulation');
  expect(mockRun).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2]!;
  await act(async () => { buttons.find(button => button.text === 'Reset simulation')!.onPress!(); });
  expect(mockRun).toHaveBeenCalledWith(expect.objectContaining({ action: 'reset' }));
});

it('disables transfers while offline, with an invalid amount or after a price change', async () => {
  const screen = render(<PaymentSimulator />);
  fireEvent.changeText(screen.getByLabelText('Test transfer amount (PHP)'), '499');
  expect(screen.getByRole('button', { name: 'Simulate deposit' }).props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(screen.getByLabelText('Test transfer amount (PHP)'), '500.25');
  expect(screen.getByRole('button', { name: 'Simulate missing reference' }).props.accessibilityState.disabled).toBe(true);
  mockConnected = false; screen.rerender(<PaymentSimulator />); await press(screen, 'Simulate full payment');
  expect(mockRun).not.toHaveBeenCalled(); expect(screen.getByText('Reconnect to update the test ledger.')).toBeTruthy();
  mockConnected = true; mockSimulation = snapshot({ priceChanged: true }); screen.rerender(<PaymentSimulator />);
  expect(screen.getByRole('button', { name: 'Simulate full payment' }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Reset simulation' }).props.accessibilityState.disabled).toBe(false);
});

it('deduplicates presses and keeps backend errors on the simulator screen', async () => {
  const pending = deferred(); mockRun.mockReturnValue(pending.promise);
  const screen = render(<PaymentSimulator />);
  fireEvent.press(screen.getByRole('button', { name: 'Simulate full payment' }));
  fireEvent.press(screen.getByRole('button', { name: 'Simulate full payment' }));
  expect(mockRun).toHaveBeenCalledTimes(1);
  await act(async () => { pending.reject(new Error('Test ledger changed. Reload and try again.')); });
  expect(screen.getByText('Test ledger changed. Reload and try again.')).toBeTruthy(); expect(mockRouter.replace).not.toHaveBeenCalled();
});

it.each(['business', 'account'] as const)('ignores a late result after changing the %s', async change => {
  const pending = deferred(); mockRun.mockReturnValue(pending.promise);
  const old = snapshot({ events: [event('Old simulation completed.')] });
  const screen = render(<PaymentSimulator />); fireEvent.press(screen.getByRole('button', { name: 'Simulate full payment' }));
  if (change === 'business') mockBusiness = 'second-business'; else { mockSubject = 'second-clerk'; mockOwner = 'second-owner'; }
  mockSimulation = snapshot({ businessName: '[TEST] Next business' }); screen.rerender(<PaymentSimulator />);
  await act(async () => { pending.resolve(old); });
  expect(screen.queryByText('Old simulation completed.')).toBeNull(); expect(screen.getByText('[TEST] Next business')).toBeTruthy();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('ignores a blurred operation without cancelling a new attempt after refocus', async () => {
  const old = deferred(), fresh = deferred(); mockRun.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  const screen = render(<PaymentSimulator />); fireEvent.press(screen.getByRole('button', { name: 'Simulate full payment' }));
  mockFocused = false; screen.rerender(<PaymentSimulator />); mockFocused = true; screen.rerender(<PaymentSimulator />);
  fireEvent.press(screen.getByRole('button', { name: 'Simulate full payment' })); expect(mockRun).toHaveBeenCalledTimes(2);
  await act(async () => { old.reject(new Error('Old focus error')); });
  expect(screen.queryByText('Old focus error')).toBeNull();
  expect(screen.getByRole('button', { name: 'Simulate full payment' }).props.accessibilityState.busy).toBe(true);
  await act(async () => { fresh.resolve(snapshot({ events: [event('Current operation completed.')] })); });
  await waitFor(() => expect(screen.getByText('Current operation completed.')).toBeTruthy());
});

it.each(['revision', 'quote'] as const)('does not show an old confirmation after another device changes the %s', async change => {
  const pending = deferred(); mockRun.mockReturnValue(pending.promise);
  const result = snapshot({ revision: 1, events: [event('Outdated confirmation.')] });
  const screen = render(<PaymentSimulator />); fireEvent.press(screen.getByRole('button', { name: 'Simulate full payment' }));
  mockSimulation = change === 'revision' ? snapshot({ revision: 3 }) : snapshot({ total: 6999, balanceDue: 6999 });
  screen.rerender(<PaymentSimulator />);
  await act(async () => { pending.resolve(result); });
  expect(screen.queryByText('Outdated confirmation.')).toBeNull();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it.each(['0', '-5', '500.5', '1e3', '1,000', '', '9007199254740992'])('rejects a non-whole or unsafe PHP transfer amount: %s', value => {
  expect(simulationAmount(value)).toBeNull();
});
