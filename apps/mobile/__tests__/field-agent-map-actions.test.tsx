import React from 'react';
import { AccessibilityInfo, Animated, PanResponder } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { FieldAgentMap } from '../components/field-agent/FieldAgentMap';

const mockPush = jest.fn();
const mockReserve = jest.fn();
const mockVisit = jest.fn();
const mockQuery = jest.fn();
const mockAnimate = jest.fn();
let mockData: Record<string, unknown>;
let mockAuthenticated = true;
let mockOnline = true;
let mockReduceMotionChanged: (value: boolean) => void;
const mockArea = { latitude: 14.65, longitude: 121.1, source: 'work', label: 'Marikina' };
const mockCreator = { _id: 'agent-mika', clerkId: 'clerk-mika', certifiedAt: 10,
  firstName: 'Mika', workCity: 'Marikina', workLatitude: 14.65, workLongitude: 121.1 };

jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => ({ push: mockPush }) }));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => ({ isAdmin: false }) }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockOnline }) }));
jest.mock('../hooks/useWorkAreaLocation', () => ({ useWorkAreaLocation: () => ({
  area: mockArea, currentLocation: null, permissionStatus: 'idle', requestCurrentLocation: jest.fn(),
  isLocating: false, isLoading: false,
}) }));
jest.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: mockAuthenticated }),
  useQuery: (...args: unknown[]) => mockQuery(...args),
  useMutation: (reference: string) => reference === 'prospects:reserve' ? mockReserve : mockVisit,
}));
jest.mock('@tendso/convex-client', () => ({ api: {
  leads: { listForMobileCRM: 'leads:listForMobileCRM', visitCommunityFind: 'leads:visitCommunityFind' },
  prospects: { searchNearby: 'prospects:searchNearby', listMyReservations: 'prospects:listMyReservations', reserve: 'prospects:reserve' },
  submissions: { getPricingContext: 'submissions:getPricingContext' },
} }));
jest.mock('react-native-maps', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef((props: any, ref: unknown) => {
      ReactModule.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimate }));
      return ReactModule.createElement(View, { ...props, testID: 'native-map' }, props.children);
    }),
    Marker: ({ children }: { children: React.ReactNode }) => ReactModule.createElement(View, null, children),
    PROVIDER_GOOGLE: 'google',
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));
jest.mock('../services/links', () => ({ openDirections: jest.fn() }));

const imported = { _id: 'pool-ramon', businessName: 'Ramon’s Barber', latitude: 14.651,
  longitude: 121.1, category: 'Barber', address: '10 Main Street', city: 'Marikina' };
const community = { _id: 'lead-nena', source: 'community', businessName: 'Aling Nena’s',
  businessLatitude: 14.652, businessLongitude: 121.1, businessType: 'Sari-sari',
  businessAddress: '12 Main Street', businessCity: 'Marikina', status: 'new',
  needsWebsite: true, hasLiveWebsite: false, submissionStatus: null,
  spottedBy: { creatorId: 'agent-jun', displayName: 'Jun D.', profileImage: null },
};

beforeEach(() => {
  jest.clearAllMocks(); mockAuthenticated = true; mockOnline = true;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, listener) => {
    mockReduceMotionChanged = listener as (value: boolean) => void;
    return { remove: jest.fn() };
  });
  // Bridge native gesture events to the real sheet callbacks. Animated values
  // still update normally; only the clock is made synchronous in this suite.
  jest.spyOn(PanResponder, 'create').mockImplementation((config) => ({ panHandlers: {
    onMoveShouldSetResponder: config.onMoveShouldSetPanResponder,
    onMoveShouldSetResponderCapture: config.onMoveShouldSetPanResponderCapture,
    onResponderGrant: config.onPanResponderGrant,
    onResponderMove: config.onPanResponderMove,
    onResponderRelease: config.onPanResponderRelease,
    onResponderTerminate: config.onPanResponderTerminate,
  } } as unknown as ReturnType<typeof PanResponder.create>));
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
    start: (callback?: (result: { finished: boolean }) => void) => {
      if (typeof config.toValue === 'number') (value as Animated.Value).setValue(config.toValue);
      callback?.({ finished: true });
    }, stop: jest.fn(), reset: jest.fn(),
  }));
  mockData = {
    'leads:listForMobileCRM': { leads: [], stats: {} },
    'prospects:searchNearby': [], 'prospects:listMyReservations': [],
    'submissions:getPricingContext': { priceCeiling: 4999, basePrice: 999, unlocked: true },
  };
  mockQuery.mockImplementation((reference: string, args: unknown) => args === 'skip' ? undefined : mockData[reference]);
  mockReserve.mockReset().mockImplementation(async () => {
    mockData['prospects:searchNearby'] = [];
    mockData['prospects:listMyReservations'] = [{ ...imported, reservationExpiresAt: Date.now() + 86_400_000 }];
    return { prospectId: imported._id };
  });
  mockVisit.mockReset().mockImplementation(async () => {
    const claimExpiresAt = Date.now() + 86_400_000;
    mockData['leads:listForMobileCRM'] = { leads: [{ ...community, claimExpiresAt,
      claimedBy: { creatorId: mockCreator._id, displayName: 'Mika S.', profileImage: null, isMine: true } }] };
    return { leadId: community._id, claimExpiresAt };
  });
});
afterEach(() => jest.restoreAllMocks());

