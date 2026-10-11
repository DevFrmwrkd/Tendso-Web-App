import React from 'react';
import { PanResponder } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { PriceSlider } from '../components/PriceSlider';
import { snapPrice } from '../services/priceSlider';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
it('preserves the exact bounds even when they are not multiples of the step', () => {
  expect(snapPrice(0, 999, 4999, 100)).toBe(999);
  expect(snapPrice(9999, 999, 4999, 100)).toBe(4999);
  expect(snapPrice(1234, 999, 4999, 100)).toBe(1199);
});
it('uses measured width and the original drag value instead of accumulating total dx', () => {
  let handlers: any;
  const responder = jest.spyOn(PanResponder, 'create').mockImplementation((config) => {
    handlers = config;
    return { panHandlers: {} } as any;
  });
  const onChange = jest.fn();
  const screen = render(<PriceSlider floor={999} ceiling={4999} anchor={4999} commissionRate={0.5} step={1} initialValue={999} onChange={onChange} />);
  fireEvent(screen.getByTestId('price-slider-track'), 'layout', { nativeEvent: { layout: { width: 400 } } });
  act(() => handlers.onPanResponderGrant());
  act(() => handlers.onPanResponderMove({}, { dx: 100 }));
  expect(onChange).toHaveBeenLastCalledWith(1999);
  act(() => handlers.onPanResponderMove({}, { dx: 200 }));
  expect(onChange).toHaveBeenLastCalledWith(2999);
  act(() => handlers.onPanResponderMove({}, { dx: 999 }));
  expect(onChange).toHaveBeenLastCalledWith(4999);
  responder.mockRestore();
});
it('has no strike-through at full price and allows accessible bounded adjustments', () => {
  const onChange = jest.fn();
  const screen = render(<PriceSlider floor={999} ceiling={4999} anchor={4999} commissionRate={0.5} step={100} onChange={onChange} />);
  const slider = screen.getByTestId('price-slider-track');
  fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  expect(onChange).toHaveBeenLastCalledWith(4999);
  expect(screen.queryAllByText('₱4,999').every(node => node.props.style?.textDecorationLine !== 'line-through')).toBe(true);
});
it('shows a genuine price reduction even when its rounded percentage is zero', () => {
  const screen = render(<PriceSlider floor={999} ceiling={4999} anchor={4999} commissionRate={0.5} step={1} initialValue={4998} onChange={jest.fn()} />);
  expect(screen.queryAllByText('₱4,999').some(node => node.props.style?.textDecorationLine === 'line-through')).toBe(true);
  expect(screen.getByText('0% OFF')).toBeTruthy();
});
