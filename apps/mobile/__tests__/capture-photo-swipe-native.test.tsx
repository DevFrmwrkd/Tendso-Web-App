import React from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { CapturePhotoSwipeSurface, type CapturePhotoSwipeSurfaceProps } from '../components/field-agent/CapturePhotoSwipeSurface';

// These handlers are the installed React Native PanResponder implementation.
// In particular, grant resets dx/dy after the move that acquired the responder.
function nativeTouch() {
  let time = 1;
  const touch = { touchActive: true, startPageX: 200, startPageY: 200, startTimeStamp: 1,
    currentPageX: 200, currentPageY: 200, currentTimeStamp: 1,
    previousPageX: 200, previousPageY: 200, previousTimeStamp: 1 };
  const history = { touchBank: [touch], numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: 1 };
  const event = () => ({ nativeEvent: { touches: Array.from({ length: history.numberActiveTouches }, () => ({ pageX: touch.currentPageX, pageY: touch.currentPageY })) }, touchHistory: history });
  return {
    event,
    move: (x: number, y = 200) => {
      touch.previousPageX = touch.currentPageX; touch.previousPageY = touch.currentPageY; touch.previousTimeStamp = touch.currentTimeStamp;
      touch.currentPageX = x; touch.currentPageY = y; touch.currentTimeStamp = ++time; history.mostRecentTimeStamp = time;
      return event();
    },
    touches: (count: number) => { history.numberActiveTouches = count; return event(); },
  };
}

let next: jest.Mock;
let previous: jest.Mock;
const draw = (props: Partial<CapturePhotoSwipeSurfaceProps> = {}) => <CapturePhotoSwipeSurface photoId="one" canNext canPrevious
  onNext={next} onPrevious={previous} {...props}><Text>Photo</Text></CapturePhotoSwipeSurface>;

beforeEach(() => {
  next = jest.fn(); previous = jest.fn();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(() => jest.restoreAllMocks());

function claim(handlers: Record<string, any>, finger: ReturnType<typeof nativeTouch>, direction: number) {
  handlers.onStartShouldSetResponderCapture(finger.event());
  expect(handlers.onStartShouldSetResponder(finger.event())).toBe(false);
  const claimEvent = finger.move(200 + direction * 12);
  expect(handlers.onMoveShouldSetResponderCapture(claimEvent)).toBe(true);
  handlers.onResponderGrant(claimEvent);
  // The acquisition event may also reach move; RN filters its duplicate stamp.
  handlers.onResponderMove(claimEvent);
}

it.each([[-1, 0], [-1, 1], [-1, 5], [1, 0], [1, 1], [1, 5]])(
  'navigates once after native grant resets movement (direction %s, first move %spx)', async (direction, firstMove) => {
  const screen = render(draw()); const handlers = screen.getByTestId('capture-photo-swipe-surface').props;
  await act(async () => {});
  const finger = nativeTouch();
  act(() => {
    claim(handlers, finger, direction);
    for (const distance of [12 + firstMove, 18, 24, 40, 65, 85]) handlers.onResponderMove(finger.move(200 + direction * distance));
    handlers.onResponderEnd(finger.touches(0));
    handlers.onResponderRelease(finger.event());
    handlers.onResponderRelease(finger.event());
  });
  expect(next).toHaveBeenCalledTimes(direction < 0 ? 1 : 0);
  expect(previous).toHaveBeenCalledTimes(direction > 0 ? 1 : 0);
});

it('keeps short native drags below the release distance from navigating', async () => {
  const screen = render(draw()); const handlers = screen.getByTestId('capture-photo-swipe-surface').props;
  await act(async () => {}); const finger = nativeTouch();
  act(() => {
    claim(handlers, finger, -1);
    for (const distance of [13, 15, 20, 30]) handlers.onResponderMove(finger.move(200 - distance));
    handlers.onResponderEnd(finger.touches(0)); handlers.onResponderRelease(finger.event());
  });
  expect(next).not.toHaveBeenCalled(); expect(previous).not.toHaveBeenCalled();
});

it.each(['vertical', 'multitouch', 'photo', 'disabled'])('cancels the real native gesture after %s', async change => {
  const screen = render(draw()); const handlers = screen.getByTestId('capture-photo-swipe-surface').props;
  await act(async () => {}); const finger = nativeTouch();
  act(() => { claim(handlers, finger, -1); handlers.onResponderMove(finger.move(187)); });
  if (change === 'photo') screen.rerender(draw({ photoId: 'two' }));
  else if (change === 'disabled') screen.rerender(draw({ disabled: true }));
  else act(() => {
    if (change === 'vertical') handlers.onResponderMove(finger.move(186, 240));
    else { handlers.onResponderStart(finger.touches(2)); finger.touches(1); }
  });
  act(() => {
    handlers.onResponderMove(finger.move(110));
    handlers.onResponderEnd(finger.touches(0)); handlers.onResponderRelease(finger.event());
  });
  expect(next).not.toHaveBeenCalled(); expect(previous).not.toHaveBeenCalled();
});

it('does not claim a native swipe toward an unavailable edge', async () => {
  const screen = render(draw({ canNext: false })); const handlers = screen.getByTestId('capture-photo-swipe-surface').props;
  await act(async () => {}); const finger = nativeTouch();
  act(() => {
    handlers.onStartShouldSetResponderCapture(finger.event());
    expect(handlers.onMoveShouldSetResponderCapture(finger.move(170))).toBe(false);
    expect(handlers.onMoveShouldSetResponderCapture(finger.move(120))).toBe(false);
  });
  expect(next).not.toHaveBeenCalled();
});
