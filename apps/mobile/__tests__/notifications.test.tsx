import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import NotificationsScreen from '../app/(app)/notifications';

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockMarkRead = jest.fn();
const mockMarkAllRead = jest.fn();
const mockDetailsQuery = jest.fn();
const mockParams: { notificationId?: string | string[]; notificationOpenKey?: string } = {};
let mockUser: { id: string } | null;
let mockConnected: boolean;
let mockAccounts: Record<string, any>;
let mockNotifications: Record<string, any[]>;
let mockDetails: Record<string, any>;

jest.mock('@clerk/clerk-expo', () => ({ useUser: () => ({ user: mockUser }) }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('@tendso/convex-client', () => ({ api: {
  creators: { getByClerkId: 'account' },
  notifications: { getByCreator: 'inbox', getDetails: 'details', markAsRead: 'read', markAllAsRead: 'read-all' },
} }));
jest.mock('convex/react', () => ({
  useQuery: (reference: string, args: any) => {
    if (args === 'skip') return undefined;
    if (reference === 'account') return mockAccounts[args.clerkId] ?? null;
    if (reference === 'inbox') return mockNotifications[args.creatorId];
    if (reference === 'details') {
      mockDetailsQuery(args);
      return mockDetails[args.id];
    }
    throw new Error('Unexpected query ' + reference);
  },
  useMutation: (reference: string) => {
    if (reference === 'read') return mockMarkRead;
    if (reference === 'read-all') return mockMarkAllRead;
    throw new Error('Unexpected mutation ' + reference);
  },
}));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('expo-media-library', () => ({ saveToLibraryAsync: jest.fn() }));
jest.mock('../components/CertificateCard', () => {
  const { createElement: makeElement, forwardRef } = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: forwardRef(({ creatorName }: { creatorName: string }, _ref: unknown) =>
    makeElement(Text, { testID: 'certificate-content' }, creatorName)) };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));

const longTitle = 'Important account update: everything you need to know before your next shop visit';
const longBody = 'Your question was answered in detail. '.repeat(12) + '\n\nKeep this final paragraph available while you visit the shop.';
function notification(overrides: Record<string, unknown> = {}) {
  return { _id: 'notice-1', _creationTime: 1, creatorId: 'agent-1', type: 'system',
    title: longTitle, body: longBody, read: false, sentAt: Date.now(), ...overrides };
}
function inbox(row = notification()) {
  mockNotifications['agent-1'] = [row];
  return render(<NotificationsScreen />);
}
function open(view: ReturnType<typeof render>, row = notification()) {
  fireEvent.press(view.getByRole('button', { name: `${row.title}: ${row.body}` }));
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'clerk-agent' }; mockConnected = true;
  mockAccounts = {
    'clerk-agent': { _id: 'agent-1', role: 'creator',
      firstName: 'Pablo', lastName: 'Santos', certifiedAt: Date.UTC(2026, 9, 20) },
    'clerk-other': { _id: 'agent-2', role: 'creator', certifiedAt: Date.UTC(2026, 9, 21) },
  };
  mockNotifications = { 'agent-1': [], 'agent-2': [] };
  mockDetails = {};
  delete mockParams.notificationId;
  delete mockParams.notificationOpenKey;
  mockMarkRead.mockReset().mockResolvedValue(undefined);
  mockMarkAllRead.mockReset().mockResolvedValue(undefined);
});

it.each(['creator', 'affiliate'])('leaves a %s inbox unread when it is opened, left, and revisited', (role) => {
  mockAccounts['clerk-agent'] = { ...mockAccounts['clerk-agent'], role };
  const row = notification();
  const view = inbox(row);
  expect(view.getByLabelText('Unread')).toBeTruthy();
  expect(mockMarkRead).not.toHaveBeenCalled();
  expect(mockMarkAllRead).not.toHaveBeenCalled();

  fireEvent.press(view.getByRole('button', { name: 'Back' }));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(mockMarkRead).not.toHaveBeenCalled();
  expect(mockMarkAllRead).not.toHaveBeenCalled();

  const revisit = render(<NotificationsScreen />);
  expect(revisit.getByLabelText('Unread')).toBeTruthy();
  expect(mockMarkRead).not.toHaveBeenCalled();
  expect(mockMarkAllRead).not.toHaveBeenCalled();
});

