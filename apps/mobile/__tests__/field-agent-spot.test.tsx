import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import SpotShopScreen from '../app/(app)/leads/spot';
import { Button } from '../components/v2';
import type { MapCoordinate, MapSearchArea } from '../services/workArea';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockCreate = jest.fn();
const mockUpload = jest.fn();
const mockFetch = jest.fn();
const mockCameraPermission = jest.fn();
const mockLibraryPermission = jest.fn();
const mockLaunchCamera = jest.fn();
const mockLaunchLibrary = jest.fn();
const mockResize = jest.fn();
const mockRenderImage = jest.fn();
const mockSaveImage = jest.fn();
const mockRequestLocation = jest.fn();
const mockAnimate = jest.fn();
let mockViewport: MapCoordinate & { latitudeDelta: number; longitudeDelta: number };
let mockAccount: any;
let mockArea: MapSearchArea | null;
let mockCurrentLocation: MapCoordinate | null;
let mockClerkSubject: string | null;
let mockClerkSignedIn: boolean;
let mockOffline: boolean;
let mockAuthenticated: boolean;
let mockLoading: boolean;
let mockRole: string | null;
let mockBlocked: boolean;

jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => ({
  account: mockAccount, role: mockRole, isLoading: mockLoading, isAuthenticated: mockAuthenticated,
  isOffline: mockOffline, isPreview: false, isBlocked: mockBlocked,
}) }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({
  userId: mockClerkSubject, isLoaded: true, isSignedIn: mockClerkSignedIn,
}) }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: !mockOffline }) }));
jest.mock('../hooks/useWorkAreaLocation', () => ({ useWorkAreaLocation: () => ({
  area: mockArea, currentLocation: mockCurrentLocation, requestCurrentLocation: mockRequestLocation, isLocating: false,
}) }));
jest.mock('../hooks/usePushNotifications', () => ({ usePushNotifications: jest.fn() }));
jest.mock('../components/AccountPreview', () => ({ CreatorDashboardPreview: () => null }));
jest.mock('@tendso/convex-client', () => ({ api: {
  leads: { createCommunityFind: 'create' }, r2: { generateUploadUrl: 'upload' },
} }));
jest.mock('convex/react', () => ({
  useMutation: (reference: string) => {
    if (reference === 'create') return mockCreate;
    throw new Error(`Unexpected mutation: ${reference}`);
  },
  useAction: (reference: string) => {
    if (reference === 'upload') return mockUpload;
    throw new Error(`Unexpected action: ${reference}`);
  },
}));
jest.mock('expo-router', () => ({ Redirect: () => null }));
jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestCameraPermissionsAsync: (...args: unknown[]) => mockCameraPermission(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockLibraryPermission(...args),
  launchCameraAsync: (...args: unknown[]) => mockLaunchCamera(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchLibrary(...args),
}));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: () => ({ resize: (...args: unknown[]) => mockResize(...args) }) },
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('react-native-maps', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return { __esModule: true,
    default: ReactModule.forwardRef((props: any, ref: unknown) => {
      ReactModule.useEffect(() => { mockViewport = props.region ?? props.initialRegion; }, []);
      ReactModule.useEffect(() => { if (props.region) mockViewport = props.region; }, [props.region]);
      ReactModule.useImperativeHandle(ref, () => ({ animateToRegion: (region: typeof mockViewport, duration: number) => {
        mockAnimate(region, duration); mockViewport = region;
      } }));
      return ReactModule.createElement(View, { ...props, onRegionChangeComplete: (region: typeof mockViewport) => {
        mockViewport = region; props.onRegionChangeComplete?.(region);
      } }, props.children);
    }), Marker: (props: any) => ReactModule.createElement(View, { ...props, testID: 'native-spot-pin' }), PROVIDER_GOOGLE: 'google' };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));

