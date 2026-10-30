import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ShopImage } from '../components/ShopImage';

// The preset's Image mock skips the source dimensions applied by Image.ios.
// Keep that installed implementation and replace only its native host boundary.
jest.mock('react-native/Libraries/Image/Image', () =>
  jest.requireActual('react-native/Libraries/Image/Image.ios'));
jest.mock('react-native/Libraries/Image/ImageViewNativeComponent', () => {
  const { createElement: makeElement, forwardRef } = require('react');
  return {
    __esModule: true,
    default: forwardRef((props: object, ref: unknown) =>
      makeElement('Image', { ...props, ref })),
  };
});
jest.mock('../assets/placeholders/shop.png', () => ({
  uri: 'asset://shop.png', width: 480, height: 480, scale: 1,
}));

it.each([
  { width: 184, height: 100 },
  { width: 48, height: 48 },
])('bounds the actual iOS bundled Image inside a $width by $height slot', slot => {
  const screen = render(<ShopImage name="Shop" {...slot} />);
  const image = screen.getByLabelText('Shop photo unavailable');

  // This is the native host source and final style produced by real Image.ios,
  // including the 480px asset metadata that previously overrode absoluteFill.
  expect(image.props.source).toEqual([
    { uri: 'asset://shop.png', width: 480, height: 480, scale: 1 },
  ]);
  expect(StyleSheet.flatten(image.props.style)).toMatchObject({
    position: 'absolute', width: '100%', height: '100%',
  });
  expect(image.props.resizeMode).toBe('contain');
});

it('keeps the actual iOS Image bounded when a remote photo fails into a bundled fallback', () => {
  const onError = jest.fn();
  const screen = render(<ShopImage uri="https://example.com/missing.jpg" name="Shop" width={352} height={196} onError={onError} />);
  const remote = screen.getByLabelText('Shop photo');
  expect(remote.props.source).toEqual([{ uri: 'https://example.com/missing.jpg' }]);
  expect(remote.props.resizeMode).toBe('cover');

  fireEvent(remote, 'error', { nativeEvent: { error: 'Offline' } });
  const fallback = screen.getByLabelText('Shop photo unavailable');
  expect(fallback.props.source).toEqual([
    { uri: 'asset://shop.png', width: 480, height: 480, scale: 1 },
  ]);
  expect(StyleSheet.flatten(fallback.props.style)).toMatchObject({
    position: 'absolute', width: '100%', height: '100%',
  });
  expect(fallback.props.resizeMode).toBe('contain');
  expect(onError).toHaveBeenCalledTimes(1);
});
