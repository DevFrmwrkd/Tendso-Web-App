/**
 * How do you pay: GCash, Maya or card (Xendit hosted checkout in the in-app browser),
 * or a bank transfer by Wise (the existing web pay page with the reference code).
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Button, ScreenShell, Text } from '../../../components/v2';
import { OptionRow } from '../../../components/v2/owner/OwnerUI';
import { peso, PRICE_ONCE } from '../../../lib/v2/ownerContent';
import { useCreateCheckout, useCreatePayToken, usePaymentState, wisePayUrl } from '../../../lib/v2/ownerData';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { OWNER_SAMPLE_DATA } from '../../../lib/v2/ownerFlags';
import { parsePayChoice } from '../../../lib/v2/payMath';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { colors, space } from '../../../theme/v2';

export default function PayMethod() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; amount?: string }>();
  const { id } = useOwnerSite();
  const pay = usePaymentState(id);
  const createToken = useCreatePayToken();
  const checkout = useCreateCheckout();
  const xendit = pay && pay.billable ? pay.xenditEnabled : false;
  const [method, setMethod] = useState<'xendit' | 'wise' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = pay && pay.billable ? pay.total : PRICE_ONCE;
  const balance = pay && pay.billable ? pay.balanceDue : 0;
  const choice = parsePayChoice(params.kind, params.amount, total, balance);
  const chosen = method ?? (xendit ? 'xendit' : 'wise');

  const go = async () => {
    if (!id || !choice) return;
    setBusy(true);
    setError(null);
    try {
      const token = await createToken({ submissionId: id, kind: choice.kind, amount: choice.kind === 'deposit' ? choice.amount : undefined });
      if (chosen === 'xendit') {
        const res = await checkout(token.token);
        if (res.enabled) await WebBrowser.openBrowserAsync(res.checkoutUrl, { controlsColor: colors.ink, dismissButtonStyle: 'close' });
        else if (!OWNER_SAMPLE_DATA) await WebBrowser.openBrowserAsync(wisePayUrl(token.token)); // Xendit switched off: Wise
      } else if (OWNER_SAMPLE_DATA) {
        await checkout(token.token); // sample: pretend the transfer arrived
      } else {
        await WebBrowser.openBrowserAsync(wisePayUrl(token.token), { controlsColor: colors.ink, dismissButtonStyle: 'close' });
      }
      // The payment lands by webhook; the live screen waits for it and publishes.
      router.replace(STEP_ROUTE.live as never);
    } catch (e: any) {
      setError(e?.data ?? e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell
      title="How do you pay?"
      onBack={() => router.back()}
      footer={
        <>
          {error ? <Text tone="danger" align="center">{error}</Text> : null}
          <Button title={choice ? `Pay ${peso(choice.amount)}` : 'Pay'} disabled={!choice} loading={busy} onPress={go} />
        </>
      }
    >
      <View style={{ gap: space.md }} accessibilityRole="radiogroup">
        {xendit ? (
          <OptionRow label="GCash, Maya or card" icon="phone-portrait-outline" selected={chosen === 'xendit'} onPress={() => setMethod('xendit')} />
        ) : null}
        <OptionRow label="Bank transfer (Wise)" icon="business-outline" selected={chosen === 'wise'} onPress={() => setMethod('wise')} />
      </View>
    </ScreenShell>
  );
}
