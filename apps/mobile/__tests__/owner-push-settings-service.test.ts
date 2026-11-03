import { Platform } from 'react-native';
import { disableOwnerPush, ownerDeviceToken, syncOwnerPush, unregisterOwnerPush } from '../services/ownerPushSettings';

const mockDisk: Record<string, string> = {};
const mockPermission = jest.fn(), mockRequest = jest.fn(), mockToken = jest.fn(), mockChannel = jest.fn(), mockReadChannel = jest.fn();
const mockRegister = jest.fn(), mockRemove = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async (key: string) => mockDisk[key] ?? null), setItem: jest.fn(async (key: string, value: string) => { mockDisk[key] = value; }),
} }));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'push-settings-project' } } } } }));
jest.mock('expo-notifications', () => ({ getPermissionsAsync: () => mockPermission(), requestPermissionsAsync: () => mockRequest(),
  getExpoPushTokenAsync: (...args: unknown[]) => mockToken(...args), setNotificationChannelAsync: (...args: unknown[]) => mockChannel(...args),
  getNotificationChannelAsync: () => mockReadChannel(), AndroidImportance: { DEFAULT: 3, NONE: 0 }, IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
}));
const originalPlatform = Platform.OS;
let sequence = 0, subject: string;
const current = () => true;
const refresh = (prompt = false, guard = current) => syncOwnerPush(mockRegister, subject, prompt, guard);
async function settle() { for (let index = 0; index < 25; index++) await Promise.resolve(); }
function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>(done => { resolve = done; }), resolve: (value: T) => resolve(value) }; }
beforeEach(() => {
  jest.clearAllMocks(); subject = `settings-owner-${++sequence}`;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockPermission.mockReset().mockResolvedValue({ status: 'granted', canAskAgain: true }); mockRequest.mockReset().mockResolvedValue({ status: 'granted', canAskAgain: true });
  mockToken.mockReset().mockResolvedValue({ data: 'ExpoPushToken[settings-device]' }); mockRegister.mockReset().mockResolvedValue({ registered: true }); mockRemove.mockReset().mockResolvedValue(undefined);
  mockChannel.mockReset().mockResolvedValue(undefined); mockReadChannel.mockReset().mockResolvedValue({ importance: 3 });
});
afterEach(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform }); });

