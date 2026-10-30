import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { runInNewContext } from 'node:vm';
import { AffiliatePublicPagePreview, PreviewDocument } from '../components/affiliate/PublicPagePreview';
import { CREATOR_PREVIEW_ORIGIN, creatorPreviewRenderScript, isCreatorPreviewNavigationAllowed } from '../components/affiliate/pagePreviewBridge';
import { DEFAULT_STORE_LINKS } from '../../../lib/v2/appLinks';
import { createCreatorPageCard } from '../../../lib/v2/creatorPageEditor';
import { affiliateDraft, sampleAffiliate } from '../components/affiliate/model';

const mockInject = jest.fn();
const mockQuery = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('convex/react', () => ({ useQuery: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('@tendso/convex-client', () => ({ api: { settings: { get: 'settings:get' } } }));
jest.mock('../generated/creatorPagePreview', () => ({ CREATOR_PAGE_PREVIEW_HTML: '<!doctype html><title>Preview fixture</title>', CREATOR_PAGE_PREVIEW_VERSION: 1 }));
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { WebView: React.forwardRef((props: object, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInject }));
    return require('react').createElement(View, props);
  }) };
});

const card = createCreatorPageCard(sampleAffiliate, affiliateDraft(sampleAffiliate), 3999);
const props = { card, dirty: false, storeLinks: DEFAULT_STORE_LINKS };
const ready = { type: 'creator-preview-ready', version: 1 };
function message(view: ReturnType<typeof render>, body: object, url = CREATOR_PREVIEW_ORIGIN) {
  fireEvent(view.getByTestId('affiliate-public-page-webview'), 'message', { nativeEvent: { data: JSON.stringify(body), url } });
}
function lastPacket(): { card: typeof card; requestId: string } {
  let result: unknown;
  runInNewContext(mockInject.mock.calls.at(-1)![0], { window: { __tendsoCreatorPreview: { render: (value: unknown) => { result = value; } } } });
  return result as { card: typeof card; requestId: string };
}
beforeEach(() => { jest.clearAllMocks(); mockQuery.mockReturnValue(undefined); });

it('loads a bundled document without auth cookies, files, mixed content or outgoing navigation', () => {
  const view = render(<PreviewDocument {...props} />);
  const webview = view.getByTestId('affiliate-public-page-webview');
  expect(webview.props.source).toEqual({ html: expect.stringContaining('Preview fixture'), baseUrl: CREATOR_PREVIEW_ORIGIN });
  expect(webview.props.sharedCookiesEnabled).toBe(false);
  expect(webview.props.thirdPartyCookiesEnabled).toBe(false);
  expect(webview.props.allowFileAccess).toBe(false);
  expect(webview.props.mixedContentMode).toBe('never');
  expect(webview.props.onShouldStartLoadWithRequest({ url: `${CREATOR_PREVIEW_ORIGIN}#get`, navigationType: 'click' })).toBe(true);
  expect(webview.props.onShouldStartLoadWithRequest({ url: CREATOR_PREVIEW_ORIGIN, navigationType: 'formsubmit' })).toBe(false);
  expect(webview.props.onShouldStartLoadWithRequest({ url: 'https://tendso.com/v2/a/sam', navigationType: 'click' })).toBe(false);
  expect(mockInject).not.toHaveBeenCalled();
});

it('waits for the versioned ready handshake and accepts only the current render acknowledgement', async () => {
  const view = render(<PreviewDocument {...props} />);
  message(view, { ...ready, version: 2 });
  message(view, ready, 'https://attacker.test/');
  expect(mockInject).not.toHaveBeenCalled();
  message(view, ready);
  await waitFor(() => expect(mockInject).toHaveBeenCalledTimes(1));
  const first = lastPacket();
  expect(first.card.code).toBe(sampleAffiliate.referralCode);
  expect(first.card).not.toHaveProperty('clerkId');
  view.rerender(<PreviewDocument {...props} card={{ ...card, name: 'Latest draft' }} dirty />);
  await waitFor(() => expect(mockInject).toHaveBeenCalledTimes(2));
  const latest = lastPacket();
  expect(latest.requestId).not.toBe(first.requestId);
  expect(latest.card.name).toBe('Latest draft');
  message(view, { type: 'creator-preview-rendered', version: 1, requestId: first.requestId });
  expect(view.getByText('Preparing your preview…')).toBeTruthy();
  message(view, { type: 'creator-preview-rendered', version: 1, requestId: latest.requestId });
  await waitFor(() => expect(view.queryByText('Preparing your preview…')).toBeNull());
  expect(view.getByText('Unsaved changes · Visitors still see your saved page.')).toBeTruthy();
});

it('retries a failed document with the current draft and a new generation', async () => {
  const view = render(<PreviewDocument {...props} />);
  message(view, ready);
  await waitFor(() => expect(mockInject).toHaveBeenCalledTimes(1));
  const first = lastPacket();
  message(view, { type: 'creator-preview-error', version: 1, requestId: first.requestId });
  expect(view.getByText('Could not load the page preview.')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Try preview again'));
  message(view, ready);
  await waitFor(() => expect(mockInject).toHaveBeenCalledTimes(2));
  expect(lastPacket().requestId).not.toBe(first.requestId);
  expect(lastPacket().card).toEqual(card);
});

it('uses public default links for offline/admin samples without querying the backend', () => {
  const view = render(<AffiliatePublicPagePreview card={card} dirty={false} sample />);
  expect(mockQuery).not.toHaveBeenCalled();
  view.rerender(<AffiliatePublicPagePreview card={card} dirty={false} offline paused />);
  expect(mockQuery).not.toHaveBeenCalled();
  expect(view.getByText('Page paused · Only you can see this preview.')).toBeTruthy();
});

it('never treats draft text as injected JavaScript', () => {
  const name = `</script>'); globalThis.compromised = true; //\u2028`;
  const script = creatorPreviewRenderScript({ card: { ...card, name }, storeLinks: DEFAULT_STORE_LINKS }, 'test:1');
  const capture = jest.fn();
  const context = { window: { __tendsoCreatorPreview: { render: capture } }, compromised: false };
  runInNewContext(script, context);
  expect(context.compromised).toBe(false);
  expect(capture.mock.calls[0][0].card.name).toBe(name);
  expect(script).not.toContain('</script>');
});

it.each(['https://creator-preview.tendso.invalid/other', 'https://creator-preview.tendso.invalid/?x=1',
  'https://creator-preview.tendso.invalid.attacker.test/', 'https://user@creator-preview.tendso.invalid/',
  'http://creator-preview.tendso.invalid/', 'data:text/html,hello', 'file:///private/data', 'javascript:alert(1)'])('blocks leaving the static document: %s', uri => {
  expect(isCreatorPreviewNavigationAllowed(uri)).toBe(false);
});

it('accepts the normalized static document and local anchors', () => {
  for (const uri of ['about:blank', 'about:blank#get', CREATOR_PREVIEW_ORIGIN, CREATOR_PREVIEW_ORIGIN.slice(0, -1), `${CREATOR_PREVIEW_ORIGIN}#get`]) expect(isCreatorPreviewNavigationAllowed(uri)).toBe(true);
});
