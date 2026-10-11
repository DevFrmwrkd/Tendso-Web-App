import { useMemo } from 'react';
import { useRouter } from 'expo-router';

/**
 * Drop-in replacement for expo-router's `useRouter()` that dedupes rapid
 * duplicate navigations app-wide.
 *
 * The lock lives at MODULE scope, so it is shared across every screen: a fast
 * double-tap on the same destination — from any button, on any screen — only
 * navigates once. Distinct destinations (different href) are never blocked.
 *
 * Under the hood each navigation is keyed by `<method>:<href>`. `back` keys on
 * a constant so a rapid double-back is deduped too. The guard window is short
 * (`WINDOW_MS`) — long enough to swallow an accidental double-tap, short enough
 * to never block an intentional repeat.
 */

const WINDOW_MS = 700;
let lockUntil = 0;
let lockedKey = '';

/**
 * Normalises an expo-router `href` (string or object) into a stable string key.
 */
export function navKey(href: unknown): string {
  if (typeof href === 'string') return href;
  try {
    return JSON.stringify(href);
  } catch {
    return String(href);
  }
}

/**
 * Returns `true` if a navigation keyed by `key` should proceed, `false` if it
 * is a rapid duplicate of the last one and should be dropped. Setting the lock
 * is synchronous, so duplicates fired within the same tick are dropped.
 */
export function passNav(key: string): boolean {
  const now = Date.now();
  if (now < lockUntil && key === lockedKey) return false;
  lockUntil = now + WINDOW_MS;
  lockedKey = key;
  return true;
}

/**
 * Guarded `useRouter()`. Spreads the real router (so `dismiss`, `dismissAll`,
 * `setParams`, `canGoBack`, etc. are preserved untouched) and overrides the
 * navigating methods with deduped wrappers.
 */
export function useGuardedRouter() {
  const router = useRouter();

  return useMemo(() => {
    const push = ((...a: Parameters<typeof router.push>) => {
      if (passNav('push:' + navKey(a[0]))) router.push(...a);
    }) as typeof router.push;

    const replace = ((...a: Parameters<typeof router.replace>) => {
      if (passNav('replace:' + navKey(a[0]))) router.replace(...a);
    }) as typeof router.replace;

    const navigate = ((...a: Parameters<typeof router.navigate>) => {
      if (passNav('navigate:' + navKey(a[0]))) router.navigate(...a);
    }) as typeof router.navigate;

    const back = ((...a: Parameters<typeof router.back>) => {
      if (passNav('back')) router.back(...a);
    }) as typeof router.back;

    return { ...router, push, replace, navigate, back };
  }, [router]);
}
