import React, { createRef } from 'react';
import { Image as NativeImage, PixelRatio, Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { BoldOfferPoster, type BoldOfferPosterHandle } from '../components/affiliate/BoldOfferPoster';
import { cleanupPosterPng, persistPosterPng, posterRasterSize, svgPosterPng } from '../components/affiliate/posterExport';
import { createAffiliatePoster, POSTER_PAGE } from '../../../lib/affiliatePoster';

const mockToDataURL = jest.fn();
const mockWrite = jest.fn();
const mockDelete = jest.fn();
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const originalPlatform = Object.getOwnPropertyDescriptor(Platform, 'OS')!;

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///test-cache/', EncodingType: { Base64: 'base64' },
  writeAsStringAsync: (...args: unknown[]) => mockWrite(...args),
  deleteAsync: (...args: unknown[]) => mockDelete(...args),
}));
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  const makeElement = require('react').createElement;
  const Svg = React.forwardRef((props: object, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ toDataURL: (...args: unknown[]) => mockToDataURL(...args) }));
    return makeElement(View, props);
  });
  return { __esModule: true, default: Svg, Svg, Rect: View, Path: View, Image: View, Text, ClipPath: View, Defs: View };
});

const saved = createAffiliatePoster({ handle: 'ana-local', displayName: 'Ana’s saved page', photo: 'https://photos.example.com/saved.jpg', price: 2661, referralCode: 'LEGACY27' });

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  jest.spyOn(PixelRatio, 'get').mockReturnValue(2);
  mockToDataURL.mockImplementation((callback: (value: string) => void) => callback(PNG));
  mockWrite.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 1; });
  jest.spyOn(NativeImage, 'getSize').mockImplementation((_url, success) => { success?.(100, 100); });
});
afterEach(() => { jest.restoreAllMocks(); Object.defineProperty(Platform, 'OS', originalPlatform); jest.useRealTimers(); });

describe('native Bold offer artwork preparation', () => {
  it('waits for the actual SVG brand and saved photo before exporting at print resolution', async () => {
    const ref = createRef<BoldOfferPosterHandle>();
    const view = render(<BoldOfferPoster ref={ref} model={saved} />);
    const output = ref.current!.exportPng();
    expect(mockToDataURL).not.toHaveBeenCalled();
    fireEvent(view.getByTestId('affiliate-poster-brand'), 'load');
    await act(async () => { await Promise.resolve(); });
    expect(mockToDataURL).not.toHaveBeenCalled();
    fireEvent(view.getByTestId('affiliate-poster-photo'), 'load');
    expect(await output).toBe(PNG);
    expect(mockToDataURL).toHaveBeenCalledWith(expect.any(Function), { width: 2480, height: 3508 });
    expect(view.getByTestId('affiliate-poster-price').props.children).toBe('₱3,499');
    expect(view.getByTestId('affiliate-poster-creator-code-0').props.children).toBe('LEGACY27');
    view.unmount();
  });

  it('uses initials after a failed saved photo but preserves the actual offer and creator code', async () => {
    jest.mocked(NativeImage.getSize).mockImplementation((url, success, failure) => {
      if (url === saved.photo) failure?.({ message: 'Photo unavailable' });
      else success?.(100, 100);
    });
    const ref = createRef<BoldOfferPosterHandle>();
    const view = render(<BoldOfferPoster ref={ref} model={saved} />);
    expect(view.getByTestId('affiliate-poster-photo-fallback')).toBeTruthy();
    expect(view.queryByTestId('affiliate-poster-photo')).toBeNull();
    expect(view.getByTestId('affiliate-poster-avatar-initial').props.children).toBe('A');
    fireEvent(view.getByTestId('affiliate-poster-brand'), 'load');
    expect(await ref.current!.exportPng()).toBe(PNG);
    expect(view.getByTestId('affiliate-poster-price').props.children).toBe('₱3,499');
    expect(view.getByTestId('affiliate-poster-creator-code-0').props.children).toBe('LEGACY27');
    view.unmount();
  });

  it('does not reuse a previous offer’s ready state when a different saved offer arrives', async () => {
    const ref = createRef<BoldOfferPosterHandle>();
    const view = render(<BoldOfferPoster ref={ref} model={{ ...saved, photo: null }} />);
    fireEvent(view.getByTestId('affiliate-poster-brand'), 'load');
    expect(await ref.current!.exportPng()).toBe(PNG);
    mockToDataURL.mockClear();
    view.rerender(<BoldOfferPoster ref={ref} model={{ ...saved, photo: null, code: 'NEWCODE' }} />);
    const output = ref.current!.exportPng();
    await act(async () => { await Promise.resolve(); });
    expect(mockToDataURL).not.toHaveBeenCalled();
    fireEvent(view.getByTestId('affiliate-poster-brand'), 'load');
    expect(await output).toBe(PNG);
    expect(view.getByTestId('affiliate-poster-creator-code-0').props.children).toBe('NEWCODE');
    view.unmount();
  });

  it('rejects preparation when its view is closed instead of sharing the abandoned poster', async () => {
    const ref = createRef<BoldOfferPosterHandle>();
    const view = render(<BoldOfferPoster ref={ref} model={saved} />);
    const operation = ref.current!.exportPng();
    const rejected = expect(operation).rejects.toThrow('closed');
    view.unmount();
    await rejected;
    expect(mockToDataURL).not.toHaveBeenCalled();
  });

  it('bounds a stalled brand load instead of exporting a partially loaded poster', async () => {
    jest.useFakeTimers();
    const ref = createRef<BoldOfferPosterHandle>();
    const view = render(<BoldOfferPoster ref={ref} model={{ ...saved, photo: null }} />);
    const operation = ref.current!.exportPng();
    const rejected = expect(operation).rejects.toThrow('artwork');
    await act(async () => { await jest.advanceTimersByTimeAsync(8001); });
    await rejected;
    expect(mockToDataURL).not.toHaveBeenCalled();
    view.unmount();
  });
});