const originalFetch = global.fetch;
const pin = { latitude: 14.65123, longitude: 121.10987 };
const uploadTarget = { uploadUrl: 'https://upload.example.com/shop', publicUrl: 'https://images.example.com/shop.jpg' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function choosePhoto(screen: ReturnType<typeof render>, method = 'Choose photo') {
  fireEvent.press(screen.getByRole('button', { name: /Add shop photo|Change shop photo/ }));
  const alert = jest.mocked(Alert.alert).mock.calls.at(-1)!;
  const choice = alert[2]!.find((button) => button.text === method)!;
  act(() => choice.onPress!());
}

async function fillForm(screen: ReturnType<typeof render>, setPin = true) {
  fireEvent.changeText(screen.getByLabelText('Shop name'), '  Nena Store  ');
  fireEvent.press(screen.getByRole('button', { name: 'Sari-sari' }));
  choosePhoto(screen);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Change shop photo' })).toBeTruthy());
  if (setPin) fireEvent.press(screen.getByLabelText('Tap to pin the shop location'), { nativeEvent: { coordinate: pin } });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccount = { _id: 'agent-1', clerkId: 'clerk-agent-1', role: 'creator', firstName: 'Pablo', certifiedAt: 100, workCity: 'Marikina' };
  mockClerkSubject = 'clerk-agent-1';
  mockClerkSignedIn = true;
  mockOffline = false;
  mockAuthenticated = true;
  mockLoading = false;
  mockRole = 'creator';
  mockBlocked = false;
  mockArea = { latitude: 14.65, longitude: 121.10, source: 'work', label: 'Marikina' };
  mockCurrentLocation = null;
  mockCreate.mockReset().mockResolvedValue('lead-created');
  mockUpload.mockReset().mockResolvedValue(uploadTarget);
  mockCameraPermission.mockReset().mockResolvedValue({ status: 'granted' });
  mockLibraryPermission.mockReset().mockResolvedValue({ status: 'granted' });
  const image = { canceled: false, assets: [{ uri: 'file://raw.jpg', width: 2000, height: 1000 }] };
  mockLaunchCamera.mockReset().mockResolvedValue(image);
  mockLaunchLibrary.mockReset().mockResolvedValue(image);
  mockResize.mockReset().mockImplementation(() => ({ renderAsync: mockRenderImage }));
  mockRenderImage.mockReset().mockResolvedValue({ saveAsync: mockSaveImage });
  mockSaveImage.mockReset().mockResolvedValue({ uri: 'file://normalized.jpg' });
  mockFetch.mockReset().mockImplementation(async (url: string) => url.startsWith('file:')
    ? { blob: async () => ({ type: 'image/jpeg' }) } : { ok: true });
  global.fetch = mockFetch as unknown as typeof fetch;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());
afterAll(() => { global.fetch = originalFetch; });

it('uploads a normalized JPEG and saves only the selected shop details and exact pin', async () => {
  const screen = render(<SpotShopScreen />);
  await fillForm(screen);
  fireEvent.changeText(screen.getByLabelText('Address (optional)'), '  12 Rizal Street  ');
  fireEvent.changeText(screen.getByLabelText('City (optional)'), '  Marikina  ');
  fireEvent(screen.getByLabelText('Needs a site'), 'valueChange', false);
  fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/leads/lead-created'));
  expect(mockResize).toHaveBeenCalledWith({ width: 1600, height: 800 });
  expect(mockSaveImage).toHaveBeenCalledWith({ compress: 0.85, format: 'jpeg' });
  expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ folder: 'community', contentType: 'image/jpeg', filename: expect.stringMatching(/^find-.*\.jpg$/) }));
  expect(mockFetch).toHaveBeenCalledWith(uploadTarget.uploadUrl, expect.objectContaining({ method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } }));
  expect(mockCreate).toHaveBeenCalledWith({
    businessName: 'Nena Store', kind: 'sari_sari', photoUrl: uploadTarget.publicUrl, needsWebsite: false,
    ...pin, address: '12 Rizal Street', city: 'Marikina', clientRequestId: expect.stringMatching(/^find-/),
  });
});

it('requires an explicit shop pin even when a saved work city centers the map', async () => {
  const screen = render(<SpotShopScreen />);
  await fillForm(screen, false);
  expect(screen.getByRole('button', { name: 'Save find' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled();
});

it('still permits an explicit manual pin without saved work area or device GPS', async () => {
  mockArea = null;
  const screen = render(<SpotShopScreen />);
  await fillForm(screen, false);
  expect(screen.getByLabelText('Tap to pin the shop location')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save find' })).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Tap to pin the shop location'), { nativeEvent: { coordinate: pin } });
  fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining(pin)));
});

it('preserves a manually selected pin when a late GPS result arrives', async () => {
  const screen = render(<SpotShopScreen />);
  await fillForm(screen);
  mockCurrentLocation = { latitude: 14.60, longitude: 121.01 };
  screen.rerender(<SpotShopScreen />);
  expect(mockAnimate).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining(pin)));
});

