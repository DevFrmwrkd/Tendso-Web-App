import React from 'react';
import { Keyboard } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { OwnerLocationMap } from '../components/v2/owner/OwnerLocationMap';

type MockMapViewProps = import('react-native-maps').MapViewProps;
type MockMarkerProps = import('react-native-maps').MapMarkerProps;
type MockNativeViewProps = React.ComponentProps<typeof import('react-native').View>;
const mockPermission = jest.fn(), mockGPS = jest.fn(), mockChange = jest.fn(), mockAnimate = jest.fn();
let mockCurrent = true;
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: (...args: unknown[]) => mockPermission(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockGPS(...args), Accuracy: { High: 4 } }));
jest.mock('react-native-maps', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const Native = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: ReactModule.forwardRef<{ animateToRegion: typeof mockAnimate }, MockMapViewProps>((props, ref) => {
    ReactModule.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimate }));
    return ReactModule.createElement(Native.View, props as unknown as MockNativeViewProps, props.children);
  }), Marker: (props: MockMarkerProps) => ReactModule.createElement(Native.View, props as unknown as MockNativeViewProps),
  PROVIDER_GOOGLE: 'google' };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const first = { latitude: 14.65, longitude: 121.1 }, second = { latitude: 14.66, longitude: 121.2 };
const props = { isOffline: false, isCurrent: () => mockCurrent, onChange: mockChange };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  jest.clearAllMocks(); mockCurrent = true;
  mockPermission.mockReset().mockResolvedValue({ status: 'granted' }); mockGPS.mockReset().mockResolvedValue({ coords: first });
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('shows the editable map immediately and never prompts for location access on mount or manual pin selection', () => {
  const screen = render(<OwnerLocationMap {...props} required />);
  expect(screen.getByTestId('owner-location-map')).toBeTruthy(); expect(screen.queryByTestId('owner-location-pin')).toBeNull();
  expect(screen.getByText('Add a pin before sending your visit request.')).toBeTruthy();
  expect(mockPermission).not.toHaveBeenCalled(); expect(mockGPS).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('owner-location-map'), { nativeEvent: { coordinate: first } });
  expect(mockChange).toHaveBeenCalledWith({ lat: first.latitude, lng: first.longitude });
  expect(Keyboard.dismiss).toHaveBeenCalled(); expect(mockPermission).not.toHaveBeenCalled(); expect(mockGPS).not.toHaveBeenCalled();
});

it('keeps the map instance and zoom while tapping and dragging the pin', () => {
  const screen = render(<OwnerLocationMap {...props} coordinates={{ lat: first.latitude, lng: first.longitude }} />);
  const map = screen.getByTestId('owner-location-map'), initialRegion = map.props.initialRegion;
  fireEvent(screen.getByTestId('owner-location-pin'), 'onDragEnd', { nativeEvent: { coordinate: second } });
  expect(mockChange).toHaveBeenLastCalledWith({ lat: second.latitude, lng: second.longitude });
  screen.rerender(<OwnerLocationMap {...props} coordinates={{ lat: second.latitude, lng: second.longitude }} />);
  expect(screen.getByTestId('owner-location-map')).toBe(map);
  expect(screen.getByTestId('owner-location-map').props.initialRegion).toBe(initialRegion);
  expect(screen.getByTestId('owner-location-pin').props.coordinate).toEqual(second); expect(mockAnimate).not.toHaveBeenCalled();
});

it('centers an asynchronously restored draft pin once without recentering subsequent changes', () => {
  const screen = render(<OwnerLocationMap {...props} />);
  screen.rerender(<OwnerLocationMap {...props} coordinates={{ lat: first.latitude, lng: first.longitude }} />);
  expect(mockAnimate).not.toHaveBeenCalled();
  fireEvent(screen.getByTestId('owner-location-map'), 'onMapReady');
  expect(mockAnimate).toHaveBeenCalledTimes(1);
  screen.rerender(<OwnerLocationMap {...props} coordinates={{ lat: second.latitude, lng: second.longitude }} />);
  expect(mockAnimate).toHaveBeenCalledTimes(1);
});

