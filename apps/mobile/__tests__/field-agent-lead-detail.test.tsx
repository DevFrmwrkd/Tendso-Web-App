import React from 'react';
import { BackHandler, Linking } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import LeadDetailScreen from '../app/(app)/leads/[leadId]';
import { Button } from '../components/v2';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn() };
const mockVisit = jest.fn();
const mockUpdateStatus = jest.fn();
const mockAddNote = jest.fn();
const mockDirections = jest.fn();
const mockExternalUrl = jest.fn();
let mockUserId: string;
let mockAuthenticated: boolean;
let mockConnected: boolean;
let mockParams: { leadId: string };
let mockDetail: any;
let mockCrm: any;

jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('@clerk/clerk-expo', () => ({ useUser: () => ({ user: { id: mockUserId } }) }));
jest.mock('@tendso/convex-client', () => ({ api: {
  creators: { getByClerkId: 'creator' },
  leads: { getDetailForMobileCRM: 'detail', listForMobileCRM: 'crm', updateStatus: 'status', visitCommunityFind: 'visit' },
  leadNotes: { create: 'note' },
} }));
jest.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: mockAuthenticated }),
  useQuery: (reference: string, args: unknown) => {
    if (args === 'skip') return undefined;
    if (reference === 'creator') return { _id: 'agent-1' };
    if (reference === 'detail') return mockDetail;
    if (reference === 'crm') return mockCrm;
    throw new Error(`Unexpected query: ${reference}`);
  },
  useMutation: (reference: string) => {
    if (reference === 'visit') return mockVisit;
    if (reference === 'status') return mockUpdateStatus;
    if (reference === 'note') return mockAddNote;
    throw new Error(`Unexpected mutation: ${reference}`);
  },
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('../services/links', () => ({
  openDirections: (...args: unknown[]) => mockDirections(...args),
  openExternalUrl: (...args: unknown[]) => mockExternalUrl(...args),
  canOpenDirections: (target: { address?: string; label?: string; latitude?: number; longitude?: number }) =>
    !!(target.address || target.label || (typeof target.latitude === 'number' && typeof target.longitude === 'number')),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));

function communityDetail() {
  return {
    lead: {
      _id: 'lead-1', source: 'community', status: 'new', createdAt: Date.now() - 60_000,
      businessName: 'Nena Store', businessAddress: '12 Rizal Street', businessCity: 'Marikina', businessCategory: 'Sari-sari',
      phone: '09171234567', email: 'nena@example.com',
    },
    business: null, notes: [], interviewers: [], isMine: true, submittedBy: null, adminContent: null,
    photoUrl: 'https://images.example.com/shop.jpg', needsWebsite: true, hasLiveWebsite: false,
    websiteUrl: null, businessWebsite: null, claimedBy: null, claimExpiresAt: null,
    businessLatitude: 14.65, businessLongitude: 121.10,
    spottedBy: { creatorId: 'spotter-1', displayName: 'Ana S.', profileImage: null },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'clerk-agent-1';
  mockAuthenticated = true;
  mockConnected = true;
  mockParams = { leadId: 'lead-1' };
  mockDetail = communityDetail();
  mockCrm = { leads: [{ _id: 'lead-1', phone: '09171234567' }] };
  mockRouter.canGoBack.mockReturnValue(false);
  mockVisit.mockReset().mockResolvedValue({ leadId: 'lead-1', claimExpiresAt: Date.now() + 86_400_000 });
  mockUpdateStatus.mockReset().mockResolvedValue(undefined);
  mockAddNote.mockReset().mockResolvedValue(undefined);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});

afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it('reserves a community find before opening capture with its original binding and details', async () => {
  const screen = render(<LeadDetailScreen />);
  expect(screen.getByText('Nena Store')).toBeTruthy();
  expect(screen.getByText('Ana S.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Start the capture' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/(app)/submit/info',
    params: {
      prospectLeadId: 'lead-1', businessName: 'Nena Store', phone: '09171234567',
      address: '12 Rizal Street', city: 'Marikina', category: 'Sari-sari',
    },
  }));
  expect(mockVisit).toHaveBeenCalledWith({ leadId: 'lead-1' });
  expect(mockVisit.mock.invocationCallOrder[0]).toBeLessThan(mockRouter.push.mock.invocationCallOrder[0]);
});

