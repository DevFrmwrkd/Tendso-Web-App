import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AccountSetupScreen from '../app/(app)/account-setup';
import CompleteProfileScreen from '../app/(app)/complete-profile';
import { loadPendingSignupProfile, normalizeSignupProfile, savePendingSignupProfile } from '../services/signupProfile';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@tendso/convex-client', () => ({ api: {
  adminAccess: { me: 'adminAccess:me' },
  creators: { getByClerkId: 'creators:getByClerkId', create: 'creators:create', update: 'creators:update', applyReferralCode: 'creators:applyReferralCode' },
  affiliates: { create: 'affiliates:create' },
} }));

let mockAuthenticated = false;
let mockJwtSubject = 'user_alex';
let mockIsOwner = false;
let mockAccount: null | { _id: string; role?: string } = null;
const mockCreateCreator = jest.fn();
const mockCreateAffiliate = jest.fn();
const mockUpdate = jest.fn();
const mockReferral = jest.fn();
const mockQuery = jest.fn();
const mockRouter = { replace: jest.fn() };
const mockSignOut = jest.fn();
const mockIdentity = { clerkId: 'user_alex', email: 'alex@example.com', sessionId: 'session_alex' };
const mockUser = { id: mockIdentity.clerkId, firstName: 'Alex', lastName: 'Cruz', primaryEmailAddress: { emailAddress: mockIdentity.email }, update: jest.fn() };

jest.mock('@clerk/clerk-expo', () => ({
  useUser: () => ({ user: mockUser }),
  useSession: () => ({ session: { id: mockIdentity.sessionId } }),
  useClerk: () => ({ signOut: mockSignOut }),
}));
jest.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: mockAuthenticated, isLoading: !mockAuthenticated }),
  useQuery: (...args: unknown[]) => {
    mockQuery(...args);
    return args[1] === 'skip' ? undefined : { clerkId: mockJwtSubject, creator: mockAccount, isOwner: mockIsOwner };
  },
  useMutation: (name: string) => ({
    'creators:create': mockCreateCreator, 'affiliates:create': mockCreateAffiliate,
    'creators:update': mockUpdate, 'creators:applyReferralCode': mockReferral,
  })[name],
}));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: true }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({ Redirect: 'MockRedirect' }));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockAuthenticated = false;
  mockJwtSubject = mockIdentity.clerkId;
  mockIsOwner = false;
  mockAccount = null;
  mockCreateCreator.mockResolvedValue('creator_alex');
  mockCreateAffiliate.mockResolvedValue('affiliate_alex');
});

it('waits for Convex authentication, then restores details without automatically creating an account', async () => {
  await savePendingSignupProfile(normalizeSignupProfile({ firstName: 'Pending Alex', phone: '09171234567', referredByCode: 'AFF123' }), mockIdentity);
  const screen = render(<AccountSetupScreen />);
  expect(mockQuery).toHaveBeenLastCalledWith('adminAccess:me', 'skip');
  expect(mockCreateCreator).not.toHaveBeenCalled();
  mockAuthenticated = true;
  screen.rerender(<AccountSetupScreen />);
  await waitFor(() => expect(screen.getByLabelText('Name').props.value).toBe('Pending Alex'));
  expect(screen.getByLabelText('Mobile number').props.value).toBe('09171234567');
  expect(screen.getByLabelText('Referral code').props.value).toBe('AFF123');
  expect(mockCreateCreator).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Create field agent account'));
  await waitFor(() => expect(mockCreateCreator).toHaveBeenCalledWith(expect.objectContaining({
    clerkId: mockIdentity.clerkId, phone: '09171234567', referredByCode: 'AFF123',
  })));
  expect(mockCreateAffiliate).not.toHaveBeenCalled();
});

