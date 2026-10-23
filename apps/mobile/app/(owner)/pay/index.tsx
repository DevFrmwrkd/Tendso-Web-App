/** Pay once to publish: ₱4,999 in full, or a down payment from ₱500 (Theo, Q2). */
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { BigNumber, Button, ScreenShell, Text } from '../../../components/v2';
import { peso } from '../../../lib/v2/ownerContent';
import { usePaymentState } from '../../../lib/v2/ownerData';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { canPayPart } from '../../../lib/v2/payMath';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { colors, space } from '../../../theme/v2';

export default function Pay() {
  const router = useRouter();
  const { id, site } = useOwnerSite();
  const pay = usePaymentState(id);

  if (pay === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }
  if (!pay.billable || pay.paidInFull) return <Redirect href={STEP_ROUTE.live as never} />;
  if (pay.needsApproval) return <Redirect href={STEP_ROUTE.check as never} />;

  const method = (kind: string, amount: number) =>
    router.push({ pathname: '/(owner)/pay/method', params: { kind, amount: String(amount) } } as never);
  const isLive = site?.phase === 'live' || !!site?.publishedUrl;

  if (pay.canPayBalance) {
    return (
      <ScreenShell
        title="Pay the rest"
        subtitle={`You paid ${peso(pay.amountPaid)}.`}
        onBack={() => router.back()}
        footer={<Button title={`Pay ${peso(pay.balanceDue)}`} onPress={() => method('balance', pay.balanceDue)} />}
      >
        <BigNumber value={peso(pay.balanceDue)} />
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
          <Button title={`Pay ${peso(pay.total)}`} onPress={() => method('full', pay.total)} />
          {pay.canPayDeposit && canPayPart(pay.total, pay.minDownPayment) ? (
            <Button title="Pay part now" variant="ghost" onPress={() => router.push('/(owner)/pay/part' as never)} />
          ) : null}
        </>
      }
    >
      <View style={{ gap: space.sm, marginTop: space.lg }}>
        <BigNumber value={peso(pay.total)} />
        <Text variant="bodyLg" tone="ink2">Address and hosting included.</Text>
      </View>
    </ScreenShell>
  );
}
