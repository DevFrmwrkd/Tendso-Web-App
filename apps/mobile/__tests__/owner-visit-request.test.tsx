import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import BookVisit from '../app/(owner)/agents/book';

const mockRequest = jest.fn(), mockLegacyLead = jest.fn(), mockReplace = jest.fn(), mockBack = jest.fn();
const mockIntakeSet = jest.fn(), mockIntakeClear = jest.fn();
let mockSubject: string, mockId: string | null, mockSite: any, mockMe: any, mockConnected: boolean;
let mockParams: Record<string, unknown>, mockSavedDraft: Record<string, unknown>, mockNewBusiness: boolean;
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ userId: mockSubject }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'visit-request-1234' }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams,
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
}));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockConnected }) }));
jest.mock('../lib/v2/ownerData', () => ({ useRequestVisit: () => mockLegacyLead }));
jest.mock('../lib/v2/visitRequests', () => ({ ...jest.requireActual('../lib/v2/visitRequests'), useCreateVisitRequest: () => mockRequest }));
jest.mock('../components/field-agent/CaptureLocationPicker', () => ({
  CaptureLocationPicker: (props: object) => require('react').createElement(require('react-native').View, { testID: 'visit-pin-picker', ...props }),
}));
jest.mock('../lib/v2/useOwnerSite', () => ({ useOwnerSite: () => ({ id: mockId, site: mockSite, me: mockMe, isNewBusiness: mockNewBusiness }) }));
jest.mock('../lib/v2/ownerIntake', () => ({ ownerIntake: {
  scope: () => 0, isCurrent: (scope: number) => scope === 0, get: () => mockSavedDraft,
  set: (...args: unknown[]) => mockIntakeSet(...args), clear: () => mockIntakeClear(),
} }));

function fill(screen: ReturnType<typeof render>, name = 'New visit shop') {
  fireEvent.changeText(screen.getByLabelText('Shop name'), name);
  fireEvent.changeText(screen.getByLabelText('Shop address'), ' 12 Main St ');
  fireEvent.changeText(screen.getByLabelText('City or municipality'), ' Marikina ');
  fireEvent.press(screen.getByRole('button', { name: screen.queryByRole('button', { name: 'Adjust shop pin' }) ? 'Adjust shop pin' : 'Choose shop pin' }));
  act(() => screen.getByTestId('visit-pin-picker').props.onConfirm({ coordinates: { lat: 14.6, lng: 121.1 }, address: ' 12 Main St ', city: ' Marikina ' }));
}
const created = () => ({ _id: 'visit-created', ownerId: 'owner-row', actorClerkId: 'owner-clerk' });
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  jest.clearAllMocks(); mockSubject = 'owner-clerk'; mockId = 'selected-site'; mockConnected = true; mockNewBusiness = false;
  mockSite = { submissionId: mockId, businessName: '[TEST] Selected business', phase: 'draft' };
  mockMe = { owner: { _id: 'owner-row', name: 'Pablo', email: 'poru.fetaruvero@gmail.com', phone: '09171234567' }, sites: [mockSite] };
  mockSavedDraft = { businessName: 'An old saved draft', ownerName: 'Stale intake owner', newBusinessKey: 'new-draft' };
  mockParams = {}; mockRequest.mockReset().mockResolvedValue(created());
});
afterEach(() => { expect(mockIntakeSet).not.toHaveBeenCalled(); expect(mockIntakeClear).not.toHaveBeenCalled(); expect(mockLegacyLead).not.toHaveBeenCalled(); });

it('starts a generic visit with a blank editable name despite a selected business and saved draft', () => {
  const screen = render(<BookVisit />);
  expect(screen.getByLabelText('Shop name').props.value).toBe('');
  expect(screen.getByLabelText('Shop name').props.editable).toBe(true);
  expect(screen.getByLabelText('Shop name').props.maxLength).toBe(120);
  expect(screen.queryByText('For this business')).toBeNull();
  expect(screen.queryByText('[TEST] Selected business')).toBeNull();
  expect(screen.getByLabelText('Your mobile number').props.value).toBe('09171234567');
  expect(screen.getByRole('button', { name: 'Send request' }).props.accessibilityState.disabled).toBe(true);
});

it('does not use the new-business draft name or stale intake owner name', async () => {
  mockId = null; mockSite = null; mockNewBusiness = true; mockMe.sites = []; mockMe.owner.name = '';
  const screen = render(<BookVisit />); expect(screen.getByLabelText('Shop name').props.value).toBe('');
  fill(screen, 'New standalone shop');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Send request' })); });
  expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ ownerName: 'Shop owner', shopName: 'New standalone shop' }));
});

it('sends the edited, trimmed shop name with the account contact and selected time', async () => {
  mockParams = { agent: 'Joy Dizon' };
  const screen = render(<BookVisit />); fill(screen, '  Kanto Sari-sari  ');
  fireEvent.press(screen.getByRole('radio', { name: 'Tomorrow' }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Send request' })); });
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(mockRequest).toHaveBeenCalledWith({ requestKey: 'visit-request-1234', ownerName: 'Pablo', phone: '09171234567', email: 'poru.fetaruvero@gmail.com',
    shopName: 'Kanto Sari-sari', address: '12 Main St', city: 'Marikina', coordinates: { lat: 14.6, lng: 121.1 }, preferredWhen: 'Tomorrow' });
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(owner)/agents/[visitId]', params: { visitId: 'visit-created' } });
});

it.each(['', '   ', 'x', 'x'.repeat(121)])('does not send an invalid shop name (%j)', async name => {
  const screen = render(<BookVisit />); fill(screen, name);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Send request' })); });
  expect(mockRequest).not.toHaveBeenCalled();
});

it('prefills only an explicitly requested owned, current business and lets the owner edit it', async () => {
  mockParams = { submissionId: mockId };
  const screen = render(<BookVisit />);
  expect(screen.getByLabelText('Shop name').props.value).toBe('[TEST] Selected business');
  expect(screen.getByText('For this business')).toBeTruthy(); fill(screen, 'Visit the new branch');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Send request' })); });
  expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ shopName: 'Visit the new branch' }));
  expect(mockSite.businessName).toBe('[TEST] Selected business');
});

