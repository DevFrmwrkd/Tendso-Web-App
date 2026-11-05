import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Text } from '..';
import { SiteFrame } from './OwnerUI';
import type { PreviewState } from '../../../lib/v2/ownerTypes';
import { colors, radius, space } from '../../../theme/v2';

/** Never invent a public address while the backend is still publishing. */
export function publicSiteUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

export function OwnerSiteSummary({ name, preview, publishedUrl, included = false }: {
  name: string; preview?: PreviewState; publishedUrl?: string | null; included?: boolean;
}) {
  const url = publicSiteUrl(publishedUrl ?? preview?.publishedUrl);
  const ready = !!preview?.ready && !!(preview.htmlUrl || preview.inlineHtml);
  return <Card style={styles.card}>
    {ready ? <View style={styles.preview} accessibilityLabel={`${name} website preview`}>
      <SiteFrame uri={preview?.htmlUrl} html={preview?.inlineHtml} height={160} interactive={false} />
    </View> : null}
    <View style={styles.row}>
      <View style={styles.icon}><Ionicons name="storefront-outline" size={26} color={colors.ink} /></View>
      <View style={styles.flex}>
        <Text variant="heading">{name}</Text>
        <Text variant="label" tone="muted" selectable>{url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'Your private website preview'}</Text>
      </View>
    </View>
    {included ? <View style={styles.included}>
      {['Your shop’s website', 'A Tendso web address', 'Hosting included'].map(label => <View key={label} style={styles.row}>
        <Ionicons name="checkmark-circle" size={22} color={colors.ink} /><Text tone="ink2" style={styles.flex}>{label}</Text>
      </View>)}
    </View> : null}
  </Card>;
}

const styles = StyleSheet.create({
  card: { gap: space.md }, row: { flexDirection: 'row', alignItems: 'center', gap: space.md }, flex: { flex: 1, minWidth: 0 },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg2, borderRadius: radius.field },
  preview: { height: 160, borderRadius: radius.field, overflow: 'hidden', backgroundColor: colors.bg2 },
  included: { gap: space.sm, paddingTop: space.sm },
});
