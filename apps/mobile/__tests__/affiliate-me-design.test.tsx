import React from 'react';
import { Alert, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AffiliateMeScreen, AffiliateHelpScreen, MeContent } from '../components/affiliate/Me';
import AffiliateLayout from '../app/(app)/(affiliate-tabs)/_layout';
import { sampleAffiliate } from '../components/affiliate/model';

const mockPush = jest.fn(), mockReplace = jest.fn(), mockNavigate = jest.fn(), mockSignOut = jest.fn(), mockDelete = jest.fn();
const mockDeleteHook = jest.fn();
const mockMobile: any = { account: sampleAffiliate, isPreview: false, isAdmin: false, isAuthenticated: true, isOffline: false, isLoading: false, view: 'affiliate' };
const mockClerk: any = { user: { id: sampleAffiliate.clerkId }, session: { id: 'me-session' }, signOut: mockSignOut };
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => mockMobile }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock('../hooks/usePushNotifications', () => ({ usePushNotifications: () => {} }));
jest.mock('../hooks/useDeleteAccount', () => ({ useDeleteAccount: () => { mockDeleteHook(); return { busy: false, canDelete: true, requestDelete: mockDelete }; } }));
jest.mock('@clerk/clerk-expo', () => ({ useClerk: () => mockClerk, useUser: () => ({ user: { passwordEnabled: true } }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('../components/affiliate/AffiliateToolFrame', () => ({ AffiliateToolFrame: ({ children }: any) => require('react').createElement(require('react-native').View, null, children) }));
jest.mock('../components/affiliate/Screen', () => ({
  AffiliateAccess: ({ children }: any) => children(mockMobile),
  AffiliateFrame: ({ children }: any) => require('react').createElement(require('react-native').View, null, children),
}));
jest.mock('expo-router', () => ({
  Tabs: Object.assign(({ tabBar }: any) => tabBar({ state: { index: 0, routes: ['index','agents','page','sales','wallet','profile'].map(name => ({ name })) }, navigation: { navigate: mockNavigate } }), { Screen: () => null }),
  Redirect: ({ href }: any) => require('react').createElement(require('react-native').Text, null, href),
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockMobile, { account: sampleAffiliate, isPreview: false, isAdmin: false, isAuthenticated: true, isOffline: false, isLoading: false, view: 'affiliate' });
  mockClerk.user = { id: sampleAffiliate.clerkId }; mockClerk.session = { id: 'me-session' };
  mockSignOut.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('shows four stable tabs and sends Me to its dedicated profile tab', () => {
  const result = render(<AffiliateLayout />);
  for (const label of ['Home tab', 'Agents tab', 'Money tab', 'Me tab']) expect(result.getByLabelText(label)).toBeTruthy();
  expect(result.queryByLabelText('Sales tab')).toBeNull();
  fireEvent.press(result.getByLabelText('Me tab'));
  expect(mockNavigate).toHaveBeenCalledWith('profile');
});

it('keeps account, sales, page and payout destinations visible without training or duplicated stats', () => {
  const result = render(<AffiliateMeScreen />);
  for (const [label, route] of [['Edit profile','/(app)/edit-profile'],['My creator page','/(app)/affiliate/page'],['Your sales','/(app)/affiliate/sales'],['Payout details','/(app)/affiliate/payout-details'],['Notifications','/(app)/notifications'],['Help & account','/(app)/affiliate/help']]) {
    fireEvent.press(result.getByLabelText(label)); expect(mockPush).toHaveBeenLastCalledWith(route);
  }
  expect(result.queryByText('Certified')).toBeNull();
  expect(result.queryByText('Total earned')).toBeNull();
  expect(result.getByText(/Code AFFSAMPLE/)).toBeTruthy();
});

it('keeps previews read-only without mounting deletion or sign-out actions', () => {
  mockMobile.isPreview = true;
  const result = render(<AffiliateMeScreen />);
  expect(result.getByLabelText('Edit profile')).toBeDisabled();
  expect(result.getByLabelText('Notifications')).toBeDisabled();
  expect(result.getByLabelText('Sign out')).toBeDisabled();
  fireEvent.press(result.getByLabelText('Sign out'));
  expect(mockSignOut).not.toHaveBeenCalled();
  result.unmount();
  const help = render(<AffiliateHelpScreen />);
  expect(mockDeleteHook).not.toHaveBeenCalled();
  expect(help.getByLabelText('Delete my account')).toBeDisabled();
});

it('keeps suspended profile edits disabled while sales and page stay readable', () => {
  const result = render(<MeContent {...mockMobile} account={{ ...sampleAffiliate, status: 'suspended' }} />);
  expect(result.getByLabelText('Edit profile')).toBeDisabled();
  fireEvent.press(result.getByLabelText('Your sales')); expect(mockPush).toHaveBeenCalledWith('/(app)/affiliate/sales');
});

it('prevents a stale sign-out confirmation from signing out a different Clerk subject', async () => {
  const result = render(<AffiliateMeScreen />);
  fireEvent.press(result.getByLabelText('Sign out')); fireEvent.press(result.getByLabelText('Sign out'));
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  const confirm = jest.mocked(Alert.alert).mock.calls[0][2]!.find(item => item.text === 'Sign out')!.onPress!;
  mockClerk.user = { id: 'new-subject' }; mockMobile.account = { ...sampleAffiliate, clerkId: 'new-subject' };
  result.rerender(<AffiliateMeScreen />);
  await act(async () => { await confirm(); });
  expect(mockSignOut).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});

it('preserves the live account deletion and password/legal destinations in Help', () => {
  const result = render(<AffiliateHelpScreen />);
  expect(mockDeleteHook).toHaveBeenCalled();
  fireEvent.press(result.getByLabelText('Change password')); expect(mockPush).toHaveBeenCalledWith('/(app)/change-password');
  fireEvent.press(result.getByLabelText('Privacy policy')); expect(mockPush).toHaveBeenCalledWith('/(app)/privacy-policy');
  fireEvent.press(result.getByLabelText('Delete my account')); expect(mockDelete).toHaveBeenCalledTimes(1);
});
