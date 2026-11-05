import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import Inbox from '../app/(owner)/me/inbox';
import { ownerSiteRoute } from '../lib/v2/ownerNavigation';
import type { OwnerInbox, OwnerMessage } from '../lib/v2/ownerInbox';
import type { OwnerMe, OwnerPhase, SiteSummary, SubmissionId } from '../lib/v2/ownerTypes';

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockSelect = jest.fn(), mockMarkRead = jest.fn(), mockMarkAllRead = jest.fn();
let mockSubject = 'owner-a', mockSession = 'session-a', mockSelected = 'previous-business';
let mockMe: OwnerMe, mockInbox: OwnerInbox, mockParams: { eventKey?: string } = {};

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject, sessionId: mockSession }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../lib/v2/ownerIntake', () => ({ ownerIntake: { selectBusiness: (id: string) => mockSelect(id) } }));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => ({
  me: mockMe, site: mockMe.sites.find(site => site.submissionId === mockSelected) ?? null,
}) }));
jest.mock('../lib/v2/ownerInbox', () => ({ useOwnerInbox: () => mockInbox,
  useOwnerInboxActions: () => ({ markRead: mockMarkRead, markAllRead: mockMarkAllRead }),
}));
jest.mock('convex/react', () => ({ useMutation: () => jest.fn() }));
jest.mock('../components/v2/owner/OwnerNotificationBridge', () => ({ ownerDeviceToken: jest.fn() }));
jest.mock('../components/v2', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View, Text, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ScreenShell: ({ children, headerRight }: { children?: React.ReactNode; headerRight?: React.ReactNode }) => <View>{headerRight}{children}</View>,
    Card: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    Button: ({ title, onPress }: { title: string; onPress?: () => void }) => <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}><Text>{title}</Text></Pressable>,
    Banner: ({ body }: { body: string }) => <Text>{body}</Text>,
    EmptyState: () => <Text>No updates</Text>, Loading: () => <Text>Loading</Text>, Text,
  };
});

function site(id: string, phase: OwnerPhase = 'live', patch: Partial<SiteSummary> = {}): SiteSummary {
  return { submissionId: id as SubmissionId, businessName: `${id} shop`, businessType: 'Restaurant',
    contentSource: 'owner_app', publishPolicy: 'pay_then_publish', status: 'completed', phase,
    total: 4999, amountPaid: 4999, balanceDue: 0, paidInFull: true, publishedUrl: 'https://example.test/',
    openChangeRequests: 0, createdAt: 1, ...patch };
}
function message(id: string, key = 'business-ready', patch: Partial<OwnerMessage> = {}): OwnerMessage {
  return { key, type: 'website_live', title: `${id} is ready`, body: `Open the saved website for ${id}.`,
    submissionId: id as SubmissionId, visitRequestId: null, createdAt: 1, read: false, ...patch };
}
function pressHandler(node: ReturnType<ReturnType<typeof render>['getByRole']>): () => void {
  let current = node;
  while (typeof current.props.onPress !== 'function') {
    if (!current.parent) throw new Error('Press handler not found'); current = current.parent;
  }
  return current.props.onPress;
}
function openMessage(screen: ReturnType<typeof render>, title = 'notified-business is ready') {
  fireEvent.press(screen.getByRole('button', { name: `Unread: ${title}` }));
}

beforeEach(() => {
  jest.clearAllMocks(); mockSubject = 'owner-a'; mockSession = 'session-a'; mockSelected = 'previous-business'; mockParams = {};
  mockMe = { owner: { _id: 'db-owner-a', email: 'owner@example.test', name: 'Pablo', phone: null },
    sites: [site('previous-business'), site('notified-business')] };
  mockInbox = { ownerId: 'db-owner-a', actorClerkId: 'owner-a', unreadCount: 1, items: [message('notified-business')] };
  mockSelect.mockImplementation((id: string) => { mockSelected = id; });
  mockMarkRead.mockResolvedValue(undefined); mockMarkAllRead.mockResolvedValue(undefined);
});

