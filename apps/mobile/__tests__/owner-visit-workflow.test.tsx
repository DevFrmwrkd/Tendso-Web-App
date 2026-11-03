import React from 'react';
import { Alert, Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import OwnerVisit from '../app/(owner)/agents/[visitId]';
import AgentVisit from '../app/(app)/visits/[visitId]';
import AgentVisits from '../app/(app)/visits';
import { OwnerVisitList } from '../components/v2/owner/OwnerVisitList';
import { visitSchedule } from '../lib/v2/visitRequests';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockAccept = jest.fn(), mockDecline = jest.fn(), mockComplete = jest.fn(), mockCancel = jest.fn(), mockDirections = jest.fn();
let mockSubject: string, mockSession: string, mockRole: string, mockAgent: any, mockOwnerId: string;
let mockParams: Record<string, string>, mockConnected: boolean, mockVisit: any, mockOwnerVisits: any[], mockAssigned: any;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject, sessionId: mockSession }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => mockRouter }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => ({ role: mockRole, account: mockAgent, isBlocked: false, isPreview: false }) }));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => ({ me: { owner: { _id: mockOwnerId } } }) }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
jest.mock('../services/links', () => ({ openDirections: (...args: unknown[]) => mockDirections(...args) }));
jest.mock('../lib/v2/visitRequests', () => ({
  ...jest.requireActual('../lib/v2/visitRequests'), useOwnerVisit: () => mockVisit, useAssignedVisit: () => mockVisit,
  useOwnerVisitRequests: () => mockOwnerVisits, useAssignedVisits: () => mockAssigned,
  useVisitActions: () => ({ accept: mockAccept, decline: mockDecline, complete: mockComplete, cancel: mockCancel }),
}));

function row(changes: Record<string, unknown> = {}) {
  return { _id: 'visit-1', actorClerkId: mockSubject, ownerId: mockOwnerId, revision: 2, status: 'assigned',
    shopName: 'Kanto shop', ownerName: 'Pablo', phone: '+639171234567', email: 'owner@example.test', address: '12 Main St', city: 'Marikina',
    coordinates: { lat: 14.6, lng: 121.1 }, preferredWhen: 'Tomorrow', scheduledAt: Date.UTC(2026, 10, 4, 2),
    assignedAgentId: 'agent-1', assignedAgent: { id: 'agent-1', name: 'Joy Dizon', phone: '09171234567', profileImage: null },
    adminNote: 'PRIVATE ADMIN NOTE', agentNote: 'PRIVATE AGENT NOTE', ...changes };
}
async function press(screen: ReturnType<typeof render>, name: string) { await act(async () => { fireEvent.press(screen.getByRole('button', { name })); }); }
async function confirmLast(alert: jest.SpyInstance, label: string) {
  const buttons = alert.mock.calls[alert.mock.calls.length - 1][2];
  await act(async () => { buttons.find((button: { text: string }) => button.text === label).onPress(); });
}
beforeEach(() => {
  jest.clearAllMocks(); mockSubject = 'current-clerk'; mockSession = 'session-1'; mockRole = 'creator'; mockOwnerId = 'owner-row'; mockConnected = true;
  mockAgent = { _id: 'agent-1', clerkId: mockSubject, role: 'creator', certifiedAt: 1 }; mockParams = { visitId: 'visit-1' };
  mockVisit = row(); mockOwnerVisits = [mockVisit]; mockAssigned = { actorClerkId: mockSubject, agentId: 'agent-1', requests: [mockVisit] };
  mockAccept.mockReset().mockImplementation(async () => ({ ...mockVisit, status: 'confirmed', revision: 3 }));
  mockComplete.mockReset().mockImplementation(async () => ({ ...mockVisit, status: 'completed', revision: 3 }));
  mockDecline.mockReset().mockImplementation(async () => ({ ...mockVisit, status: 'requested', assignedAgentId: undefined, revision: 3 }));
  mockCancel.mockReset().mockImplementation(async () => ({ ...mockVisit, status: 'cancelled', revision: 3 }));
  jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 3, 2));
});
afterEach(() => jest.restoreAllMocks());

