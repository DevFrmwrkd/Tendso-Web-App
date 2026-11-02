import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, SectionLabel, Text } from '../v2';
import { SiteFrame } from '../v2/owner/OwnerUI';
import { openExternalUrl } from '../../services/links';
import { colors, radius, space } from '../../theme/v2';

/** Accept only the server's published-site URL, never a submission/build preview. */
export function publicShopWebsiteUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return /^https?:$/.test(url.protocol) && !!url.hostname && !url.username && !url.password
      ? url.href : null;
  } catch { return null; }
}

export function PublishedShopWebsite({ url, isOffline = false }: { url: unknown; isOffline?: boolean }) {
  const publishedUrl = publicShopWebsiteUrl(url);
  return publishedUrl ? <PublishedPreview key={publishedUrl} url={publishedUrl} isOffline={isOffline} /> : null;
}

function PublishedPreview({ url, isOffline }: { url: string; isOffline: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  return <Card style={styles.card}>
    <SectionLabel>Published website</SectionLabel>
    <Text variant="label" tone="muted">The live site made for this shop. Scroll inside to explore it.</Text>
    {isOffline || failed ? <View style={styles.fallback}>
      <Text variant="body" align="center">{isOffline ? 'Reconnect to see the live website.' : 'The website preview could not load.'}</Text>
      {!isOffline ? <Button title="Try preview again" variant="ghost" size="md" onPress={() => {
        setFailed(false);
        setAttempt(value => value + 1);
      }} /> : null}
    </View> : <SiteFrame key={attempt} uri={url} height={420} interactive samplePreview
      onPreviewError={() => setFailed(true)} testID="published-shop-website" />}
    <Button title="View website" variant="ghost" size="md" icon="open-outline"
      disabled={isOffline} onPress={() => void openExternalUrl(url)} />
  </Card>;
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  fallback: { minHeight: 180, padding: space.lg, gap: space.md, justifyContent: 'center',
    borderRadius: radius.field, backgroundColor: colors.bg2 },
});
