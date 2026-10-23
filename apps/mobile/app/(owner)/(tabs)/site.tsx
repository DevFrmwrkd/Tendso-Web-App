/** My site: the real site (live or private preview), and the one action that fits. */
import React from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Chip, ScreenShell, Text } from '../../../components/v2';
import { Buddy, SiteFrame } from '../../../components/v2/owner/OwnerUI';
import { usePreview } from '../../../lib/v2/ownerData';
import { outstandingPayment, phaseLine, STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { space } from '../../../theme/v2';

export default function MySite() {
  const router = useRouter();
  const { site, id } = useOwnerSite();
  const preview = usePreview(site && site.phase !== 'draft' ? id : null);
  const phase = site?.phase ?? null;
  const uri = preview?.publishedUrl ?? (preview?.ready ? preview.htmlUrl : null);
  const payment = outstandingPayment(site);

  let footer: React.ReactNode = null;
  if (phase === 'live') {
    footer = (
      <View style={{ gap: space.sm }}>
        {payment ? <Button title={payment.label} onPress={() => router.push(STEP_ROUTE.pay as never)} /> : null}
        <View style={styles.row}>
          <Button title="Ask for a change" variant="ghost" fullWidth={false} style={{ paddingHorizontal: 18 }} onPress={() => router.push(STEP_ROUTE.change as never)} />
          {preview?.publishedUrl ? <Button title="Share" variant={payment ? 'ghost' : 'primary'} fullWidth={false} style={{ flex: 1 }} onPress={() => Share.share({ message: `${site?.businessName}: ${preview.publishedUrl}` }).catch(() => {})} /> : null}
        </View>
      </View>
    );
  } else if (phase === 'ready_to_check') {
    footer = <Button title="Check my site" onPress={() => router.push(STEP_ROUTE.check as never)} />;
  } else if (phase === 'awaiting_payment') {
    footer = <Button title="Pay to publish" onPress={() => router.push(STEP_ROUTE.pay as never)} />;
  } else if (!site || phase === 'draft') {
    footer = <Button title="Make my website" onPress={() => router.push('/(owner)' as never)} />;
  }

  return (
    <ScreenShell title={site?.businessName ?? 'My site'} scroll={false} footer={footer}>
      {site ? <Chip label={phaseLine(phase)} tone={phase === 'live' ? 'ok' : 'muted'} style={{ marginTop: -space.md, marginBottom: space.md }} /> : null}
      {uri || preview?.inlineHtml ? (
        <SiteFrame uri={uri} html={preview?.inlineHtml} style={styles.site} />
      ) : (
        <View style={[styles.site, styles.empty]}>
          <Buddy size={120} />
          <Text tone="ink2" align="center">{phase === 'building' || phase === 'changes_requested' ? 'We are building it.' : 'No site to show yet.'}</Text>
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  site: { flex: 1, borderRadius: 22 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.md, backgroundColor: 'rgba(255,255,255,0.7)' },
  row: { flexDirection: 'row', gap: 10 },
});

