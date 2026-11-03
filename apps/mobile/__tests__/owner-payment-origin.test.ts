import { ownerPaymentOrigin } from '../lib/v2/ownerPaymentOrigin';
import { renderHook } from '@testing-library/react-native';
import { useCreateCheckout, wisePayUrl } from '../lib/v2/ownerData';

const mockAction = jest.fn();
jest.mock('@clerk/clerk-expo', () => ({ useAuth: jest.fn() }));
jest.mock('convex/react', () => ({ useAction: () => mockAction, useMutation: jest.fn(), useQuery: jest.fn() }));
jest.mock('../services/links', () => ({ SITE_URL: 'https://www.tendso.com' }));
jest.mock('../lib/v2/ownerSample', () => ({ sample: {} }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: false }));

const originalEnvironment = {
  EXPO_PUBLIC_WEB_ORIGIN: process.env.EXPO_PUBLIC_WEB_ORIGIN,
  EXPO_PUBLIC_CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
};
beforeEach(() => {
  mockAction.mockReset().mockResolvedValue({ enabled: false });
  delete process.env.EXPO_PUBLIC_WEB_ORIGIN;
  process.env.EXPO_PUBLIC_CONVEX_URL = 'https://diligent-ibex-454.convex.cloud';
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';
});
afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const production = {
  convexUrl: 'https://energetic-panther-693.convex.cloud',
  clerkPublishableKey: 'pk_live_example',
  productionOrigin: 'https://www.tendso.com',
};

it('uses the canonical production payment app only for the production backend and live identity instance', () => {
  expect(ownerPaymentOrigin(production)).toBe('https://www.tendso.com');
});

it.each([
  { ...production, clerkPublishableKey: 'pk_test_example' },
  { ...production, convexUrl: 'https://diligent-ibex-454.convex.cloud' },
  { ...production, convexUrl: 'http://localhost:3210' },
  { ...production, convexUrl: undefined },
  { ...production, clerkPublishableKey: undefined },
])('blocks a production fallback for test, development or incomplete configuration %#', configuration => {
  expect(() => ownerPaymentOrigin(configuration)).toThrow('Payments are unavailable in this test build');
});

it('uses an explicitly configured matching web app for a test build', () => {
  expect(ownerPaymentOrigin({ ...production, clerkPublishableKey: 'pk_test_example',
    configuredOrigin: ' https://dev.tendso.example/ ' })).toBe('https://dev.tendso.example');
});

it.each([
  'http://dev.tendso.example', 'javascript:alert(1)', 'not an address',
  'https://name:password@dev.tendso.example', 'https://dev.tendso.example/pay',
  'https://dev.tendso.example?backend=dev', 'https://dev.tendso.example#dev',
])('rejects invalid explicit origins without falling back to production: %s', configuredOrigin => {
  expect(() => ownerPaymentOrigin({ ...production, configuredOrigin })).toThrow('The payment web address is invalid');
});

it('blocks Wise and Xendit redirects before any provider call when the test web app is missing', () => {
  const checkout = renderHook(() => useCreateCheckout());
  expect(() => wisePayUrl('test-token')).toThrow('Payments are unavailable in this test build');
  expect(() => checkout.result.current('test-token')).toThrow('Payments are unavailable in this test build');
  expect(mockAction).not.toHaveBeenCalled();
});

it('uses the configured test origin for both Wise and Xendit return URLs', async () => {
  process.env.EXPO_PUBLIC_WEB_ORIGIN = 'https://test.tendso.example/';
  const checkout = renderHook(() => useCreateCheckout());
  expect(wisePayUrl('test-token')).toBe('https://test.tendso.example/pay/test-token');
  await checkout.result.current('test-token');
  expect(mockAction).toHaveBeenCalledWith({ token: 'test-token',
    successRedirectUrl: 'https://test.tendso.example/pay/test-token',
    failureRedirectUrl: 'https://test.tendso.example/pay/test-token' });
});
