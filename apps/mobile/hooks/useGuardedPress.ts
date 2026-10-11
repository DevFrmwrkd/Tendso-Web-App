import { useEffect, useRef, useCallback } from 'react';

const DEFAULT_WINDOW_MS = 700;
const SETTLE_UNLOCK_MS = 400;

/**
 * Guards a press handler against rapid double-invocation.
 *
 * Returns a stable callback that ignores re-entrant presses while a previous
 * press is still "in flight". The lock is set synchronously so even presses
 * fired within the same tick are dropped.
 *
 * - Async handlers: the lock releases ~400ms after the returned promise settles.
 * - Sync handlers: the lock releases after `windowMs` (default 700ms).
 * - A synchronous throw clears the lock immediately and rethrows.
 */
export function useGuardedPress<T extends (...args: any[]) => any>(
  handler: T,
  options?: { windowMs?: number }
): (...args: Parameters<T>) => void {
  const handlerRef = useRef<T>(handler);
  const lockedRef = useRef(false);
  const mountedRef = useRef(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Always keep the newest handler so the stable callback calls the latest one.
  handlerRef.current = handler;

  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const windowMsRef = useRef(windowMs);
  windowMsRef.current = windowMs;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (lockedRef.current) return;
    lockedRef.current = true;

    const unlock = () => {
      if (!mountedRef.current) return;
      lockedRef.current = false;
    };

    const scheduleUnlock = (delay: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        unlock();
      }, delay);
    };

    let result: ReturnType<T>;
    try {
      result = handlerRef.current(...args);
    } catch (err) {
      // Synchronous failure: release the lock right away and rethrow.
      lockedRef.current = false;
      throw err;
    }

    const isThenable =
      result != null &&
      (typeof result === 'object' || typeof result === 'function') &&
      typeof (result as { then?: unknown }).then === 'function';

    if (isThenable) {
      Promise.resolve(result).finally(() => {
        scheduleUnlock(SETTLE_UNLOCK_MS);
      });
    } else {
      scheduleUnlock(windowMsRef.current);
    }
  }, []);
}
