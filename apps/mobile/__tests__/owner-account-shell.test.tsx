import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import OwnerLayout from '../app/(owner)/_layout';
import OwnerMe from '../app/(owner)/(tabs)/me';
import Inbox from '../app/(owner)/me/inbox';
import { Button } from '../components/v2';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockEnsure = jest.fn();
const mockSignOut = jest.fn();
const mockBind = jest.fn();
const mockMigrate = jest.fn();
const mockSet = jest.fn();
const mockSelectBusiness = jest.fn();
const mockBeginBusiness = jest.fn();
const mockConfirmBusiness = jest.fn();
const mockClear = jest.fn();
const mockResume = jest.fn();
const mockOwnerQuery = jest.fn();
const mockStackUnmount = jest.fn();
const mockStackMount = jest.fn();
const mockPushMutation = jest.fn(), mockUnregisterPush = jest.fn(), mockMarkRead = jest.fn(), mockMarkAllRead = jest.fn();
let mockAuth: any;
let mockMobile: any;
let mockMe: any;
let mockScope: number;
let mockActor: string | null;
let mockIntake: any;
let mockAwaitingBusiness: string | undefined;
let mockInboxItems: any[];
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => mockAuth, useClerk: () => ({ signOut: mockSignOut }) }));
jest.mock('convex/react', () => ({ useMutation: () => mockPushMutation }));
jest.mock('../components/v2/owner/OwnerNotificationBridge', () => ({ OwnerNotificationBridge: () => null,
  ownerDeviceToken: async () => null, unregisterOwnerPush: (...args: unknown[]) => mockUnregisterPush(...args),
}));
jest.mock('../lib/v2/ownerInbox', () => ({ useOwnerInbox: (ownerId: string) => ({ ownerId, actorClerkId: mockAuth.userId,
  items: mockInboxItems, unreadCount: mockInboxItems.filter(item => !item.read).length }),
  useOwnerInboxActions: () => ({ markRead: mockMarkRead, markAllRead: mockMarkAllRead }),
}));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => mockMobile }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
jest.mock('../lib/v2/ownerData', () => ({
  WEB_ORIGIN: 'https://tendso.test', useOwnerMe: () => { mockOwnerQuery(); return mockMe; },
  useEnsureOwner: () => mockEnsure, useOwnerSubmission: (id: string | null) => id ? { submissionId: id } : undefined,
}));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => {
  const selected = mockMe?.sites.find((item: any) => item.submissionId === mockIntake.submissionId);
  const pending = !!mockIntake.submissionId && mockAwaitingBusiness === mockIntake.submissionId;
  const site = mockIntake.newBusiness || (pending && !selected) ? null : selected ?? mockMe?.sites[0] ?? null;
  return { me: mockMe, site, id: site?.submissionId ?? null, isNewBusiness: mockIntake.newBusiness === true };
} }));
jest.mock('../lib/v2/ownerUploads', () => ({ useOwnerUploads: () => ({ resume: mockResume }) }));
jest.mock('../lib/v2/ownerIntake', () => ({
  ownerIntake: {
    bindActor: (...args: unknown[]) => mockBind(...args), migrateLegacy: (...args: unknown[]) => mockMigrate(...args),
    scope: () => mockScope, isCurrent: (scope: number) => scope === mockScope,
    get: () => mockIntake, set: (...args: unknown[]) => mockSet(...args), clear: () => mockClear(),
    selectBusiness: (...args: unknown[]) => mockSelectBusiness(...args), beginBusiness: () => mockBeginBusiness(),
    isAwaitingBusiness: (id: string | undefined) => !!id && mockAwaitingBusiness === id,
    confirmBusiness: (...args: unknown[]) => mockConfirmBusiness(...args),
  }, useOwnerIntake: () => mockIntake,
}));
jest.mock('../components/CreatorAttributionGate', () => ({ CreatorAttributionGate: () => null }));
jest.mock('../components/v2/owner/OwnerDraftRecovery', () => ({ OwnerDraftRecovery: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('expo-router', () => {
  const { createElement: makeElement, useEffect } = require('react'); const { View, Text } = require('react-native');
  const Stack = ({ children }: any) => {
    useEffect(() => { mockStackMount(mockIntake.submissionId); return () => mockStackUnmount(); }, []);
    return makeElement(View, { testID: 'owner-stack' }, children);
  };
  Stack.Screen = () => null;
  return { Stack, useLocalSearchParams: () => ({}), Redirect: ({ href }: any) => makeElement(Text, { testID: 'owner-redirect' }, href) };
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
async function notificationAction(screen: ReturnType<typeof render>, title: string) {
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: `Unread: ${title}` })); });
  return screen.UNSAFE_getAllByType(Button).find(node => node.props.title === 'Open business')!.props.onPress;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { isLoaded: true, isSignedIn: true, userId: 'owner-a', sessionId: 'session-a', signOut: mockSignOut };
  mockMobile = { isLoading: false, isOffline: false, account: null, role: null };
  mockScope = 1; mockActor = 'owner-a'; mockIntake = { ownerName: 'Juan', submissionId: 'site-a' };
  mockAwaitingBusiness = undefined;
  mockMe = meFixture();
  mockInboxItems = [{ key: 'site:site-a', type: 'website_ready', title: 'Juan Store update', body: 'Your business has an update.', createdAt: 1, read: false, submissionId: 'site-a' }];
  mockPushMutation.mockReset().mockResolvedValue(undefined); mockUnregisterPush.mockReset().mockResolvedValue(undefined);
  mockMarkRead.mockReset().mockResolvedValue(undefined); mockMarkAllRead.mockReset().mockResolvedValue(undefined);
  mockSet.mockReset().mockImplementation((patch: any) => {
    if (patch.submissionId && mockIntake.submissionId && patch.submissionId !== mockIntake.submissionId) mockScope += 1;
    mockIntake = { ...mockIntake, ...patch };
  });
  mockSelectBusiness.mockReset().mockImplementation((id: string) => {
    mockAwaitingBusiness = undefined;
    mockSet({ submissionId: id });
    mockIntake.newBusiness = undefined;
  });
  mockBeginBusiness.mockReset().mockImplementation(() => {
    if (mockIntake.newBusiness) return;
    mockIntake = { ownerName: mockIntake.ownerName, newBusiness: true, newBusinessKey: 'stable-new-workspace' };
    mockAwaitingBusiness = undefined;
    mockScope += 1;
  });
  mockConfirmBusiness.mockReset().mockImplementation((id: string) => {
    if (mockAwaitingBusiness === id) mockAwaitingBusiness = undefined;
  });
  mockEnsure.mockReset().mockResolvedValue({ ownerId: 'owner-record-a' });
  mockSignOut.mockReset().mockResolvedValue(undefined);
  mockMigrate.mockReset().mockResolvedValue(undefined);
  mockResume.mockReset().mockResolvedValue(undefined);
  mockBind.mockReset().mockImplementation(async (actor: string | null) => {
    if (actor !== mockActor) { mockActor = actor; mockScope += 1; mockIntake = actor ? { ownerName: 'Juan' } : {}; mockAwaitingBusiness = undefined; }
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

it('keeps a persisted new-business workspace even when the account already owns websites', async () => {
  mockIntake = { ownerName: 'Juan', newBusiness: true, newBusinessKey: 'saved-new-workspace', kind: 'food', businessName: 'Second shop' };
  const saved = mockIntake;
  const screen = render(<OwnerLayout />);
  await screen.findByTestId('owner-stack');
  expect(mockIntake).toBe(saved);
  expect(mockSelectBusiness).not.toHaveBeenCalled();
  expect(mockBeginBusiness).not.toHaveBeenCalled();
  expect(mockMigrate).not.toHaveBeenCalled();
  expect(mockResume).not.toHaveBeenCalled();
});

it('initializes a first-time owner’s new workspace before mounting the stack', async () => {
  mockIntake = { ownerName: 'Juan' };
  mockMe = { ...mockMe, sites: [] };
  const screen = render(<OwnerLayout />);
  await screen.findByTestId('owner-stack');
  expect(mockIntake).toEqual({ ownerName: 'Juan', newBusiness: true, newBusinessKey: 'stable-new-workspace' });
  expect(mockBeginBusiness).toHaveBeenCalledTimes(1);
  expect(mockBeginBusiness.mock.invocationCallOrder[0]).toBeLessThan(mockStackMount.mock.invocationCallOrder[0]);
  expect(mockSelectBusiness).not.toHaveBeenCalled();
  expect(mockResume).not.toHaveBeenCalled();
});

it('keeps a newly created pending business selected until the owned-site query acknowledges it', async () => {
  mockIntake = { ownerName: 'Juan', submissionId: 'newly-created-site' };
  mockAwaitingBusiness = 'newly-created-site';
  const screen = render(<OwnerLayout />);
  await screen.findByTestId('owner-stack');
  expect(mockIntake.submissionId).toBe('newly-created-site');
  expect(mockSelectBusiness).not.toHaveBeenCalled();
  expect(mockConfirmBusiness).not.toHaveBeenCalled();
  expect(mockResume).not.toHaveBeenCalled();
  mockMe = { ...mockMe, sites: [{ ...mockMe.sites[0], submissionId: 'newly-created-site' }, ...mockMe.sites] };
  screen.rerender(<OwnerLayout />);
  await waitFor(() => expect(mockConfirmBusiness).toHaveBeenCalledWith('newly-created-site'));
  expect(mockAwaitingBusiness).toBeUndefined();
  expect(mockIntake.submissionId).toBe('newly-created-site');
  expect(mockSelectBusiness).not.toHaveBeenCalled();
  expect(mockResume).toHaveBeenCalledWith('newly-created-site', { submissionId: 'newly-created-site' });
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
  expect(screen.queryByText('Old owner failure')).toBeNull(); expect(mockBind).toHaveBeenCalledWith('owner-b', 'session-b');
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
  await act(async () => { logout = confirm('Sign out')() as unknown as Promise<void>; await flush(); });
  mockAuth = { ...mockAuth, userId: 'owner-b' }; await mockBind('owner-b'); screen.rerender(<OwnerMe />);
  await act(async () => { finish(); await logout; });
  expect(mockBind).not.toHaveBeenCalledWith(null); expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('opens a notification’s owned site at its latest phase rather than the captured notification’s old phase', async () => {
  const screen = render(<Inbox />);
  const open = await notificationAction(screen, 'Juan Store update');
  mockMe = { ...mockMe, sites: [{ ...mockMe.sites[0], phase: 'ready_to_check' }] };
  screen.rerender(<Inbox />); act(() => open());
  expect(mockSet).toHaveBeenCalledWith({ submissionId: 'site-a' });
  expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/check');
});

it.each(['removed site', 'changed actor'])('rejects a stale notification action after %s', async (change) => {
  const screen = render(<Inbox />);
  const open = await notificationAction(screen, 'Juan Store update');
  if (change === 'removed site') mockMe = { ...mockMe, sites: [] };
  if (change === 'changed actor') mockAuth = { ...mockAuth, userId: 'owner-b' };
  screen.rerender(<Inbox />); act(() => open());
  expect(mockSet).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
});

it('opens an owned notification business after only the selected intake scope changes', async () => {
  const screen = render(<Inbox />); const open = await notificationAction(screen, 'Juan Store update');
  mockScope += 1; mockIntake = { ...mockIntake, submissionId: 'another-selected-site' };
  mockMe = { ...mockMe, sites: [{ ...mockMe.sites[0], phase: 'ready_to_check' }] };
  screen.rerender(<Inbox />); act(() => open());
  expect(mockSelectBusiness).toHaveBeenCalledWith('site-a'); expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/check');
});

it('does not start Clerk logout for the next account if push cleanup completes after an account switch', async () => {
  let finish!: () => void;
  mockUnregisterPush.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const screen = render(<OwnerMe />); fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  let logout!: Promise<void>;
  act(() => { logout = confirm('Sign out')() as unknown as Promise<void>; });
  mockAuth = { ...mockAuth, userId: 'owner-b', sessionId: 'session-b' };
  mockMe = { ...mockMe, owner: { ...mockMe.owner, _id: 'owner-record-b' } }; await mockBind('owner-b'); screen.rerender(<OwnerMe />);
  await act(async () => { finish(); await logout; });
  expect(mockSignOut).not.toHaveBeenCalled(); expect(mockBind).not.toHaveBeenCalledWith(null); expect(mockRouter.replace).not.toHaveBeenCalled();
});
