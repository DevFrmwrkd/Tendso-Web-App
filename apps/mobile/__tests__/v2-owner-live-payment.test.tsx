import React from 'react';
import { Share } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Today from '../app/(owner)/(tabs)/today';
import MySite from '../app/(owner)/(tabs)/site';
import Pay from '../app/(owner)/pay';
import { outstandingPayment, todayAction } from '../lib/v2/ownerFlow';
import type { SiteSummary, SubmissionId } from '../lib/v2/ownerTypes';

const mockPush = jest.fn();
let mockSite: SiteSummary;
let mockPayment: any;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: 'owner-clerk' }) }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }), Redirect: () => null }));
jest.mock('../lib/v2/useOwnerSite', () => ({
  useOwnerSite: () => ({ site: mockSite, id: mockSite.submissionId, me: { owner: { name: 'Ben' } } }),
  firstName: () => 'Ben', greeting: () => 'Morning',
}));
jest.mock('../lib/v2/ownerData', () => ({
  usePreview: () => ({ ready: true, publishedUrl: 'https://shop.sites.tendso.com', isLive: true }),
  useOwnerSubmission: () => undefined,
  usePaymentState: () => mockPayment,
  useOwnerCreatorCode: () => undefined,
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockSite = {
    submissionId: 'field-agent-site' as SubmissionId, businessName: 'Ben Barber', businessType: 'Barber/Salon',
    contentSource: 'field_agent', publishPolicy: 'publish_first', status: 'approved', phase: 'live',
    publishedUrl: 'https://shop.sites.tendso.com', total: 4999, amountPaid: 0, balanceDue: 4999,
    paidInFull: false, openChangeRequests: 0, createdAt: 1,
  };
  mockPayment = { billable: true, total: 4999, amountPaid: 0, balanceDue: 4999, paidInFull: false, canPayFull: true, canPayDeposit: true, canPayBalance: false, minDownPayment: 500, needsApproval: false };
});

it.each([[0, 4999, 'Pay ₱4,999'], [1000, 3999, 'Pay ₱3,999']])('Today offers payment for a live site with %i paid', (paid, balance, label) => {
  mockSite = { ...mockSite, amountPaid: paid as number, balanceDue: balance as number };
  const screen = wrap(<Today />);
  expect(todayAction('live', mockSite)).toEqual({ label, step: 'pay' });
  fireEvent.press(screen.getByText(label));
  expect(mockPush).toHaveBeenCalledWith('/(owner)/pay');
  screen.unmount();
});

it.each([[0, 4999, 'Pay ₱4,999'], [1000, 3999, 'Pay ₱3,999']])('My Site keeps sharing and exposes the outstanding payment with %i paid', (paid, balance, label) => {
  mockSite = { ...mockSite, amountPaid: paid as number, balanceDue: balance as number };
  const screen = wrap(<MySite />);
  expect(screen.getByText('Share')).toBeTruthy();
  expect(screen.getByText('Ask for a change')).toBeTruthy();
  fireEvent.press(screen.getByText(label));
  expect(mockPush).toHaveBeenCalledWith('/(owner)/pay');
  screen.unmount();
});

it('fully paid and free sites keep the sharing action and have no payment prompt', () => {
  mockSite = { ...mockSite, amountPaid: 4999, balanceDue: 0, paidInFull: true };
  expect(todayAction('live', mockSite)).toEqual({ label: 'Share my site', step: 'live' });
  expect(outstandingPayment(mockSite)).toBeNull();
  expect(outstandingPayment({ total: 0, amountPaid: 0, balanceDue: 0, paidInFull: true })).toBeNull();
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const screen = wrap(<MySite />);
  expect(screen.queryByText(/^Pay /)).toBeNull();
  fireEvent.press(screen.getByText('Share'));
  expect(share).toHaveBeenCalledWith({ message: 'Ben Barber: https://shop.sites.tendso.com' });
  screen.unmount();
  share.mockRestore();
});

it('an unpaid published site reaches full/deposit checkout without claiming it needs publishing', () => {
  const screen = wrap(<Pay />);
  expect(screen.getByText('Pay for your site')).toBeTruthy();
  expect(screen.queryByText('Publish your site')).toBeNull();
  expect(screen.getByText('Pay part now')).toBeTruthy();
  fireEvent.press(screen.getByText('Pay ₱4,999'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(owner)/pay/method', params: { kind: 'full', amount: '4999' } });
  screen.unmount();
});

it('a partially paid published site can pay its remaining balance', () => {
  mockPayment = { ...mockPayment, amountPaid: 1000, balanceDue: 3999, canPayBalance: true, canPayDeposit: false };
  const screen = wrap(<Pay />);
  expect(screen.getByText('Pay the rest')).toBeTruthy();
  fireEvent.press(screen.getByText('Pay ₱3,999'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(owner)/pay/method', params: { kind: 'balance', amount: '3999' } });
  screen.unmount();
});
