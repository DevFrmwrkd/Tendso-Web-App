import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

const mockCheck = jest.fn();
const mockFetch = jest.fn();
const mockReload = jest.fn();
let mockEnabled = true;

jest.mock('expo-updates', () => ({
  get isEnabled() {
    return mockEnabled;
  },
  checkForUpdateAsync: (...a: unknown[]) => mockCheck(...a),
  fetchUpdateAsync: (...a: unknown[]) => mockFetch(...a),
  reloadAsync: (...a: unknown[]) => mockReload(...a),
}));

import { useOtaUpdate } from '../hooks/useOtaUpdate';

type Listener = (s: string) => void;
let listener: Listener;
const remove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockEnabled = true;
  (global as any).__DEV__ = false;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, l: Listener) => {
    listener = l;
    return { remove };
  }) as any);
  (AppState as any).currentState = 'active';
});

const background = () => act(() => listener('background'));
const foreground = async () => {
  await act(async () => {
    listener('active');
  });
};

it('is disabled when expo-updates is not active', () => {
  mockEnabled = false;
  const { result } = renderHook(() => useOtaUpdate());
  expect(result.current.status).toBe('disabled');
  expect(AppState.addEventListener).not.toHaveBeenCalled();
});

it('downloads on foreground and waits for the next launch (never reloads)', async () => {
  mockCheck.mockResolvedValue({ isAvailable: true });
  mockFetch.mockResolvedValue({ isNew: true });
  const { result } = renderHook(() => useOtaUpdate({ minIntervalMs: 0 }));
  background();
  await foreground();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe('ready');
  expect(result.current.updateReady).toBe(true);
  expect(mockReload).not.toHaveBeenCalled();
});

it('does not download when nothing is available', async () => {
  mockCheck.mockResolvedValue({ isAvailable: false });
  const { result } = renderHook(() => useOtaUpdate({ minIntervalMs: 0 }));
  background();
  await foreground();
  expect(mockFetch).not.toHaveBeenCalled();
  expect(result.current.status).toBe('idle');
});

it('throttles repeated foregrounds', async () => {
  mockCheck.mockResolvedValue({ isAvailable: false });
  renderHook(() => useOtaUpdate({ minIntervalMs: 60_000 }));
  background();
  await foreground();
  background();
  await foreground();
  expect(mockCheck).toHaveBeenCalledTimes(1);
});

it('swallows errors and reports them as status', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  mockCheck.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useOtaUpdate({ minIntervalMs: 0 }));
  background();
  await foreground();
  expect(result.current.status).toBe('error');
  warn.mockRestore();
});

it('only reloads when applyNow is called explicitly', async () => {
  const { result } = renderHook(() => useOtaUpdate());
  await act(async () => {
    await result.current.applyNow();
  });
  expect(mockReload).toHaveBeenCalledTimes(1);
});
