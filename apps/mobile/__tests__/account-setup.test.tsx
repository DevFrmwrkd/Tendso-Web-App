import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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
  creatorProgram: { checkAvailability: 'creatorProgram:checkAvailability' },
} }));

let mockAuthenticated = false;
let mockJwtSubject = 'user_alex';
let mockIsOwner = false;
let mockConnected = true;
let mockCodeResult: 'auto' | { value: string; available: boolean; error: string | null } | undefined = 'auto';
let mockAccount: null | {
  _id: string; role?: string; fieldAgentOnboardingCompletedAt?: number; referredByCode?: string; recruitedByCreatorId?: string;
} = null;
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
    if (args[0] === 'creatorProgram:checkAvailability') {
      if (args[1] === 'skip') return undefined;
      const candidate = (args[1] as { code: string }).code;
      return { handle: null, code: mockCodeResult === 'auto' ? { value: candidate, available: true, error: null } : mockCodeResult };
    }
    return args[1] === 'skip' ? undefined : { clerkId: mockJwtSubject, creator: mockAccount, isOwner: mockIsOwner };
  },
  useMutation: (name: string) => ({
    'creators:create': mockCreateCreator, 'affiliates:create': mockCreateAffiliate,
    'creators:update': mockUpdate, 'creators:applyReferralCode': mockReferral,
  })[name],
}));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
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
  mockConnected = true;
  mockCodeResult = 'auto';
  mockAccount = null;
  mockCreateCreator.mockResolvedValue('creator_alex');
  mockCreateAffiliate.mockResolvedValue('affiliate_alex');
});

it('waits for Convex authentication and preserves a legacy referral without asking for it again', async () => {
  await savePendingSignupProfile(normalizeSignupProfile({ firstName: 'Pending Alex', phone: '09171234567', referredByCode: 'AFF123' }), mockIdentity);
  const screen = render(<AccountSetupScreen />);
  expect(mockQuery).toHaveBeenCalledWith('adminAccess:me', 'skip');
  expect(mockCreateCreator).not.toHaveBeenCalled();
  mockAuthenticated = true;
  screen.rerender(<AccountSetupScreen />);
  await waitFor(() => expect(screen.getByLabelText('Name').props.value).toBe('Pending Alex'));
  expect(screen.getByLabelText('Mobile number').props.value).toBe('09171234567');
  expect(screen.queryByLabelText(/referral code/i)).toBeNull();
  expect(mockCreateCreator).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Create field agent account'));
  await waitFor(() => expect(mockCreateCreator).toHaveBeenCalledWith(expect.objectContaining({
    clerkId: mockIdentity.clerkId, phone: '09171234567', referredByCode: 'AFF123',
  })));
  expect(mockCreateAffiliate).not.toHaveBeenCalled();
});

