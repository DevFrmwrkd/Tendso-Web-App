import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { usePushNotifications } from '../hooks/usePushNotifications';

let mockCreatorId: string | undefined;
let mockIsDevice = true;
let mockProjectId: string | undefined = 'test-project';
const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockSetChannel = jest.fn();
const mockGetToken = jest.fn();
const mockRegisterToken = jest.fn();
let mockMutation: (...args: any[]) => any = mockRegisterToken;

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetChannel(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetToken(...args),
  AndroidImportance: { MAX: 5 },
}));
jest.mock('expo-device', () => ({ get isDevice() { return mockIsDevice; } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: {
  get expoConfig() { return { extra: { eas: { projectId: mockProjectId } } }; },
} }));
jest.mock('convex/react', () => ({ useMutation: () => mockMutation }));
jest.mock('@tendso/convex-client', () => ({ api: { notifications: { registerPushToken: 'register-token' } } }));

type Actor = NonNullable<Parameters<typeof usePushNotifications>[0]>;
const openHook = () => renderHook(() => usePushNotifications(mockCreatorId as Actor | undefined));
const settle = async () => { await act(async () => { for (let index = 0; index < 15; index++) await Promise.resolve(); }); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const originalPlatform = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockCreatorId = 'agent-a'; mockIsDevice = true; mockProjectId = 'test-project';
  mockMutation = mockRegisterToken;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockGetPermissions.mockReset().mockResolvedValue({ status: 'granted' });
  mockRequestPermissions.mockReset().mockResolvedValue({ status: 'granted' });
  mockSetChannel.mockReset().mockResolvedValue(undefined);
  mockGetToken.mockReset().mockResolvedValue({ data: 'ExpoPushToken[test-device]' });
  mockRegisterToken.mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  jest.restoreAllMocks();
});

it('registers once for the current actor and registers again after account changes or sign-out', async () => {
  const hook = openHook(); await settle();
  expect(mockGetToken).toHaveBeenCalledWith({ projectId: 'test-project' });
  expect(mockRegisterToken).toHaveBeenLastCalledWith({ creatorId: 'agent-a', token: 'ExpoPushToken[test-device]', platform: 'ios' });
  hook.rerender(); await settle();
  expect(mockRegisterToken).toHaveBeenCalledTimes(1);
  mockCreatorId = 'agent-b'; hook.rerender(); await settle();
  expect(mockRegisterToken).toHaveBeenLastCalledWith(expect.objectContaining({ creatorId: 'agent-b' }));
  mockCreatorId = undefined; hook.rerender(); await settle();
  mockCreatorId = 'agent-b'; hook.rerender(); await settle();
  expect(mockRegisterToken).toHaveBeenCalledTimes(3);
  expect(console.log).not.toHaveBeenCalled();
});

it.each(['signed out', 'simulator', 'missing project'])('does not request native permission when %s', async state => {
  if (state === 'signed out') mockCreatorId = undefined;
  if (state === 'simulator') mockIsDevice = false;
  if (state === 'missing project') mockProjectId = undefined;
  openHook(); await settle();
  expect(mockGetPermissions).not.toHaveBeenCalled();
  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(mockGetToken).not.toHaveBeenCalled();
  expect(mockRegisterToken).not.toHaveBeenCalled();
});

it('stops after denied permission without fetching or registering a token', async () => {
  mockGetPermissions.mockResolvedValue({ status: 'undetermined' });
  mockRequestPermissions.mockResolvedValue({ status: 'denied' });
  openHook(); await settle();
  expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
  expect(mockGetToken).not.toHaveBeenCalled();
  expect(mockRegisterToken).not.toHaveBeenCalled();
  expect(console.error).not.toHaveBeenCalled();
});

it('creates the Android channel before requesting the Expo token', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  openHook(); await settle();
  expect(mockSetChannel).toHaveBeenCalledWith('default', expect.objectContaining({ name: 'Default', importance: 5 }));
  expect(mockSetChannel.mock.invocationCallOrder[0]).toBeLessThan(mockGetToken.mock.invocationCallOrder[0]);
  expect(mockRegisterToken).toHaveBeenCalledWith(expect.objectContaining({ platform: 'android' }));
});

