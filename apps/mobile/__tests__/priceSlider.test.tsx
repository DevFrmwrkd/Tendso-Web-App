import React, { useState } from 'react';
import { PanResponder, ScrollView, StyleSheet, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { PriceSlider } from '../components/PriceSlider';
import { snapPrice } from '../services/priceSlider';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const base = { floor: 999, ceiling: 4999, anchor: 4999, commissionRate: 0.5, step: 1 };
type Screen = ReturnType<typeof render>;

beforeEach(() => {
  // Bind each mocked native handler to the config actually returned to the
  // rendered View. Looking at the most recent create() call can accidentally
  // exercise an orphan responder that the component never installed.
  jest.spyOn(PanResponder, 'create').mockImplementation((config) => ({
    panHandlers: {
      onStartShouldSetResponder: config.onStartShouldSetPanResponder,
      onMoveShouldSetResponder: config.onMoveShouldSetPanResponder,
      onMoveShouldSetResponderCapture: config.onMoveShouldSetPanResponderCapture,
      onResponderGrant: config.onPanResponderGrant,
      onResponderMove: config.onPanResponderMove,
      onResponderRelease: config.onPanResponderRelease,
      onResponderTerminate: config.onPanResponderTerminate,
      onResponderTerminationRequest: config.onPanResponderTerminationRequest,
    },
  }) as ReturnType<typeof PanResponder.create>);
});

afterEach(() => jest.restoreAllMocks());

function layout(screen: Screen, width = 436) {
  // Native layout and accessibility are independent of responder negotiation.
  // fireEvent incorrectly gates them behind onStartShouldSetResponder().
  act(() => screen.getByTestId('price-slider-track').props.onLayout({ nativeEvent: { layout: { width } } }));
}

function adjust(screen: Screen, actionName: string) {
  act(() => screen.getByTestId('price-slider-track').props.onAccessibilityAction({ nativeEvent: { actionName } }));
}

function gesture(screen: Screen, handler: string, dx = 0, dy = 0) {
  let result: unknown;
  act(() => { result = screen.getByTestId('price-slider-track').props[handler]({}, { dx, dy }); });
  return result;
}

const value = (screen: Screen) => screen.getByTestId('price-slider-track').props.accessibilityValue.now;

function Controlled({ onChange, revision = 0 }: { onChange: (price: number) => void; revision?: number }) {
  const [price, setPrice] = useState(999);
  return <ScrollView testID={`scroll-${revision}`}>
    <PriceSlider {...base} initialValue={price} onChange={(next) => { setPrice(next); onChange(next); }} />
    <Text testID="parent-price">{price}</Text>
  </ScrollView>;
}

it('preserves the exact bounds even when they are not multiples of the step', () => {
  expect(snapPrice(0, 999, 4999, 100)).toBe(999);
  expect(snapPrice(9999, 999, 4999, 100)).toBe(4999);
  expect(snapPrice(1234, 999, 4999, 100)).toBe(1199);
});

it('keeps a continuous controlled drag relative to its original value through parent rerenders', () => {
  const onChange = jest.fn();
  const screen = render(<Controlled onChange={onChange} />);
  layout(screen);
  onChange.mockClear();
  gesture(screen, 'onResponderGrant');
  for (const [dx, price] of [[100, 1999], [200, 2999], [300, 3999], [400, 4999]]) {
    gesture(screen, 'onResponderMove', dx);
    expect(value(screen)).toBe(price);
    expect(screen.getByTestId('parent-price')).toHaveTextContent(String(price));
  }
  gesture(screen, 'onResponderMove', 300);
  expect(value(screen)).toBe(3999);
  expect(onChange.mock.calls.map(([price]) => price)).toEqual([1999, 2999, 3999, 4999, 3999]);
  screen.rerender(<Controlled onChange={onChange} revision={1} />);
  expect(onChange).toHaveBeenCalledTimes(5);
  expect(PanResponder.create).toHaveBeenCalledTimes(1);
});

it('uses the latest callback without notifying for an unrelated rerender or external value sync', () => {
  const first = jest.fn();
  const latest = jest.fn();
  const screen = render(<PriceSlider {...base} initialValue={999} onChange={first} />);
  layout(screen);
  first.mockClear();
  screen.rerender(<PriceSlider {...base} initialValue={2999} onChange={latest} />);
  expect(value(screen)).toBe(2999);
  expect(latest).not.toHaveBeenCalled();
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', 100);
  expect(latest).toHaveBeenCalledTimes(1);
  expect(latest).toHaveBeenLastCalledWith(3999);
  expect(first).not.toHaveBeenCalled();
  expect(PanResponder.create).toHaveBeenCalledTimes(1);
});

it('ignores delayed parent echoes during a drag and accepts external prices after release', () => {
  const onChange = jest.fn();
  const screen = render(<PriceSlider {...base} initialValue={999} onChange={onChange} />);
  layout(screen);
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', 100);
  screen.rerender(<PriceSlider {...base} initialValue={1999} onChange={onChange} />);
  gesture(screen, 'onResponderMove', 200);
  screen.rerender(<PriceSlider {...base} initialValue={2999} onChange={onChange} />);
  gesture(screen, 'onResponderMove', 300);
  screen.rerender(<PriceSlider {...base} initialValue={1999} onChange={onChange} />);
  expect(value(screen)).toBe(3999);
  gesture(screen, 'onResponderRelease');
  onChange.mockClear();
  screen.rerender(<PriceSlider {...base} initialValue={4499} onChange={onChange} />);
  expect(value(screen)).toBe(4499);
  expect(onChange).not.toHaveBeenCalled();
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', -100);
  expect(value(screen)).toBe(3499);
});

it('leaves vertical scrolling and taps alone, then retains an intentional horizontal drag', () => {
  const screen = render(<Controlled onChange={jest.fn()} />);
  expect(gesture(screen, 'onMoveShouldSetResponder', 40, 1)).toBe(false);
  layout(screen);
  expect(gesture(screen, 'onStartShouldSetResponder')).toBe(false);
  expect(gesture(screen, 'onMoveShouldSetResponder', 2, 0)).toBe(false);
  expect(gesture(screen, 'onMoveShouldSetResponder', 4, 0)).toBe(false);
  expect(gesture(screen, 'onMoveShouldSetResponder', 8, 30)).toBe(false);
  expect(gesture(screen, 'onMoveShouldSetResponderCapture', 8, 30)).toBe(false);
  expect(gesture(screen, 'onMoveShouldSetResponder', -20, 4)).toBe(true);
  expect(gesture(screen, 'onMoveShouldSetResponderCapture', 20, 4)).toBe(true);
  expect(gesture(screen, 'onResponderTerminationRequest')).toBe(true);
  gesture(screen, 'onResponderGrant');
  expect(gesture(screen, 'onResponderTerminationRequest')).toBe(false);
  gesture(screen, 'onResponderMove', 100, 150);
  expect(value(screen)).toBe(1999);
  gesture(screen, 'onResponderRelease');
  expect(gesture(screen, 'onResponderTerminationRequest')).toBe(true);
});

it('ignores stale moves after release or cancellation and starts the next drag from the current value', () => {
  const screen = render(<Controlled onChange={jest.fn()} />);
  layout(screen);
  gesture(screen, 'onResponderMove', 100);
  expect(value(screen)).toBe(999);
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', 100);
  gesture(screen, 'onResponderRelease');
  gesture(screen, 'onResponderMove', 200);
  expect(value(screen)).toBe(1999);
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', 100);
  expect(value(screen)).toBe(2999);
  gesture(screen, 'onResponderTerminate');
  gesture(screen, 'onResponderMove', 300);
  expect(value(screen)).toBe(2999);
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', -100);
  expect(value(screen)).toBe(1999);
});

it('keeps the whole thumb inside the measured track at both endpoints and clamps overshoots', () => {
  const screen = render(<Controlled onChange={jest.fn()} />);
  layout(screen);
  expect(StyleSheet.flatten(screen.getByTestId('price-slider-thumb').props.style).left).toBe(0);
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', 999);
  expect(value(screen)).toBe(4999);
  const right = StyleSheet.flatten(screen.getByTestId('price-slider-thumb').props.style);
  expect(right.left + right.width).toBe(436);
  gesture(screen, 'onResponderMove', -999);
  expect(value(screen)).toBe(999);
  expect(StyleSheet.flatten(screen.getByTestId('price-slider-thumb').props.style).left).toBe(0);
});

it('cancels a drag when disabled and blocks stale native, typed and accessible edits', () => {
  const onChange = jest.fn();
  const screen = render(<PriceSlider {...base} initialValue={999} onChange={onChange} />);
  layout(screen);
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', 100);
  screen.rerender(<PriceSlider {...base} initialValue={1999} onChange={onChange} disabled />);
  onChange.mockClear();
  expect(gesture(screen, 'onMoveShouldSetResponder', 100, 0)).toBe(false);
  gesture(screen, 'onResponderMove', 200);
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', 300);
  adjust(screen, 'increment');
  fireEvent.press(screen.getByLabelText('Current price ₱1999. Tap to type exact amount.'));
  expect(screen.queryByLabelText('Price in pesos')).toBeNull();
  expect(value(screen)).toBe(1999);
  expect(onChange).not.toHaveBeenCalled();
  screen.rerender(<PriceSlider {...base} initialValue={1999} onChange={onChange} />);
  gesture(screen, 'onResponderMove', 100);
  expect(value(screen)).toBe(1999);
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', 100);
  expect(value(screen)).toBe(2999);
});

it('cancels a drag if pricing bounds change and reports a required clamp once', () => {
  const onChange = jest.fn();
  const screen = render(<PriceSlider {...base} initialValue={3999} onChange={onChange} />);
  layout(screen);
  gesture(screen, 'onResponderGrant');
  onChange.mockClear();
  screen.rerender(<PriceSlider {...base} ceiling={1999} initialValue={3999} onChange={onChange} />);
  expect(value(screen)).toBe(1999);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith(1999);
  gesture(screen, 'onResponderMove', -100);
  expect(value(screen)).toBe(1999);
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', -400);
  expect(value(screen)).toBe(999);
});

it('cancels on a real track resize and uses the new usable width for the next drag', () => {
  const screen = render(<Controlled onChange={jest.fn()} />);
  layout(screen);
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', 100);
  layout(screen, 236);
  gesture(screen, 'onResponderMove', 200);
  expect(value(screen)).toBe(1999);
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', 100);
  expect(value(screen)).toBe(3999);
});

it('ignores invalid geometry and motion without corrupting the last valid value', () => {
  const screen = render(<Controlled onChange={jest.fn()} />);
  layout(screen);
  gesture(screen, 'onResponderGrant');
  layout(screen, Number.NaN);
  layout(screen, 0);
  gesture(screen, 'onResponderMove', Number.NaN);
  expect(value(screen)).toBe(999);
  gesture(screen, 'onResponderMove', 100);
  expect(value(screen)).toBe(1999);
});

it('snaps a typed price to the configured step and uses it as the next drag baseline', () => {
  const onChange = jest.fn();
  const screen = render(<PriceSlider {...base} step={100} initialValue={999} onChange={onChange} />);
  layout(screen);
  fireEvent.press(screen.getByLabelText('Current price ₱999. Tap to type exact amount.'));
  fireEvent.changeText(screen.getByLabelText('Price in pesos'), '1234');
  fireEvent.press(screen.getByLabelText('Set price'));
  expect(value(screen)).toBe(1199);
  expect(onChange).toHaveBeenLastCalledWith(1199);
  gesture(screen, 'onResponderGrant');
  gesture(screen, 'onResponderMove', 100);
  expect(value(screen)).toBe(2199);
  gesture(screen, 'onResponderRelease');
  fireEvent.press(screen.getByLabelText('Current price ₱2199. Tap to type exact amount.'));
  fireEvent.changeText(screen.getByLabelText('Price in pesos'), '99999');
  fireEvent.press(screen.getByLabelText('Set price'));
  expect(value(screen)).toBe(4999);
});

it('preserves the previous price for cancelled or invalid typed amounts', () => {
  const onChange = jest.fn();
  const screen = render(<PriceSlider {...base} initialValue={2999} onChange={onChange} />);
  onChange.mockClear();
  fireEvent.press(screen.getByLabelText('Current price ₱2999. Tap to type exact amount.'));
  fireEvent.changeText(screen.getByLabelText('Price in pesos'), '1999');
  fireEvent.press(screen.getByLabelText('Cancel'));
  fireEvent.press(screen.getByLabelText('Current price ₱2999. Tap to type exact amount.'));
  fireEvent.changeText(screen.getByLabelText('Price in pesos'), '');
  fireEvent.press(screen.getByLabelText('Set price'));
  expect(value(screen)).toBe(2999);
  expect(onChange).not.toHaveBeenCalled();
});

it('does not commit an already-open typed editor after the slider becomes disabled', () => {
  const onChange = jest.fn();
  const screen = render(<PriceSlider {...base} initialValue={2999} onChange={onChange} />);
  fireEvent.press(screen.getByLabelText('Current price ₱2999. Tap to type exact amount.'));
  fireEvent.changeText(screen.getByLabelText('Price in pesos'), '1999');
  screen.rerender(<PriceSlider {...base} initialValue={2999} onChange={onChange} disabled />);
  onChange.mockClear();
  fireEvent.press(screen.getByLabelText('Set price'));
  expect(value(screen)).toBe(2999);
  expect(onChange).not.toHaveBeenCalled();
});

it('allows accessible stepped adjustments, preserves full-price presentation and ignores unknown actions', () => {
  const onChange = jest.fn();
  const screen = render(<PriceSlider {...base} step={100} onChange={onChange} />);
  onChange.mockClear();
  expect(screen.queryAllByText('₱4,999').every(node => node.props.style?.textDecorationLine !== 'line-through')).toBe(true);
  adjust(screen, 'increment');
  expect(value(screen)).toBe(4999);
  expect(onChange).not.toHaveBeenCalled();
  adjust(screen, 'decrement');
  expect(value(screen)).toBe(4899);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith(4899);
  adjust(screen, 'activate');
  expect(value(screen)).toBe(4899);
  expect(onChange).toHaveBeenCalledTimes(1);
});

it('keeps the introductory locked price fixed and clamps typed entry to that price', () => {
  const onChange = jest.fn();
  const screen = render(<PriceSlider {...base} ceiling={999} onChange={onChange} />);
  expect(screen.queryByTestId('price-slider-track')).toBeNull();
  expect(screen.getByText('Price is set at ₱999')).toBeTruthy();
  onChange.mockClear();
  fireEvent.press(screen.getByLabelText('Current price ₱999. Tap to type exact amount.'));
  fireEvent.changeText(screen.getByLabelText('Price in pesos'), '4999');
  fireEvent.press(screen.getByLabelText('Set price'));
  expect(onChange).not.toHaveBeenCalled();
});

it('shows a genuine price reduction even when its rounded percentage is zero', () => {
  const screen = render(<PriceSlider {...base} initialValue={4998} onChange={jest.fn()} />);
  expect(screen.queryAllByText('₱4,999').some(node => node.props.style?.textDecorationLine === 'line-through')).toBe(true);
  expect(screen.getByText('0% OFF')).toBeTruthy();
});
