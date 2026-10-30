import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { useMobileAccount } from '../hooks/useMobileAccount';
import { useWorkAreaLocation } from '../hooks/useWorkAreaLocation';

jest.mock('../hooks/useMobileAccount', () => ({ useMobileAccount: jest.fn() }));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const mockAccount = useMobileAccount as jest.Mock;
const mockPermission = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPosition = Location.getCurrentPositionAsync as jest.Mock;
const savedAccount = { workCity: 'Marikina', workLatitude: 14.65, workLongitude: 121.1 };

describe('map work-area location', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccount.mockReturnValue({ account: savedAccount, isLoading: false });
    mockPermission.mockResolvedValue({ status: 'granted' });
    mockPosition.mockResolvedValue({ coords: { latitude: 10.3, longitude: 123.9 } });
  });

  afterEach(() => jest.useRealTimers());

  it('shows the saved city immediately without a GPS permission request or a fake user position', () => {
    const { result } = renderHook(() => useWorkAreaLocation());
    expect(result.current.area).toEqual({ latitude: 14.65, longitude: 121.1, source: 'work', label: 'Marikina' });
    expect(result.current.currentLocation).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mockPermission).not.toHaveBeenCalled();
    expect(mockPosition).not.toHaveBeenCalled();
  });

  it('waits for the account before deciding whether GPS is necessary', () => {
    mockAccount.mockReturnValue({ account: undefined, isLoading: true });
    const { result, rerender } = renderHook(() => useWorkAreaLocation());
    expect(result.current.isLoading).toBe(true);
    expect(mockPermission).not.toHaveBeenCalled();
    mockAccount.mockReturnValue({ account: savedAccount, isLoading: false });
    rerender({});
    expect(result.current.area?.source).toBe('work');
    expect(mockPermission).not.toHaveBeenCalled();
  });

  it('uses GPS only when the agent explicitly asks to override a saved city', async () => {
    const { result } = renderHook(() => useWorkAreaLocation());
    await act(async () => { await result.current.requestCurrentLocation(); });
    expect(mockPermission).toHaveBeenCalledTimes(1);
    expect(result.current.area).toEqual({ latitude: 10.3, longitude: 123.9, source: 'device', label: 'you' });
    expect(result.current.currentLocation).toEqual({ latitude: 10.3, longitude: 123.9 });
  });

  it('retains the saved city when an explicit GPS request is denied', async () => {
    mockPermission.mockResolvedValue({ status: 'denied' });
    const { result } = renderHook(() => useWorkAreaLocation());
    await act(async () => { await result.current.requestCurrentLocation(); });
    expect(result.current.area?.source).toBe('work');
    expect(result.current.permissionStatus).toBe('denied');
    expect(result.current.currentLocation).toBeNull();
    expect(mockPosition).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('uses GPS as a fallback for a custom city without coordinates', async () => {
    mockAccount.mockReturnValue({ account: { workCity: 'A custom town' }, isLoading: false });
    const { result } = renderHook(() => useWorkAreaLocation());
    await waitFor(() => expect(result.current.area?.source).toBe('device'));
    expect(mockPermission).toHaveBeenCalledTimes(1);
  });

  it('lets the map finish loading when a phone never returns a GPS fix', async () => {
    jest.useFakeTimers();
    mockAccount.mockReturnValue({ account: {}, isLoading: false });
    mockPosition.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useWorkAreaLocation());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.isLoading).toBe(true);
    await act(async () => { jest.advanceTimersByTime(15_000); });
    expect(result.current.permissionStatus).toBe('unavailable');
    expect(result.current.area).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('does not overlap multiple taps on Use my location', async () => {
    let finishPosition!: (value: unknown) => void;
    mockPosition.mockImplementation(() => new Promise((resolve) => { finishPosition = resolve; }));
    const { result } = renderHook(() => useWorkAreaLocation());
    await act(async () => {
      void result.current.requestCurrentLocation();
      void result.current.requestCurrentLocation();
      await Promise.resolve();
    });
    expect(mockPermission).toHaveBeenCalledTimes(1);
    await act(async () => { finishPosition({ coords: { latitude: 10.3, longitude: 123.9 } }); });
    expect(result.current.isLocating).toBe(false);
  });

  it('keeps its center stable for account updates and discards GPS across accounts', async () => {
    mockAccount.mockReturnValue({ account: { ...savedAccount, _id: 'agent-one' }, isLoading: false });
    const { result, rerender } = renderHook(() => useWorkAreaLocation());
    const originalArea = result.current.area;
    mockAccount.mockReturnValue({ account: { ...savedAccount, _id: 'agent-one', totalEarnings: 500 }, isLoading: false });
    rerender({});
    expect(result.current.area).toBe(originalArea);
    await act(async () => { await result.current.requestCurrentLocation(); });
    expect(result.current.currentLocation).not.toBeNull();
    mockAccount.mockReturnValue({ account: { ...savedAccount, _id: 'agent-two' }, isLoading: false });
    rerender({});
    expect(result.current.currentLocation).toBeNull();
    expect(result.current.area?.source).toBe('work');
    expect(result.current.permissionStatus).toBe('idle');
    expect(mockPermission).toHaveBeenCalledTimes(1);
    mockAccount.mockReturnValue({ account: { ...savedAccount, _id: 'agent-one' }, isLoading: false });
    rerender({});
    expect(result.current.currentLocation).toBeNull();
    expect(result.current.area?.source).toBe('work');
    expect(mockPermission).toHaveBeenCalledTimes(1);
  });

  it('ignores an old GPS response that completes after an account switch', async () => {
    let finishPosition!: (value: unknown) => void;
    mockPosition.mockImplementation(() => new Promise((resolve) => { finishPosition = resolve; }));
    mockAccount.mockReturnValue({ account: { ...savedAccount, _id: 'agent-one' }, isLoading: false });
    const { result, rerender } = renderHook(() => useWorkAreaLocation());
    await act(async () => { void result.current.requestCurrentLocation(); await Promise.resolve(); });
    mockAccount.mockReturnValue({ account: { ...savedAccount, _id: 'agent-two' }, isLoading: false });
    rerender({});
    await act(async () => { finishPosition({ coords: { latitude: 10.3, longitude: 123.9 } }); });
    expect(result.current.currentLocation).toBeNull();
    expect(result.current.permissionStatus).toBe('idle');
    expect(result.current.area?.source).toBe('work');
  });
});
