/** Down payment: how much now (from ₱500, steps of ₱500). The rest later. */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BigNumber, Button, ScreenShell, Text } from '../../../components/v2';
import { peso, PRICE_ONCE } from '../../../lib/v2/ownerContent';
import { usePaymentState } from '../../../lib/v2/ownerData';
import { stepDownPayment, suggestedDownPayment } from '../../../lib/v2/payMath';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { colors, hit, space } from '../../../theme/v2';

export default function PayPart() {
  const router = useRouter();
  const { id } = useOwnerSite();
  const pay = usePaymentState(id);
  const total = pay && pay.billable ? pay.total : PRICE_ONCE;
  const min = pay && pay.billable ? pay.minDownPayment : 500;
  const [amount, setAmount] = useState(() => suggestedDownPayment(total, min));
  useEffect(() => { setAmount(suggestedDownPayment(total, min)); }, [total, min]);

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
      subtitle={`The rest, ${peso(total - amount)}, later.`}
      onBack={() => router.back()}
      footer={
        <Button
          title={`Pay ${peso(amount)} now`}
          onPress={() => router.push({ pathname: '/(owner)/pay/method', params: { kind: 'deposit', amount: String(amount) } } as never)}
        />
      }
    >
      <View style={styles.row}>
        <Step dir={-1} />
        <BigNumber value={peso(amount)} align="center" style={{ flex: 1 }} />
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
