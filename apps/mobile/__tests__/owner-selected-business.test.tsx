import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { ownerIntake } from '../lib/v2/ownerIntake';
import { useOwnerSite } from '../lib/v2/useOwnerSite';
import type { SubmissionId } from '../lib/v2/ownerTypes';

let mockMe: any;
jest.mock('../lib/v2/ownerData', () => ({ useOwnerMe: () => mockMe, newestSite: (me: any) => me?.sites[0] ?? null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const a = 'business-a' as SubmissionId, b = 'business-b' as SubmissionId;
beforeEach(() => { ownerIntake.clear(); mockMe = { owner: { _id: 'owner' }, sites: [{ submissionId: a, phase: 'live' }] }; });

it('keeps the new workspace empty while previous owned businesses remain available', () => {
  ownerIntake.selectBusiness(a);
  const { result } = renderHook(useOwnerSite);
  act(() => ownerIntake.beginBusiness());
  expect(result.current).toMatchObject({ me: mockMe, isNewBusiness: true, site: null, id: null });
});

it('waits for the newly created business instead of showing the previous site during query lag', () => {
  ownerIntake.selectBusiness(a); ownerIntake.beginBusiness();
  const { result, rerender } = renderHook(useOwnerSite);
  act(() => ownerIntake.set({ submissionId: b }));
  expect(result.current).toMatchObject({ isNewBusiness: false, site: null, id: null });
  expect(ownerIntake.isAwaitingBusiness(b)).toBe(true);
  mockMe = { ...mockMe, sites: [{ submissionId: b, phase: 'draft' }, ...mockMe.sites] }; rerender({});
  expect(result.current.id).toBe(b);
  ownerIntake.confirmBusiness(b);
  expect(ownerIntake.isAwaitingBusiness(b)).toBe(false);
});

it('keeps late newly-created metadata from overriding an explicit business selection', () => {
  ownerIntake.selectBusiness(a); ownerIntake.beginBusiness(); ownerIntake.set({ submissionId: b });
  ownerIntake.selectBusiness(a);
  const { result, rerender } = renderHook(useOwnerSite);
  expect(ownerIntake.isAwaitingBusiness(b)).toBe(false);
  mockMe = { ...mockMe, sites: [{ submissionId: b, phase: 'draft' }, ...mockMe.sites] }; rerender({});
  expect(result.current.id).toBe(a);
});
