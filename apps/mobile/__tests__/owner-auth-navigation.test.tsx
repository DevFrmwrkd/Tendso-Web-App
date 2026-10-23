import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import OwnerAuthScreen from '../app/(auth)/owner';

const mockReplace = jest.fn();
const mockSetOwnerIntent = jest.fn(async () => {});
const mockSetActive = jest.fn(async () => {});
const mockSignIn = {
  create: jest.fn(), prepareFirstFactor: jest.fn(), attemptFirstFactor: jest.fn(),
};
const mockSignUp = {
  create: jest.fn(), prepareEmailAddressVerification: jest.fn(), attemptEmailAddressVerification: jest.fn(),
};
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@clerk/clerk-expo', () => ({
  useSignIn: () => ({ signIn: mockSignIn, isLoaded: true, setActive: mockSetActive }),
  useSignUp: () => ({ signUp: mockSignUp, isLoaded: true, setActive: mockSetActive }),
}));
jest.mock('../lib/v2/ownerIntake', () => ({
  ownerIntake: { get: () => ({ ownerName: 'Juan' }), set: jest.fn() },
  setOwnerIntent: () => mockSetOwnerIntent(),
}));
jest.mock('../components/v2/owner/OwnerUI', () => ({ Field: require('../components/v2/Field').Field }));
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
  mockSignIn.create.mockReset().mockResolvedValue({ supportedFirstFactors: [emailFactor] });
  mockSignIn.prepareFirstFactor.mockResolvedValue(undefined);
  mockSignIn.attemptFirstFactor.mockResolvedValue({ status: 'complete', createdSessionId: 'owner_session' });
});

function sendCode(screen: ReturnType<typeof render>) {
  fireEvent.changeText(screen.getByLabelText('Email'), 'juan@example.com');
  fireEvent.press(screen.getByRole('button', { name: 'Send my code' }));
}

it('offers a direct general sign-in fallback when this account has no email-code factor', async () => {
  mockSignIn.create.mockResolvedValue({ supportedFirstFactors: [{ strategy: 'password' }] });
  const screen = render(<OwnerAuthScreen />);
  sendCode(screen);
  await waitFor(() => expect(screen.getByRole('link', { name: 'Use password, Apple or Google' })).toBeTruthy());
  expect(screen.getByText('This account uses a different sign-in method. Use your password, Apple or Google to continue.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Send my code' }).props.accessibilityState.busy).toBe(false);
  expect(mockSignIn.prepareFirstFactor).not.toHaveBeenCalled();
  expect(mockSignUp.create).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole('link', { name: 'Use password, Apple or Google' }));
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
});

it('keeps an email-code owner on the code flow and activates its completed session', async () => {
  const screen = render(<OwnerAuthScreen />);
  sendCode(screen);
  await waitFor(() => expect(screen.getByLabelText('Code')).toBeTruthy());
  expect(mockSignIn.create).toHaveBeenCalledWith({ identifier: 'juan@example.com' });
  expect(mockSignIn.prepareFirstFactor).toHaveBeenCalledWith({ strategy: 'email_code', emailAddressId: 'email_juan' });
  expect(screen.queryByRole('link', { name: 'Use password, Apple or Google' })).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Code'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith({ session: 'owner_session' }));
  expect(mockSignIn.attemptFirstFactor).toHaveBeenCalledWith({ strategy: 'email_code', code: '123456' });
  expect(mockReplace).not.toHaveBeenCalled();
});

it('removes a previous alternative-sign-in suggestion when a fresh attempt fails for another reason', async () => {
  mockSignIn.create
    .mockResolvedValueOnce({ supportedFirstFactors: [{ strategy: 'password' }] })
    .mockRejectedValueOnce({ errors: [{ longMessage: 'Could not connect. Try again.' }] });
  const screen = render(<OwnerAuthScreen />);
  sendCode(screen);
  await waitFor(() => expect(screen.getByRole('link', { name: 'Use password, Apple or Google' })).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Send my code' }));
  await waitFor(() => expect(screen.getByText('Could not connect. Try again.')).toBeTruthy());
  expect(screen.queryByRole('link', { name: 'Use password, Apple or Google' })).toBeNull();
});

it('returns from the email form to the business Welcome', () => {
  const screen = render(<OwnerAuthScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/', params: { welcome: 'business' } });
});

it('returns from code verification to the email form before leaving the owner flow', async () => {
  const screen = render(<OwnerAuthScreen />);
  sendCode(screen);
  await waitFor(() => expect(screen.getByLabelText('Code')).toBeTruthy());
  fireEvent.changeText(screen.getByLabelText('Code'), '123');
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Email').props.value).toBe('juan@example.com');
  expect(screen.queryByLabelText('Code')).toBeNull();
  expect(mockReplace).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/', params: { welcome: 'business' } });
});
