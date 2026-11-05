import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { OwnerDraftRecovery } from '../components/v2/owner/OwnerDraftRecovery';
import { OwnerSaveExit } from '../components/v2/owner/OwnerSaveExit';
import { ownerIntake } from '../lib/v2/ownerIntake';
import type { OwnerSubmission, SubmissionId } from '../lib/v2/ownerTypes';

const mockUpdate = jest.fn(), mockProgress = jest.fn(), mockChoose = jest.fn();
const mockRouter = { dismissTo: jest.fn() };
let mockDraft: OwnerSubmission;
let mockSegments = ['(owner)', 'start', 'place'];
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: 'owner-a', sessionId: 's1' }) }));
jest.mock('expo-router', () => ({ useSegments: () => mockSegments }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: true }) }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => {
  // The real selector subscribes to intake. Preserve that behavior so scope guards refresh after a remote-conflict epoch change.
  jest.requireActual<typeof import('../lib/v2/ownerIntake')>('../lib/v2/ownerIntake').useOwnerIntake();
  return { id: mockDraft.submissionId, site: mockDraft,
    me: { owner: { _id: 'db-owner-a' }, sites: [mockDraft] }, isNewBusiness: false };
} }));
jest.mock('../lib/v2/ownerData', () => ({ useOwnerSubmission: () => mockDraft, useUpdateDraft: () => mockUpdate,
  useSaveDraftProgress: () => mockProgress, useChooseDesign: () => mockChoose }));

