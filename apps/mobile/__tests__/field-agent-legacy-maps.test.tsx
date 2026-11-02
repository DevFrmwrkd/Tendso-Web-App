import React from 'react';
import { Alert, Image } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import DiscoverLeadsScreen from '../app/(app)/leads/discover';
import NearbyLeadsScreen from '../app/(app)/leads/nearby';
import LeadsScreen from '../app/(app)/leads';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockQuery = jest.fn();
const mockReserve = jest.fn();
const mockScrape = jest.fn();
const mockGeocode = jest.fn();
const mockAnimate = jest.fn();
let mockAuthenticated = true;
let mockConnected = true;
let mockCertified = true;
let mockAccountId = 'agent-1';
let mockParams: Record<string, string> = {};
let mockData: Record<string, any> = {};
const mockArea = { latitude: 14.65, longitude: 121.1, source: 'work', label: 'Marikina' };

jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => ({
  account: { _id: mockAccountId, certifiedAt: mockCertified ? 1 : undefined,
    workCity: 'Marikina', workLatitude: 14.65, workLongitude: 121.1 }, isBlocked: false,
}) }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('../hooks/useWorkAreaLocation', () => ({ useWorkAreaLocation: () => ({
  area: mockArea, currentLocation: null, permissionStatus: 'idle', requestCurrentLocation: jest.fn(),
  isLocating: false, isLoading: false,
}) }));
jest.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: mockAuthenticated }),
  useQuery: (...args: unknown[]) => mockQuery(...args),
  useMutation: () => mockReserve,
  useAction: () => mockScrape,
}));
jest.mock('@tendso/convex-client', () => ({ api: {
  leads: { listForMobileCRM: 'crm' }, outscraper: { listScrapedLeads: 'scraped', scrapeNearby: 'scrape' },
  prospects: { searchNearby: 'pool', reserve: 'reserve' },
} }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('expo-location', () => ({ geocodeAsync: (...args: unknown[]) => mockGeocode(...args) }));
jest.mock('react-native-maps', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef((props: any, ref: unknown) => {
      ReactModule.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimate }));
      return ReactModule.createElement(View, { ...props, testID: 'native-map' }, props.children);
    }),
    Marker: (props: any) => ReactModule.createElement(View, { ...props, testID: 'shop-marker' }, props.children),
    PROVIDER_GOOGLE: 'google',
  };
});
jest.mock('../components/ShopImage', () => ({ ShopImage: (props: any) =>
  require('react').createElement(require('react-native').View, { ...props, testID: 'discovery-image' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../services/links', () => ({ openDirections: jest.fn(), openExternalUrl: jest.fn(),
  canOpenDirections: (target: { address?: string; label?: string; latitude?: number; longitude?: number }) =>
    !!(target.address || target.label || (typeof target.latitude === 'number' && typeof target.longitude === 'number')),
}));

const poolShop = { _id: 'pool-1', businessName: 'Pool shop', latitude: 14.651, longitude: 121.1,
  category: 'Barber', city: 'Marikina', address: '12 Rizal Street' };
const crmShop = { _id: 'lead-1', source: 'community', businessName: 'Shared shop',
  businessLatitude: 14.651, businessLongitude: 121.1, businessAddress: '12 Rizal Street', businessCity: 'Marikina',
  status: 'new', businessType: 'Food', photoUrl: 'https://public.example/discovery.jpg',
  previewImageUrl: 'https://private.example/capture.jpg' };

function deferred() {
  let resolve!: (result?: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthenticated = true; mockConnected = true; mockCertified = true; mockAccountId = 'agent-1'; mockParams = {};
  mockData = { pool: [poolShop], scraped: [], crm: { leads: [crmShop], stats: { total: 1, mine: 0 } } };
  mockQuery.mockImplementation((reference: string, args: unknown) => args === 'skip' ? undefined : mockData[reference]);
  mockReserve.mockReset().mockResolvedValue({ prospectId: 'pool-1' });
  mockScrape.mockReset().mockResolvedValue({ businesses: [] });
  mockGeocode.mockReset().mockResolvedValue([{ latitude: 14.651, longitude: 121.1 }]);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it('skips both protected Discover queries until Convex is authenticated', () => {
  mockAuthenticated = false;
  render(<DiscoverLeadsScreen />);
  expect(mockQuery).toHaveBeenCalledWith('scraped', 'skip');
  expect(mockQuery).toHaveBeenCalledWith('pool', 'skip');
});

it.each(['offline', 'uncertified'])('keeps Discover readable but blocks reservation and capture while %s', (state) => {
  mockConnected = state !== 'offline'; mockCertified = state !== 'uncertified';
  const screen = render(<DiscoverLeadsScreen />);
  fireEvent.press(screen.getByRole('button', { name: /^Pool shop,/ }));
  const reserve = screen.getByRole('button', { name: "I'll interview this" });
  const capture = screen.getByRole('link', { name: 'Start with these details' });
  expect(reserve).toBeDisabled(); expect(capture).toBeDisabled();
  fireEvent.press(reserve); fireEvent.press(capture);
  expect(mockReserve).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
});

it('retains a successfully reserved pool shop when the available search removes it and opens the same capture details', async () => {
  mockReserve.mockImplementation(async () => { mockData.pool = []; return { prospectId: 'pool-1' }; });
  const screen = render(<DiscoverLeadsScreen />);
  fireEvent.press(screen.getByRole('button', { name: /^Pool shop,/ }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: "I'll interview this" })); });
  expect(screen.getByText('Yours')).toBeTruthy();
  expect(screen.queryByRole('button', { name: "I'll interview this" })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Start with these details' }));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/submit/info', params: {
    businessName: poolShop.businessName, phone: '', address: poolShop.address, city: poolShop.city, category: poolShop.category,
    latitude: String(poolShop.latitude), longitude: String(poolShop.longitude),
  } });
  expect(mockReserve).toHaveBeenCalledTimes(1);
});

