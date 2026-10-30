import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { CommunityFinds } from '../components/field-agent/CommunityFinds';
import { ShopImage } from '../components/ShopImage';
import type { CommunityFind } from '../services/fieldAgentMap';
import type { MapSearchArea } from '../services/workArea';

const mockQuery = jest.fn();
const mockMutation = jest.fn();
const mockRequestLocation = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockAuthenticated: boolean;
let mockArea: MapSearchArea | null;
let mockLeads: CommunityFind[];

jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock('../hooks/useWorkAreaLocation', () => ({ useWorkAreaLocation: () => ({
  area: mockArea, requestCurrentLocation: mockRequestLocation, isLocating: false,
}) }));
jest.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: mockAuthenticated }),
  useQuery: (...args: unknown[]) => mockQuery(...args),
  useMutation: () => mockMutation,
}));
jest.mock('@tendso/convex-client', () => ({ api: { leads: { listForMobileCRM: 'leads:listForMobileCRM' } } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));

const savedArea: MapSearchArea = { latitude: 14.65, longitude: 121.1, source: 'work', label: 'Marikina' };

function find(id: string, km: number, name = id, spottedAt = 1): CommunityFind {
  return {
    _id: id, source: 'community', businessName: name, businessCity: 'Marikina',
    businessLatitude: savedArea.latitude + km / 111.195, businessLongitude: savedArea.longitude,
    businessType: 'Food', communityKind: 'food', needsWebsite: true, hasLiveWebsite: false,
    spottedAt, status: 'new',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthenticated = true;
  mockArea = savedArea;
  mockLeads = [find('Near shop', 0.5), find('Medium shop', 4), find('Far shop', 20), find('Outside shop', 30)];
  mockQuery.mockImplementation((_reference: string, args: unknown) => args === 'skip' ? undefined : { leads: mockLeads });
  mockRequestLocation.mockResolvedValue(undefined);
});

it('defaults Near me to 5 km with accessible, independently selected distance choices', () => {
  const screen = render(<CommunityFinds />);
  expect(screen.getByRole('button', { name: 'Near me' }).props.accessibilityState.selected).toBe(true);
  for (const km of [1, 3, 5, 10, 25]) {
    expect(screen.getByRole('button', { name: `Within ${km} km` }).props.accessibilityState.selected).toBe(km === 5);
  }
  expect(screen.getByText('Within 5 km of Marikina')).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Near shop,/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Medium shop,/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Far shop,/ })).toBeNull();
});

it('updates the real distance filter locally without changing backend args or making mutations', () => {
  const screen = render(<CommunityFinds />);
  fireEvent.press(screen.getByRole('button', { name: 'Within 25 km' }));
  expect(screen.getByRole('button', { name: 'Within 25 km' }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByRole('button', { name: 'Within 5 km' }).props.accessibilityState.selected).toBe(false);
  expect(screen.getByText('Within 25 km of Marikina')).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Far shop,/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Outside shop,/ })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Within 1 km' }));
  expect(screen.getByRole('button', { name: /^Near shop,/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Medium shop,/ })).toBeNull();
  expect(mockQuery.mock.calls.every(([reference, args]) => reference === 'leads:listForMobileCRM'
    && JSON.stringify(args) === JSON.stringify({ statusFilter: 'all' }))).toBe(true);
  expect(mockMutation).not.toHaveBeenCalled();
});

it('retains a search and orders its matching shops by real distance after expanding the range', () => {
  mockLeads = [find('far', 6, 'Nena farther', 100), find('near', 0.5, 'Nena nearer', 1), find('unrelated', 0.2, 'Ramon Repair', 200)];
  const screen = render(<CommunityFinds />);
  fireEvent.changeText(screen.getByLabelText('Search community finds'), 'Nena');
  fireEvent.press(screen.getByRole('button', { name: 'Within 10 km' }));
  expect(screen.getByLabelText('Search community finds').props.value).toBe('Nena');
  const matches = screen.getAllByRole('button', { name: /^Nena / });
  expect(matches.map((node) => node.props.accessibilityLabel.split(',')[0])).toEqual(['Nena nearer', 'Nena farther']);
  expect(screen.queryByRole('button', { name: /^Ramon Repair,/ })).toBeNull();
});