it('updates only the opened notification from the live inbox response and keeps that state when reopened or revisited', async () => {
  const first = notification();
  const second = notification({ _id: 'notice-2', title: 'Another update', body: 'Read this one later.' });
  mockNotifications['agent-1'] = [first, second];
  const view = render(<NotificationsScreen />);
  expect(view.getAllByLabelText('Unread')).toHaveLength(2);

  open(view, first);
  expect(mockMarkRead).toHaveBeenCalledTimes(1);
  expect(mockMarkRead).toHaveBeenCalledWith({ id: first._id });
  expect(mockMarkAllRead).not.toHaveBeenCalled();
  expect(view.getByTestId('notification-full-body').props.children).toBe(first.body);

  await act(flush);
  mockNotifications['agent-1'] = [{ ...first, read: true }, second];
  view.rerender(<NotificationsScreen />);
  fireEvent.press(view.getByRole('button', { name: 'Close notification' }));
  const firstRow = view.getByRole('button', { name: `${first.title}: ${first.body}` });
  const secondRow = view.getByRole('button', { name: `${second.title}: ${second.body}` });
  expect(within(firstRow).queryByLabelText('Unread')).toBeNull();
  expect(within(secondRow).getByLabelText('Unread')).toBeTruthy();
  expect(view.getAllByLabelText('Unread')).toHaveLength(1);

  open(view, first);
  expect(view.getByTestId('notification-full-body').props.children).toBe(first.body);
  expect(mockMarkRead).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByRole('button', { name: 'Close notification' }));
  expect(view.getAllByLabelText('Unread')).toHaveLength(1);
  view.unmount();

  const revisit = render(<NotificationsScreen />);
  expect(within(revisit.getByRole('button', { name: `${first.title}: ${first.body}` })).queryByLabelText('Unread')).toBeNull();
  expect(within(revisit.getByRole('button', { name: `${second.title}: ${second.body}` })).getByLabelText('Unread')).toBeTruthy();
  expect(mockMarkAllRead).not.toHaveBeenCalled();
});

it('marks all notifications read only through the explicit action and reflects its live response', async () => {
  const rows = [notification(), notification({ _id: 'notice-2', title: 'Another update' })];
  mockNotifications['agent-1'] = rows;
  const view = render(<NotificationsScreen />);
  expect(mockMarkAllRead).not.toHaveBeenCalled();
  expect(view.getAllByLabelText('Unread')).toHaveLength(2);

  fireEvent.press(view.getByRole('link', { name: 'Mark all read' }));
  expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
  expect(mockMarkAllRead).toHaveBeenCalledWith({ creatorId: 'agent-1' });
  expect(mockMarkRead).not.toHaveBeenCalled();
  await act(flush);
  mockNotifications['agent-1'] = rows.map(row => ({ ...row, read: true }));
  view.rerender(<NotificationsScreen />);
  expect(view.queryByLabelText('Unread')).toBeNull();
  expect(view.queryByRole('link', { name: 'Mark all read' })).toBeNull();
});

it('opens a plain notification as selectable unclamped text, then closes and reopens it', () => {
  const view = inbox();
  expect(view.queryByTestId('notification-full-body')).toBeNull();
  open(view);
  const body = view.getByTestId('notification-full-body');
  expect(body.props.children).toBe(longBody);
  expect(body.props.selectable).toBe(true);
  expect(body.props.numberOfLines).toBeUndefined();
  const heading = view.getByRole('header', { name: longTitle });
  expect(heading.props.selectable).toBe(true);
  expect(heading.props.numberOfLines).toBeUndefined();
  expect(mockDetailsQuery).toHaveBeenCalledWith({ id: 'notice-1' });
  expect(mockRouter.push).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole('button', { name: 'Close notification' }));
  expect(view.queryByTestId('notification-full-body')).toBeNull();
  open(view);
  expect(view.getByTestId('notification-full-body').props.children).toBe(longBody);
});

it.each(['pending', 'rejected'])('shows details immediately while marking read is %s', async (state) => {
  mockMarkRead.mockImplementation(() => state === 'pending'
    ? new Promise(() => {}) : Promise.reject(new Error('Connection lost')));
  mockMarkAllRead.mockRejectedValue(new Error('Connection lost'));
  const view = inbox();
  open(view);
  expect(view.getByTestId('notification-full-body').props.children).toBe(longBody);
  expect(mockMarkRead).toHaveBeenCalledWith({ id: 'notice-1' });
  await act(flush);
  expect(view.getByTestId('notification-full-body')).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Close' }));
  expect(view.queryByTestId('notification-full-body')).toBeNull();
  expect(view.getByLabelText('Unread')).toBeTruthy();
  expect(view.getByRole('link', { name: 'Mark all read' })).toBeTruthy();
  expect(mockMarkAllRead).not.toHaveBeenCalled();

  open(view);
  expect(mockMarkRead).toHaveBeenCalledTimes(2);
  expect(mockMarkRead).toHaveBeenLastCalledWith({ id: 'notice-1' });
  await act(flush);
  expect(view.getByTestId('notification-full-body').props.children).toBe(longBody);
});

