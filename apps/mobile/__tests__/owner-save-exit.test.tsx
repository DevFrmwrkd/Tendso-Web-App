import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import { OwnerSaveExit } from '../components/v2/owner/OwnerSaveExit';
import { ownerIntake } from '../lib/v2/ownerIntake';
import { uploadQueue } from '../lib/v2/uploadQueue';
import { STEP_ROUTE } from '../lib/v2/ownerFlow';
import type { OwnerMe, SiteSummary, SubmissionId } from '../lib/v2/ownerTypes';

const mockRouter = { dismissTo: jest.fn() };
let mockSubject = 'owner-a';
let mockConnected = true;
let mockMe: OwnerMe;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject }) }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../lib/v2/ownerData', () => ({
  useOwnerMe: () => mockMe,
  newestSite: (me: OwnerMe | undefined) => [...(me?.sites ?? [])].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
}));

const a = 'draft-a' as SubmissionId;
const b = 'draft-b' as SubmissionId;
function site(submissionId: SubmissionId, businessName: string): SiteSummary {
  return { submissionId, businessName, businessType: 'Other', contentSource: 'owner_app', publishPolicy: 'pay_then_publish',
    status: 'draft', phase: 'draft', publishedUrl: null, total: 4999, amountPaid: 0, balanceDue: 4999,
    paidInFull: false, openChangeRequests: 0, createdAt: 1 };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(async () => {
  jest.restoreAllMocks(); jest.clearAllMocks();
  mockSubject = 'owner-a'; mockConnected = true;
  mockMe = { owner: { _id: 'db-owner-a', email: 'owner-a@example.test', name: 'Pablo', phone: null },
    sites: [site(a, 'First shop'), site(b, 'Second shop')] };
  await AsyncStorage.clear();
  await ownerIntake.bindActor(mockSubject);
  ownerIntake.clear();
  ownerIntake.selectBusiness(a);
  ownerIntake.set({ kind: 'barber', businessName: 'First shop', address: 'First Street',
    how: 'friend', howConfirmedFor: a, shots: ['file://first.jpg'], design: 'business:CA',
    uploads: [{ kind: 'answer', submissionId: a, index: 0, uri: 'file://answer.m4a',
      mediaType: 'audio', lang: 'en', durationSec: 8 }] });
  await ownerIntake.flush();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('waits for the local save before returning to Today and deduplicates rapid taps', async () => {
  const persisted = deferred();
  const flush = jest.spyOn(ownerIntake, 'flush').mockReturnValueOnce(persisted.promise);
  const screen = render(<OwnerSaveExit />);
  const button = screen.getByRole('button', { name: 'Save & exit' });
  fireEvent.press(button); fireEvent.press(button);
  expect(flush).toHaveBeenCalledTimes(1);
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  await act(async () => persisted.resolve());
  expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);
  expect(mockRouter.dismissTo).toHaveBeenCalledWith(STEP_ROUTE.home);
});

it('can exit offline while retaining recordings for upload and every business’s saved work', async () => {
  mockConnected = false;
  ownerIntake.selectBusiness(b);
  ownerIntake.set({ kind: 'food', businessName: 'Second shop', address: 'Second Street',
    shots: ['file://second.jpg'], design: 'business:CJ' });
  ownerIntake.selectBusiness(a);
  const clear = jest.spyOn(ownerIntake, 'clear');
  const drain = jest.spyOn(uploadQueue, 'drain');
  const screen = render(<OwnerSaveExit />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save & exit' })); });
  expect(mockRouter.dismissTo).toHaveBeenCalledWith(STEP_ROUTE.home);
  expect(clear).not.toHaveBeenCalled(); expect(drain).not.toHaveBeenCalled();
  screen.unmount();
  // Rebinding discards the in-memory workspace and reloads this login’s disk cache.
  await ownerIntake.bindActor('different-owner');
  await ownerIntake.bindActor('owner-a');
  expect(ownerIntake.get()).toMatchObject({ submissionId: a, businessName: 'First shop',
    how: 'friend', howConfirmedFor: a, shots: ['file://first.jpg'], design: 'business:CA',
    uploads: [{ submissionId: a, uri: 'file://answer.m4a' }] });
  ownerIntake.selectBusiness(b);
  expect(ownerIntake.get()).toMatchObject({ submissionId: b, businessName: 'Second shop',
    shots: ['file://second.jpg'], design: 'business:CJ' });
});

it('keeps a not-yet-created business and its setup key so it can resume from Today', async () => {
  ownerIntake.beginBusiness();
  ownerIntake.set({ kind: 'repair', businessName: 'New Garage', address: 'Typed address',
    detailsDirty: ['businessName', 'address'] });
  const key = ownerIntake.get().newBusinessKey;
  const screen = render(<OwnerSaveExit />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save & exit' })); });
  expect(mockRouter.dismissTo).toHaveBeenCalledWith(STEP_ROUTE.home);
  screen.unmount();
  await ownerIntake.bindActor('different-owner');
  await ownerIntake.bindActor('owner-a');
  expect(ownerIntake.get()).toMatchObject({ newBusiness: true, newBusinessKey: key,
    kind: 'repair', businessName: 'New Garage', address: 'Typed address', detailsDirty: ['businessName', 'address'] });
  expect(ownerIntake.get().submissionId).toBeUndefined();
});

it('stays on the current step when saving fails and lets the owner retry', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('Storage is full'));
  const screen = render(<OwnerSaveExit />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save & exit' })); });
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(ownerIntake.get().businessName).toBe('First shop');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save & exit' })); });
  expect(mockRouter.dismissTo).toHaveBeenCalledWith(STEP_ROUTE.home);
});

it('does not exit while the current step has an operation in flight', async () => {
  let allowed = false;
  const flush = jest.spyOn(ownerIntake, 'flush');
  const screen = render(<OwnerSaveExit canExit={() => allowed} />);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save & exit' })); });
  expect(flush).not.toHaveBeenCalled(); expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  allowed = true;
  screen.rerender(<OwnerSaveExit disabled canExit={() => allowed} />);
  expect(screen.getByRole('button', { name: 'Save & exit' })).toBeDisabled();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save & exit' })); });
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
});

it('does not interrupt Next if it starts while Save & exit is waiting for disk', async () => {
  const persisted = deferred();
  jest.spyOn(ownerIntake, 'flush').mockReturnValueOnce(persisted.promise);
  let allowed = true;
  const screen = render(<OwnerSaveExit canExit={() => allowed} />);
  fireEvent.press(screen.getByRole('button', { name: 'Save & exit' }));
  allowed = false;
  await act(async () => persisted.resolve());
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
});

it('invalidates exit on blur and keeps a newer save active when the old save finishes after refocus', async () => {
  const oldSave = deferred(); const nextSave = deferred();
  const flush = jest.spyOn(ownerIntake, 'flush')
    .mockReturnValueOnce(oldSave.promise).mockReturnValueOnce(nextSave.promise);
  let focused = true;
  const listeners = new Map<string, Set<() => void>>();
  const navigation = {
    isFocused: () => focused,
    addListener: (event: string, listener: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return () => { listeners.get(event)?.delete(listener); };
    },
  } as unknown as NonNullable<React.ContextType<typeof NavigationContext>>;
  const screen = render(<NavigationContext.Provider value={navigation}><OwnerSaveExit /></NavigationContext.Provider>);
  fireEvent.press(screen.getByRole('button', { name: 'Save & exit' }));
  expect(flush).toHaveBeenCalledTimes(1);
  act(() => { focused = false; listeners.get('blur')?.forEach(listener => listener()); });
  act(() => { focused = true; listeners.get('focus')?.forEach(listener => listener()); });
  fireEvent.press(screen.getByRole('button', { name: 'Save & exit' }));
  expect(flush).toHaveBeenCalledTimes(2);
  await act(async () => oldSave.resolve());
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Save & exit' })).toBeDisabled();
  await act(async () => nextSave.resolve());
  expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);
  expect(mockRouter.dismissTo).toHaveBeenCalledWith(STEP_ROUTE.home);
});

it.each(['account', 'business', 'unmount'] as const)('ignores a late save completion after %s changes', async change => {
  const persisted = deferred();
  jest.spyOn(ownerIntake, 'flush').mockReturnValueOnce(persisted.promise);
  const screen = render(<OwnerSaveExit />);
  fireEvent.press(screen.getByRole('button', { name: 'Save & exit' }));
  if (change === 'unmount') screen.unmount();
  else if (change === 'business') act(() => { ownerIntake.selectBusiness(b); });
  else {
    mockSubject = 'owner-b';
    mockMe = { owner: { ...mockMe.owner, _id: 'db-owner-b', email: 'owner-b@example.test' }, sites: [] };
    await act(async () => { await ownerIntake.bindActor(mockSubject); });
    screen.rerender(<OwnerSaveExit />);
  }
  await act(async () => persisted.resolve());
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});
