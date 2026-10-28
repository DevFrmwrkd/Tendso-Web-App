import React from 'react';
import { Alert, Dimensions, PermissionsAndroid, Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../app/(app)/(tabs)/profile';
import AffiliateProfileScreen from '../app/(app)/(affiliate-tabs)/profile';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockSignOut = jest.fn();
const mockApplyReferral = jest.fn();
const mockCaptureRef = jest.fn();
const mockShare = jest.fn();
const mockSave = jest.fn();
const mockSubmissionsLookup = jest.fn();
let mockUser: any;
let mockAccounts: Record<string, any>;
let mockSubmissions: Record<string, any[] | undefined>;
let mockConnected: boolean;
let mockPreview: boolean;

jest.mock('@clerk/clerk-expo', () => ({
  useUser: () => ({ user: mockUser, isLoaded: true }),
  useClerk: () => ({ signOut: mockSignOut }),
}));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => ({
  isPreview: mockPreview, account: mockUser ? mockAccounts[mockUser.id] : null,
}) }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('../components/OfflineBanner', () => ({ OfflineBanner: () => null }));
jest.mock('../components/AccountPreview', () => ({ PreviewProfile: () =>
  require('react').createElement(require('react-native').Text, { testID: 'preview-profile' }, 'Preview profile') }));
