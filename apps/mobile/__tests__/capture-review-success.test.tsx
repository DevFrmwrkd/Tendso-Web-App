import React from 'react';
import { Alert, StyleSheet } from 'react-native';
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
const mockFindLookup = jest.fn();
let mockActor = 'agent-1';
let mockOffline = false;
let mockRevision = 0;
let mockParams: Record<string, string>;
let mockSubmissions: Record<string, any>;
let mockFinds: Record<string, any>;
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
  leads: { getDetailForMobileCRM: 'source-find' },
  files: { getMultipleUrls: 'photos', getUrl: 'file' }, domains: { checkDomainAvailability: 'domain' },
} }));
jest.mock('convex/react', () => ({
  useQuery: (reference: string, args: any) => {
    if (args === 'skip') return undefined;
    if (reference === 'get') return mockSubmissions[args.id] ?? null;
    if (reference === 'source-find') { mockFindLookup(args); return mockFinds[args.id] ?? null; }
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
  ownerPhone: '09171234567', ownerEmail: 'nena@example.com', address: '12 Rizal Street', city: 'Marikina' };
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
  mockFinds = {};
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

it('uses the saved server website price without changing its custom-domain add-on', async () => {
  Object.assign(mockSubmissions['draft-1'], { amount: 2449, domainCostPHP: 450 });
  stored('submission_snapshot', { ...form, creatorId: mockActor, submissionId: 'draft-1', initialSellPrice: 4999 });
  const screen = await review();
  expect(screen.getByLabelText('Website price').props.value).toBe('1999');
});

it('keeps a queued final price ahead of the server draft and its older captured preference', async () => {
  Object.assign(mockSubmissions['draft-1'], { amount: 2449, domainCostPHP: 450 });
  stored('submission_snapshot', { ...form, creatorId: mockActor, submissionId: 'draft-1', initialSellPrice: 4999 });
  stored('submission_pending_submit', { submissionId: 'draft-1', sellPrice: 2999, submissionType: 'standard' });
  const screen = await review();
  expect(screen.getByLabelText('Website price').props.value).toBe('2999');
});

it.each([false, true])('hydrates a saved domain on reconnect and preserves a deliberate local price edit: %s', async edited => {
  mockOffline = true;
  stored('submission_snapshot', { ...form, creatorId: mockActor, submissionId: 'draft-1', initialSellPrice: 3999 });
  Object.assign(mockSubmissions['draft-1'], { amount: 2449, domainCostPHP: 450, requestedDomain: 'nenastore.com' });
  const screen = await review();
  expect(screen.getByLabelText('Website price').props.value).toBe('3999');
  if (edited) fireEvent.changeText(screen.getByLabelText('Website price'), '2999');
  mockOffline = false;
  screen.rerender(<SubmitReviewScreen />);
  await waitFor(() => expect(screen.getByLabelText('Custom domain (optional)').props.value).toBe('nenastore.com'));
  expect(screen.getByLabelText('Website price').props.value).toBe(edited ? '2999' : '1999');
});

it('restores an offline capture’s own saved initial price', async () => {
  mockOffline = true; stored('current_submission_id', 'offline_pending');
  stored('submission_pending_sync', { creatorId: mockActor, initialSellPrice: 3999, formData: form });
  stored('submission_pending_photos', { submissionId: 'offline_pending', photoUris: ['one', 'two', 'three'], existingPhotos: [] });
  stored('submission_pending_interview', { submissionId: 'offline_pending', type: 'audio', recordingUri: 'file://audio.m4a' });
  const screen = await review();
  expect(screen.getByLabelText('Website price').props.value).toBe('3999');
  fireEvent.press(screen.getByRole('button', { name: 'Save and queue' }));
  await act(async () => { confirmation('Save and queue')(); await flush(); });
  expect(mockWrite).toHaveBeenCalledWith('submission_pending_submit', expect.objectContaining({ sellPrice: 3999 }));
});

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

it('shows the current capture photo beside an unclamped business name with a fixed-size crop', async () => {
  const businessName = 'Nena and Family General Merchandise and Neighborhood Convenience Store';
  mockSubmissions['draft-1'].businessName = businessName;
  const screen = await review();
  const thumbnail = screen.getByRole('image', { name: `Shop photo for ${businessName}` });
  expect(thumbnail).toHaveProp('source', { uri: 'https://images.example.com/one' });
  expect(thumbnail).toHaveProp('resizeMode', 'cover');
  expect(thumbnail).toHaveStyle({ width: 56, height: 56, flexShrink: 0 });
  expect(screen.getByText(businessName).props.numberOfLines).toBeUndefined();
  fireEvent.press(screen.getAllByRole('link', { name: 'Edit' })[0]);
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/submit/info', params: { draftId: 'draft-1' } });
});

it.each([2, 3])('prefers the original Spot photo without adding it to the %i captured photos', async (count) => {
  mockSubmissions['draft-1'].prospectLeadId = 'source-find';
  mockSubmissions['draft-1'].photos = ['one', 'two', 'three'].slice(0, count);
  mockFinds['source-find'] = { lead: { _id: 'source-find' }, photoUrl: 'https://shared.example.com/spotted-shop.jpg' };
  const screen = await review();
  expect(mockFindLookup).toHaveBeenCalledWith({ id: 'source-find' });
  expect(screen.getByRole('image', { name: 'Shop photo for Nena Store' })).toHaveProp('source', {
    uri: 'https://shared.example.com/spotted-shop.jpg',
  });
  expect(screen.getByText(`${count} photos`)).toBeTruthy();
  expect(screen.getAllByLabelText(/^Shop photo \d+$/)).toHaveLength(count);
  for (const [index, key] of ['one', 'two', 'three'].slice(0, count).entries()) {
    expect(screen.getByLabelText(`Shop photo ${index + 1}`)).toHaveProp('source', { uri: 'https://images.example.com/' + key });
  }
  expect(screen.getByRole('button', { name: 'Send for review' }).props.accessibilityState.disabled).toBe(count < 3);
});

it.each([null, 'https://shared.example.com/broken.jpg'])('does not use another agent’s capture media when the shared cover is missing or broken: %s', async (photoUrl) => {
  mockSubmissions['draft-1'].prospectLeadId = 'source-find';
  mockSubmissions['draft-1'].photos = ['one'];
  mockFinds['source-find'] = { lead: { _id: 'source-find' }, photoUrl, canViewCaptureMedia: false,
    business: { photos: ['https://private.example.com/other-agent-capture.jpg'] } };
  const screen = await review();
  if (photoUrl) {
    const thumbnail = screen.getByRole('image', { name: 'Shop photo for Nena Store' });
    expect(thumbnail).toHaveProp('source', { uri: photoUrl });
    fireEvent(thumbnail, 'error', { nativeEvent: { error: 'Shared cover could not load' } });
  }
  const ownThumbnail = screen.getByRole('image', { name: 'Shop photo for Nena Store' });
  expect(ownThumbnail).toHaveProp('source', { uri: 'https://images.example.com/one' });
  fireEvent(ownThumbnail, 'error', { nativeEvent: { error: 'Own capture photo could not load' } });
  expect(screen.getByRole('image', { name: 'Shop photo unavailable for Nena Store' })).toBeTruthy();
  expect(screen.getAllByLabelText(/^Shop photo \d+$/)).toHaveLength(1);
});

it('keeps the owned server source link ahead of a different pending source link', async () => {
  mockSubmissions['draft-1'].prospectLeadId = 'original-source';
  stored('submission_pending_sync', { creatorId: mockActor, existingDraftId: 'draft-1', prospectLeadId: 'pending-source', formData: form });
  mockFinds['original-source'] = { lead: { _id: 'original-source' }, photoUrl: 'https://shared.example.com/original.jpg' };
  mockFinds['pending-source'] = { lead: { _id: 'pending-source' }, photoUrl: 'https://shared.example.com/other.jpg' };
  const screen = await review();
  expect(screen.getByRole('image', { name: 'Shop photo for Nena Store' })).toHaveProp('source', {
    uri: 'https://shared.example.com/original.jpg',
  });
  expect(mockFindLookup).toHaveBeenCalledWith({ id: 'original-source' });
  expect(mockFindLookup).not.toHaveBeenCalledWith({ id: 'pending-source' });
});

it('does not introduce a source lookup from pending details when the server draft is unlinked', async () => {
  stored('submission_pending_sync', { creatorId: mockActor, existingDraftId: 'draft-1', prospectLeadId: 'pending-source', formData: form });
  mockFinds['pending-source'] = { lead: { _id: 'pending-source' }, photoUrl: 'https://shared.example.com/pending.jpg' };
  const screen = await review();
  expect(mockFindLookup).not.toHaveBeenCalled();
  expect(screen.getByRole('image', { name: 'Shop photo for Nena Store' })).toHaveProp('source', {
    uri: 'https://images.example.com/one',
  });
});

it.each([
  { creatorId: 'another-agent', existingDraftId: 'draft-1' },
  { creatorId: 'agent-1', existingDraftId: 'other-draft' },
])('ignores a source link from mismatched cached capture details: %j', async (scope) => {
  stored('submission_pending_sync', { ...scope, prospectLeadId: 'wrong-source', formData: form });
  mockFinds['wrong-source'] = { lead: { _id: 'wrong-source' }, photoUrl: 'https://shared.example.com/wrong.jpg' };
  const screen = await review();
  expect(mockFindLookup).not.toHaveBeenCalled();
  expect(screen.getByRole('image', { name: 'Shop photo for Nena Store' })).toHaveProp('source', {
    uri: 'https://images.example.com/one',
  });
});

it('clears the original shop cover when the signed-in capture account changes', async () => {
  mockSubmissions['draft-1'].prospectLeadId = 'original-source';
  mockFinds['original-source'] = { lead: { _id: 'original-source' }, photoUrl: 'https://shared.example.com/original.jpg' };
  const screen = await review();
  expect(screen.getByRole('image', { name: 'Shop photo for Nena Store' })).toHaveProp('source', {
    uri: 'https://shared.example.com/original.jpg',
  });
  mockActor = 'agent-2';
  stored('current_submission_id', 'draft-2');
  mockSubmissions['draft-2'] = { ...mockSubmissions['draft-1'], _id: 'draft-2', creatorId: mockActor,
    businessName: 'Second Shop', prospectLeadId: undefined, photos: ['second-shop'] };
  mockFindLookup.mockClear();
  screen.rerender(<SubmitReviewScreen />);
  await waitFor(() => expect(screen.getByText('Second Shop')).toBeTruthy());
  expect(screen.queryByRole('image', { name: 'Shop photo for Nena Store' })).toBeNull();
  expect(screen.getByRole('image', { name: 'Shop photo for Second Shop' })).toHaveProp('source', {
    uri: 'https://images.example.com/second-shop',
  });
  expect(mockFindLookup).not.toHaveBeenCalled();
});

it('tries the next current-capture photo after a load failure and falls back safely if all fail', async () => {
  const screen = await review();
  for (const key of ['one', 'two', 'three']) {
    const thumbnail = screen.getByRole('image', { name: 'Shop photo for Nena Store' });
    expect(thumbnail).toHaveProp('source', { uri: 'https://images.example.com/' + key });
    fireEvent(thumbnail, 'error', { nativeEvent: { error: 'Image could not load' } });
  }
  const fallback = screen.getByRole('image', { name: 'Shop photo unavailable for Nena Store' });
  expect(fallback).toHaveStyle({ width: 56, height: 56 });
  expect(screen.queryByRole('image', { name: 'Shop photo for Nena Store' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Send for review' })).toBeEnabled();
});

it('uses the storefront fallback without inventing a photo when this capture has none', async () => {
  mockSubmissions['draft-1'].photos = [];
  const screen = await review();
  expect(screen.getByRole('image', { name: 'Shop photo unavailable for Nena Store' })).toBeTruthy();
  expect(screen.queryByRole('image', { name: 'Shop photo for Nena Store' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Send for review' })).toBeDisabled();
});

it('keeps the price comparison tiles equally flexible and stretched without fixed text heights', async () => {
  const screen = await review();
  expect(screen.getByTestId('capture-price-stats')).toHaveStyle({ flexDirection: 'row', alignItems: 'stretch' });
  for (const id of ['capture-earnings', 'capture-savings']) {
    const tile = screen.getByTestId(id);
    expect(tile).toHaveStyle({ flex: 1, minWidth: 0, justifyContent: 'flex-start' });
    expect(StyleSheet.flatten(tile.props.style).height).toBeUndefined();
  }
  for (const label of ['You keep after payment', 'The shop saves']) {
    const text = screen.getByText(label);
    expect(text.props.numberOfLines).toBeUndefined();
    expect(text.props.allowFontScaling).not.toBe(false);
  }
});

it('queues offline media and the selected price without sending or inventing a payout', async () => {
  mockOffline = true; stored('current_submission_id', 'offline_pending');
  stored('submission_pending_sync', { creatorId: mockActor, prospectLeadId: 'offline-source', formData: form });
  mockFinds['offline-source'] = { lead: { _id: 'offline-source' }, photoUrl: 'https://shared.example.com/offline-source.jpg' };
  stored('submission_pending_photos', { submissionId: 'offline_pending', photoUris: ['file://1', 'file://2', 'file://3'], existingPhotos: [] });
  stored('submission_pending_interview', { submissionId: 'offline_pending', recordingUri: 'file://interview.m4a', type: 'audio' });
  const screen = await review();
  expect(screen.getByRole('image', { name: 'Shop photo for Nena Store' })).toHaveProp('source', { uri: 'file://1' });
  expect(mockFindLookup).not.toHaveBeenCalled();
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

it('uses this draft’s cached photo offline and ignores another draft’s pending images', async () => {
  mockOffline = true;
  stored('submission_snapshot', { ...form, submissionId: 'draft-1', creatorId: mockActor });
  stored('submission_photo_tasks', { submissionId: 'draft-1', items: [{ uri: 'file://current-shop.jpg' }] });
  stored('submission_pending_photos', { submissionId: 'other-draft', photoUris: ['file://other-shop.jpg'], existingPhotos: [] });
  const screen = await review();
  expect(screen.getByRole('image', { name: 'Shop photo for Nena Store' })).toHaveProp('source', { uri: 'file://current-shop.jpg' });
  expect(screen.queryByLabelText('Shop photo 2')).toBeNull();
  expect(mockWrite).not.toHaveBeenCalled();
});

it.each(['', 'not-an-email'])('keeps a legacy draft with invalid email (%s) editable without submitting it', async (email) => {
  mockSubmissions['draft-1'].ownerEmail = email;
  const screen = await review();
  expect(screen.getByText('Owner’s email required')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Send for review' })).toBeDisabled();
  fireEvent.press(screen.getByRole('link', { name: 'Edit shop details' }));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/submit/info', params: { draftId: 'draft-1' } });
  expect(mockSetTier).not.toHaveBeenCalled(); expect(mockSubmit).not.toHaveBeenCalled();
  expect(mockRemove).not.toHaveBeenCalled();
});

it('does not queue an older offline capture until its missing owner email is added', async () => {
  mockOffline = true; stored('current_submission_id', 'offline_pending');
  const { ownerEmail: _email, ...legacyForm } = form;
  stored('submission_pending_sync', { creatorId: mockActor, formData: legacyForm });
  stored('submission_pending_photos', { submissionId: 'offline_pending', photoUris: ['file://1', 'file://2', 'file://3'], existingPhotos: [] });
  stored('submission_pending_interview', { submissionId: 'offline_pending', recordingUri: 'file://interview.m4a', type: 'audio' });
  const screen = await review();
  expect(screen.getByText('Owner’s email required')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save and queue' })).toBeDisabled();
  expect(mockWrite).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled();
  expect(mockStorage.get('agent-1:submission_pending_photos')).toBeTruthy();
  expect(mockSubmit).not.toHaveBeenCalled();
});

it('keeps ordinary Business edit on the exact draft shown in review', async () => {
  const screen = await review();
  fireEvent.press(screen.getAllByRole('link', { name: 'Edit' })[0]);
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/submit/info', params: { draftId: 'draft-1' } });
});

it('passes the offline pending target when repairing its email from review', async () => {
  mockOffline = true; stored('current_submission_id', 'offline_pending');
  stored('submission_pending_sync', { creatorId: mockActor, formData: { ...form, ownerEmail: '' } });
  const screen = await review();
  fireEvent.press(screen.getByRole('link', { name: 'Edit shop details' }));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/submit/info', params: { draftId: 'offline_pending' } });
  expect(mockWrite).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled();
});

it('uses corrected owned pending details and queues them before submitting a server draft with no email', async () => {
  mockSubmissions['draft-1'].ownerEmail = '';
  stored('submission_pending_sync', { creatorId: mockActor, existingDraftId: 'draft-1', formData: form });
  const screen = await review();
  expect(screen.queryByText('Owner’s email required')).toBeNull();
  expect(screen.getByText('nena@example.com')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save and queue' }));
  await act(async () => { confirmation('Save and queue')(); await flush(); });
  expect(mockWrite).toHaveBeenCalledWith('submission_pending_submit', expect.objectContaining({ submissionId: 'draft-1' }));
  expect(mockSetTier).not.toHaveBeenCalled(); expect(mockSubmit).not.toHaveBeenCalled();
});

it('blocks a foreign server capture even if local metadata would otherwise allow sending', async () => {
  mockSubmissions['draft-1'] = { ...mockSubmissions['draft-1'], creatorId: 'another-agent', businessName: 'Private shop', prospectLeadId: 'private-source' };
  stored('submission_pending_sync', { creatorId: mockActor, existingDraftId: 'draft-1', prospectLeadId: 'private-source', formData: form });
  mockFinds['private-source'] = { lead: { _id: 'private-source' }, photoUrl: 'https://shared.example.com/private-source.jpg' };
  stored('submission_snapshot', { ...form, submissionId: 'draft-1', creatorId: mockActor });
  stored('submission_pending_photos', { submissionId: 'draft-1', photoUris: ['file://1', 'file://2', 'file://3'], existingPhotos: [] });
  stored('submission_pending_interview', { submissionId: 'draft-1', recordingUri: 'file://take.m4a', type: 'audio' });
  const screen = render(<SubmitReviewScreen />);
  await act(flush);
  expect(screen.queryByRole('button', { name: 'Send for review' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Save and queue' })).toBeNull();
  expect(screen.queryByText('Private shop')).toBeNull();
  expect(screen.queryByRole('image', { name: /Shop photo/ })).toBeNull();
  expect(mockFindLookup).not.toHaveBeenCalled();
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
