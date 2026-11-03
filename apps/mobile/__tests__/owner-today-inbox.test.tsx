import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Today from '../app/(owner)/(tabs)/today';
import Inbox from '../app/(owner)/me/inbox';
import type { OwnerMe, SiteSummary, SubmissionId } from '../lib/v2/ownerTypes';
import type { OwnerInbox, OwnerMessage } from '../lib/v2/ownerInbox';
import type { VisitRequest } from '../lib/v2/visitRequests';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockSelect = jest.fn(), mockBegin = jest.fn(), mockMarkRead = jest.fn(), mockMarkAll = jest.fn();
const mockDeviceToken = jest.fn(), mockRegister = jest.fn(), mockExpoPermissions = jest.fn();
let mockSubject = 'owner-a', mockSession = 'session-a', mockSelected: string | null = 'draft';
let mockMe: OwnerMe, mockInbox: OwnerInbox | undefined, mockVisits: VisitRequest[] | undefined;
let mockParams: Record<string, string> = {};

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject, sessionId: mockSession }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: true }) }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
jest.mock('../lib/v2/ownerIntake', () => ({ ownerIntake: {
  selectBusiness: (...args: unknown[]) => mockSelect(...args), beginBusiness: () => mockBegin(),
} }));
jest.mock('../lib/v2/useOwnerSite', () => ({
  useOwnerSite: () => {
    const site = mockMe.sites.find(row => row.submissionId === mockSelected) ?? mockMe.sites[0] ?? null;
    return { me: mockMe, site, id: site?.submissionId ?? null, isNewBusiness: false };
  },
  firstName: () => 'Pablo', greeting: () => 'Good morning',
}));
jest.mock('../lib/v2/ownerInbox', () => ({
  useOwnerInbox: () => mockInbox,
  useOwnerInboxActions: () => ({ markRead: mockMarkRead, markAllRead: mockMarkAll }),
}));
jest.mock('../lib/v2/visitRequests', () => ({ ...jest.requireActual('../lib/v2/visitRequests'), useOwnerVisitRequests: () => mockVisits }));
jest.mock('../components/v2/owner/OwnerBusinessSwitcher', () => ({ OwnerBusinessSwitcher: () => null }));
jest.mock('../components/v2/owner/OwnerPaymentSimulatorEntry', () => ({ OwnerPaymentSimulatorEntry: () => null }));
jest.mock('../components/v2/owner/OwnerNotificationBridge', () => ({ ownerDeviceToken: (...args: unknown[]) => mockDeviceToken(...args) }));
jest.mock('convex/react', () => ({ useMutation: () => mockRegister }));
jest.mock('expo-notifications', () => ({ requestPermissionsAsync: (...args: unknown[]) => mockExpoPermissions(...args) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs', LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop' }));

const NOW = Date.UTC(2026, 10, 3, 16, 30); // Nov 4, 00:30 in Manila; still Nov 3 in UTC.
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (element: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{element}</SafeAreaProvider>);
const rerender = (screen: ReturnType<typeof wrap>, element: React.ReactElement) => screen.rerender(<SafeAreaProvider initialMetrics={metrics}>{element}</SafeAreaProvider>);
function business(id: string, extra: Partial<SiteSummary> = {}): SiteSummary {
  return { submissionId: id as SubmissionId, businessName: `${id} shop`, businessType: 'Food', contentSource: 'owner_app',
    publishPolicy: 'pay_then_publish', status: 'draft', phase: 'draft', publishedUrl: null,
    total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false, openChangeRequests: 0, createdAt: 1, ...extra };
}
function message(extra: Partial<OwnerMessage> = {}): OwnerMessage {
  return { key: 'update-one', type: 'preview_ready', title: 'Your preview is ready',
    body: 'The team has prepared your full website preview. Check every photo, your contact details and the wording before approving it. This complete message must be readable in the details popup.',
    createdAt: NOW - 1000, submissionId: 'ready' as OwnerMessage['submissionId'], visitRequestId: null, read: false, ...extra };
}
function visit(extra: Partial<VisitRequest> = {}): VisitRequest {
  return { _id: 'visit-one' as VisitRequest['_id'], _creationTime: NOW - 86400000, ownerId: 'db-owner-a' as VisitRequest['ownerId'],
    actorClerkId: 'owner-a', requestKey: 'fixture_visit_one', shopName: 'Visit shop', ownerName: 'Pablo', phone: '639171234567',
    email: 'owner@example.test', address: '12 Main Street', city: 'Marikina', coordinates: { lat: 14.6, lng: 121 },
    preferredWhen: 'Wednesday morning', status: 'requested', assignedAgent: null, revision: 1, createdAt: NOW - 86400000, updatedAt: NOW - 1000, ...extra };
}
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (cause: Error) => void;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function pressHandler(node: ReturnType<ReturnType<typeof wrap>['getByRole']>): () => void {
  let current = node;
  while (typeof current.props.onPress !== 'function') {
    if (!current.parent) throw new Error('Press handler not found'); current = current.parent;
  }
  return current.props.onPress;
}

