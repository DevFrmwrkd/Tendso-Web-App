import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import OwnerLayout from '../app/(owner)/_layout';
import OwnerMe from '../app/(owner)/(tabs)/me';
import Inbox from '../app/(owner)/me/inbox';
import { ListRow } from '../components/v2';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockEnsure = jest.fn();
const mockSignOut = jest.fn();
const mockBind = jest.fn();
const mockMigrate = jest.fn();
const mockSet = jest.fn();
const mockClear = jest.fn();
const mockResume = jest.fn();
const mockOwnerQuery = jest.fn();
const mockStackUnmount = jest.fn();
const mockStackMount = jest.fn();
let mockAuth: any;
let mockMobile: any;
let mockMe: any;
let mockScope: number;
let mockActor: string | null;
let mockIntake: any;
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => mockAuth, useClerk: () => ({ signOut: mockSignOut }) }));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => mockMobile }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
jest.mock('../lib/v2/ownerData', () => ({
  WEB_ORIGIN: 'https://tendso.test', useOwnerMe: () => { mockOwnerQuery(); return mockMe; },
  useEnsureOwner: () => mockEnsure, useOwnerSubmission: (id: string | null) => id ? { submissionId: id } : undefined,
}));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => {
  const site = mockMe?.sites.find((item: any) => item.submissionId === mockIntake.submissionId) ?? mockMe?.sites[0] ?? null;
  return { me: mockMe, site, id: site?.submissionId ?? null };
} }));
jest.mock('../lib/v2/ownerUploads', () => ({ useOwnerUploads: () => ({ resume: mockResume }) }));
jest.mock('../lib/v2/ownerIntake', () => ({
  ownerIntake: {
    bindActor: (...args: unknown[]) => mockBind(...args), migrateLegacy: (...args: unknown[]) => mockMigrate(...args),
    scope: () => mockScope, isCurrent: (scope: number) => scope === mockScope,
    get: () => mockIntake, set: (...args: unknown[]) => mockSet(...args), clear: () => mockClear(),
  }, useOwnerIntake: () => mockIntake,
}));
jest.mock('../components/CreatorAttributionGate', () => ({ CreatorAttributionGate: () => null }));
jest.mock('expo-router', () => {
  const { createElement: makeElement, useEffect } = require('react'); const { View, Text } = require('react-native');
  const Stack = ({ children }: any) => {
    useEffect(() => { mockStackMount(mockIntake.submissionId); return () => mockStackUnmount(); }, []);
    return makeElement(View, { testID: 'owner-stack' }, children);
  };
  Stack.Screen = () => null;
  return { Stack, Redirect: ({ href }: any) => makeElement(Text, { testID: 'owner-redirect' }, href) };
});
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => {}) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs', LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop' }));

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function meFixture() {
  return { owner: { _id: 'owner-record-a', name: 'Juan Reyes', email: 'juan@example.test' }, sites: [{
    submissionId: 'site-a', businessName: 'Juan Store', phase: 'draft', openChangeRequests: 0,
  }] };
}
function confirm(label: string) {
  return jest.mocked(Alert.alert).mock.calls.at(-1)![2]!.find(button => button.text === label)!.onPress!;
}
function rowAction(screen: ReturnType<typeof render>, title: string) {
  return screen.UNSAFE_getAllByType(ListRow).find(node => node.props.title === title)!.props.onPress;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { isLoaded: true, isSignedIn: true, userId: 'owner-a', sessionId: 'session-a', signOut: mockSignOut };
  mockMobile = { isLoading: false, isOffline: false, account: null, role: null };
  mockScope = 1; mockActor = 'owner-a'; mockIntake = { ownerName: 'Juan', submissionId: 'site-a' };
  mockMe = meFixture();
  mockSet.mockReset().mockImplementation((patch: any) => {
    if (patch.submissionId && mockIntake.submissionId && patch.submissionId !== mockIntake.submissionId) mockScope += 1;
    mockIntake = { ...mockIntake, ...patch };
  });
  mockEnsure.mockReset().mockResolvedValue({ ownerId: 'owner-record-a' });
  mockSignOut.mockReset().mockResolvedValue(undefined);
  mockMigrate.mockReset().mockResolvedValue(undefined);
  mockResume.mockReset().mockResolvedValue(undefined);
  mockBind.mockReset().mockImplementation(async (actor: string | null) => {
    if (actor !== mockActor) { mockActor = actor; mockScope += 1; mockIntake = actor ? { ownerName: 'Juan' } : {}; }
    return mockIntake;
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it.each(['creator', 'affiliate', 'admin'])('resolves an existing %s through the same app rather than creating an owner from a deep link', (role) => {
  mockMobile.account = { _id: 'existing-account', role }; mockMobile.role = role;
  const screen = render(<OwnerLayout />);
  expect(screen.getByTestId('owner-redirect').props.children).toBe('/(app)/(tabs)/');
  expect(mockEnsure).not.toHaveBeenCalled(); expect(mockBind).not.toHaveBeenCalled(); expect(mockOwnerQuery).not.toHaveBeenCalled();
});

it('waits for role resolution and redirects signed-out users to passwordless owner sign-in', () => {
  mockMobile.isLoading = true;
  const screen = render(<OwnerLayout />);
  expect(mockOwnerQuery).not.toHaveBeenCalled(); expect(mockBind).not.toHaveBeenCalled();
  mockAuth = { ...mockAuth, isSignedIn: false };
  screen.rerender(<OwnerLayout />);
  expect(screen.getByTestId('owner-redirect').props.children).toBe('/(auth)/owner');
});

it('binds the actor before ensuring an owner and gives a failed ensure a working retry', async () => {
  mockMe = null;
  let finishBinding!: () => void;
  mockBind.mockReturnValueOnce(new Promise<void>(resolve => { finishBinding = resolve; }));
  mockEnsure.mockRejectedValueOnce(new Error('Owner service unavailable'));
  const screen = render(<OwnerLayout />);
  expect(mockEnsure).not.toHaveBeenCalled();
  await act(async () => { finishBinding(); await flush(); });
  expect(await screen.findByText('Owner service unavailable')).toBeTruthy();
  expect(mockEnsure).toHaveBeenCalledWith({ name: 'Juan' });
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Try again' })); await flush(); });
  expect(mockEnsure).toHaveBeenCalledTimes(2);
  mockMe = meFixture(); screen.rerender(<OwnerLayout />);
  await screen.findByTestId('owner-stack');
});

it('waits for verified legacy migration before rendering uploads or owner routes', async () => {
  let finish!: () => void;
  mockMigrate.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  const screen = render(<OwnerLayout />);
  await waitFor(() => expect(mockMigrate).toHaveBeenCalledWith(['site-a']));
  expect(screen.queryByTestId('owner-stack')).toBeNull(); expect(mockResume).not.toHaveBeenCalled();
  await act(async () => { finish(); await flush(); });
  expect(screen.getByTestId('owner-stack')).toBeTruthy(); expect(mockResume).toHaveBeenCalledTimes(1);
});

it('selects the newest owned server draft before mounting capture or resuming uploads on a clean install', async () => {
  mockIntake = { ownerName: 'Juan' };
  const screen = render(<OwnerLayout />);
  await screen.findByTestId('owner-stack');
  expect(mockSet).toHaveBeenCalledWith({ submissionId: 'site-a' });
  expect(mockStackMount).toHaveBeenCalledWith('site-a');
  expect(mockResume).toHaveBeenCalledWith('site-a', { submissionId: 'site-a' });
});

it('keeps an owned selected draft instead of resetting it to the newest site', async () => {
  mockIntake = { ownerName: 'Juan', submissionId: 'selected-older-site' };
  mockMe = { ...mockMe, sites: [...mockMe.sites, { ...mockMe.sites[0], submissionId: 'selected-older-site' }] };
  const screen = render(<OwnerLayout />);
  await screen.findByTestId('owner-stack');
  expect(mockSet).not.toHaveBeenCalled();
  expect(mockStackMount).toHaveBeenCalledWith('selected-older-site');
  expect(mockResume).toHaveBeenCalledWith('selected-older-site', { submissionId: 'selected-older-site' });
});

it('replaces a foreign pointer with the current actor’s newest owned site even when that write advances scope', async () => {
  mockIntake = { ownerName: 'Juan', submissionId: 'foreign-site' };
  const scope = mockScope;
  const screen = render(<OwnerLayout />);
  await screen.findByTestId('owner-stack');
  expect(mockSet).toHaveBeenCalledWith({ submissionId: 'site-a' });
  expect(mockScope).toBe(scope + 1);
  expect(mockStackMount).toHaveBeenCalledWith('site-a');
  expect(mockResume).toHaveBeenCalledWith('site-a', { submissionId: 'site-a' });
});

it('never adopts a stale actor’s site when legacy migration finishes after an account switch', async () => {
  mockIntake = { ownerName: 'Juan', submissionId: 'foreign-site' };
  let finish!: () => void;
  mockMigrate.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  const screen = render(<OwnerLayout />);
  await waitFor(() => expect(mockMigrate).toHaveBeenCalledTimes(1));
  mockAuth = { ...mockAuth, userId: 'owner-b', sessionId: 'session-b' };
  mockMe = { owner: { _id: 'owner-record-b', name: 'B', email: 'b@example.test' }, sites: [{ ...mockMe.sites[0], submissionId: 'site-b' }] };
  screen.rerender(<OwnerLayout />);
  await screen.findByTestId('owner-stack');
  await act(async () => { finish(); await flush(); });
  expect(mockSet).toHaveBeenCalledTimes(1);
  expect(mockSet).toHaveBeenCalledWith({ submissionId: 'site-b' });
  expect(mockStackMount).toHaveBeenCalledWith('site-b');
  expect(mockSet).not.toHaveBeenCalledWith({ submissionId: 'site-a' });
});

it('does not adopt a foreign pointer when the actor owns no sites', async () => {
  mockIntake = { submissionId: 'foreign-site' };
  mockMe = { ...mockMe, sites: [] };
  const screen = render(<OwnerLayout />);
  await screen.findByTestId('owner-stack');
  expect(mockSet).not.toHaveBeenCalled();
  expect(mockResume).not.toHaveBeenCalled();
});

it('does not retain the previous actor’s ensure error or permanent asked flag', async () => {
  mockMe = null;
  let failOld!: (error: Error) => void;
  mockEnsure.mockReturnValueOnce(new Promise((_resolve, reject) => { failOld = reject; }));
  const screen = render(<OwnerLayout />);
  await waitFor(() => expect(mockEnsure).toHaveBeenCalledTimes(1));
  mockAuth = { ...mockAuth, userId: 'owner-b', sessionId: 'session-b' };
  screen.rerender(<OwnerLayout />);
  await waitFor(() => expect(mockEnsure).toHaveBeenCalledTimes(2));
  await act(async () => { failOld(new Error('Old owner failure')); await flush(); });
  expect(screen.queryByText('Old owner failure')).toBeNull(); expect(mockBind).toHaveBeenCalledWith('owner-b');
});

it('keeps the live stack mounted when a newly created site changes membership', async () => {
  const screen = render(<OwnerLayout />);
  await screen.findByTestId('owner-stack');
  let finish!: () => void;
  mockMigrate.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  mockMe = { ...mockMe, sites: [...mockMe.sites, { ...mockMe.sites[0], submissionId: 'new-site' }] };
  screen.rerender(<OwnerLayout />);
  expect(screen.getByTestId('owner-stack')).toBeTruthy();
  expect(mockStackUnmount).not.toHaveBeenCalled();
  await act(async () => { finish(); await flush(); });
  expect(mockStackUnmount).not.toHaveBeenCalled();
});

it('keeps ensure retryable after losing connectivity while its mutation is pending', async () => {
  mockMe = null;
  let fail!: (error: Error) => void;
  mockEnsure.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
  const screen = render(<OwnerLayout />);
  await waitFor(() => expect(mockEnsure).toHaveBeenCalledTimes(1));
  mockMobile.isOffline = true; screen.rerender(<OwnerLayout />);
  await act(async () => { fail(new Error('Connection lost')); await flush(); });
  expect(screen.getByText('Connection lost')).toBeTruthy();
  mockMobile.isOffline = false; screen.rerender(<OwnerLayout />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Try again' })); await flush(); });
  expect(mockEnsure).toHaveBeenCalledTimes(2);
});

it('does not ensure an account offline or discard its saved progress after failed logout', async () => {
  mockMe = null; mockMobile.isOffline = true; mockSignOut.mockRejectedValueOnce(new Error('Logout failed'));
  const saved = mockIntake;
  const screen = render(<OwnerLayout />);
  expect(screen.getByText('Reconnect to continue')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Sign out' })); await flush(); });
  expect(screen.getByText('Could not sign out. Please try again.')).toBeTruthy();
  expect(mockEnsure).not.toHaveBeenCalled(); expect(mockIntake).toBe(saved); expect(mockClear).not.toHaveBeenCalled();
  expect(mockBind).not.toHaveBeenCalledWith(null);
});

it('keeps Me logout retryable without clearing the draft before Clerk succeeds', async () => {
  mockSignOut.mockRejectedValueOnce(new Error('Logout failed'));
  const saved = mockIntake;
  const screen = render(<OwnerMe />);
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  await act(async () => { await confirm('Sign out')(); });
  expect(screen.getByText('Could not sign out. Please try again.')).toBeTruthy();
  expect(mockIntake).toBe(saved); expect(mockBind).not.toHaveBeenCalled(); expect(mockClear).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  await act(async () => { await confirm('Sign out')(); });
  expect(mockBind).toHaveBeenCalledWith(null); expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)/owner');
});

it('deduplicates logout prompts and rejects a previous owner’s confirmation after an account switch', async () => {
  const screen = render(<OwnerMe />);
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' })); fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  const stale = confirm('Sign out');
  mockAuth = { ...mockAuth, userId: 'owner-b', sessionId: 'session-b' };
  mockMe = { ...mockMe, owner: { ...mockMe.owner, _id: 'owner-record-b' } };
  await mockBind('owner-b'); screen.rerender(<OwnerMe />);
  await act(async () => { await stale(); });
  expect(mockSignOut).not.toHaveBeenCalled(); expect(mockBind).not.toHaveBeenCalledWith(null);
});

it('does not clear or navigate the next account when an old logout finishes late', async () => {
  let finish!: () => void;
  mockSignOut.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  const screen = render(<OwnerMe />);
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  let logout!: Promise<void>;
  act(() => { logout = confirm('Sign out')() as unknown as Promise<void>; });
  mockAuth = { ...mockAuth, userId: 'owner-b' }; await mockBind('owner-b'); screen.rerender(<OwnerMe />);
  await act(async () => { finish(); await logout; });
  expect(mockBind).not.toHaveBeenCalledWith(null); expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('opens the selected owned site at its latest phase rather than the captured row’s old phase', () => {
  const screen = render(<Inbox />);
  const open = rowAction(screen, 'Juan Store');
  mockMe = { ...mockMe, sites: [{ ...mockMe.sites[0], phase: 'ready_to_check' }] };
  screen.rerender(<Inbox />); act(() => open());
  expect(mockSet).toHaveBeenCalledWith({ submissionId: 'site-a' });
  expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/check');
});

it.each(['removed site', 'changed actor', 'changed scope'])('rejects a stale Inbox action after %s', (change) => {
  const screen = render(<Inbox />);
  const open = rowAction(screen, 'Juan Store');
  if (change === 'removed site') mockMe = { ...mockMe, sites: [] };
  if (change === 'changed actor') mockAuth = { ...mockAuth, userId: 'owner-b' };
  if (change === 'changed scope') mockScope += 1;
  screen.rerender(<Inbox />); act(() => open());
  expect(mockSet).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
});
