import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { EarningRow, WalletHistory, type WalletEarning } from '../components/wallet/WalletActivity';

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
