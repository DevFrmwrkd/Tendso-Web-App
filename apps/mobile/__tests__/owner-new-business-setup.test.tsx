import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Sell from '../app/(owner)/start/sell';
import Place from '../app/(owner)/start/place';
import OwnerIndex from '../app/(owner)';
import { ownerIntake } from '../lib/v2/ownerIntake';
import { STEP_ROUTE } from '../lib/v2/ownerFlow';
import type { OwnerMe, OwnerSubmission, SubmissionId } from '../lib/v2/ownerTypes';

const mockPush = jest.fn(); const mockReplace = jest.fn(); const mockBack = jest.fn(); const mockDismissTo = jest.fn();
const mockCreate = jest.fn(); const mockUpdate = jest.fn();
let mockSubject = 'owner-a'; let mockConnected = true;
let mockMe: OwnerMe;
let mockSubmissions: Record<string, OwnerSubmission | undefined>;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', PROVIDER_GOOGLE: 'google' }));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject }) }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, dismissTo: mockDismissTo, canGoBack: () => false }),
  Redirect: (props: object) => require('react').createElement(require('react-native').View, { ...props, testID: 'owner-setup-destination' }),
}));
jest.mock('../lib/v2/ownerData', () => ({
  useOwnerMe: () => mockMe,
  newestSite: (me: OwnerMe | undefined) => [...(me?.sites ?? [])].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
  useOwnerSubmission: (id: string | null) => id ? mockSubmissions[id] : undefined,
  useCreateDraft: () => mockCreate, useUpdateDraft: () => mockUpdate,
}));
jest.mock('../components/field-agent/CaptureLocationPicker', () => ({
  validCaptureCoordinates: (value: { lat?: number; lng?: number } | undefined) => Number.isFinite(value?.lat) && Number.isFinite(value?.lng),
  CaptureLocationPicker: (props: object) => require('react').createElement(require('react-native').View, { ...props, testID: 'new-business-map-picker' }),
}));

