import React from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { PressFeedback, PressFeedbackProvider } from '../components/v2/PressFeedback';
import { colors } from '../theme/v2';

let motionChanged: (enabled: boolean) => void;
let removeMotionListener: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  removeMotionListener = jest.fn();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((event, listener) => {
    if (event === 'reduceMotionChanged') {
      motionChanged = listener as (enabled: boolean) => void;
      return { remove: removeMotionListener };
    }
    return { remove: jest.fn() };
  });
  // Observe the real Animated.Value and its cancellation calls. The native clock
  // is intentionally not started; Pressability's cancellation timers still run.
  jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
  jest.spyOn(Animated.Value.prototype, 'stopAnimation');
  jest.spyOn(Animated.Value.prototype, 'setValue');
});

afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const touch = () => ({
  persist: jest.fn(),
  currentTarget: 1,
  nativeEvent: { pageX: 12, pageY: 12, locationX: 12, locationY: 12 },
}) as unknown as GestureResponderEvent;

async function allowMotion() {
  await act(async () => { await Promise.resolve(); });
}

function overlay(screen: ReturnType<typeof render>) {
  return screen.UNSAFE_getByType(Animated.View);
}

function opacity(screen: ReturnType<typeof render>) {
  const value = StyleSheet.flatten(overlay(screen).props.style).opacity;
  return typeof value === 'number' ? value : (value as unknown as { __getValue(): number }).__getValue();
}