it.each(['account', 'route', 'authentication', 'unmount'])('ignores a delayed reservation completion after %s changes', async (change) => {
  const pending = deferred();
  mockReserve.mockReturnValue(pending.promise);
  const screen = render(<DiscoverLeadsScreen />);
  fireEvent.press(screen.getByRole('button', { name: /^Pool shop,/ }));
  fireEvent.press(screen.getByRole('button', { name: "I'll interview this" }));
  if (change === 'account') mockAccountId = 'agent-2';
  if (change === 'route') mockParams = { category: 'food' };
  if (change === 'authentication') mockAuthenticated = false;
  if (change === 'unmount') screen.unmount(); else screen.rerender(<DiscoverLeadsScreen />);
  await act(async () => pending.resolve({ prospectId: 'pool-1' }));
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
  if (change !== 'unmount') expect(screen.queryByText('Yours')).toBeNull();
});

it('deduplicates reservation taps and disables capture until the request finishes', async () => {
  const pending = deferred(); mockReserve.mockReturnValue(pending.promise);
  const screen = render(<DiscoverLeadsScreen />);
  fireEvent.press(screen.getByRole('button', { name: /^Pool shop,/ }));
  const reserve = screen.getByRole('button', { name: "I'll interview this" });
  fireEvent.press(reserve); fireEvent.press(reserve);
  const capture = screen.getByRole('link', { name: 'Start with these details' });
  expect(capture).toBeDisabled(); fireEvent.press(capture);
  expect(mockReserve).toHaveBeenCalledTimes(1); expect(mockRouter.push).not.toHaveBeenCalled();
  await act(async () => pending.resolve({ prospectId: 'pool-1' }));
});

it('expires a local Discover reservation without waiting for a query refresh', async () => {
  jest.useFakeTimers();
  const screen = render(<DiscoverLeadsScreen />);
  fireEvent.press(screen.getByRole('button', { name: /^Pool shop,/ }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: "I'll interview this" })); });
  expect(screen.getByText('Yours')).toBeTruthy();
  act(() => jest.advanceTimersByTime(86_400_001));
  expect(screen.queryByText('Yours')).toBeNull();
  expect(screen.getByRole('button', { name: "I'll interview this" })).not.toBeDisabled();
});

it.each([NaN, Infinity, 91])('does not pass an invalid latitude (%s) to a native Discover marker', (latitude) => {
  mockData.pool = [{ ...poolShop, latitude }];
  const screen = render(<DiscoverLeadsScreen />);
  expect(screen.queryByTestId('shop-marker')).toBeNull();
});

it.each([true, false])('Nearby uses only public discovery imagery (photo present: %s)', async (hasPhoto) => {
  if (!hasPhoto) mockData.crm.leads = [{ ...crmShop, photoUrl: null }];
  const screen = render(<NearbyLeadsScreen />);
  await act(async () => {});
  const images = screen.getAllByTestId('discovery-image');
  expect(images.length).toBeGreaterThan(0);
  expect(images.every((image) => image.props.uri === (hasPhoto ? crmShop.photoUrl : null))).toBe(true);
  expect(images.some((image) => image.props.uri === crmShop.previewImageUrl)).toBe(false);
  expect(mockGeocode).not.toHaveBeenCalled();
});

it('the CRM list also keeps private submission images out of shared shop cards', () => {
  const screen = render(<LeadsScreen />);
  const uris = screen.UNSAFE_getAllByType(Image).map((image) => image.props.source?.uri).filter(Boolean);
  expect(uris).toContain(crmShop.photoUrl);
  expect(uris).not.toContain(crmShop.previewImageUrl);
});

it('does not start paid shop searches while offline', () => {
  mockConnected = false;
  const screen = render(<LeadsScreen />);
  const search = screen.getByRole('button', { name: 'Find local businesses near you to interview' });
  expect(search).toBeDisabled(); fireEvent.press(search);
  expect(mockScrape).not.toHaveBeenCalled();
});

it.each(['account', 'authentication', 'offline', 'unmount'])('ignores a shop-search result after %s changes', async (change) => {
  const pending = deferred(); mockScrape.mockReturnValue(pending.promise);
  const screen = render(<LeadsScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Find local businesses near you to interview' }));
  fireEvent.press(screen.getByRole('button', { name: 'Find businesses to interview' }));
  expect(mockScrape).toHaveBeenCalledTimes(1);
  if (change === 'account') mockAccountId = 'agent-2';
  if (change === 'authentication') mockAuthenticated = false;
  if (change === 'offline') mockConnected = false;
  if (change === 'unmount') screen.unmount(); else screen.rerender(<LeadsScreen />);
  await act(async () => pending.resolve({ businesses: [poolShop] }));
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});