it('replaces an announcement preview with its resolved original paragraphs', () => {
  const row = notification({ body: 'A short announcement preview.', data: { announcementId: 'broadcast-1' } });
  const view = inbox(row);
  open(view, row);
  expect(view.getByText(/Loading the full message/)).toBeTruthy();
  expect(view.getByTestId('notification-full-body').props.children).toBe(row.body);
  mockDetails['notice-1'] = { ...row, body: longBody };
  view.rerender(<NotificationsScreen />);
  expect(view.getByTestId('notification-full-body').props.children).toBe(longBody);
  expect(view.queryByText(/Loading the full message/)).toBeNull();
});

it('labels an offline announcement preview and still permits closing it', () => {
  mockConnected = false;
  const row = notification({ body: 'Available inbox preview.', data: { announcementId: 'broadcast-1' } });
  const view = inbox(row);
  open(view, row);
  expect(view.getByTestId('notification-full-body').props.children).toBe(row.body);
  expect(view.getByText('Connect to read the full announcement.')).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Close notification' }));
  expect(view.queryByTestId('notification-full-body')).toBeNull();
});

it('keeps the selected message readable if the detail query no longer finds its server row', () => {
  mockDetails['notice-1'] = null;
  const view = inbox();
  open(view);
  expect(view.getByTestId('notification-full-body').props.children).toBe(longBody);
  expect(mockRouter.push).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole('button', { name: 'Close notification' }));
  expect(view.queryByTestId('notification-full-body')).toBeNull();
});

it('reads a certification message first and opens the certificate only through its explicit action', () => {
  const row = notification({ type: 'certification', data: { showCertificate: true } });
  const view = inbox(row);
  open(view, row);
  expect(view.getByTestId('notification-full-body')).toBeTruthy();
  expect(view.queryByTestId('certificate-content')).toBeNull();
  expect(mockRouter.push).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole('button', { name: 'View certificate' }));
  expect(view.getByTestId('certificate-content').props.children).toBe('PABLO SANTOS');
  expect(view.getByText('My certificate')).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Close certificate' }));
  expect(view.queryByTestId('certificate-content')).toBeNull();
});

it('opens a knowledge article only when Read article is pressed and passes its slug as a route parameter', () => {
  const row = notification({ data: { articleSlug: '  recording-clear-audio  ' } });
  const view = inbox(row);
  open(view, row);
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(view.getByTestId('notification-full-body')).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Read article' }));
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/(app)/(tabs)/knowledge/article/[slug]', params: { slug: 'recording-clear-audio' },
  });
  expect(view.queryByTestId('notification-full-body')).toBeNull();
});

