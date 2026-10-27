import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import SubmitInfo from '../app/(app)/submit/info';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDiscard = jest.fn();
const mockSaveCache = jest.fn();
const mockLoadCache = jest.fn();
const mockClearCache = jest.fn();
const mockCaptureRead = jest.fn();
const mockCaptureWrite = jest.fn();
const mockCaptureRemove = jest.fn();
const mockReverseGeocode = jest.fn();
let mockParams: Record<string, string>;
let mockDraft: Record<string, unknown> | null | undefined;
let mockOnline: boolean | null;
let mockCreator: Record<string, unknown>;
let mockCurrent: boolean;

jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => ({ account: mockCreator,
  isAuthenticated: true, isOffline: mockOnline === false, role: 'creator', isPreview: false }) }));
jest.mock('@clerk/clerk-expo', () => ({ useUser: () => ({ user: { id: 'clerk-mika' }, isLoaded: true, isSignedIn: true }) }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockOnline }) }));
jest.mock('../hooks/useFormDraftCache', () => ({ useFormDraftCache: () => ({
  saveDraft: mockSaveCache, loadDraft: mockLoadCache, clearDraft: mockClearCache,
}) }));
jest.mock('../hooks/useCaptureSession', () => ({ useCaptureSession: () => {
  const actorId = mockCreator._id;
  return {
    actor: { creatorId: actorId, clerkId: 'clerk-mika' }, actorKey: `clerk-mika:${actorId}`,
    isReady: true, isOffline: mockOnline === false, canQuery: mockOnline !== false,
    isCurrent: () => mockCurrent && mockCreator._id === actorId,
    canMutate: () => mockCurrent && mockCreator._id === actorId && mockOnline !== false,
    read: mockCaptureRead, write: mockCaptureWrite, remove: mockCaptureRemove,
  };
} }));
jest.mock('@tendso/convex-client', () => ({ api: {
  creators: { getByClerkId: 'creators:getByClerkId' },
  submissions: { getDraftByCreatorId: 'submissions:getDraftByCreatorId', create: 'submissions:create',
    update: 'submissions:update', remove: 'submissions:remove' },
} }));
jest.mock('convex/react', () => ({
  useQuery: (reference: string) => reference === 'creators:getByClerkId' ? mockCreator : mockDraft,
  useMutation: (reference: string) => reference === 'submissions:create' ? mockCreate
    : reference === 'submissions:update' ? mockUpdate : mockDiscard,
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}), removeItem: jest.fn(async () => {}),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-location', () => ({
  geocodeAsync: jest.fn(async () => []),
  reverseGeocodeAsync: (...args: unknown[]) => mockReverseGeocode(...args),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getCurrentPositionAsync: jest.fn(), Accuracy: { High: 4 },
}));
jest.mock('react-native-maps', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return { __esModule: true,
    default: ReactModule.forwardRef((props: any, ref: unknown) => {
      ReactModule.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
      return ReactModule.createElement(View, props, props.children);
    }), Marker: (props: any) => ReactModule.createElement(View, props), PROVIDER_GOOGLE: 'google' };
});
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop' }));

const source = { prospectLeadId: 'lead-nena', businessName: 'Nena’s Eatery', phone: '+63 917 123 4567',
  address: '12 J.P. Rizal St', city: 'Marikina', category: 'Local restaurant' };
const draft = { _id: 'draft-ramon', creatorId: 'agent-mika', businessName: 'Ramon’s Barber', businessType: 'Barber/Salon',
  ownerName: 'Ramon Cruz', ownerPhone: '9181234567', ownerEmail: '', address: '10 Main St', city: 'Marikina' };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {}; mockDraft = null; mockOnline = true;
  mockCurrent = true;
  mockCreator = { _id: 'agent-mika', clerkId: 'clerk-mika', role: 'creator', certifiedAt: 10 };
  mockCreate.mockReset().mockResolvedValue('new-submission');
  mockUpdate.mockReset().mockResolvedValue(undefined);
  mockDiscard.mockReset().mockResolvedValue(undefined);
  mockLoadCache.mockReset().mockResolvedValue(null);
  mockClearCache.mockReset().mockResolvedValue(undefined);
  mockCaptureRead.mockReset().mockResolvedValue(null);
  mockCaptureWrite.mockReset().mockResolvedValue(undefined);
  mockCaptureRemove.mockReset().mockResolvedValue(undefined);
  mockReverseGeocode.mockReset().mockResolvedValue([{ streetNumber: '18', street: 'River St', district: 'San Roque', city: 'Marikina' }]);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

async function completePrefilled(screen: ReturnType<typeof render>) {
  await waitFor(() => expect(screen.getByLabelText('Business name').props.value).toBe(source.businessName));
  fireEvent.changeText(screen.getByLabelText('Owner’s full name'), 'Nena Cruz');
}
async function next(screen: ReturnType<typeof render>) {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to photos step' })).not.toBeDisabled());
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Continue to photos step' })); });
}

