import React from 'react';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { useWalletThumbnails } from '../hooks/useWalletThumbnails';
import { WalletShopThumbnail } from '../components/wallet/WalletShopThumbnail';

const mockResolve = jest.fn();
const mockClient = { query: mockResolve };
const mockSubmissionQuery = jest.fn();
let mockSubmissions: Record<string, any[] | undefined>;
jest.mock('@tendso/convex-client', () => ({ api: {
  submissions: { getByCreatorId: 'own-submissions' }, files: { getMultipleUrls: 'urls' },
} }));
jest.mock('convex/react', () => ({
  useConvex: () => mockClient,
  useQuery: (reference: string, args: any) => {
    if (args === 'skip') return undefined;
    mockSubmissionQuery(reference, args);
    return mockSubmissions[args.creatorId];
  },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const actor = { creatorId: 'agent-a', clerkId: 'clerk-a', isAuthenticated: true, isAffiliate: false, isOffline: false };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

beforeEach(() => {
  jest.clearAllMocks();
  mockSubmissions = {
    'agent-a': [
      { _id: 'shop-a', creatorId: 'agent-a', photos: ['images/a.jpg', 'images/unused.jpg'], amount: 2999, status: 'paid' },
      { _id: 'same-photo', creatorId: 'agent-a', photos: ['images/a.jpg'], amount: 3999, status: 'completed' },
      { _id: 'draft-a', creatorId: 'agent-a', photos: [], amount: 999, status: 'draft' },
      { _id: 'foreign-shop', creatorId: 'agent-b', photos: ['images/private.jpg'], amount: 4999, status: 'paid' },
    ],
    'agent-b': [{ _id: 'shop-b', creatorId: 'agent-b', photos: ['images/b.jpg'], amount: 1999, status: 'paid' }],
  };
  mockResolve.mockReset().mockResolvedValue(['https://images.example.com/a.jpg']);
});

it('batches only verified own first-photo keys and returns genuine amount and payment status', async () => {
  const { result } = renderHook(() => useWalletThumbnails(actor));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(mockSubmissionQuery).toHaveBeenCalledWith('own-submissions', { creatorId: 'agent-a' });
  expect(mockResolve).toHaveBeenCalledTimes(1);
  expect(mockResolve).toHaveBeenCalledWith('urls', { storageIds: ['images/a.jpg'] });
  expect(result.current.bySubmission.get('shop-a')).toEqual({ thumbnailUrl: 'https://images.example.com/a.jpg', submissionPrice: 2999, paid: true });
  expect(result.current.bySubmission.get('same-photo')?.paid).toBe(true);
  expect(result.current.bySubmission.get('draft-a')).toEqual({ thumbnailUrl: null, submissionPrice: 999, paid: false });
  expect(result.current.bySubmission.has('foreign-shop')).toBe(false);
});

it('limits URL resolution to requested home/history submission IDs without looking up arbitrary submissions', async () => {
  const { result, rerender } = renderHook(props => useWalletThumbnails(props), { initialProps: { ...actor, submissionIds: ['draft-a'] } });
  expect(result.current.bySubmission.has('shop-a')).toBe(false);
  expect(mockResolve).not.toHaveBeenCalled();
  rerender({ ...actor, submissionIds: ['shop-a', 'foreign-shop'] });
  await waitFor(() => expect(result.current.bySubmission.get('shop-a')?.thumbnailUrl).toBe('https://images.example.com/a.jpg'));
  expect(mockResolve).toHaveBeenCalledWith('urls', { storageIds: ['images/a.jpg'] });
  expect(result.current.bySubmission.has('foreign-shop')).toBe(false);
});

it.each([
  { isAuthenticated: false }, { isAffiliate: true }, { isOffline: true }, { clerkId: undefined }, { creatorId: undefined },
])('skips private media work when the actor is not eligible: %j', (override) => {
  const { result } = renderHook(() => useWalletThumbnails({ ...actor, ...override }));
  expect(result.current.bySubmission.size).toBe(0);
  expect(result.current.isLoading).toBe(false);
  expect(mockSubmissionQuery).not.toHaveBeenCalled();
  expect(mockResolve).not.toHaveBeenCalled();
});

it('does not attach an earlier account’s delayed URLs to the next account', async () => {
  let resolveA!: (urls: string[]) => void;
  let resolveB!: (urls: string[]) => void;
  mockResolve.mockReturnValueOnce(new Promise(resolve => { resolveA = resolve; }))
    .mockReturnValueOnce(new Promise(resolve => { resolveB = resolve; }));
  const { result, rerender } = renderHook(props => useWalletThumbnails(props), { initialProps: actor });
  rerender({ ...actor, creatorId: 'agent-b', clerkId: 'clerk-b' });
  expect(result.current.bySubmission.has('shop-a')).toBe(false);
  await act(async () => { resolveA(['https://images.example.com/old-account.jpg']); await flush(); });
  expect(result.current.bySubmission.get('shop-b')?.thumbnailUrl).toBeNull();
  await act(async () => { resolveB(['https://images.example.com/b.jpg']); await flush(); });
  expect(result.current.bySubmission.get('shop-b')?.thumbnailUrl).toBe('https://images.example.com/b.jpg');
});

it('ignores old URL results when the requested source keys change within the same account', async () => {
  mockSubmissions['agent-a']!.push({ _id: 'another-shop', creatorId: 'agent-a', photos: ['images/new.jpg'], amount: 2499, status: 'paid' });
  let oldResult!: (urls: string[]) => void;
  let newResult!: (urls: string[]) => void;
  mockResolve.mockReturnValueOnce(new Promise(resolve => { oldResult = resolve; }))
    .mockReturnValueOnce(new Promise(resolve => { newResult = resolve; }));
  const { result, rerender } = renderHook(props => useWalletThumbnails(props), { initialProps: { ...actor, submissionIds: ['shop-a'] } });
  rerender({ ...actor, submissionIds: ['another-shop'] });
  await act(async () => { oldResult(['https://images.example.com/stale.jpg']); await flush(); });
  expect(result.current.bySubmission.get('another-shop')?.thumbnailUrl).toBeNull();
  await act(async () => { newResult(['https://images.example.com/new.jpg']); await flush(); });
  expect(result.current.bySubmission.get('another-shop')?.thumbnailUrl).toBe('https://images.example.com/new.jpg');
});

it('clears resolved media immediately when authentication or role access is revoked', async () => {
  const { result, rerender } = renderHook(props => useWalletThumbnails(props), { initialProps: actor });
  await waitFor(() => expect(result.current.bySubmission.get('shop-a')?.thumbnailUrl).toBeTruthy());
  rerender({ ...actor, isAuthenticated: false });
  expect(result.current.bySubmission.size).toBe(0);
  expect(result.current.isLoading).toBe(false);
});

it('leaves a safe placeholder after failed or mismatched URL responses while retaining genuine financial data', async () => {
  mockResolve.mockRejectedValueOnce(new Error('Offline'));
  const { result } = renderHook(() => useWalletThumbnails(actor));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.bySubmission.get('shop-a')).toEqual({ thumbnailUrl: null, submissionPrice: 2999, paid: true });
});

it('does not assign URLs with an unexpected array length to a different capture', async () => {
  mockResolve.mockResolvedValueOnce(['https://images.example.com/unmatched.jpg', 'https://images.example.com/extra.jpg']);
  const { result } = renderHook(() => useWalletThumbnails(actor));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.bySubmission.get('shop-a')?.thumbnailUrl).toBeNull();
});

it('falls back on image errors and does not let an old image error hide a new photo', () => {
  const view = render(<WalletShopThumbnail name="Kalan" url="https://images.example.com/a.jpg" />);
  const oldError = view.getByRole('image', { name: 'Kalan photo' }).props.onError;
  fireEvent(view.getByRole('image', { name: 'Kalan photo' }), 'error', {});
  expect(view.getByRole('image', { name: 'Kalan photo unavailable' })).toBeTruthy();
  view.rerender(<WalletShopThumbnail name="Kalan" url="https://images.example.com/b.jpg" />);
  act(() => oldError());
  expect(view.getByRole('image', { name: 'Kalan photo' })).toHaveProp('source', { uri: 'https://images.example.com/b.jpg' });
});
