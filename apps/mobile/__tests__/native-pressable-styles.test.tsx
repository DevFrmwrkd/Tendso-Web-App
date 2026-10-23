import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { cssInterop } from 'react-native-css-interop';
import { Button } from '../components/v2/Button';
import { AccountTypeOption, SocialPill } from '../components/v2/AuthParts';
import { colors, radius } from '../theme/v2';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

// NativeWind skips this registration in NODE_ENV=test. Enable its real native
// adapter so callback styles take the same path as an installed EAS build.
cssInterop(Pressable, { className: 'style' });

describe('native pressable styles with NativeWind enabled', () => {
  it('keeps the primary button fill, pill shape and pressed feedback', async () => {
    const onPress = jest.fn();
    const screen = render(<Button title="Sign in" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Sign in' });

    expect(StyleSheet.flatten(button.props.style)).toMatchObject({
      backgroundColor: colors.accent,
      borderRadius: radius.pill,
      minHeight: 60,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ scale: 1 }],
    });

    const touch = {
      persist: jest.fn(),
      currentTarget: 1,
      nativeEvent: { pageX: 12, pageY: 12 },
    };
    fireEvent(button, 'responderGrant', touch);
    expect(StyleSheet.flatten(screen.getByRole('button').props.style).transform).toEqual([{ scale: 0.98 }]);
    fireEvent(screen.getByRole('button'), 'responderRelease', touch);
    expect(onPress).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(StyleSheet.flatten(screen.getByRole('button').props.style).transform).toEqual([{ scale: 1 }]);
    });

    screen.rerender(<Button title="Sign in" onPress={onPress} disabled />);
    const disabled = screen.getByRole('button');
    expect(disabled.props.accessibilityState.disabled).toBe(true);
    expect(StyleSheet.flatten(disabled.props.style)).toMatchObject({
      backgroundColor: colors.accent,
      opacity: 0.5,
    });
    fireEvent.press(disabled);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps the social logo and label in one white pill and respects disabled state', () => {
    const onPress = jest.fn();
    const props = { logo: <View testID="social-logo" />, label: 'Continue with Google', onPress };
    const screen = render(<SocialPill {...props} />);
    const button = screen.getByRole('button', { name: props.label });

    expect(StyleSheet.flatten(button.props.style)).toMatchObject({
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 56,
      borderRadius: 28,
      opacity: 1,
    });
    expect(button.findByProps({ testID: 'social-logo' })).toBeTruthy();
    expect(screen.getByText(props.label)).toBeTruthy();
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);

    screen.rerender(<SocialPill {...props} dimmed />);
    const dimmed = screen.getByRole('button');
    expect(StyleSheet.flatten(dimmed.props.style).opacity).toBe(0.6);
    fireEvent.press(dimmed);
    expect(onPress).toHaveBeenCalledTimes(2);

    screen.rerender(<SocialPill {...props} dimmed disabled />);
    const disabled = screen.getByRole('button');
    expect(disabled.props.accessibilityState.disabled).toBe(true);
    expect(StyleSheet.flatten(disabled.props.style)).toMatchObject({
      backgroundColor: colors.card,
      flexDirection: 'row',
      opacity: 0.6,
    });
    fireEvent.press(disabled);
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('keeps account choices in cards with a selected outline and working radio action', () => {
    const onPress = jest.fn();
    const props = {
      title: 'Field agent',
      subtitle: 'Visit shops, take photos, interview',
      icon: 'camera-outline' as const,
      accessibilityLabel: 'Field agent account',
      onPress,
    };
    const screen = render(<AccountTypeOption {...props} selected={false} />);
    const option = screen.getByRole('radio', { name: props.accessibilityLabel });

    expect(StyleSheet.flatten(option.props.style)).toMatchObject({
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      borderRadius: 22,
    });
    expect(option.props.accessibilityState.checked).toBe(false);
    fireEvent.press(option);
    expect(onPress).toHaveBeenCalledTimes(1);

    screen.rerender(<AccountTypeOption {...props} selected />);
    const selected = screen.getByRole('radio');
    expect(selected.props.accessibilityState.checked).toBe(true);
    expect(StyleSheet.flatten(selected.props.style)).toMatchObject({
      backgroundColor: colors.card,
      flexDirection: 'row',
      borderColor: colors.ink,
    });
  });
});