it.each(['permission', 'request', 'channel', 'token'])('cancels the old actor after the pending %s phase', async phase => {
  const pending = deferred<any>();
  const target = phase === 'permission' ? mockGetPermissions : phase === 'request' ? mockRequestPermissions
    : phase === 'channel' ? mockSetChannel : mockGetToken;
  if (phase === 'request') mockGetPermissions.mockResolvedValueOnce({ status: 'undetermined' });
  if (phase === 'channel') Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  target.mockImplementationOnce(() => pending.promise);
  const hook = openHook();
  await waitFor(() => expect(target).toHaveBeenCalledTimes(1));
  mockCreatorId = 'agent-b'; hook.rerender(); await settle();
  expect(mockRegisterToken).toHaveBeenCalledWith(expect.objectContaining({ creatorId: 'agent-b' }));
  await act(async () => { pending.resolve(phase === 'token' ? { data: 'ExpoPushToken[old-actor]' }
    : phase === 'channel' ? undefined : { status: 'granted' }); });
  expect(mockRegisterToken.mock.calls.map(call => call[0].creatorId)).toEqual(['agent-b']);
  expect(console.log).not.toHaveBeenCalled();
});

it('does not register or log a token returned after unmount', async () => {
  const pending = deferred<{ data: string }>();
  mockGetToken.mockReturnValueOnce(pending.promise);
  const hook = openHook();
  await waitFor(() => expect(mockGetToken).toHaveBeenCalledTimes(1));
  hook.unmount();
  await act(async () => { pending.resolve({ data: 'ExpoPushToken[unmounted-device]' }); });
  expect(mockRegisterToken).not.toHaveBeenCalled();
  expect(console.log).not.toHaveBeenCalled(); expect(console.error).not.toHaveBeenCalled();
});

it('does not overwrite the new actor registration when the old server request resolves late', async () => {
  const pending = deferred<void>();
  mockRegisterToken.mockImplementationOnce(() => pending.promise);
  const hook = openHook(); await settle();
  expect(mockRegisterToken).toHaveBeenCalledWith(expect.objectContaining({ creatorId: 'agent-a' }));
  mockCreatorId = 'agent-b'; hook.rerender(); await settle();
  expect(mockRegisterToken).toHaveBeenCalledWith(expect.objectContaining({ creatorId: 'agent-b' }));
  await act(async () => { pending.resolve(); });
  mockMutation = (...args: unknown[]) => mockRegisterToken(...args);
  hook.rerender(); await settle();
  expect(mockRegisterToken.mock.calls.map(call => call[0].creatorId)).toEqual(['agent-a', 'agent-b']);
});

it.each(['permission', 'request', 'channel', 'token', 'mutation'])('handles %s failures without leaking native error payloads', async phase => {
  const target = phase === 'permission' ? mockGetPermissions : phase === 'request' ? mockRequestPermissions
    : phase === 'channel' ? mockSetChannel : phase === 'token' ? mockGetToken : mockRegisterToken;
  if (phase === 'request') mockGetPermissions.mockResolvedValue({ status: 'undetermined' });
  if (phase === 'channel') Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  target.mockRejectedValueOnce(new Error('ExpoPushToken[private-device-value]'));
  openHook(); await settle();
  expect(console.error).toHaveBeenCalledTimes(1);
  expect(console.error).toHaveBeenCalledWith('[Push] Could not register notifications.');
  expect(console.log).not.toHaveBeenCalled();
});

it('rejects an empty token instead of registering an unusable value', async () => {
  mockGetToken.mockResolvedValue({ data: '' });
  openHook(); await settle();
  expect(mockRegisterToken).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledWith('[Push] Could not register notifications.');
});

it('does not mark a failed actor registered when the registration effect is retried', async () => {
  mockGetToken.mockRejectedValueOnce(new Error('Temporary native failure'));
  const hook = openHook(); await settle();
  expect(mockRegisterToken).not.toHaveBeenCalled();
  mockMutation = (...args: unknown[]) => mockRegisterToken(...args);
  hook.rerender(); await settle();
  expect(mockRegisterToken).toHaveBeenCalledTimes(1);
  expect(mockRegisterToken).toHaveBeenCalledWith(expect.objectContaining({ creatorId: 'agent-a' }));
});