describe('explicit owner business navigation', () => {
  it('opens a published authorized help answer in the shared native article route', () => {
    mockInbox.items = [message('answer', 'kb-answer', { articleSlug: 'published-answer', submissionId: null, type: 'knowledge_answer', title: 'An answer is ready' })];
    const screen = render(<Inbox />); openMessage(screen, 'An answer is ready');
    fireEvent.press(screen.getByRole('button', { name: 'Read answer' }));
    expect(mockMarkRead).toHaveBeenCalledWith('kb-answer');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(knowledge)/article/[slug]', params: { slug: 'published-answer' } });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('keeps an answer-under-review notice generic without a draft article action', () => {
    mockInbox.items = [message('answer', 'kb-review', { submissionId: null, type: 'knowledge_review', title: 'Your question is being reviewed', body: 'The team is checking your answer.' })];
    const screen = render(<Inbox />); openMessage(screen, 'Your question is being reviewed');
    expect(screen.queryByRole('button', { name: 'Read answer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open business' })).toBeNull();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it.each([
    ['draft', '/(owner)'], ['building', '/(owner)/building'], ['changes_requested', '/(owner)/building'],
    ['ready_to_check', '/(owner)/check'], ['awaiting_payment', '/(owner)/pay'], ['publishing', '/(owner)/live'],
    ['live', '/(owner)/(tabs)/site'], ['offline', '/(owner)/(tabs)/site'], ['in_review', '/(owner)/(tabs)/site'],
    ['rejected', '/(owner)/(tabs)/site'],
  ] as const)('Open business selects the notified %s business before opening its own screen', (phase, route) => {
    mockMe = { ...mockMe, sites: [site('previous-business'), site('notified-business', phase)] };
    const screen = render(<Inbox />); openMessage(screen);
    fireEvent.press(screen.getByRole('button', { name: 'Open business' }));
    expect(mockSelect).toHaveBeenCalledWith('notified-business');
    expect(mockSelect.mock.invocationCallOrder[0]).toBeLessThan(mockRouter.push.mock.invocationCallOrder[0]);
    expect(mockRouter.push).toHaveBeenCalledWith(route);
    expect(mockRouter.push).not.toHaveBeenCalledWith('/(owner)/(tabs)/today');
  });

  it('keeps a published business with a remaining balance on its payment flow', () => {
    mockMe.sites[1] = site('notified-business', 'live', { amountPaid: 1000, balanceDue: 3999, paidInFull: false });
    const screen = render(<Inbox />); openMessage(screen); fireEvent.press(screen.getByRole('button', { name: 'Open business' }));
    expect(mockSelect).toHaveBeenCalledWith('notified-business'); expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/pay');
  });

  it('opens the verified deep-linked event’s business even when another business was selected', () => {
    mockParams = { eventKey: 'second-business-event' };
    mockInbox = { ...mockInbox, items: [message('previous-business'), message('notified-business', 'second-business-event')] };
    const screen = render(<Inbox />);
    expect(screen.getByTestId('owner-notification-full-body').props.children).toBe('Open the saved website for notified-business.');
    fireEvent.press(screen.getByRole('button', { name: 'Open business' }));
    expect(mockMarkRead).toHaveBeenCalledWith('second-business-event');
    expect(mockSelect).toHaveBeenCalledWith('notified-business'); expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/(tabs)/site');
  });

  it('does not fall back to Today or a different business for a missing submission', () => {
    mockInbox.items = [message('removed-business')];
    const screen = render(<Inbox />); openMessage(screen, 'removed-business is ready');
    fireEvent.press(screen.getByRole('button', { name: 'Open business' }));
    expect(mockSelect).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('rechecks ownership when a business disappears after the notification popup opens', () => {
    const screen = render(<Inbox />); openMessage(screen);
    mockMe = { ...mockMe, sites: [site('previous-business')] }; screen.rerender(<Inbox />);
    fireEvent.press(screen.getByRole('button', { name: 'Open business' }));
    expect(mockSelect).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it.each(['account', 'session'] as const)('ignores a retained Open business callback after an authenticated %s change', change => {
    const screen = render(<Inbox />); openMessage(screen);
    const oldPress = pressHandler(screen.getByRole('button', { name: 'Open business' }));
    if (change === 'account') { mockSubject = 'owner-b'; mockMe = { ...mockMe, owner: { ...mockMe.owner, _id: 'db-owner-b' } }; }
    else mockSession = 'session-b';
    act(() => { screen.rerender(<Inbox />); }); act(() => oldPress());
    expect(mockSelect).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('keeps an unfamiliar future phase within the selected business instead of falling back to Today', () => {
    expect(ownerSiteRoute(site('future', 'new-phase' as OwnerPhase))).toBe('/(owner)/(tabs)/site');
  });
});