function renderMap() { return render(<FieldAgentMap creator={mockCreator} monthlyEarnings={7500} unreadCount={0} />); }

it('reserves a real pool id and opens capture without putting that id in the legacy leads field', async () => {
  mockData['prospects:searchNearby'] = [imported];
  const screen = renderMap();
  fireEvent.press(screen.getByRole('button', { name: /Ramon’s Barber,/ }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'I’m visiting' })); });
  expect(mockReserve).toHaveBeenCalledWith({ prospectId: imported._id });
  expect(mockVisit).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Start interview' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(app)/submit/info', params: {
    businessName: imported.businessName, phone: '', address: imported.address, city: imported.city, category: imported.category,
    latitude: String(imported.latitude), longitude: String(imported.longitude),
  } });
});

it('visits a community find through its exclusive API and keeps its lead id for capture', async () => {
  mockData['leads:listForMobileCRM'] = { leads: [community] };
  const screen = renderMap();
  fireEvent.press(screen.getByRole('button', { name: /Aling Nena’s,/ }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'I’m visiting' })); });
  expect(mockVisit).toHaveBeenCalledWith({ leadId: community._id });
  expect(mockReserve).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Start interview' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(app)/submit/info', params: {
    prospectLeadId: community._id, businessName: community.businessName, phone: '',
    address: community.businessAddress, city: community.businessCity, category: community.businessType,
    latitude: String(community.businessLatitude), longitude: String(community.businessLongitude),
  } });
});