const alphaId = 'alpha-site' as SubmissionId; const betaId = 'beta-draft' as SubmissionId; const freshId = 'fresh-draft' as SubmissionId;
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);
function fixture(submissionId: SubmissionId, businessName: string, phase: 'draft' | 'live', createdAt: number): OwnerSubmission {
  return { submissionId, businessName, businessType: 'Barber/Salon', contentSource: 'owner_app', publishPolicy: 'pay_then_publish',
    status: phase === 'draft' ? 'draft' : 'approved', phase, publishedUrl: null, total: 4999, amountPaid: 0, balanceDue: 4999,
    paidInFull: false, openChangeRequests: 0, createdAt, address: `${businessName} street`, city: 'Marikina', province: null,
    barangay: null, coordinates: null, shotListKey: 'barber', interview: [], shots: [], templateId: null,
    templateIds: [], fontChoice: null, colorChoice: null, ownerApprovedAt: null, previewReadyAt: null };
}
function beginNew(name = 'Fresh food shop') {
  ownerIntake.beginBusiness();
  ownerIntake.set({ kind: 'food', businessName: name, address: '20 New Street', city: 'Pasig',
    detailsDirty: ['businessName', 'address', 'city'] });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function addCreatedSite() {
  const created = { ...fixture(freshId, 'Fresh food shop', 'draft', 100), businessType: 'Restaurant', shotListKey: 'food' };
  mockSubmissions[freshId] = created;
  mockMe = { ...mockMe, sites: [created, ...mockMe.sites] };
}
beforeEach(async () => {
  jest.clearAllMocks(); mockSubject = 'owner-a'; mockConnected = true;
  const alpha = fixture(alphaId, 'Alpha', 'live', 10); const beta = fixture(betaId, 'Beta', 'draft', 5);
  mockMe = { owner: { _id: 'db-owner-a', name: 'Ben', email: 'ben@example.test', phone: null }, sites: [alpha, beta] };
  mockSubmissions = { [alphaId]: alpha, [betaId]: beta };
  await ownerIntake.bindActor(mockSubject); ownerIntake.clear();
  ownerIntake.selectBusiness(alphaId);
  ownerIntake.set({ kind: 'barber', businessName: 'Alpha', address: 'Alpha street', city: 'Marikina', shots: ['file://alpha-photo.jpg'] });
  await ownerIntake.flush();
  mockCreate.mockReset().mockResolvedValue(freshId); mockUpdate.mockReset().mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

it('starts a new workspace at Sell, then resumes Place after choosing a kind without pressing Next', async () => {
  ownerIntake.beginBusiness();
  const screen = wrap(<OwnerIndex />);
  expect(screen.getByTestId('owner-setup-destination').props.href).toBe(STEP_ROUTE.sell);
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><Sell /></SafeAreaProvider>);
  fireEvent.press(screen.getByRole('radio', { name: 'Food' }));
  await ownerIntake.flush(); screen.unmount();
  const reopened = wrap(<OwnerIndex />);
  expect(reopened.getByTestId('owner-setup-destination').props.href).toBe(STEP_ROUTE.place);
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
});

it('cancels to the previous owned business and retains the unsaved new workspace separately', async () => {
  beginNew(); const key = ownerIntake.get().newBusinessKey;
  const screen = wrap(<Sell />);
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockDismissTo).toHaveBeenCalledWith(STEP_ROUTE.home);
  expect(ownerIntake.get()).toMatchObject({ submissionId: alphaId, businessName: 'Alpha', shots: ['file://alpha-photo.jpg'] });
  expect(ownerIntake.get().newBusiness).not.toBe(true);
  act(() => ownerIntake.beginBusiness());
  expect(ownerIntake.get()).toMatchObject({ newBusiness: true, kind: 'food', businessName: 'Fresh food shop', newBusinessKey: key });
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
});

it('uses a currently owned fallback when the previous business has been removed', () => {
  beginNew(); mockMe = { ...mockMe, sites: [mockSubmissions[betaId]!] };
  const screen = wrap(<Sell />);
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(ownerIntake.get().submissionId).toBe(betaId);
  expect(mockDismissTo).toHaveBeenCalledWith(STEP_ROUTE.home);
});

it('persists new shop text and pin edits before Next and restores them after leaving setup', async () => {
  ownerIntake.beginBusiness(); ownerIntake.set({ kind: 'food' });
  const screen = wrap(<Place />);
  fireEvent.changeText(screen.getByLabelText('Shop name'), 'New corner shop');
  fireEvent.changeText(screen.getByLabelText('Address'), 'Typed street');
  fireEvent.changeText(screen.getByLabelText('City'), 'Typed city');
  fireEvent.press(screen.getByRole('button', { name: 'Choose shop location on map' }));
  act(() => screen.getByTestId('new-business-map-picker').props.onConfirm({
    coordinates: { lat: 14.65, lng: 121.1 }, address: 'Pinned street', city: 'Pasig',
  }));
  await ownerIntake.flush(); screen.unmount();
  const reopened = wrap(<Place />);
  expect(reopened.getByDisplayValue('New corner shop')).toBeTruthy();
  expect(reopened.getByDisplayValue('Pinned street')).toBeTruthy();
  expect(reopened.getByDisplayValue('Pasig')).toBeTruthy();
  expect(reopened.getByRole('button', { name: 'Adjust shop location on map' })).toBeTruthy();
  expect(ownerIntake.get().detailsDirty).toEqual(expect.arrayContaining(['businessName', 'address', 'city', 'coordinates']));
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
});

it('keeps unsaved local fields, including deliberate empty text, across late server hydration and remount', () => {
  ownerIntake.selectBusiness(betaId); mockSubmissions[betaId] = undefined;
  const screen = wrap(<Place />);
  fireEvent.changeText(screen.getByLabelText('Shop name'), 'Local Beta');
  fireEvent.changeText(screen.getByLabelText('City'), '');
  screen.unmount();
  mockSubmissions[betaId] = { ...fixture(betaId, 'Remote Beta', 'draft', 5), address: 'New server street', city: 'Remote city' };
  const reopened = wrap(<Place />);
  expect(reopened.getByDisplayValue('Local Beta')).toBeTruthy();
  expect(reopened.getByDisplayValue('New server street')).toBeTruthy();
  expect(reopened.getByLabelText('City').props.value).toBe('');
});

it.each(['new', 'existing'] as const)('saves edited fields and exits a %s business without sending network updates', async workspace => {
  if (workspace === 'new') { ownerIntake.beginBusiness(); ownerIntake.set({ kind: 'food' }); }
  else ownerIntake.selectBusiness(betaId);
  const screen = wrap(<Place />);
  fireEvent.changeText(screen.getByLabelText('Shop name'), 'Unfinished corner shop');
  fireEvent.changeText(screen.getByLabelText('Address'), '');
  fireEvent.changeText(screen.getByLabelText('City'), 'Pasig');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save & exit' })); });
  expect(mockDismissTo).toHaveBeenCalledWith(STEP_ROUTE.home);
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(ownerIntake.get()).toMatchObject({ businessName: 'Unfinished corner shop', address: '', city: 'Pasig',
    detailsDirty: expect.arrayContaining(['businessName', 'address', 'city']) });
  screen.unmount();
  await ownerIntake.bindActor('different-owner');
  await ownerIntake.bindActor(mockSubject);
  const reopened = wrap(<Place />);
  expect(reopened.getByDisplayValue('Unfinished corner shop')).toBeTruthy();
  expect(reopened.getByLabelText('Address').props.value).toBe('');
  expect(reopened.getByDisplayValue('Pasig')).toBeTruthy();
  expect(ownerIntake.get().newBusiness === true).toBe(workspace === 'new');
});

it('updates only the selected existing draft and clears its unsaved-field marker after success', async () => {
  ownerIntake.selectBusiness(betaId);
  const screen = wrap(<Place />);
  fireEvent.changeText(screen.getByLabelText('Shop name'), 'Updated Beta');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Next' })); });
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ submissionId: betaId, businessName: 'Updated Beta' }));
  expect(ownerIntake.get().detailsDirty).toBeUndefined();
  expect(mockPush).toHaveBeenCalledWith(STEP_ROUTE.how);
  act(() => ownerIntake.selectBusiness(alphaId));
  expect(ownerIntake.get().businessName).toBe('Alpha');
  expect(ownerIntake.get().shots).toEqual(['file://alpha-photo.jpg']);
});