beforeEach(() => {
  jest.clearAllMocks(); jest.spyOn(Date, 'now').mockReturnValue(NOW);
  mockSubject = 'owner-a'; mockSession = 'session-a'; mockSelected = 'draft'; mockParams = {}; mockVisits = [];
  mockMe = { owner: { _id: 'db-owner-a', email: 'owner@example.test', name: 'Pablo', phone: null }, sites: [
    business('draft'), business('ready', { phase: 'ready_to_check', status: 'website_generated' }),
    business('payment', { phase: 'awaiting_payment', status: 'deposit_paid', amountPaid: 500, balanceDue: 4499 }),
    business('live-one', { phase: 'live', status: 'completed', amountPaid: 4999, balanceDue: 0, paidInFull: true, publishedUrl: 'https://live-one.example/' }),
    business('live-two', { phase: 'live', status: 'completed', amountPaid: 4999, balanceDue: 0, paidInFull: true, publishedUrl: 'https://live-two.example/' }),
    business('building', { phase: 'building', status: 'submitted' }), business('review', { phase: 'in_review', status: 'in_review' }),
  ] };
  mockInbox = { ownerId: 'db-owner-a' as OwnerInbox['ownerId'], actorClerkId: 'owner-a', unreadCount: 2,
    items: [message(), message({ key: 'update-two', title: 'Agent confirmed your visit', body: 'Mika has accepted your visit. Open the full details to check the proposed time and shop address.',
      type: 'visit_confirmed', submissionId: null, visitRequestId: 'visit-one' as OwnerMessage['visitRequestId'] })] };
  mockSelect.mockReset().mockImplementation((id: string) => { mockSelected = id; }); mockBegin.mockReset();
  mockMarkRead.mockReset().mockResolvedValue(undefined); mockMarkAll.mockReset().mockResolvedValue(undefined);
  mockDeviceToken.mockReset().mockResolvedValue(null); mockRegister.mockReset().mockResolvedValue({ registered: true }); mockExpoPermissions.mockReset();
});
afterEach(() => { expect(mockExpoPermissions).not.toHaveBeenCalled(); jest.restoreAllMocks(); });