it('waits when the Convex JWT still belongs to a previous Clerk user', async () => {
  mockAuthenticated = true;
  mockJwtSubject = 'previous_user';
  const screen = render(<AccountSetupScreen />);
  expect(screen.queryByLabelText('Create field agent account')).toBeNull();
  expect(mockCreateCreator).not.toHaveBeenCalled();
  expect(mockCreateAffiliate).not.toHaveBeenCalled();
  mockJwtSubject = mockIdentity.clerkId;
  screen.rerender(<AccountSetupScreen />);
  await waitFor(() => expect(screen.getByLabelText('Create field agent account')).toBeTruthy());
  expect(mockCreateCreator).not.toHaveBeenCalled();
});

it('does not offer a new account type to an existing business owner', () => {
  mockAuthenticated = true;
  mockIsOwner = true;
  const screen = render(<AccountSetupScreen />);
  expect(screen.getByText('Business owner account')).toBeTruthy();
  expect(screen.queryByLabelText(/^Field agent,/)).toBeNull();
  expect(screen.queryByLabelText(/^Creator,/)).toBeNull();
  expect(mockCreateCreator).not.toHaveBeenCalled();
  expect(mockCreateAffiliate).not.toHaveBeenCalled();
});

it('resumes the affiliate choice and sends no incoming referral field', async () => {
  mockAuthenticated = true;
  await savePendingSignupProfile(normalizeSignupProfile({ accountType: 'affiliate', firstName: 'Alex Shop', phone: '09171234567', handle: 'alex-shop', referredByCode: 'never-forward' }), mockIdentity);
  const screen = render(<AccountSetupScreen />);
  await waitFor(() => expect(screen.getByLabelText('Create creator account')).toBeTruthy());
  expect(screen.queryByLabelText('Referral code')).toBeNull();
  fireEvent.press(screen.getByLabelText('Create creator account'));
  await waitFor(() => expect(mockCreateAffiliate).toHaveBeenCalledWith({
    firstName: 'Alex Shop', lastName: 'Cruz', phone: '09171234567', handle: 'alex-shop', email: mockIdentity.email,
  }));
  expect(mockCreateCreator).not.toHaveBeenCalled();
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(affiliate-tabs)'));
  expect(await loadPendingSignupProfile(mockIdentity)).toBeNull();
});

it('keeps the entered affiliate details after a server uniqueness error', async () => {
  mockAuthenticated = true;
  mockCreateAffiliate.mockRejectedValueOnce({ data: 'That page handle is already taken.' });
  const screen = render(<AccountSetupScreen />);
  await waitFor(() => expect(screen.getByLabelText('Create field agent account')).toBeTruthy());
  fireEvent.press(screen.getByLabelText(/^Creator,/));
  fireEvent.changeText(screen.getByLabelText('Mobile number'), '09171234567');
  fireEvent.changeText(screen.getByLabelText('Page handle'), 'Taken-Shop');
  fireEvent.press(screen.getByLabelText('Create creator account'));
  await waitFor(() => expect(screen.getByText('That page handle is already taken.')).toBeTruthy());
  expect(await loadPendingSignupProfile(mockIdentity)).toMatchObject({ accountType: 'affiliate', handle: 'taken-shop', phone: '09171234567' });
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it.each([
  ['creator', '/(app)/(tabs)'], ['affiliate', '/(app)/(affiliate-tabs)'], ['admin', '/(app)/admin'],
])('bypasses setup for an existing %s without conversion', async (role, home) => {
  mockAuthenticated = true;
  mockAccount = { _id: 'existing', role };
  render(<AccountSetupScreen />);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(home));
  expect(mockCreateCreator).not.toHaveBeenCalled();
  expect(mockCreateAffiliate).not.toHaveBeenCalled();
});

it('keeps an affiliate out of the creator profile and referral form', () => {
  mockAuthenticated = true;
  mockAccount = { _id: 'affiliate', role: 'affiliate' };
  const screen = render(<CompleteProfileScreen />);
  expect(screen.toJSON()).toMatchObject({ type: 'MockRedirect', props: { href: '/(app)/(affiliate-tabs)' } });
  expect(screen.queryByLabelText('Referral code')).toBeNull();
  expect(mockReferral).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});
