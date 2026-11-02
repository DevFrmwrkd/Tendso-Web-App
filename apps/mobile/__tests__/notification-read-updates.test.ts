import type { OptimisticLocalStore } from 'convex/browser';
import { api } from '@tendso/convex-client';
import { optimisticNotificationRead } from '../services/notificationReadUpdates';

jest.mock('@tendso/convex-client', () => ({ api: { notifications: { getByCreator: 'inbox', getUnreadCount: 'count', getDetails: 'details' } } }));
const key = (query: unknown, args: unknown) => JSON.stringify([query, args]);
function cache() {
  const data = new Map<string, unknown>();
  const get = (query: unknown, args: unknown) => data.get(key(query, args));
  const set = (query: unknown, args: unknown, value: unknown) => data.set(key(query, args), value);
  return { get, set, store: { getQuery: get, setQuery: set } as unknown as OptimisticLocalStore };
}
const owner = 'owner' as never, other = 'other' as never;
const rows = [{ _id: 'one', creatorId: owner, read: false, body: 'Preview' }, { _id: 'two', creatorId: owner, read: false }];
it('updates the opened row, full announcement and badge without touching another message or account', () => {
  const c = cache();
  c.set(api.notifications.getByCreator, { creatorId: owner }, rows);
  c.set(api.notifications.getUnreadCount, { creatorId: owner }, 2);
  c.set(api.notifications.getByCreator, { creatorId: other }, [{ ...rows[0], creatorId: other }]);
  c.set(api.notifications.getDetails, { id: 'one' }, { ...rows[0], body: 'Full announcement' });
  optimisticNotificationRead(c.store, owner, 'one' as never);
  expect(c.get(api.notifications.getByCreator, { creatorId: owner })).toEqual([{ ...rows[0], read: true }, rows[1]]);
  expect(c.get(api.notifications.getUnreadCount, { creatorId: owner })).toBe(1);
  expect(c.get(api.notifications.getDetails, { id: 'one' })).toMatchObject({ body: 'Full announcement', read: true });
  expect(c.get(api.notifications.getByCreator, { creatorId: other })).toEqual([{ ...rows[0], creatorId: other }]);
  expect(rows[0].read).toBe(false);
  optimisticNotificationRead(c.store, owner, 'one' as never);
  expect(c.get(api.notifications.getUnreadCount, { creatorId: owner })).toBe(1);
});
it('marks all loaded owned messages only for the explicit all-read operation', () => {
  const c = cache(); const foreign = { _id: 'foreign', creatorId: other, read: false };
  c.set(api.notifications.getByCreator, { creatorId: owner }, [...rows, foreign]);
  c.set(api.notifications.getUnreadCount, { creatorId: owner }, 2);
  optimisticNotificationRead(c.store, owner);
  expect(c.get(api.notifications.getByCreator, { creatorId: owner })).toEqual([...rows.map(row => ({ ...row, read: true })), foreign]);
  expect(c.get(api.notifications.getUnreadCount, { creatorId: owner })).toBe(0);
});
it.each([undefined, 'unknown'])('does not change a badge without an owned matching message: %s', id => {
  const c = cache(); c.set(api.notifications.getUnreadCount, { creatorId: owner }, 2);
  if (id) c.set(api.notifications.getByCreator, { creatorId: owner }, rows);
  optimisticNotificationRead(c.store, owner, (id ?? 'one') as never);
  expect(c.get(api.notifications.getUnreadCount, { creatorId: owner })).toBe(2);
});
it('does nothing before ownership is resolved and never invents an unloaded count', () => {
  const c = cache(); c.set(api.notifications.getByCreator, { creatorId: owner }, rows);
  optimisticNotificationRead(c.store, undefined, 'one' as never);
  expect(c.get(api.notifications.getByCreator, { creatorId: owner })).toBe(rows);
  optimisticNotificationRead(c.store, owner, 'one' as never);
  expect(c.get(api.notifications.getUnreadCount, { creatorId: owner })).toBeUndefined();
});
it('keeps a temporarily stale count nonnegative', () => {
  const c = cache(); c.set(api.notifications.getByCreator, { creatorId: owner }, rows);
  c.set(api.notifications.getUnreadCount, { creatorId: owner }, 1);
  optimisticNotificationRead(c.store, owner);
  expect(c.get(api.notifications.getUnreadCount, { creatorId: owner })).toBe(0);
});