it.each(['All finds', 'Needs a site', 'Food'])('hides distance controls in %s and remembers the range when returning to Near me', (filter) => {
  const screen = render(<CommunityFinds />);
  fireEvent.press(screen.getByRole('button', { name: 'Within 25 km' }));
  fireEvent.changeText(screen.getByLabelText('Search community finds'), 'shop');
  const filterPill = screen.getAllByRole('button', { name: filter })
    .find((node) => typeof node.props.accessibilityState?.selected === 'boolean');
  expect(filterPill).toBeDefined();
  fireEvent.press(filterPill!);
  expect(screen.queryByRole('button', { name: 'Within 25 km' })).toBeNull();
  expect(screen.queryByText('Within 25 km of Marikina')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Near me' }));
  expect(screen.getByRole('button', { name: 'Within 25 km' }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText('Search community finds').props.value).toBe('shop');
  expect(screen.getByRole('button', { name: /^Far shop,/ })).toBeTruthy();
});

it('describes GPS distances as coming from the actual device location', () => {
  mockArea = { ...savedArea, source: 'device', label: 'you' };
  const screen = render(<CommunityFinds />);
  expect(screen.getByText('Within 5 km of your location')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Within 3 km' }));
  expect(screen.getByText('Within 3 km of your location')).toBeTruthy();
  expect(screen.queryByText('Within 3 km of Marikina')).toBeNull();
});

it('allows choosing a range without an origin and preserves both range and search after requesting GPS', () => {
  mockArea = null;
  mockLeads = [find('nena', 6, 'Nena Store'), find('ramon', 0.5, 'Ramon Repair')];
  const screen = render(<CommunityFinds />);
  expect(screen.queryByRole('button', { name: 'Within 5 km' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Near me' }));
  fireEvent.press(screen.getByRole('button', { name: 'Within 10 km' }));
  fireEvent.changeText(screen.getByLabelText('Search community finds'), 'Nena');
  expect(screen.getByText('Search range')).toBeTruthy();
  expect(screen.getByText('Choose your location')).toBeTruthy();
  expect(screen.getByText('Use your location to see finds within 10 km. Your saved work city also works.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  expect(mockRequestLocation).toHaveBeenCalledTimes(1);
  mockArea = { ...savedArea, source: 'device', label: 'you' };
  screen.rerender(<CommunityFinds />);
  expect(screen.getByText('Within 10 km of your location')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Within 10 km' }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText('Search community finds').props.value).toBe('Nena');
  expect(screen.getByRole('button', { name: /^Nena Store,/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Ramon Repair,/ })).toBeNull();
});

it('uses the chosen range in a truthful empty state and lets the user expand it to recover matching shops', () => {
  mockLeads = [find('nena', 2, 'Nena Store')];
  const screen = render(<CommunityFinds />);
  fireEvent.changeText(screen.getByLabelText('Search community finds'), 'Nena');
  fireEvent.press(screen.getByRole('button', { name: 'Within 1 km' }));
  expect(screen.getByText('No matching finds within 1 km. Increase the range or try another search.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Nena Store,/ })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Within 3 km' }));
  expect(screen.getByRole('button', { name: /^Nena Store,/ })).toBeTruthy();
  expect(screen.getByLabelText('Search community finds').props.value).toBe('Nena');
});

it('preserves the authenticated query guard while a distance choice changes', () => {
  mockAuthenticated = false;
  const screen = render(<CommunityFinds />);
  fireEvent.press(screen.getByRole('button', { name: 'Within 25 km' }));
  expect(mockQuery.mock.calls.every(([reference, args]) => reference === 'leads:listForMobileCRM' && args === 'skip')).toBe(true);
  expect(mockMutation).not.toHaveBeenCalled();
});

it('shows a local storefront for missing/failed photos while preserving card navigation and recovering updated photos', () => {
  mockLeads = [{ ...find('photo-shop', 0.5, 'Ramon Shop'), photoUrl: 'https://images.example.com/ramon.jpg' },
    find('missing-photo', 0.6, 'Nena Store')];
  const screen = render(<CommunityFinds />);
  const tileImage = (name: string) => screen.UNSAFE_getAllByType(ShopImage).find(node => node.props.name === name)!;
  expect(tileImage('Nena Store').findByType(Image).props.source).toEqual(require('../assets/placeholders/shop.png'));
  expect(tileImage('Ramon Shop').findByType(Image).props.source.uri).toBe('https://images.example.com/ramon.jpg');
  fireEvent(tileImage('Ramon Shop').findByType(Image), 'error', { nativeEvent: { error: 'Photo unavailable' } });
  expect(tileImage('Ramon Shop').findByType(Image).props.source).toEqual(require('../assets/placeholders/shop.png'));
  fireEvent.press(screen.getByRole('button', { name: /^Ramon Shop,/ }));
  expect(mockPush).toHaveBeenCalledWith('/(app)/leads/photo-shop');
  mockLeads = mockLeads.map(lead => lead._id === 'photo-shop' ? { ...lead, photoUrl: 'https://images.example.com/replaced.jpg' } : lead);
  screen.rerender(<CommunityFinds />);
  expect(tileImage('Ramon Shop').findByType(Image).props.source.uri).toBe('https://images.example.com/replaced.jpg');
  expect(screen.getByRole('button', { name: /^Nena Store,/ })).toBeTruthy();
});
