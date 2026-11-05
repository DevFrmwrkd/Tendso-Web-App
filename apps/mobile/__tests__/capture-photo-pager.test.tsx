import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { CapturePhotoPager, type CapturePhotoPagerProps } from '../components/field-agent/CapturePhotoPager';

let select: jest.Mock;
let interaction: jest.Mock;
const ids = ['portrait', 'entrance', 'work'];
const event = (x: number) => ({ nativeEvent: { contentOffset: { x, y: 0 }, layoutMeasurement: { width: 320, height: 500 },
  contentSize: { width: 960, height: 500 }, velocity: { x: 0, y: 0 } } });
const draw = (props: Partial<CapturePhotoPagerProps> = {}) => <CapturePhotoPager photoIds={ids} selectedPhotoId="portrait"
  onSelectPhoto={select} onInteractionChange={interaction} renderPhoto={id => <Text>{id} image</Text>} {...props} />;
function setup(props: Partial<CapturePhotoPagerProps> = {}) {
  const screen = render(draw(props));
  fireEvent(screen.getByTestId('capture-photo-pager'), 'layout', { nativeEvent: { layout: { width: 320, height: 500, x: 0, y: 0 } } });
  return screen;
}
beforeEach(() => { jest.useFakeTimers(); select = jest.fn(); interaction = jest.fn(); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it('uses a real native horizontal paging ScrollView with measured adjacent image pages', () => {
  const screen = setup(); const scroll = screen.getByTestId('capture-photo-pager-scroll');
  expect(scroll).toHaveProp('horizontal', true); expect(scroll).toHaveProp('pagingEnabled', true);
  expect(scroll).toHaveProp('scrollEnabled', true); expect(scroll).toHaveProp('bounces', false);
  for (const id of ids) {
    expect(screen.getByText(`${id} image`, { includeHiddenElements: true })).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId(`capture-photo-page-${id}`, { includeHiddenElements: true }).props.style)).toMatchObject({ width: 320, height: 500 });
  }
  expect(screen.getByTestId('capture-photo-page-portrait')).toHaveProp('accessibilityElementsHidden', false);
  expect(screen.getByTestId('capture-photo-page-entrance', { includeHiddenElements: true })).toHaveProp('accessibilityElementsHidden', true);
  expect(screen.getByTestId('capture-photo-page-work', { includeHiddenElements: true })).toHaveProp('importantForAccessibility', 'no-hide-descendants');
});

it('selects the actual settled stable photo ID once and reports native interaction boundaries', () => {
  const screen = setup(); const scroll = screen.getByTestId('capture-photo-pager-scroll');
  fireEvent(scroll, 'scrollBeginDrag', event(0));
  fireEvent.scroll(scroll, event(130));
  expect(select).not.toHaveBeenCalled(); expect(interaction).toHaveBeenLastCalledWith(true);
  fireEvent(scroll, 'scrollEndDrag', event(230));
  fireEvent(scroll, 'momentumScrollBegin', event(250));
  fireEvent(scroll, 'momentumScrollEnd', event(320));
  fireEvent(scroll, 'momentumScrollEnd', event(320));
  expect(select.mock.calls).toEqual([['entrance']]);
  expect(interaction.mock.calls).toEqual([[true], [false]]);
});

it('follows a controlled arrow change without treating programmatic scrolling as another selection', () => {
  const screen = setup();
  screen.rerender(draw({ selectedPhotoId: 'work' }));
  const scroll = screen.getByTestId('capture-photo-pager-scroll');
  expect(scroll).toHaveProp('contentOffset', { x: 640, y: 0 });
  expect(screen.getByTestId('capture-photo-page-work')).toHaveProp('accessibilityElementsHidden', false);
  fireEvent(scroll, 'momentumScrollEnd', event(640));
  expect(select).not.toHaveBeenCalled(); expect(interaction).not.toHaveBeenCalled();
});

it.each([0, 8, 35])('unlocks after a tiny/canceled %spx drag that has no momentum callback', x => {
  const screen = setup(); const scroll = screen.getByTestId('capture-photo-pager-scroll');
  fireEvent(scroll, 'scrollBeginDrag', event(0)); fireEvent(scroll, 'scrollEndDrag', event(x));
  act(() => { jest.advanceTimersByTime(180); });
  expect(select).not.toHaveBeenCalled(); expect(interaction.mock.calls).toEqual([[true], [false]]);
});

