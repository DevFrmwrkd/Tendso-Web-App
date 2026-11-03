/** Down payment: how much now (from ₱500, steps of ₱500). The rest later. */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BigNumber, Button, Loading, ScreenShell, Text } from '../../../components/v2';
import { OwnerSaveExit } from '../../../components/v2/owner/OwnerSaveExit';
import { peso } from '../../../lib/v2/ownerContent';
import { usePaymentState } from '../../../lib/v2/ownerData';
import { canPayPart, clampDownPayment, stepDownPayment, suggestedDownPayment } from '../../../lib/v2/payMath';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { colors, hit, space } from '../../../theme/v2';

export default function PayPart() {
  const router = useRouter();
  const { id, me } = useOwnerSite();
  const pay = usePaymentState(id);
  const total = pay?.billable ? pay.total : 0;
  const min = pay?.billable ? pay.minDownPayment : 0;
  const [amount, setAmount] = useState(() => suggestedDownPayment(total, min));
  useEffect(() => { setAmount(suggestedDownPayment(total, min)); }, [id, total, min]);
  const shownAmount = clampDownPayment(amount, total, min);

  if (!id && me !== undefined) return <ScreenShell title="Payment unavailable" footer={<Button title="Back to home" onPress={() => router.replace(STEP_ROUTE.home as never)} />} />;
  if (pay === undefined) return <Loading label="Loading payment details" />;
  if (!pay.billable || pay.paidInFull) return <Redirect href={STEP_ROUTE.live as never} />;
  if (pay.needsApproval) return <Redirect href={STEP_ROUTE.check as never} />;
  if (!pay.canPayDeposit || !canPayPart(total, min)) return <Redirect href={STEP_ROUTE.pay as never} />;

  const Step = ({ dir }: { dir: 1 | -1 }) => (
    <Pressable
      onPress={() => setAmount((a) => stepDownPayment(a, dir, total, min))}
      accessibilityRole="button"
      accessibilityLabel={dir === 1 ? 'More' : 'Less'}
      cssInterop={false}
      style={({ pressed }) => [styles.step, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={dir === 1 ? 'add' : 'remove'} size={28} color={colors.ink} />
    </Pressable>
  );

  return (
    <ScreenShell
      title="How much now?"
      headerRight={<OwnerSaveExit title="Back to Today" />}
      subtitle={`The rest, ${peso(total - shownAmount)}, later.`}
      onBack={() => router.back()}
      footer={
        <Button
          title={`Pay ${peso(shownAmount)} now`}
          onPress={() => router.push({ pathname: '/(owner)/pay/method', params: { kind: 'deposit', amount: String(shownAmount) } } as never)}
        />
      }
    >
      <View style={styles.row}>
        <Step dir={-1} />
        <BigNumber value={peso(shownAmount)} align="center" style={{ flex: 1 }} />
        <Step dir={1} />
      </View>
      <Text tone="muted" align="center" style={{ marginTop: space.md }}>{`From ${peso(min)}`}</Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xxl },
  step: { width: hit.large, height: hit.large, borderRadius: 999, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
});
