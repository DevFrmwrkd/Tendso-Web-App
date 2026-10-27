import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import SubmitInfo from '../app/(app)/submit/info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fieldAgentPriceKey } from '../services/fieldAgentPrice';

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
const mockQuery = jest.fn();
let mockParams: Record<string, string | string[]>;
let mockDraft: Record<string, unknown> | null | undefined;
let mockRequestedDrafts: Record<string, Record<string, unknown> | null | undefined>;
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
  submissions: { getDraftByCreatorId: 'submissions:getDraftByCreatorId', getById: 'submissions:getById', create: 'submissions:create',
    update: 'submissions:update', remove: 'submissions:remove' },
} }));
jest.mock('convex/react', () => ({
  useQuery: (reference: string, args: 'skip' | Record<string, string>) => {
    mockQuery(reference, args);
    if (args === 'skip') return undefined;
    if (reference === 'creators:getByClerkId') return mockCreator;
    if (reference === 'submissions:getById') return mockRequestedDrafts[args.id] ?? null;
    return mockDraft;
  },
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
  ownerName: 'Ramon Cruz', ownerPhone: '9181234567', ownerEmail: 'ramon@example.com', address: '10 Main St', city: 'Marikina' };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {}; mockDraft = null; mockRequestedDrafts = {}; mockOnline = true;
  mockCurrent = true;
  jest.mocked(AsyncStorage.getItem).mockReset().mockResolvedValue(null);
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
  fireEvent.changeText(screen.getByLabelText('Owner’s email'), ' nena@example.com ');
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
  expect(screen.getByLabelText('Owner’s email').props.value).toBe('');
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
    ownerEmail: 'nena@example.com', address: source.address, city: source.city, amount: 999, creatorPayout: 500 });
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

it.each([
  ['', 'Enter the owner’s email address.'],
  ['   ', 'Enter the owner’s email address.'],
  ['nena', 'Enter a valid email address for the owner.'],
  ['nena@', 'Enter a valid email address for the owner.'],
  ['nena @example.com', 'Enter a valid email address for the owner.'],
])('blocks a missing or invalid owner email (%s) before any remote or queued save', async (email, message) => {
  mockParams = source;
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen);
  fireEvent.changeText(screen.getByLabelText('Owner’s email'), email);
  await next(screen);
  expect(screen.getByText(message)).toBeTruthy();
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockCaptureWrite).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Owner’s email'), 'Nena+shop@example.com');
  expect(screen.queryByText(message)).toBeNull();
  await next(screen);
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ ownerEmail: 'Nena+shop@example.com' }));
});

it('requires email when continuing offline while preserving the unfinished form cache', async () => {
  mockParams = source; mockOnline = false; mockDraft = undefined;
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen);
  fireEvent.changeText(screen.getByLabelText('Owner’s email'), '');
  await next(screen);
  expect(screen.getByText('Enter the owner’s email address.')).toBeTruthy();
  expect(mockSaveCache).toHaveBeenLastCalledWith(expect.objectContaining({ ownerEmail: '', businessName: source.businessName }));
  expect(mockCaptureWrite).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Owner’s email'), ' nena@example.com ');
  await next(screen);
  expect(mockCaptureWrite).toHaveBeenCalledWith('submission_pending_sync', expect.objectContaining({
    formData: expect.objectContaining({ ownerEmail: 'nena@example.com' }),
  }));
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
  expect(screen.getByText('Enter the owner’s email address.')).toBeTruthy();
  expect(mockCaptureWrite).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Owner’s email'), 'nena@example.com');
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
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
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
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
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

const olderDraftId = 'j123456789012345678901234567890';
const newerDraftId = 'j123456789012345678901234567891';

it('freezes the saved field-agent price only on a new capture and preserves it through a failed-create retry', async () => {
  mockParams = source;
  const priceKey = fieldAgentPriceKey({ clerkId: 'clerk-mika', creatorId: 'agent-mika' });
  jest.mocked(AsyncStorage.getItem).mockImplementation(async key => key === priceKey ? '2999' : null);
  mockCreate.mockRejectedValueOnce(new Error('Temporary create failure'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen); await next(screen);
  expect(screen.getByText('Temporary create failure')).toBeTruthy();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('4999');
  await next(screen);
  expect(mockCreate).toHaveBeenCalledTimes(2);
  for (const [args] of mockCreate.mock.calls) expect(args).toMatchObject({ amount: 2999, creatorPayout: 1500 });
  expect(mockCaptureWrite).toHaveBeenCalledWith('submission_snapshot', expect.objectContaining({ initialSellPrice: 2999 }));
});

it('does not reprice an existing draft or its domain when the future default changes', async () => {
  mockDraft = { ...draft, amount: 2449, domainCostPHP: 450, submissionType: 'with_custom_domain' };
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('4999');
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByLabelText('Owner’s full name').props.value).toBe(draft.ownerName));
  await next(screen);
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('amount');
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('creatorPayout');
  expect(mockCaptureWrite).toHaveBeenCalledWith('submission_snapshot', expect.objectContaining({ initialSellPrice: 1999 }));
  expect(AsyncStorage.getItem).not.toHaveBeenCalled();
});

