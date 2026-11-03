/**
 * How do you pay: GCash, Maya or card (Xendit hosted checkout in the in-app browser),
 * or a bank transfer by Wise (the existing web pay page with the reference code).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { Button, Loading, ScreenShell, Text } from '../../../components/v2';
import { OptionRow } from '../../../components/v2/owner/OwnerUI';
import { OwnerSiteSummary } from '../../../components/v2/owner/OwnerSiteSummary';
import { OwnerSaveExit } from '../../../components/v2/owner/OwnerSaveExit';
import { peso } from '../../../lib/v2/ownerContent';
import { useCreateCheckout, useCreatePayToken, usePaymentState, wisePayUrl } from '../../../lib/v2/ownerData';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { OWNER_SAMPLE_DATA } from '../../../lib/v2/ownerFlags';
import { payChoiceForState } from '../../../lib/v2/payMath';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { colors, space } from '../../../theme/v2';
import { useNetwork } from '../../../providers/NetworkProvider';

function paymentUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* Show a short error without exposing an invalid payment token. */ }
  throw new Error('The payment link is unavailable. Please try again.');
}

export default function PayMethod() {
  const owner = useOwnerSite();
  const { userId } = useAuth();
  return <PaymentMethod key={`${userId ?? ''}:${owner.me?.owner._id ?? ''}:${owner.id ?? ''}`} owner={owner} />;
}
function PaymentMethod({ owner }: { owner: ReturnType<typeof useOwnerSite> }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; amount?: string }>();
  const { id, site } = owner;
  const { isConnected } = useNetwork();
  const pay = usePaymentState(id);
  const createToken = useCreatePayToken();
  const checkout = useCreateCheckout();
  const xendit = pay && pay.billable ? pay.xenditEnabled : false;
  const [method, setMethod] = useState<'xendit' | 'wise' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const mounted = useRef(true);
  const focused = useRef(true);
  const focusVersion = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; focusVersion.current++; };
  }, []));

  const choice = payChoiceForState(params.kind, params.amount, pay);
  const chosen = method === 'xendit' && !xendit ? 'wise' : method ?? (xendit ? 'xendit' : 'wise');
  const payable = !!id && !!choice && isConnected !== false;
  const quoteKey = pay?.billable ? JSON.stringify([pay.total, pay.amountPaid, pay.balanceDue, pay.paidInFull,
    pay.needsApproval, pay.canPayFull, pay.canPayDeposit, pay.canPayBalance, pay.minDownPayment, pay.xenditEnabled, chosen, choice]) : '';
  const latest = useRef({ payable, quoteKey });
  latest.current = { payable, quoteKey };

  const go = async () => {
    if (!id || !choice || saving.current || !payable || !focused.current || latest.current.quoteKey !== quoteKey || !latest.current.payable) return;
    saving.current = true;
    const version = focusVersion.current;
    const current = () => mounted.current && focused.current && focusVersion.current === version;
    const currentQuote = () => current() && latest.current.payable && latest.current.quoteKey === quoteKey;
    setBusy(true);
    setError(null);
    try {
      const token = await createToken({ submissionId: id, kind: choice.kind, amount: choice.kind === 'deposit' ? choice.amount : undefined,
        expectedTotal: pay?.billable ? pay.total : undefined });
      if (!current()) return;
      if (!currentQuote()) throw new Error('Payment details changed. Check the latest amount before paying.');
      if (!token.token?.trim()) throw new Error('The payment link is unavailable. Please try again.');
      if (chosen === 'xendit') {
        const res = await checkout(token.token);
        if (!current()) return;
        if (!OWNER_SAMPLE_DATA && !currentQuote()) throw new Error('Payment details changed. Check the latest amount before paying.');
        if (res.enabled) await WebBrowser.openBrowserAsync(paymentUrl(res.checkoutUrl), { controlsColor: colors.ink, dismissButtonStyle: 'close' });
        else if (!OWNER_SAMPLE_DATA) await WebBrowser.openBrowserAsync(paymentUrl(wisePayUrl(token.token))); // Xendit switched off: Wise
      } else if (OWNER_SAMPLE_DATA) {
        await checkout(token.token); // sample: pretend the transfer arrived
      } else {
        await WebBrowser.openBrowserAsync(paymentUrl(wisePayUrl(token.token)), { controlsColor: colors.ink, dismissButtonStyle: 'close' });
      }
      // The payment lands by webhook; the live screen waits for it and publishes.
      if (current()) router.replace(STEP_ROUTE.live as never);
    } catch (e: any) {
      if (current()) setError(typeof e?.data === 'string' ? e.data : e?.message ?? 'Please try again.');
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  if (!id && owner.me !== undefined) return <ScreenShell title="Payment unavailable" footer={<Button title="Back to home" onPress={() => router.replace(STEP_ROUTE.home as never)} />} />;
  if (pay === undefined) return <Loading label="Loading payment details" />;

  return (
    <ScreenShell
      title="How do you pay?"
      headerRight={<OwnerSaveExit title="Back to Today" disabled={busy} canExit={() => !saving.current} />}
      onBack={() => router.back()}
      footer={
        <>
          {error ? <Text tone="danger" align="center">{error}</Text> : null}
          {isConnected === false ? <Text tone="muted" align="center">Reconnect to pay for your site.</Text> : null}
          {!choice ? <Text tone="muted" align="center">Return to your site to check the latest payment options.</Text> : null}
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
