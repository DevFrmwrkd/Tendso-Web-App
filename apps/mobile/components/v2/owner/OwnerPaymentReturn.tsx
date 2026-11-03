import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, ScreenShell, Text } from '..';
import { OwnerSiteSummary } from './OwnerSiteSummary';
import { OwnerSaveExit } from './OwnerSaveExit';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { useOwnerPaymentAttempt, usePaymentState } from '../../../lib/v2/ownerData';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';
import { peso } from '../../../lib/v2/ownerContent';
import type { SubmissionId } from '../../../lib/v2/ownerTypes';
import { useNetwork } from '../../../providers/NetworkProvider';
import { colors, space } from '../../../theme/v2';

/** Browser dismissal cannot tell us whether money was received. */
export function OwnerPaymentReturn({ id, token, actor }: { id: SubmissionId; token: string; actor: string }) {
  const router = useGuardedRouter();
  const scope = useOwnerScope();
  const { isConnected } = useNetwork();
  const attempt = useOwnerPaymentAttempt(id, token);
  const pay = usePaymentState(id);
  const valid = !!attempt && attempt.submissionId === id;
  const status = valid ? attempt.status : null;
  const loading = attempt === undefined || pay === undefined;
  const balance = !!pay?.billable && pay.canPayBalance && !pay.paidInFull;
  const paid = !!pay?.billable && pay.paidInFull;
  const approval = status === 'needs_approval' || (!!pay?.billable && pay.needsApproval);
  const expired = status === 'expired' && !paid && !approval;
  const cancelled = status === 'cancelled' && !paid;
  const received = status === 'paid' || paid;
  const processing = status === 'processing' && !paid;
  const available = !loading && valid && !!pay?.billable && isConnected !== false;
  const retryOffered = !loading && valid && !!pay?.billable && !paid && !approval && !cancelled && !processing && !received;
  const canRetry = retryOffered && isConnected !== false;
  const current = () => scope.isCurrent() && scope.id === id;
  const go = (route: string) => { if (current()) router.replace(route); };
  const retry = () => {
    if (!current() || !canRetry || !attempt) return;
    router.replace({ pathname: '/(owner)/pay/method', params: {
      kind: attempt.kind, amount: String(attempt.amount), retryToken: token, retryFor: actor,
    } });
  };
  const title = loading ? 'Checking your payment' : approval ? 'Check your site first' : expired ? 'Payment link expired'
    : cancelled ? 'This payment link is closed' : received ? (balance ? 'Down payment received' : 'Payment received')
      : processing ? 'Checking your payment' : !valid ? 'Payment unavailable' : 'Waiting for your payment';
  const message = processing ? 'An earlier checkout may still be open. Wait for its status to update before trying again.'
    : loading ? 'We’ll update this screen when your payment is confirmed.'
    : approval ? 'Review the latest version of your site before paying.'
      : expired ? 'This checkout has expired. Start a new payment using your shop’s latest balance.'
        : cancelled ? 'Review your shop’s current payment options to continue.'
          : received ? (balance ? `You have ${peso(pay?.billable ? pay.balanceDue : 0)} left to pay.` : 'Your payment is confirmed. Your site will update when it’s ready.')
            : !valid ? 'Return to your shop to check its payment options.' : 'We’ll update this screen when your payment is confirmed.';

  return <ScreenShell scroll={false} headerRight={<OwnerSaveExit title="Back to Today" />}
    footer={<>
      {approval ? <Button title="Check my site" onPress={() => go(STEP_ROUTE.check)} /> : null}
      {retryOffered ? <Button title={expired ? 'Pay again' : 'Continue payment'} disabled={!canRetry} onPress={retry} /> : null}
      {available && !approval && (cancelled || (received && balance)) ? <Button
        title={balance && received ? `Pay the rest · ${peso(pay?.billable ? pay.balanceDue : 0)}` : 'Review payment options'}
        onPress={() => go(STEP_ROUTE.pay)} /> : null}
      {!loading && !valid ? <Button title="Review payment options" onPress={() => go(STEP_ROUTE.pay)} /> : null}
      {isConnected === false ? <Text tone="muted" align="center">Reconnect to check the latest payment status.</Text> : null}
      <Button title="Back to home" variant="ghost" onPress={() => go(STEP_ROUTE.home)} />
    </>}>
    <OwnerSiteSummary name={scope.site?.businessName ?? 'Your shop'} />
    <View style={styles.center}>
      <View style={styles.icon}>
        {loading || processing ? <ActivityIndicator size="large" color={colors.ink} /> : <Ionicons
          name={received ? 'checkmark' : expired ? 'time-outline' : cancelled || !valid ? 'alert-circle-outline' : 'hourglass-outline'}
          size={36} color={colors.ink} />}
      </View>
      <Text variant="display" align="center" accessibilityRole="header">{title}</Text>
      <Card><Text tone="ink2" align="center">{message}</Text></Card>
    </View>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.lg, paddingVertical: space.xl },
  icon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
