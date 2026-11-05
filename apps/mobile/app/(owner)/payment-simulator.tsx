/** A separate development ledger: never checkout, publishing or withdrawable money. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { Banner, Button, Card, Field, Loading, Pill, ScreenShell, Text } from '../../components/v2';
import { useOwnerSite } from '../../lib/v2/useOwnerSite';
import { useNetwork } from '../../providers/NetworkProvider';
import { simulationAmount, simulationPeso, useOwnerPaymentSimulation, useRunOwnerPaymentSimulation,
  type OwnerPaymentSimulationAction } from '../../lib/v2/ownerPaymentSimulator';
import type { SubmissionId } from '../../lib/v2/ownerTypes';
import { STEP_ROUTE } from '../../lib/v2/ownerFlow';
import { colors, space } from '../../theme/v2';

export default function PaymentSimulator() {
  const { id, me } = useOwnerSite();
  const { userId, sessionId } = useAuth();
  return <Simulator key={`${userId ?? ''}:${sessionId ?? ''}:${me?.owner._id ?? ''}:${id ?? ''}`}
    id={id} ownerId={me?.owner._id} actor={userId} />;
}

function Simulator({ id, ownerId, actor }: { id: SubmissionId | null; ownerId: string | undefined; actor: string | null | undefined }) {
  const router = useRouter();
  const { isConnected } = useNetwork();
  const simulation = useOwnerPaymentSimulation(id);
  const run = useRunOwnerPaymentSimulation();
  const [amountText, setAmountText] = useState('500');
  const [busy, setBusy] = useState<OwnerPaymentSimulationAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true), focused = useRef(true), visit = useRef(0), sequence = useRef(0);
  const inFlight = useRef<number | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    visit.current++;
    inFlight.current = null;
    setBusy(null);
    return () => { focused.current = false; visit.current++; inFlight.current = null; };
  }, []));

  const eligible = !!simulation?.simulationOnly && simulation.withdrawable === false
    && simulation.actorClerkId === actor && simulation.ownerId === ownerId && simulation.submissionId === id;
  const offline = isConnected === false;
  const latest = useRef({ eligible, offline, revision: simulation?.revision, total: simulation?.total });
  latest.current = { eligible, offline, revision: simulation?.revision, total: simulation?.total };

  const apply = async (action: OwnerPaymentSimulationAction, amount?: number) => {
    if (!id || !simulation || !eligible || offline || inFlight.current !== null || !focused.current || !mounted.current) return;
    if (!latest.current.eligible || latest.current.offline || latest.current.revision !== simulation.revision || latest.current.total !== simulation.total) return;
    const operation = ++sequence.current;
    const opened = visit.current;
    const current = () => mounted.current && focused.current && visit.current === opened && inFlight.current === operation;
    inFlight.current = operation;
    Keyboard.dismiss();
    setBusy(action); setError(null); setNotice(null);
    try {
      const result = await run({ submissionId: id, action, requestId: Crypto.randomUUID(),
        expectedRevision: simulation.revision, expectedTotal: simulation.total, ...(amount === undefined ? {} : { amount }) });
      if (!current() || !latest.current.eligible || latest.current.offline) return;
      if (result.actorClerkId !== actor || result.ownerId !== ownerId || result.submissionId !== id) return;
      if (latest.current.revision !== undefined && result.revision < latest.current.revision) return;
      if (latest.current.total !== simulation.total) {
        setError('The test price changed. Reset the simulation before continuing.');
        return;
      }
      setNotice(result.events[0]?.message ?? 'Simulation updated. No real money moved.');
    } catch (cause: unknown) {
      if (current()) {
        const data = cause && typeof cause === 'object' && 'data' in cause ? cause.data : null;
        setError(typeof data === 'string' ? data : cause instanceof Error ? cause.message : 'Could not update the simulation. Please try again.');
      }
    } finally {
      if (current()) { inFlight.current = null; setBusy(null); }
    }
  };

  const back = () => { Keyboard.dismiss(); router.replace(STEP_ROUTE.home as never); };
  if (simulation === undefined && id) return <Loading label="Checking simulator access" />;
  if (!eligible || !simulation) return <ScreenShell title="Simulator unavailable" onBack={back}
    subtitle="This test panel is only available for designated test businesses and accounts."
    footer={<Button title="Back to Today" onPress={back} />} />;

  const amount = simulationAmount(amountText);
  const locked = !!busy || offline || !simulation.canReset;
  const paymentLocked = locked || simulation.priceChanged || simulation.requestStatus === 'expired'
    || simulation.paymentStatus === 'paid' || !!simulation.pendingReview;
  const depositValid = amount !== null && amount >= simulation.minDeposit && amount < simulation.balanceDue;
  const receiptValid = amount !== null && (simulation.amountPaid > 0 ? amount === simulation.balanceDue
    : amount === simulation.total || amount >= simulation.minDeposit && amount < simulation.total);
  const reset = () => {
    if (locked || !focused.current) return;
    const opened = visit.current;
    Alert.alert('Reset this simulation?', 'This business’s simulated payments, receipts and activity will be cleared. Real payments and website status stay unchanged.', [
      { text: 'Keep simulation', style: 'cancel' },
      { text: 'Reset simulation', style: 'destructive', onPress: () => {
        if (mounted.current && focused.current && visit.current === opened) void apply('reset');
      } },
    ]);
  };
  const paymentLabel = simulation.paymentStatus === 'paid' ? 'Simulated paid' : simulation.paymentStatus === 'deposit_paid' ? 'Simulated deposit' : 'Simulated unpaid';

  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenShell title="PHP payment simulator" subtitle={simulation.businessName} onBack={back} contentStyle={styles.content}>
      <Banner tone="warn" title="PHP simulation · No real money"
        body="Test payments only. No payouts, website publication, emails or domain purchases." />
      <Card style={styles.card}>
        <Pill label={paymentLabel} tone={simulation.paymentStatus === 'paid' ? 'accent' : 'neutral'} />
        <AmountRow label="Test order total" amount={simulation.total} />
        <AmountRow label="Simulated amount paid" amount={simulation.amountPaid} />
        <AmountRow label="Simulated balance" amount={simulation.balanceDue} strong />
      </Card>
      {simulation.priceChanged ? <Banner tone="warn" title="Test price changed" body="Reset the simulation to use the current price. Real payments are unchanged." /> : null}
      {!simulation.canReset ? <Banner tone="warn" title="Test session limit reached" body="Ask the team to open a fresh test session." /> : null}
      {offline ? <Banner body="Reconnect to update the test ledger." /> : null}
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

      <Card style={styles.card}>
        <Text variant="heading">Simulate a payment</Text>
        <Text tone="muted">These controls update the test ledger only.</Text>
        <Button title="Simulate full payment" loading={busy === 'full'} disabled={paymentLocked || simulation.amountPaid > 0}
          onPress={() => { void apply('full'); }} />
        <Field label="Test transfer amount (PHP)" value={amountText} onChangeText={setAmountText} keyboardType="number-pad"
          editable={!locked} returnKeyType="done" onSubmitEditing={Keyboard.dismiss}
          helper={`Whole PHP only. Minimum deposit ${simulationPeso(simulation.minDeposit)}. Also used for a missing-reference test.`} />
        <Button title="Simulate deposit" variant="ghost" loading={busy === 'deposit'}
          disabled={paymentLocked || simulation.amountPaid > 0 || !depositValid} onPress={() => { if (amount !== null) void apply('deposit', amount); }} />
        <Button title="Simulate balance payment" variant="ghost" loading={busy === 'balance'}
          disabled={paymentLocked || simulation.amountPaid <= 0} onPress={() => { void apply('balance'); }} />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Missing reference</Text>
        <Text tone="muted">Keep the receipt in team review until you simulate confirmation.</Text>
        {simulation.pendingReview ? <View style={styles.review}>
          <Text weight="bold">Needs team review · {simulationPeso(simulation.pendingReview.amount)}</Text>
          <Text tone="muted">No amount is credited until confirmation.</Text>
          <Button title="Confirm test receipt" loading={busy === 'approve_review'} disabled={locked || simulation.priceChanged}
            onPress={() => { void apply('approve_review'); }} />
        </View> : <>
          <Text tone="muted">{simulation.reviewStatus === 'approved' ? 'Simulated team confirmation complete.' : 'No test receipts waiting for review.'}</Text>
          <Button title="Simulate missing reference" variant="ghost" loading={busy === 'unmatched'}
            disabled={paymentLocked || !receiptValid} onPress={() => { if (amount !== null) void apply('unmatched', amount); }} />
        </>}
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Expiry and duplicates</Text>
        <Text>Test reference: {simulation.referenceCode}</Text>
        <Text tone="muted">Attempt {simulation.attempt} · {simulation.requestStatus === 'expired' ? 'Expired' : simulation.requestStatus === 'paid' ? 'Paid in simulation' : 'Open'}</Text>
        {simulation.requestStatus === 'expired' ? <Button title="Pay again" loading={busy === 'renew'} disabled={locked || simulation.priceChanged}
          onPress={() => { void apply('renew'); }} />
          : <Button title="Expire test payment" variant="ghost" loading={busy === 'expire'}
            disabled={locked || simulation.priceChanged || simulation.requestStatus !== 'open' || !!simulation.pendingReview}
            onPress={() => { void apply('expire'); }} />}
        <Text tone="muted">Repeating a receipt adds no extra credit.</Text>
        <Button title="Repeat receipt" variant="ghost" loading={busy === 'duplicate'}
          disabled={locked || simulation.priceChanged || !simulation.lastReceiptId} onPress={() => { void apply('duplicate'); }} />
      </Card>

      <View style={styles.card}>
        <Text variant="heading">Test activity</Text>
        {simulation.events.length ? simulation.events.map(event => <Card key={event.id} style={styles.event}>
          <Text weight="bold">{event.message}</Text>
          {event.amount !== null ? <Text tone="muted">{simulationPeso(event.amount)} · PHP simulation</Text> : null}
          <Text tone="muted">{new Date(event.createdAt).toLocaleString()}</Text>
        </Card>) : <Text tone="muted">No simulated payments yet.</Text>}
      </View>
      <Button title="Reset simulation" variant="danger" loading={busy === 'reset'} disabled={locked} onPress={reset} />
      <Text tone="muted" align="center">Simulation results never mark your real website as paid or published.</Text>
    </ScreenShell>
  </KeyboardAvoidingView>;
}

function AmountRow({ label, amount, strong = false }: { label: string; amount: number; strong?: boolean }) {
  return <View style={styles.amountRow}><Text tone={strong ? 'ink' : 'ink2'} style={styles.flex}>{label}</Text>
    <Text weight={strong ? 'bold' : 'semibold'} tabular>{simulationPeso(amount)}</Text></View>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { gap: space.lg }, card: { gap: space.md },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  notice: { padding: space.md, backgroundColor: colors.accentSoft, borderRadius: 16 },
  review: { gap: space.md, padding: space.md, backgroundColor: colors.warnBg, borderRadius: 16 }, event: { gap: space.xs } });
