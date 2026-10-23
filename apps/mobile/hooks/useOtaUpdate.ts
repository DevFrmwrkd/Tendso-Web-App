import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

export type OtaStatus =
  | 'disabled' // dev client / Expo Go / a build without expo-updates: nothing to do
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready' // downloaded; becomes the running bundle on the NEXT launch
  | 'error';

export interface UseOtaUpdateOptions {
  /** Don't re-check more often than this when the app comes back to the foreground. Default 10 min. */
  minIntervalMs?: number;
}

export interface UseOtaUpdateResult {
  status: OtaStatus;
  /** True once a newer update has been downloaded and is waiting for the next launch. */
  updateReady: boolean;
  /** Manual check + download (same path as the foreground check). Never reloads. */
  check: () => Promise<void>;
  /** Reload into the downloaded update now. Only call from an explicit user action. */
  applyNow: () => Promise<void>;
}

const TEN_MINUTES = 10 * 60 * 1000;

/**
 * Over-the-air updates, deliberately quiet.
 *
 * - Checks when the app returns to the foreground (throttled), downloads in the
 *   background, and leaves the new bundle to be applied on the next launch.
 * - Never calls `reloadAsync` by itself: nobody loses a half-recorded interview
 *   or a half-filled form to an update. `applyNow` exists for an explicit button.
 * - Launch-time checks are done natively (`updates.checkAutomatically: ON_LOAD`
 *   in app.json), so this hook does not check on mount.
 * - No-ops (status `disabled`) when expo-updates is not active (dev builds, Expo Go).
 */
export function useOtaUpdate({ minIntervalMs = TEN_MINUTES }: UseOtaUpdateOptions = {}): UseOtaUpdateResult {
  const enabled = !__DEV__ && Updates.isEnabled;
  const [status, setStatus] = useState<OtaStatus>(enabled ? 'idle' : 'disabled');
  const busy = useRef(false);
  const lastCheckAt = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const safeSet = useCallback((next: OtaStatus) => {
    if (mounted.current) setStatus(next);
  }, []);

  const check = useCallback(async () => {
    if (!enabled || busy.current) return;
    busy.current = true;
    lastCheckAt.current = Date.now();
    try {
      safeSet('checking');
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        safeSet('idle');
        return;
      }
      safeSet('downloading');
      const fetched = await Updates.fetchUpdateAsync();
      safeSet(fetched.isNew ? 'ready' : 'idle');
    } catch (error) {
      // Offline, server hiccup, rollback in flight… none of it should surface to the user.
      console.warn('[useOtaUpdate] update check failed', error);
      safeSet('error');
    } finally {
      busy.current = false;
    }
  }, [enabled, safeSet]);

  useEffect(() => {
    if (!enabled) return;
    let previous: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      const cameToForeground = /inactive|background/.test(previous) && next === 'active';
      previous = next;
      if (!cameToForeground) return;
      if (Date.now() - lastCheckAt.current < minIntervalMs) return;
      void check();
    });
    return () => sub.remove();
  }, [enabled, check, minIntervalMs]);

  const applyNow = useCallback(async () => {
    if (!enabled) return;
    await Updates.reloadAsync();
  }, [enabled]);

  return { status, updateReady: status === 'ready', check, applyNow };
}
