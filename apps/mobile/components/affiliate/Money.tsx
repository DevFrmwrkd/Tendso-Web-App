import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Card, Chip, Field, ScreenShell, Text, TextLink } from '../v2';
import { colors, fonts, hit, radius, space } from '../../theme/v2';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { AffiliateAccess, AffiliateFrame, type AffiliateAccessProps } from './Screen';
import { AffiliateToolFrame } from './AffiliateToolFrame';
import { samplePortal, type AffiliatePortal } from './model';
import { AffiliateLedger, affiliateActivity, AffiliateAmount } from './AffiliateActivity';

type Request = { amount: number; wiseEmail: string };
type Receipt = { amount: number; wiseEmail: string; reference?: string };
type MoneyProps = AffiliateAccessProps & {
  portal: AffiliatePortal | undefined;
  actorMatches?: boolean;
  onRequest?: (request: Request) => Promise<{ reference?: string } | undefined>;
  onSaveEmail?: (email: string) => Promise<unknown>;
};
type Review = { centavos: number; email: string; token: number; actorId: string };

/** Parse decimal input as integer centavos. Reject separators, exponents and extra precision. */
export function cashOutCentavos(value: string): number | null {
  const cents = readCentavos(value);
  // The numeric API payload must describe the exact same two-decimal amount as the review.
  return cents !== null && readCentavos(String(cents / 100)) === cents ? cents : null;
}

function readCentavos(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** API currency uses pesos; all UI comparisons and subtraction use integer centavos. */
export function pesoCentavos(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function centavosInput(value: number): string {
  const whole = Math.floor(value / 100);
  const cents = value % 100;
  return cents ? `${whole}.${String(cents).padStart(2, '0')}` : String(whole);
}

export function validWiseEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function canEdit(props: AffiliateAccessProps, actorMatches: boolean): boolean {
  return actorMatches && props.isAuthenticated && !props.isPreview && !props.isOffline &&
    props.account.role === 'affiliate' && props.account.status === 'active' && !props.account.isDeleted;
}

/** Wrapping label keeps the full amount visible with enlarged text. */
export function MoneyAction({ title, onPress, disabled = false, busy = false, testID }: {
  title: string; onPress: () => void; disabled?: boolean; busy?: boolean; testID?: string;
}) {
  return <Pressable testID={testID} onPress={onPress} disabled={disabled || busy} cssInterop={false}
    accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || busy, busy }}
    style={[styles.action, (disabled || busy) && styles.disabled]}>
    <Text variant="button" align="center">{busy ? 'Please wait…' : title}</Text>
  </Pressable>;
}

export function AffiliateMoneyScreen() {
  return <AffiliateAccess>{props => props.isPreview
    ? <AffiliateMoneyContent {...props} portal={samplePortal} />
    : <LiveMoney {...props} />}</AffiliateAccess>;
}

function LiveMoney(props: AffiliateAccessProps) {
  const { user } = useUser();
  const actorMatches = !!user?.id && user.id === props.account.clerkId;
  const portal = useQuery(api.affiliates.portal, props.isAuthenticated && actorMatches ? {} : 'skip');
  if (!canEdit(props, actorMatches)) return <AffiliateMoneyContent {...props} portal={actorMatches ? portal : undefined} />;
  return <WritableMoney key={`${props.account._id}:${user?.id ?? 'signed-out'}`} {...props} portal={portal} actorMatches={actorMatches} />;
}

function WritableMoney(props: MoneyProps) {
  const createWithdrawal = useMutation(api.withdrawals.create);
  const updateCreator = useMutation(api.creators.update);
  return <AffiliateMoneyContent {...props}
    onRequest={request => createWithdrawal({ creatorId: props.account._id, ...request })}
    onSaveEmail={wiseEmail => updateCreator({ id: props.account._id, wiseEmail })} />;
}