it('uses a newly requested GPS result when the user explicitly chooses their location', async () => {
  const screen = render(<SpotShopScreen />);
  await fillForm(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  expect(mockRequestLocation).toHaveBeenCalledTimes(1);
  mockCurrentLocation = { latitude: 14.60, longitude: 121.01 };
  screen.rerender(<SpotShopScreen />);
  expect(mockAnimate).toHaveBeenCalledWith({ ...mockCurrentLocation, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 250);
  fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining(mockCurrentLocation!)));
});

it('keeps the manually zoomed map viewport when placing or dragging the shop pin', async () => {
  const screen = render(<SpotShopScreen />);
  await fillForm(screen, false);
  const zoomed = { latitude: 14.6512, longitude: 121.1098, latitudeDelta: 0.0007, longitudeDelta: 0.0005 };
  fireEvent(screen.getByLabelText('Tap to pin the shop location'), 'regionChangeComplete', zoomed);
  fireEvent.press(screen.getByLabelText('Tap to pin the shop location'), { nativeEvent: { coordinate: pin } });
  expect(mockViewport).toEqual(zoomed);
  expect(mockAnimate).not.toHaveBeenCalled();
  const adjusted = { latitude: 14.65125, longitude: 121.10989 };
  fireEvent(screen.getByTestId('native-spot-pin'), 'dragEnd', { nativeEvent: { coordinate: adjusted } });
  expect(screen.getByTestId('native-spot-pin').props.coordinate).toEqual(adjusted);
  expect(mockViewport).toEqual(zoomed);
  expect(mockAnimate).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining(adjusted)));
});

it.each([
  ['Choose photo', 'library'], ['Take photo', 'camera'],
])('does not launch %s or upload when %s permission is denied', async (method, permission) => {
  (permission === 'camera' ? mockCameraPermission : mockLibraryPermission).mockResolvedValue({ status: 'denied' });
  const screen = render(<SpotShopScreen />);
  choosePhoto(screen, method);
  await waitFor(() => expect(screen.getByText(/Allow .* access/)).toBeTruthy());
  expect(mockLaunchCamera).not.toHaveBeenCalled();
  expect(mockLaunchLibrary).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled();
});

it('deduplicates direct save taps through upload and the create mutation', async () => {
  const pending = deferred<string>();
  mockCreate.mockReturnValue(pending.promise);
  const screen = render(<SpotShopScreen />);
  await fillForm(screen);
  const save = screen.UNSAFE_getAllByType(Button).find((button) => button.props.title === 'Save find')!;
  act(() => { save.props.onPress(); save.props.onPress(); });
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).not.toHaveBeenCalled();
  await act(async () => { pending.resolve('created-once'); await pending.promise; });
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
});

