import React from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useDeleteAccount } from '../hooks/useDeleteAccount';
import { PendingAffiliateApproval } from '../components/affiliate/PendingApproval';

const mockBackendDelete = jest.fn();
const mockLoginDelete = jest.fn();
const mockSignOut = jest.fn();
const mockUser = { id: 'own-user', delete: mockLoginDelete };
let mockClerkUser: typeof mockUser | null = mockUser;
let mockSessionId = 'own-session';
let mockAccount = {
  account: { _id: 'own-account', clerkId: 'own-user', role: 'affiliate', status: 'pending', isDeleted: false },
  isAuthenticated: true, isOffline: false, isLoading: false,
};
const mockClerk = {
  get user() { return mockClerkUser; },
  get session() { return { id: mockSessionId }; },
  signOut: mockSignOut,
};
jest.mock('@clerk/clerk-expo', () => ({
  useClerk: () => mockClerk,
  useUser: () => ({ user: mockClerkUser, isLoaded: true }),
}));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => mockAccount }));
jest.mock('convex/react', () => ({ useMutation: () => mockBackendDelete }));
jest.mock('@tendso/convex-client', () => ({ api: { creators: { deleteAccount: 'creators:deleteAccount' } } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('../components/ui/primitives', () => {
  const create = require('react').createElement;
  const { Text: NativeText, Pressable: NativePressable } = require('react-native');
  const text = ({ children, accessibilityRole }: { children: React.ReactNode; accessibilityRole?: string }) => create(NativeText, { accessibilityRole }, children);
  return { Body: text, Display: text, Label: text,
    Door: ({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) =>
      create(NativePressable, { accessibilityRole: 'button', accessibilityLabel: label, onPress, disabled: disabled || loading,
        accessibilityState: { disabled: !!disabled || !!loading } }, create(NativeText, null, label)) };
});

function Harness() {
  const deletion = useDeleteAccount();
  return <Pressable accessibilityLabel="Delete account" disabled={!deletion.canDelete || deletion.busy}
    onPress={deletion.requestDelete}><Text>Delete</Text></Pressable>;
}
function pressAlert(label: string) {
  const calls = jest.mocked(Alert.alert).mock.calls;
  const buttons = calls[calls.length - 1][2];
  const button = buttons?.find((item) => item.text === label);
  if (!button) throw new Error(`Missing alert action: ${label}`);
  button.onPress?.();
}
function confirmDeletion() {
  pressAlert('Delete My Account');
  pressAlert('Yes, Delete Everything');
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockClerkUser = mockUser;
  mockSessionId = 'own-session';
  mockAccount = {
    account: { _id: 'own-account', clerkId: 'own-user', role: 'affiliate', status: 'pending', isDeleted: false },
    isAuthenticated: true, isOffline: false, isLoading: false,
  };
  mockBackendDelete.mockResolvedValue(undefined);
  mockLoginDelete.mockResolvedValue(undefined);
  mockSignOut.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

it('offers pending affiliates deletion and deletes Convex before Clerk and signout', async () => {
  const order: string[] = [];
  mockBackendDelete.mockImplementation(async () => { order.push('convex'); });
  mockLoginDelete.mockImplementation(async () => { order.push('clerk'); });
  mockSignOut.mockImplementation(async () => { order.push('signout'); });
  const screen = render(<PendingAffiliateApproval />);
  fireEvent.press(screen.getByLabelText('Delete account'));
  act(confirmDeletion);
  await waitFor(() => expect(order).toEqual(['convex', 'clerk', 'signout']));
  expect(mockBackendDelete).toHaveBeenCalledWith({ id: 'own-account' });
  expect(mockSignOut).toHaveBeenCalledWith({ sessionId: 'own-session' });
});

it('preserves the same self-deletion flow for an active creator', async () => {
  mockAccount.account = { ...mockAccount.account, role: 'creator', status: 'active' };
  const screen = render(<Harness />);
  fireEvent.press(screen.getByLabelText('Delete account'));
  act(confirmDeletion);
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  expect(mockBackendDelete).toHaveBeenCalledWith({ id: 'own-account' });
  expect(mockLoginDelete).toHaveBeenCalledTimes(1);
});

it.each(['first', 'final'])('cancelling the %s confirmation makes no destructive calls', (stage) => {
  const screen = render(<Harness />);
  fireEvent.press(screen.getByLabelText('Delete account'));
  if (stage === 'final') act(() => pressAlert('Delete My Account'));
  act(() => pressAlert('Cancel'));
  expect(mockBackendDelete).not.toHaveBeenCalled();
  expect(mockLoginDelete).not.toHaveBeenCalled();
  expect(mockSignOut).not.toHaveBeenCalled();
});

it.each(['actor', 'session', 'target', 'auth', 'unmount'])('invalidates an open confirmation after %s changes', (change) => {
  const screen = render(<Harness />);
  fireEvent.press(screen.getByLabelText('Delete account'));
  act(() => pressAlert('Delete My Account'));
  if (change === 'actor') mockClerkUser = { id: 'another-user', delete: jest.fn() };
  if (change === 'session') mockSessionId = 'another-session';
  if (change === 'target') mockAccount.account = { ...mockAccount.account, _id: 'another-account' };
  if (change === 'auth') mockAccount.isAuthenticated = false;
  if (change === 'unmount') screen.unmount();
  else screen.rerender(<Harness />);
  act(() => pressAlert('Yes, Delete Everything'));
  expect(mockBackendDelete).not.toHaveBeenCalled();
  expect(mockLoginDelete).not.toHaveBeenCalled();
});

it('continues captured Clerk deletion after the backend hides and unmounts the pending screen', async () => {
  const backend = deferred();
  mockBackendDelete.mockReturnValue(backend.promise);
  const screen = render(<PendingAffiliateApproval />);
  fireEvent.press(screen.getByLabelText('Delete account'));
  act(confirmDeletion);
  expect(screen.getByLabelText('Sign out').props.accessibilityState.disabled).toBe(true);
  expect(screen.getByLabelText('Delete account').props.accessibilityState.disabled).toBe(true);
  screen.unmount();
  await act(async () => { backend.resolve(); await backend.promise; });
  expect(mockLoginDelete).toHaveBeenCalledTimes(1);
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it('deduplicates repeated destructive confirmations while deletion is in flight', async () => {
  const backend = deferred();
  mockBackendDelete.mockReturnValue(backend.promise);
  const screen = render(<Harness />);
  fireEvent.press(screen.getByLabelText('Delete account'));
  act(() => pressAlert('Delete My Account'));
  act(() => { pressAlert('Yes, Delete Everything'); pressAlert('Yes, Delete Everything'); });
  expect(mockBackendDelete).toHaveBeenCalledTimes(1);
  await act(async () => { backend.resolve(); await backend.promise; });
  expect(mockLoginDelete).toHaveBeenCalledTimes(1);
});

it('does not delete or sign out a new actor if the session changes during the backend request', async () => {
  const backend = deferred();
  mockBackendDelete.mockReturnValue(backend.promise);
  const screen = render(<Harness />);
  fireEvent.press(screen.getByLabelText('Delete account'));
  act(confirmDeletion);
  mockClerkUser = { id: 'another-user', delete: jest.fn() };
  mockSessionId = 'another-session';
  await act(async () => { backend.resolve(); await backend.promise; });
  expect(mockLoginDelete).not.toHaveBeenCalled();
  expect(mockClerkUser.delete).not.toHaveBeenCalled();
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenLastCalledWith('Could not delete account', expect.stringContaining('account changed'), expect.any(Array));
});

it('can retry a failed backend delete without deleting Clerk early', async () => {
  mockBackendDelete.mockRejectedValueOnce(new Error('Network unavailable'));
  const screen = render(<Harness />);
  fireEvent.press(screen.getByLabelText('Delete account'));
  act(confirmDeletion);
  await waitFor(() => expect(Alert.alert).toHaveBeenLastCalledWith('Could not delete account', 'Network unavailable', expect.any(Array)));
  expect(mockLoginDelete).not.toHaveBeenCalled();
  await act(async () => pressAlert('Retry'));
  expect(mockBackendDelete).toHaveBeenCalledTimes(2);
  expect(mockLoginDelete).toHaveBeenCalledTimes(1);
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it('retries failed Clerk deletion after unmount without repeating successful Convex deletion', async () => {
  mockLoginDelete.mockRejectedValueOnce(new Error('Could not remove login'));
  const screen = render(<PendingAffiliateApproval />);
  fireEvent.press(screen.getByLabelText('Delete account'));
  act(confirmDeletion);
  screen.unmount();
  await waitFor(() => expect(Alert.alert).toHaveBeenLastCalledWith('Could not delete account', 'Could not remove login', expect.any(Array)));
  expect(mockSignOut).not.toHaveBeenCalled();
  await act(async () => pressAlert('Retry'));
  expect(mockBackendDelete).toHaveBeenCalledTimes(1);
  expect(mockLoginDelete).toHaveBeenCalledTimes(2);
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

it('refuses a stale Clerk retry if another account became active after unmount', async () => {
  mockLoginDelete.mockRejectedValueOnce(new Error('Could not remove login'));
  const screen = render(<Harness />);
  fireEvent.press(screen.getByLabelText('Delete account'));
  act(confirmDeletion);
  await waitFor(() => expect(mockLoginDelete).toHaveBeenCalledTimes(1));
  screen.unmount();
  mockClerkUser = { id: 'another-user', delete: jest.fn() };
  mockSessionId = 'another-session';
  await act(async () => pressAlert('Retry'));
  expect(mockBackendDelete).toHaveBeenCalledTimes(1);
  expect(mockLoginDelete).toHaveBeenCalledTimes(1);
  expect(mockClerkUser.delete).not.toHaveBeenCalled();
  expect(mockSignOut).not.toHaveBeenCalled();
});

it('allows the original user to retry Clerk deletion after reconnecting with a new session', async () => {
  mockLoginDelete.mockRejectedValueOnce(new Error('Could not remove login'));
  const screen = render(<Harness />);
  fireEvent.press(screen.getByLabelText('Delete account'));
  act(confirmDeletion);
  await waitFor(() => expect(Alert.alert).toHaveBeenLastCalledWith('Could not delete account', 'Could not remove login', expect.any(Array)));
  screen.unmount();
  const reauthenticatedDelete = jest.fn(async () => {});
  mockClerkUser = { id: 'own-user', delete: reauthenticatedDelete };
  mockSessionId = 'new-own-session';
  await act(async () => pressAlert('Retry'));
  expect(mockBackendDelete).toHaveBeenCalledTimes(1);
  expect(mockLoginDelete).toHaveBeenCalledTimes(1);
  expect(reauthenticatedDelete).toHaveBeenCalledTimes(1);
  expect(mockSignOut).toHaveBeenCalledWith({ sessionId: 'new-own-session' });
});

it('retries signout without repeating either successful deletion', async () => {
  mockSignOut.mockRejectedValueOnce(new Error('Signout unavailable'));
  const screen = render(<Harness />);
  fireEvent.press(screen.getByLabelText('Delete account'));
  act(confirmDeletion);
  await waitFor(() => expect(Alert.alert).toHaveBeenLastCalledWith('Could not delete account', 'Signout unavailable', expect.any(Array)));
  await act(async () => pressAlert('Retry'));
  expect(mockBackendDelete).toHaveBeenCalledTimes(1);
  expect(mockLoginDelete).toHaveBeenCalledTimes(1);
  expect(mockSignOut).toHaveBeenCalledTimes(2);
});

it('disables deletion during signout so the backend keeps its required session', async () => {
  const signout = deferred();
  mockSignOut.mockReturnValue(signout.promise);
  const screen = render(<PendingAffiliateApproval />);
  fireEvent.press(screen.getByLabelText('Sign out'));
  expect(screen.getByLabelText('Delete account').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByLabelText('Delete account'));
  expect(Alert.alert).not.toHaveBeenCalled();
  await act(async () => { signout.resolve(); await signout.promise; });
});