it('creates a new field-agent account without collecting a referral before onboarding', async () => {
  mockAuthenticated = true;
  const screen = render(<AccountSetupScreen />);
  await waitFor(() => expect(screen.getByLabelText('Create field agent account')).toBeTruthy());
  expect(screen.queryByLabelText(/referral code/i)).toBeNull();
  fireEvent.press(screen.getByLabelText('Create field agent account'));
  await waitFor(() => expect(mockCreateCreator).toHaveBeenCalledWith(expect.objectContaining({
    clerkId: mockIdentity.clerkId, firstName: 'Alex', referredByCode: undefined,
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
  await savePendingSignupProfile(normalizeSignupProfile({ accountType: 'affiliate', firstName: 'Alex Shop', phone: '09171234567', handle: 'alex-shop', creatorCode: 'ALEX30', referredByCode: 'never-forward' }), mockIdentity);
  const screen = render(<AccountSetupScreen />);
  await waitFor(() => expect(screen.getByLabelText('Create creator account')).toBeTruthy());
  expect(screen.queryByLabelText('Referral code')).toBeNull();
  await waitFor(() => expect(screen.getByLabelText('Create creator account').props.accessibilityState.disabled).toBe(false));
  fireEvent.press(screen.getByLabelText('Create creator account'));
  await waitFor(() => expect(mockCreateAffiliate).toHaveBeenCalledWith({
    firstName: 'Alex Shop', lastName: 'Cruz', phone: '09171234567', handle: 'alex-shop', email: mockIdentity.email, code: 'ALEX30',
  }));
  expect(mockCreateCreator).not.toHaveBeenCalled();
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(affiliate-tabs)'));
  expect(await loadPendingSignupProfile(mockIdentity)).toBeNull();
});

it('chooses an affiliate after signup while keeping the collected name and mobile', async () => {
  mockAuthenticated = true;
  await savePendingSignupProfile(normalizeSignupProfile({
    firstName: 'Juan', lastName: 'Dela Cruz', phone: '09171234567',
  }), mockIdentity);
  const screen = render(<AccountSetupScreen />);
  await waitFor(() => expect(screen.getByLabelText('Name').props.value).toBe('Juan'));
  expect(screen.getByLabelText('Last name').props.value).toBe('Dela Cruz');
  expect(screen.getByLabelText('Mobile number').props.value).toBe('09171234567');
  expect(mockCreateCreator).not.toHaveBeenCalled();
  expect(mockCreateAffiliate).not.toHaveBeenCalled();

  fireEvent.press(screen.getByLabelText(/^Creator,/));
  expect(screen.getByLabelText('Name').props.value).toBe('Juan');
  expect(screen.getByLabelText('Mobile number').props.value).toBe('09171234567');
  expect(screen.getByLabelText('Page handle').props.value).toBe('');
  fireEvent.press(screen.getByLabelText('Create creator account'));
  expect(mockCreateAffiliate).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByLabelText('Page handle'), 'Juan-Shop');
  fireEvent.changeText(screen.getByLabelText('Creator code'), 'juan30');
  await waitFor(() => expect(screen.getByLabelText('Create creator account').props.accessibilityState.disabled).toBe(false));
  fireEvent.press(screen.getByLabelText('Create creator account'));
  await waitFor(() => expect(mockCreateAffiliate).toHaveBeenCalledWith({
    email: mockIdentity.email, firstName: 'Juan', lastName: 'Dela Cruz',
    phone: '09171234567', handle: 'juan-shop', code: 'JUAN30',
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
  fireEvent.changeText(screen.getByLabelText('Creator code'), 'taken30');
  await waitFor(() => expect(screen.getByLabelText('Create creator account').props.accessibilityState.disabled).toBe(false));
  fireEvent.press(screen.getByLabelText('Create creator account'));
  await waitFor(() => expect(screen.getByText('That page handle is already taken.')).toBeTruthy());
  expect(await loadPendingSignupProfile(mockIdentity)).toMatchObject({ accountType: 'affiliate', handle: 'taken-shop', phone: '09171234567', creatorCode: 'TAKEN30' });
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

it.each([
  { fieldAgentOnboardingCompletedAt: 123 },
  { referredByCode: 'AFF123' },
  { recruitedByCreatorId: 'creator_referrer' },
])('does not ask for a referral again when completing an existing profile with %j', (referralState) => {
  mockAuthenticated = true;
  mockAccount = { _id: 'creator_alex', role: 'creator', ...referralState };
  const screen = render(<CompleteProfileScreen />);
  expect(screen.getByLabelText('First name')).toBeTruthy();
  expect(screen.queryByLabelText(/referral code/i)).toBeNull();
  expect(mockReferral).not.toHaveBeenCalled();
});

it('retains optional referral entry for a legacy field agent who has not completed the new questions', () => {
  mockAuthenticated = true;
  mockAccount = { _id: 'legacy_creator', role: 'creator' };
  const screen = render(<CompleteProfileScreen />);
  expect(screen.getByLabelText('Referral code')).toBeTruthy();
  expect(mockReferral).not.toHaveBeenCalled();
});

describe('required creator code during mobile affiliate setup', () => {
  const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
  const activeChecks = () => mockQuery.mock.calls.filter(([reference, args]) => reference === 'creatorProgram:checkAvailability' && args !== 'skip');
  const advance = async (milliseconds: number) => { await act(async () => { jest.advanceTimersByTime(milliseconds); await flush(); }); };
  async function mountCreator(code = 'ALEX30') {
    mockAuthenticated = true;
    await savePendingSignupProfile(normalizeSignupProfile({ accountType: 'affiliate', firstName: 'Alex', phone: '09171234567', handle: 'alex-shop', creatorCode: code }), mockIdentity);
    const screen = render(<AccountSetupScreen />);
    await act(flush);
    return screen;
  }
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('waits for a debounced exact-candidate result and never uses a stale available code for a newer input', async () => {
    mockCodeResult = undefined;
    const screen = await mountCreator();
    expect(screen.getByLabelText('Create creator account').props.accessibilityState.disabled).toBe(true);
    expect(activeChecks()).toHaveLength(0);
    await advance(349);
    expect(activeChecks()).toHaveLength(0);
    await advance(1);
    expect(activeChecks().at(-1)).toEqual(['creatorProgram:checkAvailability', { code: 'ALEX30' }]);
    mockCodeResult = { value: 'OTHER30', available: true, error: null };
    screen.rerender(<AccountSetupScreen />);
    expect(screen.getByLabelText('Create creator account').props.accessibilityState.disabled).toBe(true);
    mockCodeResult = { value: 'ALEX30', available: true, error: null };
    screen.rerender(<AccountSetupScreen />);
    expect(screen.getByLabelText('Create creator account').props.accessibilityState.disabled).toBe(false);

    fireEvent.changeText(screen.getByLabelText('Creator code'), ' alex40 ');
    expect(screen.getByLabelText('Creator code').props.value).toBe('ALEX40');
    expect(screen.getByLabelText('Create creator account').props.accessibilityState.disabled).toBe(true);
    await advance(350);
    expect(activeChecks().at(-1)).toEqual(['creatorProgram:checkAvailability', { code: 'ALEX40' }]);
    expect(screen.getByLabelText('Create creator account').props.accessibilityState.disabled).toBe(true);
    mockCodeResult = { value: 'ALEX40', available: true, error: null };
    screen.rerender(<AccountSetupScreen />);
    fireEvent.press(screen.getByLabelText('Create creator account'));
    await act(flush);
    expect(mockCreateAffiliate).toHaveBeenCalledWith(expect.objectContaining({ code: 'ALEX40', handle: 'alex-shop' }));
    expect(mockCreateAffiliate.mock.calls[0][0]).not.toHaveProperty('referredByCode');
    expect(mockCreateCreator).not.toHaveBeenCalled();
  });

  it('loads old empty drafts but requires choosing an available code rather than silently generating one', async () => {
    const screen = await mountCreator('');
    expect(screen.getByLabelText('Creator code').props.value).toBe('');
    expect(screen.getByText('Choose your own code, such as ALEX30. Owners save 30% with it.')).toBeTruthy();
    expect(screen.getByLabelText('Create creator account').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByLabelText('Create creator account'));
    await advance(500);
    expect(activeChecks()).toHaveLength(0);
    expect(mockCreateAffiliate).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Creator code'), 'MINE30');
    await advance(350);
    expect(screen.getByLabelText('Create creator account').props.accessibilityState.disabled).toBe(false);
  });

  it('keeps taken and reserved codes disabled and stops checks when switching to the field-agent flow', async () => {
    mockCodeResult = { value: 'ALEX30', available: false, error: 'That code is already taken. Choose another one.' };
    const screen = await mountCreator();
    await advance(350);
    expect(screen.getByText('That code is already taken. Choose another one.')).toBeTruthy();
    expect(screen.getByLabelText('Create creator account').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText('Creator code'), 'OTR30');
    await advance(350);
    expect(screen.getByText('That code is reserved. Choose another one.')).toBeTruthy();
    expect(activeChecks().every(([, args]) => args.code === 'ALEX30')).toBe(true);
    fireEvent.press(screen.getByLabelText(/^Field agent,/));
    expect(screen.queryByLabelText('Creator code')).toBeNull();
    fireEvent.press(screen.getByLabelText('Create field agent account'));
    await act(flush);
    expect(mockCreateCreator).toHaveBeenCalledTimes(1);
    expect(mockCreateCreator.mock.calls[0][0]).not.toHaveProperty('code');
    expect(mockCreateAffiliate).not.toHaveBeenCalled();
  });

  it('invalidates a checked code while offline or when the authenticated subject no longer matches', async () => {
    const screen = await mountCreator();
    await advance(350);
    expect(screen.getByLabelText('Create creator account').props.accessibilityState.disabled).toBe(false);
    mockConnected = false;
    screen.rerender(<AccountSetupScreen />);
    expect(screen.getByLabelText('Create creator account').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByLabelText('Create creator account'));
    expect(mockCreateAffiliate).not.toHaveBeenCalled();
    mockConnected = true;
    mockJwtSubject = 'previous-user';
    screen.rerender(<AccountSetupScreen />);
    expect(screen.queryByLabelText('Create creator account')).toBeNull();
    await advance(500);
    expect(mockCreateAffiliate).not.toHaveBeenCalled();
  });
});