it('retries with the same request id and cached upload after a transient save failure', async () => {
  mockCreate.mockRejectedValueOnce(new Error('Please try again.')).mockResolvedValueOnce('retried-find');
  const screen = render(<SpotShopScreen />);
  await fillForm(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
  await waitFor(() => expect(screen.getByText('Please try again.')).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/leads/retried-find'));
  expect(mockCreate).toHaveBeenCalledTimes(2);
  expect(mockCreate.mock.calls[0][0].clientRequestId).toBe(mockCreate.mock.calls[1][0].clientRequestId);
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledTimes(2); // One local read, one PUT.
});

it('clears account-scoped drafts and ignores a stale permission request when the account changes', async () => {
  const pending = deferred<{ status: string }>();
  mockLibraryPermission.mockReturnValue(pending.promise);
  const screen = render(<SpotShopScreen />);
  fireEvent.changeText(screen.getByLabelText('Shop name'), 'Private draft');
  choosePhoto(screen);
  mockAccount = { ...mockAccount, _id: 'agent-2', clerkId: 'clerk-agent-2', firstName: 'Ana', workCity: 'Pasig' };
  mockClerkSubject = 'clerk-agent-2';
  screen.rerender(<SpotShopScreen />);
  expect(screen.getByLabelText('Shop name').props.value).toBe('');
  expect(screen.getByLabelText('City (optional)').props.value).toBe('Pasig');
  await act(async () => { pending.resolve({ status: 'granted' }); await pending.promise; });
  expect(mockLaunchLibrary).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Add shop photo' })).toBeTruthy();
});

it('does not upload or create a find after an account change during upload preparation', async () => {
  const pending = deferred<typeof uploadTarget>();
  mockUpload.mockReturnValue(pending.promise);
  const screen = render(<SpotShopScreen />);
  await fillForm(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
  expect(mockUpload).toHaveBeenCalledTimes(1);
  mockAccount = { ...mockAccount, _id: 'agent-2', clerkId: 'clerk-agent-2', firstName: 'Ana' };
  mockClerkSubject = 'clerk-agent-2';
  screen.rerender(<SpotShopScreen />);
  await act(async () => { pending.resolve(uploadTarget); await pending.promise; });
  expect(mockFetch).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('retains a same-subject draft, photo, pin and request id through offline and Convex reconnection', async () => {
  const approved = mockAccount;
  mockCreate.mockRejectedValueOnce(new Error('Connection lost.')).mockResolvedValueOnce('retried-offline-find');
  const screen = render(<SpotShopScreen />);
  await fillForm(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
  await waitFor(() => expect(screen.getByText('Connection lost.')).toBeTruthy());
  const firstRequestId = mockCreate.mock.calls[0][0].clientRequestId;

  mockOffline = true; mockAccount = undefined; mockAuthenticated = false;
  screen.rerender(<SpotShopScreen />);
  expect(screen.getByLabelText('Shop name').props.value).toBe('  Nena Store  ');
  expect(screen.getByText('Shop location pinned.')).toBeTruthy();
  expect(screen.getByText("You're offline. Some things won't work.")).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Change shop photo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save find' })).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
  expect(mockCreate).toHaveBeenCalledTimes(1);

  mockOffline = false; mockLoading = true; mockRole = null;
  screen.rerender(<SpotShopScreen />);
  expect(screen.getByText('Reconnecting your account')).toBeTruthy();
  expect(screen.getByLabelText('Shop name').props.value).toBe('  Nena Store  ');
  expect(screen.getByRole('button', { name: 'Save find' })).toBeDisabled();

  mockAccount = approved; mockLoading = false; mockAuthenticated = true; mockRole = 'creator';
  screen.rerender(<SpotShopScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/leads/retried-offline-find'));
  expect(mockCreate.mock.calls[1][0]).toEqual(expect.objectContaining({ ...pin, clientRequestId: firstRequestId }));
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it('does not grant an offline form to a subject without a previously validated approved creator', () => {
  mockOffline = true; mockAuthenticated = false; mockAccount = undefined;
  const screen = render(<SpotShopScreen />);
  expect(screen.getByText('Reconnect to find shops')).toBeTruthy();
  expect(screen.queryByLabelText('Shop name')).toBeNull();
  expect(mockCreate).not.toHaveBeenCalled();
});

it.each(['subject', 'signout'])('discards the retained draft on an explicit Clerk %s change', async (change) => {
  const approved = mockAccount;
  const screen = render(<SpotShopScreen />);
  await fillForm(screen);
  mockOffline = true; mockAccount = undefined; mockAuthenticated = false;
  screen.rerender(<SpotShopScreen />);
  expect(screen.getByLabelText('Shop name').props.value).toBe('  Nena Store  ');

  mockClerkSubject = change === 'subject' ? 'another-clerk-subject' : null;
  mockClerkSignedIn = change !== 'signout';
  screen.rerender(<SpotShopScreen />);
  expect(screen.queryByLabelText('Shop name')).toBeNull();

  mockClerkSubject = approved.clerkId; mockClerkSignedIn = true;
  screen.rerender(<SpotShopScreen />);
  expect(screen.queryByLabelText('Shop name')).toBeNull();
  mockOffline = false; mockAccount = approved; mockAuthenticated = true;
  screen.rerender(<SpotShopScreen />);
  expect(screen.getByLabelText('Shop name').props.value).toBe('');
  expect(screen.getByRole('button', { name: 'Add shop photo' })).toBeTruthy();
});

it.each(['blocked', 'approval-revoked', 'account-missing'])('drops the cached draft after an explicit %s result', async (change) => {
  const screen = render(<SpotShopScreen />);
  await fillForm(screen);
  if (change === 'blocked') mockBlocked = true;
  if (change === 'approval-revoked') mockAccount = { ...mockAccount, certifiedAt: undefined };
  if (change === 'account-missing') mockAccount = null;
  screen.rerender(<SpotShopScreen />);
  expect(screen.queryByLabelText('Shop name')).toBeNull();
  mockBlocked = false; mockOffline = true; mockAccount = undefined; mockAuthenticated = false;
  screen.rerender(<SpotShopScreen />);
  expect(screen.queryByLabelText('Shop name')).toBeNull();
  expect(mockCreate).not.toHaveBeenCalled();
});
