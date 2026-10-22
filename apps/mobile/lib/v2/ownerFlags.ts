/**
 * Dev / demo switch: run the owner path on typed sample data (lib/v2/ownerSample).
 * Development builds only: a release build ignores EXPO_PUBLIC_OWNER_SAMPLE_DATA.
 */
export const OWNER_SAMPLE_DATA = typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_OWNER_SAMPLE_DATA === '1';
