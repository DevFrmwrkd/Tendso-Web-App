/**
 * Rule #1 on the owner screens: nothing under 16px, one primary button, few words.
 * Screens run against the sample store (no backend).
 */
import React from 'react';
import { StyleSheet, Text as RNText } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MIN_FONT_SIZE } from '../theme/v2';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-av', () => ({ Video: 'Video', ResizeMode: { CONTAIN: 'contain' }, Audio: { Sound: {}, setAudioModeAsync: jest.fn() } }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker', PROVIDER_GOOGLE: 'google' }));
jest.mock('../providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: true }) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ kind: 'full', amount: '4999' }),
  Redirect: () => null,
}));
jest.mock('convex/react', () => ({
  useQuery: () => undefined,
  useMutation: () => jest.fn(),
  useAction: () => jest.fn(),
}));
jest.mock('@clerk/clerk-expo', () => ({
  useClerk: () => ({ signOut: jest.fn() }),
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));
jest.mock('convex/server', () => ({ makeFunctionReference: (name: string) => name }));
jest.mock('../lib/v2/ownerFlags', () => ({ OWNER_SAMPLE_DATA: true }));

// eslint-disable-next-line import/first
import { sample } from '../lib/v2/ownerSample';
// eslint-disable-next-line import/first
import { ownerIntake } from '../lib/v2/ownerIntake';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

function words(r: ReturnType<typeof render>): number {
  const texts = r.UNSAFE_getAllByType(RNText).map((n: any) => {
    const c = n.props.children;
    return (Array.isArray(c) ? c : [c]).filter((x: unknown) => typeof x === 'string').join(' ');
  });
  return texts.join(' ').split(/\s+/).filter((w) => /[A-Za-z₱0-9]/.test(w)).length;
}

function expectRuleOne(r: ReturnType<typeof render>, maxWords = 24) {
  r.UNSAFE_getAllByType(RNText).forEach((n: any) => {
    const size = StyleSheet.flatten(n.props.style)?.fontSize;
    if (size !== undefined) expect(size).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
  });
  expect(words(r)).toBeLessThanOrEqual(maxWords);
}

const screens: [string, () => React.ComponentType][] = [
  ['sell', () => require('../app/(owner)/start/sell').default],
  ['place', () => require('../app/(owner)/start/place').default],
  ['how', () => require('../app/(owner)/start/how').default],
  ['talk intro', () => require('../app/(owner)/talk/index').default],
  ['talk done', () => require('../app/(owner)/talk/done').default],
  ['photos intro', () => require('../app/(owner)/photos/index').default],
  ['building', () => require('../app/(owner)/building').default],
  ['pay', () => require('../app/(owner)/pay/index').default],
  ['pay part', () => require('../app/(owner)/pay/part').default],
  ['pay method', () => require('../app/(owner)/pay/method').default],
  ['change', () => require('../app/(owner)/change').default],
  ['book a visit', () => require('../app/(owner)/agents/book').default],
  ['agents', () => require('../app/(owner)/(tabs)/agents').default],
  ['today', () => require('../app/(owner)/(tabs)/today').default],
  ['me', () => require('../app/(owner)/(tabs)/me').default],
];
// Checklists and honest site/payment summaries contain more copy than a single
// question. Keep explicit bounds for those screens and the 16pt floor for all.
const screenWordLimits: Record<string, number> = {
  place: 50, 'talk intro': 220, 'talk done': 90, 'photos intro': 180,
  pay: 100, 'pay method': 80, 'book a visit': 100, agents: 100, today: 120,
};

describe('owner screens follow Rule #1', () => {
  beforeAll(async () => {
    jest.useFakeTimers();
    sample.reset();
    await sample.ensure({ name: 'Ben Reyes' });
    const id = await sample.createDraft({ businessType: 'Barber/Salon', businessName: 'Forge Barbers', shotListKey: 'barber' });
    ownerIntake.set({ kind: 'barber', submissionId: id, businessName: 'Forge Barbers' });
    await sample.submit({ submissionId: id });
    jest.advanceTimersByTime(4 * 8000);
    await sample.approve({ submissionId: id });
  });
  afterAll(() => {
    sample.reset();
    jest.useRealTimers();
  });

  it.each(screens)('%s: readable type and bounded screen copy', async (name, load) => {
    const Screen = load();
    const r = wrap(<Screen />);
    await act(async () => { await Promise.resolve(); });
    expectRuleOne(r, screenWordLimits[name] ?? 24);
    r.unmount();
  }, 60000);
});
