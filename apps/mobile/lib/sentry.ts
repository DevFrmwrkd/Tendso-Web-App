/**
 * Crash reporting (Sentry), off unless configured.
 *
 * - No-op when `EXPO_PUBLIC_SENTRY_DSN` is missing/empty (no crash, no warnings) and in development.
 * - The DSN is read from the environment only. Never hard-code a DSN, auth token, org or project slug.
 *   For EAS builds set `EXPO_PUBLIC_SENTRY_DSN` as an EAS environment variable (it is a public client key,
 *   but still keep it out of the repo).
 * - TODO(source maps): readable stack traces need `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`
 *   set as EAS *secrets*, and `SENTRY_DISABLE_AUTO_UPLOAD` removed from eas.json build env. Until then
 *   uploads are disabled there so builds don't fail without a token.
 */
import type React from 'react';
import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

const dsn = (process.env.EXPO_PUBLIC_SENTRY_DSN ?? '').trim();

/** True only in a release build with a DSN. */
export const sentryEnabled = dsn.length > 0 && !__DEV__;

/** Registered against expo-router's navigation container ref in the root layout. */
export const navigationIntegration = Sentry.reactNavigationIntegration();

let initialised = false;

export function initSentry(): void {
  if (!sentryEnabled || initialised) return;
  initialised = true;
  Sentry.init({
    dsn,
    // The EAS Update channel (development / preview / production) doubles as the environment.
    environment: Updates.channel || 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    integrations: [navigationIntegration],
  });
}

/** Wrap the root component so render errors and touches are captured. Identity when disabled. */
export function withSentry<T extends React.ComponentType<any>>(component: T): T {
  return (sentryEnabled ? Sentry.wrap(component) : component) as T;
}