it('saves the initial default on a new offline capture and retains that choice when the cached capture resumes', async () => {
  mockOnline = false; mockDraft = undefined; mockParams = source;
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('3999');
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen); await next(screen);
  const pending = mockCaptureWrite.mock.calls.find(([key]) => key === 'submission_pending_sync')![1];
  expect(pending.initialSellPrice).toBe(3999);
  expect(mockCreate).not.toHaveBeenCalled();
  screen.unmount(); mockParams = {}; mockCaptureWrite.mockClear();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('4999');
  mockCaptureRead.mockImplementation(async (key: string) => key === 'submission_pending_sync' ? pending
    : key === 'current_submission_id' ? 'offline_pending' : null);
  const reopened = render(<SubmitInfo />);
  await waitFor(() => expect(reopened.getByLabelText('Owner’s full name').props.value).toBe('Nena Cruz'));
  await next(reopened);
  expect(mockCaptureWrite).toHaveBeenCalledWith('submission_pending_sync', expect.objectContaining({ initialSellPrice: 3999 }));
});

it('reports an unreadable preference without creating a capture at a silently substituted price', async () => {
  mockParams = source;
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('Storage unavailable'));
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen); await next(screen);
  expect(screen.getByText('Could not load your capture price. Try again.')).toBeTruthy();
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockCaptureWrite).not.toHaveBeenCalled();
});

it('does not create or cache a capture when its actor changes while the initial price loads', async () => {
  mockParams = source;
  let finish!: (value: string) => void;
  jest.mocked(AsyncStorage.getItem).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const screen = render(<SubmitInfo />);
  await completePrefilled(screen);
  fireEvent.press(screen.getByRole('button', { name: 'Continue to photos step' }));
  await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
  mockCurrent = false;
  await act(async () => { finish('4999'); });
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockCaptureWrite).not.toHaveBeenCalled();
});

it('repairs the exact older owned draft without loading the newest draft or discarding its media', async () => {
  mockParams = { draftId: olderDraftId, ...source };
  mockDraft = { ...draft, _id: newerDraftId, businessName: 'Newer shop', status: 'draft' };
  mockRequestedDrafts[olderDraftId] = { ...draft, _id: olderDraftId, status: 'draft', ownerEmail: '', prospectLeadId: 'original-lead' };
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByLabelText('Business name').props.value).toBe(draft.businessName));
  expect(screen.getByLabelText('Owner’s email').props.value).toBe('');
  expect(Alert.alert).not.toHaveBeenCalled(); expect(mockLoadCache).not.toHaveBeenCalled();
  expect(mockQuery.mock.calls.filter(([reference, args]) => reference === 'submissions:getDraftByCreatorId' && args !== 'skip')).toEqual([]);
  fireEvent.changeText(screen.getByLabelText('Owner’s email'), ' fixed@example.com ');
  await next(screen);
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: olderDraftId, ownerEmail: 'fixed@example.com', prospectLeadId: 'original-lead' }));
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockDiscard).not.toHaveBeenCalled();
  expect(mockCaptureWrite).toHaveBeenCalledWith('current_submission_id', olderDraftId);
  expect(mockCaptureRemove.mock.calls.map(([key]) => key)).toEqual(['submission_pending_sync']);
});

it.each([
  null,
  { ...draft, creatorId: 'another-agent', status: 'draft' },
  { ...draft, status: 'submitted' },
])('rejects an unavailable, foreign or already-sent explicit draft without changing caches: %j', async (record) => {
  mockParams = { draftId: olderDraftId };
  mockDraft = { ...draft, _id: newerDraftId, status: 'draft' };
  mockRequestedDrafts[olderDraftId] = record && { ...record, _id: olderDraftId };
  mockLoadCache.mockResolvedValue(draft);
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByText('Capture unavailable')).toBeTruthy());
  expect(screen.queryByLabelText('Business name')).toBeNull();
  expect(mockCaptureWrite).not.toHaveBeenCalled(); expect(mockCaptureRemove).not.toHaveBeenCalled();
  expect(mockSaveCache).not.toHaveBeenCalled(); expect(mockLoadCache).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled(); expect(mockDiscard).not.toHaveBeenCalled();
});

it.each([{ draftId: '' }, { draftId: 'not-a-submission-id' }, { draftId: ['one', 'two'] }])('never queries a malformed explicit draft ID: %j', async ({ draftId }) => {
  mockParams = { draftId };
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByText('Capture unavailable')).toBeTruthy());
  expect(mockQuery.mock.calls.filter(([reference, args]) => reference.startsWith('submissions:') && args !== 'skip')).toEqual([]);
  expect(mockCaptureWrite).not.toHaveBeenCalled(); expect(mockCaptureRemove).not.toHaveBeenCalled();
});

