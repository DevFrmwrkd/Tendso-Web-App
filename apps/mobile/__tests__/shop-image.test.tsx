import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ShopImage } from '../components/ShopImage';

const placeholder = require('../assets/placeholders/shop.png');

it.each([undefined, null, '', '   '])('uses the bundled illustration for a missing shop photo (%s)', uri => {
  const screen = render(<ShopImage uri={uri} name="Mika’s shop" width={184} height={100} />);
  expect(screen.getByLabelText('Mika’s shop photo unavailable').props.source).toEqual(placeholder);
});

it('replaces a broken remote photo locally without retrying the broken URL', () => {
  const onError = jest.fn();
  const screen = render(<ShopImage uri="https://example.com/missing.jpg" name="Mika’s shop" onError={onError} />);
  fireEvent(screen.getByLabelText('Mika’s shop photo'), 'error', { nativeEvent: { error: 'Offline' } });
  const fallback = screen.getByLabelText('Mika’s shop photo unavailable');
  expect(fallback.props.source).toEqual(placeholder);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(fallback.props.resizeMode).toBe('contain');
  fireEvent(fallback, 'error', { nativeEvent: { error: 'Unexpected local error' } });
  expect(onError).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Mika’s shop photo unavailable').props.source).toEqual(placeholder);
});

it('fits placeholder art inside the thumbnail while keeping real photos edge to edge', () => {
  const screen = render(<ShopImage name="Shop" width={184} height={100} category="Barbershop" />);
  expect(screen.getByLabelText('Shop photo unavailable').props.resizeMode).toBe('contain');
  screen.rerender(<ShopImage name="Shop" width={184} height={100} uri="https://example.com/shop.jpg" category="Barbershop" />);
  expect(screen.getByLabelText('Shop photo').props.resizeMode).toBe('cover');
});

it('loads a newly supplied photo after the old URL failed', () => {
  const screen = render(<ShopImage uri="https://example.com/old.jpg" name="Mika’s shop" />);
  fireEvent(screen.getByLabelText('Mika’s shop photo'), 'error', {});
  screen.rerender(<ShopImage uri="https://example.com/new.jpg" name="Mika’s shop" />);
  expect(screen.getByLabelText('Mika’s shop photo').props.source).toEqual({ uri: 'https://example.com/new.jpg' });
  expect(screen.queryByLabelText('Mika’s shop photo unavailable')).toBeNull();
});

it('ignores a late failure from the previous image when a new URI is displayed', () => {
  const screen = render(<ShopImage uri="https://example.com/old.jpg" name="Mika’s shop" />);
  const oldError = screen.getByLabelText('Mika’s shop photo').props.onError;
  screen.rerender(<ShopImage uri="https://example.com/new.jpg" name="Mika’s shop" />);
  act(() => oldError({ nativeEvent: { error: 'Old request failed' } }));
  expect(screen.getByLabelText('Mika’s shop photo').props.source).toEqual({ uri: 'https://example.com/new.jpg' });
});

it('reports completion to map markers for both real photos and local placeholders', () => {
  const onLoad = jest.fn();
  const screen = render(<ShopImage uri="https://example.com/shop.jpg" name="Shop" onLoad={onLoad} />);
  fireEvent(screen.getByLabelText('Shop photo'), 'load', {});
  fireEvent(screen.getByLabelText('Shop photo'), 'error', {});
  fireEvent(screen.getByLabelText('Shop photo unavailable'), 'load', {});
  expect(onLoad).toHaveBeenCalledTimes(2);
});
