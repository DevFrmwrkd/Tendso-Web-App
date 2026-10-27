import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { WalletMonthlySummary, walletMonths } from '../components/wallet/WalletMonthlySummary';
import { EarningRow, WalletHistory, type WalletEarning } from '../components/wallet/WalletActivity';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));

const now = new Date(2026, 9, 27, 12);
const october = new Date(2026, 9, 18, 12).getTime();
const september = new Date(2026, 8, 18, 12).getTime();
const earning = (extra: Partial<WalletEarning> = {}): WalletEarning => ({
  _id: 'income-a', submissionId: 'shop-a', businessName: 'Kalan', type: 'submission_approved',
  status: 'available', amount: 1500, createdAt: october, ...extra,
});

beforeEach(() => {
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 375, height: 812, scale: 3, fontScale: 1 });
});
afterEach(() => jest.restoreAllMocks());

it('shows the original monthly hero using exact credited money, unique sites and a meaningful prior-month difference', () => {
  const onHistory = jest.fn();
  const rows = [
    earning({ amount: 1000.1 }), earning({ _id: 'second-credit', amount: 200.2, status: 'withdrawn' }),
    earning({ _id: 'other-site', submissionId: 'shop-b', amount: 300 }),
    earning({ _id: 'bonus', type: 'referral_bonus', amount: 50 }),
    earning({ _id: 'pending', amount: 99999, status: 'pending' }),
    earning({ _id: 'prior', amount: 500, createdAt: september }),
  ];
  const view = render(<WalletMonthlySummary earnings={rows} now={now} onHistory={onHistory} />);
  expect(view.getByRole('header', { name: 'You earned in October' })).toBeTruthy();
  expect(view.getByLabelText('Earned this month, ₱1,550.30')).toBeTruthy();
  expect(view.getByText('2 sites · ₱1,050.30 more than September')).toBeTruthy();
  expect(view.getByTestId('earnings-six-month-trend').children).toHaveLength(6);
  const bar = view.getByTestId('earnings-bar-2026-9');
  expect(bar).toHaveStyle({ height: 56, flexShrink: 0 });
  expect(view.getByLabelText('View all earnings and payouts')).toHaveStyle({ width: 48, height: 48 });
  fireEvent.press(view.getByLabelText('View all earnings and payouts'));
  expect(onHistory).toHaveBeenCalledTimes(1);
});

it('does not invent site counts for legacy site credits without a submission link', () => {
  const summary = walletMonths([earning({ submissionId: undefined })], now);
  expect(summary[5].total).toBe(1500);
  expect(summary[5].siteCount).toBeNull();
  const view = render(<WalletMonthlySummary earnings={[earning({ submissionId: undefined })]} now={now} />);
  expect(view.queryByText(/sites?/)).toBeNull();
});

it('keeps loading distinct from zero and does not manufacture growth or nonzero bars', () => {
  const view = render(<WalletMonthlySummary now={now} isOffline />);
  expect(view.getByText('—')).toBeTruthy();
  expect(view.getByText('Reconnect to load your monthly earnings.')).toBeTruthy();
  expect(view.queryByLabelText('Earned this month, ₱0')).toBeNull();
  view.rerender(<WalletMonthlySummary now={now} earnings={[]} />);
  expect(view.getByLabelText('Earned this month, ₱0')).toBeTruthy();
  expect(view.getByText('0 sites')).toBeTruthy();
  expect(view.getByText('No earnings recorded in the last six months.')).toBeTruthy();
  expect(view.queryByTestId('earnings-six-month-trend')).toBeNull();
});

it('keeps a current zero-month bar truly zero when previous months had credits', () => {
  const view = render(<WalletMonthlySummary now={now} earnings={[earning({ createdAt: september })]} />);
  expect(view.getByTestId('earnings-bar-2026-9')).toHaveStyle({ height: 0, flexShrink: 0 });
  expect(view.getByTestId('earnings-bar-2026-8')).toHaveStyle({ height: 56, flexShrink: 0 });
  expect(view.getByText('0 sites · ₱1,500 less than September')).toBeTruthy();
});

it('keeps large complete monthly amounts readable without implicit shrinking or ellipses', () => {
  const view = render(<WalletMonthlySummary now={now} earnings={[earning({ amount: 123456789.12 })]} />);
  const amount = view.getByLabelText('Earned this month, ₱123,456,789.12');
  expect(amount.props.numberOfLines).toBeUndefined();
  expect(amount.props.adjustsFontSizeToFit).not.toBe(true);
  const style = StyleSheet.flatten(amount.props.style);
  expect(style.fontSize).toBeGreaterThanOrEqual(16);
  expect(style.fontSize).toBeLessThan(44);
});

it('uses six actual calendar months across year rollover and excludes invalid timestamps and pending money', () => {
  const january = new Date(2027, 0, 10, 12);
  const summary = walletMonths([
    earning({ amount: 100, createdAt: new Date(2026, 11, 31, 12).getTime() }),
    earning({ amount: 200, createdAt: Number.NaN, _creationTime: new Date(2027, 0, 2, 12).getTime() }),
    earning({ amount: 10000, createdAt: 0, _creationTime: 0 }),
    earning({ amount: 99999, createdAt: new Date(2027, 0, 3, 12).getTime(), status: 'pending' }),
  ], january);
  expect(summary.map(month => month.label)).toEqual(['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']);
  expect(summary[4].total).toBe(100);
  expect(summary[5].total).toBe(200);
});

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