it.each([olderDraftId, 'offline_pending'])('repairs only the matching owned offline pending capture %s', async (target) => {
  mockOnline = false; mockParams = { draftId: target };
  const pending = { creatorId: 'agent-mika', existingDraftId: target === 'offline_pending' ? null : target,
    formData: { ...draft, ownerEmail: '' }, prospectLeadId: 'original-lead' };
  mockCaptureRead.mockImplementation(async (key: string) => key === 'submission_pending_sync' ? pending
    : key === 'current_submission_id' ? target : null);
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByLabelText('Business name').props.value).toBe(draft.businessName));
  fireEvent.changeText(screen.getByLabelText('Owner’s email'), 'fixed@example.com');
  await next(screen);
  expect(mockCaptureWrite).toHaveBeenCalledWith('submission_pending_sync', expect.objectContaining({
    creatorId: 'agent-mika', existingDraftId: target === 'offline_pending' ? null : target,
    formData: expect.objectContaining({ ownerEmail: 'fixed@example.com' }), prospectLeadId: 'original-lead',
  }));
  expect(mockCaptureWrite).toHaveBeenCalledWith('current_submission_id', target);
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockCaptureRemove).not.toHaveBeenCalled();
});

it('recovers an exact owned offline snapshot without falling back to an untagged cached form', async () => {
  mockOnline = false; mockParams = { draftId: olderDraftId };
  mockLoadCache.mockResolvedValue({ ...draft, businessName: 'Unrelated local draft' });
  mockCaptureRead.mockImplementation(async (key: string) => key === 'submission_snapshot'
    ? { ...draft, creatorId: 'agent-mika', submissionId: olderDraftId } : null);
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByLabelText('Business name').props.value).toBe(draft.businessName));
  expect(mockLoadCache).not.toHaveBeenCalled();
  await next(screen);
  expect(mockCaptureWrite).toHaveBeenCalledWith('submission_pending_sync', expect.objectContaining({ existingDraftId: olderDraftId }));
  expect(mockCaptureRemove).not.toHaveBeenCalled();
});

it.each([
  { pending: { creatorId: 'another-agent', existingDraftId: olderDraftId, formData: draft }, snapshot: null },
  { pending: { creatorId: 'agent-mika', existingDraftId: newerDraftId, formData: draft }, snapshot: null },
  { pending: null, snapshot: { ...draft, creatorId: 'agent-mika', submissionId: newerDraftId } },
  { pending: null, snapshot: { ...draft, creatorId: 'another-agent', submissionId: olderDraftId } },
])('does not replace an offline exact draft with another actor or target’s cached capture: %j', async ({ pending, snapshot }) => {
  mockOnline = false; mockParams = { draftId: olderDraftId };
  mockLoadCache.mockResolvedValue(draft);
  mockCaptureRead.mockImplementation(async (key: string) => key === 'submission_pending_sync' ? pending
    : key === 'submission_snapshot' ? snapshot : key === 'current_submission_id' ? olderDraftId : null);
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByText('Capture unavailable')).toBeTruthy());
  expect(screen.queryByLabelText('Business name')).toBeNull(); expect(mockSaveCache).not.toHaveBeenCalled();
  expect(mockCaptureWrite).not.toHaveBeenCalled(); expect(mockCaptureRemove).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
});

it('remounts the form when an explicit draft target changes', async () => {
  mockParams = { draftId: olderDraftId };
  mockRequestedDrafts = {
    [olderDraftId]: { ...draft, _id: olderDraftId, status: 'draft' },
    [newerDraftId]: { ...draft, _id: newerDraftId, status: 'draft', businessName: 'Second owned shop' },
  };
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByLabelText('Business name').props.value).toBe(draft.businessName));
  mockParams = { draftId: newerDraftId }; screen.rerender(<SubmitInfo />);
  await waitFor(() => expect(screen.getByLabelText('Business name').props.value).toBe('Second owned shop'));
  await next(screen);
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: newerDraftId, businessName: 'Second owned shop' }));
});

it('reopens the exact owned draft after reconnecting when no matching offline snapshot was available', async () => {
  mockOnline = false; mockParams = { draftId: olderDraftId };
  const screen = render(<SubmitInfo />);
  await waitFor(() => expect(screen.getByText('Capture unavailable')).toBeTruthy());
  expect(mockCaptureWrite).not.toHaveBeenCalled(); expect(mockCaptureRemove).not.toHaveBeenCalled();
  mockOnline = true; mockRequestedDrafts[olderDraftId] = { ...draft, _id: olderDraftId, status: 'draft' };
  screen.rerender(<SubmitInfo />);
  await waitFor(() => expect(screen.getByLabelText('Business name').props.value).toBe(draft.businessName));
  expect(screen.queryByText('Capture unavailable')).toBeNull();
  expect(mockCaptureRemove).not.toHaveBeenCalled();
});
