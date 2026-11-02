import type { OptimisticLocalStore } from 'convex/browser';
import { api, type Id } from '@tendso/convex-client';

/** Update only the signed-in inbox; Convex restores server state on failure. */
export function optimisticNotificationRead(store: OptimisticLocalStore, creatorId: Id<'creators'> | undefined,
  notificationId?: Id<'notifications'>) {
  if (!creatorId) return;
  const args = { creatorId };
  const inbox = store.getQuery(api.notifications.getByCreator, args);
  if (!inbox) return;
  const changed = inbox.filter(row => row.creatorId === creatorId && !row.read && (!notificationId || row._id === notificationId));
  if (!changed.length) return;
  const ids = new Set(changed.map(row => row._id));
  store.setQuery(api.notifications.getByCreator, args, inbox.map(row => ids.has(row._id) ? { ...row, read: true } : row));
  const count = store.getQuery(api.notifications.getUnreadCount, args);
  if (typeof count === 'number') store.setQuery(api.notifications.getUnreadCount, args, Math.max(0, count - changed.length));
  for (const row of changed) {
    const details = store.getQuery(api.notifications.getDetails, { id: row._id });
    if (details?.creatorId === creatorId) store.setQuery(api.notifications.getDetails, { id: row._id }, { ...details, read: true });
  }
}
