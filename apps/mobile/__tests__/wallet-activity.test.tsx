import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { EarningRow, EarningsTrend, PayoutRow, WalletActivityDetails, WalletHistory, type WalletEarning } from '../components/wallet/WalletActivity';
import { colors } from '../theme/v2';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));

const october = new Date(2026, 9, 18, 12).getTime();
const earning = (extra: Partial<WalletEarning> = {}): WalletEarning => ({
  _id: 'income-a', submissionId: 'shop-a', businessName: 'Kalan', type: 'submission_approved',
  status: 'available', amount: 1500, createdAt: october, ...extra,
});

beforeEach(() => {
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 375, height: 812, scale: 3, fontScale: 1 });
});
afterEach(() => jest.restoreAllMocks());

it('shows a real paid sale price and capture thumbnail without estimating it from the earned commission', () => {
  const view = render(<EarningRow earning={earning({ amount: 1250.5 })} compact submissionPrice={2999} paid thumbnailUrl="https://images.example.com/kalan.jpg" />);
  expect(view.getByRole('image', { name: 'Kalan photo' })).toHaveProp('source', { uri: 'https://images.example.com/kalan.jpg' });
  expect(view.getByText('Paid ₱2,999 · Oct 18')).toBeTruthy();
  expect(view.getByText('+₱1,250.50')).toBeTruthy();
  view.rerender(<EarningRow earning={earning({ amount: 1250.5 })} compact />);
  expect(view.getByText('Site earnings · Oct 18')).toBeTruthy();
  expect(view.queryByText(/Paid ₱/)).toBeNull();
  expect(view.getByRole('image', { name: 'Kalan photo unavailable' })).toBeTruthy();
});

it('uses Site price rather than a false paid label when the source capture is not paid', () => {
  const view = render(<EarningRow earning={earning()} compact submissionPrice={2999} paid={false} />);
  expect(view.getByText('Site price ₱2,999 · Oct 18')).toBeTruthy();
  expect(view.queryByText(/Paid ₱/)).toBeNull();
});

it('gives both home previews the same status space while long names and emails use end ellipsis', () => {
  const businessName = 'A very long business name that should not increase the preview height';
  const wiseEmail = 'a.very.long.recipient.email.address@example.com';
  const previewLayout = { stacked: false, amountLines: 1 };
  const view = render(<>
    <EarningRow earning={earning({ businessName })} compact previewLayout={previewLayout} />
    <PayoutRow withdrawal={{ _id: 'transfer', amount: 750, status: 'processing', wiseEmail, createdAt: october }} compact previewLayout={previewLayout} />
  </>);
  for (const value of [businessName, 'Site earnings · Oct 18', wiseEmail, 'To Wise · Oct 18']) {
    const text = view.getByText(value);
    expect(text).toHaveProp('numberOfLines', 1);
    expect(text).toHaveProp('ellipsizeMode', 'tail');
    expect(text).toHaveProp('accessibilityLabel', value);
  }
  const earningSlot = StyleSheet.flatten(view.getByTestId('wallet-status-slot-earning-income-a').props.style);
  const payoutSlot = StyleSheet.flatten(view.getByTestId('wallet-status-slot-payout-transfer').props.style);
  expect(earningSlot.minHeight).toBe(32);
  expect(payoutSlot.minHeight).toBe(earningSlot.minHeight);
  expect(view.getByText('Processing')).toBeTruthy();
  expect(view.queryByTestId('wallet-preview-footer-earning-income-a')).toBeNull();
  expect(view.queryByTestId('wallet-preview-footer-payout-transfer')).toBeNull();
});

it('reserves equal financial lines in stacked home previews without truncating exact amounts', () => {
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 320, height: 812, scale: 3, fontScale: 2 });
  const previewLayout = { stacked: true, amountLines: 2 };
  const view = render(<>
    <EarningRow earning={earning({ amount: 1500.5 })} compact previewLayout={previewLayout} />
    <PayoutRow withdrawal={{ _id: 'large', amount: 999999999.99, status: 'completed', wiseEmail: 'mika@example.com' }} compact previewLayout={previewLayout} />
  </>);
  for (const value of ['+₱1,500.50', '−₱999,999,999.99']) {
    const amount = view.getByText(value);
    expect(amount.props.numberOfLines).toBeUndefined();
    expect(amount.props.adjustsFontSizeToFit).not.toBe(true);
    expect(StyleSheet.flatten(amount.props.style).minHeight).toBe(80);
  }
  expect(view.getByTestId('wallet-preview-footer-earning-income-a')).toBeTruthy();
  expect(view.getByTestId('wallet-preview-footer-payout-large')).toBeTruthy();
  expect(StyleSheet.flatten(view.getByTestId('wallet-status-slot-earning-income-a').props.style).minHeight).toBe(52);
  expect(StyleSheet.flatten(view.getByTestId('wallet-status-slot-payout-large').props.style).minHeight).toBe(52);
  expect(view.getByText('Completed')).toBeTruthy();
});

