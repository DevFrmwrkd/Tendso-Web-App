import { unregisterPushBeforeSignOut } from '../services/pushSignOut';

let mockIsDevice = true;
let mockProjectId: string | undefined = 'test-project';
let mockFallbackProjectId: string | undefined;
const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetToken = jest.fn();
const removeToken = jest.fn();
jest.mock('expo-device', () => ({ get isDevice() { return mockIsDevice; } }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetToken(...args),
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: {
  get expoConfig() { return { extra: { eas: { projectId: mockProjectId } } }; },
  get easConfig() { return { projectId: mockFallbackProjectId }; },
} }));

type Actor = NonNullable<Parameters<typeof unregisterPushBeforeSignOut>[0]['creatorId']>;
const creatorId = 'agent-a' as Actor;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const settle = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  mockIsDevice = true; mockProjectId = 'test-project'; mockFallbackProjectId = undefined;
  mockGetPermissions.mockReset().mockResolvedValue({ status: 'granted' });
  mockGetToken.mockReset().mockResolvedValue({ data: 'ExpoPushToken[test-device]' });
  removeToken.mockReset().mockResolvedValue(undefined);
});
afterEach(() => jest.useRealTimers());

it('removes the existing granted device token with the expected account before sign-out continues', async () => {
  await unregisterPushBeforeSignOut({ creatorId, removeToken, isCurrent: () => true });
  expect(mockGetToken).toHaveBeenCalledWith({ projectId: 'test-project' });
  expect(removeToken).toHaveBeenCalledWith({ token: 'ExpoPushToken[test-device]', expectedCreatorId: creatorId });
  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it.each(['signed out', 'simulator', 'missing project', 'stale account'])('skips native work for %s', async state => {
  if (state === 'simulator') mockIsDevice = false;
  if (state === 'missing project') mockProjectId = undefined;
  await unregisterPushBeforeSignOut({ creatorId: state === 'signed out' ? undefined : creatorId,
    removeToken, isCurrent: () => state !== 'stale account' });
  expect(mockGetPermissions).not.toHaveBeenCalled();
  expect(mockGetToken).not.toHaveBeenCalled(); expect(removeToken).not.toHaveBeenCalled();
  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it('uses the linked EAS fallback project when expoConfig has none', async () => {
  mockProjectId = undefined; mockFallbackProjectId = 'fallback-project';
  await unregisterPushBeforeSignOut({ creatorId, removeToken, isCurrent: () => true });
  expect(mockGetToken).toHaveBeenCalledWith({ projectId: 'fallback-project' });
  expect(removeToken).toHaveBeenCalledTimes(1);
});

it.each(['denied', 'undetermined'])('does not request permission while signing out with %s permission', async status => {
  mockGetPermissions.mockResolvedValue({ status });
  await unregisterPushBeforeSignOut({ creatorId, removeToken, isCurrent: () => true });
  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(mockGetToken).not.toHaveBeenCalled(); expect(removeToken).not.toHaveBeenCalled();
});

it.each(['permission', 'token'])('does not advance after the account changes during %s lookup', async phase => {
  let current = true;
  const pending = deferred<any>();
  const target = phase === 'permission' ? mockGetPermissions : mockGetToken;
  target.mockReturnValueOnce(pending.promise);
  const cleanup = unregisterPushBeforeSignOut({ creatorId, removeToken, isCurrent: () => current });
  await settle(); expect(target).toHaveBeenCalledTimes(1);
  current = false;
  pending.resolve(phase === 'permission' ? { status: 'granted' } : { data: 'ExpoPushToken[old-device]' });
  await cleanup;
  expect(removeToken).not.toHaveBeenCalled();
  if (phase === 'permission') expect(mockGetToken).not.toHaveBeenCalled();
});

it.each(['permission', 'token', 'network'])('finishes within 1500 ms when %s never resolves and ignores late results', async phase => {
  const pending = deferred<any>();
  const target = phase === 'permission' ? mockGetPermissions : phase === 'token' ? mockGetToken : removeToken;
  target.mockReturnValueOnce(pending.promise);
  let finished = false;
  const cleanup = unregisterPushBeforeSignOut({ creatorId, removeToken, isCurrent: () => true }).then(() => { finished = true; });
  await settle(); expect(target).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1499); await settle(); expect(finished).toBe(false);
  jest.advanceTimersByTime(1); await cleanup; expect(finished).toBe(true);
  const startedRemovals = removeToken.mock.calls.length;
  pending.resolve(phase === 'permission' ? { status: 'granted' } : phase === 'token' ? { data: 'ExpoPushToken[late-device]' } : undefined);
  await settle();
  expect(removeToken).toHaveBeenCalledTimes(startedRemovals);
  if (phase === 'permission') expect(mockGetToken).not.toHaveBeenCalled();
});

it.each(['permission', 'token', 'network'])('allows sign-out after a %s failure', async phase => {
  const target = phase === 'permission' ? mockGetPermissions : phase === 'token' ? mockGetToken : removeToken;
  target.mockRejectedValueOnce(new Error('Native or network unavailable'));
  await expect(unregisterPushBeforeSignOut({ creatorId, removeToken, isCurrent: () => true })).resolves.toBeUndefined();
  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it('does not register or remove an empty token', async () => {
  mockGetToken.mockResolvedValue({ data: '' });
  await unregisterPushBeforeSignOut({ creatorId, removeToken, isCurrent: () => true });
  expect(removeToken).not.toHaveBeenCalled();
  expect(mockRequestPermissions).not.toHaveBeenCalled();
});