it('creates in the new workspace even when me.sites refreshes before the create response', async () => {
  beginNew(); const clientDraftKey = ownerIntake.get().newBusinessKey;
  const creation = deferred<SubmissionId>(); mockCreate.mockReturnValue(creation.promise);
  const screen = wrap(<Place />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Next' })); });
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ clientDraftKey, businessName: 'Fresh food shop' }));
  addCreatedSite();
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><Place /></SafeAreaProvider>);
  expect(ownerIntake.get().newBusiness).toBe(true);
  await act(async () => creation.resolve(freshId));
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ submissionId: freshId, businessName: 'Fresh food shop' }));
  expect(ownerIntake.get()).toMatchObject({ submissionId: freshId, businessName: 'Fresh food shop' });
  expect(ownerIntake.get().newBusiness).not.toBe(true);
  expect(mockPush).toHaveBeenCalledWith(STEP_ROUTE.how);
});

it('retries a lost creation acknowledgement with the same key and applies the latest typed details', async () => {
  beginNew(); const key = ownerIntake.get().newBusinessKey;
  mockCreate.mockImplementationOnce(async () => { addCreatedSite(); throw new Error('Connection dropped'); }).mockResolvedValueOnce(freshId);
  const screen = wrap(<Place />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Next' })); });
  expect(screen.getByText('Connection dropped')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Shop name'), 'Latest shop name');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Next' })); });
  expect(mockCreate).toHaveBeenCalledTimes(2);
  expect(mockCreate.mock.calls.map(([args]) => args.clientDraftKey)).toEqual([key, key]);
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ submissionId: freshId, businessName: 'Latest shop name' }));
  expect(ownerIntake.get().businessName).toBe('Latest shop name');
  expect(mockPush).toHaveBeenCalledTimes(1);
});

it('adopts a recovered business completed elsewhere without overwriting its server details', async () => {
  beginNew('Unfinished local name'); const oldKey = ownerIntake.get().newBusinessKey;
  const creation = deferred<SubmissionId>(); mockCreate.mockReturnValue(creation.promise);
  const screen = wrap(<Place />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Next' })); });
  const completed = { ...fixture(freshId, 'Completed remote business', 'live', 100), address: 'Verified server address' };
  mockSubmissions[freshId] = completed;
  mockMe = { ...mockMe, sites: [completed, ...mockMe.sites] };
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><Place /></SafeAreaProvider>);
  await act(async () => creation.resolve(freshId));
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith(STEP_ROUTE.home);
  expect(ownerIntake.get()).toMatchObject({ submissionId: freshId, businessName: 'Completed remote business' });
  expect(ownerIntake.get().newBusiness).not.toBe(true);
  expect(ownerIntake.get().address).toBeUndefined();
  expect(ownerIntake.get().detailsDirty).toBeUndefined();
  expect(mockSubmissions[freshId]?.address).toBe('Verified server address');
  act(() => ownerIntake.beginBusiness());
  expect(ownerIntake.get().newBusinessKey).not.toBe(oldKey);
  expect(ownerIntake.get().businessName).toBeUndefined();
});

it.each(['account', 'cancel', 'cancel and reopen'])('ignores a delayed create response after %s changes', async (change) => {
  beginNew(); const creation = deferred<SubmissionId>(); mockCreate.mockReturnValue(creation.promise);
  const screen = wrap(<Place />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Next' })); });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  if (change === 'account') {
    mockSubject = 'owner-b'; mockMe = { owner: { ...mockMe.owner, _id: 'db-owner-b' }, sites: [] };
    await act(async () => { await ownerIntake.bindActor(mockSubject); });
  } else act(() => {
    ownerIntake.cancelNewBusiness(alphaId);
    if (change === 'cancel and reopen') ownerIntake.beginBusiness();
  });
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><Place /></SafeAreaProvider>);
  await act(async () => creation.resolve(freshId));
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled();
  expect(ownerIntake.get().submissionId).not.toBe(freshId);
});

it('flushes the persisted creation key before making a create request', async () => {
  beginNew(); await ownerIntake.flush();
  const flushed = deferred<void>(); jest.spyOn(ownerIntake, 'flush').mockReturnValueOnce(flushed.promise);
  const screen = wrap(<Place />);
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(mockCreate).not.toHaveBeenCalled();
  addCreatedSite();
  await act(async () => flushed.resolve());
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

it('keeps offline text edits locally and never starts draft creation', () => {
  beginNew(); mockConnected = false;
  const screen = wrap(<Place />);
  fireEvent.changeText(screen.getByLabelText('Shop name'), 'Offline edit');
  const next = screen.getByRole('button', { name: 'Next' });
  expect(next).toBeDisabled(); fireEvent.press(next);
  expect(ownerIntake.get().businessName).toBe('Offline edit');
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
});
