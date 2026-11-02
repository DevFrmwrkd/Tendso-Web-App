import React from 'react';
import { AccessibilityInfo, Animated, PanResponder, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { CapturePhotoSwipeSurface, type CapturePhotoSwipeSurfaceProps } from '../components/field-agent/CapturePhotoSwipeSurface';

let onPrevious: jest.Mock;
let onNext: jest.Mock;
let motionChanged: (value: boolean) => void;
const event = (touches = 1) => ({ nativeEvent: { touches: Array.from({ length: touches }, () => ({})) } });
const gesture = (dx: number, dy = 0, touches = 1, stateID = 1) => ({ dx, dy, numberActiveTouches: touches, stateID });
const draw = (props: Partial<CapturePhotoSwipeSurfaceProps> = {}) => <CapturePhotoSwipeSurface photoId="one"
  canPrevious canNext onPrevious={onPrevious} onNext={onNext} {...props}><Text>Current photo</Text></CapturePhotoSwipeSurface>;

beforeEach(() => {
  onPrevious = jest.fn(); onNext = jest.fn();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_name, listener) => {
    motionChanged = listener as (value: boolean) => void;
    return { remove: jest.fn() };
  });
  jest.spyOn(PanResponder, 'create').mockImplementation(config => ({ panHandlers: {
    onStartShouldSetResponder: config.onStartShouldSetPanResponder,
    onMoveShouldSetResponder: config.onMoveShouldSetPanResponder,
    onMoveShouldSetResponderCapture: config.onMoveShouldSetPanResponderCapture,
    onResponderGrant: config.onPanResponderGrant, onResponderStart: config.onPanResponderStart,
    onResponderMove: config.onPanResponderMove, onResponderRelease: config.onPanResponderRelease,
    onResponderTerminate: config.onPanResponderTerminate,
  } } as unknown as ReturnType<typeof PanResponder.create>));
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
    start: () => { if (value instanceof Animated.Value) value.setValue(config.toValue as number); }, stop: jest.fn(), reset: jest.fn(),
  }));
});
afterEach(() => jest.restoreAllMocks());

it('claims only deliberate single-finger horizontal movement inside the image surface', () => {
  const screen = render(draw()); const surface = screen.getByTestId('capture-photo-swipe-surface');
  expect(screen.getByText('Current photo')).toBeTruthy();
  expect(surface.props.onStartShouldSetResponder(event(), gesture(0))).toBe(false);
  for (const value of [gesture(5), gesture(8, 30), gesture(40, 35), gesture(90, 0, 2)])
    expect(surface.props.onMoveShouldSetResponder(event(value.numberActiveTouches), value)).toBe(false);
  expect(surface.props.onMoveShouldSetResponder(event(), gesture(-30, 2))).toBe(true);
  expect(surface.props.onMoveShouldSetResponderCapture(event(), gesture(30, 2))).toBe(true);
});

it.each([[-80, 'next'], [80, 'previous']])('navigates once for a %spx swipe, including a zero-touch native release', (dx, direction) => {
  const screen = render(draw()); const handlers = screen.getByTestId('capture-photo-swipe-surface').props;
  act(() => {
    handlers.onResponderGrant(event(), gesture(dx as number));
    handlers.onResponderMove(event(), gesture(dx as number));
    handlers.onResponderRelease(event(0), gesture(dx as number, 0, 0));
    handlers.onResponderRelease(event(0), gesture(dx as number, 0, 0));
  });
  expect(onNext).toHaveBeenCalledTimes(direction === 'next' ? 1 : 0);
  expect(onPrevious).toHaveBeenCalledTimes(direction === 'previous' ? 1 : 0);
});

it.each([[30, 0], [100, 120]])('ignores short or vertical releases (%s,%s)', (dx, dy) => {
  const screen = render(draw()); const handlers = screen.getByTestId('capture-photo-swipe-surface').props;
  act(() => { handlers.onResponderGrant(event(), gesture(20)); handlers.onResponderRelease(event(0), gesture(dx, dy, 0)); });
  expect(onPrevious).not.toHaveBeenCalled(); expect(onNext).not.toHaveBeenCalled();
});

