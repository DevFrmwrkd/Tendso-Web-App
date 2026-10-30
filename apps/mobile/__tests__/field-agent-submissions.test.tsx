import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import SubmissionsScreen from '../app/(app)/submissions';
import SubmissionDetail from '../app/(app)/submissions/[id]';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockWrite = jest.fn();
const mockRead = jest.fn();
const mockQuery = jest.fn();
let mockActor: string;
let mockId: string;
let mockAuthenticated: boolean;
let mockData: any[];
let mockDetail: any;
let mockPointer: string;

jest.mock('../hooks/useGuardedRouter', () => ({ useGuardedRouter: () => mockRouter }));
jest.mock('@clerk/clerk-expo', () => ({ useUser: () => ({ user: { id: `clerk-${mockActor}` }, isLoaded: true }) }));
jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: () => ({
  account: { _id: mockActor, clerkId: `clerk-${mockActor}`, role: 'creator' }, isAuthenticated: mockAuthenticated,
  isOffline: false, isBlocked: false, isPreview: false, isLoading: false,
}) }));
jest.mock('../hooks/useCaptureSession', () => ({ useCaptureSession: () => {
  const actor = mockActor;
  return { actor: { creatorId: actor }, isCurrent: () => actor === mockActor,
    canMutate: () => actor === mockActor && mockAuthenticated,
    read: (...args: unknown[]) => mockRead(...args), write: (...args: unknown[]) => mockWrite(...args) };
} }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]) }));
jest.mock('../components/GuardedLink', () => ({ GuardedLink: ({ href, children }: any) =>
  require('react').cloneElement(children, { onPress: () => mockRouter.push(href) }) }));
jest.mock('@tendso/convex-client', () => ({ api: {
  submissions: { getByCreatorId: 'list', getById: 'detail' },
  files: { getMultipleUrls: 'photos' }, r2: { getStreamableUrl: 'stream' },
} }));
jest.mock('convex/react', () => ({ useQuery: (name: string, args: any) => {
  mockQuery(name, args);
  if (args === 'skip') return undefined;
  if (name === 'list') return mockData;
  if (name === 'detail') return mockDetail;
  if (name === 'photos') return [];
  return null;
} }));
jest.mock('../services/links', () => ({ openExternalUrl: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-av', () => ({ Video: require('react-native').View, ResizeMode: {}, Audio: {} }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Defs: 'Defs', LinearGradient: 'Gradient', Rect: 'Rect', Stop: 'Stop' }));

const row = (id: string, name: string, status: string, city = 'Marikina', creatorId = 'agent-one') => ({
  _id: id, _creationTime: Date.UTC(2026, 9, 1), creatorId, businessName: name, businessType: 'Food', city,
  ownerName: 'Shop Owner', ownerPhone: '09170000000', address: 'Main Street', status,
  photos: status === 'draft' ? [] : ['owned-photo'], audioStorageId: status === 'draft' ? undefined : 'owned-audio',
});

beforeEach(() => {
  jest.clearAllMocks(); mockActor = 'agent-one'; mockId = 'draft-one'; mockAuthenticated = true;
  mockData = [row('draft-one', 'Kalan Kitchen', 'draft'), row('paid-one', 'Salon Studio', 'paid', 'Pasig'),
    row('foreign', 'Private Other Shop', 'paid', 'Manila', 'agent-two')];
  mockDetail = mockData[0]; mockPointer = 'previous-draft';
  mockWrite.mockReset().mockImplementation(async (_key, value) => { mockPointer = value; });
  mockRead.mockReset().mockImplementation(async () => mockPointer);
});

it('searches owned shops by name, type or city and combines the status filter', () => {
  const screen = render(<SubmissionsScreen />);
  expect(screen.queryByText('Private Other Shop')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Search submissions' }));
  fireEvent.changeText(screen.getByPlaceholderText('Shop, type or city'), '  PASIG  ');
  expect(screen.getByText('Salon Studio')).toBeTruthy();
  expect(screen.queryByText('Kalan Kitchen')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Drafts' }));
  expect(screen.getByText('No matching shops')).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText('Shop, type or city'), 'food');
  expect(screen.getByText('Kalan Kitchen')).toBeTruthy();
});

it('closing search clears its filter and keeps the cards tappable', () => {
  const screen = render(<SubmissionsScreen />);
  fireEvent.press(screen.getByRole('button', { name: 'Search submissions' }));
  fireEvent.changeText(screen.getByPlaceholderText('Shop, type or city'), 'missing');
  fireEvent.press(screen.getByRole('button', { name: 'Close submission search' }));
  fireEvent.press(screen.getByRole('button', { name: 'Kalan Kitchen, Draft' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/(app)/submissions/draft-one');
});

it('uses the existing read query and scopes resume to the owned draft through explicit hydration', async () => {
  const screen = render(<SubmissionDetail />);
  fireEvent.press(screen.getByRole('button', { name: 'Continue submission' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/(app)/submit/info', params: { draftId: 'draft-one' } }));
  expect(mockQuery).toHaveBeenCalledWith('detail', { id: 'draft-one' });
  expect(mockWrite).toHaveBeenCalledWith('current_submission_id', 'draft-one');
});

it('rejects another creator’s submission before any private media resolution or resume', () => {
  mockDetail = row('foreign', 'Private Other Shop', 'draft', 'Manila', 'agent-two');
  mockDetail.photos = ['private-photo']; mockDetail.videoStorageId = 'private-video';
  const screen = render(<SubmissionDetail />);
  expect(screen.getByText('Shop not found')).toBeTruthy();
  expect(screen.queryByText('Private Other Shop')).toBeNull();
  expect(screen.queryByText('Continue submission')).toBeNull();
  expect(mockQuery).not.toHaveBeenCalledWith('photos', expect.objectContaining({ storageIds: ['private-photo'] }));
  expect(mockQuery).not.toHaveBeenCalledWith('stream', { fileKey: 'private-video' });
  expect(mockWrite).not.toHaveBeenCalled();
});

it('does not turn an incomplete sent submission into an editable draft', () => {
  mockDetail = { ...mockDetail, status: 'submitted' };
  expect(render(<SubmissionDetail />).queryByText('Continue submission')).toBeNull();
});

it('does not navigate after the actor changes during the scoped write', async () => {
  let finish!: () => void;
  mockWrite.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const screen = render(<SubmissionDetail />);
  fireEvent.press(screen.getByRole('button', { name: 'Continue submission' }));
  mockActor = 'agent-two';
  screen.rerender(<SubmissionDetail />);
  await act(async () => { finish(); });
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it('shows a retryable resume error when storage fails', async () => {
  mockWrite.mockRejectedValueOnce(new Error('Device storage full'));
  const screen = render(<SubmissionDetail />);
  fireEvent.press(screen.getByRole('button', { name: 'Continue submission' }));
  await waitFor(() => expect(screen.getByText('Could not reopen this draft. Please try again.')).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Continue submission' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
});
