/**
 * How do you pay: GCash, Maya or card (Xendit hosted checkout in the in-app browser),
 * or a bank transfer by Wise (the existing web pay page with the reference code).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { Button, ScreenShell, Text } from '../../../components/v2';
import { OptionRow } from '../../../components/v2/owner/OwnerUI';
import { OwnerSiteSummary } from '../../../components/v2/owner/OwnerSiteSummary';
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
  const { id, site } = useOwnerSite();
  const { userId } = useAuth();
  const pay = usePaymentState(id);
  const createToken = useCreatePayToken();
  const checkout = useCreateCheckout();
  const xendit = pay && pay.billable ? pay.xenditEnabled : false;
  const [method, setMethod] = useState<'xendit' | 'wise' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const mounted = useRef(true);
  const actor = `${userId ?? ''}:${id ?? ''}`;
  const latestActor = useRef(actor); latestActor.current = actor;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const total = pay && pay.billable ? pay.total : PRICE_ONCE;
  const balance = pay && pay.billable ? pay.balanceDue : 0;
  const choice = parsePayChoice(params.kind, params.amount, total, balance);
  const chosen = method ?? (xendit ? 'xendit' : 'wise');
  const payable = !!id && !!choice && !!pay?.billable && !pay.paidInFull && !pay.needsApproval;

  const go = async () => {
    if (!id || !choice || saving.current || !payable) return;
    saving.current = true;
    const payingActor = actor;
    const current = () => mounted.current && latestActor.current === payingActor;
    setBusy(true);
    setError(null);
    try {
      const token = await createToken({ submissionId: id, kind: choice.kind, amount: choice.kind === 'deposit' ? choice.amount : undefined,
        expectedTotal: pay?.billable ? pay.total : undefined });
      if (!current()) return;
      if (chosen === 'xendit') {
        const res = await checkout(token.token);
        if (!current()) return;
        if (res.enabled) await WebBrowser.openBrowserAsync(res.checkoutUrl, { controlsColor: colors.ink, dismissButtonStyle: 'close' });
        else if (!OWNER_SAMPLE_DATA) await WebBrowser.openBrowserAsync(wisePayUrl(token.token)); // Xendit switched off: Wise
      } else if (OWNER_SAMPLE_DATA) {
        await checkout(token.token); // sample: pretend the transfer arrived
      } else {
        await WebBrowser.openBrowserAsync(wisePayUrl(token.token), { controlsColor: colors.ink, dismissButtonStyle: 'close' });
      }
      // The payment lands by webhook; the live screen waits for it and publishes.
      if (current()) router.replace(STEP_ROUTE.live as never);
    } catch (e: any) {
      if (current()) setError(e?.data ?? e?.message ?? 'Please try again.');
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <ScreenShell
      title="How do you pay?"
      onBack={() => router.back()}
      footer={
        <>
          {error ? <Text tone="danger" align="center">{error}</Text> : null}
          <Button title={choice ? `Pay ${peso(choice.amount)}` : 'Pay'} disabled={!payable} loading={busy} onPress={go} />
        </>
      }
    >
      <OwnerSiteSummary name={site?.businessName ?? 'Your shop'} publishedUrl={site?.publishedUrl} />
      {choice ? <Text variant="title" style={{ marginVertical: space.lg }}>{peso(choice.amount)}</Text> : null}
      <View style={{ gap: space.md }} accessibilityRole="radiogroup">
        {xendit ? (
          <OptionRow label="GCash, Maya or card" icon="phone-portrait-outline" disabled={busy || !payable} selected={chosen === 'xendit'} onPress={() => { if (!saving.current) setMethod('xendit'); }} />
        ) : null}
        <OptionRow label="Bank transfer (Wise)" icon="business-outline" disabled={busy || !payable} selected={chosen === 'wise'} onPress={() => { if (!saving.current) setMethod('wise'); }} />
      </View>
    </ScreenShell>
  );
}