jest.mock('../components/ui/SwipeSheet', () => ({ SwipeSheet: ({ visible, children }: any) => visible ? children : null }));
jest.mock('@tendso/convex-client', () => ({ api: {
  creators: { getByClerkId: 'account', applyReferralCode: 'apply-code' },
  submissions: { getByCreatorId: 'submissions' },
} }));
jest.mock('convex/react', () => ({
  useQuery: (reference: string, args: any) => {
    if (args === 'skip') return undefined;
    if (reference === 'account') return mockAccounts[args.clerkId];
    if (reference === 'submissions') { mockSubmissionsLookup(args); return mockSubmissions[args.creatorId]; }
    throw new Error('Unexpected query ' + reference);
  },
  useMutation: () => mockApplyReferral,
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('react-native-view-shot', () => ({ captureRef: (...args: unknown[]) => mockCaptureRef(...args) }));
jest.mock('expo-sharing', () => ({ shareAsync: (...args: unknown[]) => mockShare(...args) }));
jest.mock('expo-media-library', () => ({ saveToLibraryAsync: (...args: unknown[]) => mockSave(...args) }));
jest.mock('../components/CertificateCard', () => {
  const { createElement: makeElement, forwardRef } = require('react');
  const { Text, View } = require('react-native');
  return { __esModule: true, default: forwardRef(({ creatorName, certMonth, certYear }: any, ref: unknown) =>
    makeElement(View, { ref, testID: 'certificate-content' },
      makeElement(Text, null, creatorName), makeElement(Text, null, `${certMonth} ${certYear}`))) };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));

const originalOS = Platform.OS;
const originalVersion = Platform.Version;
const originalWindow = Dimensions.get('window');
const originalScreen = Dimensions.get('screen');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function confirmation(label: string) {
  return jest.mocked(Alert.alert).mock.calls.at(-1)![2]!.find(button => button.text === label)!.onPress!;
}
function switchAccount() {
  mockUser = { id: 'clerk-second', fullName: 'Second Agent', passwordEnabled: false };
}
function openCertificate(view: ReturnType<typeof render>) {
  fireEvent.press(view.getByRole('button', { name: 'Show my certificate' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  Dimensions.set({ window: { width: 390, height: 844, scale: 3, fontScale: 1 }, screen: { width: 390, height: 844, scale: 3, fontScale: 1 } });
  mockConnected = true; mockPreview = false;
  mockUser = { id: 'clerk-mika', fullName: 'Mika Santos', passwordEnabled: true };
  mockAccounts = {
    'clerk-mika': { _id: 'agent-mika', clerkId: 'clerk-mika', role: 'creator', status: 'active',
      firstName: 'Mika', lastName: 'Santos', profileImage: 'https://images.example.com/mika.jpg',
      certifiedAt: Date.UTC(2026, 9, 20), balance: 3750.25, totalEarnings: 41500.75,
      submissionCount: 999, referralCode: 'MIKA8K2Q' },
    'clerk-second': { _id: 'agent-second', clerkId: 'clerk-second', role: 'creator', status: 'active',
      firstName: 'Second', lastName: 'Agent', balance: 0, totalEarnings: 0 },
  };
  mockSubmissions = {
    'agent-mika': ['draft', 'submitted', 'in_review', 'rejected', 'deployed', 'paid'].map((status, index) => ({
      _id: `capture-${index}`, creatorId: 'agent-mika', status,
    })),
    'agent-second': [],
  };
  mockSignOut.mockReset().mockResolvedValue(undefined);
  mockApplyReferral.mockReset().mockResolvedValue(undefined);
  mockCaptureRef.mockReset().mockResolvedValue('file:///certificate.png');
  mockShare.mockReset().mockResolvedValue(undefined);
  mockSave.mockReset().mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  Dimensions.set({ window: originalWindow, screen: originalScreen });
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  Object.defineProperty(Platform, 'Version', { configurable: true, value: originalVersion });
  jest.restoreAllMocks();
});

it('shows the real field-agent identity and accurate totals without board sample ratings or site counts', () => {
  const view = render(<ProfileScreen />);
  expect(view.getByRole('header', { name: 'Mika Santos' })).toBeTruthy();
  expect(view.getByRole('image', { name: "Mika Santos's photo" })).toBeTruthy();
  expect(view.getByText('Field agent')).toBeTruthy();
  expect(view.getByText('Certified')).toBeTruthy();
  expect(view.getByText('MIKA8K2Q')).toBeTruthy();
  expect(view.getByLabelText('Submitted 5')).toBeTruthy();
  expect(view.getByLabelText('Balance ₱3,750.25')).toBeTruthy();
  expect(view.getByLabelText('Earned ₱41,500.75')).toBeTruthy();
  expect(view.queryByText('999')).toBeNull();
  expect(view.queryByText('Sites built')).toBeNull();
  expect(view.queryByText('Rating')).toBeNull();
  expect(view.queryByText('Your link')).toBeNull();
  expect(mockSubmissionsLookup).toHaveBeenCalledWith({ creatorId: 'agent-mika' });
});

it('keeps every existing work, settings, help and legal destination reachable', () => {
  const view = render(<ProfileScreen />);
  const destinations = [
    ['Dashboard', '/(app)/(tabs)/dashboard'],
    ['Your submissions', '/(app)/submissions'],
    ['Learn & help', '/(app)/(tabs)/knowledge'],
    ['Help & FAQ', '/(app)/help-faq'],
    ['Invite field agents', '/(app)/referrals'],
    ['Edit profile', '/(app)/edit-profile'],
    ['Notifications', '/(app)/notifications'],
    ['Change password', '/(app)/change-password'],
    ['Terms of service', '/(app)/terms-of-service'],
    ['Privacy policy', '/(app)/privacy-policy'],
  ];
  for (const [name, route] of destinations) {
    fireEvent.press(view.getByRole('button', { name }));
    expect(mockRouter.push).toHaveBeenLastCalledWith(route);
  }
  // The full list includes the draft even though the Submitted stat excludes it.
  expect(view.getByText('6')).toBeTruthy();
});

it('keeps ordinary centavo totals in equal compact tiles and gives truly wide amounts their own rows', () => {
  Dimensions.set({ window: { width: 375, height: 812, scale: 3, fontScale: 1 }, screen: { width: 375, height: 812, scale: 3, fontScale: 1 } });
  mockAccounts['clerk-mika'].balance = 3750.50;
  mockAccounts['clerk-mika'].totalEarnings = 41500.50;
  const view = render(<ProfileScreen />);
  expect(view.getByTestId('profile-stats')).toHaveStyle({ flexDirection: 'row', alignItems: 'stretch' });
  for (const value of ['5', '₱3,750.50', '₱41,500.50']) {
    expect(view.getByText(value)).toHaveStyle({ fontSize: 16, lineHeight: 22 });
    expect(view.getByText(value).props.numberOfLines).toBeUndefined();
  }
  mockAccounts['clerk-mika'].balance = 1234567.89;
  mockAccounts['clerk-mika'].totalEarnings = 9876543.21;
  view.rerender(<ProfileScreen />);
  expect(view.getByTestId('profile-stats')).toHaveStyle({ flexDirection: 'column' });
  expect(view.getByLabelText('Balance ₱1,234,567.89')).toBeTruthy();
  expect(view.getByLabelText('Earned ₱9,876,543.21')).toBeTruthy();
  expect(view.getByText('₱1,234,567.89').props.numberOfLines).toBeUndefined();
  mockAccounts['clerk-mika'].balance = 750;
  mockAccounts['clerk-mika'].totalEarnings = 2500;
  view.rerender(<ProfileScreen />);
  expect(view.getByTestId('profile-stats')).toHaveStyle({ flexDirection: 'row', alignItems: 'stretch' });
});

it('offers Set a password for accounts that signed in through Apple or Google', () => {
  mockUser.passwordEnabled = false;
  const view = render(<ProfileScreen />);
  expect(view.queryByRole('button', { name: 'Change password' })).toBeNull();
  fireEvent.press(view.getByRole('button', { name: 'Set a password' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/(app)/change-password');
});

it('distinguishes unavailable offline totals from a known zero balance and empty capture list', () => {
  mockConnected = false;
  mockAccounts['clerk-mika'] = undefined;
  const view = render(<ProfileScreen />);
  expect(view.getByLabelText('Submitted —')).toBeTruthy();
  expect(view.getByLabelText('Balance —')).toBeTruthy();
  expect(view.getByLabelText('Earned —')).toBeTruthy();
  expect(view.getByText('Reconnect to load your profile and totals.')).toBeTruthy();
  expect(mockSubmissionsLookup).not.toHaveBeenCalled();
  switchAccount();
  view.rerender(<ProfileScreen />);
  expect(view.getByLabelText('Submitted 0')).toBeTruthy();
  expect(view.getByLabelText('Balance ₱0')).toBeTruthy();
  expect(view.getByLabelText('Earned ₱0')).toBeTruthy();
  expect(view.queryByText('Reconnect to load your profile and totals.')).toBeNull();
});

it('does not show another Clerk subject’s identity or financial data from a stale account response', () => {
  mockAccounts['clerk-mika'].clerkId = 'clerk-foreign';
  const view = render(<ProfileScreen />);
  expect(view.queryByText('MIKA8K2Q')).toBeNull();
  expect(view.queryByText('Certified')).toBeNull();
  expect(view.getByLabelText('Balance —')).toBeTruthy();
  expect(view.getByLabelText('Earned —')).toBeTruthy();
  expect(mockSubmissionsLookup).not.toHaveBeenCalled();
});

it.each([
  { certifiedAt: undefined, quizPassedAt: Date.UTC(2026, 9, 20) },
  { certifiedAt: Date.UTC(2026, 9, 20), rejectedAt: Date.UTC(2026, 9, 21) },
])('does not present pending or rejected certification as an approved certificate: %j', (status) => {
  Object.assign(mockAccounts['clerk-mika'], status);
  const view = render(<ProfileScreen />);
  expect(view.queryByText('Certified')).toBeNull();
  expect(view.queryByRole('button', { name: 'Show my certificate' })).toBeNull();
  expect(view.queryByTestId('certificate-content')).toBeNull();
});

it('opens the approved certificate with its actual date and preserves sharing and gallery export', async () => {
  const view = render(<ProfileScreen />);
  openCertificate(view);
  expect(view.getByText('MIKA SANTOS')).toBeTruthy();
  expect(view.getByText('October 2026')).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Share certificate' }));
  await waitFor(() => expect(mockShare).toHaveBeenCalledWith('file:///certificate.png', {
    mimeType: 'image/png', dialogTitle: 'Share your certificate',
  }));
  fireEvent.press(view.getByRole('button', { name: 'Save certificate to gallery' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith('file:///certificate.png'));
  fireEvent.press(view.getByRole('button', { name: 'Close certificate' }));
  expect(view.queryByTestId('certificate-content')).toBeNull();
});

it.each(['Share certificate', 'Save certificate to gallery'])('stops a pending %s export before sharing or saving after an account switch', async (action) => {
  let finishCapture!: (uri: string) => void;
  mockCaptureRef.mockReturnValueOnce(new Promise(resolve => { finishCapture = resolve; }));
  const view = render(<ProfileScreen />);
  openCertificate(view);
  fireEvent.press(view.getByRole('button', { name: action }));
  expect(mockCaptureRef).toHaveBeenCalledTimes(1);
  switchAccount();
  view.rerender(<ProfileScreen />);
  expect(view.queryByTestId('certificate-content')).toBeNull();
  await act(async () => { finishCapture('file:///old-account-certificate.png'); await flush(); });
  expect(mockShare).not.toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('checks the current account after Android gallery permission before capturing or saving', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  Object.defineProperty(Platform, 'Version', { configurable: true, value: 32 });
  let grantPermission!: (permission: typeof PermissionsAndroid.RESULTS.GRANTED) => void;
  jest.spyOn(PermissionsAndroid, 'request').mockReturnValueOnce(new Promise(resolve => { grantPermission = resolve; }));
  const view = render(<ProfileScreen />);
  openCertificate(view);
  fireEvent.press(view.getByRole('button', { name: 'Save certificate to gallery' }));
  expect(PermissionsAndroid.request).toHaveBeenCalledTimes(1);
  switchAccount();
  view.rerender(<ProfileScreen />);
  await act(async () => { grantPermission(PermissionsAndroid.RESULTS.GRANTED); await flush(); });
  expect(mockCaptureRef).not.toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
});

it('applies a trimmed referral code to the live account and keeps the sheet closed across account changes', async () => {
  let finishReferral!: () => void;
  mockApplyReferral.mockReturnValueOnce(new Promise<void>(resolve => { finishReferral = resolve; }));
  const view = render(<ProfileScreen />);
  fireEvent.press(view.getByRole('button', { name: 'Enter referral code' }));
  fireEvent.changeText(view.getByLabelText('Referral code'), '  joy123  ');
  fireEvent.press(view.getByRole('button', { name: 'Apply referral code' }));
  expect(mockApplyReferral).toHaveBeenCalledWith({ id: 'agent-mika', referredByCode: 'JOY123' });
  switchAccount();
  view.rerender(<ProfileScreen />);
  expect(view.queryByText('Got a code?')).toBeNull();
  await act(async () => { finishReferral(); await flush(); });
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(view.queryByText('Got a code?')).toBeNull();
});

it('blocks referral-code mutation while offline and keeps an existing referral from being entered again', () => {
  mockConnected = false;
  const view = render(<ProfileScreen />);
  fireEvent.press(view.getByRole('button', { name: 'Enter referral code' }));
  fireEvent.changeText(view.getByLabelText('Referral code'), 'JOY123');
  expect(view.getByRole('button', { name: 'Apply referral code' })).toBeDisabled();
  expect(view.getByText('Reconnect to apply your code.')).toBeTruthy();
  expect(mockApplyReferral).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole('link', { name: 'Cancel' }));
  mockAccounts['clerk-mika'].referredByCode = 'ORIGINAL';
  view.rerender(<ProfileScreen />);
  expect(view.queryByRole('button', { name: 'Enter referral code' })).toBeNull();
});

it('confirms sign-out once and preserves retry after a failed sign-out', async () => {
  mockSignOut.mockRejectedValueOnce(new Error('Network unavailable'));
  const view = render(<ProfileScreen />);
  fireEvent.press(view.getByRole('button', { name: 'Sign out' }));
  fireEvent.press(view.getByRole('button', { name: 'Sign out' }));
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  await act(async () => { await confirmation('Sign out')(); await flush(); });
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenLastCalledWith('Could not sign out', 'Please try again.');
  fireEvent.press(view.getByRole('button', { name: 'Sign out' }));
  await act(async () => { await confirmation('Sign out')(); await flush(); });
  expect(mockSignOut).toHaveBeenCalledTimes(2);
  expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)/login');
});

it('does not sign out a different account through a stale confirmation', async () => {
  const view = render(<ProfileScreen />);
  fireEvent.press(view.getByRole('button', { name: 'Sign out' }));
  const confirm = confirmation('Sign out');
  switchAccount();
  view.rerender(<ProfileScreen />);
  await act(async () => { await confirm(); await flush(); });
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('preserves the affiliate profile’s trimmed menu and real financial stats through its existing reexport', () => {
  mockAccounts['clerk-mika'].role = 'affiliate';
  const view = render(<AffiliateProfileScreen />);
  expect(view.getByText('Creator')).toBeTruthy();
  expect(view.getByLabelText('Balance ₱3,750.25')).toBeTruthy();
  expect(view.queryByText('Submitted')).toBeNull();
  expect(view.queryByText('Certified')).toBeNull();
  expect(view.queryByRole('button', { name: 'Dashboard' })).toBeNull();
  expect(view.queryByRole('button', { name: 'Show my certificate' })).toBeNull();
  expect(view.queryByRole('button', { name: 'Enter referral code' })).toBeNull();
  expect(view.getByRole('button', { name: 'Edit profile' })).toBeTruthy();
  expect(view.getByRole('button', { name: 'Privacy policy' })).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'My creator page' }));
  expect(mockRouter.push).toHaveBeenLastCalledWith('/(app)/(affiliate-tabs)/page');
  fireEvent.press(view.getByRole('button', { name: 'Sales' }));
  expect(mockRouter.push).toHaveBeenLastCalledWith('/(app)/(affiliate-tabs)/sales');
  expect(mockSubmissionsLookup).not.toHaveBeenCalled();
  mockAccounts['clerk-mika'].status = 'suspended';
  view.rerender(<AffiliateProfileScreen />);
  expect(view.queryByRole('button', { name: 'Edit profile' })).toBeNull();
});

it('preserves the admin profile preview without fetching personal captures', () => {
  mockPreview = true;
  const view = render(<ProfileScreen />);
  expect(view.getByTestId('preview-profile')).toBeTruthy();
  expect(mockSubmissionsLookup).not.toHaveBeenCalled();
});