it('tells the owner an assignment is proposed, not confirmed, and hides private notes', () => {
  const screen = render(<OwnerVisit />);
  expect(screen.getAllByText('Awaiting acceptance').length).toBeGreaterThan(0);
  expect(screen.getByText(/This proposed time is waiting/)).toBeTruthy();
  expect(screen.getByText(visitSchedule(mockVisit.scheduledAt))).toBeTruthy();
  expect(screen.queryByText('PRIVATE ADMIN NOTE')).toBeNull(); expect(screen.queryByText('PRIVATE AGENT NOTE')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Accept visit' })).toBeNull();
});

it.each(['requested', 'confirmed', 'completed', 'cancelled'])('shows owner state %s without inventing a booking', status => {
  mockVisit = row({ status, ...(status === 'requested' ? { scheduledAt: undefined, assignedAgent: null } : {}) });
  const screen = render(<OwnerVisit />);
  if (status === 'requested') expect(screen.getByText('Time not set yet')).toBeTruthy();
  if (status === 'confirmed') expect(screen.getByText('Confirmed time')).toBeTruthy();
  if (status === 'completed') expect(screen.getByText(/Shop capture, submission and publication are separate/)).toBeTruthy();
  if (status === 'cancelled') expect(screen.getByText(/No field agent should travel/)).toBeTruthy();
  expect(!!screen.queryByRole('button', { name: 'Cancel visit' })).toBe(status === 'requested' || status === 'confirmed');
});

it('cancels only after owner confirmation with the current revision and actor', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); const screen = render(<OwnerVisit />);
  await press(screen, 'Cancel visit'); expect(mockCancel).not.toHaveBeenCalled(); await confirmLast(alert, 'Cancel visit');
  expect(mockCancel).toHaveBeenCalledWith({ id: 'visit-1', expectedRevision: 2, clerkId: mockSubject });
});

it('does not execute a stale cancellation dialog after reassignment', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); const screen = render(<OwnerVisit />);
  await press(screen, 'Cancel visit'); mockVisit = row({ revision: 3 }); screen.rerender(<OwnerVisit />);
  await confirmLast(alert, 'Cancel visit'); expect(mockCancel).not.toHaveBeenCalled();
});

it('opens owner history rows by visit id and does not show another owner’s rows', () => {
  mockOwnerVisits.push(row({ _id: 'foreign', ownerId: 'other-owner', shopName: 'Private foreign shop' }));
  const screen = render(<OwnerVisitList />); expect(screen.queryByText('Private foreign shop')).toBeNull();
  fireEvent.press(screen.getByText('Kanto shop'));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(owner)/agents/[visitId]', params: { visitId: 'visit-1' } });
});

it('requires an agent acceptance confirmation and scopes it to the assigned revision', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); const screen = render(<AgentVisit />);
  await press(screen, 'Accept visit'); expect(mockAccept).not.toHaveBeenCalled(); await confirmLast(alert, 'Accept visit');
  expect(mockAccept).toHaveBeenCalledWith({ id: 'visit-1', expectedRevision: 2, clerkId: mockSubject, agentNote: undefined });
  expect(mockComplete).not.toHaveBeenCalled(); expect(screen.getByText('Visit accepted.')).toBeTruthy();
});

it('requires a decline reason and returns to the assignment list', async () => {
  const screen = render(<AgentVisit />); await press(screen, 'Decline visit');
  expect(screen.getByRole('button', { name: 'Send decline' }).props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(screen.getByLabelText('Reason for declining'), '  I am unavailable at that time.  ');
  await press(screen, 'Send decline');
  expect(mockDecline).toHaveBeenCalledWith({ id: 'visit-1', expectedRevision: 2, clerkId: mockSubject, reason: 'I am unavailable at that time.' });
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/visits');
});

it('allows completion only from confirmed state and keeps capture separate', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); const screen = render(<AgentVisit />);
  expect(screen.queryByRole('button', { name: 'Mark visit complete' })).toBeNull();
  mockVisit = row({ status: 'confirmed', scheduledAt: Date.UTC(2026, 10, 2, 2) }); screen.rerender(<AgentVisit />);
  await press(screen, 'Mark visit complete'); await confirmLast(alert, 'Mark complete');
  expect(mockComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 'visit-1', expectedRevision: 2 }));
  expect(screen.getByText('Visit marked complete. Submit any shop capture separately.')).toBeTruthy();
});

