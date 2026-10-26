import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AgentOnboardingScreen from '../app/(app)/agent-onboarding';

const mockRouter = { replace: jest.fn(), back: jest.fn() };
const mockSaveDiscovery = jest.fn();
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
  useMutation: (reference: string) => {
    if (reference.endsWith(':saveDiscovery')) return mockSaveDiscovery;
    if (reference.endsWith(':saveWorkArea')) return mockSaveWorkArea;
    return mockComplete;
  },
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
  mockSaveDiscovery.mockReset().mockResolvedValue({ saved: true });
  mockSaveWorkArea.mockReset().mockResolvedValue({ city: 'Marikina', source: 'city', completed: true });
  mockComplete.mockReset();
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

function resumeAtCity() {
  mockMobile.account.discoverySource = 'friend';
  return render(<AgentOnboardingScreen />);
}

it('asks how they heard first and saves that answer before showing cities', async () => {
  const screen = render(<AgentOnboardingScreen />);
  expect(screen.getByText('How did you hear about us?')).toBeTruthy();
  expect(screen.getByLabelText('Step 1 of 2')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  expect(screen.queryByText('Where do you work?')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Use my location' })).toBeNull();
  fireEvent.press(screen.getByRole('radio', { name: 'Facebook' }));
  next(screen);
  await waitFor(() => expect(screen.getByText('Where do you work?')).toBeTruthy());
  expect(screen.getByLabelText('Step 2 of 2')).toBeTruthy();
  expect(mockSaveDiscovery).toHaveBeenCalledWith({ discoverySource: 'facebook' });
  expect(mockSaveWorkArea).not.toHaveBeenCalled();
  expect(mockComplete).not.toHaveBeenCalled();
  expect(mockPermission).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('waits for the discovery answer to save before advancing', async () => {
  let finish!: () => void;
  mockSaveDiscovery.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  const screen = render(<AgentOnboardingScreen />);
  fireEvent.press(screen.getByRole('radio', { name: 'TikTok' }));
  next(screen);
  expect(screen.getByText('How did you hear about us?')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Use my location' })).toBeNull();
  await act(async () => { finish(); });
  expect(screen.getByText('Where do you work?')).toBeTruthy();
});

it('requires a city on the final question and finishes only after the city is saved', async () => {
  const screen = resumeAtCity();
  expect(screen.getByText('Where do you work?')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Marikina' }));
  next(screen);
  await waitFor(() => expect(mockSaveWorkArea).toHaveBeenCalledWith({ city: 'Marikina', source: 'city', finish: true }));
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(tabs)');
  expect(mockComplete).not.toHaveBeenCalled();
  expect(mockSaveDiscovery).not.toHaveBeenCalled();
});

it('preserves source, unsent referral and city selections when going back', async () => {
  const screen = render(<AgentOnboardingScreen />);
  fireEvent.press(screen.getByRole('radio', { name: 'Facebook' }));
  next(screen);
  await waitFor(() => expect(screen.getByText('Where do you work?')).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Pasig' }));
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('radio', { name: 'Facebook' }).props.accessibilityState.selected).toBe(true);
  fireEvent.changeText(screen.getByLabelText('Who sent you? (optional)'), 'JOYD4K2');
  mockSaveDiscovery.mockRejectedValueOnce(new Error('Try again.'));
  next(screen);
  await waitFor(() => expect(screen.getByText('Try again.')).toBeTruthy());
  expect(screen.getByLabelText('Who sent you? (optional)').props.value).toBe('JOYD4K2');
  fireEvent.changeText(screen.getByLabelText('Who sent you? (optional)'), '');
  next(screen);
  await waitFor(() => expect(screen.getByText('Where do you work?')).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Pasig' }).props.accessibilityState.selected).toBe(true);
});

it('starts with discovery for an old city-only draft and keeps the saved city for step two', async () => {
  mockMobile.account.workCity = 'Makati';
  const screen = render(<AgentOnboardingScreen />);
  expect(screen.getByText('How did you hear about us?')).toBeTruthy();
  fireEvent.press(screen.getByRole('radio', { name: 'A job post' }));
  next(screen);
  await waitFor(() => expect(screen.getByText('Where do you work?')).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Makati' }).props.accessibilityState.selected).toBe(true);
  expect(mockSaveDiscovery).toHaveBeenCalledWith({ discoverySource: 'job_post' });
});

it('resumes at the city question after discovery was persisted, even with no saved city', () => {
  const screen = resumeAtCity();
  expect(screen.getByText('Where do you work?')).toBeTruthy();
  expect(screen.getByLabelText('Step 2 of 2')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByText('How did you hear about us?')).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'A friend or another agent' }).props.accessibilityState.selected).toBe(true);
});

it('lets someone deny location access and finish with a manually selected city', async () => {
  mockPermission.mockResolvedValue({ status: 'denied' });
  const screen = resumeAtCity();
  fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  await waitFor(() => expect(screen.getByText('Location access is off. Choose your city below to continue.')).toBeTruthy());
  expect(mockPosition).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Cebu City' }));
  next(screen);
  await waitFor(() => expect(mockSaveWorkArea).toHaveBeenCalledWith({ city: 'Cebu City', source: 'city', finish: true }));
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(tabs)');
});

it('saves real device coordinates and completes the second question', async () => {
  const screen = resumeAtCity();
  fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled());
  next(screen);
  await waitFor(() => expect(mockSaveWorkArea).toHaveBeenCalledWith({ city: 'Marikina', latitude: 14.65, longitude: 121.1, source: 'device', finish: true }));
});

it('recovers from a location timeout without blocking manual city selection', async () => {
  jest.useFakeTimers();
  mockPosition.mockReturnValue(new Promise(() => {}));
  const screen = resumeAtCity();
  fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  await act(async () => { await Promise.resolve(); });
  await act(async () => { jest.advanceTimersByTime(15_000); });
  expect(screen.getByText('Location is taking too long. Choose your city below, or try again.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Baguio' }));
  next(screen);
  await act(async () => { await Promise.resolve(); });
  expect(mockSaveWorkArea).toHaveBeenCalledWith({ city: 'Baguio', source: 'city', finish: true });
});

it('supports an unlisted city without requesting location permission', async () => {
  const screen = resumeAtCity();
  fireEvent.press(screen.getByRole('button', { name: 'Other city' }));
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Your city'), '  San   Fernando  ');
  next(screen);
  await waitFor(() => expect(mockSaveWorkArea).toHaveBeenCalledWith({ city: 'San Fernando', source: 'city', finish: true }));
  expect(mockPermission).not.toHaveBeenCalled();
});

it('discards stale device coordinates when a new location cannot resolve a city', async () => {
  mockMobile.account = { ...mockMobile.account, workCity: 'Manila', workLatitude: 14.6, workLongitude: 120.9, workLocationSource: 'device' };
  mockGeocode.mockResolvedValue([]);
  const screen = resumeAtCity();
  fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  await waitFor(() => expect(screen.getByText('Location found. Enter your city below to continue.')).toBeTruthy());
  next(screen);
  await waitFor(() => expect(mockSaveWorkArea).toHaveBeenCalledWith({ city: 'Manila', source: 'city', finish: true }));
});

it('preserves the city after a failed final save and retries without navigating early', async () => {
  mockSaveWorkArea.mockRejectedValueOnce(new Error('Connection lost. Try again.'));
  const screen = resumeAtCity();
  fireEvent.press(screen.getByRole('button', { name: 'Pasig' }));
  next(screen);
  await waitFor(() => expect(screen.getByText('Connection lost. Try again.')).toBeTruthy());
  expect(screen.getByText('Where do you work?')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Pasig' }).props.accessibilityState.selected).toBe(true);
  expect(mockRouter.replace).not.toHaveBeenCalled();
  next(screen);
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(tabs)'));
  expect(mockSaveWorkArea).toHaveBeenCalledTimes(2);
});

it('shows an existing referral on the first question without sending a replacement', async () => {
  mockMobile.account = { ...mockMobile.account, referredByName: 'Joy Dizon', referredByCode: 'JOYD4K2' };
  const screen = render(<AgentOnboardingScreen />);
  expect(screen.getByText('Joy Dizon · JOYD4K2')).toBeTruthy();
  expect(screen.queryByLabelText('Who sent you? (optional)')).toBeNull();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  fireEvent.press(screen.getByRole('radio', { name: 'A friend or another agent' }));
  next(screen);
  await waitFor(() => expect(screen.getByText('Where do you work?')).toBeTruthy());
  expect(mockSaveDiscovery).toHaveBeenCalledWith({ discoverySource: 'friend' });
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('keeps source and referral on a validation error, then attaches a corrected code before cities', async () => {
  mockSaveDiscovery.mockRejectedValueOnce(new Error('Invalid referral code'));
  const screen = render(<AgentOnboardingScreen />);
  fireEvent.press(screen.getByRole('radio', { name: 'A shop’s Tendso site' }));
  fireEvent.changeText(screen.getByLabelText('Who sent you? (optional)'), 'wrong');
  next(screen);
  await waitFor(() => expect(screen.getByText('Invalid referral code')).toBeTruthy());
  expect(screen.getByText('How did you hear about us?')).toBeTruthy();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(mockSaveWorkArea).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Who sent you? (optional)').props.value).toBe('wrong');
  expect(screen.getByRole('radio', { name: 'A shop’s Tendso site' }).props.accessibilityState.selected).toBe(true);
  fireEvent.changeText(screen.getByLabelText('Who sent you? (optional)'), ' joyd4k2 ');
  next(screen);
  await waitFor(() => expect(screen.getByText('Where do you work?')).toBeTruthy());
  expect(mockSaveDiscovery).toHaveBeenLastCalledWith({ discoverySource: 'shop_website', referredByCode: 'JOYD4K2' });
});

it('keeps a newly attached referral read-only after Back before the account query refreshes', async () => {
  const screen = render(<AgentOnboardingScreen />);
  fireEvent.press(screen.getByRole('radio', { name: 'A friend or another agent' }));
  fireEvent.changeText(screen.getByLabelText('Who sent you? (optional)'), 'joyd4k2');
  next(screen);
  await waitFor(() => expect(screen.getByText('Where do you work?')).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByText('JOYD4K2')).toBeTruthy();
  expect(screen.queryByLabelText('Who sent you? (optional)')).toBeNull();
  next(screen);
  await waitFor(() => expect(mockSaveDiscovery).toHaveBeenCalledTimes(2));
  expect(mockSaveDiscovery).toHaveBeenLastCalledWith({ discoverySource: 'friend' });
});

it('prevents duplicate first-step saves and ignores an unmounted discovery response', async () => {
  let finish!: () => void;
  mockSaveDiscovery.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  const screen = render(<AgentOnboardingScreen />);
  fireEvent.press(screen.getByRole('radio', { name: 'TikTok' }));
  next(screen);
  next(screen);
  expect(mockSaveDiscovery).toHaveBeenCalledTimes(1);
  screen.unmount();
  await act(async () => { finish(); });
  expect(mockSaveWorkArea).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('prevents duplicate final saves and ignores navigation after an unmounted city save', async () => {
  let finish!: () => void;
  mockSaveWorkArea.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  const screen = resumeAtCity();
  fireEvent.press(screen.getByRole('button', { name: 'Davao' }));
  next(screen);
  next(screen);
  expect(mockSaveWorkArea).toHaveBeenCalledTimes(1);
  screen.unmount();
  await act(async () => { finish(); });
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('disables discovery submission while offline without losing the chosen answer', () => {
  mockMobile.isOffline = true;
  const screen = render(<AgentOnboardingScreen />);
  expect(screen.getByText('Connect to the internet to save your answers.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  fireEvent.press(screen.getByRole('radio', { name: 'Facebook' }));
  next(screen);
  expect(mockSaveDiscovery).not.toHaveBeenCalled();
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
  expect(screen.queryByText('How did you hear about us?')).toBeNull();
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(tabs)');
  expect(mockSaveDiscovery).not.toHaveBeenCalled();
  expect(mockSaveWorkArea).not.toHaveBeenCalled();
});

it('offers sign out on the first question instead of a back navigation loop', async () => {
  const screen = render(<AgentOnboardingScreen />);
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  fireEvent.press(screen.getByRole('link', { name: 'Sign out' }));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  expect(mockRouter.replace).toHaveBeenCalledWith('/');
});
