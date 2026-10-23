import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import OwnerAuthScreen from '../app/(auth)/owner';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockSetOwnerIntent = jest.fn(async () => {});
const mockSetActive = jest.fn(async () => {});
let mockParams: { mode?: string } = {};
const mockSignIn = {
  create: jest.fn(), prepareFirstFactor: jest.fn(), attemptFirstFactor: jest.fn(),
};
const mockSignUp = {
  create: jest.fn(), prepareEmailAddressVerification: jest.fn(), attemptEmailAddressVerification: jest.fn(),
};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../hooks/useGuardedRouter', () => ({
  useGuardedRouter: () => ({ replace: mockReplace, push: mockPush }),
}));
jest.mock('@clerk/clerk-expo', () => ({
  useSignIn: () => ({ signIn: mockSignIn, isLoaded: true, setActive: mockSetActive }),
  useSignUp: () => ({ signUp: mockSignUp, isLoaded: true, setActive: mockSetActive }),
}));
jest.mock('../lib/v2/ownerIntake', () => ({
  ownerIntake: { get: () => ({ ownerName: 'Juan' }), set: jest.fn() },
  setOwnerIntent: () => mockSetOwnerIntent(),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));
jest.mock('../components/TikTokLogo', () => ({ TikTokLogo: () => null }));

const emailFactor = { strategy: 'email_code', emailAddressId: 'email_juan' };
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockSignIn.create.mockReset().mockResolvedValue({ supportedFirstFactors: [emailFactor] });
  mockSignIn.prepareFirstFactor.mockReset().mockResolvedValue(undefined);
  mockSignIn.attemptFirstFactor.mockReset().mockResolvedValue({ status: 'complete', createdSessionId: 'owner_session' });
  mockSignUp.create.mockReset().mockResolvedValue(undefined);
  mockSignUp.prepareEmailAddressVerification.mockReset().mockResolvedValue(undefined);
  mockSignUp.attemptEmailAddressVerification.mockReset().mockResolvedValue({ status: 'complete', createdSessionId: 'new_owner_session' });
});

function sendCode(screen: ReturnType<typeof render>, mode: 'signin' | 'signup' = 'signin') {
  fireEvent.changeText(screen.getByLabelText('Email'), 'juan@example.com');
  fireEvent.press(screen.getByRole('button', { name: mode === 'signup' ? 'Create account' : 'Send sign-in code' }));
}

it('offers a direct general sign-in fallback when this account has no email-code factor', async () => {
  mockSignIn.create.mockResolvedValue({ supportedFirstFactors: [{ strategy: 'password' }] });
  const screen = render(<OwnerAuthScreen />);
  sendCode(screen);
  await waitFor(() => expect(screen.getByRole('link', { name: 'Use password, Apple or Google' })).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Send sign-in code' }).props.accessibilityState.busy).toBe(false);
  expect(mockSignIn.prepareFirstFactor).not.toHaveBeenCalled();
  expect(mockSignUp.create).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole('link', { name: 'Use password, Apple or Google' }));
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
});

