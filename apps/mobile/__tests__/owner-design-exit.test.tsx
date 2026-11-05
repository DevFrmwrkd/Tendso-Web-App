import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DesignPicker from '../app/(owner)/design';
import { designsFor } from '../lib/v2/ownerContent';
import { ownerIntake } from '../lib/v2/ownerIntake';
import { STEP_ROUTE } from '../lib/v2/ownerFlow';
import type { OwnerMe, OwnerSubmission, SubmissionId } from '../lib/v2/ownerTypes';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
const mockChoose = jest.fn(); const mockSubmit = jest.fn(); const mockResume = jest.fn();
let mockConnected = true;
let mockMe: OwnerMe; let mockSub: OwnerSubmission;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: 'owner-a' }) }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../lib/v2/ownerData', () => ({
  useOwnerMe: () => mockMe,
  newestSite: (me: OwnerMe | undefined) => me?.sites[0] ?? null,
  useOwnerSubmission: (id: string | null) => id === mockSub.submissionId ? mockSub : undefined,
  useChooseDesign: () => mockChoose, useSubmitSite: () => mockSubmit,
}));
jest.mock('../lib/v2/ownerUploads', () => ({ useOwnerUploads: () => ({ resume: mockResume }) }));
jest.mock('../components/v2/owner/OwnerUI', () => ({ SiteFrame: () => null }));

const id = 'owner-draft' as SubmissionId;
const designs = designsFor('barber');
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = () => render(<SafeAreaProvider initialMetrics={metrics}><DesignPicker /></SafeAreaProvider>);
beforeEach(async () => {
  jest.clearAllMocks(); mockConnected = true;
  mockSub = { submissionId: id, businessName: 'Kanto Cuts', businessType: 'Barber/Salon',
    contentSource: 'owner_app', publishPolicy: 'pay_then_publish', status: 'draft', phase: 'draft',
    publishedUrl: null, total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false,
    openChangeRequests: 0, createdAt: 1, address: '12 Sample Street', city: 'Marikina',
    province: null, barangay: null, coordinates: null, shotListKey: 'barber', interview: [], shots: [],
    templateId: designs[0].code, templateIds: [designs[0].code], fontChoice: null, colorChoice: null,
    ownerApprovedAt: null, previewReadyAt: null };
  mockMe = { owner: { _id: 'db-owner-a', email: 'owner-a@example.test', name: 'Pablo', phone: null }, sites: [mockSub] };
  await AsyncStorage.clear(); await ownerIntake.bindActor('owner-a');
  ownerIntake.clear(); ownerIntake.selectBusiness(id);
  await ownerIntake.flush();
});

it.each([true, false])('saves a browsed design without submitting and restores it over an older server choice (online: %s)', async online => {
  mockConnected = online;
  const screen = wrap();
  expect(screen.getByRole('button', { name: `${designs[0].name} design. Preview sample website.` }).props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'Next design' }));
  expect(screen.getByRole('button', { name: `${designs[1].name} design. Preview sample website.` }).props.accessibilityState.selected).toBe(true);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Save & exit' })); });
  expect(mockRouter.dismissTo).toHaveBeenCalledWith(STEP_ROUTE.home);
  expect(mockChoose).not.toHaveBeenCalled(); expect(mockSubmit).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
  expect(ownerIntake.get()).toMatchObject({ submissionId: id, design: designs[1].code });
  expect(mockSub.templateId).toBe(designs[0].code);
  screen.unmount();

  // Drop the actor's in-memory state, then hydrate its disk journal as on restart.
  await ownerIntake.bindActor('different-owner'); await ownerIntake.bindActor('owner-a');
  const reopened = wrap();
  expect(reopened.getByRole('button', { name: `${designs[1].name} design. Preview sample website.` }).props.accessibilityState.selected).toBe(true);
  expect(reopened.queryByRole('button', { name: `${designs[0].name} design. Preview sample website.`, selected: true })).toBeNull();
  expect(mockChoose).not.toHaveBeenCalled(); expect(mockSubmit).not.toHaveBeenCalled();
});