it('checks existing permission without ever prompting on a settings refresh', async () => {
  mockPermission.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
  expect(await refresh()).toBe('not-enabled'); expect(mockRequest).not.toHaveBeenCalled(); expect(mockToken).not.toHaveBeenCalled(); expect(mockRegister).not.toHaveBeenCalled();
});
it('asks only after explicit enable and reports On after an acknowledged backend registration', async () => {
  mockPermission.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
  expect(await refresh(true)).toBe('enabled'); expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(mockRegister).toHaveBeenCalledWith({ token: 'ExpoPushToken[settings-device]', platform: 'ios', clerkId: subject });
  expect(JSON.parse(mockDisk[`tendso-owner-push:v1:${subject}`])).toEqual({ enabled: true, token: 'ExpoPushToken[settings-device]' });
});
it('does not claim On when registration fails, and can retry the same device', async () => {
  mockRegister.mockRejectedValueOnce(new Error('Offline'));
  await expect(refresh()).rejects.toThrow('Offline'); expect(await refresh()).toBe('enabled');
});
it('does not request permission repeatedly when the OS requires phone settings', async () => {
  mockPermission.mockResolvedValue({ status: 'denied', canAskAgain: false });
  expect(await refresh(true)).toBe('blocked'); expect(mockRequest).not.toHaveBeenCalled(); expect(mockRegister).not.toHaveBeenCalled();
});
it('recognizes iOS provisional permission as quiet delivery, without asking again', async () => {
  mockPermission.mockResolvedValue({ status: 'denied', canAskAgain: true, ios: { status: 3, allowsAlert: false } });
  expect(await refresh()).toBe('quiet'); expect(mockRequest).not.toHaveBeenCalled(); expect(mockRegister).toHaveBeenCalledTimes(1);
});
it('creates Android channel before permissions and token, and notices a blocked channel', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  mockPermission.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
  expect(await refresh(true)).toBe('enabled');
  expect(mockChannel.mock.invocationCallOrder[0]).toBeLessThan(mockPermission.mock.invocationCallOrder[0]);
  expect(mockChannel.mock.invocationCallOrder[0]).toBeLessThan(mockRequest.mock.invocationCallOrder[0]);
  mockReadChannel.mockResolvedValue({ importance: 0 }); expect(await refresh()).toBe('blocked'); expect(mockRegister).toHaveBeenCalledTimes(1);
});
it('disables only the registered owner token even after OS permission was revoked', async () => {
  await refresh(); mockPermission.mockClear().mockResolvedValue({ status: 'denied', canAskAgain: false });
  expect(await disableOwnerPush(mockRegister, subject, current)).toBe('off');
  expect(mockRequest).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled();
  expect(mockRegister).toHaveBeenLastCalledWith({ token: 'ExpoPushToken[settings-device]', platform: 'ios', clerkId: subject, enabled: false });
  expect(JSON.parse(mockDisk[`tendso-owner-push:v1:${subject}`]).enabled).toBe(false);
});
it('honors a persisted opt-out after restart instead of auto-registering the permitted device', async () => {
  mockDisk[`tendso-owner-push:v1:${subject}`] = JSON.stringify({ enabled: false, token: 'ExpoPushToken[cached-disabled-device]' });
  expect(await refresh()).toBe('off'); expect(mockRequest).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled();
  expect(mockRegister.mock.calls.every(call => call[0].enabled === false)).toBe(true);
  expect(mockRegister).toHaveBeenCalledWith({ token: 'ExpoPushToken[cached-disabled-device]', platform: 'ios', clerkId: subject, enabled: false });
});
it('keeps a late automatic token lookup from re-registering after opt-out', async () => {
  const lookup = deferred<{ data: string }>(); mockToken.mockReturnValueOnce(lookup.promise);
  const automatic = refresh(); await settle(); const off = disableOwnerPush(mockRegister, subject, current);
  lookup.resolve({ data: 'ExpoPushToken[late-device]' }); await automatic; expect(await off).toBe('off');
  expect(mockRegister.mock.calls.every(call => call[0].enabled === false)).toBe(true); expect(mockRemove).not.toHaveBeenCalled();
});
it('serializes unregister after a registration already in flight', async () => {
  const registration = deferred<{ registered: boolean }>(); mockRegister.mockReturnValueOnce(registration.promise);
  const automatic = refresh(); await settle(); expect(mockRegister).toHaveBeenCalledTimes(1);
  const off = disableOwnerPush(mockRegister, subject, current); registration.resolve({ registered: true });
  expect(await automatic).toBeNull(); expect(await off).toBe('off'); expect(mockRemove).not.toHaveBeenCalled();
  expect(mockRegister).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
});
it('serializes account handoff so an old in-flight registration cannot finish after the new owner claims this device', async () => {
  const registration = deferred<{ registered: boolean }>(); mockRegister.mockReturnValueOnce(registration.promise); let oldCurrent = true;
  const old = refresh(false, () => oldCurrent); await settle(); expect(mockRegister).toHaveBeenCalledTimes(1);
  oldCurrent = false;
  const next = syncOwnerPush(mockRegister, `${subject}-next`, false, current); await settle();
  expect(mockRegister).toHaveBeenCalledTimes(1);
  registration.resolve({ registered: true }); expect(await old).toBeNull(); expect(await next).toBe('enabled');
  expect(mockRegister.mock.calls.map(call => call[0].clerkId)).toEqual([subject, `${subject}-next`]);
});
it('atomically claims an already opted-out next owner’s shared device inactive after the prior owner’s logout fails', async () => {
  let subscription: { owner: string; active: boolean } | undefined;
  mockRegister.mockImplementation(async (args: { clerkId: string; enabled?: boolean }) => {
    subscription = { owner: args.clerkId, active: args.enabled !== false }; return { registered: args.enabled !== false };
  });
  expect(await refresh()).toBe('enabled'); mockRemove.mockRejectedValueOnce(new Error('Offline logout'));
  await unregisterOwnerPush(mockRemove, subject, current);
  expect(subscription).toEqual({ owner: subject, active: true });
  const next = `${subject}-opted-out`;
  mockDisk[`tendso-owner-push:v1:${next}`] = JSON.stringify({ enabled: false });
  expect(await syncOwnerPush(mockRegister, next, false, current)).toBe('off');
  expect(subscription).toEqual({ owner: next, active: false });
  expect(mockRegister.mock.calls.filter(call => call[0].clerkId === next).map(call => call[0].enabled)).toEqual([false]);
  expect(mockRequest).not.toHaveBeenCalled();
});
it('does not report Off before the inactive device claim is acknowledged and retries a failed claim without enabling', async () => {
  await refresh(); const claim = deferred<{ registered: boolean }>(); mockRegister.mockReturnValueOnce(claim.promise);
  let finished = false; const off = disableOwnerPush(mockRegister, subject, current).then(value => { finished = true; return value; });
  await settle(); expect(finished).toBe(false); expect(mockRegister).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  claim.resolve({ registered: false }); expect(await off).toBe('off');
  mockRegister.mockRejectedValueOnce(new Error('Inactive claim unavailable'));
  await expect(refresh()).rejects.toThrow('Inactive claim unavailable');
  expect(await refresh()).toBe('off');
  expect(mockRegister.mock.calls.slice(1).every(call => call[0].enabled === false)).toBe(true);
});
it('inactive-claims both current and cached token when the installation token rotated while another owner was signed in', async () => {
  mockDisk[`tendso-owner-push:v1:${subject}`] = JSON.stringify({ enabled: false, token: 'ExpoPushToken[old-installation-token]' });
  mockToken.mockResolvedValue({ data: 'ExpoPushToken[current-installation-token]' });
  expect(await refresh()).toBe('off');
  expect(mockRegister.mock.calls.map(call => ({ token: call[0].token, enabled: call[0].enabled }))).toEqual([
    { token: 'ExpoPushToken[current-installation-token]', enabled: false }, { token: 'ExpoPushToken[old-installation-token]', enabled: false },
  ]);
  expect(mockRemove).not.toHaveBeenCalled();
});
it('ignores an account change during token lookup', async () => {
  const lookup = deferred<{ data: string }>(); mockToken.mockReturnValueOnce(lookup.promise); let active = true;
  const work = refresh(false, () => active); await settle(); active = false; lookup.resolve({ data: 'ExpoPushToken[old-owner-device]' });
  expect(await work).toBeNull(); expect(mockRegister).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled();
});
it('uses cached token for sign-out after permission revocation, never prompting', async () => {
  await refresh(); mockPermission.mockClear().mockRejectedValue(new Error('OS unavailable'));
  await unregisterOwnerPush(mockRemove, subject, current); expect(mockPermission).not.toHaveBeenCalled();
  expect(mockRemove).toHaveBeenCalledWith({ token: 'ExpoPushToken[settings-device]', clerkId: subject }); expect(mockRequest).not.toHaveBeenCalled();
});
it('does not fetch a token for an inactive account', async () => {
  expect(await ownerDeviceToken(true, () => false)).toBeNull(); expect(mockPermission).not.toHaveBeenCalled();
});
