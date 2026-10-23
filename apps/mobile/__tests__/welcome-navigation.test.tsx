import React from 'react';
import { Animated } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Index from '../app/index';

const mockReplace = jest.fn();
const mockSetOwnerIntent = jest.fn(async (_owner: boolean) => {});
let mockParams: { welcome?: string | string[] } = {};
let mockAuth = { isLoaded: true, isSignedIn: false };
let mockConnected: boolean | null = true;
let mockOwnerBefore = false;

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    useRouter: () => ({ replace: mockReplace }),
    useLocalSearchParams: () => mockParams,
    Redirect: ({ href }: { href: string }) => <Text testID="redirect">{href}</Text>,
  };
});
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => mockAuth }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('../lib/v2/ownerIntake', () => ({
  hasOwnerIntent: async () => mockOwnerBefore,
  setOwnerIntent: (owner: boolean) => mockSetOwnerIntent(owner),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 34 }) }));
jest.mock('../components/v2', () => {
  const { Text, Pressable } = require('react-native');
  return {
    Text,
    Button: ({ title, onPress }: { title: string; onPress: () => void }) => (
      <Pressable accessibilityRole="button" onPress={onPress}><Text>{title}</Text></Pressable>
    ),
  };
});
jest.mock('../components/v2/owner/OwnerUI', () => ({ Buddy: () => null }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Defs: 'MockDefs', LinearGradient: 'MockGradient',
  Rect: 'MockRect', Stop: 'MockStop',
}));

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  mockAuth = { isLoaded: true, isSignedIn: false };
  mockConnected = true;
  mockOwnerBefore = false;
  await AsyncStorage.clear();
  // The photo wall loops forever in the app. Navigation assertions do not need
  // animation timers or the welcome card's entrance transition.
  jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
});

afterEach(() => jest.restoreAllMocks());

describe('Welcome choice navigation', () => {
  it('shows the choices on the first signed-out launch', async () => {
    const screen = render(<Index />);
    await waitFor(() => expect(screen.getByText('I have a business')).toBeTruthy());
    expect(screen.getByText('I want to earn')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it.each([
    [false, '/(auth)/login'],
    [true, '/(auth)/owner'],
  ] as const)('keeps the returning signed-out redirect when owner intent is %s', async (owner, route) => {
    await AsyncStorage.setItem('ndm_has_seen_onboarding', 'true');
    mockOwnerBefore = owner;
    const screen = render(<Index />);
    await waitFor(() => expect(screen.getByTestId('redirect').props.children).toBe(route));
    expect(screen.queryByText('I have a business')).toBeNull();
  });

  it('allows a returning signed-out person to reopen Welcome without deleting saved intent', async () => {
    await AsyncStorage.setItem('ndm_has_seen_onboarding', 'true');
    mockOwnerBefore = true;
    mockParams = { welcome: '1' };
    const screen = render(<Index />);
    await waitFor(() => expect(screen.getByText('I have a business')).toBeTruthy());
    expect(screen.getByText('I want to earn')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(await AsyncStorage.getItem('ndm_has_seen_onboarding')).toBe('true');
    expect(mockSetOwnerIntent).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('still sends signed-in people into account routing when Welcome is requested', async () => {
    await AsyncStorage.setItem('ndm_has_seen_onboarding', 'true');
    mockParams = { welcome: '1' };
    mockAuth.isSignedIn = true;
    const screen = render(<Index />);
    await waitFor(() => expect(screen.getByTestId('redirect').props.children).toBe('/(app)/(tabs)/'));
    expect(screen.queryByText('I have a business')).toBeNull();
  });

  it('preserves the cached signed-in route while offline even with the Welcome override', async () => {
    await AsyncStorage.setItem('ndm_was_signed_in', 'true');
    mockParams = { welcome: '1' };
    mockConnected = false;
    mockAuth = { isLoaded: false, isSignedIn: false };
    const screen = render(<Index />);
    await waitFor(() => expect(screen.getByTestId('redirect').props.children).toBe('/(app)/(tabs)/'));
    expect(screen.queryByText('I have a business')).toBeNull();
  });

  it.each([
    ['I have a business', true, '/(auth)/owner'],
    ['I want to earn', false, '/(auth)/signup'],
  ] as const)('keeps %s connected to its account intent and signup route', async (label, owner, route) => {
    await AsyncStorage.setItem('ndm_has_seen_onboarding', 'true');
    mockParams = { welcome: '1' };
    const screen = render(<Index />);
    await waitFor(() => expect(screen.getByText(label)).toBeTruthy());
    fireEvent.press(screen.getByText(label));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(route));
    expect(mockSetOwnerIntent).toHaveBeenCalledWith(owner);
    expect(await AsyncStorage.getItem('ndm_has_seen_onboarding')).toBe('true');
  });

  it('keeps the existing-account choice on sign-in without changing owner intent', async () => {
    mockParams = { welcome: '1' };
    mockOwnerBefore = true;
    const screen = render(<Index />);
    await waitFor(() => expect(screen.getByText('I already have an account')).toBeTruthy());
    fireEvent.press(screen.getByText('I already have an account'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
    expect(mockSetOwnerIntent).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('ndm_has_seen_onboarding')).toBe('true');
  });
});