it('shows full earning details and only the actual owned site price', () => {
  const businessName = 'A very long shop name that must be completely readable in the details popup';
  const view = render(<WalletActivityDetails activity={{ kind: 'earning', earning: earning({ businessName, amount: 1250.5, status: 'withdrawn' }),
    submission: { thumbnailUrl: null, submissionPrice: 2999, paid: true } }} />);
  expect(view.getByRole('header', { name: 'Earning details' })).toBeTruthy();
  expect(view.getByText(businessName).props.numberOfLines).toBeUndefined();
  expect(view.getByText('+₱1,250.50').props.numberOfLines).toBeUndefined();
  expect(view.getByText('Site earnings')).toBeTruthy();
  expect(view.getByText('Withdrawn')).toBeTruthy();
  expect(view.getByText('₱2,999')).toBeTruthy();
  expect(view.getByText(new Date(october).toLocaleString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }))).toBeTruthy();
  view.rerender(<WalletActivityDetails activity={{ kind: 'earning', earning: earning({ status: undefined, type: undefined, businessName: 'Unknown' }) }} />);
  expect(view.queryByText('Site price')).toBeNull();
  expect(view.queryByText('Type')).toBeNull();
  expect(view.queryByText('Unknown')).toBeNull();
  expect(view.queryByText('Available')).toBeNull();
});

it('shows complete payout recipient, reference, processing date and stored failure information', () => {
  const wiseEmail = 'a.very.long.recipient.account.that.must.be.readable@example.com';
  const failureReason = 'The recipient needs to complete their verification before this transfer can proceed.';
  const view = render(<WalletActivityDetails activity={{ kind: 'payout', withdrawal: { _id: 'failed', amount: 1234567.89, status: 'failed',
    wiseEmail, bankName: 'Bank from the saved transfer', reference: 'saved-reference', wiseTransferId: 'transfer-123', wiseTransactionId: 'transaction-456',
    processedAt: october + 60000, createdAt: october, failureReason } }} />);
  expect(view.getByRole('header', { name: 'Cash-out details' })).toBeTruthy();
  for (const value of ['−₱1,234,567.89', wiseEmail, 'Bank from the saved transfer', 'saved-reference', 'transfer-123', 'transaction-456', failureReason]) {
    expect(view.getByText(value).props.numberOfLines).toBeUndefined();
  }
  expect(view.getByText('Processed')).toBeTruthy();
  expect(view.getByText('Failed')).toBeTruthy();
  view.rerender(<WalletActivityDetails activity={{ kind: 'payout', withdrawal: { _id: 'legacy', amount: 300, status: 'completed',
    transactionRef: 'legacy-reference', processedAt: Number.NaN } }} />);
  expect(view.getByText('legacy-reference')).toBeTruthy();
  expect(view.getByText('Date unavailable')).toBeTruthy();
  for (const absent of ['Wise email', 'Bank', 'Processed', 'Wise transfer ID', 'Wise transaction ID', 'What happened']) expect(view.queryByText(absent)).toBeNull();
});

it('keeps the compact Payouts history mixed, fully filterable and complete with references and failure details', () => {
  const onFilter = jest.fn();
  const onBack = jest.fn();
  const props = { earnings: [earning()], withdrawals: [{ _id: 'failed-transfer', amount: 750, status: 'failed',
    wiseEmail: 'mika@example.com', wiseTransferId: 'wise-123', reference: 'legacy-bank-reference', failureReason: 'Recipient needs verification', createdAt: october + 1 }],
    balance: 3750, earned: 41500, withdrawn: 37750, isOffline: false,
    onFilter, onBack, submissionDetails: new Map([['shop-a', { thumbnailUrl: 'https://images.example.com/kalan.jpg', submissionPrice: 2999, paid: true }]]) };
  const view = render(<WalletHistory {...props} filter="all" />);
  expect(view.getByRole('header', { name: 'Payouts' })).toBeTruthy();
  expect(view.getByLabelText('Earned, ₱41,500')).toBeTruthy();
  expect(view.getByLabelText('Cashed out, ₱37,750')).toBeTruthy();
  expect(view.getByLabelText('Ready, ₱3,750')).toBeTruthy();
  expect(view.getByTestId('earning-income-a')).toBeTruthy();
  expect(view.getByTestId('payout-failed-transfer')).toBeTruthy();
  expect(view.getByText('Wise #wise-123')).toBeTruthy();
  expect(view.getByText('legacy-bank-reference')).toBeTruthy();
  expect(view.getByText('Recipient needs verification')).toBeTruthy();
  fireEvent.press(view.getByLabelText('History: Earned'));
  expect(onFilter).toHaveBeenCalledWith('earned');
  view.rerender(<WalletHistory {...props} filter="earned" />);
  expect(view.queryByTestId('payout-failed-transfer')).toBeNull();
  expect(view.getByRole('image', { name: 'Kalan photo' })).toBeTruthy();
  fireEvent.press(view.getByLabelText('Back'));
  expect(onBack).toHaveBeenCalledTimes(1);
});

