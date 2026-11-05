import React from 'react';
import * as ReactNative from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AffiliateMoneyContent, AffiliateMoneyScreen, AffiliatePayoutDetailsScreen, PayoutDetailsContent, cashOutCentavos, centavosInput, pesoCentavos } from '../components/affiliate/Money';
import { AffiliateActivityContent, affiliateActivity } from '../components/affiliate/AffiliateActivity';
import { sampleAffiliate, samplePortal, type AffiliatePortal } from '../components/affiliate/model';

const mockPush = jest.fn();
const mockQuery = jest.fn();
const mockMutation = jest.fn();
const mockAccess = { account: { ...sampleAffiliate, wiseEmail: 'creator@wise.example' }, isPreview: false, isOffline: false, isAuthenticated: true };
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock('@clerk/clerk-expo', () => ({ useUser: () => ({ user: { id: 'preview' } }) }));
jest.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => mockQuery(...args), useMutation: (...args: unknown[]) => { mockMutation(...args); return jest.fn(); } }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true }) }));
jest.mock('../components/affiliate/Screen', () => ({
  AffiliateAccess: ({ children }: { children: (props: typeof mockAccess) => React.ReactNode }) => children(mockAccess),
  AffiliateFrame: ({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) => require('react').createElement(require('react-native').View, null, children, footer),
}));
jest.mock('../components/affiliate/AffiliateToolFrame', () => ({
  AffiliateToolFrame: ({ children, footer, title }: { children: React.ReactNode; footer: React.ReactNode; title: string }) => require('react').createElement(require('react-native').View, null,
    require('react').createElement(require('react-native').Text, null, title), children, footer),
}));

const account = { ...sampleAffiliate, wiseEmail: 'creator@wise.example' };
const now = Date.UTC(2026, 9, 29);
const portal: AffiliatePortal = {
  ...samplePortal,
  summary: { balance: 7200, totalEarned: 13700, totalWithdrawn: 6500, pendingCommission: 1250, inFlight: 500 },
  earnings: [
    { _id: 'link-1', amount: 2500, type: 'submission_approved', status: 'available', businessName: 'Kalan Kitchen', createdAt: now } as AffiliatePortal['earnings'][number],
    { _id: 'team-1', amount: 250, type: 'creator_override', status: 'available', businessName: 'Agent commission', createdAt: now - 2000 } as AffiliatePortal['earnings'][number],
    { _id: 'not-credited', amount: 1250, type: 'submission_approved', status: 'pending', businessName: 'Unpaid shop', createdAt: now + 1000 } as AffiliatePortal['earnings'][number],
  ],
  withdrawals: [
    { _id: 'pending-1', amount: 500, status: 'pending', wiseEmail: account.wiseEmail, createdAt: now - 1000 } as AffiliatePortal['withdrawals'][number],
    { _id: 'done-1', amount: 6500, status: 'completed', createdAt: now - 3000 } as AffiliatePortal['withdrawals'][number],
    { _id: 'failed-1', amount: 750, status: 'failed', createdAt: now - 4000 } as AffiliatePortal['withdrawals'][number],
  ],
};
const props = { account, isPreview: false, isOffline: false, isAuthenticated: true, actorMatches: true, portal };

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockAccess, { account, isPreview: false, isOffline: false, isAuthenticated: true });
  mockQuery.mockReturnValue(portal);
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
});
afterEach(() => jest.restoreAllMocks());

it.each([['0.01', 1], ['0.29', 29], ['7.2', 720], ['7200.25', 720025], ['0002.01', 201], [' 2 ', 200]])('parses %s as exact centavos', (value, expected) => {
  expect(cashOutCentavos(value)).toBe(expected);
  expect(cashOutCentavos(centavosInput(expected))).toBe(expected);
});
it.each(['', '0', '0.00', '-1', '1e3', '1,000', '1.001', '.50', '1.', '9007199254740991', '90071992547409.91'])('rejects an unsafe or invalid amount %s', value => {
  expect(cashOutCentavos(value)).toBeNull();
});
it('converts API decimal currency to integer centavos before comparisons', () => {
  expect(pesoCentavos(0.29)).toBe(29);
  expect(pesoCentavos(7200.25)).toBe(720025);
  expect(pesoCentavos(Number.NaN)).toBeNull();
  expect(pesoCentavos(undefined)).toBeNull();
});

