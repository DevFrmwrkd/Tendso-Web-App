import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFieldAgentPrice } from '../hooks/useFieldAgentPrice';
import { FIELD_AGENT_PRICE_OPTIONS, fieldAgentPriceKey, readFieldAgentPrice, writeFieldAgentPrice } from '../services/fieldAgentPrice';

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
}));
const actor = { clerkId: 'clerk-a', creatorId: 'agent-a' };
const other = { clerkId: 'clerk-b', creatorId: 'agent-b' };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  mockStorage.clear(); jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockReset().mockImplementation(async key => mockStorage.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockReset().mockImplementation(async (key, value) => { mockStorage.set(key, value); });
});

it('loads 999 when unset and persists exact valid defaults for the same account only', async () => {
  expect(FIELD_AGENT_PRICE_OPTIONS).toEqual([999, 1999, 2999, 3999, 4999]);
  const view = renderHook(() => useFieldAgentPrice(actor));
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  expect(view.result.current.price).toBe(999);
  await act(async () => { expect(await view.result.current.setPrice(2999)).toBe(true); });
  expect(mockStorage.get(fieldAgentPriceKey(actor))).toBe('2999');
  expect(view.result.current.price).toBe(2999);
  view.unmount();
  expect(await readFieldAgentPrice(actor)).toBe(2999);
  expect(await readFieldAgentPrice(other)).toBe(999);
  expect(fieldAgentPriceKey({ ...actor, clerkId: other.clerkId })).not.toBe(fieldAgentPriceKey(actor));
});

it.each([998, 5000, NaN, Infinity, 1999.5])('rejects invalid setting %s without writing or changing the displayed default', async price => {
  mockStorage.set(fieldAgentPriceKey(actor), '1999');
  const view = renderHook(() => useFieldAgentPrice(actor));
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  await act(async () => { expect(await view.result.current.setPrice(price)).toBe(false); });
  expect(view.result.current.price).toBe(1999);
  expect(view.result.current.error).toContain('between');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it.each(['broken json', '5000', '"2999"', 'null'])('uses the safe default for corrupt persisted value %s', async raw => {
  mockStorage.set(fieldAgentPriceKey(actor), raw);
  expect(await readFieldAgentPrice(actor)).toBe(999);
});

it('reports failed storage writes and keeps the last successfully saved price', async () => {
  mockStorage.set(fieldAgentPriceKey(actor), '1999');
  const view = renderHook(() => useFieldAgentPrice(actor));
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
  await act(async () => { expect(await view.result.current.setPrice(4999)).toBe(false); });
  expect(view.result.current.price).toBe(1999);
  expect(view.result.current.saving).toBe(false);
  expect(view.result.current.error).toContain('Could not save');
  expect(mockStorage.get(fieldAgentPriceKey(actor))).toBe('1999');
});

it('does not expose a previous actor price while the next actor is loading or after a delayed old read', async () => {
  const oldRead = deferred<string | null>();
  jest.mocked(AsyncStorage.getItem).mockImplementation(key => key === fieldAgentPriceKey(actor) ? oldRead.promise : Promise.resolve('3999'));
  const view = renderHook(({ account }) => useFieldAgentPrice(account), { initialProps: { account: actor } });
  view.rerender({ account: other });
  await waitFor(() => expect(view.result.current.price).toBe(3999));
  await act(async () => { oldRead.resolve('4999'); });
  expect(view.result.current.price).toBe(3999);
  expect(view.result.current.error).toBe('');
});

it('keeps stale save completion in its original storage scope and does not mutate the new actor UI', async () => {
  const oldWrite = deferred<void>();
  const view = renderHook(({ account }) => useFieldAgentPrice(account), { initialProps: { account: actor } });
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, value) => {
    await oldWrite.promise; mockStorage.set(key, value);
  });
  let saved!: Promise<boolean>;
  act(() => { saved = view.result.current.setPrice(4999); });
  expect(view.result.current.saving).toBe(true);
  view.rerender({ account: other });
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  await act(async () => { oldWrite.resolve(); expect(await saved).toBe(false); });
  expect(view.result.current.price).toBe(999);
  expect(view.result.current.saving).toBe(false);
  expect(mockStorage.get(fieldAgentPriceKey(actor))).toBe('4999');
  expect(mockStorage.has(fieldAgentPriceKey(other))).toBe(false);
});

it('ignores a delayed stale read after another component saves the same account preference', async () => {
  const read = deferred<string | null>();
  jest.mocked(AsyncStorage.getItem).mockReturnValueOnce(read.promise);
  const view = renderHook(() => useFieldAgentPrice(actor));
  await act(async () => { await writeFieldAgentPrice(actor, 2999); read.resolve('1999'); });
  expect(view.result.current.price).toBe(2999);
  expect(view.result.current.loaded).toBe(true);
});

it('shows a load error and does not treat unreadable storage as a saved preference', async () => {
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('unavailable'));
  const view = renderHook(() => useFieldAgentPrice(actor));
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  expect(view.result.current.error).toContain('Could not load');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
