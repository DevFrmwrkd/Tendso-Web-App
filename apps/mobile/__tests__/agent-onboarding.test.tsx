import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AgentOnboardingScreen from '../app/(app)/agent-onboarding';

const mockRouter = { replace: jest.fn(), back: jest.fn() };
const mockSaveWorkArea = jest.fn();
const mockComplete = jest.fn();
const mockSignOut = jest.fn();
const mockPermission = jest.fn();
const mockPosition = jest.fn();
const mockGeocode = jest.fn();
let mockMobile: any;

jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => mockMobile }));
jest.mock('@clerk/clerk-expo', () => ({ useClerk: () => ({ signOut: mockSignOut }) }));
jest.mock('convex/react', () => ({
  useMutation: (reference: string) => reference.endsWith(':saveWorkArea') ? mockSaveWorkArea : mockComplete,
}));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: () => mockPermission(),
  getCurrentPositionAsync: (...args: unknown[]) => mockPosition(...args),
  reverseGeocodeAsync: (...args: unknown[]) => mockGeocode(...args),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));
jest.mock('../components/TikTokLogo', () => ({ TikTokLogo: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
  mockSaveWorkArea.mockReset().mockResolvedValue({ city: 'Marikina', source: 'city' });
  mockComplete.mockReset().mockResolvedValue({ completed: true });
  mockSignOut.mockReset().mockResolvedValue(undefined);
  mockPermission.mockReset().mockResolvedValue({ status: 'granted' });
  mockPosition.mockReset().mockResolvedValue({ coords: { latitude: 14.65, longitude: 121.1 } });
  mockGeocode.mockReset().mockResolvedValue([{ city: 'Marikina' }]);
  mockMobile = {
    account: { _id: 'agent_1', role: 'creator', fieldAgentOnboardingRequired: true },
    role: 'creator', isPreview: false, isBlocked: false, isLoading: false, isOffline: false,
  };
});

afterEach(() => { jest.useRealTimers(); });

function next(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
}

it('requires a city, persists the answer, and keeps it when going back from source selection', async () => {
  const screen = render(<AgentOnboardingScreen />);
  expect(screen.getByText('Where do you work?')).toBeTruthy();
  expect(screen.getByLabelText('Step 1 of 2')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Marikina' }));
  next(screen);
  await waitFor(() => expect(screen.getByText('How did you hear about us?')).toBeTruthy());
  expect(mockSaveWorkArea).toHaveBeenCalledWith({ city: 'Marikina', source: 'city' });
  expect(mockPermission).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('radio', { name: 'Facebook' }));
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('button', { name: 'Marikina' }).props.accessibilityState.selected).toBe(true);
  next(screen);
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Facebook' }).props.accessibilityState.selected).toBe(true));
});

