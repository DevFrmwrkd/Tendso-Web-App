import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OwnerIndex from '../app/(owner)';
import How from '../app/(owner)/start/how';
import Place from '../app/(owner)/start/place';
import TalkIntro from '../app/(owner)/talk';
import Today from '../app/(owner)/(tabs)/today';
import { ownerIntake, type OwnerUpload } from '../lib/v2/ownerIntake';
import { STEP_ROUTE } from '../lib/v2/ownerFlow';
import type { OwnerSubmission, SubmissionId } from '../lib/v2/ownerTypes';

const mockPush = jest.fn(); const mockReplace = jest.fn(); const mockBack = jest.fn();
const mockDismissTo = jest.fn(); const mockCreate = jest.fn(); const mockUpdate = jest.fn();
let mockSubject = 'owner-a';
let mockSite: OwnerSubmission | null;
let mockDraft: OwnerSubmission | undefined;
let mockHistory: string[] = [];
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', PROVIDER_GOOGLE: 'google' }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject }) }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: true }) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, dismissTo: mockDismissTo,
    canGoBack: () => mockHistory.length > 1 }),
  Redirect: (props: object) => require('react').createElement(require('react-native').View, { ...props, testID: 'owner-resume-destination' }),
}));
jest.mock('../lib/v2/useOwnerSite', () => ({
  useOwnerSite: () => ({ id: mockSite?.submissionId ?? null, site: mockSite,
    me: { owner: { _id: mockSubject, name: 'Ben Reyes', email: 'ben@example.test' }, sites: mockSite ? [mockSite] : [] } }),
  firstName: () => 'Ben', greeting: () => 'Morning',
}));
jest.mock('../lib/v2/ownerData', () => ({
  useOwnerSubmission: (id: string | null) => id && mockDraft?.submissionId === id ? mockDraft : undefined,
  useCreateDraft: () => mockCreate, useUpdateDraft: () => mockUpdate,
  usePreview: () => undefined,
}));