describe('selecting earned months', () => {
  const january = new Date(2027, 0, 2, 12).getTime();
  const december = new Date(2026, 11, 31, 12).getTime();
  const august = new Date(2026, 7, 1, 12).getTime();
  const rows = [
    earning({ _id: 'january', amount: 600, createdAt: january }),
    earning({ _id: 'december', amount: 400.5, createdAt: december }),
    earning({ _id: 'december-withdrawn', amount: 100, status: 'withdrawn', createdAt: december }),
    earning({ _id: 'december-pending', amount: 9000, status: 'pending', createdAt: december }),
    earning({ _id: 'august', amount: 100, createdAt: august }),
  ];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2027, 0, 15, 12));
  });
  afterEach(() => jest.useRealTimers());

  it('selects a bar and displays that calendar month’s credited total, including centavos and its year', () => {
    const view = render(<EarningsTrend earnings={rows} />);
    const current = view.getByRole('button', { name: 'January 2027, ₱600 earned' });
    const previous = view.getByRole('button', { name: 'December 2026, ₱500.50 earned' });
    expect(current).toHaveAccessibilityState({ selected: true });
    expect(previous).toHaveAccessibilityState({ selected: false });
    expect(view.getByLabelText('Earned this month, ₱600')).toBeTruthy();

    fireEvent.press(previous);

    expect(previous).toHaveAccessibilityState({ selected: true });
    expect(current).toHaveAccessibilityState({ selected: false });
    expect(view.getByText('Earned in December 2026')).toBeTruthy();
    expect(view.getByLabelText('Earned in December 2026, ₱500.50')).toBeTruthy();
    expect(StyleSheet.flatten(view.getByTestId('earnings-bar-2026-11').props.style).backgroundColor).toBe(colors.accent);
    expect(StyleSheet.flatten(view.getByTestId('earnings-bar-2027-0').props.style).backgroundColor).not.toBe(colors.accent);

    fireEvent.press(current);
    expect(view.getByText('Earned in January')).toBeTruthy();
    expect(view.getByLabelText('Earned this month, ₱600')).toBeTruthy();
  });

  it('lets an empty month be selected without drawing an invented earning', () => {
    const view = render(<EarningsTrend earnings={rows} />);
    fireEvent.press(view.getByRole('button', { name: 'November 2026, ₱0 earned' }));
    expect(view.getByText('Earned in November 2026')).toBeTruthy();
    expect(view.getByLabelText('Earned in November 2026, ₱0')).toBeTruthy();
    expect(view.getByRole('button', { name: 'November 2026, ₱0 earned' })).toHaveAccessibilityState({ selected: true });
    const bar = StyleSheet.flatten(view.getByTestId('earnings-bar-2026-10').props.style);
    expect(bar.height).toBe(0);
    expect(bar.borderWidth ?? 0).toBe(0);
  });

  it('keeps the selected month as live ledger totals change', () => {
    const view = render(<EarningsTrend earnings={rows} />);
    fireEvent.press(view.getByRole('button', { name: 'December 2026, ₱500.50 earned' }));
    view.rerender(<EarningsTrend earnings={[...rows, earning({ _id: 'new-credit', amount: 250, createdAt: december })]} />);
    expect(view.getByLabelText('Earned in December 2026, ₱750.50')).toBeTruthy();
    expect(view.getByRole('button', { name: 'December 2026, ₱750.50 earned' })).toHaveAccessibilityState({ selected: true });
  });

  it('follows the current month by default and falls back to it when an old selection leaves the window', () => {
    const view = render(<EarningsTrend earnings={rows} />);
    jest.setSystemTime(new Date(2027, 1, 1, 12));
    view.rerender(<EarningsTrend earnings={rows} />);
    expect(view.getByText('Earned in February')).toBeTruthy();
    expect(view.getByRole('button', { name: 'February 2027, ₱0 earned' })).toHaveAccessibilityState({ selected: true });

    jest.setSystemTime(new Date(2027, 0, 15, 12));
    view.rerender(<EarningsTrend earnings={rows} />);
    fireEvent.press(view.getByRole('button', { name: 'August 2026, ₱100 earned' }));
    jest.setSystemTime(new Date(2027, 1, 1, 12));
    view.rerender(<EarningsTrend earnings={rows} />);
    expect(view.getByLabelText('Earned this month, ₱0')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'August 2026, ₱100 earned' })).toBeNull();
    expect(view.getByRole('button', { name: 'February 2027, ₱0 earned' })).toHaveAccessibilityState({ selected: true });
  });

  it('keeps all-zero and pending-only ledgers in the honest empty state', () => {
    const view = render(<EarningsTrend earnings={[]} />);
    expect(view.getByLabelText('Earned this month, ₱0')).toBeTruthy();
    expect(view.queryByTestId('earnings-six-month-trend')).toBeNull();
    view.rerender(<EarningsTrend earnings={[earning({ status: 'pending', createdAt: january, amount: 9000 })]} />);
    expect(view.getByText('No earnings recorded in the last six months.')).toBeTruthy();
    expect(view.queryAllByRole('button')).toHaveLength(0);
  });
});
