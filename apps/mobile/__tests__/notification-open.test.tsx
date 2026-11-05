import React from 'react';
import { act, render } from '@testing-library/react-native';
import { NotificationResponseOpener } from '../hooks/useNotificationOpen';
import { notificationOpenTarget, notificationRouteId } from '../services/notificationOpening';

const mockNavigate = jest.fn();
const mockRouter = { navigate: mockNavigate };
const mockQuery = jest.fn();
const mockClient = { query: mockQuery };
const mockRemove = jest.fn();
const mockClear = jest.fn();
let mockLast: any = null;
let mockReceive: ((response: any) => void) | null = null;
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('convex/react', () => ({ useConvex: () => mockClient }));
jest.mock('@tendso/convex-client', () => ({ api: { notifications: { getDetails: 'notifications:details' } } }));
jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'default',
  addNotificationResponseReceivedListener: (listener: (response: any) => void) => { mockReceive = listener; return { remove: mockRemove }; },
  getLastNotificationResponse: () => mockLast,
  clearLastNotificationResponse: () => { mockClear(); mockLast = null; },
}));

const props = { creatorId: 'creator-1' as never, subject: 'subject-1' };
const detail = { _id: 'notice-1', creatorId: 'creator-1', body: 'Full owned message', read: false };
const response = (data: unknown = { notificationId: 'notice-1', creatorId: 'creator-1' }, identifier = 'delivery-1', actionIdentifier = 'default') => ({
  actionIdentifier, notification: { request: { identifier, content: { data } } },
});
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const tap = (value: any) => { mockLast = value; mockReceive!(value); };

beforeEach(() => {
  jest.clearAllMocks();
  mockLast = null;
  mockReceive = null;
  mockQuery.mockReset().mockResolvedValue(detail);
});

it('verifies a cold-start response and opens its shared inbox message once despite the live duplicate', async () => {
  mockLast = response({ notificationId: 'notice-1', creatorId: 'creator-1', url: '/admin/private' });
  const cached = mockLast;
  render(<NotificationResponseOpener {...props} />);
  mockReceive!(cached);
  expect(mockQuery).toHaveBeenCalledTimes(1);
  expect(mockQuery).toHaveBeenCalledWith('notifications:details', { id: 'notice-1' });
  expect(mockNavigate).not.toHaveBeenCalled();
  await act(flush);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/(app)/notifications', params: {
    notificationId: 'notice-1', notificationOpenKey: JSON.stringify(['delivery-1', 'default']),
  } });
  expect(mockClear).toHaveBeenCalledTimes(1);
  mockReceive!(cached);
  await act(flush);
  expect(mockQuery).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('handles foreground taps and permits a legacy ID-only payload only after server ownership verification', async () => {
  render(<NotificationResponseOpener {...props} />);
  tap(response({ notificationId: 'notice-1' }));
  await act(flush);
  expect(mockQuery).toHaveBeenCalledWith('notifications:details', { id: 'notice-1' });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it.each([
  { name: 'foreign recipient', data: { notificationId: 'notice-1', creatorId: 'creator-2' }, action: 'default' },
  { name: 'payload URL only', data: { url: 'https://example.test/admin' }, action: 'default' },
  { name: 'malformed notification ID', data: { notificationId: 'https://example.test' }, action: 'default' },
  { name: 'malformed recipient', data: { notificationId: 'notice-1', creatorId: {} }, action: 'default' },
  { name: 'unsupported custom action', data: { notificationId: 'notice-1', creatorId: 'creator-1' }, action: 'dismiss' },
])('does not query or navigate for $name', async ({ data, action }) => {
  mockLast = response(data, 'delivery-1', action);
  render(<NotificationResponseOpener {...props} />);
  await act(flush);
  expect(mockQuery).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockClear).toHaveBeenCalledTimes(1);
});

it.each([null, { ...detail, creatorId: 'creator-2' }, { ...detail, _id: 'notice-other' }])('never navigates when the authoritative row is missing or belongs elsewhere: %j', async value => {
  mockQuery.mockResolvedValue(value);
  mockLast = response();
  render(<NotificationResponseOpener {...props} />);
  await act(flush);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockClear).toHaveBeenCalledTimes(1);
});

it('keeps temporary verification failures retryable on the next authorized mount', async () => {
  mockQuery.mockRejectedValue(new Error('Offline'));
  mockLast = response();
  const view = render(<NotificationResponseOpener {...props} />);
  await act(flush);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockClear).not.toHaveBeenCalled();
  view.unmount();
  expect(mockRemove).toHaveBeenCalledTimes(1);
  mockQuery.mockResolvedValue(detail);
  render(<NotificationResponseOpener {...props} />);
  await act(flush);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('cancels an in-flight ownership result and removes the listener on logout/unmount', async () => {
  let resolve!: (value: typeof detail) => void;
  mockQuery.mockReturnValue(new Promise(done => { resolve = done; }));
  mockLast = response();
  const view = render(<NotificationResponseOpener {...props} />);
  const oldListener = mockReceive!;
  view.unmount();
  await act(async () => { resolve(detail); await flush(); });
  oldListener(response());
  expect(mockRemove).toHaveBeenCalledTimes(1);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockQuery).toHaveBeenCalledTimes(1);
});

it('rejects stale verification after an account switch and never opens the previous account message', async () => {
  let resolve!: (value: typeof detail) => void;
  mockQuery.mockReturnValue(new Promise(done => { resolve = done; }));
  mockLast = response();
  const view = render(<NotificationResponseOpener {...props} />);
  view.rerender(<NotificationResponseOpener creatorId={'creator-2' as never} subject="subject-2" />);
  await act(async () => { resolve(detail); await flush(); });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockQuery).toHaveBeenCalledTimes(1);
  expect(mockRemove).toHaveBeenCalledTimes(1);
});

it('opens the latest tap only and does not clear it when an older verification resolves first', async () => {
  const resolvers: Array<(value: typeof detail) => void> = [];
  mockQuery.mockImplementation(() => new Promise(done => { resolvers.push(done); }));
  render(<NotificationResponseOpener {...props} />);
  tap(response());
  tap(response({ notificationId: 'notice-2', creatorId: 'creator-1' }, 'delivery-2'));
  await act(async () => { resolvers[0](detail); await flush(); });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockClear).not.toHaveBeenCalled();
  expect(mockLast.notification.request.identifier).toBe('delivery-2');
  await act(async () => { resolvers[1]({ ...detail, _id: 'notice-2' }); await flush(); });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate.mock.calls[0][0].params.notificationId).toBe('notice-2');
  expect(mockClear).toHaveBeenCalledTimes(1);
});

it('validates route IDs without interpreting arrays, whitespace or URLs as destinations', () => {
  expect(notificationRouteId(['notice-1'])).toBe('notice-1');
  for (const value of [null, {}, ['notice-1', 'notice-2'], ' notice-1', '../admin', 'https://example.test', 'n'.repeat(129)]) {
    expect(notificationRouteId(value)).toBeUndefined();
  }
  expect(notificationOpenTarget(response(null), 'default')).toBeNull();
  expect(notificationOpenTarget({ actionIdentifier: 'default' }, 'default')).toBeNull();
});
