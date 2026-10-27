import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import SubmitReviewScreen from '../app/(app)/submit/review';
import SubmitSuccessScreen from '../app/(app)/submit/success';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockSetTier = jest.fn();
const mockSubmit = jest.fn();
const mockCheckDomain = jest.fn();
const mockRead = jest.fn();
const mockWrite = jest.fn();
const mockRemove = jest.fn();
let mockActor = 'agent-1';
let mockOffline = false;
let mockRevision = 0;
let mockParams: Record<string, string>;
let mockSubmissions: Record<string, any>;
const mockStorage = new Map<string, unknown>();

jest.mock('../hooks/useCaptureSession', () => ({ useCaptureSession: () => {
  const actor = mockActor;
  return {
    actor: { creatorId: actor, clerkId: 'clerk-' + actor }, actorKey: actor,
    isReady: true, isOffline: mockOffline, canQuery: !mockOffline, revision: mockRevision,
    isCurrent: () => actor === mockActor,
    canMutate: () => actor === mockActor && !mockOffline,
    read: mockRead, write: mockWrite, remove: mockRemove,
  };
} }));
jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('@tendso/convex-client', () => ({ api: {
  submissions: { getById: 'get', getPricingContext: 'pricing', setDomainTier: 'tier', submit: 'submit' },
  files: { getMultipleUrls: 'photos', getUrl: 'file' }, domains: { checkDomainAvailability: 'domain' },
} }));
jest.mock('convex/react', () => ({
  useQuery: (reference: string, args: any) => {
    if (args === 'skip') return undefined;
    if (reference === 'get') return mockSubmissions[args.id] ?? null;
    if (reference === 'pricing') return { basePrice: 999, priceCeiling: 4999, unlocked: true };
    if (reference === 'photos') return args.storageIds.map((key: string) => 'https://images.example.com/' + key);
    if (reference === 'file') return 'https://media.example.com/' + args.storageId;
    throw new Error('Unexpected query ' + reference);
  },
  useMutation: (reference: string) => reference === 'tier' ? mockSetTier : mockSubmit,
  useAction: () => mockCheckDomain,
}));
jest.mock('../components/PriceSlider', () => ({ PriceSlider: ({ initialValue, onChange, disabled }: any) =>
  require('react').createElement(require('react-native').TextInput, {
    accessibilityLabel: 'Website price', value: String(initialValue), editable: !disabled,
    onChangeText: (value: string) => onChange(Number(value)),
  }),
}));
jest.mock('../components/OfflineBanner', () => ({ OfflineBanner: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-av', () => ({
  Audio: { Sound: { createAsync: jest.fn() } }, Video: () => null, ResizeMode: { CONTAIN: 'contain' },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'MockSvg', Path: 'MockPath', Defs: 'MockDefs',
  LinearGradient: 'MockGradient', Rect: 'MockRect', Stop: 'MockStop',
}));

const form = { businessName: 'Nena Store', businessType: 'Sari-Sari Store', ownerName: 'Nena Santos',
  ownerPhone: '09171234567', address: '12 Rizal Street', city: 'Marikina' };
