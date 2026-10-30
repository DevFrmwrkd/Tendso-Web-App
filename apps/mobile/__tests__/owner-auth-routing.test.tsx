import React from 'react';
import { act, render } from '@testing-library/react-native';
import RootLayout from '../app/_layout';

jest.mock('../global.css', () => ({}));

const mockReplace = jest.fn();
const mockSegments = ['(auth)', 'owner'];
const mockOwnerIntent = jest.fn(async () => true);
jest.mock('expo-router', () => {
  const Stack = () => null;
  Stack.Screen = () => null;
  return { Stack, useRouter: () => ({ replace: mockReplace }), useSegments: () => mockSegments,
    useRootNavigationState: () => ({ key: 'ready' }), useNavigationContainerRef: () => null };
});
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ isLoaded: true, isSignedIn: true }) }));
jest.mock('../providers/AppProviders', () => ({ AppProviders: ({ children }: any) => children }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: true }) }));
jest.mock('../components/ui/SheetDimHost', () => ({ SheetDimHost: ({ children }: any) => children }));
jest.mock('../hooks/useOtaUpdate', () => ({ useOtaUpdate: () => {} }));
jest.mock('../lib/sentry', () => ({ initSentry: () => {}, withSentry: (component: any) => component, sentryEnabled: false }));
jest.mock('../lib/v2/ownerIntake', () => ({ hasOwnerIntent: () => mockOwnerIntent() }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock('@expo-google-fonts/instrument-serif', () => ({ useFonts: () => [true] }));
jest.mock('@expo-google-fonts/onest', () => ({}));
jest.mock('@expo-google-fonts/jetbrains-mono', () => ({}));
jest.mock('@expo-google-fonts/google-sans-flex', () => ({}));

it('sends owner sign-ins through account role resolution instead of trusting device intent', async () => {
  jest.useFakeTimers();
  const screen = render(<RootLayout />);
  await act(async () => { await Promise.resolve(); });
  expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)/');
  expect(mockReplace).not.toHaveBeenCalledWith('/(owner)');
  expect(mockOwnerIntent).not.toHaveBeenCalled();
  screen.unmount();
  jest.useRealTimers();
});