it('lets an affiliate read payload-bearing notices without field-agent navigation or certificate actions', () => {
  mockAccounts['clerk-agent'] = { ...mockAccounts['clerk-agent'], role: 'affiliate' };
  const row = notification({ data: { submissionId: 'submission-1', articleSlug: 'agent-guide', showCertificate: true } });
  const view = inbox(row);
  open(view, row);
  expect(view.getByTestId('notification-full-body').props.children).toBe(longBody);
  expect(view.queryByRole('button', { name: 'View certificate' })).toBeNull();
  expect(view.queryByRole('button', { name: 'Read article' })).toBeNull();
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it.each(['pending', 'rejected'])('lets a %s field agent read without offering certification or knowledge actions', (state) => {
  mockAccounts['clerk-agent'] = {
    ...mockAccounts['clerk-agent'],
    certifiedAt: state === 'pending' ? undefined : Date.UTC(2026, 9, 20),
    rejectedAt: state === 'rejected' ? Date.UTC(2026, 9, 21) : undefined,
  };
  const row = notification({ data: { showCertificate: true, articleSlug: 'agent-guide' } });
  const view = inbox(row);
  open(view, row);
  expect(view.getByTestId('notification-full-body').props.children).toBe(longBody);
  expect(view.queryByRole('button', { name: 'View certificate' })).toBeNull();
  expect(view.queryByRole('button', { name: 'Read article' })).toBeNull();
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it('clears selected messages on an account switch and never reopens the previous account message', () => {
  const view = inbox();
  open(view);
  expect(view.getByTestId('notification-full-body')).toBeTruthy();
  mockUser = { id: 'clerk-other' };
  view.rerender(<NotificationsScreen />);
  expect(view.getByText('No notifications yet')).toBeTruthy();
  expect(view.queryByTestId('notification-full-body')).toBeNull();
  expect(view.queryByText(longTitle)).toBeNull();
  mockUser = { id: 'clerk-agent' };
  view.rerender(<NotificationsScreen />);
  expect(view.queryByTestId('notification-full-body')).toBeNull();
});

it('removes the selected message immediately on sign out', () => {
  const view = inbox();
  open(view);
  mockUser = null;
  view.rerender(<NotificationsScreen />);
  expect(view.queryByTestId('notification-full-body')).toBeNull();
  expect(view.queryByText(longTitle)).toBeNull();
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it('renders an empty inbox without offering a detail modal', () => {
  const view = render(<NotificationsScreen />);
  expect(view.getByText('No notifications yet')).toBeTruthy();
  expect(view.queryByTestId('notification-full-body')).toBeNull();
  expect(mockDetailsQuery).not.toHaveBeenCalled();
});

it('auto-opens only the requested owned push message after the inbox resolves and reads no other rows', async () => {
  const first = notification();
  const second = notification({ _id: 'notice-2', title: 'The tapped message', body: 'Its complete details.' });
  mockParams.notificationId = second._id;
  mockParams.notificationOpenKey = 'delivery-1';
  mockNotifications['agent-1'] = undefined as never;
  const view = render(<NotificationsScreen />);
  expect(mockMarkRead).not.toHaveBeenCalled();
  mockNotifications['agent-1'] = [first, second];
  view.rerender(<NotificationsScreen />);
  expect(view.getByTestId('notification-full-body').props.children).toBe(second.body);
  expect(mockMarkRead).toHaveBeenCalledTimes(1);
  expect(mockMarkRead).toHaveBeenCalledWith({ id: second._id });
  expect(mockMarkAllRead).not.toHaveBeenCalled();
  await act(flush);
  mockNotifications['agent-1'] = [first, { ...second, read: true }];
  view.rerender(<NotificationsScreen />);
  expect(within(view.getByRole('button', { name: `${first.title}: ${first.body}` })).getByLabelText('Unread')).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Close notification' }));
  view.rerender(<NotificationsScreen />);
  expect(view.queryByTestId('notification-full-body')).toBeNull();
  expect(mockMarkRead).toHaveBeenCalledTimes(1);
  // A distinct delivery may intentionally reopen this same (already-read) message.
  mockParams.notificationOpenKey = 'delivery-2';
  view.rerender(<NotificationsScreen />);
  expect(view.getByTestId('notification-full-body').props.children).toBe(second.body);
  expect(mockMarkRead).toHaveBeenCalledTimes(1);
});

it.each([{ target: 'notice-foreign' }, { target: 'https://example.test' }, { target: ['notice-1', 'notice-2'] }])('ignores an unavailable, foreign or malformed notification target $target', ({ target }) => {
  mockParams.notificationId = target;
  mockNotifications['agent-1'] = [notification()];
  mockNotifications['agent-2'] = [notification({ _id: 'notice-foreign', creatorId: 'agent-2' })];
  const view = render(<NotificationsScreen />);
  expect(view.queryByTestId('notification-full-body')).toBeNull();
  expect(mockMarkRead).not.toHaveBeenCalled();
  expect(mockDetailsQuery).not.toHaveBeenCalled();
  expect(mockMarkAllRead).not.toHaveBeenCalled();
});

it('does not reopen the previous recipient’s auto-open target after changing accounts', () => {
  mockParams.notificationId = 'notice-1';
  const view = inbox();
  expect(view.getByTestId('notification-full-body')).toBeTruthy();
  mockUser = { id: 'clerk-other' };
  view.rerender(<NotificationsScreen />);
  expect(view.queryByTestId('notification-full-body')).toBeNull();
  expect(mockMarkRead).toHaveBeenCalledTimes(1);
  expect(mockMarkAllRead).not.toHaveBeenCalled();
});