it('preserves real prospect details, normalizes its phone and never invents an owner identity', async () => {
  mockParams = source;
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByLabelText('Business name').props.value).toBe(source.businessName));
  expect(screen.getByLabelText('Owner’s mobile').props.value).toBe('9171234567');
  expect(screen.getByLabelText('Address').props.value).toBe(source.address);
  expect(screen.getByLabelText('City').props.value).toBe(source.city);
  expect(screen.getByLabelText('Owner’s full name').props.value).toBe('');
  expect(screen.getByLabelText('Owner’s email (optional)').props.value).toBe('');
  expect(screen.getByRole('button', { name: 'Restaurant' }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByRole('button', { name: 'Clinic' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Law Office' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Craft/Producer' })).toBeTruthy();
});

it('creates one properly linked interview then advances to the photos step', async () => {
  mockParams = source;
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen); await next(screen);
  expect(mockCreate).toHaveBeenCalledWith({ creatorId: 'agent-mika', prospectLeadId: source.prospectLeadId,
    businessName: source.businessName, businessType: 'Restaurant', ownerName: 'Nena Cruz', ownerPhone: '9171234567',
    ownerEmail: undefined, address: source.address, city: source.city });
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockCaptureWrite).toHaveBeenCalledWith('current_submission_id', 'new-submission');
  expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submit/photos');
});

it('does not silently guess an unknown business category', async () => {
  mockParams = { ...source, category: 'Unrecognized venue' };
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen); await next(screen);
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Other' }));
  await next(screen);
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ businessType: 'Other' }));
});

it('resumes an existing draft and updates its identity instead of creating another interview', async () => {
  mockDraft = draft;
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByLabelText('Owner’s full name').props.value).toBe('Ramon Cruz'));
  await next(screen);
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: draft._id, businessName: draft.businessName }));
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockLoadCache).not.toHaveBeenCalled();
});

it('lets the field agent continue the other draft without attaching the declined shop’s lead', async () => {
  mockParams = source; mockDraft = draft;
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Finish your other interview?', expect.any(String), expect.any(Array)));
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () => { buttons[0].onPress(); });
  await next(screen);
  expect(mockDiscard).not.toHaveBeenCalled();
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: draft._id, businessName: draft.businessName }));
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('prospectLeadId');
});

it('keeps required-field validation before any save or navigation', async () => {
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to photos step' })).not.toBeDisabled());
  await next(screen);
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(screen.getByText('Please fill in all required fields')).toBeTruthy();
});

it('preserves community attribution in the offline payload without making a remote write', async () => {
  mockOnline = false; mockParams = source; mockDraft = undefined;
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen); await next(screen);
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockCaptureWrite).toHaveBeenCalledWith('submission_pending_sync', expect.objectContaining({
    creatorId: 'agent-mika', prospectLeadId: source.prospectLeadId, existingDraftId: null,
    formData: expect.objectContaining({ businessName: source.businessName, ownerName: 'Nena Cruz' }),
  }));
  expect(mockCaptureWrite).toHaveBeenCalledWith('current_submission_id', 'offline_pending');
  expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submit/photos');
});

it('restores the pending offline details when returning from photos after the form cache was cleared', async () => {
  mockOnline = false; mockDraft = undefined;
  mockCaptureRead.mockImplementation(async (key: string) => key === 'submission_pending_sync'
    ? { creatorId: 'agent-mika', prospectLeadId: 'lead-nena', existingDraftId: null,
      formData: { businessName: source.businessName, businessType: 'Restaurant', ownerName: 'Nena Cruz',
        ownerPhone: '9171234567', address: source.address, city: source.city } }
    : key === 'current_submission_id' ? 'offline_pending' : null);
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByLabelText('Owner’s full name').props.value).toBe('Nena Cruz'));
  expect(screen.getByLabelText('Business name').props.value).toBe(source.businessName);
  await next(screen);
  expect(mockCaptureWrite).toHaveBeenCalledWith('submission_pending_sync', expect.objectContaining({
    creatorId: 'agent-mika', prospectLeadId: 'lead-nena', formData: expect.objectContaining({ ownerName: 'Nena Cruz' }),
  }));
  expect(mockCreate).not.toHaveBeenCalled();
});

it('does not overwrite the previous interview if discarding it fails', async () => {
  mockParams = source; mockDraft = draft;
  mockDiscard.mockRejectedValueOnce(new Error('Could not discard this draft.'));
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () => { await buttons[1].onPress(); });
  expect(screen.getByLabelText('Business name').props.value).toBe(draft.businessName);
  expect(screen.getByText('Could not discard this draft.')).toBeTruthy();
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockCaptureRemove).not.toHaveBeenCalled();
});

it('uses a new draft after a confirmed discard even while the old query snapshot remains', async () => {
  mockParams = source; mockDraft = draft;
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
  await act(async () => { await buttons[1].onPress(); });
  await completePrefilled(screen); await next(screen);
  expect(mockDiscard).toHaveBeenCalledWith({ id: draft._id });
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ businessName: source.businessName, prospectLeadId: source.prospectLeadId }));
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockCaptureRemove).toHaveBeenCalledWith('submission_pending_photos');
  expect(mockCaptureRemove).toHaveBeenCalledWith('submission_pending_interview');
});

