import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useQuery } from 'convex/react';
import AppLayout from '../app/(app)/_layout';
import { AffiliateAccess } from '../components/affiliate/Screen';

let mockSegments = ['(app)', '(affiliate-tabs)'];
let mockAccount: Record<string, unknown>;
let mockClerkSubject = 'affiliate-user';
let mockSignedIn = true;
let mockNetworkConnected = true;
let mockSpotDraft = false;
const mockSignOut = jest.fn();
const mockQuery = jest.fn();
const mockLastActive = jest.fn();
const mockOfflineSync = jest.fn();
jest.mock('../lib/v2/ownerIntake', () => ({ hasOwnerIntent: jest.fn(async () => true) }));
jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ isSignedIn: mockSignedIn, isLoaded: true, userId: mockClerkSubject }),
  useClerk: () => ({ signOut: mockSignOut }),
}));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => mockAccount }));
jest.mock('../hooks/useDeleteAccount', () => ({ useDeleteAccount: () => ({ busy: false, canDelete: true, requestDelete: jest.fn() }) }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockNetworkConnected }) }));
jest.mock('../hooks/useOfflineSync', () => ({ useOfflineSync: (...args: unknown[]) => mockOfflineSync(...args) }));
jest.mock('../services/signupProfile', () => ({ clearPendingSignupProfiles: jest.fn(async () => {}) }));
jest.mock('../components/AccountViewSwitcher', () => ({
  AccountViewSwitcher: () => require('react').createElement(require('react-native').Text, { testID: 'view-switcher' }, 'Views'),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => 'true'), setItem: jest.fn(async () => {}), removeItem: jest.fn(async () => {}),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('@tendso/convex-client', () => ({ api: { creators: { updateLastActive: 'creators:updateLastActive' } } }));
jest.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockQuery(...args),
  useMutation: () => mockLastActive,
}));
jest.mock('expo-router', () => {
  const create = require('react').createElement;
  const NativeText = require('react-native').Text;
  function Stack() {
    const [draft, setDraft] = require('react').useState('');
    require('convex/react').useQuery('protected-screen-query', {});
    return create(require('react-native').View, null,
      create(NativeText, { testID: 'protected-navigation' }, 'Private screens'),
      mockSpotDraft ? create(require('react-native').TextInput, { testID: 'spot-draft', value: draft, onChangeText: setDraft }) : null);
  }
  Stack.Screen = () => null;
  return { Stack, useSegments: () => mockSegments,
    Redirect: ({ href }: { href: string }) => create(NativeText, { testID: 'redirect' }, href) };
});
jest.mock('../components/ui/primitives', () => {
  const create = require('react').createElement;
  const { Text: NativeText, Pressable } = require('react-native');
  const text = ({ children, accessibilityRole }: { children: React.ReactNode; accessibilityRole?: string }) => create(NativeText, { accessibilityRole }, children);
  return { Body: text, Display: text, Label: text,
    Door: ({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) =>
      create(Pressable, { accessibilityRole: 'button', accessibilityLabel: label, onPress, disabled: disabled || loading,
        accessibilityState: { disabled: !!disabled || !!loading } }, create(NativeText, null, label)) };
});

const affiliate = { _id: 'affiliate-1', clerkId: 'affiliate-user', role: 'affiliate', status: 'pending', firstName: 'Ana' };
const ready = () => ({ account: affiliate, role: 'affiliate', view: 'affiliate', isLoading: false, isAuthenticated: true,
  isOffline: false, isBlocked: false, isOwner: false, isAdmin: false, isPreview: false });
async function mountApp() {
  const screen = render(<AppLayout />);
  await act(async () => { await Promise.resolve(); });
  return screen;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockAccount = ready();
  mockSegments = ['(app)', '(affiliate-tabs)'];
  mockClerkSubject = 'affiliate-user';
  mockSignedIn = true;
  mockNetworkConnected = true;
  mockSpotDraft = false;
  mockSignOut.mockResolvedValue(undefined);
  mockLastActive.mockResolvedValue(undefined);
});

