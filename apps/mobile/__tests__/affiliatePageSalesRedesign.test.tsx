import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AffiliatePageScreen } from '../components/affiliate/PageOverview';
import { AffiliatePageEditorScreen } from '../components/affiliate/PageEditor';
import { AffiliateOfferScreen } from '../components/affiliate/Offer';
import { AffiliateSalesScreen, SalesContent } from '../components/affiliate/Sales';
import { sampleAffiliate, sampleSales } from '../components/affiliate/model';
import MyPageRoute from '../app/(app)/affiliate/page';
import EditPageRoute from '../app/(app)/affiliate/page-edit';

const mockAccess = { account: sampleAffiliate, isPreview: false, isOffline: false, isAuthenticated: true };
const mockParams: { month?: string } = {};
const mockRouter = { push: jest.fn(), canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() };
const mockSave = jest.fn();
const mockMutation = jest.fn();
const mockAction = jest.fn();
const mockPaginated = jest.fn();
const mockSharing = jest.fn();
const mockPreview = jest.fn();

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
jest.mock('../components/affiliate/ShareTools', () => ({ CopyButton: () => null, ShareTools: (props: object) => {
  mockSharing(props);
  return require('react').createElement(require('react-native').Text, { testID: 'saved-sharing' }, 'Saved sharing tools');
} }));
jest.mock('../components/affiliate/PublicPagePreview', () => ({ AffiliatePublicPagePreview: (props: object) => {
  mockPreview(props);
  return require('react').createElement(require('react-native').Text, { testID: 'actual-page-preview' }, 'Actual public page');
} }));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockAccess, { account: sampleAffiliate, isPreview: false, isOffline: false, isAuthenticated: true });
  delete mockParams.month;
  mockRouter.canGoBack.mockReturnValue(true);
  mockSave.mockResolvedValue(undefined);
  mockPaginated.mockReturnValue({ results: sampleSales, status: 'Exhausted', loadMore: jest.fn() });
});

it('opens Home’s My page destination directly in the current editor, without another overview or redirect', () => {
  expect(MyPageRoute).toBe(AffiliatePageScreen);
  const view = render(<MyPageRoute />);
  expect(view.getByText('My page')).toBeTruthy();
  for (const name of ['Page details', 'Your offer', 'Sharing']) expect(view.getByRole('tab', { name })).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Edit page', exact: true })).toBeNull();
  expect(view.queryByRole('button', { name: 'Share QR & poster', exact: true })).toBeNull();
  fireEvent.changeText(view.getByLabelText('Display name'), 'A draft from My page');
  fireEvent.press(view.getByRole('tab', { name: 'Your offer' }));
  expect(view.getByText('₱3,499')).toBeTruthy();
  expect(view.queryByLabelText('Save price')).toBeNull();
  fireEvent.press(view.getByRole('tab', { name: 'Preview public page' }));
  expect(view.getByTestId('actual-page-preview')).toBeTruthy();
  expect(mockPreview.mock.calls.at(-1)![0]).toMatchObject({ dirty: true, card: { name: 'A draft from My page', price: 3499 } });
  fireEvent.press(view.getByRole('tab', { name: 'Edit page details' }));
  fireEvent.press(view.getByRole('tab', { name: 'Page details' }));
  expect(view.getByLabelText('Display name').props.value).toBe('A draft from My page');
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText('Back'));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  mockRouter.canGoBack.mockReturnValue(false);
  fireEvent.press(view.getByLabelText('Back'));
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(affiliate-tabs)');
});

it('keeps the old edit URL on the same editor with an Edit title and normal back behavior', () => {
  expect(EditPageRoute).toBe(AffiliatePageEditorScreen);
  const view = render(<EditPageRoute />);
  expect(view.getByText('Edit your page')).toBeTruthy();
  expect(view.getByRole('tab', { name: 'Page details' })).toBeTruthy();
  expect(view.getByRole('tab', { name: 'Preview public page' })).toBeTruthy();
  fireEvent.press(view.getByLabelText('Back'));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('keeps sharing on saved profile values and locked for previews, offline and suspended accounts', () => {
  const view = render(<MyPageRoute />);
  fireEvent.changeText(view.getByLabelText('Display name'), 'Unsaved public name');
  fireEvent.press(view.getByRole('tab', { name: 'Sharing' }));
  expect(view.getByTestId('saved-sharing')).toBeTruthy();
  expect(mockSharing.mock.calls.at(-1)![0]).toMatchObject({ displayName: 'Sam Santos', price: 3499, disabled: false });
  for (const condition of ['preview', 'offline', 'suspended']) {
    mockAccess.isPreview = condition === 'preview';
    mockAccess.isOffline = condition === 'offline';
    mockAccess.account = condition === 'suspended' ? { ...sampleAffiliate, status: 'suspended' } : sampleAffiliate;
    view.rerender(<MyPageRoute />);
    fireEvent.press(view.getByRole('tab', { name: 'Sharing' }));
    expect(mockSharing.mock.calls.at(-1)![0].disabled).toBe(true);
  }
});
it('saves focused page edits without overwriting the saved price', async () => {
  const view = render(<AffiliatePageEditorScreen />);
  expect(view.queryByLabelText('Website price in pesos')).toBeNull();
  fireEvent.changeText(view.getByLabelText('Display name'), '  My saved name  ');
  expect(view.getByText('Unsaved changes.')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Save page'));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ photo: '', displayName: 'My saved name', message: sampleAffiliate.affiliateMessage, socialLinks: {} }));
  expect(view.getByText('Page saved.')).toBeTruthy();
});

it('shows the fixed offer without mounting any price-write hook in active, offline or preview states', () => {
  mockAccess.account = { ...sampleAffiliate, affiliatePrice: 999 };
  const view = render(<AffiliateOfferScreen />);
  expect(view.getByText('₱3,499')).toBeTruthy();
  expect(view.getByText('₱1,500')).toBeTruthy();
  expect(view.getByText('₱1,750')).toBeTruthy();
  expect(view.queryByLabelText('Website price in pesos')).toBeNull();
  expect(view.queryByLabelText('Save price')).toBeNull();
  expect(mockMutation).not.toHaveBeenCalled();
  expect(mockAction).not.toHaveBeenCalled();
  mockAccess.isOffline = true;
  view.rerender(<AffiliateOfferScreen />);
  expect(view.getByText('₱3,499')).toBeTruthy();
  mockAccess.isPreview = true;
  view.rerender(<AffiliateOfferScreen />);
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