it('keeps legacy scraped-lead capture prefill without reserving the prospects table', async () => {
  mockDetail = { ...mockDetail, lead: { _id: 'legacy-lead', source: 'outscraper', status: 'new', createdAt: Date.now() } };
  mockParams = { leadId: 'legacy-lead' };
  mockCrm = { leads: [{
    _id: 'legacy-lead', businessName: 'Ramon Repair', phone: '09181111111',
    businessAddress: '4 Market Road', businessCity: 'Pasig', businessType: 'Auto Shop',
  }] };
  const screen = render(<LeadDetailScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Start the capture' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/(app)/submit/info', params: {
      prospectLeadId: 'legacy-lead', businessName: 'Ramon Repair', phone: '09181111111',
      address: '4 Market Road', city: 'Pasig', category: 'Auto Shop',
    },
  }));
  expect(mockVisit).not.toHaveBeenCalled();
});

it('blocks capture when another agent has an active reservation', () => {
  mockDetail.claimedBy = { creatorId: 'other-agent', displayName: 'Ben T.', isMine: false };
  mockDetail.claimExpiresAt = Date.now() + 60_000;
  const screen = render(<LeadDetailScreen />);
  expect(screen.getByText('Reserved by Ben T.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Start the capture' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Start the capture' }));
  expect(mockVisit).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it('allows a new reservation when the displayed claim has expired', async () => {
  mockDetail.claimedBy = { creatorId: 'other-agent', displayName: 'Ben T.', isMine: false };
  mockDetail.claimExpiresAt = Date.now() - 1;
  const screen = render(<LeadDetailScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Start the capture' }));
  await waitFor(() => expect(mockVisit).toHaveBeenCalledWith({ leadId: 'lead-1' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(1));
});

it('releases an open competitor reservation when its real expiry passes without another query update', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-27T04:00:00Z'));
  mockDetail.claimedBy = { creatorId: 'other-agent', displayName: 'Ben T.', isMine: false };
  mockDetail.claimExpiresAt = Date.now() + 100;
  const screen = render(<LeadDetailScreen />);
  expect(screen.getByRole('button', { name: 'Start the capture' })).toBeDisabled();
  act(() => jest.advanceTimersByTime(101));
  expect(screen.getByRole('button', { name: 'Start the capture' })).toBeEnabled();
  expect(screen.queryByText('Reserved by Ben T.')).toBeNull();
});

it('blocks offline mutations and capture while keeping the cached shop readable', () => {
  mockConnected = false;
  const screen = render(<LeadDetailScreen />);
  expect(screen.getByText('Nena Store')).toBeTruthy();
  expect(screen.getByText("You're offline")).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Start the capture' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save note' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Set status to Contacted' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Start the capture' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save note' }));
  expect(mockVisit).not.toHaveBeenCalled();
  expect(mockUpdateStatus).not.toHaveBeenCalled();
  expect(mockAddNote).not.toHaveBeenCalled();
});

it('deduplicates capture taps before the reservation finishes', async () => {
  const pending = deferred();
  mockVisit.mockReturnValue(pending.promise);
  const screen = render(<LeadDetailScreen />);
  const button = screen.UNSAFE_getAllByType(Button).find((node) => node.props.title === 'Start the capture')!;
  let first!: Promise<void>;
  let second!: Promise<void>;
  act(() => {
    first = button.props.onPress();
    second = button.props.onPress();
  });
  expect(mockVisit).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).not.toHaveBeenCalled();
  await act(async () => { pending.resolve(); await Promise.all([first, second]); });
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
});

it.each(['account', 'route', 'unmount', 'authentication'])('suppresses delayed capture navigation after %s changes', async (change) => {
  const pending = deferred();
  mockVisit.mockReturnValue(pending.promise);
  const screen = render(<LeadDetailScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Start the capture' }));
  expect(mockVisit).toHaveBeenCalledTimes(1);
  if (change === 'unmount') screen.unmount();
  else {
    if (change === 'account') mockUserId = 'different-account';
    if (change === 'route') mockParams = { leadId: 'another-lead' };
    if (change === 'authentication') mockAuthenticated = false;
    screen.rerender(<LeadDetailScreen />);
  }
  await act(async () => { pending.resolve(); await pending.promise; });
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it.each(['qualified', 'converted'])('does not call the CRM %s status Visiting or Live', (status) => {
  mockDetail.lead.status = status;
  mockDetail.needsWebsite = null;
  const screen = render(<LeadDetailScreen />);
  expect(screen.getByRole('button', { name: `Set status to ${status === 'qualified' ? 'Qualified' : 'Converted'}` })).toBeTruthy();
  expect(screen.queryByText('Visiting')).toBeNull();
  expect(screen.queryByText('Live')).toBeNull();
});

it.each([null, false])('does not infer Needs a site from missing website data (%s)', (needsWebsite) => {
  mockDetail.needsWebsite = needsWebsite;
  const screen = render(<LeadDetailScreen />);
  expect(screen.queryByText('Needs a site')).toBeNull();
});

it('uses verified website availability for Live and does not offer another capture', () => {
  mockDetail.hasLiveWebsite = true;
  mockDetail.needsWebsite = false;
  mockDetail.websiteUrl = 'https://nena.tendso.site';
  const screen = render(<LeadDetailScreen />);
  expect(screen.getByText('Live')).toBeTruthy();
  expect(screen.queryByText('Needs a site')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Start the capture' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'View website' }));
  expect(mockExternalUrl).toHaveBeenCalledWith('https://nena.tendso.site');
});

it('keeps phone, message, email and native directions actions connected to actual contact details', () => {
  const screen = render(<LeadDetailScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Call Business contact' }));
  fireEvent.press(screen.getByRole('button', { name: 'Message Business contact' }));
  fireEvent.press(screen.getByRole('button', { name: 'Email Business contact' }));
  fireEvent.press(screen.getByRole('button', { name: 'Show directions' }));
  expect(Linking.openURL).toHaveBeenCalledWith('tel:09171234567');
  expect(Linking.openURL).toHaveBeenCalledWith('sms:09171234567');
  expect(Linking.openURL).toHaveBeenCalledWith('mailto:nena@example.com');
  expect(mockDirections).toHaveBeenCalledWith(expect.objectContaining({ latitude: 14.65, longitude: 121.10, address: '12 Rizal Street, Marikina' }));
});

it('saves trimmed notes and updates only an owned lead using backend status values', async () => {
  const screen = render(<LeadDetailScreen />);
  fireEvent.changeText(screen.getByLabelText('Add a note about this lead'), '  Ask for Nena in the morning.  ');
  fireEvent.press(screen.getByRole('button', { name: 'Save note' }));
  await waitFor(() => expect(mockAddNote).toHaveBeenCalledWith({ leadId: 'lead-1', creatorId: 'agent-1', content: 'Ask for Nena in the morning.' }));
  fireEvent.press(screen.getByRole('button', { name: 'Set status to Qualified' }));
  await waitFor(() => expect(mockUpdateStatus).toHaveBeenCalledWith({ id: 'lead-1', status: 'qualified' }));
  mockDetail = { ...mockDetail, isMine: false };
  screen.rerender(<LeadDetailScreen />);
  expect(screen.queryByRole('button', { name: 'Set status to Contacted' })).toBeNull();
  expect(mockUpdateStatus).toHaveBeenCalledTimes(1);
});

it('allows an authorized visiting agent to update status while conversion comes from actual capture', async () => {
  mockDetail.isMine = false;
  mockDetail.canUpdateStatus = true;
  mockDetail.canMarkConverted = false;
  const screen = render(<LeadDetailScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Set status to Qualified' }));
  await waitFor(() => expect(mockUpdateStatus).toHaveBeenCalledWith({ id: 'lead-1', status: 'qualified' }));
  expect(screen.queryByRole('button', { name: 'Set status to Converted' })).toBeNull();
  expect(screen.getByText('Converted is set when the capture is submitted.')).toBeTruthy();
  expect(mockUpdateStatus).toHaveBeenCalledTimes(1);
});

it('honors explicit read-only status permission even for the original spotter', () => {
  mockDetail.isMine = true;
  mockDetail.canUpdateStatus = false;
  const screen = render(<LeadDetailScreen />);
  expect(screen.queryByRole('button', { name: 'Set status to Contacted' })).toBeNull();
  expect(mockUpdateStatus).not.toHaveBeenCalled();
});

it('does not offer another capture for a converted community find', () => {
  mockDetail.lead.status = 'converted';
  const screen = render(<LeadDetailScreen />);
  expect(screen.queryByRole('button', { name: 'Start the capture' })).toBeNull();
});

it('returns to the originating screen when history exists and otherwise opens Finds', () => {
  mockRouter.canGoBack.mockReturnValue(true);
  const screen = render(<LeadDetailScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).not.toHaveBeenCalled();
  mockRouter.canGoBack.mockReturnValue(false);
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(tabs)/finds');
});

it('uses the same history-aware behavior for the Android hardware back button', () => {
  const handlers: (() => boolean | null | undefined)[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.push(handler); return { remove: jest.fn() };
  });
  mockRouter.canGoBack.mockReturnValue(true);
  render(<LeadDetailScreen />);
  expect(handlers[0]()).toBe(true);
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