describe('owner Today', () => {
  it('shows real portfolio counts and balances without invented traffic or sales', () => {
    mockInbox = { ...mockInbox!, unreadCount: 1, items: [mockInbox!.items[0], { ...mockInbox!.items[1], read: true }] };
    const screen = wrap(<Today />);
    expect(screen.getByText('7')).toBeTruthy(); expect(screen.getByText('Businesses')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); expect(screen.getByText('Live websites')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy(); expect(screen.getByText('Need you')).toBeTruthy();
    expect(screen.getByText('₱4,499')).toBeTruthy();
    expect(screen.queryByText(/visitors|page views|today’s sales|revenue/i)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Show all businesses' }));
    for (const site of mockMe.sites) expect(screen.getByText(site.businessName)).toBeTruthy();
  });

  it('prioritizes the ready preview, selects that business and renders one main action', () => {
    const screen = wrap(<Today />);
    expect(screen.getAllByRole('button', { name: 'Check preview' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Add a business' })).toHaveLength(1);
    fireEvent.press(screen.getByRole('button', { name: 'Check preview' }));
    expect(mockSelect).toHaveBeenCalledTimes(1); expect(mockSelect).toHaveBeenCalledWith('ready'); expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/check');
  });

  it.each([
    ['draft', '/(owner)'], ['ready_to_check', '/(owner)/check'], ['awaiting_payment', '/(owner)/pay'], ['offline', '/(owner)/(tabs)/site'],
  ] as const)('opens a selected %s business using its current owner phase', (phase, target) => {
    mockMe = { ...mockMe, sites: [business('chosen', { phase })] }; mockSelected = 'chosen';
    const screen = wrap(<Today />); fireEvent.press(screen.getByRole('button', { name: /^chosen shop,/ }));
    expect(mockSelect).toHaveBeenCalledWith('chosen'); expect(mockRouter.push).toHaveBeenCalledWith(target);
  });

  it('keeps a live website with a remaining balance actionable and opens its payment', () => {
    mockMe = { ...mockMe, sites: [business('live-unpaid', { phase: 'live', status: 'deposit_paid', total: 4999, amountPaid: 1000, balanceDue: 3999, paidInFull: false })] };
    const screen = wrap(<Today />);
    expect(screen.queryByText('You’re up to date.')).toBeNull();
    expect(screen.getByText('Your website has a payment waiting.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Pay ₱3,999' }));
    expect(mockSelect).toHaveBeenCalledWith('live-unpaid');
    expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/pay');
  });

  it('opens the remaining payment from an update for a published unpaid business', async () => {
    mockMe = { ...mockMe, sites: [business('live-unpaid', { phase: 'live', status: 'deposit_paid', total: 4999, amountPaid: 1000, balanceDue: 3999, paidInFull: false })] };
    mockInbox = { ...mockInbox!, items: [message({ key: 'down-payment', title: 'Down payment recorded', type: 'deposit_received', submissionId: 'live-unpaid' as OwnerMessage['submissionId'] })] };
    const screen = wrap(<Inbox />);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Unread: Down payment recorded' })));
    fireEvent.press(screen.getByRole('button', { name: 'Open business' }));
    expect(mockSelect).toHaveBeenCalledWith('live-unpaid');
    expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/pay');
  });

  it('shows a confirmed visit on the correct Manila day even when UTC is still the previous day', () => {
    mockVisits = [visit({ status: 'confirmed', scheduledAt: Date.UTC(2026, 10, 4, 1, 30) })];
    const screen = wrap(<Today />);
    expect(screen.getByText('An agent is visiting today.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'View today’s visit' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(owner)/agents/[visitId]', params: { visitId: 'visit-one' } });
  });

  it('keeps an assigned visit proposed until the agent accepts it', () => {
    mockVisits = [visit({ status: 'assigned', scheduledAt: Date.UTC(2026, 10, 4, 1, 30) })];
    const screen = wrap(<Today />);
    expect(screen.queryByText('An agent is visiting today.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'View today’s visit' })).toBeNull();
    expect(screen.getByText('Awaiting acceptance')).toBeTruthy();
    expect(screen.getByText('We’re waiting for your assigned agent to accept.')).toBeTruthy();
  });

  it('does not call yesterday’s Manila visit today just because its UTC date matches', () => {
    mockVisits = [visit({ status: 'confirmed', scheduledAt: Date.UTC(2026, 10, 3, 15, 30) })];
    const screen = wrap(<Today />); expect(screen.queryByText('An agent is visiting today.')).toBeNull();
  });

  it('opens the unread inbox and recent update without marking anything read on Today', () => {
    const screen = wrap(<Today />);
    fireEvent.press(screen.getByRole('button', { name: 'Open owner inbox, 2 unread' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(owner)/me/inbox', params: {} });
    fireEvent.press(screen.getByRole('button', { name: /^Your preview is ready,/ }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/(owner)/me/inbox', params: { eventKey: 'update-one' } });
    expect(mockMarkRead).not.toHaveBeenCalled(); expect(mockMarkAll).not.toHaveBeenCalled();
  });

  it('ignores an old business action after the authenticated owner changes', () => {
    const screen = wrap(<Today />); const oldPress = pressHandler(screen.getByRole('button', { name: 'Check preview' }));
    mockSubject = 'owner-b'; mockMe = { owner: { ...mockMe.owner, _id: 'db-owner-b' }, sites: [business('other')] };
    rerender(screen, <Today />); act(() => oldPress());
    expect(mockSelect).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('owner Inbox', () => {
  it('does not mark individual or all notifications read just by opening and leaving the list', () => {
    const screen = wrap(<Inbox />);
    expect(screen.getByText('2 unread')).toBeTruthy(); expect(screen.queryByTestId('owner-notification-full-body')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Back' })); screen.unmount();
    expect(mockRouter.back).toHaveBeenCalledTimes(1); expect(mockMarkRead).not.toHaveBeenCalled(); expect(mockMarkAll).not.toHaveBeenCalled();
    expect(mockDeviceToken).not.toHaveBeenCalled(); expect(mockRegister).not.toHaveBeenCalled();
  });

  it('marks only the selected notification and opens its complete readable body', async () => {
    const screen = wrap(<Inbox />);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Unread: Agent confirmed your visit' })));
    expect(mockMarkRead).toHaveBeenCalledTimes(1); expect(mockMarkRead).toHaveBeenCalledWith('update-two'); expect(mockMarkAll).not.toHaveBeenCalled();
    const body = screen.getByTestId('owner-notification-full-body');
    expect(body.props.children).toBe(mockInbox!.items[1].body); expect(body.props.numberOfLines).toBeUndefined();
    mockInbox = { ...mockInbox!, unreadCount: 1, items: [mockInbox!.items[0], { ...mockInbox!.items[1], read: true }] };
    rerender(screen, <Inbox />); fireEvent.press(screen.getByRole('button', { name: 'Close owner notification' }));
    expect(screen.getByRole('button', { name: 'Read: Agent confirmed your visit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unread: Your preview is ready' })).toBeTruthy();
    expect(mockMarkRead).toHaveBeenCalledTimes(1);
  });

  it('marks all read only after the explicit action is pressed', async () => {
    const screen = wrap(<Inbox />); expect(mockMarkAll).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Mark all owner notifications read' })));
    expect(mockMarkAll).toHaveBeenCalledTimes(1); expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it('opens and marks a notification deep link only when that key exists in the verified inbox', async () => {
    mockParams = { eventKey: 'update-one' }; const screen = wrap(<Inbox />);
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith('update-one')); expect(mockMarkRead).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('owner-notification-full-body').props.children).toBe(mockInbox!.items[0].body);
    expect(mockMarkAll).not.toHaveBeenCalled();
  });

  it('does not open or mark a foreign notification key from a requested deep link', () => {
    mockParams = { eventKey: 'another-owner-secret-update' }; const screen = wrap(<Inbox />);
    expect(screen.queryByTestId('owner-notification-full-body')).toBeNull();
    expect(mockMarkRead).not.toHaveBeenCalled(); expect(mockMarkAll).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('selects the owned business before opening a website notification’s next action', async () => {
    const screen = wrap(<Inbox />);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Unread: Your preview is ready' })));
    fireEvent.press(screen.getByRole('button', { name: 'Open business' }));
    expect(mockSelect).toHaveBeenCalledWith('ready'); expect(mockRouter.push).toHaveBeenCalledWith('/(owner)/check');
  });

  it.each(['account', 'session'] as const)('ignores an old mark-read error after the %s changes', async scope => {
    const pending = deferred(); mockMarkRead.mockReturnValueOnce(pending.promise);
    const screen = wrap(<Inbox />); fireEvent.press(screen.getByRole('button', { name: 'Unread: Your preview is ready' }));
    if (scope === 'account') { mockSubject = 'owner-b'; mockMe = { ...mockMe, owner: { ...mockMe.owner, _id: 'db-owner-b' } }; }
    else mockSession = 'session-b';
    mockParams = {}; mockInbox = { ...mockInbox!, ownerId: mockMe.owner._id as OwnerInbox['ownerId'], actorClerkId: mockSubject };
    rerender(screen, <Inbox />); await act(async () => pending.reject(new Error('Old account offline')));
    expect(screen.queryByText('Could not save read status. Try again when connected.')).toBeNull();
    expect(screen.queryByTestId('owner-notification-full-body')).toBeNull();
  });

  it('uses the mocked permission bridge only after Enable notifications is pressed', async () => {
    mockDeviceToken.mockResolvedValueOnce('ExpoPushToken[fixture_owner_token]');
    const screen = wrap(<Inbox />); expect(mockDeviceToken).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Enable notifications' })));
    expect(mockDeviceToken).toHaveBeenCalledWith(true, expect.any(Function));
    expect(mockRegister).toHaveBeenCalledWith({ token: 'ExpoPushToken[fixture_owner_token]', platform: Platform.OS, clerkId: 'owner-a' });
    expect(screen.getByText('Notifications enabled on this device.')).toBeTruthy();
  });
});