export function AffiliateMoneyContent(props: MoneyProps) {
  const { portal, account, isPreview, isOffline, onRequest, onSaveEmail, actorMatches = false } = props;
  const router = useGuardedRouter();
  const { height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [flow, setFlow] = useState<'closed' | 'amount' | 'setup' | 'review' | 'received'>('closed');
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState(account.wiseEmail ?? '');
  const [review, setReview] = useState<Review | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const busyRef = useRef(false);
  const consumed = useRef(new Set<number>());
  const nextReview = useRef(0);
  const mounted = useRef(true);
  const balanceCents = pesoCentavos(portal?.summary.balance);
  const writable = canEdit(props, actorMatches) && !!portal;
  const live = useRef({ writable, balanceCents, accountId: account._id });
  live.current = { writable, balanceCents, accountId: account._id };
  const preferredEmail = savedEmail ?? account.wiseEmail ?? '';

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', event => {
      setKeyboardHeight(Math.max(0, height - event.endCoordinates.screenY));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, [height]);
  useEffect(() => {
    // Account/auth changes close editable data; a completed receipt remains truthful.
    if (!writable && !busyRef.current && flow !== 'received') setFlow('closed');
  }, [writable, flow]);

  const close = () => { if (!busyRef.current) { Keyboard.dismiss(); setError(''); setFlow('closed'); } };
  const showHistory = () => { close(); router.push('/(app)/affiliate/activity'); };
  function openCashOut() {
    if (!live.current.writable || busyRef.current || !balanceCents) return;
    setAmount(centavosInput(balanceCents)); setEmail(preferredEmail); setReview(null); setError('');
    setFlow(preferredEmail ? 'amount' : 'setup');
  }
  function reviewRequest() {
    if (!live.current.writable || busyRef.current) return;
    const cents = cashOutCentavos(amount);
    if (cents === null) { setError('Enter an amount with up to two decimal places.'); return; }
    if (live.current.balanceCents === null || cents > live.current.balanceCents) { setError('Amount exceeds your available balance.'); return; }
    if (!validWiseEmail(email.trim())) { setError('Enter the email linked to your Wise account.'); return; }
    Keyboard.dismiss(); setError('');
    setReview({ centavos: cents, email: email.trim(), token: ++nextReview.current, actorId: account._id });
    setFlow('review');
  }
  async function confirmRequest() {
    if (!review || review.actorId !== live.current.accountId || busyRef.current || consumed.current.has(review.token) || !live.current.writable || !onRequest) return;
    if (live.current.balanceCents === null || review.centavos > live.current.balanceCents) {
      setError('Your balance changed. Go back and review the amount again.'); return;
    }
    const actorId = account._id;
    const currentReview = review;
    busyRef.current = true; consumed.current.add(currentReview.token); setBusy(true); setError('');
    try {
      const result = await onRequest({ amount: currentReview.centavos / 100, wiseEmail: currentReview.email });
      if (!mounted.current || live.current.accountId !== actorId) return;
      setReceipt({ amount: currentReview.centavos / 100, wiseEmail: currentReview.email, reference: result?.reference });
      setFlow('received');
    } catch {
      // A disconnected response may still have created a request. Never replay the same confirmation.
      if (mounted.current && live.current.accountId === actorId) setError('We could not confirm the request. Check payout history before trying again.');
    } finally {
      busyRef.current = false;
      if (mounted.current && live.current.accountId === actorId) setBusy(false);
    }
  }
  async function saveEmail() {
    if (busyRef.current || !live.current.writable || !onSaveEmail) return;
    const value = email.trim();
    if (!validWiseEmail(value)) { setError('Enter a valid Wise email address.'); return; }
    const actorId = account._id;
    busyRef.current = true; setBusy(true); setError('');
    try {
      await onSaveEmail(value);
      if (!mounted.current || live.current.accountId !== actorId || !live.current.writable) return;
      setSavedEmail(value); setEmail(value); setFlow('amount');
    } catch (err) {
      if (mounted.current && live.current.accountId === actorId) setError(err instanceof Error ? err.message : 'Could not save your Wise email. Try again.');
    } finally {
      busyRef.current = false;
      if (mounted.current && live.current.accountId === actorId) setBusy(false);
    }
  }

  const loading = portal === undefined && !isOffline;
  const ledger = portal ? affiliateActivity(portal).slice(0, 3) : [];
  const sheetMaxHeight = Math.max(150, height - insets.top - insets.bottom - keyboardHeight - 64);
  const pendingRequests = (portal?.withdrawals ?? []).filter(row => row.status === 'pending' || row.status === 'processing');
  const actionShowsHistory = balanceCents === 0 && pendingRequests.length > 0;
  return <>
    <AffiliateFrame preview={isPreview} suspended={account.status !== 'active'} offline={isOffline}
      footer={<MoneyAction testID="affiliate-cashout" title={actionShowsHistory ? 'View cash-out request' : 'Cash out to Wise'}
        onPress={actionShowsHistory ? showHistory : openCashOut}
        disabled={actionShowsHistory ? !portal : !writable || balanceCents === null || balanceCents <= 0} />}>
      <View style={styles.topline}>
        <Text variant="title" accessibilityRole="header" style={styles.flex}>Your money</Text>
        <Pressable onPress={showHistory} accessibilityRole="button" accessibilityLabel="Payout and earning history" style={styles.round}>
          <Ionicons name="time-outline" size={22} color={colors.ink} />
        </Pressable>
      </View>
      <Card variant="lg" style={styles.balance}>
        <Text variant="label" tone="muted">Available to cash out</Text>
        <AffiliateAmount testID="affiliate-money-balance" amount={portal?.summary.balance} size={47} loading={loading} />
        <View style={[styles.totals, fontScale > 1.15 && styles.stackedTotals]}>
          <MoneyStat label="Total earned" amount={portal?.summary.totalEarned} loading={loading} />
          <MoneyStat label="Cashed out" amount={portal?.summary.totalWithdrawn} loading={loading} />
        </View>
      </Card>
      {portal ? <>
        <BalanceNote label="Awaiting shop payment" amount={portal.summary.pendingCommission} />
        {portal.summary.inFlight > 0 ? <BalanceNote label="Cash outs in progress" amount={portal.summary.inFlight} /> : null}
      </> : <Text tone="muted">{loading ? 'Loading your money…' : 'Reconnect to load your balance and activity.'}</Text>}
      <View style={styles.sectionLine}>
        <Text weight="bold" style={styles.flex}>Latest activity</Text>
        <TextLink label="See all" onPress={showHistory} />
      </View>
      {portal ? ledger.length ? <AffiliateLedger rows={ledger} /> : <Card style={styles.empty}>
        <Text variant="heading">Your money starts here</Text>
        <Text tone="muted">Your credited earnings and cash-out requests will appear here.</Text>
      </Card> : null}
    </AffiliateFrame>

    {/* One native modal owns every step; iOS never has to present another modal during dismissal. */}
    <Modal visible={flow !== 'closed'} transparent animationType="slide" onRequestClose={close}>
      {flow === 'amount' ? <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={close} accessibilityRole="button" accessibilityLabel="Dismiss cash out" />
        <View testID="affiliate-cashout-sheet" style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 18 }]}>
          <View style={styles.grab} />
          <ScrollView style={{ maxHeight: sheetMaxHeight }} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
        <View style={styles.topline}>
          <View style={styles.flex}><Text variant="heading" accessibilityRole="header">Cash out to Wise</Text>
            <Text tone="muted">{portal ? <><AffiliateAmountInline amount={portal.summary.balance} /> available</> : 'Balance unavailable'}</Text></View>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close cash out" style={styles.round}>
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>
        <Card variant="lg" style={styles.amountCard}>
          <Text variant="label" tone="muted" align="center">Amount</Text>
          <View style={styles.amountInputRow}>
            <Text variant="heading">₱</Text>
            <TextInput testID="affiliate-cashout-amount" accessibilityLabel="Cash-out amount" value={amount} onChangeText={value => { setAmount(value); setError(''); }}
              keyboardType="decimal-pad" inputMode="decimal" maxLength={18} editable={writable && !busy} style={styles.amountInput} />
          </View>
          <View style={styles.quickPicks}>
            {[100000, 200000].map(cents => <QuickPick key={cents} title={money(cents / 100)} selected={cashOutCentavos(amount) === cents}
              disabled={!writable || balanceCents === null || cents > balanceCents} onPress={() => { setAmount(centavosInput(cents)); setError(''); }} />)}
            <QuickPick title={`All · ${balanceCents === null ? '—' : money(balanceCents / 100)}`} selected={cashOutCentavos(amount) === balanceCents}
              disabled={!writable || !balanceCents} onPress={() => { if (balanceCents !== null) setAmount(centavosInput(balanceCents)); setError(''); }} />
          </View>
        </Card>
        <View style={styles.sectionLine}><Text weight="bold" style={styles.flex}>Your Wise email</Text>
          <TextLink label="Change" onPress={() => { setError(''); setFlow('setup'); }} disabled={!writable} /></View>
        <Card style={styles.email}><Ionicons name="mail-outline" size={22} color={colors.ink2} /><Text style={styles.flex}>{email}</Text></Card>
        <Text tone="muted">We’ll show the transfer status in your payout history.</Text>
        {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
        <MoneyAction title="Review cash out" onPress={reviewRequest} disabled={!writable} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView> : flow === 'setup' ? <WiseEmailForm email={email} onEmail={setEmail} onSave={saveEmail} onBack={close} busy={busy}
        writable={writable} error={error} /> : flow === 'review' && review ? <ScreenShell tone="neutral" title="Ready to request?" onBack={() => { if (!busyRef.current) { setError(''); setFlow('amount'); } }}
          contentStyle={styles.flowContent} footer={<MoneyAction testID="affiliate-confirm-cashout" title={`Request ${money(review.centavos / 100)}`}
            onPress={confirmRequest} disabled={!writable || consumed.current.has(review.token)} busy={busy} />}>
          <Card variant="lg" style={styles.reviewAmount}><Text variant="label" tone="muted">Cash-out amount</Text><AffiliateAmount amount={review.centavos / 100} size={47} /></Card>
          <Card style={styles.details}>
            <Detail label="To" value="Wise" /><Detail label="Email" value={review.email} />
            <View style={styles.detail}><Text tone="muted">Available after request</Text><AffiliateAmount amount={balanceCents === null ? undefined : Math.max(0, balanceCents - review.centavos) / 100} size={20} /></View>
          </Card>
          <Text tone="muted">Your request will be pending until the transfer is processed.</Text>
          {!writable ? <Banner tone="warn" body="Reconnect with an active creator account to request a cash out." /> : null}
          {error ? <><Text tone="danger" accessibilityRole="alert">{error}</Text><TextLink label="Check payout history" onPress={showHistory} /></> : null}
        </ScreenShell> : flow === 'received' && receipt ? <ScreenShell tone="neutral" onBack={close} contentStyle={styles.flowContent}
          footer={<MoneyAction title="View payout history" onPress={showHistory} />}>
          <View style={styles.received}>
            <View style={styles.receivedIcon}><Ionicons name="time-outline" size={40} color={colors.ink} /></View>
            <Text variant="title" accessibilityRole="header" align="center">Request received</Text>
            <AffiliateAmount amount={receipt.amount} size={32} /><Text tone="muted" align="center">to Wise · {receipt.wiseEmail}</Text>
            <Chip label="Pending" tone="warn" />
          </View>
          <Card style={styles.empty}><Text tone="muted">Your money is reserved. Check history for transfer updates.</Text>
            {receipt.reference ? <Text variant="label" tone="muted">Reference: {receipt.reference}</Text> : null}</Card>
        </ScreenShell> : null}
    </Modal>
  </>;
}

