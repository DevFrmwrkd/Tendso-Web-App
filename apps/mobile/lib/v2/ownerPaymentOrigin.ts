const PRODUCTION_CONVEX_ORIGIN = 'https://energetic-panther-693.convex.cloud';

type PaymentEnvironment = {
  configuredOrigin?: string;
  convexUrl?: string;
  clerkPublishableKey?: string;
  productionOrigin: string;
};

/** Payment tokens must open the web app connected to the same environment. */
export function ownerPaymentOrigin(environment: PaymentEnvironment): string {
  const { configuredOrigin, convexUrl, clerkPublishableKey, productionOrigin } = environment;
  const explicit = configuredOrigin?.trim();
  const production = convexUrl?.replace(/\/$/, '') === PRODUCTION_CONVEX_ORIGIN
    && clerkPublishableKey?.startsWith('pk_live_');
  if (!explicit && !production) {
    throw new Error('Payments are unavailable in this test build. Please ask the team to check its web address.');
  }
  try {
    const url = new URL(explicit || productionOrigin);
    if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) {
      return url.origin;
    }
  } catch { /* Invalid configuration must never fall back to the production payment app. */ }
  throw new Error('The payment web address is invalid. Please ask the team to check this build.');
}
