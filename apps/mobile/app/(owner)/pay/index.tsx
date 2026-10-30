/** Pay once to publish: ₱4,999 in full, or a down payment from ₱500 (Theo, Q2). */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { BigNumber, Button, Card, ScreenShell, Text } from '../../../components/v2';
import { OwnerSiteSummary } from '../../../components/v2/owner/OwnerSiteSummary';
import { OwnerCreatorCode } from '../../../components/v2/owner/OwnerCreatorCode';
import { peso } from '../../../lib/v2/ownerContent';
import { useOwnerCreatorCode, usePaymentState, usePreview } from '../../../lib/v2/ownerData';
import { OWNER_SAMPLE_DATA } from '../../../lib/v2/ownerFlags';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { canPayPart } from '../../../lib/v2/payMath';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { colors, space } from '../../../theme/v2';

export default function Pay() {
  const router = useRouter();
  const { id, site, me } = useOwnerSite();
  const { userId } = useAuth();
  const pay = usePaymentState(id);
  const preview = usePreview(id);
  const showCode = !OWNER_SAMPLE_DATA && site?.contentSource === 'owner_app';
  const creatorCode = useOwnerCreatorCode(showCode ? id : null);
  const [codeBusy, setCodeBusy] = useState(false);
  const changingCode = useRef(false);
  const actor = `${userId ?? ''}:${me?.owner._id ?? ''}:${id ?? ''}`;
  const liveActor = useRef(actor); liveActor.current = actor;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { changingCode.current = false; setCodeBusy(false); }, [actor]);

  if (pay === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }
  if (!pay.billable || pay.paidInFull) return <Redirect href={STEP_ROUTE.live as never} />;
  if (pay.needsApproval) return <Redirect href={STEP_ROUTE.check as never} />;

  const quoteReady = !showCode || (!!creatorCode && creatorCode.total === pay.total);
  const method = (kind: string, amount: number) => {
    if (changingCode.current || !quoteReady) return;
    router.push({ pathname: '/(owner)/pay/method', params: { kind, amount: String(amount) } } as never);
  };
  const isLive = site?.phase === 'live' || !!site?.publishedUrl;

  if (pay.canPayBalance) {
    return (
      <ScreenShell
        title="Pay the rest"
        subtitle={`You paid ${peso(pay.amountPaid)}.`}
        onBack={() => router.back()}
        footer={<Button title={`Pay ${peso(pay.balanceDue)}`} onPress={() => method('balance', pay.balanceDue)} />}
      >
        <OwnerSiteSummary name={site?.businessName ?? 'Your shop'} preview={preview} publishedUrl={site?.publishedUrl} />
        <View style={{ height: space.lg }} />
        <BigNumber value={peso(pay.balanceDue)} />
        <Text tone="ink2">Remaining balance</Text>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={isLive ? 'Pay for your site' : 'Publish your site'}
      subtitle={isLive ? 'Your site is already live. Pay once.' : 'See it first. Pay once to publish.'}
      onBack={() => router.back()}
      footer={
        <>
          <Button title={`Pay ${peso(pay.total)}`} disabled={codeBusy || !quoteReady} onPress={() => method('full', pay.total)} />
          {pay.canPayDeposit && canPayPart(pay.total, pay.minDownPayment) ? (
            <Button title="Pay part now" variant="ghost" disabled={codeBusy || !quoteReady} onPress={() => { if (!changingCode.current && quoteReady) router.push('/(owner)/pay/part' as never); }} />
          ) : null}
        </>
      }
    >
      <OwnerSiteSummary name={site?.businessName ?? 'Your shop'} preview={preview} publishedUrl={site?.publishedUrl} included />
      {showCode && id ? <OwnerCreatorCode key={actor} id={id} state={creatorCode}
        isCurrent={() => mounted.current && liveActor.current === actor}
        onBusyChange={busy => { if (mounted.current && liveActor.current === actor) { changingCode.current = busy; setCodeBusy(busy); } }} /> : null}
      <Card style={{ gap: space.sm, marginTop: space.lg }}>
        <Text variant="label" tone="muted">Your website · pay once</Text>
        {creatorCode?.applied && creatorCode.applied.saving > 0 ? <Text tone="muted" style={{ textDecorationLine: 'line-through' }}>{peso(creatorCode.applied.listPrice)}</Text> : null}
        <BigNumber value={peso(pay.total)} />
        <Text tone="ink2">Custom domains are optional and priced separately.</Text>
      </Card>
    </ScreenShell>
  );
}
