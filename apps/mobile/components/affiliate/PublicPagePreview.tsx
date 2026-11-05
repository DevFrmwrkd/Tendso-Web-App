import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import type { CreatorCard } from '../../../../lib/v2/creatorTypes';
import { APP_STORE_SETTING, DEFAULT_STORE_LINKS, PLAY_STORE_SETTING, safeStoreUrl, type StoreLinks } from '../../../../lib/v2/appLinks';
import { CREATOR_PAGE_PREVIEW_HTML, CREATOR_PAGE_PREVIEW_VERSION } from '../../generated/creatorPagePreview';
import { Button, Text } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { CREATOR_PREVIEW_ORIGIN, creatorPreviewRenderScript, isCreatorPreviewNavigationAllowed } from './pagePreviewBridge';

const PreviewWebView: React.ComponentType<WebViewProps & React.RefAttributes<WebView>> = WebView;
const DOCUMENT = { html: CREATOR_PAGE_PREVIEW_HTML, baseUrl: CREATOR_PREVIEW_ORIGIN };
export type PublicPagePreviewProps = { card: CreatorCard; dirty: boolean; paused?: boolean; offline?: boolean; sample?: boolean };

export function AffiliatePublicPagePreview(props: PublicPagePreviewProps) {
  return props.sample || props.offline ? <PreviewDocument {...props} storeLinks={DEFAULT_STORE_LINKS} /> : <LiveStoreLinksPreview {...props} />;
}

function LiveStoreLinksPreview(props: PublicPagePreviewProps) {
  // These are public download settings, never creator/account/attribution queries.
  const play = useQuery(api.settings.get, { key: PLAY_STORE_SETTING }) as string | null | undefined;
  const ios = useQuery(api.settings.get, { key: APP_STORE_SETTING }) as string | null | undefined;
  return <PreviewDocument {...props} storeLinks={{ appStore: safeStoreUrl(ios, DEFAULT_STORE_LINKS.appStore), googlePlay: safeStoreUrl(play, DEFAULT_STORE_LINKS.googlePlay) }} />;
}

export function PreviewDocument({ card, dirty, paused, storeLinks }: PublicPagePreviewProps & { storeLinks: StoreLinks }) {
  const webview = useRef<WebView>(null);
  const [generation, setGeneration] = useState(0);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const sequence = useRef(0);
  const pending = useRef('');
  const mounted = useRef(true);
  const snapshot = JSON.stringify({ card, storeLinks });
  const latest = useRef(snapshot);
  latest.current = snapshot;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pending.current = ''; }; }, []);
  useEffect(() => {
    if (!loading || failed) return;
    const timer = setTimeout(() => { setFailed(true); setLoading(false); }, 15000);
    return () => clearTimeout(timer);
  }, [loading, failed]);

  useEffect(() => {
    if (!ready || failed || !webview.current) return;
    const requestId = `${generation}:${++sequence.current}`;
    pending.current = requestId;
    setLoading(true);
    webview.current.injectJavaScript(creatorPreviewRenderScript(JSON.parse(latest.current), requestId));
  }, [snapshot, ready, failed, generation]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    if (!mounted.current || !isCreatorPreviewNavigationAllowed(event.nativeEvent.url || 'about:blank')) return;
    if (event.nativeEvent.data.length > 1024) return;
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.version !== CREATOR_PAGE_PREVIEW_VERSION) return;
      if (message.type === 'creator-preview-ready') setReady(true);
      else if (message.requestId === pending.current && message.type === 'creator-preview-rendered') setLoading(false);
      else if (message.requestId === pending.current && message.type === 'creator-preview-error') { setFailed(true); setLoading(false); }
    } catch { /* Ignore messages outside the document's small, versioned protocol. */ }
  }, []);

  function retry() { pending.current = ''; setReady(false); setFailed(false); setLoading(true); setGeneration(value => value + 1); }
  return <View style={styles.root} testID="affiliate-public-page-preview">
    <View style={styles.heading}>
      <Text variant="bodyLg" weight="bold" accessibilityRole="header">Shop page preview</Text>
      <Text variant="label" tone="muted">{paused ? 'Page paused · Only you can see this preview.' : dirty ? 'Unsaved changes · Visitors still see your saved page.' : 'Your saved page · This is what shop owners see.'}</Text>
    </View>
    <View style={styles.document}>
      {!failed ? <PreviewWebView key={generation} ref={webview} source={DOCUMENT}
        testID="affiliate-public-page-webview" style={styles.webview}
        originWhitelist={['about:blank', 'https://creator-preview.tendso.invalid']}
        javaScriptEnabled domStorageEnabled={false} sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
        mixedContentMode="never" allowFileAccess={false} javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false} onOpenWindow={() => {}}
        onShouldStartLoadWithRequest={request => request.navigationType !== 'formsubmit' && isCreatorPreviewNavigationAllowed(request.url)}
        onLoadStart={() => { pending.current = ''; setReady(false); setLoading(true); }}
        onMessage={onMessage}
        onError={() => { setFailed(true); setLoading(false); }}
        onHttpError={() => { setFailed(true); setLoading(false); }}
        onContentProcessDidTerminate={retry}
        onRenderProcessGone={retry}
        accessibilityLabel="Preview of your public shop page"
      /> : <View style={styles.failure}><Text variant="body" align="center">Could not load the page preview.</Text><Button title="Try preview again" variant="ghost" onPress={retry} /></View>}
      {loading && !failed ? <View style={styles.loading} pointerEvents="none"><ActivityIndicator color={colors.ink} /><Text variant="label" tone="muted">Preparing your preview…</Text></View> : null}
    </View>
    <Text variant="label" tone="muted">Scroll inside to see the full page. Links and buttons are inactive.</Text>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, gap: space.md },
  heading: { gap: space.xs },
  document: { flex: 1, minHeight: 160, overflow: 'hidden', borderRadius: radius.card, borderWidth: 1, borderColor: colors.ruleStrong, backgroundColor: colors.card },
  webview: { flex: 1, backgroundColor: colors.bg },
  failure: { flex: 1, justifyContent: 'center', padding: space.lg, gap: space.md },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: colors.card },
});