beforeEach(async () => {
  jest.useFakeTimers(); jest.clearAllMocks();
  mockSegments = ['(owner)', 'start', 'place'];
  mockUpdate.mockResolvedValue({ draftRevision: 3 }); mockProgress.mockResolvedValue({ draftRevision: 4 });
  mockChoose.mockResolvedValue({ draftRevision: 3 });
  mockDraft = { submissionId: 'draft-one' as SubmissionId, actorClerkId: 'owner-a', ownerId: 'db-owner-a', draftRevision: 2,
    draftProgress: { step: 'details' }, phase: 'draft', status: 'draft', businessName: 'Old shop', businessType: 'Barber/Salon',
    address: 'Old street', city: 'Marikina', shotListKey: 'barber', shots: [], interview: [], templateId: null } as unknown as OwnerSubmission;
  await ownerIntake.bindActor('owner-a', 's1'); ownerIntake.clear(); ownerIntake.selectBusiness(mockDraft.submissionId);
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it('Save & exit sends dirty details and business type to the account without pressing Next or losing pending media', async () => {
  const screen = render(<OwnerDraftRecovery><OwnerSaveExit /></OwnerDraftRecovery>);
  await act(async () => {});
  act(() => ownerIntake.set({ businessName: 'Phone Auto Care', address: '12 Updated Street', city: 'Quezon City', kind: 'repair',
    detailsDirty: ['businessName', 'address', 'city'], uploads: [{ kind: 'photo', submissionId: mockDraft.submissionId,
      index: 0, extra: false, uri: 'file://still-uploading.jpg' }] }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save & exit' })); });
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  expect(mockUpdate).toHaveBeenCalledWith({ submissionId: 'draft-one', businessName: 'Phone Auto Care',
    address: '12 Updated Street', city: 'Quezon City', businessType: 'Auto Shop', shotListKey: 'repair' });
  expect(ownerIntake.get().detailsDirty).toBeUndefined();
  expect(ownerIntake.get().uploads).toEqual([expect.objectContaining({ uri: 'file://still-uploading.jpg' })]);
  expect(ownerIntake.get().uploads![0].saved).toBeFalsy();
  expect(mockChoose).not.toHaveBeenCalled(); expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(owner)/(tabs)/today');
  screen.unmount();
});

it('Save & exit persists a locally selected design and review position while leaving the website a draft', async () => {
  mockSegments = ['(owner)', 'design']; mockDraft.templateId = 'barbershop:F';
  const screen = render(<OwnerDraftRecovery><OwnerSaveExit /></OwnerDraftRecovery>);
  await act(async () => {});
  act(() => ownerIntake.set({ design: 'barbershop:BP' }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save & exit' })); });
  expect(mockChoose).toHaveBeenCalledTimes(1);
  expect(mockChoose).toHaveBeenCalledWith({ submissionId: 'draft-one', templateId: 'barbershop:BP' });
  expect(mockProgress).toHaveBeenCalledWith(expect.objectContaining({ progress: expect.objectContaining({ step: 'review' }) }));
  expect(ownerIntake.get().design).toBe('barbershop:BP'); expect(mockDraft.status).toBe('draft');
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(owner)/(tabs)/today');
  screen.unmount();
});

it('keeps a map-only address created on the web valid when saving native draft details', async () => {
  mockDraft.address = ''; mockDraft.coordinates = { lat: 14.63, lng: 121.1 };
  const screen = render(<OwnerDraftRecovery><OwnerSaveExit /></OwnerDraftRecovery>);
  await act(async () => {});
  act(() => ownerIntake.set({ city: 'Quezon City', detailsDirty: ['city'] }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save & exit' })); });
  expect(mockUpdate).toHaveBeenCalledWith({ submissionId: 'draft-one', city: 'Quezon City' });
  expect(ownerIntake.get()).toMatchObject({ address: '', coordinates: { lat: 14.63, lng: 121.1 } });
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(owner)/(tabs)/today');
  screen.unmount();
});

it('keeps conflicting phone name and design recoverable until an explicit confirmation, then saves only those pending changes', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockDraft.templateId = 'barbershop:F';
  const content = () => <OwnerDraftRecovery><OwnerSaveExit /></OwnerDraftRecovery>;
  const screen = render(content()); await act(async () => {});
  act(() => ownerIntake.set({ businessName: 'Pending phone name', detailsDirty: ['businessName'], design: 'barbershop:BP',
    uploads: [{ kind: 'photo', submissionId: mockDraft.submissionId, index: 0, extra: false, uri: 'file://pending-phone.jpg' }] }));
  mockDraft = { ...mockDraft, draftRevision: 8, businessName: 'New web name', address: 'Latest web street' };
  await act(async () => { screen.rerender(content()); });
  expect(ownerIntake.get()).toMatchObject({ businessName: 'New web name', design: 'barbershop:F',
    remoteConflictMetadata: { businessName: 'Pending phone name', design: 'barbershop:BP' } });
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockChoose).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Use phone changes' }));
  expect(alert).toHaveBeenCalledWith('Apply this phone’s pending changes?', expect.stringContaining('shop name, design'), expect.any(Array));
  const confirmation = alert.mock.calls.at(-1)![2]!.find(button => button.text === 'Apply phone changes')!;
  await act(async () => { confirmation.onPress!(); });
  expect(ownerIntake.get().remoteConflictMetadata).toBeDefined();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save & exit' })); });
  expect(mockUpdate).toHaveBeenCalledWith({ submissionId: 'draft-one', businessName: 'Pending phone name' });
  expect(mockChoose).toHaveBeenCalledWith({ submissionId: 'draft-one', templateId: 'barbershop:BP' });
  expect(ownerIntake.get().address).toBe('Latest web street'); expect(ownerIntake.get().remoteConflictMetadata).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Use this phone’s 1 unfinished uploads' })).toBeTruthy();
  expect(ownerIntake.get().uploads).toEqual([expect.objectContaining({ pausedByRemote: true, uri: 'file://pending-phone.jpg' })]);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Continue with saved version' })); });
  expect(ownerIntake.get().uploads).toEqual([]);
  expect(screen.queryByRole('button', { name: 'Use this phone’s 1 unfinished uploads' })).toBeNull();
  screen.unmount(); alert.mockRestore();
});
