import React from 'react';
import { Alert, Keyboard, Platform, ScrollView, type KeyboardEvent, type KeyboardEventName } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import NativeAdminLayout from '../../app/(app)/admin/_layout';
import Overview from '../../app/(app)/admin';
import Reviews from '../../app/(app)/admin/reviews';
import Accounts from '../../app/(app)/admin/accounts';
import Payouts from '../../app/(app)/admin/payouts';
import Submission from '../../app/(app)/admin/submissions/[id]';

let mockSession: Record<string, unknown>;
let mockData: Record<string, unknown>;
const mockQuery = jest.fn();
const mockMutation = jest.fn();
const mockAction = jest.fn();
const mockOpen = jest.fn();
const mockSignOut = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() };
jest.mock('@clerk/clerk-expo', () => ({ useClerk: () => ({ signOut: mockSignOut }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../hooks/useMobileAccount', () => ({ useMobileAccount: () => mockSession }));
jest.mock('../../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../../hooks/usePushNotifications', () => ({ usePushNotifications: jest.fn() }));
jest.mock('../../services/links', () => ({ SITE_URL: 'https://www.tendso.com', openExternalUrl: (...args: unknown[]) => mockOpen(...args) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('expo-router', () => {
  const create = require('react').createElement;
  const { Text, View } = require('react-native');
  const Stack = Object.assign(
    ({ children, screenOptions }: { children?: React.ReactNode; screenOptions?: unknown }) => create(View, { testID: 'admin-stack', screenOptions }, children),
    { Screen: ({ name, options }: { name: string; options?: unknown }) => create(View, { testID: `admin-stack-screen-${name}`, options }) },
  );
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({ id: 'submission-1' }),
    Redirect: ({ href }: { href: string }) => create(Text, { testID: 'redirect' }, href),
    Stack,
  };
});
jest.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockQuery(...args),
  useMutation: (name: string) => (args: unknown) => mockMutation(name, args),
  useAction: (name: string) => (args: unknown) => mockAction(name, args),
}));
jest.mock('@tendso/convex-client', () => ({ api: {
  admin: { getDashboardStats: 'admin:getDashboardStats', approveSubmission: 'admin:approveSubmission', rejectSubmission: 'admin:rejectSubmission' },
  submissions: { getByStatus: 'submissions:getByStatus', getByIdWithCreator: 'submissions:getByIdWithCreator' },
  creators: { getAll: 'creators:getAll', listPendingApproval: 'creators:listPendingApproval', approveCreator: 'creators:approveCreator', rejectCreator: 'creators:rejectCreator', updateStatus: 'creators:updateStatus' },
  affiliates: { list: 'affiliates:list' },
  withdrawals: { getAll: 'withdrawals:getAll', refreshFromWise: 'withdrawals:refreshFromWise' },
} }));

const admin = { _id: 'admin-1', clerkId: 'clerk-admin', role: 'admin', status: 'active', email: 'admin@example.test' };
const creator = { _id: 'creator-1', clerkId: 'clerk-creator', role: 'creator', status: 'active', firstName: 'Ana', lastName: 'Reyes', email: 'ana@example.test' };
const affiliate = { ...creator, _id: 'affiliate-1', role: 'affiliate', affiliateHandle: 'ana', firstName: 'Bea' };
const submission = { _id: 'submission-1', creatorId: creator._id, businessName: 'Ana’s shop', status: 'submitted', address: 'Main Street', city: 'Manila', ownerName: 'Ana', ownerPhone: '09171234567', transcript: 'Owner interview', photos: [], creator };
function ready() { return { account: admin, isLoading: false, isAuthenticated: true, isOffline: false, isAdmin: true, view: 'admin', isPreview: false }; }
function acceptAlert() {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const buttons = calls[calls.length - 1][2];
  return buttons[1].onPress();
}

function watchKeyboard(initiallyVisible = false) {
  const subscriptions: { event: KeyboardEventName; listener: (event: KeyboardEvent) => void; remove: jest.Mock; active: boolean }[] = [];
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(initiallyVisible);
  jest.spyOn(Keyboard, 'scheduleLayoutAnimation').mockImplementation(() => {});
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
    const subscription = { event, listener, active: true, remove: jest.fn() };
    subscription.remove.mockImplementation(() => { subscription.active = false; });
    subscriptions.push(subscription);
    return subscription as ReturnType<typeof Keyboard.addListener>;
  });
  const event: KeyboardEvent = { duration: 250, easing: 'keyboard', endCoordinates: { screenX: 0, screenY: 544, width: 390, height: 300 } };
  return {
    subscriptions,
    emit: (name: KeyboardEventName) => act(() => {
      subscriptions.filter(subscription => subscription.active && subscription.event === name).forEach(subscription => subscription.listener(event));
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  mockSession = ready();
  mockData = {
    'admin:getDashboardStats': { pendingReview: 1, totalCreators: 2, activeCreators: 1, totalSubmissions: 3 },
    'creators:getAll': [creator], 'creators:listPendingApproval': [{ ...creator, quizPassedAt: 1 }],
    'affiliates:list': [affiliate], 'submissions:getByIdWithCreator': submission, 'withdrawals:getAll': [],
  };
  mockQuery.mockImplementation((name, args) => args === 'skip' ? undefined : name === 'submissions:getByStatus' ? [] : mockData[name]);
  mockMutation.mockResolvedValue('ok');
  mockAction.mockResolvedValue({ refreshed: true });
  mockSignOut.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('native admin deep-link boundary', () => {
  it('renders only the stack for a verified active admin', () => {
    expect(render(<NativeAdminLayout />).getByTestId('admin-stack')).toBeTruthy();
  });
  it.each([
    { isLoading: true }, { isOffline: true }, { isAuthenticated: false }, { isAdmin: false },
    { account: { ...admin, role: 'creator' } }, { account: { ...admin, role: 'affiliate' } },
    { account: { ...admin, role: 'staff' } }, { account: { ...admin, status: 'suspended' } },
    { account: { ...admin, status: 'deleted' } }, { account: { ...admin, isDeleted: true } },
  ])('does not mount admin routes for unavailable/unauthorized state %#', change => {
    mockSession = { ...ready(), ...change };
    expect(render(<NativeAdminLayout />).queryByTestId('admin-stack')).toBeNull();
  });
  it('redirects an affiliate deep link to affiliate home', () => {
    mockSession = { ...ready(), account: affiliate, isAdmin: false };
    expect(render(<NativeAdminLayout />).getByTestId('redirect').props.children).toBe('/(app)/(affiliate-tabs)');
  });
  it('immediately removes admin routes after live suspension', () => {
    const screen = render(<NativeAdminLayout />);
    mockSession = { ...ready(), account: { ...admin, status: 'suspended' } };
    screen.rerender(<NativeAdminLayout />);
    expect(screen.queryByTestId('admin-stack')).toBeNull();
  });
});

describe('private query gating', () => {
  it.each([Overview, Reviews, Accounts, Payouts, Submission])('%p skips all private queries while offline', Screen => {
    mockSession = { ...ready(), isOffline: true };
    render(<Screen />);
    expect(mockQuery).toHaveBeenCalled();
    expect(mockQuery.mock.calls.every(([, args]) => args === 'skip')).toBe(true);
  });
  it.each([
    { isLoading: true }, { isAuthenticated: false }, { isAdmin: false },
    { account: { ...admin, role: 'affiliate' } }, { account: { ...admin, role: 'creator' } },
    { account: { ...admin, role: 'staff' } }, { account: { ...admin, isDeleted: true } },
  ])('skips private queries for invalid session %#', change => {
    mockSession = { ...ready(), ...change };
    render(<Overview />);
    expect(mockQuery).toHaveBeenCalledWith('admin:getDashboardStats', 'skip');
  });
  it('uses actual admin permissions regardless of preview selection', () => {
    mockSession = { ...ready(), view: 'affiliate', isPreview: true };
    render(<Overview />);
    expect(mockQuery).toHaveBeenCalledWith('admin:getDashboardStats', {});
  });
});

describe('native admin navigation', () => {
  it.each(['ios', 'android'] as const)('changes sections without stack animation and keeps normal submission navigation on %s', platform => {
    jest.replaceProperty(Platform, 'OS', platform);
    const screen = render(<NativeAdminLayout />);
    expect(screen.getByTestId('admin-stack').props.screenOptions).toEqual(expect.objectContaining({
      headerShown: false, animation: 'none', gestureEnabled: false,
    }));
    expect(screen.getByTestId('admin-stack-screen-submissions/[id]').props.options).toEqual(expect.objectContaining({
      animation: platform === 'ios' ? 'default' : 'slide_from_right', gestureEnabled: true,
    }));
  });

  it('opens the review queue from the overview primary action', () => {
    const screen = render(<Overview />);
    fireEvent.press(screen.getByLabelText('Open reviews'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/admin/reviews');
    expect(mockMutation).not.toHaveBeenCalled();
  });

  it.each([
    { Screen: Overview, selected: 'Overview' },
    { Screen: Reviews, selected: 'Reviews' },
    { Screen: Accounts, selected: 'Accounts' },
    { Screen: Payouts, selected: 'Payouts' },
  ])('marks only $selected as the current section and ignores its repeated press', ({ Screen, selected }) => {
    const screen = render(<Screen />);
    for (const label of ['Overview', 'Reviews', 'Accounts', 'Payouts']) {
      expect(screen.getByLabelText(`${label} tab`).props.accessibilityState.selected).toBe(label === selected);
    }
    fireEvent.press(screen.getByLabelText(`${selected} tab`));
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'Reviews', route: '/(app)/admin/reviews' },
    { label: 'Accounts', route: '/(app)/admin/accounts' },
    { label: 'Payouts', route: '/(app)/admin/payouts' },
  ])('replaces the current section with $label without growing the back stack', ({ label, route }) => {
    const screen = render(<Overview />);
    fireEvent.press(screen.getByLabelText(`${label} tab`));
    expect(mockRouter.replace).toHaveBeenCalledWith(route);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockMutation).not.toHaveBeenCalled();
    expect(mockAction).not.toHaveBeenCalled();
  });

  it('opens the selected submission and returns to its reviews section', () => {
    mockQuery.mockImplementation((name, args) => {
      if (args === 'skip') return undefined;
      if (name === 'submissions:getByStatus') return args.status === 'submitted' ? [submission] : [];
      return mockData[name];
    });
    const reviews = render(<Reviews />);
    fireEvent.press(reviews.getByLabelText(`Review ${submission.businessName}`));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/admin/submissions/[id]', params: { id: 'submission-1' } });
    reviews.unmount();
    const detail = render(<Submission />);
    expect(detail.getByLabelText('Reviews tab').props.accessibilityState.selected).toBe(true);
    fireEvent.press(detail.getByLabelText('Back to reviews'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/admin/reviews');
    expect(mockMutation).not.toHaveBeenCalled();
  });
});

describe('native admin loading', () => {
  it('keeps Overview selected and lets an authorized admin change sections while its data loads', () => {
    mockData['admin:getDashboardStats'] = undefined;
    const screen = render(<Overview />);
    expect(screen.getByLabelText('Loading admin data')).toBeTruthy();
    for (const label of ['Overview', 'Reviews', 'Accounts', 'Payouts']) {
      expect(screen.getByLabelText(`${label} tab`).props.accessibilityState.selected).toBe(label === 'Overview');
    }
    fireEvent.press(screen.getByLabelText('Accounts tab'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/admin/accounts');
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockMutation).not.toHaveBeenCalled();
    expect(mockAction).not.toHaveBeenCalled();
  });

  it('replaces loading with real metrics without showing an invented zero or removing navigation', () => {
    mockData['admin:getDashboardStats'] = undefined;
    const screen = render(<Overview />);
    expect(screen.getByLabelText('Loading admin data')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('Total submissions')).toBeNull();
    expect(screen.queryByText('submissions waiting for review')).toBeNull();
    mockData['admin:getDashboardStats'] = { pendingReview: 0, totalCreators: 84, activeCreators: 62, totalSubmissions: 135 };
    screen.rerender(<Overview />);
    expect(screen.queryByLabelText('Loading admin data')).toBeNull();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('135')).toBeTruthy();
    expect(screen.getByText('84')).toBeTruthy();
    expect(screen.getByText('62 active')).toBeTruthy();
    expect(screen.getByText('Total submissions')).toBeTruthy();
    for (const label of ['Overview', 'Reviews', 'Accounts', 'Payouts']) {
      expect(screen.getByLabelText(`${label} tab`).props.accessibilityState.selected).toBe(label === 'Overview');
    }
    expect(mockMutation).not.toHaveBeenCalled();
    expect(mockAction).not.toHaveBeenCalled();
  });

  it.each([
    { Screen: Reviews, selected: 'Reviews' },
    { Screen: Accounts, selected: 'Accounts' },
    { Screen: Payouts, selected: 'Payouts' },
    { Screen: Submission, selected: 'Reviews' },
  ])('retains all navigation while $selected content is loading', ({ Screen, selected }) => {
    mockQuery.mockReturnValue(undefined);
    const screen = render(<Screen />);
    expect(screen.getByLabelText('Loading admin data')).toBeTruthy();
    for (const label of ['Overview', 'Reviews', 'Accounts', 'Payouts']) {
      expect(screen.getByLabelText(`${label} tab`).props.accessibilityState.selected).toBe(label === selected);
    }
    expect(mockMutation).not.toHaveBeenCalled();
    expect(mockAction).not.toHaveBeenCalled();
  });

  it('keeps navigation and private data unavailable until the admin session is verified', () => {
    mockSession = { ...ready(), account: undefined, isLoading: true };
    const screen = render(<Overview />);
    expect(screen.getByLabelText('Loading admin data')).toBeTruthy();
    for (const label of ['Overview', 'Reviews', 'Accounts', 'Payouts']) {
      expect(screen.queryByLabelText(`${label} tab`)).toBeNull();
    }
    expect(mockQuery).toHaveBeenCalledWith('admin:getDashboardStats', 'skip');
    expect(screen.queryByText('Total submissions')).toBeNull();
    expect(mockMutation).not.toHaveBeenCalled();
    expect(mockAction).not.toHaveBeenCalled();
  });
});

describe('native admin keyboard', () => {
  it.each([
    { platform: 'ios', show: 'keyboardWillShow', hide: 'keyboardWillHide', dismissMode: 'interactive' },
    { platform: 'android', show: 'keyboardDidShow', hide: 'keyboardDidHide', dismissMode: 'on-drag' },
  ] as const)('gives the form space on $platform and restores navigation without losing search', ({ platform, show, hide, dismissMode }) => {
    jest.replaceProperty(Platform, 'OS', platform);
    const keyboard = watchKeyboard();
    const screen = render(<Accounts />);
    const searchLabel = 'Search name, email, mobile or handle';
    fireEvent.changeText(screen.getByLabelText(searchLabel), 'Ana');
    expect(screen.getByLabelText('Accounts tab').props.accessibilityState.selected).toBe(true);
    keyboard.emit(show);
    for (const label of ['Overview', 'Reviews', 'Accounts', 'Payouts']) expect(screen.queryByLabelText(`${label} tab`)).toBeNull();
    expect(screen.getByLabelText(searchLabel).props.value).toBe('Ana');
    const scrollView = screen.UNSAFE_getByType(ScrollView);
    expect(scrollView.props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(scrollView.props.keyboardDismissMode).toBe(dismissMode);
    keyboard.emit(hide);
    expect(screen.getByLabelText('Accounts tab').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText(searchLabel).props.value).toBe('Ana');
    expect(mockMutation).not.toHaveBeenCalled();
    expect(mockAction).not.toHaveBeenCalled();
  });

  it('keeps rejection validation and its draft through did-show and did-hide events', () => {
    const keyboard = watchKeyboard();
    mockData['submissions:getByIdWithCreator'] = { ...submission, giveawayApplication: true };
    const screen = render(<Submission />);
    keyboard.emit('keyboardDidShow');
    expect(screen.queryByLabelText('Reviews tab')).toBeNull();
    expect(screen.getByLabelText('Reject submission').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByLabelText('Reject submission'));
    expect(Alert.alert).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Rejection reason'), 'Poster missing');
    expect(screen.getByLabelText('Reject submission').props.accessibilityState.disabled).toBe(false);
    keyboard.emit('keyboardDidHide');
    expect(screen.getByLabelText('Reviews tab').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Rejection reason').props.value).toBe('Poster missing');
    expect(screen.getByLabelText('Reject submission').props.accessibilityState.disabled).toBe(false);
    expect(mockMutation).not.toHaveBeenCalled();
  });

  it('starts with navigation hidden when mounted with the keyboard already open', () => {
    const keyboard = watchKeyboard(true);
    const screen = render(<Accounts />);
    expect(screen.getByLabelText('Search name, email, mobile or handle')).toBeTruthy();
    expect(screen.queryByLabelText('Accounts tab')).toBeNull();
    keyboard.emit('keyboardDidHide');
    expect(screen.getByLabelText('Accounts tab').props.accessibilityState.selected).toBe(true);
  });

  it('removes its keyboard subscriptions on unmount', () => {
    const keyboard = watchKeyboard();
    const screen = render(<Accounts />);
    expect(keyboard.subscriptions.length).toBeGreaterThan(0);
    screen.unmount();
    keyboard.subscriptions.forEach(subscription => expect(subscription.remove).toHaveBeenCalledTimes(1));
  });

  it('dismisses a single-line search with Done and leaves multiline rejection input available for new lines', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    const accounts = render(<Accounts />);
    const search = accounts.getByLabelText('Search name, email, mobile or handle');
    expect(search.props.returnKeyType).toBe('done');
    fireEvent(search, 'submitEditing');
    expect(dismiss).toHaveBeenCalledTimes(1);
    accounts.unmount();
    const detail = render(<Submission />);
    const rejection = detail.getByLabelText('Rejection reason');
    expect(rejection.props.multiline).toBe(true);
    expect(rejection.props.onSubmitEditing).toBeUndefined();
  });
});

describe('native admin actions', () => {
  it('confirms submission approval and binds actor to live Clerk identity', async () => {
    const screen = render(<Submission />);
    fireEvent.press(screen.getByLabelText('Approve submission'));
    expect(mockMutation).not.toHaveBeenCalled();
    act(() => { acceptAlert(); });
    await waitFor(() => expect(mockMutation).toHaveBeenCalledWith('admin:approveSubmission', { submissionId: 'submission-1', adminId: 'clerk-admin' }));
  });
  it('requires and trims a giveaway rejection reason', async () => {
    mockData['submissions:getByIdWithCreator'] = { ...submission, giveawayApplication: true };
    const screen = render(<Submission />);
    expect(screen.getByLabelText('Reject submission').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText('Rejection reason'), '  Poster missing  ');
    fireEvent.press(screen.getByLabelText('Reject submission'));
    expect(Alert.alert).toHaveBeenCalledWith('Reject submission?', expect.stringContaining('held giveaway slot'), expect.any(Array));
    act(() => { acceptAlert(); });
    await waitFor(() => expect(mockMutation).toHaveBeenCalledWith('admin:rejectSubmission', { submissionId: 'submission-1', adminId: 'clerk-admin', reason: 'Poster missing' }));
  });
  it('does not run a stale confirmation after live role loss', async () => {
    const screen = render(<Submission />);
    fireEvent.press(screen.getByLabelText('Approve submission'));
    mockSession = { ...ready(), account: affiliate, isAdmin: false };
    screen.rerender(<Submission />);
    act(() => { acceptAlert(); });
    expect(mockMutation).not.toHaveBeenCalled();
  });
  it('does not run a confirmation after its screen is unmounted', () => {
    const screen = render(<Submission />);
    fireEvent.press(screen.getByLabelText('Approve submission'));
    screen.unmount();
    act(() => { acceptAlert(); });
    expect(mockMutation).not.toHaveBeenCalled();
  });
  it('does not carry a confirmation into another administrator’s session', () => {
    const screen = render(<Submission />);
    fireEvent.press(screen.getByLabelText('Approve submission'));
    mockSession = { ...ready(), account: { ...admin, _id: 'admin-2', clerkId: 'another-admin' } };
    screen.rerender(<Submission />);
    act(() => { acceptAlert(); });
    expect(mockMutation).not.toHaveBeenCalled();
  });
  it('does not overwrite a review that leaves the pending queue while confirmation is open', () => {
    const screen = render(<Submission />);
    fireEvent.press(screen.getByLabelText('Approve submission'));
    mockData['submissions:getByIdWithCreator'] = { ...submission, status: 'rejected' };
    screen.rerender(<Submission />);
    act(() => { acceptAlert(); });
    expect(mockMutation).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Approve submission')).toBeNull();
  });
  it('shows mutation failures and keeps the review available', async () => {
    mockMutation.mockRejectedValueOnce(new Error('Review failed'));
    const screen = render(<Submission />);
    fireEvent.press(screen.getByLabelText('Approve submission'));
    act(() => { acceptAlert(); });
    expect(await screen.findByText('Review failed')).toBeTruthy();
    expect(screen.getByLabelText('Approve submission')).toBeTruthy();
  });
  it('approves creators with their creators id and no supplied actor', async () => {
    const screen = render(<Reviews />);
    fireEvent.press(screen.getByLabelText('Field agents'));
    fireEvent.press(screen.getByLabelText('Approve Ana Reyes'));
    act(() => { acceptAlert(); });
    await waitFor(() => expect(mockMutation).toHaveBeenCalledWith('creators:approveCreator', { id: 'creator-1' }));
  });
  it('rejects a creator with their own trimmed reason', async () => {
    const screen = render(<Reviews />);
    fireEvent.press(screen.getByLabelText('Field agents'));
    fireEvent.changeText(screen.getByLabelText('Rejection reason for Ana Reyes (optional)'), '  Please confirm your name  ');
    fireEvent.press(screen.getByLabelText('Reject Ana Reyes'));
    act(() => { acceptAlert(); });
    await waitFor(() => expect(mockMutation).toHaveBeenCalledWith('creators:rejectCreator', { id: 'creator-1', reason: 'Please confirm your name' }));
  });
  it('keeps affiliate suspension on the same account type', async () => {
    const screen = render(<Accounts />);
    fireEvent.press(screen.getByLabelText('Creators'));
    expect(mockQuery).toHaveBeenCalledWith('affiliates:list', {});
    fireEvent.press(screen.getByLabelText('Suspend Bea Reyes'));
    act(() => { acceptAlert(); });
    await waitFor(() => expect(mockMutation).toHaveBeenCalledWith('creators:updateStatus', { id: 'affiliate-1', status: 'suspended' }));
    expect(mockMutation).toHaveBeenCalledTimes(1);
  });
  it('lists pending affiliates first and confirms approval with only their id and active status', async () => {
    mockData['affiliates:list'] = [affiliate, { ...affiliate, _id: 'pending-affiliate', firstName: 'Pending', status: 'pending' }];
    const screen = render(<Accounts />);
    fireEvent.press(screen.getByLabelText('Creators'));
    expect(screen.getByText('Awaiting approval')).toBeTruthy();
    const labels = screen.getAllByRole('button').map(button => button.props.accessibilityLabel);
    expect(labels.indexOf('Approve Pending Reyes')).toBeLessThan(labels.indexOf('Suspend Bea Reyes'));
    expect(screen.queryByLabelText('Suspend Pending Reyes')).toBeNull();
    fireEvent.press(screen.getByLabelText('Approve Pending Reyes'));
    expect(Alert.alert).toHaveBeenCalledWith('Approve affiliate?', expect.stringContaining('share their affiliate page'), expect.any(Array));
    expect(mockMutation).not.toHaveBeenCalled();
    act(() => { acceptAlert(); });
    await waitFor(() => expect(mockMutation).toHaveBeenCalledWith('creators:updateStatus', { id: 'pending-affiliate', status: 'active' }));
    expect(mockMutation).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Affiliate approved.')).toBeTruthy();
  });
  it.each([
    { isAdmin: false }, { isAuthenticated: false }, { isOffline: true },
    { account: { ...admin, status: 'suspended' } },
    { account: { ...admin, role: 'affiliate' } },
    { account: { ...admin, _id: 'admin-2', clerkId: 'another-admin' } },
  ])('does not approve after live admin permission or identity changes %#', change => {
    mockData['affiliates:list'] = [{ ...affiliate, status: 'pending' }];
    const screen = render(<Accounts />);
    fireEvent.press(screen.getByLabelText('Creators'));
    fireEvent.press(screen.getByLabelText('Approve Bea Reyes'));
    mockSession = { ...ready(), ...change };
    screen.rerender(<Accounts />);
    act(() => { acceptAlert(); });
    expect(mockMutation).not.toHaveBeenCalled();
  });
  it('does not approve a target whose status changed while confirmation was open', () => {
    mockData['affiliates:list'] = [{ ...affiliate, status: 'pending' }];
    const screen = render(<Accounts />);
    fireEvent.press(screen.getByLabelText('Creators'));
    fireEvent.press(screen.getByLabelText('Approve Bea Reyes'));
    mockData['affiliates:list'] = [{ ...affiliate, status: 'suspended' }];
    screen.rerender(<Accounts />);
    act(() => { acceptAlert(); });
    expect(mockMutation).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Reactivate Bea Reyes')).toBeTruthy();
  });
  it('invalidates approval when leaving the affiliate account list', () => {
    mockData['affiliates:list'] = [{ ...affiliate, status: 'pending' }];
    const screen = render(<Accounts />);
    fireEvent.press(screen.getByLabelText('Creators'));
    fireEvent.press(screen.getByLabelText('Approve Bea Reyes'));
    fireEvent.press(screen.getByLabelText('Field agents'));
    act(() => { acceptAlert(); });
    expect(mockMutation).not.toHaveBeenCalled();
  });
  it('keeps pending approval available after an unsuccessful admin request', async () => {
    mockData['affiliates:list'] = [{ ...affiliate, status: 'pending' }];
    mockMutation.mockRejectedValueOnce(new Error('Approval failed'));
    const screen = render(<Accounts />);
    fireEvent.press(screen.getByLabelText('Creators'));
    fireEvent.press(screen.getByLabelText('Approve Bea Reyes'));
    act(() => { acceptAlert(); });
    expect(await screen.findByText('Approval failed')).toBeTruthy();
    expect(screen.getByLabelText('Approve Bea Reyes').props.accessibilityState.disabled).toBe(false);
  });
  it.each([undefined, 'reviewing', 'rejected'])('shows unknown affiliate status %s without status actions', status => {
    mockData['affiliates:list'] = [{ ...affiliate, status }];
    const screen = render(<Accounts />);
    fireEvent.press(screen.getByLabelText('Creators'));
    expect(screen.getByText(affiliate.email)).toBeTruthy();
    for (const verb of ['Approve', 'Suspend', 'Reactivate']) {
      expect(screen.queryByLabelText(`${verb} Bea Reyes`)).toBeNull();
    }
  });
  it('excludes team/deleted accounts from creator account controls', () => {
    mockData['creators:getAll'] = [creator, admin, { ...creator, _id: 'staff-1', role: 'staff' }, { ...creator, _id: 'deleted-1', isDeleted: true, firstName: 'Deleted' }];
    const screen = render(<Accounts />);
    expect(screen.getByLabelText('Suspend Ana Reyes')).toBeTruthy();
    expect(screen.queryByText('admin@example.test')).toBeNull();
    expect(screen.queryByText('Deleted Reyes')).toBeNull();
  });
  it('reactivates a suspended affiliate without changing role or certification', async () => {
    mockData['affiliates:list'] = [{ ...affiliate, status: 'suspended' }];
    const screen = render(<Accounts />);
    fireEvent.press(screen.getByLabelText('Creators'));
    fireEvent.press(screen.getByLabelText('Reactivate Bea Reyes'));
    act(() => { acceptAlert(); });
    await waitFor(() => expect(mockMutation).toHaveBeenCalledWith('creators:updateStatus', { id: 'affiliate-1', status: 'active' }));
  });
  it('can suspend a pending creator without certifying them', async () => {
    mockData['creators:getAll'] = [{ ...creator, status: 'pending' }];
    const screen = render(<Accounts />);
    fireEvent.press(screen.getByLabelText('Suspend Ana Reyes'));
    act(() => { acceptAlert(); });
    await waitFor(() => expect(mockMutation).toHaveBeenCalledWith('creators:updateStatus', { id: 'creator-1', status: 'suspended' }));
    expect(mockMutation).toHaveBeenCalledTimes(1);
  });
  it('checks Wise using the guarded read/reconcile action without manual settlement', async () => {
    mockData['withdrawals:getAll'] = [{ _id: 'withdrawal-1', amount: 500, status: 'processing', createdAt: 1, creatorName: 'Ana Reyes', wiseTransferId: '123' }];
    const screen = render(<Payouts />);
    fireEvent.press(screen.getByLabelText('Check Wise for ₱500.00'));
    await waitFor(() => expect(mockAction).toHaveBeenCalledWith('withdrawals:refreshFromWise', { withdrawalId: 'withdrawal-1', adminId: 'clerk-admin' }));
    expect(mockMutation).not.toHaveBeenCalled();
  });
  it('opens only the secure canonical web admin for advanced tools', async () => {
    const screen = render(<Overview />);
    fireEvent.press(screen.getByLabelText('Open web admin'));
    await waitFor(() => expect(mockOpen).toHaveBeenCalledWith('https://www.tendso.com/admin'));
  });
  it('lets an administrator sign out after confirmation without deleting their account', async () => {
    const screen = render(<Overview />);
    fireEvent.press(screen.getByLabelText('Sign out'));
    expect(mockSignOut).not.toHaveBeenCalled();
    act(() => { acceptAlert(); });
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockMutation).not.toHaveBeenCalled();
  });
});