it.each(['foreign', 'owned but not selected', 'not in owned list', 'array parameter'])('does not prefill from an invalid explicit context: %s', scenario => {
  mockParams = { submissionId: scenario === 'array parameter' ? [mockId] : scenario === 'foreign' ? 'foreign-id' : mockId };
  if (scenario === 'owned but not selected') {
    mockMe.sites.push({ submissionId: 'second-site', businessName: 'Second business' }); mockParams.submissionId = 'second-site';
  }
  if (scenario === 'not in owned list') mockMe.sites = [];
  const screen = render(<BookVisit />);
  expect(screen.getByLabelText('Shop name').props.value).toBe(''); expect(screen.queryByText('For this business')).toBeNull();
});

it('clears the form when explicit visit context changes on the same selected business', () => {
  const screen = render(<BookVisit />); fill(screen, 'Unsaved generic visit');
  mockParams = { submissionId: mockId }; screen.rerender(<BookVisit />);
  expect(screen.getByLabelText('Shop name').props.value).toBe('[TEST] Selected business');
  mockParams = {}; screen.rerender(<BookVisit />); expect(screen.getByLabelText('Shop name').props.value).toBe('');
});

it('keeps offline and invalid-phone requests disabled even with a shop name', async () => {
  mockConnected = false;
  const screen = render(<BookVisit />); fill(screen);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Send request' })); });
  expect(mockRequest).not.toHaveBeenCalled();
  mockConnected = true; screen.rerender(<BookVisit />);
  fireEvent.changeText(screen.getByLabelText('Your mobile number'), '123');
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Send request' })); });
  expect(mockRequest).not.toHaveBeenCalled();
});

it.each(['business', 'account'] as const)('ignores a late request completion after the %s changes', async change => {
  const pending = deferred(); mockRequest.mockReturnValue(pending.promise);
  const screen = render(<BookVisit />); fill(screen, 'Earlier visit');
  fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
  if (change === 'business') {
    mockId = 'second-site'; mockSite = { ...mockSite, submissionId: mockId, businessName: 'Second shop' }; mockMe.sites.push(mockSite);
  } else { mockSubject = 'another-owner'; mockMe = { ...mockMe, owner: { ...mockMe.owner, _id: 'another-row' } }; }
  screen.rerender(<BookVisit />);
  await act(async () => { pending.resolve(created()); });
  expect(screen.queryByRole('header', { name: 'Your visit request is sent' })).toBeNull();
  expect(screen.getByLabelText('Shop name').props.value).toBe(''); expect(mockReplace).not.toHaveBeenCalled();
});

it('deduplicates taps and preserves the entered name after a request error', async () => {
  const pending = deferred(); mockRequest.mockReturnValue(pending.promise);
  const screen = render(<BookVisit />); fill(screen, 'One visit only');
  fireEvent.press(screen.getByRole('button', { name: 'Send request' })); fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
  expect(mockRequest).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve(created()); });
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(owner)/agents/[visitId]', params: { visitId: 'visit-created' } });
  screen.unmount(); mockRequest.mockRejectedValue(new Error('Please retry this request.'));
  const retry = render(<BookVisit />); fill(retry, 'Keep this name');
  fireEvent.press(retry.getByRole('button', { name: 'Send request' }));
  await waitFor(() => expect(retry.getByText('Please retry this request.')).toBeTruthy());
  expect(retry.getByLabelText('Shop name').props.value).toBe('Keep this name');
});

it('requires an address, city and confirmed Philippine pin before sending', () => {
  const screen = render(<BookVisit />);
  fireEvent.changeText(screen.getByLabelText('Shop name'), 'Kanto shop');
  fireEvent.changeText(screen.getByLabelText('Shop address'), '12 Main St');
  fireEvent.changeText(screen.getByLabelText('City or municipality'), 'Marikina');
  expect(screen.getByRole('button', { name: 'Send request' }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'Choose shop pin' }));
  act(() => screen.getByTestId('visit-pin-picker').props.onConfirm({ coordinates: { lat: 40, lng: 121 }, address: '12 Main St', city: 'Marikina' }));
  expect(screen.getByRole('button', { name: 'Send request' }).props.accessibilityState.disabled).toBe(true);
  expect(mockRequest).not.toHaveBeenCalled();
});

it('retries an uncertain save with the same request key and reports request limits without a generic lead fallback', async () => {
  mockRequest.mockRejectedValueOnce({ data: 'You already have three open visit requests.' }).mockResolvedValueOnce(created());
  const screen = render(<BookVisit />); fill(screen);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Send request' })); });
  expect(screen.getByText('You already have three open visit requests.')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Send request' })); });
  expect(mockRequest.mock.calls[0][0].requestKey).toBe(mockRequest.mock.calls[1][0].requestKey);
  expect(mockLegacyLead).not.toHaveBeenCalled();
});
