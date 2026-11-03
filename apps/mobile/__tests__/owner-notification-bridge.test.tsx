import React from 'react';
import { act, cleanup, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { OwnerNotificationBridge, ownerDeviceToken, unregisterOwnerPush } from '../components/v2/owner/OwnerNotificationBridge';

let mockIsDevice = true;
let mockProjectId: string | undefined = 'owner-test-project';
let mockFallbackProjectId: string | undefined;
let mockLastResponse: any = null;
const mockListeners = new Set<(response: any) => void>();
const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockSetChannel = jest.fn();
const mockGetChannel = jest.fn();
const mockGetToken = jest.fn();
const mockRegister = jest.fn();
const mockQuery = jest.fn();
const mockNavigate = jest.fn();
const mockClearLastResponse = jest.fn(() => { mockLastResponse = null; });
const mockRemoveListener = jest.fn();
const mockConvex = { query: (...args: unknown[]) => mockQuery(...args) };
const mockRouter = { navigate: (...args: unknown[]) => mockNavigate(...args) };

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetChannel(...args),
  getNotificationChannelAsync: (...args: unknown[]) => mockGetChannel(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetToken(...args),
  getLastNotificationResponse: () => mockLastResponse,
  clearLastNotificationResponse: () => mockClearLastResponse(),
  addNotificationResponseReceivedListener: (listener: (response: any) => void) => {
    mockListeners.add(listener);
    return { remove: () => { mockListeners.delete(listener); mockRemoveListener(); } };
  },
  DEFAULT_ACTION_IDENTIFIER: 'default',
  AndroidImportance: { DEFAULT: 3, NONE: 0 },
  IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) } }));
jest.mock('expo-device', () => ({ get isDevice() { return mockIsDevice; } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: {
  get expoConfig() { return { extra: { eas: { projectId: mockProjectId } } }; },
  get easConfig() { return { projectId: mockFallbackProjectId }; },
} }));
jest.mock('convex/react', () => ({ useConvex: () => mockConvex, useMutation: () => mockRegister }));
jest.mock('@tendso/convex-client', () => ({ api: { ownerInbox: {
  registerPushToken: 'owner-register-token', list: 'owner-inbox-list',
} } }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));

const originalPlatform = Platform.OS;
const bridge = (ownerId = 'owner-a', subject = 'clerk-a') => <OwnerNotificationBridge ownerId={ownerId as never} subject={subject} />;
const inbox = (ownerId = 'owner-a', actorClerkId = 'clerk-a', keys = ['visit:event-a']) => ({
  ownerId, actorClerkId, unreadCount: keys.length, items: keys.map(key => ({ key, read: false, title: 'Visit confirmed' })),
});
const response = (identifier = 'push-a', data: Record<string, unknown> = { ownerId: 'owner-a', ownerEventKey: 'visit:event-a' }, actionIdentifier = 'default') => ({
  actionIdentifier, notification: { request: { identifier, content: { data } } },
});
async function settle() { await act(async () => { for (let index = 0; index < 15; index++) await Promise.resolve(); }); }
async function deliver(value: ReturnType<typeof response>) {
  await act(async () => { mockLastResponse = value; for (const listener of mockListeners) listener(value); });
  await settle();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks(); mockListeners.clear(); mockLastResponse = null;
  mockIsDevice = true; mockProjectId = 'owner-test-project'; mockFallbackProjectId = undefined;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockGetPermissions.mockReset().mockResolvedValue({ status: 'granted', canAskAgain: true });
  mockRequestPermissions.mockReset().mockResolvedValue({ status: 'granted', canAskAgain: true });
  mockSetChannel.mockReset().mockResolvedValue(undefined);
  mockGetChannel.mockReset().mockResolvedValue({ importance: 3 });
  mockGetToken.mockReset().mockResolvedValue({ data: 'ExpoPushToken[owner-test-device]' });
  mockRegister.mockReset().mockResolvedValue(undefined);
  mockQuery.mockReset().mockResolvedValue(inbox());
});
afterEach(() => {
  cleanup(); jest.useRealTimers();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
});

