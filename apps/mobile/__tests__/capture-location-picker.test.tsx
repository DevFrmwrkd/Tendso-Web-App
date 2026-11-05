import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { CaptureLocationPicker } from '../components/field-agent/CaptureLocationPicker';

const mockReverse = jest.fn();
const mockPermission = jest.fn();
const mockGetPermission = jest.fn();
const mockGPS = jest.fn();
const mockConfirm = jest.fn();
const mockClose = jest.fn();
const mockAnimate = jest.fn();
let mockCurrent = true;
jest.mock('expo-location', () => ({
  reverseGeocodeAsync: (...args: unknown[]) => mockReverse(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockPermission(...args),
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetPermission(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockGPS(...args),
  geocodeAsync: jest.fn(async () => []), Accuracy: { High: 4 },
}));
jest.mock('react-native-maps', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return { __esModule: true,
    default: ReactModule.forwardRef((props: any, ref: unknown) => {
      ReactModule.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimate }));
      return ReactModule.createElement(View, props, props.children);
    }), Marker: (props: any) => ReactModule.createElement(View, props), PROVIDER_GOOGLE: 'google' };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop' }));

const originalOS = Platform.OS;
const first = { latitude: 14.65, longitude: 121.1 };
const second = { latitude: 14.66, longitude: 121.2 };
const props = { address: '12 Main St', city: 'Marikina', isOffline: false, isCurrent: () => mockCurrent,
  onConfirm: mockConfirm, onClose: mockClose };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  jest.clearAllMocks(); mockCurrent = true;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockReverse.mockReset().mockResolvedValue([{ streetNumber: '18', street: 'River St', city: 'Marikina' }]);
  mockPermission.mockReset().mockResolvedValue({ status: 'granted' });
  mockGetPermission.mockReset().mockResolvedValue({ status: 'granted' });
  mockGPS.mockReset().mockResolvedValue({ coords: first });
});
afterEach(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS }); });

it('requires an explicit pin, supports dragging it and confirms a complete real location once', async () => {
  const screen = render(<CaptureLocationPicker {...props} />);
  expect(screen.queryByTestId('capture-location-pin')).toBeNull();
  expect(screen.getByRole('button', { name: 'Use this location' })).toBeDisabled();
  await act(async () => { fireEvent.press(screen.getByTestId('capture-location-map'), { nativeEvent: { coordinate: first } }); });
  await act(async () => { fireEvent(screen.getByTestId('capture-location-pin'), 'onDragEnd', { nativeEvent: { coordinate: second } }); });
  const confirm = screen.getByRole('button', { name: 'Use this location' });
  fireEvent.press(confirm); fireEvent.press(confirm);
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  expect(mockConfirm).toHaveBeenCalledWith({ coordinates: { lat: second.latitude, lng: second.longitude }, address: '18 River St', city: 'Marikina' });
  expect(mockPermission).not.toHaveBeenCalled();
});

it('keeps the latest pin and manually corrected text when reverse lookups finish out of order', async () => {
  const oldLookup = deferred<any[]>(); const latestLookup = deferred<any[]>();
  mockReverse.mockReturnValueOnce(oldLookup.promise).mockReturnValueOnce(latestLookup.promise);
  const screen = render(<CaptureLocationPicker {...props} />);
  act(() => { fireEvent.press(screen.getByTestId('capture-location-map'), { nativeEvent: { coordinate: first } }); });
  act(() => { fireEvent.press(screen.getByTestId('capture-location-map'), { nativeEvent: { coordinate: second } }); });
  fireEvent.changeText(screen.getByLabelText('Shop address'), 'Unit 5, exact entrance');
  fireEvent.changeText(screen.getByLabelText('Shop city'), 'Correct city');
  await act(async () => { latestLookup.resolve([{ street: 'Wrong auto street', city: 'Auto city' }]); });
  await act(async () => { oldLookup.resolve([{ street: 'Old street', city: 'Old city' }]); });
  fireEvent.press(screen.getByRole('button', { name: 'Use this location' }));
  expect(mockConfirm).toHaveBeenCalledWith({ coordinates: { lat: second.latitude, lng: second.longitude }, address: 'Unit 5, exact entrance', city: 'Correct city' });
});

it('keeps manual pin selection available when GPS permission is denied on Android', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  mockPermission.mockResolvedValue({ status: 'denied' }); mockGetPermission.mockResolvedValue({ status: 'denied' });
  const screen = render(<CaptureLocationPicker {...props} />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Use my current location' })); });
  expect(screen.getByText('Location access is off. You can still tap the map to place the shop pin.')).toBeTruthy();
  expect(mockGPS).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(screen.getByTestId('capture-location-map'), { nativeEvent: { coordinate: first } }); });
  fireEvent.press(screen.getByRole('button', { name: 'Use this location' }));
  expect(mockPermission).toHaveBeenCalledTimes(1);
  expect(mockReverse).not.toHaveBeenCalled();
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ address: props.address, coordinates: { lat: first.latitude, lng: first.longitude } }));
});

it('does not let a late GPS fix override a manually selected pin', async () => {
  const gps = deferred<{ coords: typeof first }>(); mockGPS.mockReturnValue(gps.promise);
  const screen = render(<CaptureLocationPicker {...props} />);
  act(() => { fireEvent.press(screen.getByRole('button', { name: 'Use my current location' })); });
  await waitFor(() => expect(mockGPS).toHaveBeenCalledTimes(1));
  await act(async () => { fireEvent.press(screen.getByTestId('capture-location-map'), { nativeEvent: { coordinate: second } }); });
  expect(screen.getByRole('button', { name: 'Use this location' })).not.toBeDisabled();
  await act(async () => { gps.resolve({ coords: first }); });
  fireEvent.press(screen.getByRole('button', { name: 'Use this location' }));
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ coordinates: { lat: second.latitude, lng: second.longitude } }));
  expect(mockAnimate).not.toHaveBeenCalled();
});

it('ignores delayed lookup results after cancel or account change', async () => {
  const lookup = deferred<any[]>(); mockReverse.mockReturnValue(lookup.promise);
  const screen = render(<CaptureLocationPicker {...props} />);
  act(() => { fireEvent.press(screen.getByTestId('capture-location-map'), { nativeEvent: { coordinate: first } }); });
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  mockCurrent = false;
  await act(async () => { lookup.resolve([{ street: 'Late result', city: 'Late city' }]); });
  fireEvent.press(screen.getByRole('button', { name: 'Use this location' }));
  expect(mockClose).toHaveBeenCalledTimes(1);
  expect(mockConfirm).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Shop address').props.value).toBe(props.address);
});

it('retains a selected pin and manual address when offline or the OS address lookup fails', async () => {
  mockReverse.mockRejectedValue(new Error('No geocoder'));
  const screen = render(<CaptureLocationPicker {...props} />);
  await act(async () => { fireEvent.press(screen.getByTestId('capture-location-map'), { nativeEvent: { coordinate: first } }); });
  expect(screen.getByText('Address lookup is unavailable. Your pin is selected; enter the address below.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Use this location' }));
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ address: props.address, city: props.city }));
});