it('lets someone deny location access and continue with a manually selected city', async () => {
  mockPermission.mockResolvedValue({ status: 'denied' });
  const screen = render(<AgentOnboardingScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  await waitFor(() => expect(screen.getByText('Location access is off. Choose your city below to continue.')).toBeTruthy());
  expect(mockPosition).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Cebu City' }));
  next(screen);
  await waitFor(() => expect(mockSaveWorkArea).toHaveBeenCalledWith({ city: 'Cebu City', source: 'city' }));
  expect(screen.getByText('How did you hear about us?')).toBeTruthy();
});

it('saves real device coordinates after permission and reverse geocoding', async () => {
  const screen = render(<AgentOnboardingScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled());
  next(screen);
  await waitFor(() => expect(mockSaveWorkArea).toHaveBeenCalledWith({ city: 'Marikina', latitude: 14.65, longitude: 121.1, source: 'device' }));
});

it('recovers from a location timeout without blocking manual city selection', async () => {
  jest.useFakeTimers();
  mockPosition.mockReturnValue(new Promise(() => {}));
  const screen = render(<AgentOnboardingScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  await act(async () => { await Promise.resolve(); });
  await act(async () => { jest.advanceTimersByTime(15_000); });
  expect(screen.getByText('Location is taking too long. Choose your city below, or try again.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Baguio' }));
  next(screen);
  await act(async () => { await Promise.resolve(); });
  expect(mockSaveWorkArea).toHaveBeenCalledWith({ city: 'Baguio', source: 'city' });
});

it('supports an unlisted city without requesting location permission', async () => {
  const screen = render(<AgentOnboardingScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Other city' }));
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Your city'), '  San   Fernando  ');
  next(screen);
  await waitFor(() => expect(mockSaveWorkArea).toHaveBeenCalledWith({ city: 'San Fernando', source: 'city' }));
  expect(mockPermission).not.toHaveBeenCalled();
});

it('discards stale device coordinates when a new location cannot resolve a city', async () => {
  mockMobile.account = { ...mockMobile.account, workCity: 'Manila', workLatitude: 14.6, workLongitude: 120.9, workLocationSource: 'device' };
  mockGeocode.mockResolvedValue([]);
  const screen = render(<AgentOnboardingScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  await waitFor(() => expect(screen.getByText('Location found. Enter your city below to continue.')).toBeTruthy());
  next(screen);
  await waitFor(() => expect(mockSaveWorkArea).toHaveBeenCalledWith({ city: 'Manila', source: 'city' }));
});

it('preserves the city after a failed save and retries before advancing', async () => {
  mockSaveWorkArea.mockRejectedValueOnce(new Error('Connection lost. Try again.'));
  const screen = render(<AgentOnboardingScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Pasig' }));
  next(screen);
  await waitFor(() => expect(screen.getByText('Connection lost. Try again.')).toBeTruthy());
  expect(screen.getByText('Where do you work?')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Pasig' }).props.accessibilityState.selected).toBe(true);
  next(screen);
  await waitFor(() => expect(screen.getByText('How did you hear about us?')).toBeTruthy());
  expect(mockSaveWorkArea).toHaveBeenCalledTimes(2);
});

it('resumes the second question and preserves an existing referral without sending a replacement', async () => {
  mockMobile.account = { ...mockMobile.account, workCity: 'Manila', referredByName: 'Joy Dizon', referredByCode: 'JOYD4K2' };
  const screen = render(<AgentOnboardingScreen />);
  expect(screen.getByText('Joy Dizon · JOYD4K2')).toBeTruthy();
  expect(screen.queryByLabelText('Who sent you? (optional)')).toBeNull();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  fireEvent.press(screen.getByRole('radio', { name: 'A friend or another agent' }));
  next(screen);
  await waitFor(() => expect(mockComplete).toHaveBeenCalledWith({ discoverySource: 'friend' }));
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(tabs)');
});

it('preserves the source and referral code after validation fails, then accepts a corrected code', async () => {
  mockMobile.account.workCity = 'Makati';
  mockComplete.mockRejectedValueOnce(new Error('Invalid referral code'));
  const screen = render(<AgentOnboardingScreen />);
  fireEvent.press(screen.getByRole('radio', { name: 'A shop’s Tendso site' }));
  fireEvent.changeText(screen.getByLabelText('Who sent you? (optional)'), 'wrong');
  next(screen);
  await waitFor(() => expect(screen.getByText('Invalid referral code')).toBeTruthy());
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Who sent you? (optional)').props.value).toBe('wrong');
  expect(screen.getByRole('radio', { name: 'A shop’s Tendso site' }).props.accessibilityState.selected).toBe(true);
  fireEvent.changeText(screen.getByLabelText('Who sent you? (optional)'), ' joyd4k2 ');
  next(screen);
  await waitFor(() => expect(mockComplete).toHaveBeenLastCalledWith({ discoverySource: 'shop_website', referredByCode: 'JOYD4K2' }));
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(tabs)');
});

it('prevents duplicate completion and ignores navigation after an unmounted request finishes', async () => {
  mockMobile.account.workCity = 'Davao';
  let finish!: () => void;
  mockComplete.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  const screen = render(<AgentOnboardingScreen />);
  fireEvent.press(screen.getByRole('radio', { name: 'TikTok' }));
  next(screen);
  next(screen);
  expect(mockComplete).toHaveBeenCalledTimes(1);
  screen.unmount();
  await act(async () => { finish(); });
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it.each([
  { role: 'affiliate', required: true, preview: false },
  { role: 'admin', required: true, preview: true },
  { role: 'creator', required: undefined, preview: false },
  { role: 'creator', required: false, preview: false },
])('skips these questions for $role with required=$required and preview=$preview', ({ role, required, preview }) => {
  mockMobile.role = role;
  mockMobile.isPreview = preview;
  mockMobile.account.fieldAgentOnboardingRequired = required;
  const screen = render(<AgentOnboardingScreen />);
  expect(screen.queryByText('Where do you work?')).toBeNull();
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(tabs)');
  expect(mockSaveWorkArea).not.toHaveBeenCalled();
});

it('offers sign out on the first question instead of a back navigation loop', async () => {
  const screen = render(<AgentOnboardingScreen />);
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  fireEvent.press(screen.getByRole('link', { name: 'Sign out' }));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  expect(mockRouter.replace).toHaveBeenCalledWith('/');
});
