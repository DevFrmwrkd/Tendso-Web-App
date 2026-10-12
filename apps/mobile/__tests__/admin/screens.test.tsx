import React from 'react';
import { Alert } from 'react-native';
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
jest.mock('@clerk/clerk-expo', () => ({ useClerk: () => ({ signOut: mockSignOut }) }));
jest.mock('../../hooks/useMobileAccount', () => ({ useMobileAccount: () => mockSession }));
jest.mock('../../services/links', () => ({ SITE_URL: 'https://www.tendso.com', openExternalUrl: (...args: unknown[]) => mockOpen(...args) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('expo-router', () => {
  const create = require('react').createElement;
  const { Text } = require('react-native');
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    useLocalSearchParams: () => ({ id: 'submission-1' }),
    Redirect: ({ href }: { href: string }) => create(Text, { testID: 'redirect' }, href),
    Stack: () => create(Text, { testID: 'admin-stack' }, 'Admin stack'),
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
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
    expect(render(<NativeAdminLayout />).getByTestId('redirect').props.children).toBe('/(app)/(affiliate-tabs)/');
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
    fireEvent.press(screen.getByLabelText('Creator verification'));
    fireEvent.press(screen.getByLabelText('Approve Ana Reyes'));
    act(() => { acceptAlert(); });
    await waitFor(() => expect(mockMutation).toHaveBeenCalledWith('creators:approveCreator', { id: 'creator-1' }));
  });
  it('rejects a creator with their own trimmed reason', async () => {
    const screen = render(<Reviews />);
    fireEvent.press(screen.getByLabelText('Creator verification'));
    fireEvent.changeText(screen.getByLabelText('Rejection reason for Ana Reyes (optional)'), '  Please confirm your name  ');
    fireEvent.press(screen.getByLabelText('Reject Ana Reyes'));
    act(() => { acceptAlert(); });
    await waitFor(() => expect(mockMutation).toHaveBeenCalledWith('creators:rejectCreator', { id: 'creator-1', reason: 'Please confirm your name' }));
  });
  it('keeps affiliate suspension on the same account type', async () => {
    const screen = render(<Accounts />);
    fireEvent.press(screen.getByLabelText('Affiliates'));
    expect(mockQuery).toHaveBeenCalledWith('affiliates:list', {});
    fireEvent.press(screen.getByLabelText('Suspend Bea Reyes'));
    act(() => { acceptAlert(); });
    await waitFor(() => expect(mockMutation).toHaveBeenCalledWith('creators:updateStatus', { id: 'affiliate-1', status: 'suspended' }));
    expect(mockMutation).toHaveBeenCalledTimes(1);
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
    fireEvent.press(screen.getByLabelText('Affiliates'));
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
