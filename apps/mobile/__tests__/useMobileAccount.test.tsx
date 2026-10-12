import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { MobileAccountProvider, useMobileAccount } from '../hooks/useMobileAccount';

let mockAuth: any;
let mockConvexAuth: any;
let mockConnected = true;
let mockAccount: any;
let mockSubject: string | undefined;
let mockState: ReturnType<typeof useMobileAccount>;
const mockQuery = jest.fn();
const mockStorage = new Map<string, string>();
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => mockAuth }));
jest.mock('convex/react', () => ({
  useConvexAuth: () => mockConvexAuth,
  useQuery: (...args: unknown[]) => {
    mockQuery(...args);
    return { clerkId: mockSubject ?? mockAccount?.clerkId ?? 'current-user', creator: mockAccount, isOwner: false };
  },
}));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }),
}));
function State() { mockState = useMobileAccount(); return <Text>{mockState.view}</Text>; }
const mount = () => render(<MobileAccountProvider><State /></MobileAccountProvider>);
beforeEach(() => {
  mockAuth = { userId: 'current-user', isLoaded: true, isSignedIn: true };
  mockConvexAuth = { isLoading: false, isAuthenticated: true };
  mockConnected = true;
  mockSubject = undefined;
  mockAccount = { _id: 'admin-id', clerkId: 'current-user', role: 'admin', status: 'active' };
  mockStorage.clear(); mockQuery.mockClear();
});
it('changes preview locally without changing the actual account or authorization', async () => {
  mount();
  await waitFor(() => expect(mockState.isLoading).toBe(false));
  act(() => mockState.setView('affiliate'));
  expect(mockState.view).toBe('affiliate');
  expect(mockState.isPreview).toBe(true);
  expect(mockState.account?.role).toBe('admin');
});
it('removes admin view synchronously on role revocation', async () => {
  const screen = mount();
  await waitFor(() => expect(mockState.isAdmin).toBe(true));
  act(() => mockState.setView('affiliate'));
  mockAccount = { ...mockAccount, role: 'creator' };
  screen.rerender(<MobileAccountProvider><State /></MobileAccountProvider>);
  expect(mockState.isAdmin).toBe(false);
  expect(mockState.isPreview).toBe(false);
  expect(mockState.view).toBe('creator');
});
it.each([{ status: 'suspended' }, { status: 'deleted' }, { isDeleted: true }])('rejects inactive admin %j', patch => {
  mockAccount = { ...mockAccount, ...patch }; mount();
  expect(mockState.isAdmin).toBe(false);
  expect(mockState.isBlocked).toBe(true);
});
it('does not grant access from a previous login query result', () => {
  mockAccount = { ...mockAccount, clerkId: 'old-user' }; mount();
  expect(mockState.account).toBeUndefined();
  expect(mockState.isAdmin).toBe(false);
  expect(mockState.isLoading).toBe(true);
});
it('does not query account data before Convex authentication is ready', () => {
  mockConvexAuth = { isLoading: true, isAuthenticated: false }; mount();
  expect(mockQuery).toHaveBeenCalledWith('adminAccess:me', 'skip');
  expect(mockState.account).toBeUndefined();
  expect(mockState.isAdmin).toBe(false);
});
it('cached offline admin roles never grant admin queries or preview access', async () => {
  mockConnected = false;
  mockStorage.set('ndm_mobile_account_role', JSON.stringify({ clerkId: 'current-user', role: 'admin' }));
  mount(); await waitFor(() => expect(mockState.isLoading).toBe(false));
  expect(mockState.role).toBe('admin');
  expect(mockState.isAdmin).toBe(false);
  expect(mockState.account).toBeUndefined();
  expect(mockQuery).toHaveBeenCalledWith('adminAccess:me', 'skip');
});
it('does not reuse another login role cache offline', async () => {
  mockConnected = false;
  mockStorage.set('ndm_mobile_account_role', JSON.stringify({ clerkId: 'other-user', role: 'creator' }));
  mount(); await waitFor(() => expect(mockState.isLoading).toBe(false));
  expect(mockState.role).toBeNull();
});
it('waits for the Convex JWT subject even when a looked-up row matches Clerk', () => {
  mockSubject = 'previous-jwt-user'; mount();
  expect(mockState.account).toBeUndefined();
  expect(mockState.isAdmin).toBe(false);
  expect(mockState.isLoading).toBe(true);
});