it('does not offer visiting or capturing a shop already claimed by a different agent', () => {
  mockData['leads:listForMobileCRM'] = { leads: [{ ...community, claimExpiresAt: Date.now() + 86_400_000,
    claimedBy: { creatorId: 'agent-joy', displayName: 'Joy D.', profileImage: null, isMine: false } }] };
  const screen = renderMap();
  fireEvent.press(screen.getByRole('button', { name: /Aling Nena’s,/ }));
  expect(screen.queryByRole('button', { name: 'I’m visiting' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Start interview' })).toBeNull();
  expect(screen.getByText('Joy D. is visiting this shop.')).toBeTruthy();
  expect(mockReserve).not.toHaveBeenCalled(); expect(mockVisit).not.toHaveBeenCalled();
});

it('blocks offline visits while retaining the cached shop details', () => {
  mockOnline = false;
  mockData['leads:listForMobileCRM'] = { leads: [community] };
  const screen = renderMap();
  fireEvent.press(screen.getByRole('button', { name: /Aling Nena’s,/ }));
  const visitButton = screen.getByRole('button', { name: 'I’m visiting' });
  expect(visitButton).toBeDisabled();
  fireEvent.press(visitButton);
  expect(mockVisit).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled();
});

it('keeps every authenticated map query skipped until Convex auth is ready', () => {
  mockAuthenticated = false;
  renderMap();
  expect(mockQuery).toHaveBeenCalledWith('leads:listForMobileCRM', 'skip');
  expect(mockQuery).toHaveBeenCalledWith('prospects:searchNearby', 'skip');
  expect(mockQuery).toHaveBeenCalledWith('prospects:listMyReservations', 'skip');
  expect(mockQuery).toHaveBeenCalledWith('submissions:getPricingContext', 'skip');
});

it('opens the shared Finds tab from See list', () => {
  const screen = renderMap();
  fireEvent.press(screen.getByRole('link', { name: 'See list' }));
  expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/finds');
});

function dragSheet(screen: ReturnType<typeof renderMap>, dy: number, vy = 0) {
  const header = screen.getByTestId('nearby-shops-sheet-header');
  const event = { nativeEvent: {} };
  const gesture = { dy, dx: 0, vy, vx: 0 };
  act(() => {
    fireEvent(header, 'responderGrant', event, { ...gesture, dy: 0 });
    fireEvent(header, 'responderMove', event, gesture);
    fireEvent(header, 'responderRelease', event, gesture);
  });
}

it('drags down to a small peek and back up to the complete loaded nearby list', () => {
  mockData['prospects:searchNearby'] = Array.from({ length: 35 }, (_, index) => ({ ...imported,
    _id: `pool-${index}`, businessName: `Shop ${index + 1}` }));
  const screen = renderMap();
  expect(screen.queryByRole('button', { name: /Shop 35,/ })).toBeNull();
  dragSheet(screen, 400);
  expect(screen.getByRole('button', { name: 'Show nearby shops' }).props.accessibilityValue.text).toBe('Minimized');
  expect(screen.queryByRole('button', { name: /Shop 1,/ })).toBeNull();
  dragSheet(screen, -900);
  expect(screen.getByRole('button', { name: 'Minimize nearby shops' }).props.accessibilityValue.text).toBe('Full list');
  expect(screen.getByRole('button', { name: /Shop 35,/ })).toBeTruthy();
  expect(screen.getByTestId('nearby-shops-full-list').props.horizontal).not.toBe(true);
  expect(mockPush).not.toHaveBeenCalled();
});

it('keeps the active site filter when expanding and allows list scrolling and selecting a shop', () => {
  mockData['leads:listForMobileCRM'] = { leads: [community, { ...community, _id: 'lead-live',
    businessName: 'Live shop', hasLiveWebsite: true, needsWebsite: false }] };
  const screen = renderMap();
  fireEvent.press(screen.getByRole('button', { name: 'Needs a site · 1' }));
  fireEvent.press(screen.getByRole('button', { name: 'Show all nearby shops' }));
  const list = screen.getByTestId('nearby-shops-full-list');
  fireEvent.scroll(list, { nativeEvent: { contentOffset: { x: 0, y: 100 }, contentSize: { width: 300, height: 1500 }, layoutMeasurement: { width: 300, height: 500 } } });
  expect(screen.queryByRole('button', { name: /Live shop,/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Needs a site · 1' }).props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: /Aling Nena’s,/ }));
  expect(screen.getByRole('button', { name: 'I’m visiting' })).toBeTruthy();
  expect(mockVisit).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('link', { name: 'Close shop details' }));
  expect(screen.getByTestId('nearby-shops-full-list')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Needs a site · 1' }).props.accessibilityState.selected).toBe(true);
});

it('preserves selected shop details when minimized and reopened without making the map a modal', () => {
  mockData['prospects:searchNearby'] = [imported];
  const screen = renderMap();
  fireEvent.press(screen.getByRole('button', { name: /Ramon’s Barber,/ }));
  dragSheet(screen, 900);
  expect(screen.queryByRole('button', { name: 'Route' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Show nearby shops' }));
  expect(screen.getByRole('link', { name: 'Close shop details' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Route' })).toBeTruthy();
  // A touch outside the actual panel still goes straight to the native map.
  fireEvent.press(screen.getByTestId('native-map'));
  expect(screen.queryByRole('link', { name: 'Close shop details' })).toBeNull();
  expect(screen.getByRole('button', { name: /Ramon’s Barber,/ })).toBeTruthy();
});

it('snaps an interrupted header drag back and ignores horizontal drags', () => {
  const screen = renderMap();
  const header = screen.getByTestId('nearby-shops-sheet-header');
  expect(header.props.onMoveShouldSetResponder({}, { dy: 2, dx: 40 })).toBe(false);
  expect(header.props.onMoveShouldSetResponder({}, { dy: -40, dx: 2 })).toBe(true);
  act(() => {
    fireEvent(header, 'responderGrant', {}, { dy: 0, dx: 0 });
    fireEvent(header, 'responderMove', {}, { dy: -800, dx: 0 });
    fireEvent(header, 'responderTerminate', {}, { dy: -800, dx: 0 });
  });
  expect(screen.getByRole('button', { name: 'Show all nearby shops' }).props.accessibilityValue.text).toBe('Preview');
  expect(screen.queryByTestId('nearby-shops-full-list')).toBeNull();
});

it('supports accessible snap actions and skips animation when Reduce Motion is enabled', async () => {
  const screen = renderMap();
  await act(async () => { await Promise.resolve(); mockReduceMotionChanged(true); });
  jest.mocked(Animated.timing).mockClear();
  fireEvent(screen.getByRole('button', { name: 'Show all nearby shops' }), 'accessibilityAction', { nativeEvent: { actionName: 'collapse' } });
  expect(screen.getByRole('button', { name: 'Show nearby shops' }).props.accessibilityValue.text).toBe('Minimized');
  fireEvent(screen.getByRole('button', { name: 'Show nearby shops' }), 'accessibilityAction', { nativeEvent: { actionName: 'expand' } });
  expect(screen.getByRole('button', { name: 'Minimize nearby shops' }).props.accessibilityState.expanded).toBe(true);
  expect(Animated.timing).not.toHaveBeenCalled();
});
