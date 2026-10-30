import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SignupScreen from '../app/(auth)/signup';
import { loadPendingSignupProfile } from '../services/signupProfile';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockSetActive = jest.fn();
const mockSSO = jest.fn();
const mockApple = jest.fn();
const mockBackendMutation = jest.fn();
const mockSignUp = {
  create: jest.fn(), prepareEmailAddressVerification: jest.fn(), attemptEmailAddressVerification: jest.fn(),
};
jest.mock('@clerk/clerk-expo', () => ({
  useSignUp: () => ({ signUp: mockSignUp, setActive: mockSetActive, isLoaded: true }),
  useSSO: () => ({ startSSOFlow: mockSSO }),
}));
jest.mock('convex/react', () => ({ useMutation: mockBackendMutation }));
jest.mock('../hooks/useAppleAuth', () => ({ useAppleAuth: () => ({ startAppleAuth: mockApple }) }));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: () => Promise.resolve(true), AppleAuthenticationButton: 'MockAppleButton',
  AppleAuthenticationButtonType: { SIGN_UP: 0 }, AppleAuthenticationButtonStyle: { BLACK: 0 },
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: () => 'negosyodigital:///' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'MockSvg', Path: 'MockSvgPath', Defs: 'MockSvgDefs', LinearGradient: 'MockSvgGradient', Rect: 'MockSvgRect', Stop: 'MockSvgStop' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }) }));
jest.mock('../components/TikTokLogo', () => ({ TikTokLogo: () => null }));
jest.mock('../components/GuardedLink', () => ({ GuardedLink: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));

const identity = { clerkId: 'new_user', email: 'juan@example.com', sessionId: 'new_session' };
const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
beforeAll(() => Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true }));
afterAll(() => Object.defineProperty(Platform, 'OS', platformDescriptor));
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockSignUp.create.mockResolvedValue(undefined);
  mockSignUp.prepareEmailAddressVerification.mockResolvedValue(undefined);
  mockSignUp.attemptEmailAddressVerification.mockResolvedValue({ status: 'complete', createdSessionId: identity.sessionId, createdUserId: identity.clerkId });
  mockSetActive.mockResolvedValue(undefined);
});
afterEach(() => expect(mockBackendMutation).not.toHaveBeenCalled());

function fillEmailForm(screen: ReturnType<typeof render>, lastName = 'Cruz') {
  fireEvent.changeText(screen.getByLabelText('First Name'), 'Juan');
  fireEvent.changeText(screen.getByLabelText('Last Name'), lastName);
  fireEvent.changeText(screen.getByLabelText('Email'), identity.email);
  fireEvent.changeText(screen.getByLabelText('Mobile Number'), '09171234567');
  fireEvent.changeText(screen.getByLabelText('Password'), 'example-password');
  fireEvent.changeText(screen.getByLabelText('Confirm Password'), 'example-password');
  fireEvent.press(screen.getByLabelText('Accept Terms of Service'));
}

async function verifyEmail(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByText('Get started'));
  await waitFor(() => expect(screen.getByLabelText('Verification Code')).toBeTruthy());
  fireEvent.changeText(screen.getByLabelText('Verification Code'), '123456');
  fireEvent.press(screen.getByText('Verify email'));
  await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith({ session: identity.sessionId }));
}

it('email signup saves identity details without asking for an account type, handle, or referral', async () => {
  let profileAtActivation: Awaited<ReturnType<typeof loadPendingSignupProfile>> = null;
  mockSetActive.mockImplementation(async () => {
    profileAtActivation = await loadPendingSignupProfile(identity);
  });
  const screen = render(<SignupScreen />);
  fillEmailForm(screen);
  expect(screen.queryByLabelText('Field agent account')).toBeNull();
  expect(screen.queryByLabelText('Creator account')).toBeNull();
  expect(screen.queryByLabelText('Page handle')).toBeNull();
  expect(screen.queryByLabelText(/referral code/i)).toBeNull();
  await verifyEmail(screen);
  expect(profileAtActivation).toMatchObject({ firstName: 'Juan', lastName: 'Cruz', phone: '09171234567', handle: '', referredByCode: '' });
});

it('email signup accepts an optional last name before the account type is chosen', async () => {
  const screen = render(<SignupScreen />);
  fillEmailForm(screen, '');
  await verifyEmail(screen);
  expect(mockSignUp.create).toHaveBeenCalledWith({
    firstName: 'Juan', lastName: '', emailAddress: identity.email, password: 'example-password',
  });
  expect(await loadPendingSignupProfile(identity)).toMatchObject({
    firstName: 'Juan', lastName: '', phone: '09171234567', handle: '', referredByCode: '',
  });
});

it('Google signup preserves identity details for the later account choice without a pre-auth backend call', async () => {
  mockSSO.mockResolvedValue({ createdSessionId: identity.sessionId, setActive: mockSetActive,
    signUp: { createdUserId: identity.clerkId, emailAddress: identity.email, firstName: 'Google Alex', lastName: 'Cruz' } });
  const screen = render(<SignupScreen />);
  fireEvent.changeText(screen.getByLabelText('Mobile Number'), '09171234567');
  fireEvent.press(screen.getByLabelText('Accept Terms of Service'));
  fireEvent.press(screen.getByLabelText('Continue with Google'));
  await waitFor(() => expect(mockSetActive).toHaveBeenCalled());
  expect(await loadPendingSignupProfile(identity)).toMatchObject({
    firstName: 'Google Alex', lastName: 'Cruz', phone: '09171234567', handle: '', referredByCode: '',
  });
});

it('Apple signup keeps its one-time name for the later account choice without asking for a referral', async () => {
  mockApple.mockResolvedValue({ createdSessionId: identity.sessionId, setActive: mockSetActive, isNewUser: true,
    firstName: 'Apple Alex', lastName: 'Cruz', email: identity.email, signUp: { createdUserId: identity.clerkId } });
  const screen = render(<SignupScreen />);
  fireEvent.changeText(screen.getByLabelText('Mobile Number'), '09171234567');
  expect(screen.queryByLabelText(/referral code/i)).toBeNull();
  fireEvent.press(screen.getByLabelText('Accept Terms of Service'));
  await waitFor(() => expect(screen.UNSAFE_getByType('MockAppleButton')).toBeTruthy());
  fireEvent.press(screen.UNSAFE_getByType('MockAppleButton'));
  await waitFor(() => expect(mockSetActive).toHaveBeenCalled());
  expect(await loadPendingSignupProfile(identity)).toMatchObject({
    firstName: 'Apple Alex', lastName: 'Cruz', phone: '09171234567', handle: '', referredByCode: '',
  });
});