const flush = async () => { for (let count = 0; count < 15; count++) await Promise.resolve(); };
function stored(key: string, value: unknown) { mockStorage.set(mockActor + ':' + key, value); }
function confirmation(label: string) {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  return buttons.find(button => button.text === label)!.onPress!;
}
async function review() {
  const screen = render(<SubmitReviewScreen />);
  await waitFor(() => expect(screen.getByText('Check it, then send')).toBeTruthy());
  return screen;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockActor = 'agent-1'; mockOffline = false; mockRevision = 0; mockParams = {};
  mockStorage.clear(); stored('current_submission_id', 'draft-1');
  mockSubmissions = { 'draft-1': { _id: 'draft-1', creatorId: mockActor, status: 'draft',
    ...form, photos: ['one', 'two', 'three'], videoStorageId: 'videos/interview.mp4' } };
  mockRead.mockReset().mockImplementation(async (key: string) => mockStorage.get(mockActor + ':' + key) ?? null);
  mockWrite.mockReset().mockImplementation(async (key: string, value: unknown) => { stored(key, value); });
  mockRemove.mockReset().mockImplementation(async (key: string) => { mockStorage.delete(mockActor + ':' + key); });
  mockSetTier.mockReset().mockResolvedValue(undefined);
  mockSubmit.mockReset().mockResolvedValue(undefined);
  mockCheckDomain.mockReset().mockResolvedValue({ valid: true, available: true, withinBudget: true, domain: 'nenastore.com', pricePHP: 450 });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it('shows the actual capture, then saves its price before submitting with commission conditional on payment', async () => {
  const order: string[] = [];
  mockSetTier.mockImplementation(async () => { order.push('price'); });
  mockSubmit.mockImplementation(async () => { order.push('submit'); });
  const screen = await review();
  expect(screen.getByText('Nena Store')).toBeTruthy();
  expect(screen.getByText('3 photos')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Website price'), '1999');
  expect(screen.getByText('₱1,000')).toBeTruthy();
  expect(screen.getByText('You keep after payment')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Send for review' }));
  expect(Alert.alert).toHaveBeenCalledWith('Send this capture for review?',
    expect.stringContaining('Your ₱1,000 commission depends on the shop completing payment.'), expect.any(Array), expect.any(Object));
  await act(async () => { confirmation('Send for review')(); await flush(); });
  await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith({ id: 'draft-1' }));
  expect(order).toEqual(['price', 'submit']);
  expect(mockSetTier).toHaveBeenCalledWith({
    id: 'draft-1', submissionType: 'standard', requestedDomain: undefined, sellPrice: 1999, domainPricePHP: undefined,
  });
  expect(mockWrite).toHaveBeenCalledWith('submission_last_sent', expect.objectContaining({ submissionId: 'draft-1', queued: false }));
  expect(mockRemove).toHaveBeenCalledWith('current_submission_id');
});

it('queues offline media and the selected price without sending or inventing a payout', async () => {
  mockOffline = true; stored('current_submission_id', 'offline_pending');
  stored('submission_pending_sync', { creatorId: mockActor, formData: form });
  stored('submission_pending_photos', { submissionId: 'offline_pending', photoUris: ['file://1', 'file://2', 'file://3'], existingPhotos: [] });
  stored('submission_pending_interview', { submissionId: 'offline_pending', recordingUri: 'file://interview.m4a', type: 'audio' });
  const screen = await review();
  fireEvent.changeText(screen.getByLabelText('Website price'), '2999');
  fireEvent.press(screen.getByRole('button', { name: 'Save and queue' }));
  await act(async () => { confirmation('Save and queue')(); await flush(); });
  expect(mockStorage.get('agent-1:submission_pending_submit')).toMatchObject({
    submissionId: 'offline_pending', sellPrice: 2999, submissionType: 'standard',
  });
  expect(mockSetTier).not.toHaveBeenCalled(); expect(mockSubmit).not.toHaveBeenCalled();
  expect(mockRouter.replace).toHaveBeenCalledWith({
    pathname: '/(app)/submit/success', params: { queued: 'true', submissionId: 'offline_pending' },
  });
});

it('blocks a foreign server capture even if local metadata would otherwise allow sending', async () => {
  mockSubmissions['draft-1'] = { ...mockSubmissions['draft-1'], creatorId: 'another-agent', businessName: 'Private shop' };
  stored('submission_snapshot', { ...form, submissionId: 'draft-1', creatorId: mockActor });
  stored('submission_pending_photos', { submissionId: 'draft-1', photoUris: ['file://1', 'file://2', 'file://3'], existingPhotos: [] });
  stored('submission_pending_interview', { submissionId: 'draft-1', recordingUri: 'file://take.m4a', type: 'audio' });
  const screen = render(<SubmitReviewScreen />);
  await act(flush);
  expect(screen.queryByRole('button', { name: 'Send for review' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Save and queue' })).toBeNull();
  expect(screen.queryByText('Private shop')).toBeNull();
  expect(mockSubmit).not.toHaveBeenCalled();
});

it('ignores an older domain result and sends only the current domain quote', async () => {
  jest.useFakeTimers();
  let first!: (result: any) => void;
  let second!: (result: any) => void;
  mockCheckDomain.mockReturnValueOnce(new Promise(resolve => { first = resolve; }))
    .mockReturnValueOnce(new Promise(resolve => { second = resolve; }));
  const screen = await review();
  fireEvent.press(screen.getByRole('link', { name: 'Add custom' }));
  fireEvent.changeText(screen.getByLabelText('Custom domain (optional)'), 'old-address.com');
  await act(async () => { jest.advanceTimersByTime(500); await flush(); });
  fireEvent.changeText(screen.getByLabelText('Custom domain (optional)'), 'new-address.com');
  await act(async () => { jest.advanceTimersByTime(500); await flush(); });
  await act(async () => { first({ valid: true, available: true, withinBudget: true, domain: 'old-address.com', pricePHP: 200 }); await flush(); });
  expect(screen.getByRole('button', { name: 'Send for review' })).toBeDisabled();
  expect(screen.queryByText('Available · ₱200 added to the website price')).toBeNull();
  await act(async () => { second({ valid: true, available: true, withinBudget: true, domain: 'new-address.com', pricePHP: 450 }); await flush(); });
  expect(screen.getByText('Owner total: ₱1,449')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Send for review' }));
  await act(async () => { confirmation('Send for review')(); await flush(); });
  expect(mockSetTier).toHaveBeenCalledWith(expect.objectContaining({
    requestedDomain: 'new-address.com', domainPricePHP: 450, sellPrice: 999,
  }));
});

it('deduplicates confirmation and send while a live submission is in progress', async () => {
  let finish!: () => void;
  mockSetTier.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  const screen = await review();
  const button = screen.getByRole('button', { name: 'Send for review' });
  fireEvent.press(button); fireEvent.press(button);
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  const send = confirmation('Send for review');
  act(() => { send(); send(); });
  expect(mockSetTier).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); await flush(); });
  expect(mockSubmit).toHaveBeenCalledTimes(1);
});

it('updates a queued receipt to the actual submitted capture after the cache revision changes', async () => {
  mockOffline = true;
  mockParams = { submissionId: 'offline_pending', queued: 'true' };
  stored('submission_last_sent', { submissionId: 'offline_pending', queued: true, sentAt: 100, businessName: 'Nena Store' });
  const screen = render(<SubmitSuccessScreen />);
  await waitFor(() => expect(screen.getByText('Saved on this phone')).toBeTruthy());
  expect(screen.getByText('Waiting for a connection')).toBeTruthy();
  mockOffline = false; mockRevision++;
  stored('submission_last_sent', { submissionId: 'draft-1', queued: false, sentAt: 200, businessName: 'Nena Store' });
  mockSubmissions['draft-1'] = { ...mockSubmissions['draft-1'], status: 'submitted', creatorPayout: 500 };
  screen.rerender(<SubmitSuccessScreen />);
  await waitFor(() => expect(screen.getByText('Sent! We’ll build Nena Store’s site.')).toBeTruthy());
  expect(screen.queryByText('Saved on this phone')).toBeNull();
  expect(screen.getByText('Commission becomes eligible after the owner pays')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Back to the map' }));
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(tabs)/');
});

it('shows the explicitly requested owned capture instead of an unrelated last-sent receipt', async () => {
  stored('submission_last_sent', { submissionId: 'previous-capture', queued: false, sentAt: 100, businessName: 'Previous Shop' });
  mockSubmissions['previous-capture'] = { _id: 'previous-capture', creatorId: mockActor, status: 'paid', businessName: 'Previous Shop', creatorPayout: 2500 };
  mockSubmissions['capture-b'] = { _id: 'capture-b', creatorId: mockActor, status: 'submitted', businessName: 'Current Shop', creatorPayout: 500 };
  mockParams = { submissionId: 'capture-b' };
  const screen = render(<SubmitSuccessScreen />);
  await waitFor(() => expect(screen.getByText('Sent! We’ll build Current Shop’s site.')).toBeTruthy());
  expect(screen.queryByText(/Previous Shop/)).toBeNull();
  expect(screen.getByText('Your commission: ₱500')).toBeTruthy();
  expect(screen.queryByText('Your commission: ₱2,500')).toBeNull();
});

it('does not call an owned server draft Sent even when an old matching local receipt says sent', async () => {
  stored('submission_last_sent', { submissionId: 'draft-1', queued: false, sentAt: 100, businessName: form.businessName });
  mockParams = { submissionId: 'draft-1' };
  const screen = render(<SubmitSuccessScreen />);
  await waitFor(() => expect(screen.getByText('This capture is still a draft')).toBeTruthy());
  expect(screen.queryByText(/Sent!/)).toBeNull();
  expect(screen.queryByText('Saved on this phone')).toBeNull();
  expect(screen.getByRole('button', { name: 'Review capture' })).toBeTruthy();
});

it('does not trust a queued URL flag without a matching saved queue receipt', async () => {
  mockParams = { submissionId: 'draft-1', queued: 'true' };
  const screen = render(<SubmitSuccessScreen />);
  await waitFor(() => expect(screen.getByText('This capture is still a draft')).toBeTruthy());
  expect(screen.queryByText('Saved on this phone')).toBeNull();
  expect(screen.queryByText(/Sent!/)).toBeNull();
});

it('does not borrow another capture receipt for an explicit route while offline', async () => {
  mockOffline = true;
  stored('submission_last_sent', { submissionId: 'previous-capture', queued: false, sentAt: 100, businessName: 'Previous Shop' });
  mockParams = { submissionId: 'capture-b' };
  const screen = render(<SubmitSuccessScreen />);
  await waitFor(() => expect(screen.getByText('No capture receipt here')).toBeTruthy());
  expect(screen.queryByText(/Previous Shop/)).toBeNull();
  expect(screen.queryByText(/Sent!/)).toBeNull();
});

it('blocks a foreign receipt instead of showing another agent’s business or a false Sent state', async () => {
  stored('submission_last_sent', { submissionId: 'foreign', queued: false, sentAt: 100, businessName: 'Unverified cached name' });
  mockSubmissions.foreign = { _id: 'foreign', creatorId: 'another-agent', status: 'paid', businessName: 'Private shop', creatorPayout: 2500 };
  mockParams = { submissionId: 'foreign' };
  const screen = render(<SubmitSuccessScreen />);
  await act(flush);
  expect(screen.queryByText(/Sent!/)).toBeNull();
  expect(screen.queryByText('Private shop')).toBeNull();
  expect(screen.queryByText('Your commission: ₱2,500')).toBeNull();
  expect(screen.getByRole('button', { name: 'Back to the map' })).toBeTruthy();
});

it('shows no payout completion before owner payment and reads paid status from the server', async () => {
  stored('submission_last_sent', { submissionId: 'draft-1', queued: false, sentAt: 100, businessName: 'Nena Store' });
  mockSubmissions['draft-1'] = { ...mockSubmissions['draft-1'], status: 'deployed', creatorPayout: 500, websiteUrl: 'https://nena.example.com' };
  const screen = render(<SubmitSuccessScreen />);
  await waitFor(() => expect(screen.getByText('Your commission: ₱500')).toBeTruthy());
  expect(screen.getByText('Commission becomes eligible after the owner pays')).toBeTruthy();
  expect(screen.queryByText('Check Earn for the payment and payout status')).toBeNull();
  mockSubmissions['draft-1'] = { ...mockSubmissions['draft-1'], status: 'paid' };
  screen.rerender(<SubmitSuccessScreen />);
  expect(screen.getByText('Check Earn for the payment and payout status')).toBeTruthy();
  expect(mockSubmit).not.toHaveBeenCalled(); expect(mockSetTier).not.toHaveBeenCalled();
});
