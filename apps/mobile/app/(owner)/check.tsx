/** Ready to check: the finished (private) site + "Ask for a change" / "Looks good". */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenShell, Text } from '../../components/v2';
import { SiteFrame } from '../../components/v2/owner/OwnerUI';
import { useApprovePreview, usePreview } from '../../lib/v2/ownerData';
import { STEP_ROUTE } from '../../lib/v2/ownerFlow';
import { useOwnerScope } from '../../lib/v2/useOwnerScope';
import { space } from '../../theme/v2';

export default function CheckSite() {
  const scope = useOwnerScope();
  return <CheckPreview key={scope.scopeKey} scope={scope} />;
}
function CheckPreview({ scope }: { scope: ReturnType<typeof useOwnerScope> }) {
  const router = useRouter();
  const { id, site } = scope;
  const preview = usePreview(id);
  const approve = useApprovePreview();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const canApprove = !!id && preview?.ready === true && !scope.isOffline;

  const good = async () => {
    if (!id || saving.current || !canApprove || !scope.isCurrent()) return;
    const current = () => mounted.current && scope.isCurrent();
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await approve({ submissionId: id });
      if (!current()) return;
      router.replace((res.next === 'publish' ? STEP_ROUTE.live : STEP_ROUTE.pay) as never);
    } catch (e: any) {
      if (current()) setError(typeof e?.data === 'string' ? e.data
        : typeof e?.message === 'string' ? e.message : 'Please try again.');
    } finally {
      saving.current = false;
      if (current()) setBusy(false);
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
          {scope.isOffline ? <Text tone="muted" align="center">Reconnect to approve your site or request a change.</Text> : null}
          <View style={styles.row}>
            <Button title="Ask for a change" variant="ghost" fullWidth={false} disabled={busy || !canApprove} style={styles.change}
              onPress={() => { if (scope.isCurrent() && canApprove && !saving.current) router.push(STEP_ROUTE.change as never); }} />
            <Button title="Looks good" fullWidth={false} style={styles.good} loading={busy} disabled={!canApprove} onPress={good} />
          </View>
        </>
      }
    >
      <View style={styles.identity}>
        <Text weight="bold">{site?.businessName ?? 'Your shop'}</Text>
        <Text variant="label" tone="muted">Check the words, photos and contact details.</Text>
      </View>
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
  identity: { gap: space.xs, marginBottom: space.md },
  change: { flex: 1, paddingHorizontal: 12 },
  good: { flex: 1 },
});