it('animates only the overlay, using the short press-in and softer release durations', async () => {
  const onPress = jest.fn();
  const onPressIn = jest.fn();
  const onPressOut = jest.fn();
  const surface = { width: 180, minHeight: 64, borderRadius: 24, backgroundColor: '#fff', shadowOpacity: 0.15 };
  const content = { flexDirection: 'row' as const, gap: 12 };
  const screen = render(<PressFeedbackProvider>
    <PressFeedback accessibilityLabel="Open sales" onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={surface}>
      <View testID="stable-content" style={content}><Text>Sales</Text></View>
    </PressFeedback>
  </PressFeedbackProvider>);
  await allowMotion();
  const initialSurface = StyleSheet.flatten(screen.getByRole('button').props.style);
  const event = touch();
  fireEvent(screen.getByRole('button'), 'pressIn', event);
  expect(Animated.timing).toHaveBeenLastCalledWith(expect.any(Animated.Value), expect.objectContaining({ toValue: 1, duration: 80, useNativeDriver: true }));
  const progress = jest.mocked(Animated.timing).mock.calls[0][0] as Animated.Value;
  expect(progress.stopAnimation).toHaveBeenCalled();
  expect(onPressIn).toHaveBeenCalledWith(event);
  expect(onPress).not.toHaveBeenCalled();
  expect(StyleSheet.flatten(screen.getByRole('button').props.style)).toEqual(initialSurface);
  expect(initialSurface).toEqual(surface);
  expect(initialSurface.transform).toBeUndefined();
  expect(initialSurface.opacity).toBeUndefined();
  expect(StyleSheet.flatten(screen.getByTestId('stable-content').props.style)).toEqual(content);

  const stopsBeforeRelease = jest.mocked(progress.stopAnimation).mock.calls.length;
  fireEvent(screen.getByRole('button'), 'pressOut', event);
  expect(progress.stopAnimation).toHaveBeenCalledTimes(stopsBeforeRelease + 1);
  expect(Animated.timing).toHaveBeenLastCalledWith(progress, expect.objectContaining({ toValue: 0, duration: 140, useNativeDriver: true }));
  expect(onPressOut).toHaveBeenCalledWith(event);
  expect(onPress).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('clears the highlight when a scroll takes the responder without activating the action', async () => {
  const onPress = jest.fn();
  const onPressOut = jest.fn();
  const screen = render(<PressFeedbackProvider><PressFeedback accessibilityLabel="Share link" onPress={onPress} onPressOut={onPressOut}>
    <Text>Share link</Text>
  </PressFeedback></PressFeedbackProvider>);
  await allowMotion();
  const event = touch();
  fireEvent(screen.getByRole('button'), 'responderGrant', event);
  expect(Animated.timing).toHaveBeenLastCalledWith(expect.any(Animated.Value), expect.objectContaining({ toValue: 1 }));
  fireEvent(screen.getByRole('button'), 'responderTerminate', event);
  act(() => { jest.advanceTimersByTime(200); });
  expect(onPressOut).toHaveBeenCalledWith(event);
  expect(Animated.timing).toHaveBeenLastCalledWith(expect.any(Animated.Value), expect.objectContaining({ toValue: 0, duration: 140 }));
  expect(onPress).not.toHaveBeenCalled();
});

it('uses an inert, rounded overlay with the requested tone and bounded strength', () => {
  const screen = render(<PressFeedback accessibilityLabel="Dark surface" overlayTone="light" strength={0.08} style={[{ borderRadius: 28 }, { minHeight: 60 }]}>
    <Text>Income</Text>
  </PressFeedback>);
  expect(overlay(screen).props).toMatchObject({ pointerEvents: 'none', accessible: false, importantForAccessibility: 'no-hide-descendants' });
  expect(StyleSheet.flatten(overlay(screen).props.style)).toMatchObject({ backgroundColor: colors.onDark, borderRadius: 28 });
  fireEvent(screen.getByRole('button'), 'pressIn', touch());
  expect(opacity(screen)).toBeCloseTo(0.08);
  expect(Animated.timing).not.toHaveBeenCalled();

  screen.rerender(<PressFeedback accessibilityLabel="Default tone" strength={2}><Text>Sales</Text></PressFeedback>);
  expect(StyleSheet.flatten(overlay(screen).props.style).backgroundColor).toBe(colors.ink);
  expect(opacity(screen)).toBe(1);
  screen.rerender(<PressFeedback accessibilityLabel="No highlight" strength={-1}><Text>Sales</Text></PressFeedback>);
  expect(opacity(screen)).toBe(0);
});

it('resets an active highlight when disabled and blocks further activation', async () => {
  const onPress = jest.fn();
  const onPressIn = jest.fn();
  const button = (disabled: boolean) => <PressFeedbackProvider>
    <PressFeedback accessibilityLabel="Copy link" disabled={disabled} accessibilityState={{ busy: true }} onPress={onPress} onPressIn={onPressIn}>
      <Text>Copy</Text>
    </PressFeedback>
  </PressFeedbackProvider>;
  const screen = render(button(false));
  await allowMotion();
  fireEvent(screen.getByRole('button'), 'pressIn', touch());
  const progress = jest.mocked(Animated.timing).mock.calls[0][0] as Animated.Value;
  jest.mocked(progress.setValue).mockClear();
  screen.rerender(button(true));
  expect(screen.getByRole('button').props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  expect(progress.stopAnimation).toHaveBeenCalled();
  expect(progress.setValue).toHaveBeenLastCalledWith(0);
  expect(opacity(screen)).toBe(0);
  const animationCount = jest.mocked(Animated.timing).mock.calls.length;
  fireEvent(screen.getByRole('button'), 'pressIn', touch());
  fireEvent.press(screen.getByRole('button'));
  expect(Animated.timing).toHaveBeenCalledTimes(animationCount);
  expect(onPressIn).toHaveBeenCalledTimes(1);
  expect(onPress).not.toHaveBeenCalled();
});

it('stays still until the preference is known, then respects an enabled reduced-motion preference', async () => {
  let resolvePreference!: (enabled: boolean) => void;
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(new Promise(resolve => { resolvePreference = resolve; }));
  const screen = render(<PressFeedbackProvider><PressFeedback accessibilityLabel="Sales"><Text>Sales</Text></PressFeedback></PressFeedbackProvider>);
  fireEvent(screen.getByRole('button'), 'pressIn', touch());
  expect(opacity(screen)).toBeCloseTo(0.06);
  expect(Animated.timing).not.toHaveBeenCalled();
  await act(async () => { resolvePreference(true); });
  fireEvent(screen.getByRole('button'), 'pressOut', touch());
  expect(opacity(screen)).toBe(0);
  expect(Animated.timing).not.toHaveBeenCalled();
});

it('keeps the shared preference subscription stable and stops motion when the system setting changes', async () => {
  const buttons = () => <PressFeedbackProvider>
    <PressFeedback accessibilityLabel="Sales"><Text>Sales</Text></PressFeedback>
    <PressFeedback accessibilityLabel="My page"><Text>My page</Text></PressFeedback>
  </PressFeedbackProvider>;
  const screen = render(buttons());
  await allowMotion();
  // NativeWind also reads and subscribes to this preference when its adapters
  // initialize. Updating the shared provider must not create more subscriptions.
  const preferenceReads = jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mock.calls.length;
  const motionSubscriptions = jest.mocked(AccessibilityInfo.addEventListener).mock.calls.filter(([event]) => event === 'reduceMotionChanged').length;
  expect(preferenceReads).toBeGreaterThan(0);
  expect(motionSubscriptions).toBeGreaterThan(0);
  screen.rerender(buttons());
  await allowMotion();
  expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalledTimes(preferenceReads);
  expect(jest.mocked(AccessibilityInfo.addEventListener).mock.calls.filter(([event]) => event === 'reduceMotionChanged')).toHaveLength(motionSubscriptions);
  expect(AccessibilityInfo.addEventListener).toHaveBeenCalledWith('reduceMotionChanged', expect.any(Function));
  fireEvent(screen.getByRole('button', { name: 'Sales' }), 'pressIn', touch());
  const progress = jest.mocked(Animated.timing).mock.calls[0][0] as Animated.Value;
  jest.mocked(progress.stopAnimation).mockClear();
  act(() => { motionChanged(true); });
  expect(progress.stopAnimation).toHaveBeenCalled();
  expect(progress.setValue).toHaveBeenCalledWith(1);
  jest.mocked(Animated.timing).mockClear();
  fireEvent(screen.getByRole('button', { name: 'Sales' }), 'pressOut', touch());
  expect(progress.setValue).toHaveBeenLastCalledWith(0);
  fireEvent(screen.getByRole('button', { name: 'My page' }), 'pressIn', touch());
  expect(Animated.timing).not.toHaveBeenCalled();

  act(() => { motionChanged(false); });
  fireEvent(screen.getByRole('button', { name: 'Sales' }), 'pressIn', touch());
  expect(Animated.timing).toHaveBeenCalledTimes(1);
  jest.mocked(progress.stopAnimation).mockClear();
  screen.unmount();
  expect(progress.stopAnimation).toHaveBeenCalled();
  expect(removeMotionListener).toHaveBeenCalledTimes(1);
});

it('does not let a late initial query override a newer reduced-motion event', async () => {
  let resolvePreference!: (enabled: boolean) => void;
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(new Promise(resolve => { resolvePreference = resolve; }));
  const screen = render(<PressFeedbackProvider><PressFeedback accessibilityLabel="Sales"><Text>Sales</Text></PressFeedback></PressFeedbackProvider>);
  act(() => { motionChanged(true); });
  await act(async () => { resolvePreference(false); });
  fireEvent(screen.getByRole('button'), 'pressIn', touch());
  expect(opacity(screen)).toBeCloseTo(0.06);
  expect(Animated.timing).not.toHaveBeenCalled();
  screen.unmount();
  await act(async () => { motionChanged(false); });
  expect(removeMotionListener).toHaveBeenCalledTimes(1);
});

it('uses the still fallback if the system preference cannot be read', async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockRejectedValue(new Error('Preference unavailable'));
  const screen = render(<PressFeedbackProvider><PressFeedback accessibilityLabel="Sales"><Text>Sales</Text></PressFeedback></PressFeedbackProvider>);
  await allowMotion();
  fireEvent(screen.getByRole('button'), 'pressIn', touch());
  expect(opacity(screen)).toBeCloseTo(0.06);
  expect(Animated.timing).not.toHaveBeenCalled();
});
