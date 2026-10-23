import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { fireEvent, renderAsync, within } from '@testing-library/react-native';
import LoginScreen from '../app/(auth)/login';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockSignIn = { create: jest.fn(), attemptFirstFactor: jest.fn() };
jest.mock('@clerk/clerk-expo', () => ({
  useSignIn: () => ({ signIn: mockSignIn, isLoaded: true, setActive: jest.fn() }),
  useSignUp: () => ({ signUp: {}, setActive: jest.fn() }),
  useSSO: () => ({ startSSOFlow: jest.fn() }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => ({ replace: mockReplace, push: mockPush }) }));
jest.mock('../hooks/useAppleAuth', () => ({ useAppleAuth: () => ({ startAppleAuth: jest.fn() }) }));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: () => Promise.resolve(false), AppleAuthenticationButton: 'MockAppleButton',
  AppleAuthenticationButtonType: { SIGN_IN: 0 }, AppleAuthenticationButtonStyle: { BLACK: 0 },
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: () => 'negosyodigital:///' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));
jest.mock('../components/TikTokLogo', () => ({ TikTokLogo: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('../components/GuardedLink', () => {
  const React = require('react');
  return {
    GuardedLink: ({ children, href }: { children: React.ReactElement<{ onPress?: () => void }>; href: string }) =>
      React.cloneElement(children, { onPress: () => mockPush(href) }),
  };
});

function ancestorWithStyle(node: ReactTestInstance, matches: (style: ViewStyle) => boolean): ReactTestInstance {
  for (let parent = node.parent; parent; parent = parent.parent) {
    const style = StyleSheet.flatten(parent.props.style);
    if (style && matches(style)) return parent;
  }
  throw new Error('Expected styled container was not found');
}

function inputCard(input: ReactTestInstance) {
  return ancestorWithStyle(input, (style) => typeof style.borderWidth === 'number');
}

beforeEach(() => jest.clearAllMocks());

describe('auth input presentation', () => {
  it('uses outlined sign-in fields with inline Forgot and a working password visibility toggle', async () => {
    const screen = await renderAsync(<LoginScreen />);
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');
    for (const input of [email, password]) {
      expect(within(inputCard(input)).queryByText(input.props.accessibilityLabel)).toBeNull();
    }
    expect(email.props.keyboardType).toBe('email-address');
    expect(password.props.secureTextEntry).toBe(true);
    fireEvent.changeText(email, 'juan@example.com');
    fireEvent.changeText(password, 'example-password');
    fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('Email').props.value).toBe('juan@example.com');
    expect(screen.getByLabelText('Password').props.value).toBe('example-password');

    const labelRow = ancestorWithStyle(screen.getByText('Password'), (style) => style.justifyContent === 'space-between');
    fireEvent.press(within(labelRow).getByRole('link', { name: 'Forgot password' }));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/forgot-password');
    expect(mockSignIn.create).not.toHaveBeenCalled();
  });

  it('returns from sign-in to the explicit Welcome choice even without navigation history', async () => {
    const screen = await renderAsync(<LoginScreen />);
    fireEvent.press(screen.getByRole('link', { name: 'Back to welcome' }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/', params: { welcome: '1' } });
    expect(mockSignIn.create).not.toHaveBeenCalled();
  });
});
