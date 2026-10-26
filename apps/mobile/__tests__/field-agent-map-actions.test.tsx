import React from 'react';
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
    default: ReactModule.forwardRef(({ children }: { children: React.ReactNode }, ref: unknown) => {
      ReactModule.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimate }));
      return ReactModule.createElement(View, { testID: 'native-map' }, children);
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
