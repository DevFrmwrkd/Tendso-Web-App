import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import type { Id } from '@tendso/convex-client';

type PushSignOutOptions = {
  creatorId: Id<'creators'> | undefined;
  removeToken: (args: { token: string; expectedCreatorId: Id<'creators'> }) => Promise<unknown>;
  isCurrent: () => boolean;
};

/** Stop routing this device's pushes to the account being signed out. */
export async function unregisterPushBeforeSignOut({ creatorId, removeToken, isCurrent }: PushSignOutOptions): Promise<void> {
  const deadline = Date.now() + 1500;
  let active = true;
  const current = () => active && Date.now() < deadline && isCurrent();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>(resolve => {
    timer = setTimeout(() => { active = false; resolve(); }, 1500);
  });
  const cleanup = async () => {
    try {
      if (!creatorId || !Device.isDevice || !current()) return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
      if (typeof projectId !== 'string' || !projectId.trim() || !current()) return;
      // Signing out must never trigger a new system permission prompt.
      const permission = await Notifications.getPermissionsAsync();
      if (!current() || permission.status !== 'granted') return;
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      if (!current() || typeof token !== 'string' || !token.trim()) return;
      await removeToken({ token, expectedCreatorId: creatorId });
    } catch {
      // Permission, native token and network failures must not prevent sign-out.
    }
  };
  try { await Promise.race([cleanup(), timeout]); }
  finally {
    active = false;
    if (timer !== undefined) clearTimeout(timer);
  }
}