it('defaults to email-only sign-in and activates the completed owner session', async () => {
  const screen = render(<OwnerAuthScreen />);
  expect(screen.getByText('Welcome back')).toBeTruthy();
  expect(screen.queryByLabelText('Your name')).toBeNull();
  sendCode(screen);
  await waitFor(() => expect(screen.getByLabelText('Verification code')).toBeTruthy());
  expect(mockSignIn.create).toHaveBeenCalledWith({ identifier: 'juan@example.com' });
  expect(mockSignIn.prepareFirstFactor).toHaveBeenCalledWith({ strategy: 'email_code', emailAddressId: 'email_juan' });
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith({ session: 'owner_session' }));
  expect(mockSignIn.attemptFirstFactor).toHaveBeenCalledWith({ strategy: 'email_code', code: '123456' });
  expect(mockSignUp.create).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

it('never silently creates an account when a sign-in address is unknown', async () => {
  mockSignIn.create.mockRejectedValue({ errors: [{ code: 'form_identifier_not_found', message: 'Account not found' }] });
  const screen = render(<OwnerAuthScreen />);
  sendCode(screen);
  await waitFor(() => expect(mockSignIn.create).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send sign-in code' }).props.accessibilityState.busy).toBe(false));
  expect(screen.queryByLabelText('Verification code')).toBeNull();
  expect(mockSignUp.create).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('link', { name: 'Make an account' }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(auth)/owner', params: { mode: 'signup' } });
});

it('creates and verifies a new owner using name and email without a sign-in attempt', async () => {
  mockParams = { mode: 'signup' };
  const screen = render(<OwnerAuthScreen />);
  expect(screen.getByText('Make your account')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Your name'), 'Juan Dela Cruz');
  sendCode(screen, 'signup');
  await waitFor(() => expect(screen.getByLabelText('Verification code')).toBeTruthy());
  expect(mockSignUp.create).toHaveBeenCalledWith({ emailAddress: 'juan@example.com', firstName: 'Juan', lastName: 'Dela Cruz' });
  expect(mockSignUp.prepareEmailAddressVerification).toHaveBeenCalledWith({ strategy: 'email_code' });
  expect(mockSignIn.create).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith({ session: 'new_owner_session' }));
  expect(mockSignUp.attemptEmailAddressVerification).toHaveBeenCalledWith({ code: '123456' });
});

it('offers explicit sign-in when signup finds an existing email, without signing in automatically', async () => {
  mockParams = { mode: 'signup' };
  mockSignUp.create.mockRejectedValue({ errors: [{ code: 'form_identifier_exists', message: 'Email already exists' }] });
  const screen = render(<OwnerAuthScreen />);
  sendCode(screen, 'signup');
  await waitFor(() => expect(mockSignUp.create).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create account' }).props.accessibilityState.busy).toBe(false));
  expect(mockSignIn.create).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Verification code')).toBeNull();
  fireEvent.press(screen.getByRole('link', { name: 'Log in' }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(auth)/owner', params: { mode: 'signin' } });
});

it.each(['signin', 'signup'] as const)('resends %s verification without recreating the auth attempt', async (mode) => {
  mockParams = { mode };
  const screen = render(<OwnerAuthScreen />);
  sendCode(screen, mode);
  await waitFor(() => expect(screen.getByLabelText('Verification code')).toBeTruthy());
  fireEvent.press(screen.getByText('Send a new code'));
  if (mode === 'signup') {
    await waitFor(() => expect(mockSignUp.prepareEmailAddressVerification).toHaveBeenCalledTimes(2));
    expect(mockSignUp.create).toHaveBeenCalledTimes(1);
    expect(mockSignIn.create).not.toHaveBeenCalled();
  } else {
    await waitFor(() => expect(mockSignIn.prepareFirstFactor).toHaveBeenCalledTimes(2));
    expect(mockSignIn.create).toHaveBeenCalledTimes(1);
    expect(mockSignUp.create).not.toHaveBeenCalled();
  }
});

it('removes a previous alternative-sign-in suggestion when a fresh attempt fails for another reason', async () => {
  mockSignIn.create
    .mockResolvedValueOnce({ supportedFirstFactors: [{ strategy: 'password' }] })
    .mockRejectedValueOnce({ errors: [{ longMessage: 'Could not connect. Try again.' }] });
  const screen = render(<OwnerAuthScreen />);
  sendCode(screen);
  await waitFor(() => expect(screen.getByRole('link', { name: 'Use password, Apple or Google' })).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Send sign-in code' }));
  await waitFor(() => expect(screen.getByText('Could not connect. Try again.')).toBeTruthy());
  expect(screen.queryByRole('link', { name: 'Use password, Apple or Google' })).toBeNull();
});

it('resets verification and errors on a mode switch while keeping the entered email', async () => {
  mockParams = { mode: 'signup' };
  mockSignUp.attemptEmailAddressVerification.mockRejectedValueOnce({ errors: [{ message: 'Invalid verification code' }] });
  const screen = render(<OwnerAuthScreen />);
  sendCode(screen, 'signup');
  await waitFor(() => expect(screen.getByLabelText('Verification code')).toBeTruthy());
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(screen.getByText('Invalid verification code')).toBeTruthy());

  mockParams = { mode: 'signin' };
  screen.rerender(<OwnerAuthScreen />);
  expect(screen.getByText('Welcome back')).toBeTruthy();
  expect(screen.getByLabelText('Email').props.value).toBe('juan@example.com');
  expect(screen.queryByLabelText('Your name')).toBeNull();
  expect(screen.queryByLabelText('Verification code')).toBeNull();
  expect(screen.queryByText('Invalid verification code')).toBeNull();
});

it.each(['signin', 'signup'] as const)('returns from the %s email form to the business Welcome', (mode) => {
  mockParams = { mode };
  const screen = render(<OwnerAuthScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/', params: { welcome: 'business' } });
});

it('returns from code verification to the email form before leaving the owner flow', async () => {
  const screen = render(<OwnerAuthScreen />);
  sendCode(screen);
  await waitFor(() => expect(screen.getByLabelText('Verification code')).toBeTruthy());
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123');
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Email').props.value).toBe('juan@example.com');
  expect(screen.queryByLabelText('Verification code')).toBeNull();
  expect(mockReplace).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/', params: { welcome: 'business' } });
});
