import { mapDistanceLabel, mapSearchArea, validMapCoordinate, withLocationTimeout } from '../services/workArea';

describe('field agent map work area', () => {
  const saved = { workCity: 'Marikina', workLatitude: 14.65, workLongitude: 121.1, workLocationSource: 'city' as const };

  it('uses the selected work area before asking for a phone location', () => {
    expect(mapSearchArea(saved)).toEqual({ latitude: 14.65, longitude: 121.1, source: 'work', label: 'Marikina' });
  });

  it('uses a canonical city center when saved coordinates are absent or invalid', () => {
    const city = mapSearchArea({ workCity: ' marikina ' });
    expect(city).toEqual(expect.objectContaining({ source: 'work', label: 'marikina' }));
    expect(validMapCoordinate(city)).toBe(true);
    expect(mapSearchArea({ workCity: 'Marikina', workLatitude: NaN, workLongitude: 999 }))
      .toEqual(expect.objectContaining({ latitude: city?.latitude, longitude: city?.longitude }));
  });

  it('lets an explicitly requested live location override the saved area', () => {
    expect(mapSearchArea(saved, { latitude: 10.3, longitude: 123.9 }))
      .toEqual({ latitude: 10.3, longitude: 123.9, source: 'device', label: 'you' });
  });

  it('retains the work area when GPS is unavailable or invalid', () => {
    expect(mapSearchArea(saved, null)?.source).toBe('work');
    expect(mapSearchArea(saved, { latitude: 91, longitude: 121 })?.source).toBe('work');
  });

  it('does not treat a stored device location as a live user position', () => {
    expect(mapSearchArea({ ...saved, workLocationSource: 'device' })?.source).toBe('work');
  });

  it('falls back to no location for an unmapped custom city so GPS can be requested', () => {
    expect(mapSearchArea({ workCity: 'A custom town' })).toBeNull();
    expect(mapSearchArea({ workLatitude: 12 })).toBeNull();
    expect(mapSearchArea(undefined)).toBeNull();
  });

  it('explains city-center distances without claiming the shop is that far from the phone', () => {
    expect(mapDistanceLabel(2, mapSearchArea(saved))).toBe('2.0 km from Marikina');
    expect(mapDistanceLabel(0.3, mapSearchArea(saved, { latitude: 14.6, longitude: 121 }))).toBe('300 m away');
    expect(mapDistanceLabel(null, mapSearchArea(saved))).toBe('Distance unavailable');
  });

  it('settles an unavailable GPS request instead of leaving the map blocked', async () => {
    jest.useFakeTimers();
    const result = withLocationTimeout(new Promise<never>(() => {}), 100);
    const rejection = expect(result).rejects.toThrow('Location timed out');
    jest.advanceTimersByTime(100);
    await rejection;
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('clears its timeout after a successful GPS fix', async () => {
    jest.useFakeTimers();
    expect(await withLocationTimeout(Promise.resolve({ latitude: 14.6, longitude: 121 })))
      .toEqual({ latitude: 14.6, longitude: 121 });
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
});
