const mockInit = jest.fn();
const mockWrap = jest.fn((c) => c);

jest.mock('@sentry/react-native', () => ({
  init: (...a: unknown[]) => mockInit(...a),
  wrap: (c: unknown) => mockWrap(c),
  reactNavigationIntegration: () => ({ registerNavigationContainer: jest.fn() }),
}));
jest.mock('expo-updates', () => ({ channel: 'preview' }));

function load(dsn: string | undefined, dev: boolean) {
  jest.resetModules();
  jest.clearAllMocks();
  if (dsn === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  else process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
  (global as any).__DEV__ = dev;
  return require('../lib/sentry') as typeof import('../lib/sentry');
}

afterAll(() => {
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  (global as any).__DEV__ = true;
});

it('is a silent no-op without a DSN', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const s = load(undefined, false);
  s.initSentry();
  const Comp = () => null;
  expect(s.withSentry(Comp)).toBe(Comp);
  expect(mockInit).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

it('treats an empty DSN as missing', () => {
  const s = load('  ', false);
  s.initSentry();
  expect(s.sentryEnabled).toBe(false);
  expect(mockInit).not.toHaveBeenCalled();
});

it('is disabled in development even with a DSN', () => {
  const s = load('https://example@o0.ingest.sentry.io/0', true);
  s.initSentry();
  expect(mockInit).not.toHaveBeenCalled();
});

it('initialises once in a release build with a DSN', () => {
  const s = load('https://example@o0.ingest.sentry.io/0', false);
  s.initSentry();
  s.initSentry();
  expect(mockInit).toHaveBeenCalledTimes(1);
  expect(mockInit.mock.calls[0][0]).toMatchObject({ dsn: 'https://example@o0.ingest.sentry.io/0', environment: 'preview', sendDefaultPii: false });
  s.withSentry(() => null);
  expect(mockWrap).toHaveBeenCalled();
});