it('deduplicates rapid continues before the first create finishes', async () => {
  mockParams = source;
  let finish!: (id: string) => void;
  mockCreate.mockReturnValueOnce(new Promise<string>((resolve) => { finish = resolve; }));
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen);
  const button = screen.getByRole('button', { name: 'Continue to photos step' });
  act(() => { fireEvent.press(button); fireEvent.press(button); });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  await act(async () => { finish('new-submission'); });
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
});

it('does not write a saved id or navigate after the capture account changes mid-save', async () => {
  mockParams = source;
  let finish!: (id: string) => void;
  mockCreate.mockReturnValueOnce(new Promise<string>((resolve) => { finish = resolve; }));
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen);
  act(() => { fireEvent.press(screen.getByRole('button', { name: 'Continue to photos step' })); });
  mockCurrent = false;
  await act(async () => { finish('new-submission'); });
  expect(mockCaptureWrite).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it('confirms a map pin and suggested address into the existing capture API and owned form cache', async () => {
  mockParams = source;
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Choose on map' }));
  expect(screen.getByRole('button', { name: 'Use this location' })).toBeDisabled();
  await act(async () => { fireEvent.press(screen.getByTestId('capture-location-map'), {
    nativeEvent: { coordinate: { latitude: 14.65, longitude: 121.1 } },
  }); });
  await waitFor(() => expect(screen.getByLabelText('Shop address').props.value).toBe('18 River St, San Roque'));
  fireEvent.press(screen.getByRole('button', { name: 'Use this location' }));
  expect(screen.queryByTestId('capture-location-map')).toBeNull();
  expect(screen.getByLabelText('Address').props.value).toBe('18 River St, San Roque');
  expect(mockSaveCache).toHaveBeenLastCalledWith(expect.objectContaining({ coordinates: { lat: 14.65, lng: 121.1 } }));
  await next(screen);
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ address: '18 River St, San Roque', city: 'Marikina',
    coordinates: { lat: 14.65, lng: 121.1 }, prospectLeadId: source.prospectLeadId }));
  expect(mockCaptureWrite).toHaveBeenCalledWith('submission_snapshot', expect.objectContaining({ coordinates: { lat: 14.65, lng: 121.1 } }));
});

it('canceling map edits keeps the original manual address and real source pin', async () => {
  mockParams = { ...source, latitude: '14.651', longitude: '121.101' };
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Edit map location' }));
  expect(screen.getByTestId('capture-location-pin').props.coordinate).toEqual({ latitude: 14.651, longitude: 121.101 });
  fireEvent.changeText(screen.getByLabelText('Shop address'), 'Unconfirmed address');
  fireEvent.press(screen.getAllByRole('button', { name: 'Back' }).at(-1)!);
  expect(screen.getByLabelText('Address').props.value).toBe(source.address);
  await next(screen);
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ address: source.address, coordinates: { lat: 14.651, lng: 121.101 } }));
});

it('retains an existing draft pin when its manually typed address is corrected', async () => {
  mockDraft = { ...draft, coordinates: { lat: 14.6, lng: 121.2 } };
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByLabelText('Address').props.value).toBe(draft.address));
  fireEvent.changeText(screen.getByLabelText('Address'), 'Corrected unit 2, 10 Main St');
  await next(screen);
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: draft._id,
    address: 'Corrected unit 2, 10 Main St', coordinates: { lat: 14.6, lng: 121.2 } }));
});

it('saves an offline chosen pin with the queued details and restores it on returning to Info', async () => {
  mockOnline = false; mockDraft = undefined; mockParams = source;
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Choose on map' }));
  fireEvent.press(screen.getByTestId('capture-location-map'), { nativeEvent: { coordinate: { latitude: 14.7, longitude: 121.3 } } });
  fireEvent.press(screen.getByRole('button', { name: 'Use this location' }));
  await next(screen);
  const pending = mockCaptureWrite.mock.calls.find(([key]) => key === 'submission_pending_sync')![1];
  expect(pending.formData).toEqual(expect.objectContaining({ coordinates: { lat: 14.7, lng: 121.3 }, address: source.address }));
  expect(mockReverseGeocode).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled();
  screen.unmount(); mockParams = {};
  mockCaptureRead.mockImplementation(async (key: string) => key === 'submission_pending_sync' ? pending
    : key === 'current_submission_id' ? 'offline_pending' : null);
  const reopened = render(<SubmitInfo />);
  await waitFor(() => expect(reopened.getByRole('button', { name: 'Edit map location' })).toBeTruthy());
  fireEvent.press(reopened.getByRole('button', { name: 'Edit map location' }));
  expect(reopened.getByTestId('capture-location-pin').props.coordinate).toEqual({ latitude: 14.7, longitude: 121.3 });
});

it('does not fabricate a pin from incomplete or invalid source coordinates', async () => {
  mockParams = { ...source, latitude: 'NaN', longitude: '121.1' };
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen);
  expect(screen.getByRole('button', { name: 'Choose on map' })).toBeTruthy();
  await next(screen);
  expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('coordinates');
});