it('gives assigned agents private directions and a safe phone action', async () => {
  const call = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const screen = render(<AgentVisit />); await press(screen, 'Directions to shop'); await press(screen, 'Call owner');
  expect(mockDirections).toHaveBeenCalledWith({ latitude: 14.6, longitude: 121.1, label: 'Kanto shop' });
  expect(call).toHaveBeenCalledWith('tel:+639171234567'); expect(screen.queryByText('PRIVATE ADMIN NOTE')).toBeNull();
});

it.each(['actor', 'assignment', 'role'])('hides agent contacts for a foreign %s', scenario => {
  if (scenario === 'actor') mockVisit = row({ actorClerkId: 'other-clerk' });
  if (scenario === 'assignment') mockVisit = row({ assignedAgentId: 'other-agent' });
  if (scenario === 'role') mockRole = 'affiliate';
  const screen = render(<AgentVisit />); expect(screen.getByRole('header', { name: 'Visit not available' })).toBeTruthy();
  expect(screen.queryByText('+639171234567')).toBeNull(); expect(screen.queryByRole('button', { name: 'Accept visit' })).toBeNull();
});

it('filters the agent assignment list by both actor and assigned agent', () => {
  mockAssigned.requests.push(row({ assignedAgentId: 'other-agent', shopName: 'Foreign assignment' }));
  const screen = render(<AgentVisits />); expect(screen.queryByText('Foreign assignment')).toBeNull();
  fireEvent.press(screen.getByText('Kanto shop'));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/visits/[visitId]', params: { visitId: 'visit-1' } });
});

it('does not act offline or after an acceptance dialog becomes stale', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); const screen = render(<AgentVisit />);
  await press(screen, 'Accept visit'); mockVisit = row({ revision: 3 }); screen.rerender(<AgentVisit />);
  await confirmLast(alert, 'Accept visit'); expect(mockAccept).not.toHaveBeenCalled();
  mockConnected = false; screen.rerender(<AgentVisit />); expect(screen.getByRole('button', { name: 'Accept visit' }).props.accessibilityState.disabled).toBe(true);
});

it('ignores an agent acceptance result after the signed-in actor changes', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let finish!: (value: unknown) => void;
  const previous = row({ status: 'confirmed', revision: 3 });
  mockAccept.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const screen = render(<AgentVisit />); await press(screen, 'Accept visit'); await confirmLast(alert, 'Accept visit');
  mockSubject = 'new-clerk'; mockAgent = { ...mockAgent, clerkId: mockSubject, _id: 'new-agent' };
  mockVisit = row({ assignedAgentId: 'new-agent', shopName: 'Next private visit' }); screen.rerender(<AgentVisit />);
  await act(async () => { finish(previous); });
  expect(screen.queryByText('Visit accepted.')).toBeNull(); expect(screen.getByText('Next private visit')).toBeTruthy();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('requires rescheduling a passed proposal and prevents completing a future appointment', () => {
  mockVisit = row({ scheduledAt: Date.UTC(2026, 10, 2, 2) });
  const screen = render(<AgentVisit />);
  expect(screen.getByRole('button', { name: 'Accept visit' }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByText('Proposed time has passed')).toBeTruthy();
  mockVisit = row({ status: 'confirmed' }); screen.rerender(<AgentVisit />);
  expect(screen.getByRole('button', { name: 'Mark visit complete' }).props.accessibilityState.disabled).toBe(true);
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockComplete).not.toHaveBeenCalled();
});