it('cancels a gesture permanently when another finger joins, without converting a pinch into a swipe', () => {
  const screen = render(draw()); const handlers = screen.getByTestId('capture-photo-swipe-surface').props;
  act(() => {
    handlers.onResponderGrant(event(), gesture(-20));
    handlers.onResponderStart(event(2), gesture(-30, 0, 2));
    handlers.onResponderMove(event(), gesture(-100));
    handlers.onResponderRelease(event(0), gesture(-100, 0, 0));
  });
  expect(onNext).not.toHaveBeenCalled();
});

it('also rejects multiple touches detected during movement or release', () => {
  const screen = render(draw()); const handlers = screen.getByTestId('capture-photo-swipe-surface').props;
  act(() => {
    handlers.onResponderGrant(event(), gesture(-20));
    handlers.onResponderMove(event(2), gesture(-100, 0, 2));
    handlers.onResponderRelease(event(0), gesture(-100, 0, 0));
    handlers.onResponderGrant(event(), gesture(-20, 0, 1, 2));
    handlers.onResponderRelease(event(2), gesture(-100, 0, 2, 2));
  });
  expect(onNext).not.toHaveBeenCalled();
});

it('never wraps at either edge and obeys the latest available directions', () => {
  const screen = render(draw({ canPrevious: false, canNext: false }));
  const handlers = screen.getByTestId('capture-photo-swipe-surface').props;
  expect(handlers.onMoveShouldSetResponder(event(), gesture(80))).toBe(false);
  expect(handlers.onMoveShouldSetResponder(event(), gesture(-80))).toBe(false);
  act(() => { handlers.onResponderGrant(event(), gesture(-20)); handlers.onResponderRelease(event(0), gesture(-80, 0, 0)); });
  expect(onNext).not.toHaveBeenCalled(); expect(onPrevious).not.toHaveBeenCalled();
});

it('uses updated callbacks without recreating the gesture responder', () => {
  const screen = render(draw()); const handlers = screen.getByTestId('capture-photo-swipe-surface').props;
  act(() => { handlers.onResponderGrant(event(), gesture(-20)); });
  const next = jest.fn(); screen.rerender(draw({ onNext: next }));
  act(() => { handlers.onResponderRelease(event(0), gesture(-80, 0, 0)); });
  expect(next).toHaveBeenCalledTimes(1); expect(onNext).not.toHaveBeenCalled();
  expect(PanResponder.create).toHaveBeenCalledTimes(1);
});

it.each(['photo', 'disable', 'unmount', 'terminate'])('invalidates an in-progress gesture after %s', change => {
  const screen = render(draw()); const handlers = screen.getByTestId('capture-photo-swipe-surface').props;
  act(() => { handlers.onResponderGrant(event(), gesture(-20)); handlers.onResponderMove(event(), gesture(-60)); });
  if (change === 'photo') screen.rerender(draw({ photoId: 'two' }));
  else if (change === 'disable') screen.rerender(draw({ disabled: true }));
  else if (change === 'unmount') screen.unmount();
  else act(() => { handlers.onResponderTerminate(event(), gesture(-60)); });
  act(() => { handlers.onResponderRelease(event(0), gesture(-100, 0, 0)); });
  expect(onNext).not.toHaveBeenCalled();
});

it('keeps image geometry still for reduced motion while preserving swipe navigation', async () => {
  const values = jest.spyOn(Animated.Value.prototype, 'setValue');
  const screen = render(draw()); const handlers = screen.getByTestId('capture-photo-swipe-surface').props;
  await act(async () => {});
  act(() => { motionChanged(true); }); values.mockClear();
  act(() => {
    handlers.onResponderGrant(event(), gesture(-20)); handlers.onResponderMove(event(), gesture(-100));
    handlers.onResponderRelease(event(0), gesture(-100, 0, 0));
  });
  expect(values.mock.calls.every(([value]) => value === 0)).toBe(true);
  expect(Animated.timing).not.toHaveBeenCalled(); expect(onNext).toHaveBeenCalledTimes(1);
});

it('provides bounded subtle translation and resets feedback after release', async () => {
  const values = jest.spyOn(Animated.Value.prototype, 'setValue');
  const screen = render(draw()); const handlers = screen.getByTestId('capture-photo-swipe-surface').props;
  await act(async () => {}); values.mockClear();
  act(() => {
    handlers.onResponderGrant(event(), gesture(-20)); handlers.onResponderMove(event(), gesture(-500));
    handlers.onResponderRelease(event(0), gesture(-500, 0, 0));
  });
  expect(values).toHaveBeenCalledWith(-32);
  expect(Animated.timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: 140, useNativeDriver: true }));
});
