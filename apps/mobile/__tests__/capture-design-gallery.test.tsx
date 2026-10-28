import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { Modal, StyleSheet } from 'react-native';
import { CaptureDesignGallery, type CaptureDesignGalleryProps } from '../components/field-agent/CaptureDesignGallery';
import { SiteFrame, isSamplePreviewNavigationAllowed } from '../components/v2/owner/OwnerUI';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Defs: 'Defs', LinearGradient: 'Gradient', Rect: 'Rect', Stop: 'Stop' }));
jest.mock('../services/links', () => ({ SITE_URL: 'https://samples.example.com' }));
jest.mock('react-native-webview', () => ({ WebView: (props: unknown) =>
  require('react').createElement(require('react-native').View, { ...(props as object), testID: 'sample-webview' }) }));

const designs = [
  { code: 'barbershop:F', name: 'Forge', preview: '/template-previews/f.html' },
  { code: 'salonspa:AN', name: 'Héla', preview: '/template-previews/an.html' },
  { code: 'generic:A', name: 'Ironwood', preview: '/template-previews/a.html' },
];
const props = (overrides: Partial<CaptureDesignGalleryProps> = {}): CaptureDesignGalleryProps => ({
  designs, selectedCode: 'barbershop:F', onSelect: jest.fn(), onUse: jest.fn(), onBack: jest.fn(), ...overrides,
});
const dimensions = { width: 390, height: 844, scale: 3, fontScale: 1 };
beforeEach(() => jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue(dimensions));
afterEach(() => jest.restoreAllMocks());

it('opens the full scrollable sample, closes to the same saved design and never uses it without an explicit action', () => {
  const callbacks = props({ selectedCode: 'salonspa:AN' });
  const screen = render(<CaptureDesignGallery {...callbacks} />);
  expect(screen.getByText('Choose your design')).toBeTruthy();
  expect(screen.getByText('Step 4 of 5')).toBeTruthy();
  expect(screen.getByText('Example photos and text. This shop’s content is added after review.')).toBeTruthy();
  const selected = screen.getByLabelText('Héla design. Preview sample website.');
  expect(selected.props.accessibilityState.selected).toBe(true);
  fireEvent.press(selected);
  const full = screen.getByTestId('capture-design-full-preview');
  expect(within(full).getByTestId('sample-webview').props.scrollEnabled).toBe(true);
  expect(within(full).getByTestId('sample-webview').props.source.uri).toBe('https://samples.example.com/template-previews/an.html');
  expect(screen.getByLabelText('Close design preview')).toHaveStyle({ width: 48, height: 48 });
  expect(callbacks.onUse).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Close design preview'));
  expect(screen.queryByTestId('capture-design-full-preview')).toBeNull();
  expect(screen.getByLabelText('Héla design. Preview sample website.').props.accessibilityState.selected).toBe(true);
  expect(callbacks.onSelect).not.toHaveBeenCalled();
});

it('restores an asynchronously hydrated choice and clamps safely when the root changes the catalog', () => {
  const callbacks = props({ selectedCode: null });
  const screen = render(<CaptureDesignGallery {...callbacks} />);
  screen.rerender(<CaptureDesignGallery {...callbacks} selectedCode="salonspa:AN" />);
  expect(screen.getByLabelText('Héla design. Preview sample website.').props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByLabelText('Héla design. Preview sample website.'));
  screen.rerender(<CaptureDesignGallery {...callbacks} selectedCode="salonspa:AN" designs={[designs[2]]} />);
  expect(screen.queryByTestId('capture-design-full-preview')).toBeNull();
  expect(screen.getByLabelText('Ironwood design. Preview sample website.').props.accessibilityState.selected).toBe(true);
  expect(screen.getByText('1 of 1')).toBeTruthy();
});

it('reports a swiped selection and accessible previous/next choices without saving it', () => {
  const callbacks = props();
  const screen = render(<CaptureDesignGallery {...callbacks} />);
  const width = 390 - 112;
  fireEvent.scroll(screen.getByTestId('capture-design-carousel'), { nativeEvent: {
    contentOffset: { x: width + 12, y: 0 },
    layoutMeasurement: { width: 390, height: 416 },
    contentSize: { width: (width + 12) * designs.length + 112, height: 416 },
  } });
  expect(callbacks.onSelect).toHaveBeenLastCalledWith('salonspa:AN');
  expect(screen.getByLabelText('Héla design. Preview sample website.').props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByLabelText('Next design'));
  expect(callbacks.onSelect).toHaveBeenLastCalledWith('generic:A');
  fireEvent.press(screen.getByLabelText('Previous design'));
  expect(callbacks.onSelect).toHaveBeenLastCalledWith('salonspa:AN');
  expect(callbacks.onUse).not.toHaveBeenCalled();
});

