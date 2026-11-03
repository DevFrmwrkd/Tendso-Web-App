import React from 'react';
import { AppState, Linking, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Settings from '../app/(owner)/me/settings';
import Me from '../app/(owner)/(tabs)/me';
import type { OwnerPushState } from '../services/ownerPushSettings';

const mockSync = jest.fn(), mockDisable = jest.fn(), mockRegister = jest.fn(), mockRemove = jest.fn();
const mockRouter = { push: jest.fn(), back: jest.fn() };
let mockSubject = 'owner-a', mockSession = 'session-a', mockOwner = 'owner-record-a', mockConnected = true;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject, sessionId: mockSession }), useClerk: () => ({ signOut: jest.fn() }) }));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => ({ me: { owner: { _id: mockOwner, name: 'Pablo', email: 'owner@example.test' }, sites: [] } }) }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
jest.mock('../lib/v2/ownerData', () => ({ WEB_ORIGIN: 'https://tendso.example.test' }));
jest.mock('../lib/v2/ownerIntake', () => ({ ownerIntake: { scope: () => 1, isCurrent: () => true } }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('convex/react', () => ({ useMutation: (name: string) => name === 'ownerInbox:registerPushToken' ? mockRegister : mockRemove }));
jest.mock('../services/ownerPushSettings', () => ({ syncOwnerPush: (...args: unknown[]) => mockSync(...args), disableOwnerPush: (...args: unknown[]) => mockDisable(...args) }));
jest.mock('../components/v2/owner/OwnerNotificationBridge', () => ({ unregisterOwnerPush: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Defs: 'Defs', LinearGradient: 'LinearGradient', Rect: 'Rect', Stop: 'Stop', Path: 'Path' }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (element: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{element}</SafeAreaProvider>);
const listeners = new Set<(state: AppStateStatus) => void>();
let removeListener: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks(); mockSubject = 'owner-a'; mockSession = 'session-a'; mockOwner = 'owner-record-a'; mockConnected = true;
  mockSync.mockReset().mockResolvedValue('not-enabled'); mockDisable.mockReset().mockResolvedValue('off'); listeners.clear();
  removeListener = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { listeners.add(callback); return { remove: () => { listeners.delete(callback); removeListener(); } }; });
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
});
afterEach(() => { jest.restoreAllMocks(); });
function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>(done => { resolve = done; }), resolve: (value: T) => resolve(value) }; }

it('puts device notification settings under Me', () => {
  const screen = wrap(<Me />);
  fireEvent.press(screen.getByRole('button', { name: 'Settings, Notifications on this device' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/me/settings'); expect(mockSync).not.toHaveBeenCalled();
});
it('checks silently on entry and asks only when the owner turns notifications on', async () => {
  const screen = wrap(<Settings />); await waitFor(() => expect(screen.getByText('Not enabled yet')).toBeTruthy());
  expect(mockSync).toHaveBeenCalledWith(mockRegister, 'owner-a', false, expect.any(Function));
  mockSync.mockResolvedValue('enabled');
  await act(async () => fireEvent(screen.getByRole('switch', { name: 'Push notifications' }), 'valueChange', true));
  expect(mockSync).toHaveBeenLastCalledWith(mockRegister, 'owner-a', true, expect.any(Function));
  expect(screen.getByText('On for this device')).toBeTruthy(); expect(screen.getByText('Your inbox always stays on')).toBeTruthy();
});
it('opens phone settings after OS denial and refreshes state when returning to the foreground', async () => {
  mockSync.mockResolvedValueOnce('blocked').mockResolvedValue('enabled');
  const screen = wrap(<Settings />); await waitFor(() => expect(screen.getByText('Blocked in phone settings')).toBeTruthy());
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Open phone settings' })));
  expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  await act(async () => { for (const callback of listeners) callback('active'); });
  expect(screen.getByText('On for this device')).toBeTruthy();
  expect(mockSync.mock.calls.every(call => call[2] === false)).toBe(true);
  screen.unmount(); expect(removeListener).toHaveBeenCalled();
});
it('turns off this owner device registration while preserving the inbox explanation', async () => {
  mockSync.mockResolvedValue('enabled');
  const screen = wrap(<Settings />); await waitFor(() => expect(screen.getByText('On for this device')).toBeTruthy());
  await act(async () => fireEvent(screen.getByRole('switch', { name: 'Push notifications' }), 'valueChange', false));
  expect(mockDisable).toHaveBeenCalledWith(mockRegister, 'owner-a', expect.any(Function));
  expect(screen.getByText('Off for this account')).toBeTruthy(); expect(screen.getByText('Your inbox always stays on')).toBeTruthy();
});
it('does not claim Off when the inactive device claim fails, and offers a safe retry', async () => {
  mockSync.mockResolvedValue('enabled'); mockDisable.mockRejectedValueOnce(new Error('Cloud unavailable'));
  const screen = wrap(<Settings />); await waitFor(() => expect(screen.getByText('On for this device')).toBeTruthy());
  await act(async () => fireEvent(screen.getByRole('switch', { name: 'Push notifications' }), 'valueChange', false));
  expect(screen.queryByText('Off for this account')).toBeNull(); expect(screen.getByText('On for this device')).toBeTruthy();
  mockSync.mockResolvedValue('off');
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Retry notification settings' })));
  expect(screen.getByText('Off for this account')).toBeTruthy();
  expect(mockSync).toHaveBeenLastCalledWith(mockRegister, 'owner-a', false, expect.any(Function));
});
it('does not display On while registration is pending or after it fails', async () => {
  const pending = deferred<OwnerPushState | null>(); mockSync.mockReturnValueOnce(pending.promise);
  const screen = wrap(<Settings />); expect(screen.queryByText('On for this device')).toBeNull();
  await act(async () => pending.resolve('not-enabled'));
  mockSync.mockRejectedValueOnce(new Error('Backend unavailable'));
  await act(async () => fireEvent(screen.getByRole('switch', { name: 'Push notifications' }), 'valueChange', true));
  expect(screen.queryByText('On for this device')).toBeNull(); expect(screen.getByRole('button', { name: 'Retry notification settings' })).toBeTruthy();
});
it('does not start registration while offline', () => {
  mockConnected = false; const screen = wrap(<Settings />);
  expect(screen.getByText('You’re offline. Connect to check or change notifications on this device.')).toBeTruthy();
  expect(mockSync).not.toHaveBeenCalled(); expect(mockDisable).not.toHaveBeenCalled();
});
it.each(['account', 'session'] as const)('ignores a late settings response after the %s changes', async kind => {
  const pending = deferred<OwnerPushState | null>(); mockSync.mockReturnValueOnce(pending.promise).mockResolvedValue('not-enabled');
  const screen = wrap(<Settings />); const oldCurrent = mockSync.mock.calls[0][3] as () => boolean;
  if (kind === 'account') { mockSubject = 'owner-b'; mockOwner = 'owner-record-b'; } else mockSession = 'session-b';
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><Settings /></SafeAreaProvider>);
  await act(async () => pending.resolve('enabled'));
  expect(oldCurrent()).toBe(false); expect(screen.queryByText('On for this device')).toBeNull(); expect(screen.getByText('Not enabled yet')).toBeTruthy();
});
