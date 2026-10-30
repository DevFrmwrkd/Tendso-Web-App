import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import Pay from '../app/(owner)/pay';

const mockApply = jest.fn();
const mockPush = jest.fn();
let mockId = 'my-site';
let mockQuote: any;
let mockPay: any;
const offer = { name: 'Mika Santos', handle: 'mika', photo: null, code: 'MIKA', listPrice: 4999, total: 3499, saving: 1500 };

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: 'owner-clerk' }) }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }), Redirect: () => null }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => ({ id: mockId, me: { owner: { _id: 'my-owner' } },
  site: { submissionId: mockId, businessName: 'My Shop', contentSource: 'owner_app', phase: 'awaiting_payment', publishedUrl: null } }) }));
jest.mock('../lib/v2/ownerData', () => ({
  usePaymentState: () => mockPay, usePreview: () => undefined, useOwnerCreatorCode: () => mockQuote,
  useApplyOwnerCreatorCode: () => mockApply,
}));

beforeEach(() => {
  jest.clearAllMocks(); mockId = 'my-site';
  mockPay = { billable: true, total: 4999, balanceDue: 4999, paidInFull: false, needsApproval: false, canPayDeposit: true, canPayBalance: false, minDownPayment: 500 };
  mockQuote = { applied: null, editable: true, reason: null, total: 4999 };
  mockApply.mockResolvedValue(offer);
});

it('shows the saved creator and actual saved discount without recomputing the bill', () => {
  mockQuote = { ...mockQuote, applied: offer, total: 3499 }; mockPay.total = 3499;
  const view = render(<Pay />);
  expect(view.getByText('Mika Santos’s code')).toBeTruthy();
  expect(view.getByText('MIKA · You save ₱1,500')).toBeTruthy();
  expect(view.getByLabelText('Pay ₱3,499').props.accessibilityState.disabled).toBe(false);
  expect(mockApply).not.toHaveBeenCalled();
});

it('applies only on explicit confirmation, locks invoice creation, then waits for a matching billing quote', async () => {
  let finish!: (value: unknown) => void;
  mockApply.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<Pay />);
  fireEvent.press(view.getByText('Add code'));
  fireEvent.changeText(view.getByLabelText('Creator code'), ' mika ');
  expect(mockApply).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText('Apply code')); fireEvent.press(view.getByLabelText('Apply code'));
  expect(mockApply).toHaveBeenCalledTimes(1);
  expect(mockApply).toHaveBeenCalledWith({ submissionId: 'my-site', code: 'MIKA' });
  expect(view.getByLabelText('Pay ₱4,999').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(view.getByLabelText('Pay ₱4,999'));
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => { finish(offer); });
  mockQuote = { ...mockQuote, applied: offer, total: 3499 }; view.rerender(<Pay />);
  expect(view.getByLabelText('Pay ₱4,999').props.accessibilityState.disabled).toBe(true);
  mockPay = { ...mockPay, total: 3499, balanceDue: 3499 }; view.rerender(<Pay />);
  fireEvent.press(view.getByLabelText('Pay ₱3,499'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(owner)/pay/method', params: { kind: 'full', amount: '3499' } });
});

it('removes a code on the server and keeps the old lower quote unpayable during refresh', async () => {
  mockQuote = { ...mockQuote, applied: offer, total: 3499 }; mockPay.total = 3499;
  mockApply.mockResolvedValue(null);
  const view = render(<Pay />);
  fireEvent.press(view.getByText('Change code')); fireEvent.press(view.getByText('Remove code'));
  await waitFor(() => expect(mockApply).toHaveBeenCalledWith({ submissionId: 'my-site', code: null }));
  await act(async () => { await Promise.resolve(); });
  mockQuote = { ...mockQuote, applied: null, total: 4999 }; view.rerender(<Pay />);
  expect(view.getByLabelText('Pay ₱3,499').props.accessibilityState.disabled).toBe(true);
  mockPay = { ...mockPay, total: 4999 }; view.rerender(<Pay />);
  expect(view.getByLabelText('Pay ₱4,999').props.accessibilityState.disabled).toBe(false);
});

it('shows why an existing payment locks code changes while preserving payment access', () => {
  mockQuote = { ...mockQuote, applied: offer, total: 3499, editable: false, reason: 'A payment request already exists. Ask the team before changing this price.' };
  mockPay.total = 3499;
  const view = render(<Pay />);
  expect(view.getByText(/A payment request already exists/)).toBeTruthy();
  expect(view.queryByText('Change code')).toBeNull();
  expect(view.getByLabelText('Pay ₱3,499').props.accessibilityState.disabled).toBe(false);
});

it('retains the original quote on failure and allows a deliberate retry', async () => {
  mockApply.mockRejectedValueOnce(new Error('Invalid code'));
  const view = render(<Pay />);
  fireEvent.press(view.getByText('Add code')); fireEvent.changeText(view.getByLabelText('Creator code'), 'wrong');
  fireEvent.press(view.getByLabelText('Apply code'));
  await waitFor(() => expect(view.getByText(/Could not apply this code/)).toBeTruthy());
  expect(view.getByLabelText('Creator code').props.value).toBe('wrong');
  expect(view.getByLabelText('Pay ₱4,999').props.accessibilityState.disabled).toBe(false);
  fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA'); fireEvent.press(view.getByLabelText('Apply code'));
  await waitFor(() => expect(mockApply).toHaveBeenCalledTimes(2));
});

it('drops delayed code errors and clears the invoice lock when the selected site changes', async () => {
  let fail!: (value: unknown) => void;
  mockApply.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
  const view = render(<Pay />);
  fireEvent.press(view.getByText('Add code')); fireEvent.changeText(view.getByLabelText('Creator code'), 'MIKA');
  fireEvent.press(view.getByLabelText('Apply code'));
  mockId = 'my-second-site'; view.rerender(<Pay />);
  await act(async () => { fail(new Error('Old site failed')); });
  expect(view.queryByText(/Could not apply this code/)).toBeNull();
  expect(view.getByLabelText('Pay ₱4,999').props.accessibilityState.disabled).toBe(false);
});