it('settles a real scroll when native momentum-end is missing, waiting until scrolling becomes quiet', () => {
  const screen = setup(); const scroll = screen.getByTestId('capture-photo-pager-scroll');
  fireEvent(scroll, 'scrollBeginDrag', event(0)); fireEvent(scroll, 'scrollEndDrag', event(190));
  act(() => { jest.advanceTimersByTime(100); }); fireEvent.scroll(scroll, event(270));
  act(() => { jest.advanceTimersByTime(100); }); expect(select).not.toHaveBeenCalled();
  fireEvent.scroll(scroll, event(320)); act(() => { jest.advanceTimersByTime(180); });
  expect(select).toHaveBeenCalledWith('entrance'); expect(interaction).toHaveBeenLastCalledWith(false);
});

it.each(['selection', 'photos', 'disabled', 'resize', 'unmount'])('rejects stale native settlement after %s changes', change => {
  const screen = setup(); const scroll = screen.getByTestId('capture-photo-pager-scroll');
  fireEvent(scroll, 'scrollBeginDrag', event(0)); fireEvent(scroll, 'scrollEndDrag', event(240));
  if (change === 'selection') screen.rerender(draw({ selectedPhotoId: 'work' }));
  else if (change === 'photos') screen.rerender(draw({ photoIds: ['portrait', 'work'] }));
  else if (change === 'disabled') screen.rerender(draw({ disabled: true }));
  else if (change === 'resize') fireEvent(screen.getByTestId('capture-photo-pager'), 'layout', { nativeEvent: { layout: { width: 400, height: 500 } } });
  else screen.unmount();
  if (change !== 'unmount') fireEvent(scroll, 'momentumScrollEnd', event(320));
  act(() => { jest.advanceTimersByTime(200); });
  expect(select).not.toHaveBeenCalled(); expect(interaction).toHaveBeenLastCalledWith(false);
});

it('disables native scrolling for a single photo or a pending action', () => {
  for (const props of [{ photoIds: ['portrait'] }, { disabled: true }]) {
    const screen = setup(props); const scroll = screen.getByTestId('capture-photo-pager-scroll');
    expect(scroll).toHaveProp('scrollEnabled', false);
    fireEvent(scroll, 'scrollBeginDrag', event(0)); fireEvent(scroll, 'scrollEndDrag', event(320));
    fireEvent(scroll, 'momentumScrollEnd', event(320));
    expect(select).not.toHaveBeenCalled(); expect(interaction).not.toHaveBeenCalled(); screen.unmount();
  }
});

it('uses the latest callback and stable order at settlement without selecting stale pages', () => {
  const screen = setup(); const scroll = screen.getByTestId('capture-photo-pager-scroll'); const latest = jest.fn();
  fireEvent(scroll, 'scrollBeginDrag', event(0));
  screen.rerender(draw({ onSelectPhoto: latest }));
  fireEvent(scroll, 'scrollEndDrag', event(290)); fireEvent(scroll, 'momentumScrollEnd', event(320));
  expect(latest).toHaveBeenCalledWith('entrance'); expect(select).not.toHaveBeenCalled();
});

it('does not cancel an active drag when a parent rerenders the same selected photo and ID order', () => {
  const screen = setup(); const scroll = screen.getByTestId('capture-photo-pager-scroll');
  fireEvent(scroll, 'scrollBeginDrag', event(0)); fireEvent.scroll(scroll, event(140));
  screen.rerender(draw({ photoIds: [...ids] }));
  expect(interaction.mock.calls).toEqual([[true]]);
  fireEvent(scroll, 'scrollEndDrag', event(290)); fireEvent(scroll, 'momentumScrollEnd', event(320));
  expect(select.mock.calls).toEqual([['entrance']]); expect(interaction.mock.calls).toEqual([[true], [false]]);
});

it('ignores an old momentum completion while a new finger drag is still active', () => {
  const screen = setup(); const scroll = screen.getByTestId('capture-photo-pager-scroll');
  fireEvent(scroll, 'scrollBeginDrag', event(0)); fireEvent(scroll, 'momentumScrollEnd', event(320));
  expect(select).not.toHaveBeenCalled(); expect(interaction).toHaveBeenLastCalledWith(true);
  fireEvent(scroll, 'scrollEndDrag', event(0)); act(() => { jest.advanceTimersByTime(180); });
  expect(select).not.toHaveBeenCalled(); expect(interaction).toHaveBeenLastCalledWith(false);
});
