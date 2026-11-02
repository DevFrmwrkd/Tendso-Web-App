import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import OwnerAuthScreen from '../app/(auth)/owner';
import { Button } from '../components/v2';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockSetOwnerIntent = jest.fn(async () => {});
const mockSetActive = jest.fn(async () => {});
let mockParams: { mode?: string } = {};
let mockUserId: string | null = null;
let mockConnected = true;
const mockSignIn = {
  create: jest.fn(), prepareFirstFactor: jest.fn(), attemptFirstFactor: jest.fn(),
};
const mockSignUp = {
  create: jest.fn(), prepareEmailAddressVerification: jest.fn(), attemptEmailAddressVerification: jest.fn(),
};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: any) => require('react').createElement(require('react-native').Text, { testID: 'owner-auth-redirect' }, href),
}));
jest.mock('../hooks/useGuardedRouter', () => ({
  useGuardedRouter: () => ({ replace: mockReplace, push: mockPush }),
}));
jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ userId: mockUserId, sessionId: mockUserId ? `session-${mockUserId}` : null }),
  useSignIn: () => ({ signIn: mockSignIn, isLoaded: true, setActive: mockSetActive }),
  useSignUp: () => ({ signUp: mockSignUp, isLoaded: true, setActive: mockSetActive }),
}));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('../lib/v2/ownerIntake', () => ({
  ownerIntake: { get: () => ({ ownerName: 'Juan' }), set: jest.fn(), bindActor: jest.fn(async () => ({})), scope: () => 1, isCurrent: () => true },
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
  mockUserId = null; mockConnected = true;
  mockSetActive.mockReset().mockResolvedValue(undefined);
  mockSignIn.create.mockReset().mockResolvedValue({ supportedFirstFactors: [emailFactor] });
  mockSignIn.prepareFirstFactor.mockReset().mockResolvedValue(undefined);
  mockSignIn.attemptFirstFactor.mockReset().mockResolvedValue({ status: 'complete', createdSessionId: 'owner_session' });
  mockSignUp.create.mockReset().mockResolvedValue(undefined);
  mockSignUp.prepareEmailAddressVerification.mockReset().mockResolvedValue(undefined);
  mockSignUp.attemptEmailAddressVerification.mockReset().mockResolvedValue({ status: 'complete', createdSessionId: 'new_owner_session' });
});

async function sendCode(screen: ReturnType<typeof render>, mode: 'signin' | 'signup' = 'signin') {
  await act(async () => { await Promise.resolve(); });
  fireEvent.changeText(screen.getByLabelText('Email'), 'juan@example.com');
  fireEvent.press(screen.getByRole('button', { name: mode === 'signup' ? 'Create account' : 'Send sign-in code' }));
}

it('offers a direct general sign-in fallback when this account has no email-code factor', async () => {
  mockSignIn.create.mockResolvedValue({ supportedFirstFactors: [{ strategy: 'password' }] });
  const screen = render(<OwnerAuthScreen />);
  await sendCode(screen);
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
  await sendCode(screen);
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
  await sendCode(screen);
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
  await act(async () => { await Promise.resolve(); });
  fireEvent.changeText(screen.getByLabelText('Your name'), 'Juan Dela Cruz');
  await sendCode(screen, 'signup');
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
  await sendCode(screen, 'signup');
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
  await sendCode(screen, mode);
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
  await sendCode(screen);
  await waitFor(() => expect(screen.getByRole('link', { name: 'Use password, Apple or Google' })).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Send sign-in code' }));
  await waitFor(() => expect(screen.getByText('Could not connect. Try again.')).toBeTruthy());
  expect(screen.queryByRole('link', { name: 'Use password, Apple or Google' })).toBeNull();
});

it('resets verification and errors on a mode switch while keeping the entered email', async () => {
  mockParams = { mode: 'signup' };
  mockSignUp.attemptEmailAddressVerification.mockRejectedValueOnce({ errors: [{ message: 'Invalid verification code' }] });
  const screen = render(<OwnerAuthScreen />);
  await sendCode(screen, 'signup');
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
  await sendCode(screen);
  await waitFor(() => expect(screen.getByLabelText('Verification code')).toBeTruthy());
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123');
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Email').props.value).toBe('juan@example.com');
  expect(screen.queryByLabelText('Verification code')).toBeNull();
  expect(mockReplace).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/', params: { welcome: 'business' } });
});

it.each(['signin', 'signup'] as const)('retries %s session activation without consuming the verified code twice', async (mode) => {
  mockParams = { mode };
  mockSetActive.mockRejectedValueOnce(new Error('Activation temporarily unavailable'));
  const screen = render(<OwnerAuthScreen />);
  await sendCode(screen, mode);
  await screen.findByLabelText('Verification code');
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByText('Activation temporarily unavailable');
  expect(screen.getByRole('link', { name: 'Send a new code' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(mockSetActive).toHaveBeenCalledTimes(2));
  expect(mode === 'signup' ? mockSignUp.attemptEmailAddressVerification : mockSignIn.attemptFirstFactor).toHaveBeenCalledTimes(1);
});

it('never activates a delayed verification after Back or an authenticated actor change', async () => {
  let finish!: (value: unknown) => void;
  mockSignIn.attemptFirstFactor.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const screen = render(<OwnerAuthScreen />);
  await sendCode(screen);
  await screen.findByLabelText('Verification code');
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await act(async () => { finish({ status: 'complete', createdSessionId: 'stale-session' }); });
  expect(mockSetActive).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Email')).toBeTruthy();
  mockSignIn.create.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await sendCode(screen);
  mockUserId = 'another-account';
  screen.rerender(<OwnerAuthScreen />);
  await act(async () => { finish({ supportedFirstFactors: [emailFactor] }); });
  expect(mockSignIn.prepareFirstFactor).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('Verification code')).toBeNull();
});

it('ignores duplicate sends and keeps Back from leaving while activation is already being committed', async () => {
  let finishSend!: (value: unknown) => void;
  mockSignIn.create.mockReturnValueOnce(new Promise(resolve => { finishSend = resolve; }));
  const screen = render(<OwnerAuthScreen />);
  await act(async () => { await Promise.resolve(); });
  fireEvent.changeText(screen.getByLabelText('Email'), 'juan@example.com');
  const send = screen.UNSAFE_getAllByType(Button).find(node => node.props.title === 'Send sign-in code')!.props.onPress;
  act(() => { send(); send(); });
  expect(mockSignIn.create).toHaveBeenCalledTimes(1);
  await act(async () => { finishSend({ supportedFirstFactors: [emailFactor] }); });
  let finishActivation!: () => void;
  mockSetActive.mockReturnValueOnce(new Promise<void>(resolve => { finishActivation = resolve; }));
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(mockSetActive).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Verification code')).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => { finishActivation(); });
});

it('does not start passwordless network work offline and unlocks after connectivity interrupts a send', async () => {
  mockConnected = false;
  const screen = render(<OwnerAuthScreen />);
  await sendCode(screen);
  expect(mockSignIn.create).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Send sign-in code' })).toBeDisabled();
  mockConnected = true;
  screen.rerender(<OwnerAuthScreen />);
  let finish!: (value: unknown) => void;
  mockSignIn.create.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await sendCode(screen);
  mockConnected = false;
  screen.rerender(<OwnerAuthScreen />);
  await act(async () => { finish({ supportedFirstFactors: [emailFactor] }); });
  expect(mockSignIn.prepareFirstFactor).not.toHaveBeenCalled();
  mockConnected = true;
  screen.rerender(<OwnerAuthScreen />);
  await sendCode(screen);
  await screen.findByLabelText('Verification code');
  expect(mockSignIn.create).toHaveBeenCalledTimes(2);
});