const id = 'owner-draft-a' as SubmissionId;
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);
function draft(submissionId = id): OwnerSubmission {
  return { submissionId, businessName: 'Ben Barber', businessType: 'Barber/Salon', contentSource: 'owner_app', publishPolicy: 'pay_then_publish',
    status: 'draft', phase: 'draft', publishedUrl: null, total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false, openChangeRequests: 0, createdAt: 1,
    address: '12 Main Street', city: 'Marikina', province: null, barangay: null, coordinates: null, shotListKey: 'barber', interview: [], shots: [],
    templateId: null, templateIds: [], fontChoice: null, colorChoice: null, ownerApprovedAt: null, previewReadyAt: null };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function destination(screen: ReturnType<typeof wrap>) { return screen.getByTestId('owner-resume-destination').props.href; }
beforeEach(async () => {
  jest.clearAllMocks(); mockSubject = 'owner-a'; mockHistory = []; mockDraft = draft(); mockSite = mockDraft;
  await ownerIntake.bindActor(mockSubject);
  ownerIntake.clear(); ownerIntake.set({ submissionId: id, kind: 'barber', businessName: 'Ben Barber', address: '12 Main Street', city: 'Marikina' });
  await ownerIntake.flush();
  mockDismissTo.mockImplementation((target: string) => {
    const existing = mockHistory.lastIndexOf(target);
    mockHistory = existing >= 0 ? mockHistory.slice(0, existing + 1) : [...mockHistory.slice(0, -1), target];
  });
});
afterEach(() => jest.restoreAllMocks());

it('requires an explicit phone-holder choice rather than confirming the default preference', () => {
  ownerIntake.set({ how: 'self' });
  const screen = wrap(<How />);
  expect(screen.getByRole('radio', { name: 'By myself. You film yourself' }).props.accessibilityState.selected).toBe(false);
  expect(screen.getByRole('radio', { name: 'With a friend. A friend films you' }).props.accessibilityState.selected).toBe(false);
  const next = screen.getByRole('button', { name: 'Next' });
  expect(next).toBeDisabled(); fireEvent.press(next);
  expect(ownerIntake.get().howConfirmedFor).toBeUndefined(); expect(mockPush).not.toHaveBeenCalled();
});

it.each([null, 'By myself. You film yourself', 'With a friend. A friend films you'])('returns to setup after closing before Next (selection: %s)', (choice) => {
  const screen = wrap(<How />);
  if (choice) fireEvent.press(screen.getByRole('radio', { name: choice }));
  screen.unmount();
  const reopened = wrap(<OwnerIndex />);
  expect(destination(reopened)).toBe(STEP_ROUTE.how);
  expect(ownerIntake.get().howConfirmedFor).toBeUndefined();
});

it.each([
  ['By myself. You film yourself', 'self'], ['With a friend. A friend films you', 'friend'],
] as const)('resumes questions after confirming %s and closing', async (label, how) => {
  const screen = wrap(<How />);
  fireEvent.press(screen.getByRole('radio', { name: label }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Next' })); });
  expect(ownerIntake.get()).toMatchObject({ how, howConfirmedFor: id });
  expect(mockPush).toHaveBeenCalledWith(STEP_ROUTE['talk-intro']);
  screen.unmount();
  const reopened = wrap(<OwnerIndex />);
  expect(destination(reopened)).toBe(STEP_ROUTE['talk-intro']);
});

it.each([
  ['By myself. You film yourself', 'self'], ['With a friend. A friend films you', 'friend'],
] as const)('binds a server-only draft when confirming %s after a clean install', async (label, how) => {
  ownerIntake.clear();
  await ownerIntake.flush();
  expect(ownerIntake.get().submissionId).toBeUndefined();
  const screen = wrap(<How />);
  fireEvent.press(screen.getByRole('radio', { name: label }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Next' })); });
  expect(ownerIntake.get()).toMatchObject({ submissionId: id, how, howConfirmedFor: id });
  expect(mockPush).toHaveBeenCalledWith(STEP_ROUTE['talk-intro']);
  screen.unmount();
  expect(destination(wrap(<OwnerIndex />))).toBe(STEP_ROUTE['talk-intro']);
});

it('waits for confirmation persistence before navigating and deduplicates Next taps', async () => {
  const persisted = deferred(); jest.spyOn(ownerIntake, 'flush').mockReturnValueOnce(persisted.promise);
  const screen = wrap(<How />);
  fireEvent.press(screen.getByRole('radio', { name: 'By myself. You film yourself' }));
  const next = screen.getByRole('button', { name: 'Next' });
  fireEvent.press(next); fireEvent.press(next);
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => persisted.resolve());
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith(STEP_ROUTE['talk-intro']);
});

it.each([
  ['By myself. You film yourself', 'self'], ['With a friend. A friend films you', 'friend'],
] as const)('saves %s and exits to Today without advancing the interview', async (label, how) => {
  const screen = wrap(<How />);
  fireEvent.press(screen.getByRole('radio', { name: label }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save & exit' })); });
  expect(mockDismissTo).toHaveBeenCalledWith(STEP_ROUTE.home);
  expect(mockPush).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
  expect(ownerIntake.get()).toMatchObject({ submissionId: id, how, howConfirmedFor: id });
  screen.unmount();
  await ownerIntake.bindActor('different-owner');
  await ownerIntake.bindActor(mockSubject);
  const reopened = wrap(<How />);
  expect(reopened.getByRole('radio', { name: label }).props.accessibilityState.selected).toBe(true);
  reopened.unmount();
  expect(destination(wrap(<OwnerIndex />))).toBe(STEP_ROUTE['talk-intro']);
});

it.each(['account', 'site', 'unmount'])('does not navigate when confirmation finishes after %s changes', async (change) => {
  const persisted = deferred(); jest.spyOn(ownerIntake, 'flush').mockReturnValueOnce(persisted.promise);
  const screen = wrap(<How />);
  fireEvent.press(screen.getByRole('radio', { name: 'With a friend. A friend films you' }));
  fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  if (change === 'unmount') screen.unmount();
  else {
    if (change === 'account') {
      mockSubject = 'owner-b';
      await act(async () => { await ownerIntake.bindActor(mockSubject); });
    } else {
      const next = draft('owner-draft-b' as SubmissionId); mockSite = next; mockDraft = next;
      act(() => ownerIntake.set({ submissionId: next.submissionId }));
    }
    screen.rerender(<SafeAreaProvider initialMetrics={metrics}><How /></SafeAreaProvider>);
  }
  await act(async () => persisted.resolve());
  expect(mockPush).not.toHaveBeenCalled();
});

it('does not reuse another draft’s phone-holder confirmation or local recordings', () => {
  ownerIntake.set({ how: 'friend', howConfirmedFor: 'another-draft' as SubmissionId,
    uploads: [{ kind: 'answer', submissionId: 'another-draft' as SubmissionId, index: 0, uri: 'file://foreign.m4a', mediaType: 'audio', lang: 'en', durationSec: 5 }] });
  const screen = wrap(<OwnerIndex />);
  expect(destination(screen)).toBe(STEP_ROUTE.how);
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><How /></SafeAreaProvider>);
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});

it('keeps existing server interview progress ahead of the new setup confirmation', () => {
  mockDraft!.interview = [{ index: 0, questionEn: 'Shop name', questionTl: 'Pangalan', lang: 'en', answerText: 'Ben Barber', updatedAt: 1 }];
  expect(destination(wrap(<OwnerIndex />))).toBe(STEP_ROUTE.talk);
});

it('resumes a journaled local answer before its upload reaches the server', () => {
  ownerIntake.set({ uploads: [{ kind: 'answer', submissionId: id, index: 0, uri: 'file://pending.m4a', mediaType: 'audio', lang: 'en', durationSec: 5 }] });
  expect(destination(wrap(<OwnerIndex />))).toBe(STEP_ROUTE.talk);
});

it('counts local answer and photo uploads consistently from restart and Today', () => {
  const uploads: OwnerUpload[] = Array.from({ length: 10 }, (_, index): OwnerUpload => ({ kind: 'answer', submissionId: id,
    index, uri: `file://answer-${index}.m4a`, mediaType: 'audio', lang: 'en', durationSec: 5 }));
  uploads.push(...Array.from({ length: 3 }, (_, index): OwnerUpload => ({ kind: 'photo', submissionId: id, index, uri: `file://photo-${index}.jpg`, extra: false })));
  ownerIntake.set({ uploads });
  const screen = wrap(<OwnerIndex />);
  expect(destination(screen)).toBe(STEP_ROUTE.design);
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><Today /></SafeAreaProvider>);
  fireEvent.press(screen.getByRole('button', { name: 'Keep going' }));
  expect(mockPush).toHaveBeenCalledWith(STEP_ROUTE.design);
});

it.each([true, false])('Today uses the same draft-specific setup confirmation (confirmed: %s)', (confirmed) => {
  ownerIntake.set({ how: 'self', ...(confirmed ? { howConfirmedFor: id } : {}) });
  const screen = wrap(<Today />);
  fireEvent.press(screen.getByRole('button', { name: 'Keep going' }));
  expect(mockPush).toHaveBeenCalledWith(confirmed ? STEP_ROUTE['talk-intro'] : STEP_ROUTE.how);
});

it.each(['edited details', 'changed kind'])('restores pending shop details before resuming the interview after %s', (change) => {
  mockDraft!.interview = [{ index: 0, questionEn: 'Shop name', questionTl: 'Pangalan', lang: 'en', answerText: 'Ben Barber', updatedAt: 1 }];
  ownerIntake.set(change === 'edited details' ? { businessName: '', detailsDirty: ['businessName'] } : { kind: 'food' });
  const screen = wrap(<OwnerIndex />);
  expect(destination(screen)).toBe(STEP_ROUTE.place);
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><Today /></SafeAreaProvider>);
  fireEvent.press(screen.getByRole('button', { name: 'Keep going' }));
  expect(mockPush).toHaveBeenCalledWith(STEP_ROUTE.place);
});

it('allows a cold-start Back chain from questions through setup to the business type', () => {
  mockHistory = [STEP_ROUTE['talk-intro']];
  const screen = wrap(<TalkIntro />);
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockHistory).toEqual([STEP_ROUTE.how]);
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><How /></SafeAreaProvider>);
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockHistory).toEqual([STEP_ROUTE.place]);
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><Place /></SafeAreaProvider>);
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockHistory).toEqual([STEP_ROUTE.sell]);
  expect(mockBack).not.toHaveBeenCalled();
});

it('dismisses to existing setup entries instead of stacking duplicate Back destinations', () => {
  mockHistory = [STEP_ROUTE.place, STEP_ROUTE.how, STEP_ROUTE['talk-intro']];
  const screen = wrap(<TalkIntro />);
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockHistory).toEqual([STEP_ROUTE.place, STEP_ROUTE.how]);
  screen.rerender(<SafeAreaProvider initialMetrics={metrics}><How /></SafeAreaProvider>);
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockHistory).toEqual([STEP_ROUTE.place]);
});