describe('pending affiliate root navigation', () => {
  it.each([
    ['(affiliate-tabs)'], ['(affiliate-tabs)', 'page'], ['(affiliate-tabs)', 'sales'], ['(affiliate-tabs)', 'wallet'],
    ['referrals'], ['notifications'], ['edit-profile'], ['change-password'], ['submit'], ['admin'],
  ])('keeps pending deep link %j outside the navigator', async (...route) => {
    mockSegments = ['(app)', ...route];
    const screen = await mountApp();
    expect(screen.getByText('Awaiting approval')).toBeTruthy();
    expect(screen.queryByTestId('protected-navigation')).toBeNull();
    expect(screen.queryByTestId('view-switcher')).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockOfflineSync).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('opens the dashboard immediately after reactive approval', async () => {
    const screen = await mountApp();
    expect(screen.getByText('Awaiting approval')).toBeTruthy();
    mockAccount = { ...ready(), account: { ...affiliate, status: 'active' } };
    screen.rerender(<AppLayout />);
    expect(screen.queryByText('Awaiting approval')).toBeNull();
    expect(screen.getByTestId('protected-navigation')).toBeTruthy();
    expect(mockQuery).toHaveBeenCalledWith('protected-screen-query', {});
  });

  it('unmounts private screens if the live account returns to pending', async () => {
    mockAccount = { ...ready(), account: { ...affiliate, status: 'active' } };
    const screen = await mountApp();
    expect(screen.getByTestId('protected-navigation')).toBeTruthy();
    mockQuery.mockClear();
    mockAccount = ready();
    screen.rerender(<AppLayout />);
    expect(screen.getByText('Awaiting approval')).toBeTruthy();
    expect(screen.queryByTestId('protected-navigation')).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('allows signout without mounting protected screens', async () => {
    const screen = await mountApp();
    expect(screen.getByText('Awaiting approval')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Sign out'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('keeps signout errors recoverable on the waiting screen', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('Network unavailable'));
    const screen = await mountApp();
    expect(screen.getByText('Awaiting approval')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Sign out'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Please try again.');
    expect(screen.getByLabelText('Sign out').props.accessibilityState.disabled).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('preserves active admin affiliate previews despite legacy pending admin status', async () => {
    mockAccount = { ...ready(), account: { ...affiliate, role: 'admin' }, role: 'admin', isAdmin: true, isPreview: true };
    const screen = await mountApp();
    expect(screen.getByTestId('protected-navigation')).toBeTruthy();
    expect(screen.queryByText('Awaiting approval')).toBeNull();
  });

  it('waits for session hydration before deciding approval access', async () => {
    mockAccount = { ...ready(), isLoading: true };
    const screen = await mountApp();
    expect(screen.getByLabelText('Loading account')).toBeTruthy();
    expect(screen.queryByText('Awaiting approval')).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('affiliate component defense', () => {
  function PrivateChild() { useQuery('affiliate-private-query' as never, {}); return <Text>Private affiliate content</Text>; }
  const protectedScreen = () => <AffiliateAccess>{() => <PrivateChild />}</AffiliateAccess>;
  it('does not mount affiliate-only query children before approval', () => {
    const screen = render(protectedScreen());
    expect(screen.getByText('Awaiting approval')).toBeTruthy();
    expect(screen.queryByText('Private affiliate content')).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });
  it('mounts the protected child only after approval', () => {
    const screen = render(protectedScreen());
    mockAccount = { ...ready(), account: { ...affiliate, status: 'active' } };
    screen.rerender(protectedScreen());
    expect(screen.getByText('Private affiliate content')).toBeTruthy();
    expect(screen.queryByText('Awaiting approval')).toBeNull();
    expect(mockQuery).toHaveBeenCalledWith('affiliate-private-query', {});
  });
});


describe('owner intent cannot override authenticated roles', () => {
  it.each(['creator', 'affiliate', 'admin'])('preserves %s routing with owner intent saved', async role => {
    mockSegments = ['(app)', '(tabs)'];
    mockAccount = { ...ready(), role, view: role,
      account: { ...affiliate, role, status: 'active' }, isAdmin: role === 'admin' };
    const screen = await mountApp();
    expect(screen.queryByText('/(owner)')).toBeNull();
    if (role === 'creator') expect(screen.getByTestId('protected-navigation')).toBeTruthy();
    else expect(screen.getByTestId('redirect')).toHaveTextContent(role === 'admin' ? '/(app)/admin' : '/(app)/(affiliate-tabs)/');
  });

  it('uses owner intent for a new account after role resolution', async () => {
    mockAccount = { ...ready(), account: null, role: null };
    const screen = await mountApp();
    expect(screen.getByTestId('redirect')).toHaveTextContent('/(owner)');
  });

  it('waits for account resolution before using owner intent', async () => {
    mockAccount = { ...ready(), account: undefined, role: null, isLoading: true };
    const screen = await mountApp();
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(screen.getByLabelText('Loading account')).toBeTruthy();
  });
});

describe('field-agent onboarding root navigation', () => {
  const agentState = (required: boolean | undefined = true) => ({ ...ready(), role: 'creator', view: 'creator',
    account: { ...affiliate, role: 'creator', status: 'active', fieldAgentOnboardingRequired: required } });

  it.each(['(tabs)', 'training', 'certification-quiz', 'submit', 'leads', 'referrals'])(
    'resumes unfinished agent questions before mounting %s', async route => {
      mockSegments = ['(app)', route];
      mockAccount = agentState();
      const screen = await mountApp();
      expect(screen.getByTestId('redirect')).toHaveTextContent('/(app)/agent-onboarding');
      expect(screen.queryByTestId('protected-navigation')).toBeNull();
      expect(mockQuery).not.toHaveBeenCalled();
    });

  it('mounts the questions route and releases other routes after completion', async () => {
    mockSegments = ['(app)', 'agent-onboarding'];
    mockAccount = agentState();
    const screen = await mountApp();
    expect(screen.getByTestId('protected-navigation')).toBeTruthy();
    mockSegments = ['(app)', '(tabs)'];
    mockAccount = agentState(false);
    screen.rerender(<AppLayout />);
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(screen.getByTestId('protected-navigation')).toBeTruthy();
  });

  it.each([undefined, false])('keeps existing agents without a required flag on their existing flow (%s)', async required => {
    mockSegments = ['(app)', '(tabs)'];
    mockAccount = agentState(required);
    // Explicit undefined differs from the factory default argument above.
    (mockAccount.account as Record<string, unknown>).fieldAgentOnboardingRequired = required;
    const screen = await mountApp();
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(screen.getByTestId('protected-navigation')).toBeTruthy();
  });

  it('does not interrupt offline field-agent drafts', async () => {
    mockSegments = ['(app)', 'submit'];
    mockAccount = { ...agentState(), isOffline: true };
    const screen = await mountApp();
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(screen.getByTestId('protected-navigation')).toBeTruthy();
  });

  it('keeps admin field-agent previews outside the onboarding gate', async () => {
    mockSegments = ['(app)', '(tabs)'];
    mockAccount = { ...agentState(), role: 'admin', isAdmin: true, isPreview: true,
      account: { ...(agentState().account), role: 'admin' } };
    const screen = await mountApp();
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(screen.getByTestId('protected-navigation')).toBeTruthy();
  });
});

describe('Spot draft reconnect boundary', () => {
  const approvedAgent = () => ({ ...ready(), role: 'creator', view: 'creator',
    account: { _id: 'approved-agent', clerkId: mockClerkSubject, role: 'creator', status: 'active', firstName: 'Pablo', certifiedAt: 100 } });

  it.each([['leads', 'spot'], ['submit', 'info'], ['submit', 'photos'], ['submit', 'interview'], ['submit', 'review']])(
    'keeps an already-open same-subject %s/%s subtree mounted through offline and account reconnection', async (...route) => {
    mockSegments = ['(app)', ...route]; mockSpotDraft = true;
    mockAccount = approvedAgent();
    const approved = mockAccount;
    const screen = await mountApp();
    if (route[0] === 'submit') expect(mockOfflineSync).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    fireEvent.changeText(screen.getByTestId('spot-draft'), 'Nena Store and its selected photo');
    mockNetworkConnected = false;
    mockAccount = { ...approved, account: undefined, isOffline: true, isAuthenticated: false };
    screen.rerender(<AppLayout />);
    expect(screen.getByTestId('spot-draft').props.value).toBe('Nena Store and its selected photo');
    mockNetworkConnected = true;
    mockAccount = { ...approved, account: undefined, role: null, isLoading: true, isAuthenticated: false };
    screen.rerender(<AppLayout />);
    expect(screen.queryByLabelText('Loading account')).toBeNull();
    expect(screen.getByTestId('spot-draft').props.value).toBe('Nena Store and its selected photo');
    mockAccount = approved;
    screen.rerender(<AppLayout />);
    expect(screen.getByTestId('spot-draft').props.value).toBe('Nena Store and its selected photo');
  });

  it('keeps a cold Spot deep link behind account hydration', async () => {
    mockSegments = ['(app)', 'leads', 'spot']; mockSpotDraft = true;
    mockAccount = { ...approvedAgent(), account: undefined, role: null, isLoading: true, isAuthenticated: false };
    const screen = await mountApp();
    expect(screen.getByLabelText('Loading account')).toBeTruthy();
    expect(screen.queryByTestId('spot-draft')).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('unmounts the old Spot subtree when the Clerk subject changes before its account is resolved', async () => {
    mockSegments = ['(app)', 'leads', 'spot']; mockSpotDraft = true;
    mockAccount = approvedAgent();
    const screen = await mountApp();
    fireEvent.changeText(screen.getByTestId('spot-draft'), 'Private actor-one draft');
    mockClerkSubject = 'second-clerk-user';
    mockAccount = { ...approvedAgent(), account: undefined, role: null, isLoading: true, isAuthenticated: false };
    screen.rerender(<AppLayout />);
    expect(screen.getByLabelText('Loading account')).toBeTruthy();
    expect(screen.queryByTestId('spot-draft')).toBeNull();
    mockAccount = { ...approvedAgent(), account: { ...(approvedAgent().account), _id: 'second-agent' } };
    screen.rerender(<AppLayout />);
    expect(screen.getByTestId('spot-draft').props.value).toBe('');
  });

  it.each(['blocked', 'revoked', 'missing', 'preview'])('does not retain the Spot subtree after an explicit %s result', async change => {
    mockSegments = ['(app)', 'leads', 'spot']; mockSpotDraft = true;
    mockAccount = approvedAgent();
    const screen = await mountApp();
    fireEvent.changeText(screen.getByTestId('spot-draft'), 'A draft');
    mockAccount = { ...approvedAgent(), isLoading: true,
      ...(change === 'blocked' ? { isBlocked: true } : {}),
      ...(change === 'revoked' ? { account: { ...approvedAgent().account, certifiedAt: undefined } } : {}),
      ...(change === 'missing' ? { account: null } : {}),
      ...(change === 'preview' ? { isPreview: true } : {}),
    };
    screen.rerender(<AppLayout />);
    expect(screen.queryByTestId('spot-draft')).toBeNull();
    expect(screen.getByLabelText('Loading account')).toBeTruthy();
  });

  it('discards retention after leaving Spot and keeps other account loading behavior', async () => {
    mockSegments = ['(app)', 'leads', 'spot']; mockSpotDraft = true;
    mockAccount = approvedAgent();
    const screen = await mountApp();
    mockSegments = ['(app)', '(tabs)', 'finds'];
    mockAccount = { ...approvedAgent(), account: undefined, role: null, isLoading: true };
    screen.rerender(<AppLayout />);
    expect(screen.queryByTestId('spot-draft')).toBeNull();
    expect(screen.getByLabelText('Loading account')).toBeTruthy();
    mockSegments = ['(app)', 'leads', 'spot'];
    screen.rerender(<AppLayout />);
    expect(screen.queryByTestId('spot-draft')).toBeNull();
    expect(screen.getByLabelText('Loading account')).toBeTruthy();
  });
});