it('does not recenter a late draft pin after the owner pans the map', () => {
  const screen = render(<OwnerLocationMap {...props} />);
  fireEvent(screen.getByTestId('owner-location-map'), 'onPanDrag');
  screen.rerender(<OwnerLocationMap {...props} coordinates={{ lat: first.latitude, lng: first.longitude }} />);
  expect(mockAnimate).not.toHaveBeenCalled();
});

it('requests GPS only after an explicit tap, deduplicates it and sets the location in the same form', async () => {
  const gps = deferred<{ coords: typeof first }>(); mockGPS.mockReturnValue(gps.promise);
  const screen = render(<OwnerLocationMap {...props} />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Use my current location' })); });
  expect(mockPermission).toHaveBeenCalledTimes(1); expect(mockGPS).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Use my current location' })); gps.resolve({ coords: first }); });
  expect(mockPermission).toHaveBeenCalledTimes(1); expect(mockChange).toHaveBeenCalledTimes(1);
  expect(mockChange).toHaveBeenCalledWith({ lat: first.latitude, lng: first.longitude }); expect(mockAnimate).toHaveBeenCalledTimes(1);
});

it('keeps manual pin selection when permission is denied', async () => {
  mockPermission.mockResolvedValue({ status: 'denied' });
  const screen = render(<OwnerLocationMap {...props} />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Use my current location' })); });
  expect(screen.getByText('Location access is off. You can still tap the map to pin your shop.')).toBeTruthy();
  fireEvent.press(screen.getByTestId('owner-location-map'), { nativeEvent: { coordinate: second } });
  expect(mockChange).toHaveBeenCalledWith({ lat: second.latitude, lng: second.longitude }); expect(mockGPS).not.toHaveBeenCalled();
});

it.each(['manual pin', 'account change', 'unmount'])('ignores a late GPS result after %s', async condition => {
  const gps = deferred<{ coords: typeof first }>(); mockGPS.mockReturnValue(gps.promise);
  const screen = render(<OwnerLocationMap {...props} />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Use my current location' })); });
  await waitFor(() => expect(mockGPS).toHaveBeenCalledTimes(1));
  if (condition === 'manual pin') fireEvent.press(screen.getByTestId('owner-location-map'), { nativeEvent: { coordinate: second } });
  else if (condition === 'account change') mockCurrent = false;
  else screen.unmount();
  await act(async () => gps.resolve({ coords: first }));
  expect(mockAnimate).not.toHaveBeenCalled();
  if (condition === 'manual pin') expect(mockChange.mock.calls).toEqual([[{ lat: second.latitude, lng: second.longitude }]]);
  else expect(mockChange).not.toHaveBeenCalled();
});

it('retains manual pin changes offline and blocks GPS and disabled/stale mutations', () => {
  const screen = render(<OwnerLocationMap {...props} isOffline />);
  expect(screen.getByRole('button', { name: 'Use my current location' })).toBeDisabled();
  fireEvent.press(screen.getByTestId('owner-location-map'), { nativeEvent: { coordinate: first } });
  expect(mockChange).toHaveBeenCalledTimes(1); expect(mockPermission).not.toHaveBeenCalled();
  screen.rerender(<OwnerLocationMap {...props} disabled coordinates={{ lat: first.latitude, lng: first.longitude }} />);
  expect(screen.getByTestId('owner-location-map').props.scrollEnabled).toBe(false);
  expect(screen.getByTestId('owner-location-pin').props.draggable).toBe(false);
  fireEvent.press(screen.getByTestId('owner-location-map'), { nativeEvent: { coordinate: second } });
  mockCurrent = false; screen.rerender(<OwnerLocationMap {...props} />);
  fireEvent.press(screen.getByTestId('owner-location-map'), { nativeEvent: { coordinate: second } });
  expect(mockChange).toHaveBeenCalledTimes(1);
});
