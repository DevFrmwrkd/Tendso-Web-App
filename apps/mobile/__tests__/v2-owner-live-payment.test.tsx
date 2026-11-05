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
let mockPreview: any;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: 'owner-clerk' }) }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }), Redirect: () => null }));
// These cases verify screen destinations; navigation deduplication has its own
// tests and must not carry a 700 ms module-level lock between independent cases.
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock('../lib/v2/useOwnerSite', () => ({
  useOwnerSite: () => ({ site: mockSite, id: mockSite.submissionId, me: {
    owner: { _id: 'owner-db', name: 'Ben', email: 'ben@example.test', phone: null }, sites: [mockSite],
  } }),
  firstName: () => 'Ben', greeting: () => 'Morning',
}));
jest.mock('../lib/v2/ownerInbox', () => ({
  useOwnerInbox: () => ({ ownerId: 'owner-db', actorClerkId: 'owner-clerk', items: [], unreadCount: 0 }),
}));
jest.mock('../lib/v2/visitRequests', () => ({
  ...jest.requireActual('../lib/v2/visitRequests'), useOwnerVisitRequests: () => [],
}));
jest.mock('../lib/v2/ownerData', () => ({
  usePreview: () => mockPreview,
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
  mockPreview = { ready: true, publishedUrl: 'https://shop.sites.tendso.com', isLive: true };
});

it.each([[0, 4999, 'Pay ₱4,999'], [1000, 3999, 'Pay ₱3,999']])('Today offers payment for a live site with %i paid', (paid, balance, label) => {
  mockSite = { ...mockSite, amountPaid: paid as number, balanceDue: balance as number };
  const screen = wrap(<Today />);
  expect(todayAction('live', mockSite)).toEqual({ label, step: 'pay' });
  fireEvent.press(screen.getByRole('button', { name: label as string }));
  expect(mockPush).toHaveBeenCalledWith('/(owner)/pay');
  screen.unmount();
});

it.each([[0, 4999, 'Pay ₱4,999'], [1000, 3999, 'Pay ₱3,999']])('My Site keeps sharing and exposes the outstanding payment with %i paid', (paid, balance, label) => {
  mockSite = { ...mockSite, amountPaid: paid as number, balanceDue: balance as number };
  const screen = wrap(<MySite />);
  expect(screen.getByText('Share')).toBeTruthy();
  expect(screen.getByText('Ask for a change')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: label as string }));
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
  fireEvent.press(screen.getByRole('button', { name: 'Share' }));
  expect(share).toHaveBeenCalledWith({ message: 'Ben Barber: https://shop.sites.tendso.com/' });
  screen.unmount();
  share.mockRestore();
});

it.each(['javascript:alert(1)', 'https://name:secret@example.com', 'not a URL'])('never offers sharing for the unsafe public address %s', url => {
  mockSite = { ...mockSite, publishedUrl: url };
  mockPreview = { ...mockPreview, publishedUrl: url };
  const screen = wrap(<MySite />);
  expect(screen.queryByText('Share')).toBeNull();
});

it('keeps a verified live address shareable while preview metadata is loading', () => {
  mockPreview = undefined;
  const screen = wrap(<MySite />);
  expect(screen.getByText('Share')).toBeTruthy();
});

it('an unpaid published site reaches full/deposit checkout without claiming it needs publishing', () => {
  const screen = wrap(<Pay />);
  expect(screen.getByText('Pay for your site')).toBeTruthy();
  expect(screen.queryByText('Publish your site')).toBeNull();
  expect(screen.getByText('Pay part now')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Pay ₱4,999' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(owner)/pay/method', params: { kind: 'full', amount: '4999' } });
  screen.unmount();
});

it('a partially paid published site can pay its remaining balance', () => {
  mockPayment = { ...mockPayment, amountPaid: 1000, balanceDue: 3999, canPayBalance: true, canPayDeposit: false };
  const screen = wrap(<Pay />);
  expect(screen.getByText('Pay the rest')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Pay ₱3,999' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(owner)/pay/method', params: { kind: 'balance', amount: '3999' } });
  screen.unmount();
});

it('new agent-made private previews lead to checking the site and offer no public sharing', () => {
  mockSite = { ...mockSite, publishPolicy: 'pay_then_publish', status: 'website_generated',
    phase: 'ready_to_check', publishedUrl: null };
  mockPreview = { ready: true, htmlUrl: null, inlineHtml: '<html><body>Private shop preview</body></html>',
    isLive: false, publishedUrl: null };
  const today = wrap(<Today />);
  fireEvent.press(today.getByRole('button', { name: 'Check preview' }));
  expect(mockPush).toHaveBeenCalledWith('/(owner)/check');
  today.unmount();
  const site = wrap(<MySite />);
  expect(site.getByText('Ready to check')).toBeTruthy();
  expect(site.queryByText('Share')).toBeNull();
  fireEvent.press(site.getByRole('button', { name: 'Check my site' }));
  expect(mockPush).toHaveBeenLastCalledWith('/(owner)/check');
});

it('an approved agent-made preview reaches payment while the website is still private', () => {
  mockSite = { ...mockSite, publishPolicy: 'pay_then_publish', status: 'website_generated',
    phase: 'awaiting_payment', publishedUrl: null };
  mockPreview = { ready: true, htmlUrl: null, inlineHtml: '<html><body>Private shop preview</body></html>',
    isLive: false, publishedUrl: null };
  const screen = wrap(<Pay />);
  expect(screen.getByText('Publish your site')).toBeTruthy();
  expect(screen.queryByText('Pay for your site')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Pay ₱4,999' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(owner)/pay/method', params: { kind: 'full', amount: '4999' } });
  expect(mockSite.publishedUrl).toBeNull();
});