it('uses the authoritative balance without subtracting reserved cash outs again', () => {
  const view = render(<AffiliateMoneyContent {...props} />);
  expect(view.getByTestId('affiliate-money-balance').props.children).toBe('₱7,200');
  expect(view.getByText('Awaiting shop payment')).toBeTruthy();
  expect(view.getByText('Cash outs in progress')).toBeTruthy();
  expect(view.getByText('₱1,250')).toBeTruthy();
  expect(view.getByText('₱500')).toBeTruthy();
  expect(view.getByText('Kalan Kitchen')).toBeTruthy();
  expect(view.queryByText('Unpaid shop')).toBeNull();
  fireEvent.press(view.getByLabelText('See all'));
  expect(mockPush).toHaveBeenCalledWith('/(app)/affiliate/activity');
});

it('requires review, submits once, and shows a pending receipt after the mocked request resolves', async () => {
  let resolve!: (result: { reference: string }) => void;
  const request = jest.fn(() => new Promise<{ reference: string }>(done => { resolve = done; }));
  const view = render(<AffiliateMoneyContent {...props} onRequest={request} />);
  fireEvent.press(view.getByLabelText('Cash out to Wise'));
  expect(view.getByLabelText('Cash-out amount').props.value).toBe('7200');
  fireEvent.changeText(view.getByLabelText('Cash-out amount'), '1000.25');
  fireEvent.press(view.getByLabelText('Review cash out'));
  expect(request).not.toHaveBeenCalled();
  expect(view.getByText('Ready to request?')).toBeTruthy();
  expect(view.getByText('₱6,199.75')).toBeTruthy();
  const confirm = view.getByTestId('affiliate-confirm-cashout');
  await act(async () => { fireEvent.press(confirm); fireEvent.press(confirm); });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith({ amount: 1000.25, wiseEmail: account.wiseEmail });
  expect(view.queryByText('Request received')).toBeNull();
  await act(async () => { resolve({ reference: 'PAYOUT-MOCK' }); });
  expect(view.getByText('Request received')).toBeTruthy();
  expect(view.getAllByText('Pending').length).toBeGreaterThan(0);
  expect(view.getByText('Reference: PAYOUT-MOCK')).toBeTruthy();
  expect(view.queryByText('Cash out completed')).toBeNull();
});

it('validates precision and the latest available balance before confirmation', () => {
  const request = jest.fn();
  const view = render(<AffiliateMoneyContent {...props} onRequest={request} />);
  fireEvent.press(view.getByLabelText('Cash out to Wise'));
  fireEvent.changeText(view.getByLabelText('Cash-out amount'), '7200.001');
  fireEvent.press(view.getByLabelText('Review cash out'));
  expect(view.getByText('Enter an amount with up to two decimal places.')).toBeTruthy();
  fireEvent.changeText(view.getByLabelText('Cash-out amount'), '7200.01');
  fireEvent.press(view.getByLabelText('Review cash out'));
  expect(view.getByText('Amount exceeds your available balance.')).toBeTruthy();
  fireEvent.changeText(view.getByLabelText('Cash-out amount'), '7200');
  fireEvent.press(view.getByLabelText('Review cash out'));
  view.rerender(<AffiliateMoneyContent {...props} portal={{ ...portal, summary: { ...portal.summary, balance: 100 } }} onRequest={request} />);
  fireEvent.press(view.getByTestId('affiliate-confirm-cashout'));
  expect(request).not.toHaveBeenCalled();
  expect(view.getByText('Your balance changed. Go back and review the amount again.')).toBeTruthy();
});

it('never repeats a confirmation after an ambiguous network failure', async () => {
  const request = jest.fn().mockRejectedValue(new Error('Network disconnected'));
  const view = render(<AffiliateMoneyContent {...props} onRequest={request} />);
  fireEvent.press(view.getByLabelText('Cash out to Wise'));
  fireEvent.press(view.getByLabelText('Review cash out'));
  await act(async () => { fireEvent.press(view.getByTestId('affiliate-confirm-cashout')); });
  expect(view.getByText('We could not confirm the request. Check payout history before trying again.')).toBeTruthy();
  fireEvent.press(view.getByTestId('affiliate-confirm-cashout'));
  expect(request).toHaveBeenCalledTimes(1);
});