describe('owner notification permissions and registration', () => {
  it('registers an already permitted device for this owner without requesting permission or marking messages read', async () => {
    const screen = render(bridge()); await settle();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockGetToken).toHaveBeenCalledWith({ projectId: 'owner-test-project' });
    expect(mockRegister).toHaveBeenCalledWith({ token: 'ExpoPushToken[owner-test-device]', platform: 'ios', clerkId: 'clerk-a' });
    expect(mockQuery).not.toHaveBeenCalled();
    screen.rerender(bridge()); await settle();
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('leaves permission prompting to an explicit settings action', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    render(bridge()); await settle();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
    expect(await ownerDeviceToken(true, () => true)).toBe('ExpoPushToken[owner-test-device]');
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
  });

  it('does not prompt again after permanent permission denial', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied', canAskAgain: false });
    expect(await ownerDeviceToken(true, () => true)).toBeNull();
    expect(mockRequestPermissions).not.toHaveBeenCalled(); expect(mockGetToken).not.toHaveBeenCalled();
  });

  it.each(['simulator', 'web', 'inactive'])('skips native token access on %s', async state => {
    if (state === 'simulator') mockIsDevice = false;
    if (state === 'web') Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    expect(await ownerDeviceToken(true, () => state !== 'inactive')).toBeNull();
    expect(mockGetPermissions).not.toHaveBeenCalled(); expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('does not subscribe to native taps on web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    mockLastResponse = response(); render(bridge()); await settle();
    expect(mockListeners.size).toBe(0); expect(mockQuery).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('requires a project ID and supports the EAS project fallback', async () => {
    mockProjectId = undefined;
    expect(await ownerDeviceToken(false, () => true)).toBeNull();
    expect(mockGetToken).not.toHaveBeenCalled();
    mockFallbackProjectId = 'fallback-project';
    expect(await ownerDeviceToken(false, () => true)).toBe('ExpoPushToken[owner-test-device]');
    expect(mockGetToken).toHaveBeenCalledWith({ projectId: 'fallback-project' });
  });

  it('creates the Android updates channel before asking for the Expo token', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    render(bridge()); await settle();
    expect(mockSetChannel).toHaveBeenCalledWith('default', { name: 'Updates', importance: 3 });
    expect(mockSetChannel.mock.invocationCallOrder[0]).toBeLessThan(mockGetToken.mock.invocationCallOrder[0]);
    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({ platform: 'android' }));
  });

  it.each(['permission', 'prompt', 'channel', 'token'])('stops token acquisition when the current owner changes during %s', async phase => {
    const pending = deferred<any>(); let current = true;
    if (phase === 'prompt') mockGetPermissions.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    if (phase === 'channel') Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const target = phase === 'permission' ? mockGetPermissions : phase === 'prompt' ? mockRequestPermissions : phase === 'channel' ? mockSetChannel : mockGetToken;
    target.mockImplementationOnce(() => pending.promise);
    const result = ownerDeviceToken(true, () => current); await settle();
    expect(target).toHaveBeenCalledTimes(1);
    current = false;
    pending.resolve(phase === 'token' ? { data: 'ExpoPushToken[stale-owner]' } : phase === 'channel' ? undefined : { status: 'granted' });
    expect(await result).toBeNull();
    if (phase !== 'token') expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('never registers an old owner token after an account switch or unmount', async () => {
    const first = deferred<{ data: string }>(); mockGetToken.mockReturnValueOnce(first.promise);
    const screen = render(bridge()); await settle();
    screen.rerender(bridge('owner-b', 'clerk-b')); await settle();
    expect(mockRegister).not.toHaveBeenCalled();
    await act(async () => { first.resolve({ data: 'ExpoPushToken[old-owner]' }); });
    await settle();
    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({ clerkId: 'clerk-b' }));
    expect(mockRegister.mock.calls.map(call => call[0].clerkId)).toEqual(['clerk-b']);
    const last = deferred<{ data: string }>(); mockGetToken.mockReturnValueOnce(last.promise);
    screen.rerender(bridge('owner-c', 'clerk-c')); await settle(); screen.unmount();
    await act(async () => { last.resolve({ data: 'ExpoPushToken[unmounted-owner]' }); });
    expect(mockRegister.mock.calls.map(call => call[0].clerkId)).toEqual(['clerk-b']);
    expect(mockListeners.size).toBe(0);
  });

  it.each(['permission', 'channel', 'token', 'registration'])('catches background %s errors without routing', async phase => {
    if (phase === 'channel') Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const target = phase === 'permission' ? mockGetPermissions : phase === 'channel' ? mockSetChannel : phase === 'token' ? mockGetToken : mockRegister;
    target.mockRejectedValueOnce(new Error('Native service unavailable'));
    render(bridge()); await settle();
    expect(mockNavigate).not.toHaveBeenCalled();
    if (phase !== 'registration') expect(mockRegister).not.toHaveBeenCalled();
  });
});

describe('owner notification response routing', () => {
  it('verifies a cold-start tap against the owned inbox, opens only that event, and consumes it once', async () => {
    const tap = response('cold-start', { ownerId: 'owner-a', ownerEventKey: 'visit:event-a', url: 'https://untrusted.test', screen: 'admin' });
    mockLastResponse = tap;
    render(bridge()); await settle();
    expect(mockQuery).toHaveBeenCalledWith('owner-inbox-list', { clerkId: 'clerk-a' });
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/(owner)/me/inbox', params: { eventKey: 'visit:event-a' } });
    expect(mockClearLastResponse).toHaveBeenCalledTimes(1);
    await deliver(tap);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockLastResponse).toBeNull();
    // Only registration was mutated: tapping is not an implicit mark-all-read operation.
    expect(mockRegister.mock.calls.every(call => call[0].token === 'ExpoPushToken[owner-test-device]')).toBe(true);
  });

  it('clears a foreign owner’s retained response so an account switch cannot replay it later', async () => {
    mockLastResponse = response('foreign-owner', { ownerId: 'owner-b', ownerEventKey: 'visit:event-b' });
    const screen = render(bridge()); await settle();
    expect(mockNavigate).not.toHaveBeenCalled(); expect(mockQuery).not.toHaveBeenCalled();
    expect(mockClearLastResponse).toHaveBeenCalledTimes(1);
    mockQuery.mockResolvedValue(inbox('owner-b', 'clerk-b', ['visit:event-b']));
    screen.rerender(bridge('owner-b', 'clerk-b')); await settle();
    expect(mockNavigate).not.toHaveBeenCalled(); expect(mockQuery).not.toHaveBeenCalled();
  });

  it('clears an event that no longer belongs to the current inbox without opening it', async () => {
    mockQuery.mockResolvedValue(inbox('owner-a', 'clerk-a', []));
    mockLastResponse = response(); render(bridge()); await settle();
    expect(mockQuery).toHaveBeenCalledTimes(1); expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockClearLastResponse).toHaveBeenCalledTimes(1);
  });

  it.each(['wrong-owner', 'wrong-subject', 'missing'])('rejects a %s inbox envelope', async state => {
    mockQuery.mockResolvedValue(state === 'missing' ? null : inbox(state === 'wrong-owner' ? 'owner-b' : 'owner-a', state === 'wrong-subject' ? 'clerk-b' : 'clerk-a'));
    render(bridge()); await settle(); await deliver(response());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each([
    { ownerId: 'owner-a' }, { ownerId: 'owner-a', ownerEventKey: '' }, { ownerId: 'owner-a', ownerEventKey: 42 },
    { ownerId: 'owner-a', ownerEventKey: 'x'.repeat(513) },
  ])('does not query or route a malformed event payload %j', async data => {
    render(bridge()); await settle(); await deliver(response('malformed', data));
    expect(mockQuery).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('ignores a custom action rather than opening an unverified route', async () => {
    render(bridge()); await settle(); await deliver(response('action', undefined, 'dismiss-action'));
    expect(mockQuery).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each(['account switch', 'unmount'])('ignores an inbox response that finishes after %s', async state => {
    const pending = deferred<any>(); mockQuery.mockReturnValueOnce(pending.promise);
    const screen = render(bridge()); await settle(); await deliver(response());
    if (state === 'unmount') screen.unmount(); else screen.rerender(bridge('owner-b', 'clerk-b'));
    await act(async () => { pending.resolve(inbox()); });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the latest tap when inbox requests finish out of order', async () => {
    const older = deferred<any>(); mockQuery.mockReturnValueOnce(older.promise).mockResolvedValueOnce(inbox('owner-a', 'clerk-a', ['visit:event-b']));
    render(bridge()); await settle(); await deliver(response('first'));
    await deliver(response('second', { ownerId: 'owner-a', ownerEventKey: 'visit:event-b' }));
    await act(async () => { older.resolve(inbox()); });
    expect(mockNavigate.mock.calls).toEqual([[{ pathname: '/(owner)/me/inbox', params: { eventKey: 'visit:event-b' } }]]);
  });

  it('does not clear a newer native response when an older inbox query finishes', async () => {
    const pending = deferred<any>(); mockQuery.mockReturnValueOnce(pending.promise);
    render(bridge()); await settle(); await deliver(response('older'));
    mockLastResponse = response('newer-unhandled', { ownerId: 'owner-a', ownerEventKey: 'visit:event-b' });
    await act(async () => { pending.resolve(inbox()); });
    expect(mockClearLastResponse).not.toHaveBeenCalled();
  });

  it('handles a failed inbox lookup without trusting payload text or opening an arbitrary page', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Offline'));
    render(bridge()); await settle(); await deliver(response());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('owner notification sign-out isolation', () => {
  it('removes only the current owner token without requesting new permission', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    await unregisterOwnerPush(remove, 'clerk-a', () => true);
    expect(remove).toHaveBeenCalledWith({ token: 'ExpoPushToken[owner-test-device]', clerkId: 'clerk-a' });
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it.each(['signed out', 'denied', 'stale actor', 'permission error', 'remove error'])('keeps sign-out available when %s', async state => {
    const remove = jest.fn().mockResolvedValue(undefined);
    if (state === 'denied') mockGetPermissions.mockResolvedValue({ status: 'denied', canAskAgain: true });
    if (state === 'permission error') mockGetPermissions.mockRejectedValue(new Error('Native permissions unavailable'));
    if (state === 'remove error') remove.mockRejectedValue(new Error('Offline'));
    await expect(unregisterOwnerPush(remove, state === 'signed out' ? null : 'clerk-a', () => state !== 'stale actor')).resolves.toBeUndefined();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    if (state === 'signed out' || state === 'stale actor') expect(remove).not.toHaveBeenCalled();
    else expect(remove).toHaveBeenCalledWith({ token: 'ExpoPushToken[owner-test-device]', clerkId: 'clerk-a' });
  });

  it('does not remove another owner’s token when the account changes while token lookup is pending', async () => {
    const pending = deferred<{ data: string }>(); mockGetToken.mockReturnValueOnce(pending.promise);
    const remove = jest.fn(); let current = true;
    const work = unregisterOwnerPush(remove, 'lookup-owner', () => current); await settle();
    current = false; pending.resolve({ data: 'ExpoPushToken[shared-device]' }); await work;
    expect(remove).not.toHaveBeenCalled();
  });

  it('bounds cleanup at 1.5 seconds and never starts a removal after a late token resolves', async () => {
    jest.useFakeTimers(); const pending = deferred<{ data: string }>(); mockGetToken.mockReturnValueOnce(pending.promise);
    const remove = jest.fn(); let done = false;
    const work = unregisterOwnerPush(remove, 'timeout-owner', () => true).then(() => { done = true; });
    await settle(); await act(async () => { jest.advanceTimersByTime(1499); }); expect(done).toBe(false);
    await act(async () => { jest.advanceTimersByTime(1); }); await work; expect(done).toBe(true);
    await act(async () => { pending.resolve({ data: 'ExpoPushToken[late]' }); });
    expect(remove).not.toHaveBeenCalled();
  });

  it('bounds a pending backend removal without issuing any second cleanup request', async () => {
    jest.useFakeTimers(); const pending = deferred<void>(); const remove = jest.fn().mockReturnValue(pending.promise);
    const work = unregisterOwnerPush(remove, 'clerk-a', () => true); await settle();
    expect(remove).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(1500); }); await work;
    await act(async () => { pending.resolve(); }); expect(remove).toHaveBeenCalledTimes(1);
  });
});
