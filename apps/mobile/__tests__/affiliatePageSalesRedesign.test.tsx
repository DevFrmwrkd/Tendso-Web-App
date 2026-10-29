import React from 'react';
import { Share } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AffiliatePageScreen } from '../components/affiliate/PageOverview';
import { AffiliatePageEditorScreen } from '../components/affiliate/PageEditor';
import { AffiliateOfferScreen } from '../components/affiliate/Offer';
import { AffiliateSalesScreen, SalesContent } from '../components/affiliate/Sales';
import { sampleAffiliate, sampleSales } from '../components/affiliate/model';
import { formatPHP } from '../../../packages/shared/pricing';

const mockAccess = { account: sampleAffiliate, isPreview: false, isOffline: false, isAuthenticated: true };
const mockParams: { month?: string } = {};
const mockRouter = { push: jest.fn(), canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() };
const mockSave = jest.fn();
const mockMutation = jest.fn();
const mockAction = jest.fn();
const mockPaginated = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('@tendso/convex-client', () => ({ api: { affiliates: { sales: 'affiliates:sales', updatePage: 'affiliates:updatePage' }, r2: { generateUploadUrl: 'r2:generateUploadUrl' } } }));
jest.mock('convex/react', () => ({
  usePaginatedQuery: (...args: unknown[]) => mockPaginated(...args),
  useMutation: (...args: unknown[]) => { mockMutation(...args); return mockSave; },
  useAction: (...args: unknown[]) => { mockAction(...args); return jest.fn(); },
}));
jest.mock('../components/affiliate/Screen', () => ({
  AffiliateAccess: ({ children }: { children: (props: typeof mockAccess) => React.ReactNode }) => children(mockAccess),
  Notice: require('react-native').Text,
  AffiliateLoading: ({ label }: { label: string }) => require('react').createElement(require('react-native').Text, null, label),
}));
jest.mock('../components/PriceSlider', () => ({ PriceSlider: () => null }));
jest.mock('../components/affiliate/ShareTools', () => ({ CopyButton: () => null, ShareTools: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockAccess, { account: sampleAffiliate, isPreview: false, isOffline: false, isAuthenticated: true });
  delete mockParams.month;
  mockRouter.canGoBack.mockReturnValue(true);
  mockSave.mockResolvedValue(undefined);
  mockPaginated.mockReturnValue({ results: sampleSales, status: 'Exhausted', loadMore: jest.fn() });
});