describe('native PNG export and cache cleanup', () => {
  it.each([
    ['ios', 2, 1240, 1754], ['ios', 3, 827, 1170], ['android', 2, 2480, 3508], ['android', 3, 2480, 3508],
  ] as const)('accounts for %s native raster scaling at pixel ratio %s', (platform, ratio, width, height) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
    jest.mocked(PixelRatio.get).mockReturnValue(ratio);
    expect(posterRasterSize()).toEqual({ width, height });
  });

  it('requests an A4 300 dpi raster directly from the vector scene', async () => {
    const toDataURL = jest.fn((callback: (value: string) => void) => callback(`data:image/png;base64,${PNG}`));
    expect(await svgPosterPng({ toDataURL })).toBe(PNG);
    expect(toDataURL).toHaveBeenCalledWith(expect.any(Function), { width: POSTER_PAGE.exportWidth, height: POSTER_PAGE.exportHeight });
  });

  it('rejects an empty native response', async () => {
    await expect(svgPosterPng({ toDataURL: callback => callback('') })).rejects.toThrow('empty');
  });

  it('bounds a native callback that never arrives and ignores a late result', async () => {
    jest.useFakeTimers();
    let callback!: (value: string) => void;
    const operation = svgPosterPng({ toDataURL: capture => { callback = capture; } }, 25);
    const rejected = expect(operation).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(26);
    await rejected;
    callback(PNG);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('writes the PNG as a base64 cache file and cleans it up idempotently', async () => {
    const uri = await persistPosterPng(PNG);
    expect(uri).toMatch(/^file:\/\/\/test-cache\/tendso-creator-poster-[\d-]+\.png$/);
    expect(mockWrite).toHaveBeenCalledWith(uri, PNG, { encoding: 'base64' });
    await cleanupPosterPng(uri);
    expect(mockDelete).toHaveBeenCalledWith(uri, { idempotent: true });
  });

  it('removes a partially written file after a write error', async () => {
    mockWrite.mockRejectedValueOnce(new Error('Storage full'));
    await expect(persistPosterPng(PNG)).rejects.toThrow('Storage full');
    expect(mockDelete).toHaveBeenCalledWith(mockWrite.mock.calls[0][0], { idempotent: true });
  });

  it('ignores missing cache files during cleanup', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Already removed'));
    await expect(cleanupPosterPng('file:///test-cache/old.png')).resolves.toBeUndefined();
    await cleanupPosterPng(undefined);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
