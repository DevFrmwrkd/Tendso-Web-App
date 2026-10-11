import { Link } from 'expo-router';
import type { ComponentProps } from 'react';
import { passNav, navKey } from '../hooks/useGuardedRouter';

/**
 * Drop-in wrapper for expo-router's `<Link>` that blocks rapid duplicate taps
 * using the same module-level lock as `useGuardedRouter`. A fast double-tap on
 * a link — anywhere in the app — navigates only once.
 *
 * expo-router honours `e.preventDefault()` inside a `<Link>` `onPress` as a
 * cancel signal; that is the supported intercept. On a blocked (duplicate) tap
 * we cancel and swallow. Otherwise we forward to the caller's `onPress`.
 */
export function GuardedLink({ onPress, href, ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      onPress={(e) => {
        if (!passNav('link:' + navKey(href))) {
          e.preventDefault();
          return;
        }
        onPress?.(e);
      }}
      {...rest}
    />
  );
}