function money(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function AffiliateAmountInline({ amount }: { amount: number }) { return <Text tone="muted" tabular>{money(amount)}</Text>; }

function MoneyStat({ label, amount, loading }: { label: string; amount?: number; loading: boolean }) {
  return <View style={styles.stat}><AffiliateAmount amount={amount} size={23} loading={loading} /><Text variant="label" tone="muted">{label}</Text></View>;
}

function BalanceNote({ label, amount }: { label: string; amount: number }) {
  return <View style={styles.note}><Text variant="label" tone="ink2" style={styles.flex}>{label}</Text><AffiliateAmount amount={amount} size={17} /></View>;
}

function QuickPick({ title, selected, disabled, onPress }: { title: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ selected, disabled }} style={[styles.quick, selected && styles.quickSelected, disabled && styles.disabled]}>
    <Text variant="label" align="center" tabular>{title}</Text>
  </Pressable>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detail}><Text tone="muted">{label}</Text><Text weight="bold" style={styles.detailValue}>{value}</Text></View>;
}

const WISE_SIGNUP = 'https://wise.com/register';
function WiseEmailForm({ email, onEmail, onSave, onBack, busy, writable, error, saved = false, pushed = false, preview = false, offline = false, suspended = false }: {
  email: string; onEmail: (value: string) => void; onSave: () => void; onBack?: () => void; busy: boolean; writable: boolean;
  error: string; saved?: boolean; pushed?: boolean; preview?: boolean; offline?: boolean; suspended?: boolean;
}) {
  const footer = <MoneyAction title="Save Wise email" onPress={onSave} disabled={!writable} busy={busy} />;
  const content = <>
    <Text variant="title" accessibilityRole="header">Your Wise email.</Text>
    <Text tone="muted">Use the email linked to your Wise account.</Text>
    <Field label="Wise email" value={email} onChangeText={onEmail} editable={writable && !busy} autoCapitalize="none"
      keyboardType="email-address" autoComplete="email" returnKeyType="done" onSubmitEditing={onSave} />
    {saved ? <Banner tone="ok" body="Your Wise email is saved." /> : null}
    {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
    <TextLink label="Create a Wise account" onPress={() => { void Linking.openURL(WISE_SIGNUP).catch(() => {}); }} />
  </>;
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    {pushed ? <AffiliateToolFrame title="Payout details" preview={preview} offline={offline} suspended={suspended} footer={footer}>{content}</AffiliateToolFrame>
      : <ScreenShell tone="neutral" onBack={busy ? undefined : onBack} contentStyle={styles.flowContent} footer={footer}>{content}</ScreenShell>}
  </KeyboardAvoidingView>;
}

export function AffiliatePayoutDetailsScreen() {
  return <AffiliateAccess>{props => props.isPreview
    ? <PayoutDetailsContent {...props} /> : <LivePayoutDetails {...props} />}</AffiliateAccess>;
}

function LivePayoutDetails(props: AffiliateAccessProps) {
  const { user } = useUser();
  const actorMatches = !!user?.id && user.id === props.account.clerkId;
  if (!canEdit(props, actorMatches)) return <PayoutDetailsContent {...props} />;
  return <WritablePayoutDetails key={`${props.account._id}:${user?.id ?? 'signed-out'}`} {...props} />;
}

function WritablePayoutDetails(props: AffiliateAccessProps) {
  const updateCreator = useMutation(api.creators.update);
  return <PayoutDetailsContent {...props} actorMatches
    onSaveEmail={wiseEmail => updateCreator({ id: props.account._id, wiseEmail })} />;
}

export function PayoutDetailsContent(props: AffiliateAccessProps & { actorMatches?: boolean; onSaveEmail?: (email: string) => Promise<unknown> }) {
  const [email, setEmail] = useState(props.account.wiseEmail ?? '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const writable = canEdit(props, props.actorMatches === true);
  const live = useRef({ writable, accountId: props.account._id });
  live.current = { writable, accountId: props.account._id };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const save = async () => {
    if (!live.current.writable || busyRef.current || !props.onSaveEmail) return;
    const value = email.trim();
    if (!validWiseEmail(value)) { setError('Enter a valid Wise email address.'); return; }
    const actorId = props.account._id;
    busyRef.current = true; setBusy(true); setError(''); setSaved(false);
    try {
      await props.onSaveEmail(value);
      if (mounted.current && live.current.accountId === actorId && live.current.writable) { setEmail(value); setSaved(true); }
    } catch (err) {
      if (mounted.current && live.current.accountId === actorId) setError(err instanceof Error ? err.message : 'Could not save your Wise email. Try again.');
    } finally {
      busyRef.current = false;
      if (mounted.current && live.current.accountId === actorId) setBusy(false);
    }
  };
  return <WiseEmailForm pushed email={email} onEmail={value => { setEmail(value); setSaved(false); setError(''); }} onSave={save}
    busy={busy} writable={writable} error={error} saved={saved} preview={props.isPreview} offline={props.isOffline} suspended={props.account.status !== 'active'} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  topline: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: hit.icon },
  round: { minHeight: hit.icon, width: hit.icon, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  balance: { gap: 10, padding: 20 },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 14, marginTop: 8 },
  stackedTotals: { flexDirection: 'column' },
  stat: { flexGrow: 1, flexBasis: 120, gap: 4, minWidth: 0 },
  note: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingHorizontal: 17, paddingVertical: 13, backgroundColor: colors.bg2, borderRadius: 17 },
  sectionLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { gap: 10 },
  action: { minHeight: hit.primary, paddingVertical: 16, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: colors.accent, justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  modal: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  sheet: { paddingHorizontal: 20, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.bg },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.ruleStrong, alignSelf: 'center', marginBottom: 16 },
  sheetContent: { gap: 16, paddingBottom: 12 },
  amountCard: { gap: 10, paddingVertical: 23, paddingHorizontal: 16 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput: { flex: 1, minWidth: 0, minHeight: 60, fontFamily: fonts.bold, fontSize: 38, lineHeight: 48, color: colors.ink, padding: 0, fontVariant: ['tabular-nums'] },
  quickPicks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 },
  quick: { minHeight: hit.min, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.bg2, borderWidth: 1, borderColor: 'transparent', justifyContent: 'center', maxWidth: '100%' },
  quickSelected: { backgroundColor: colors.accent, borderColor: colors.ink },
  email: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  flowContent: { gap: 20 },
  reviewAmount: { gap: 12 },
  details: { gap: 20 },
  detail: { gap: 6 },
  detailValue: { flexShrink: 1 },
  received: { alignItems: 'center', gap: 18, paddingVertical: 24 },
  receivedIcon: { width: 86, height: 86, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg2, borderRadius: radius.pill },
});
