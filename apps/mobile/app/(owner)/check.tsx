/** Ready to check: the finished (private) site + "Ask for a change" / "Looks good". */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenShell, Text } from '../../components/v2';
import { SiteFrame } from '../../components/v2/owner/OwnerUI';
import { useApprovePreview, usePreview } from '../../lib/v2/ownerData';
import { STEP_ROUTE } from '../../lib/v2/ownerFlow';
import { useOwnerSite } from '../../lib/v2/useOwnerSite';
import { space } from '../../theme/v2';

export default function CheckSite() {
  const router = useRouter();
  const { id, site } = useOwnerSite();
  const preview = usePreview(id);
  const approve = useApprovePreview();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const good = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await approve({ submissionId: id });
      router.replace((res.next === 'publish' ? STEP_ROUTE.live : STEP_ROUTE.pay) as never);
    } catch (e: any) {
      setError(e?.data ?? e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell
      title="Ready to check"
      onBack={() => router.replace(STEP_ROUTE.home as never)}
      scroll={false}
      footer={
        <>
          {error ? <Text tone="danger" align="center">{error}</Text> : null}
          <View style={styles.row}>
            <Button title="Ask for a change" variant="ghost" fullWidth={false} style={styles.change} onPress={() => router.push(STEP_ROUTE.change as never)} />
            <Button title="Looks good" fullWidth={false} style={styles.good} loading={busy} onPress={good} />
          </View>
        </>
      }
    >
      {preview?.ready ? (
        <SiteFrame uri={preview.htmlUrl} html={preview.inlineHtml} style={styles.site} testID="owner-preview" />
      ) : (
        <View style={[styles.site, styles.wait]}>
          <Text tone="ink2" align="center">{site?.phase === 'building' ? 'Still building…' : 'Loading your site…'}</Text>
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  site: { flex: 1, borderRadius: 22, marginBottom: space.xs },
  wait: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)' },
  row: { flexDirection: 'row', gap: 10 },
  change: { flexShrink: 0, paddingHorizontal: 18 },
  good: { flex: 1 },
});
