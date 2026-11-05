import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useConvex } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import { useGuardedRouter } from './useGuardedRouter';
import { notificationOpenTarget, notificationResponseKey } from '../services/notificationOpening';

/** Mounted once, only after AppLayout's live account and role gates have passed. */
export function NotificationResponseOpener({ creatorId, subject }: { creatorId: Id<'creators'>; subject: string }) {
  const convex = useConvex();
  const router = useGuardedRouter();
  const actor = `${subject}:${creatorId}`;
  const currentActor = useRef(actor);
  currentActor.current = actor;
  const consumed = useRef(new Set<string>());

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    let latestTap = 0;
    const pending = new Set<string>();
    const stillCurrent = () => mounted && currentActor.current === actor;
    const acknowledge = (key: string) => {
      consumed.current.add(key);
      if (consumed.current.size > 64) consumed.current.delete(consumed.current.values().next().value!);
      // Do not clear a newer tap that arrived while ownership was being checked.
      try {
        if (notificationResponseKey(Notifications.getLastNotificationResponse()) === key) {
          Notifications.clearLastNotificationResponse();
        }
      } catch { /* Unsupported native surfaces must not interrupt app navigation. */ }
    };
    const receive = (response: Notifications.NotificationResponse | null) => {
      if (!stillCurrent() || !response) return;
      const key = notificationResponseKey(response);
      if (key && (consumed.current.has(key) || pending.has(key))) return;
      const tap = ++latestTap;
      const target = notificationOpenTarget(response, Notifications.DEFAULT_ACTION_IDENTIFIER);
      if (!target || (target.creatorId && target.creatorId !== creatorId)) {
        if (key) acknowledge(key);
        return;
      }
      pending.add(target.key);
      void convex.query(api.notifications.getDetails, { id: target.notificationId as Id<'notifications'> }).then(notification => {
        if (!stillCurrent()) return;
        // The signed-in server query is authoritative; payload IDs alone never authorize access.
        if (notification?._id === target.notificationId && notification.creatorId === creatorId && tap === latestTap) {
          router.navigate({ pathname: '/(app)/notifications', params: {
            notificationId: notification._id,
            notificationOpenKey: target.key,
          } } as never);
        }
        acknowledge(target.key);
      }).catch(() => {
        // Keep the native last response retryable after a temporary connection/auth failure.
        // No navigation and no read mutation happen before successful ownership verification.
      }).finally(() => pending.delete(target.key));
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(receive);
    try { receive(Notifications.getLastNotificationResponse()); } catch { /* No cached response is available. */ }
    return () => { mounted = false; subscription.remove(); };
  }, [actor, creatorId, convex, router]);

  return null;
}