it('shows the saved page offer and opens each focused tool from the overview', () => {
  const view = render(<AffiliatePageScreen />);
  expect(view.getByText('Sam Santos')).toBeTruthy();
  expect(view.getByText(sampleAffiliate.affiliateMessage!)).toBeTruthy();
  expect(view.getByText(formatPHP(3999))).toBeTruthy();
  expect(view.getByText(`Save ${formatPHP(1000)}`)).toBeTruthy();
  expect(view.getByText('tendso.com/v2/a/sample-affiliate')).toBeTruthy();
  for (const [label, route] of [['Edit page', 'page-edit'], ['Your price', 'offer'], ['Share QR & poster', 'share']]) {
    fireEvent.press(view.getByLabelText(label));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/(app)/affiliate/${route}`);
  }
  fireEvent.press(view.getByLabelText('Back'));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).not.toHaveBeenCalled();
  mockRouter.canGoBack.mockReturnValue(false);
  fireEvent.press(view.getByLabelText('Back'));
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(affiliate-tabs)');
});

it('shares saved page values and locks sharing in previews and suspended accounts', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const view = render(<AffiliatePageScreen />);
  fireEvent.press(view.getByLabelText('Share my shop link'));
  await waitFor(() => expect(share).toHaveBeenCalledWith({ message: 'Sam Santos · Get a website for your shop: https://tendso.com/v2/a/sample-affiliate', url: 'https://tendso.com/v2/a/sample-affiliate' }));
  mockAccess.isPreview = true;
  view.rerender(<AffiliatePageScreen />);
  expect(view.getByLabelText('Share my shop link').props.accessibilityState.disabled).toBe(true);
  mockAccess.isPreview = false;
  mockAccess.account = { ...sampleAffiliate, status: 'suspended' };
  view.rerender(<AffiliatePageScreen />);
  expect(view.getByLabelText('Share my shop link').props.accessibilityState.disabled).toBe(true);
  share.mockRestore();
});

it('saves focused page edits without overwriting the saved price', async () => {
  const view = render(<AffiliatePageEditorScreen />);
  expect(view.queryByLabelText('Website price in pesos')).toBeNull();
  fireEvent.changeText(view.getByLabelText('Display name'), '  My saved name  ');
  expect(view.getByText('Unsaved changes. Sharing still uses your saved offer.')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Save page'));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ photo: '', displayName: 'My saved name', message: sampleAffiliate.affiliateMessage, socialLink: '' }));
  expect(view.getByText('Page saved.')).toBeTruthy();
});

it('normalizes a price-only save and keeps invalid, offline and preview writes blocked', async () => {
  const view = render(<AffiliateOfferScreen />);
  fireEvent.changeText(view.getByLabelText('Website price in pesos'), '');
  fireEvent.press(view.getByLabelText('Save price'));
  expect(view.getByText('Enter your website price in whole pesos.')).toBeTruthy();
  expect(mockSave).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByLabelText('Website price in pesos'), '998');
  fireEvent.press(view.getByLabelText('Save price'));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ price: 999 }));
  expect(view.getByText('Price saved.')).toBeTruthy();
  mockAccess.isOffline = true;
  view.rerender(<AffiliateOfferScreen />);
  expect(view.getByLabelText('Website price in pesos').props.editable).toBe(false);
  view.unmount();
  jest.clearAllMocks();
  mockAccess.isPreview = true;
  render(<AffiliateOfferScreen />);
  expect(mockMutation).not.toHaveBeenCalled();
  expect(mockAction).not.toHaveBeenCalled();
});

it('labels frozen sale amounts and keeps unpaid commission visibly uncredited', () => {
  const view = render(<SalesContent {...mockAccess} sales={sampleSales} month="2026-10" />);
  expect(view.getByText('October 2026')).toBeTruthy();
  expect(view.getAllByText('Website price')).toHaveLength(2);
  expect(view.getAllByText('Your commission')).toHaveLength(2);
  expect(view.getByText('Not credited yet')).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Paid' }));
  expect(view.getByText('Sample barbershop')).toBeTruthy();
  expect(view.queryByText('Sample tailor shop')).toBeNull();
  expect(view.queryByText('Not credited yet')).toBeNull();
});

it('queries the selected month and paid filter before pagination', () => {
  mockParams.month = '2026-09';
  const view = render(<AffiliateSalesScreen />);
  expect(mockPaginated).toHaveBeenLastCalledWith('affiliates:sales', { month: '2026-09' }, { initialNumItems: 10 });
  fireEvent.press(view.getByRole('button', { name: 'Paid' }));
  expect(mockPaginated).toHaveBeenLastCalledWith('affiliates:sales', { month: '2026-09', status: 'paid' }, { initialNumItems: 10 });
});

it('never mounts sales or mutation hooks in an admin preview', () => {
  mockAccess.isPreview = true;
  const sales = render(<AffiliateSalesScreen />);
  expect(sales.getByText('Sample barbershop')).toBeTruthy();
  sales.unmount();
  const editor = render(<AffiliatePageEditorScreen />);
  expect(editor.getByLabelText('Display name').props.editable).toBe(false);
  expect(editor.getByLabelText('Save page').props.accessibilityState.disabled).toBe(true);
  expect(mockPaginated).not.toHaveBeenCalled();
  expect(mockMutation).not.toHaveBeenCalled();
  expect(mockAction).not.toHaveBeenCalled();
});