it.each(['isPreview', 'isOffline', 'isAuthenticated', 'actorMatches'] as const)('disables cash outs when %s blocks writing', flag => {
  const request = jest.fn();
  const flags = { [flag]: flag === 'isPreview' || flag === 'isOffline' };
  const view = render(<AffiliateMoneyContent {...props} {...flags} onRequest={request} />);
  expect(view.getByTestId('affiliate-cashout')).toBeDisabled();
  fireEvent.press(view.getByTestId('affiliate-cashout'));
  expect(view.queryByLabelText('Cash-out amount')).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

it('keeps admin previews and paused accounts off live mutation hooks', () => {
  mockAccess.isPreview = true;
  const preview = render(<AffiliateMoneyScreen />);
  expect(mockMutation).not.toHaveBeenCalled();
  expect(mockQuery).not.toHaveBeenCalled();
  preview.unmount();
  const details = render(<AffiliatePayoutDetailsScreen />);
  expect(mockMutation).not.toHaveBeenCalled();
  details.unmount();
  mockAccess.isPreview = false;
  mockAccess.account = { ...account, status: 'suspended' };
  const suspended = render(<AffiliateMoneyScreen />);
  expect(mockMutation).not.toHaveBeenCalled();
  expect(suspended.getByTestId('affiliate-cashout')).toBeDisabled();
});

it('saves the real payout email before opening the amount sheet', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const view = render(<AffiliateMoneyContent {...props} account={{ ...account, wiseEmail: undefined }} onSaveEmail={save} />);
  fireEvent.press(view.getByLabelText('Cash out to Wise'));
  expect(view.getByText('Your Wise email.')).toBeTruthy();
  fireEvent.changeText(view.getByLabelText('Wise email'), 'new@wise.example');
  await act(async () => { fireEvent.press(view.getByLabelText('Save Wise email')); });
  expect(save).toHaveBeenCalledWith('new@wise.example');
  expect(view.getByLabelText('Cash-out amount')).toBeTruthy();
  expect(view.getByText('new@wise.example')).toBeTruthy();
});

it('validates and locks the separate payout details editor', async () => {
  let finish!: () => void;
  const save = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const view = render(<PayoutDetailsContent {...props} onSaveEmail={save} />);
  fireEvent.changeText(view.getByLabelText('Wise email'), 'invalid');
  fireEvent.press(view.getByLabelText('Save Wise email'));
  expect(view.getByText('Enter a valid Wise email address.')).toBeTruthy();
  fireEvent.changeText(view.getByLabelText('Wise email'), 'saved@wise.example');
  await act(async () => { fireEvent.press(view.getByLabelText('Save Wise email')); fireEvent.press(view.getByLabelText('Save Wise email')); });
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); });
  expect(view.getByText('Your Wise email is saved.')).toBeTruthy();
});

it('filters actual earnings and cash outs and retains failed funds-returned rows', () => {
  expect(affiliateActivity(portal).map(row => row.id)).toEqual(['earned-link-1', 'out-pending-1', 'earned-team-1', 'out-done-1', 'out-failed-1']);
  const view = render(<AffiliateActivityContent {...props} />);
  expect(view.getByText('Funds returned')).toBeTruthy();
  expect(view.getByText('Failed')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Earned'));
  expect(view.getByText('Kalan Kitchen')).toBeTruthy();
  expect(view.queryByText('Funds returned')).toBeNull();
  fireEvent.press(view.getByLabelText('Cash outs'));
  expect(view.queryByText('Kalan Kitchen')).toBeNull();
  expect(view.getByText('Funds returned')).toBeTruthy();
});

it('keeps zero, loading, empty, and complete large currency values distinct', () => {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 375, height: 667, scale: 1, fontScale: 1.5 });
  const view = render(<AffiliateMoneyContent {...props} portal={{ ...portal, summary: { ...portal.summary, balance: 123456789.25 } }} />);
  const amount = view.getByTestId('affiliate-money-balance');
  expect(amount.props.children).toBe('₱123,456,789.25');
  expect(amount.props.numberOfLines).toBeUndefined();
  view.rerender(<AffiliateMoneyContent {...props} portal={undefined} />);
  expect(view.getByTestId('affiliate-money-balance').props.children).toBe('Loading…');
  const empty = { ...portal, earnings: [], withdrawals: [], summary: { balance: 0, totalEarned: 0, totalWithdrawn: 0, pendingCommission: 0, inFlight: 0 } };
  view.rerender(<AffiliateMoneyContent {...props} portal={empty} />);
  expect(view.getByTestId('affiliate-money-balance').props.children).toBe('₱0');
  expect(view.getByText('Your money starts here')).toBeTruthy();
  expect(view.getByTestId('affiliate-cashout')).toBeDisabled();
});
