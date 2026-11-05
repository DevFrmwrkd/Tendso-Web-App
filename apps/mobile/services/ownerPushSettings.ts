import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

type Preference = { enabled: boolean; token?: string };
type Current = () => boolean;
type Register = (args: { token: string; platform: 'ios' | 'android'; clerkId: string; enabled?: boolean }) => Promise<unknown>;
type Remove = (args: { token: string; clerkId?: string }) => Promise<unknown>;
export type OwnerPushState = 'enabled' | 'quiet' | 'off' | 'blocked' | 'not-enabled' | 'unavailable';
const preferences = new Map<string, Preference>();
const desired = new Map<string, boolean>();
// The Expo token belongs to this installation. Serialize across accounts too:
// an old in-flight registration must finish before a new owner claims the device.
let deviceQueue: Promise<unknown> = Promise.resolve();
const keyFor = (subject: string) => `tendso-owner-push:v1:${subject}`;
const projectId = () => Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
const available = () => Device.isDevice && Platform.OS !== 'web' && !!projectId();

async function preference(subject: string): Promise<Preference> {
  const cached = preferences.get(subject);
  if (cached) return cached;
  const raw = await AsyncStorage.getItem(keyFor(subject));
  let result: Preference = { enabled: true };
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('enabled' in parsed) || typeof parsed.enabled !== 'boolean') throw new Error('Your notification preference could not be read. Try again.');
    result = { enabled: parsed.enabled, token: 'token' in parsed && typeof parsed.token === 'string' ? parsed.token : undefined };
  }
  const newer = preferences.get(subject);
  if (newer) return newer;
  if (desired.has(subject)) result.enabled = desired.get(subject)!;
  preferences.set(subject, result);
  return result;
}
async function save(subject: string, value: Preference) {
  preferences.set(subject, value);
  await AsyncStorage.setItem(keyFor(subject), JSON.stringify(value));
}
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = deviceQueue.catch(() => {}).then(operation);
  deviceQueue = next;
  void next.finally(() => { if (deviceQueue === next) deviceQueue = Promise.resolve(); }).catch(() => {});
  return next;
}
function permitted(permission: Notifications.NotificationPermissionsStatus) {
  const ios = permission.ios?.status;
  return permission.status === 'granted' || ios !== undefined && [Notifications.IosAuthorizationStatus?.AUTHORIZED,
    Notifications.IosAuthorizationStatus?.PROVISIONAL, Notifications.IosAuthorizationStatus?.EPHEMERAL].includes(ios);
}
async function permission(prompt: boolean, current: Current) {
  if (!available() || !current()) return null;
  // Android needs a channel before requesting notification permission / its device token.
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Updates', importance: Notifications.AndroidImportance.DEFAULT });
  if (!current()) return null;
  let result = await Notifications.getPermissionsAsync();
  if (!current()) return null;
  if (!permitted(result) && prompt && result.canAskAgain) result = await Notifications.requestPermissionsAsync();
  if (!current()) return null;
  const channel = Platform.OS === 'android' ? await Notifications.getNotificationChannelAsync('default') : null;
  return current() ? { value: result, channelBlocked: channel?.importance === Notifications.AndroidImportance.NONE } : null;
}
async function tokenFor(permissionResult: Awaited<ReturnType<typeof permission>>, current: Current) {
  if (!permissionResult || !permitted(permissionResult.value) || permissionResult.channelBlocked || !current()) return null;
  const token = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  return current() ? token.data : null;
}

/** Compatibility helper: only explicit user action may ask for OS permission. */
export async function ownerDeviceToken(prompt: boolean, current: Current): Promise<string | null> {
  return tokenFor(await permission(prompt, current), current);
}

async function claimDisabled(register: Register, subject: string, pref: Preference, current: Current): Promise<OwnerPushState | null> {
  let fresh: string | null = null;
  try { fresh = await ownerDeviceToken(false, current); } catch { /* Cached token remains usable after permission revocation or OS lookup failure. */ }
  if (!current()) return null;
  const tokens = [...new Set([fresh, pref.token].filter((token): token is string => !!token))];
  await save(subject, { enabled: false, token: fresh ?? pref.token });
  if (!current()) return null;
  // A shared device may still be subscribed to the previous owner after an offline
  // logout. Claiming it inactive detaches that owner atomically, without enabling B.
  for (const token of tokens) {
    if (!current()) return null;
    await register({ token, platform: Platform.OS as 'ios' | 'android', clerkId: subject, enabled: false });
  }
  return current() ? tokens.length ? 'off' : available() ? 'blocked' : 'unavailable' : null;
}

/** Refresh OS state and confirm registration with the backend, without ever sending a test push. */
export function syncOwnerPush(register: Register, subject: string, prompt: boolean, current: Current): Promise<OwnerPushState | null> {
  if (prompt && current()) desired.set(subject, true);
  return serialize(async () => {
    if (!current()) return null;
    const pref = await preference(subject);
    if (!current()) return null;
    if (prompt) { await save(subject, { ...pref, enabled: true }); if (!current()) return null; }
    if ((desired.get(subject) ?? pref.enabled) === false) {
      return claimDisabled(register, subject, pref, current);
    }
    if (!available()) return 'unavailable';
    const permissionResult = await permission(prompt, current);
    if (!permissionResult || !current()) return null;
    if (!permitted(permissionResult.value) || permissionResult.channelBlocked) {
      return permissionResult.value.canAskAgain && !permissionResult.channelBlocked ? 'not-enabled' : 'blocked';
    }
    const token = await tokenFor(permissionResult, current);
    if (!token || !current()) return null;
    if (desired.get(subject) === false) return null;
    // Save the token before registration: a lost response or later OS revocation must remain removable.
    await save(subject, { enabled: true, token });
    if (!current() || desired.get(subject) === false) return null;
    await register({ token, platform: Platform.OS as 'ios' | 'android', clerkId: subject });
    if (!current() || desired.get(subject) === false) return null;
    const ios = permissionResult.value.ios;
    return ios && (ios.status === Notifications.IosAuthorizationStatus.PROVISIONAL || ios.allowsAlert === false) ? 'quiet' : 'enabled';
  });
}

/** Persist opt-out, then atomically detach the installation from every prior owner. */
export function disableOwnerPush(register: Register, subject: string, current: Current): Promise<OwnerPushState | null> {
  if (!current()) return Promise.resolve(null);
  desired.set(subject, false);
  return serialize(async () => {
    if (!current()) return null;
    const pref = await preference(subject);
    if (!current()) return null;
    return claimDisabled(register, subject, pref, current);
  });
}

/** Logout uses the cached token even after OS permission has been revoked. */
export async function unregisterOwnerPush(remove: Remove, subject: string | null | undefined, current: Current) {
  if (!subject) return;
  let active = true; let timeout: ReturnType<typeof setTimeout> | undefined;
  const valid = () => active && current();
  const work = serialize(async () => {
    const pref = await preference(subject);
    if (!valid()) return;
    const token = pref.token ?? await ownerDeviceToken(false, valid);
    if (token && valid()) await remove({ token, clerkId: subject });
  }).catch(() => {}); // Logout still works offline; OS permission is never requested.
  try { await Promise.race([work, new Promise<void>(resolve => { timeout = setTimeout(() => { active = false; resolve(); }, 1500); })]); }
  finally { active = false; if (timeout) clearTimeout(timeout); }
}