it('uses the full-preview selection once while an async save is pending', async () => {
  let complete!: () => void;
  const onUse = jest.fn(() => new Promise<void>(resolve => { complete = resolve; }));
  const callbacks = props({ selectedCode: 'salonspa:AN', onUse });
  const screen = render(<CaptureDesignGallery {...callbacks} />);
  fireEvent.press(screen.getByLabelText('Héla design. Preview sample website.'));
  const button = within(screen.getByTestId('capture-design-full-preview')).getByRole('button', { name: 'Use this design' });
  fireEvent.press(button); fireEvent.press(button);
  expect(onUse).toHaveBeenCalledTimes(1);
  expect(onUse).toHaveBeenCalledWith('salonspa:AN');
  await act(async () => { complete(); });
});

it('keeps offline choices available with an honest preview fallback', async () => {
  const callbacks = props({ isOffline: true });
  const screen = render(<CaptureDesignGallery {...callbacks} />);
  expect(screen.queryByTestId('sample-webview')).toBeNull();
  fireEvent.press(screen.getByLabelText('Forge design. Preview sample website.'));
  expect(within(screen.getByTestId('capture-design-full-preview')).getByText('Reconnect to preview this sample.')).toBeTruthy();
  fireEvent.press(within(screen.getByTestId('capture-design-full-preview')).getByRole('button', { name: 'Use this design' }));
  await waitFor(() => expect(callbacks.onUse).toHaveBeenCalledWith('barbershop:F'));
});

it('shows a retry on failed full samples and ignores a late error from the prior request', () => {
  const screen = render(<CaptureDesignGallery {...props()} />);
  fireEvent.press(screen.getByLabelText('Forge design. Preview sample website.'));
  const full = screen.getByTestId('capture-design-full-preview');
  const oldError = within(full).getByTestId('sample-webview').props.onError;
  act(() => oldError());
  expect(within(full).getByText('This sample could not load.')).toBeTruthy();
  fireEvent.press(within(full).getByRole('button', { name: 'Retry Forge sample' }));
  expect(within(full).getByTestId('sample-webview')).toBeTruthy();
  act(() => oldError());
  expect(within(full).getByTestId('sample-webview')).toBeTruthy();
  expect(within(full).queryByText('This sample could not load.')).toBeNull();
});

it('closes full previews through native Back and keeps busy controls from selecting or using', () => {
  const callbacks = props();
  const screen = render(<CaptureDesignGallery {...callbacks} />);
  fireEvent.press(screen.getByLabelText('Forge design. Preview sample website.'));
  act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
  expect(screen.queryByTestId('capture-design-full-preview')).toBeNull();
  screen.rerender(<CaptureDesignGallery {...callbacks} busy />);
  fireEvent.press(screen.getByLabelText('Next design'));
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(callbacks.onSelect).not.toHaveBeenCalled();
  expect(callbacks.onUse).not.toHaveBeenCalled();
  expect(callbacks.onBack).not.toHaveBeenCalled();
});

it('keeps cards positive in a short viewport and every control label at readable sizes', () => {
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ ...dimensions, width: 320, height: 420, fontScale: 1.5 });
  const screen = render(<CaptureDesignGallery {...props()} />);
  const card = screen.getByLabelText('Forge design. Preview sample website.');
  expect(StyleSheet.flatten(card.props.style).height).toBeGreaterThanOrEqual(180);
  expect(screen.getByLabelText('Next design')).toHaveStyle({ width: 48, height: 48 });
});

it.each<[string, boolean]>([
  ['https://samples.example.com/template-previews/f.html', true],
  ['https://samples.example.com/template-previews/f.html#contact', true],
  ['https://samples.example.com/template-previews/f.html?email=test', false],
  ['https://samples.example.com/template-previews/g.html', false],
  ['https://elsewhere.example.com/template-previews/f.html', false],
  ['tel:+639001234567', false], ['mailto:test@example.com', false], ['javascript:alert(1)', false],
])('restricts sample navigation: %s', (url, expected) => {
  expect(isSamplePreviewNavigationAllowed('https://samples.example.com/template-previews/f.html', url)).toBe(expected);
});

it('blocks forms and external actions in sample mode without changing normal owner frames', () => {
  const uri = 'https://samples.example.com/template-previews/f.html';
  const screen = render(<SiteFrame uri={uri} samplePreview />);
  const frame = screen.getByTestId('sample-webview');
  expect(frame.props.onShouldStartLoadWithRequest({ url: `${uri}#about`, navigationType: 'click' })).toBe(true);
  expect(frame.props.onShouldStartLoadWithRequest({ url: uri, navigationType: 'formsubmit' })).toBe(false);
  expect(frame.props.onShouldStartLoadWithRequest({ url: 'tel:123', navigationType: 'click' })).toBe(false);
  expect(frame.props.injectedJavaScriptBeforeContentLoaded).toContain("document.addEventListener('submit', block, true)");
  screen.rerender(<SiteFrame uri={uri} />);
  expect(screen.getByTestId('sample-webview').props.onShouldStartLoadWithRequest).toBeUndefined();
  expect(screen.getByTestId('sample-webview').props.injectedJavaScript).toBeUndefined();
});
