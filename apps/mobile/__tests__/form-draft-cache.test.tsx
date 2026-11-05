import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFormDraftCache } from '../hooks/useFormDraftCache';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}), removeItem: jest.fn(async () => {}),
}));

const actor = { creatorId: 'agent-one' as any, clerkId: 'clerk-one' };
const details = { businessName: 'Saved shop', businessType: 'Restaurant', ownerName: 'Owner',
  ownerPhone: '9171234567', ownerEmail: 'owner@example.com', address: 'Main St', city: 'Marikina', submissionId: 'draft-one' };
let onState: (state: string) => void;

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    onState = listener as typeof onState;
    return { remove: jest.fn() };
  });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it('flushes the latest keystrokes on background before the debounce expires', async () => {
  const { result } = renderHook(() => useFormDraftCache(actor));
  act(() => { result.current.saveDraft(details); result.current.saveDraft({ ...details, businessType: 'Barber/Salon' }); });
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await act(async () => { onState('inactive'); });
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  expect(JSON.parse(jest.mocked(AsyncStorage.setItem).mock.calls[0][1])).toMatchObject({ ...details, businessType: 'Barber/Salon' });
});

it('flushes on unmount and keeps a pending actor switch in its original account', async () => {
  const { result, rerender, unmount } = renderHook(({ account }) => useFormDraftCache(account), { initialProps: { account: actor } });
  act(() => { result.current.saveDraft(details); });
  await act(async () => { rerender({ account: { creatorId: 'agent-two' as any, clerkId: 'clerk-two' } }); });
  act(() => { result.current.saveDraft({ ...details, businessName: 'Second shop' }); });
  await act(async () => { unmount(); });
  expect(jest.mocked(AsyncStorage.setItem).mock.calls.map(([key, raw]) => [key, JSON.parse(raw).businessName])).toEqual([
    ['capture:v2:agent-one:submission_draft_form', 'Saved shop'],
    ['capture:v2:agent-two:submission_draft_form', 'Second shop'],
  ]);
});

it('clearing after Continue cancels pending edits and does not recreate the cache on unmount', async () => {
  const { result, unmount } = renderHook(() => useFormDraftCache(actor));
  act(() => { result.current.saveDraft(details); });
  await act(async () => { await result.current.clearDraft(); unmount(); jest.runOnlyPendingTimers(); });
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('capture:v2:agent-one:submission_draft_form');
});

it('serializes a clear behind an already-running save so a late write cannot resurrect the draft', async () => {
  let finish!: () => void;
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { result, unmount } = renderHook(() => useFormDraftCache(actor));
  act(() => { result.current.saveDraft(details); });
  await act(async () => { jest.advanceTimersByTime(500); });
  let cleared!: Promise<void>;
  act(() => { cleared = result.current.clearDraft(); });
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  await act(async () => { finish(); await cleared; });
  expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
  unmount();
});
