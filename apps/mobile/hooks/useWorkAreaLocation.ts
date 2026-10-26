import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useMobileAccount } from './useMobileAccount';
import { mapSearchArea, validMapCoordinate, withLocationTimeout, type MapCoordinate } from '../services/workArea';

export function useWorkAreaLocation() {
  const { account, isLoading: accountLoading } = useMobileAccount();
  const accountKey = account?._id ?? account?.clerkId ?? null;
  const { workCity, workLatitude, workLongitude, workLocationSource } = account ?? {};
  const [locationResult, setLocationResult] = useState<{ accountKey: string | null; coordinate: MapCoordinate } | null>(null);
  const currentLocation = locationResult && locationResult.accountKey === accountKey ? locationResult.coordinate : null;
  const [permissionStatus, setPermissionStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'>('idle');
  const busy = useRef(false);
  const mounted = useRef(true);
  const attempted = useRef(false);
  const requestVersion = useRef(0);
  const savedArea = useMemo(() => mapSearchArea({ workCity, workLatitude, workLongitude, workLocationSource }), [
    workCity, workLatitude, workLongitude, workLocationSource,
  ]);
  const area = useMemo(() => validMapCoordinate(currentLocation)
    ? { ...currentLocation, source: 'device' as const, label: 'you' } : savedArea, [savedArea, currentLocation]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    // A retained screen must not reuse another account's GPS result or request.
    requestVersion.current += 1;
    busy.current = false;
    attempted.current = false;
    setLocationResult(null);
    setPermissionStatus('idle');
    return () => { requestVersion.current += 1; };
  }, [accountKey]);

  const requestCurrentLocation = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const version = ++requestVersion.current;
    setPermissionStatus('requesting');
    try {
      const result = await withLocationTimeout((async () => {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') return null;
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return { latitude: position.coords.latitude, longitude: position.coords.longitude };
      })());
      if (!mounted.current || version !== requestVersion.current) return;
      if (!result) {
        setPermissionStatus('denied');
      } else if (validMapCoordinate(result)) {
        setLocationResult({ accountKey, coordinate: result });
        setPermissionStatus('granted');
      } else {
        setPermissionStatus('unavailable');
      }
    } catch {
      if (mounted.current && version === requestVersion.current) setPermissionStatus('unavailable');
    } finally {
      if (version === requestVersion.current) busy.current = false;
    }
  }, [accountKey]);

  useEffect(() => {
    // Wait for the account before prompting: a city selected during onboarding
    // provides everything needed for the initial map and prospect search.
    if (accountLoading || attempted.current) return;
    attempted.current = true;
    if (!savedArea) void requestCurrentLocation();
  }, [accountLoading, savedArea, requestCurrentLocation]);

  return {
    area,
    currentLocation,
    permissionStatus,
    requestCurrentLocation,
    isLocating: permissionStatus === 'requesting',
    isLoading: accountLoading || (!area && permissionStatus === 'requesting'),
  };
}
