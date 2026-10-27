import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Keyboard, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { useNetwork } from '../../../providers/NetworkProvider';
import { colors, fonts, radius, shadow, space } from '../../../theme/v2';
import {
  Banner,
  Button,
  Card,
  Field,
  ListRow,
  Loading,
  Pill,
  ScreenShell,
  SectionLabel,
  Text,
  formatPeso,
} from '../../../components/v2';
import { SwipeSheet } from '../../../components/ui/SwipeSheet';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { PreviewWallet } from '../../../components/AccountPreview';
import { activityTime, EarningRow, EarningsTrend, isCredited, PayoutRow, WalletHistory, walletPeso as peso,
  type HistoryFilter, type WalletEarning, type WalletWithdrawal } from '../../../components/wallet/WalletActivity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useWalletThumbnails } from '../../../hooks/useWalletThumbnails';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withdrawalAmount(value: string): number {
  return /^\d+(?:\.\d{1,2})?$/.test(value.trim()) ? Number(value) : Number.NaN;
}

function moneyTextUnits(value: string): number {
  return [...value].reduce((sum, character) => sum + (/[.,]/.test(character) ? 0.34 : 0.7), 0);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_PICKS = [1000, 2000];

const WISE_REFERRAL_LINK =
  'https://wise.com/invite/dic/theoimmorosalesv?utm_source=desktop-invite-tab-copylink&utm_medium=invite&utm_campaign=&utm_content=&referralCode=theoimmorosalesv';

// ---------------------------------------------------------------------------
// Withdrawal Form type
// ---------------------------------------------------------------------------

type WithdrawalForm = {
  amount: string;
  wiseEmail: string;
};

const EMPTY_FORM: WithdrawalForm = {
  amount: '',
  wiseEmail: '',
};

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Stat({ label, value, fontSize, fontScale, stacked, testID }: {
  label: string; value: string; fontSize: number; fontScale: number; stacked: boolean; testID: string;
}) {
  return (
    <Card variant="lg" style={[styles.stat, stacked && styles.statStacked]} accessible accessibilityLabel={`${label}, ${value}`}>
      <View style={{ minHeight: Math.ceil(fontSize * 1.2 * Math.max(1, fontScale)), justifyContent: 'center' }}>
        <Text testID={testID} variant="title" tabular numberOfLines={1}
          style={{ fontSize, lineHeight: Math.ceil(fontSize * 1.2), letterSpacing: -0.5 }}>{value}</Text>
      </View>
      <Text variant="label" tone="muted">
        {label}
      </Text>
    </Card>
  );
}

function EmptyRow({ title, body }: { title: string; body: string }) {
  return (
    <Card style={styles.empty}>
      <Text variant="heading">{title}</Text>
      <Text variant="body" tone="ink2">
        {body}
      </Text>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function WalletScreen() {
  const { isPreview, account, isAuthenticated } = useMobileAccount();
  return isPreview ? <PreviewWallet /> : <WalletSession isAffiliate={account?.role === 'affiliate'} isAuthenticated={isAuthenticated} />;
}

function WalletSession({ isAffiliate, isAuthenticated }: { isAffiliate: boolean; isAuthenticated: boolean }) {
  const { user } = useUser();
  // Never carry an open payout editor or a resolved request into another login.
  return <PersonalWallet key={`${user?.id ?? 'signed-out'}:${isAffiliate}:${isAuthenticated}`} clerkId={user?.id}
    isAffiliate={isAffiliate} isAuthenticated={isAuthenticated} />;
}

function PersonalWallet({ isAffiliate, isAuthenticated, clerkId }: { isAffiliate: boolean; isAuthenticated: boolean; clerkId?: string }) {
  const router = useGuardedRouter();
  const { isConnected } = useNetwork();
  const isOffline = isConnected === false;
  const { height, width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [balanceWidth, setBalanceWidth] = useState(0);
  const [statsWidth, setStatsWidth] = useState(0);
  const wiseEmailInput = useRef<TextInput>(null);

  const rawCreator = useQuery(api.creators.getByClerkId, clerkId && isAuthenticated ? { clerkId } : 'skip');
  const creator = !isAuthenticated || !clerkId || (rawCreator?.clerkId && rawCreator.clerkId !== clerkId) ? undefined : rawCreator;
  const creatorWithdrawals = useQuery(
    api.withdrawals.getByCreator,
    creator?._id && !isAffiliate ? { creatorId: creator._id } : 'skip'
  );
  const creatorEarnings = useQuery(
    api.earnings.getByCreator,
    creator?._id && !isAffiliate ? { creatorId: creator._id } : 'skip'
  );
  const portal = useQuery(api.affiliates.portal, isAffiliate && creator?._id && isAuthenticated ? {} : 'skip');
  const withdrawals: WalletWithdrawal[] | undefined = creator ? (isAffiliate ? portal?.withdrawals : creatorWithdrawals) : undefined;
  const earnings: WalletEarning[] | undefined = creator ? (isAffiliate ? portal?.earnings : creatorEarnings) : undefined;

  const createWithdrawal = useMutation(api.withdrawals.create);
  // Persist the Wise payout email through the canonical profile mutation.
  const updateCreator = useMutation(api.creators.update);

  const [showModal, setShowModal] = useState(false);
  const [showWiseSetup, setShowWiseSetup] = useState(false);
  const [wiseSetupEmail, setWiseSetupEmail] = useState('');
  const [form, setForm] = useState<WithdrawalForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const mounted = useRef(true);
  const submitBusy = useRef(false);
  const setupBusy = useRef(false);
  const suspended = creator?.status === 'suspended';
  const paused = suspended || creator?.status === 'deleted' || !!creator?.isDeleted || (isAffiliate && creator?.status !== 'active');
  const canWrite = !!creator?._id && !!clerkId && isAuthenticated && !isOffline && !paused;
  const balance = creator ? (isAffiliate ? portal?.summary.balance : undefined) ?? creator.balance ?? 0 : null;
  const live = useRef({ creatorId: creator?._id, canWrite, balance });
  live.current = { creatorId: creator?._id, canWrite, balance };
  const sortedEarnings = earnings ? [...earnings].sort((a, b) => activityTime(b) - activityTime(a)) : undefined;
  const recentEarnings = sortedEarnings?.slice(0, 1) ?? [];
  const submissionDetails = useWalletThumbnails({ creatorId: creator?._id, clerkId,
    isAuthenticated, isAffiliate, isOffline,
    submissionIds: (showHistory ? sortedEarnings ?? [] : recentEarnings)
      .map(row => row.submissionId).filter((id): id is string => typeof id === 'string'),
  });

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const shown = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', event => {
      setKeyboardHeight(Math.max(0, height - event.endCoordinates.screenY));
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { shown.remove(); hidden.remove(); };
  }, [height]);
  useFocusEffect(useCallback(() => {
    if (!showHistory || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setShowHistory(false); return true; });
    return () => subscription.remove();
  }, [showHistory]));
  const sheetMaxHeight = Math.max(160, height - insets.top - insets.bottom - keyboardHeight - 90);

  if (isAuthenticated && !isOffline && (creator === undefined || (isAffiliate && creator && portal === undefined))) {
    return (
      <View testID="activity-indicator" style={styles.flex}>
        <Loading />
      </View>
    );
  }

  const sortedWithdrawals = withdrawals ? [...withdrawals].sort((a, b) => activityTime(b) - activityTime(a)) : undefined;
  const recentWithdrawals = sortedWithdrawals?.slice(0, 1) ?? [];
  const savedWiseEmail = creator?.wiseEmail;
  const totalEarnings = creator ? (isAffiliate ? portal?.summary.totalEarned : creator.totalEarnings)
    ?? (earnings ? earnings.filter(isCredited).reduce((sum, row) => sum + row.amount, 0) : null) : null;
  const totalWithdrawn = creator ? (isAffiliate ? portal?.summary.totalWithdrawn : creator.totalWithdrawn)
    ?? (withdrawals ? withdrawals.filter(row => row.status === 'completed').reduce((sum, row) => sum + row.amount, 0) : null) : null;

  function openHistory(filter: HistoryFilter) { setHistoryFilter(filter); setShowHistory(true); }
  function sameActor(creatorId: string) { return mounted.current && live.current.creatorId === creatorId; }

  function openWithdrawFlow() {
    if (!canWrite || !balance || submitBusy.current || setupBusy.current) return;
    if (savedWiseEmail) {
      // The whole balance is pre-picked; quick-pick pills change it.
      setForm({ amount: String(balance), wiseEmail: savedWiseEmail });
      setFormError('');
      setShowModal(true);
    } else {
      setWiseSetupEmail('');
      setSetupError('');
      setShowWiseSetup(true);
    }
  }

  function closeModal() {
    if (submitBusy.current) return;
    setShowModal(false);
  }

  function closeWiseSetup() {
    if (setupBusy.current) return;
    setShowWiseSetup(false);
  }

  function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handleSaveWiseEmail() {
    if (setupBusy.current || !live.current.canWrite || !creator?._id) return;
    setSetupError('');
    const email = wiseSetupEmail.trim();
    if (!email) { setSetupError('Please enter your Wise email address.'); return; }
    if (!isValidEmail(email)) { setSetupError('Please enter a valid email address.'); return; }
    const creatorId = creator._id;
    setupBusy.current = true;
    setSavingEmail(true);
    try {
      await updateCreator({ id: creatorId, wiseEmail: email });
      if (!sameActor(creatorId)) return;
      if (!live.current.canWrite) { setSetupError('Reconnect with an active account to continue.'); return; }
      setShowWiseSetup(false);
      setForm({ amount: String(live.current.balance), wiseEmail: email });
      setFormError('');
      setShowModal(true);
    } catch (err: any) {
      if (sameActor(creatorId)) setSetupError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setupBusy.current = false;
      if (sameActor(creatorId)) setSavingEmail(false);
    }
  }

  async function handleSubmit() {
    if (submitBusy.current || !live.current.canWrite || !creator?._id) return;
    setFormError('');

    const amount = withdrawalAmount(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setFormError('Please enter a valid amount.'); return; }
    if (live.current.balance === null || amount > live.current.balance) { setFormError('Amount exceeds your available balance.'); return; }
    if (!form.wiseEmail.trim()) { setFormError('Wise email is required.'); return; }
    if (!isValidEmail(form.wiseEmail.trim())) { setFormError('Please enter a valid email address.'); return; }
    const creatorId = creator._id;
    submitBusy.current = true;
    setSubmitting(true);
    try {
      await createWithdrawal({
        creatorId,
        amount,
        wiseEmail: form.wiseEmail.trim(),
      });
      if (!sameActor(creatorId)) return;
      setShowModal(false);
      if (!live.current.canWrite) return;
      Alert.alert(
        'Withdrawal submitted',
        `Your request for ${peso(amount)} was received. Track its status in Payout history. We'll notify you when the transfer completes.`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      if (sameActor(creatorId)) setFormError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      submitBusy.current = false;
      if (sameActor(creatorId)) setSubmitting(false);
    }
  }

  const typedAmount = withdrawalAmount(form.amount);
  const amountReady = Number.isFinite(typedAmount) && typedAmount > 0 && balance !== null && typedAmount <= balance;
  const sendLabel = amountReady ? `Send ${peso(typedAmount)} to Wise` : 'Send to Wise';
  const balanceText = balance === null ? '—' : peso(balance);
  const balanceUnits = moneyTextUnits(balanceText);
  const balanceAvailableWidth = balanceWidth || Math.max(100, width - 40 - 28);
  // Size from the actual card width, including centavos and grouping marks.
  // Native and web both show the full amount without relying on text autosize.
  const balanceFontSize = Math.max(16, Math.min(48, Math.floor(balanceAvailableWidth / (balanceUnits * Math.max(1, fontScale)))));
  const earnedText = totalEarnings === null ? '—' : peso(totalEarnings);
  const withdrawnText = totalWithdrawn === null ? '—' : peso(totalWithdrawn);
  const statUnits = Math.max(moneyTextUnits(earnedText), moneyTextUnits(withdrawnText));
  const statsAvailableWidth = statsWidth || Math.max(100, width - 40);
  const sideBySideValueWidth = (statsAvailableWidth - space.sm) / 2 - space.md * 2;
  const stackStats = statUnits * 16 * Math.max(1, fontScale) > sideBySideValueWidth;
  const statValueWidth = stackStats ? statsAvailableWidth - space.md * 2 : sideBySideValueWidth;
  const statFontSize = Math.max(16, Math.min(22, Math.floor(statValueWidth / (statUnits * Math.max(1, fontScale)))));
  const cashOutTitle = balance === null ? 'Balance unavailable' : balance > 0 ? `Cash out ${peso(balance)} to Wise` : 'No balance available';
  const cashOutUnits = [...cashOutTitle].reduce((sum, character) => sum + (/\s/.test(character) ? 0.3 : /[.,]/.test(character) ? 0.34 : /[0-9₱]/.test(character) ? 0.7 : 0.58), 0);
  const compactCashOut = balance !== null && balance > 0 && cashOutUnits * 18 * Math.max(1, fontScale) > Math.max(100, width - space.gutter * 2 - space.xl * 2);

  if (showHistory && creator) return <WalletHistory earnings={earnings} withdrawals={withdrawals} balance={balance}
    earned={totalEarnings} withdrawn={totalWithdrawn} submissionDetails={submissionDetails.bySubmission}
    isOffline={isOffline} filter={historyFilter} onFilter={setHistoryFilter} onBack={() => setShowHistory(false)} />;

  return (
    <ScreenShell
      insetBottom={false}
      testID="earn-screen"
      contentStyle={styles.content}
      footerStyle={styles.footer}
      footer={
        <>
          {compactCashOut && balance !== null ? <Text variant="label" align="center" tabular>{peso(balance)} to Wise</Text> : null}
          <Button testID="withdraw-button" size="md" title={compactCashOut ? 'Cash out' : cashOutTitle} accessibilityLabel={cashOutTitle}
            onPress={openWithdrawFlow} disabled={!canWrite || balance === null || balance <= 0} />
        </>
      }
    >
      <View style={styles.stack}>
        {isOffline ? (
          <Banner tone="warn" icon="cloud-offline-outline" body="You're offline. Reconnect to cash out." />
        ) : null}
        {paused && creator ? (
          <Banner
            tone="warn"
            title="Cash out is paused"
            body={`Your ${isAffiliate ? 'creator' : 'field agent'} account needs to be active to cash out. Your earnings and history stay here.`}
          />
        ) : null}

        {/* Available balance */}
        <Card variant="lg" style={styles.hero}>
          <View style={styles.balanceHeading}>
            <Text variant="label" tone="muted" accessibilityRole="header">Available to cash out</Text>
            <Pressable onPress={() => openHistory('all')} disabled={!creator} hitSlop={8} cssInterop={false}
              accessibilityRole="button" accessibilityLabel="View all earnings and payouts" accessibilityState={{ disabled: !creator }}
              style={styles.historyButton}>
              <Ionicons name="time-outline" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <View testID="wallet-balance-width" onLayout={event => {
            const measured = event.nativeEvent.layout.width;
            if (Number.isFinite(measured) && measured > 0) setBalanceWidth(measured);
          }}>
            <Text testID="wallet-balance-value" variant="number" tabular numberOfLines={1}
              accessibilityLabel={`Available to cash out, ${balanceText}`}
              style={{ fontSize: balanceFontSize, lineHeight: Math.ceil(balanceFontSize * 1.12), letterSpacing: -1 }}>
              {balanceText}
            </Text>
          </View>
          {balance === null ? <Text variant="label" tone="ink2">Reconnect to load your account balance.</Text> : null}
        </Card>

        <View testID="wallet-stats-row" style={[styles.statRow, stackStats && styles.statColumn]} onLayout={event => {
          const measured = event.nativeEvent.layout.width;
          if (Number.isFinite(measured) && measured > 0) setStatsWidth(measured);
        }}>
          <Stat label="Total earned" value={earnedText} fontSize={statFontSize} fontScale={fontScale} stacked={stackStats} testID="wallet-earned-total" />
          <Stat label="Withdrawn" value={withdrawnText} fontSize={statFontSize} fontScale={fontScale} stacked={stackStats} testID="wallet-withdrawn-total" />
        </View>

        {earnings === undefined ? <Card><Text tone="muted">{isOffline ? 'Reconnect to load your earnings.' : 'Loading earnings…'}</Text></Card>
          : <EarningsTrend earnings={earnings} />}

        {/* Recent earnings */}
        <View style={styles.section}>
          <View style={styles.sectionHead}><SectionLabel style={styles.sectionTitle}>Recent earnings</SectionLabel>
            <Pressable accessibilityRole="link" accessibilityLabel="All earnings" disabled={!creator} hitSlop={10}
              onPress={() => openHistory('earned')} style={styles.historyLink}><Text variant="label" style={styles.linkText}>See all</Text></Pressable></View>
          {earnings === undefined ? <Text tone="muted">{isOffline ? 'Earnings unavailable offline.' : 'Loading recent earnings…'}</Text>
            : recentEarnings.length === 0 ? (
            <EmptyRow
              title="No earnings yet"
              body={isAffiliate ? 'Your first sale shows up here.' : 'Your first paid site shows up here.'}
            />
          ) : (
            <Card style={styles.listCard}>
              {recentEarnings.map((earning, idx) => {
                const details = earning.submissionId ? submissionDetails.bySubmission.get(earning.submissionId) : undefined;
                return <EarningRow key={earning._id} earning={earning} compact divider={idx < recentEarnings.length - 1}
                  thumbnailUrl={details?.thumbnailUrl} submissionPrice={details?.submissionPrice} paid={details?.paid} />;
              })}
            </Card>
          )}
        </View>

        {/* Withdrawal history */}
        <View style={styles.section}>
          <View style={styles.sectionHead}><SectionLabel style={styles.sectionTitle}>Cash outs</SectionLabel>
            <Pressable accessibilityRole="link" accessibilityLabel="All cash-outs" disabled={!creator} hitSlop={10}
              onPress={() => openHistory('cashed-out')} style={styles.historyLink}><Text variant="label" style={styles.linkText}>See all</Text></Pressable></View>
          {withdrawals === undefined ? <Text tone="muted">{isOffline ? 'Payout history unavailable offline.' : 'Loading payouts…'}</Text>
            : recentWithdrawals.length === 0 ? (
            <EmptyRow title="Nothing here yet" body="Your withdrawal history will show up here once you cash out." />
          ) : (
            <Card style={styles.listCard}>
              {recentWithdrawals.map((withdrawal, idx) => <PayoutRow key={withdrawal._id} withdrawal={withdrawal} compact divider={idx < recentWithdrawals.length - 1} />)}
            </Card>
          )}
        </View>
        <Card style={styles.linkCard}>
          <ListRow icon="people-outline" title="Invite field agents"
            subtitle={isAffiliate ? 'See your team commissions' : 'Bring a friend to Tendso'}
            onPress={() => router.push('/(app)/referrals' as any)} accessibilityLabel="View your referrals" />
        </Card>
      </View>

      {/* Wise account setup sheet */}
      <SwipeSheet testID="wise-setup-modal" visible={showWiseSetup} onClose={closeWiseSetup} dismissable={!savingEmail}>
        <ScrollView testID="wallet-wise-setup-scroll" style={[styles.sheetScroll, { maxHeight: sheetMaxHeight }]} contentContainerStyle={styles.sheetStack}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.sheetHead}>
            <Text variant="title" accessibilityRole="header">
              Set up Wise
            </Text>
            <Text variant="body" tone="ink2">
              To withdraw earnings you need a free Wise account. We send your payouts there, then you can move funds to your local bank.
            </Text>
          </View>

          {/* Deliberately the SYSTEM browser, not the in-app one: this is an
              account-creation flow, so we want iOS universal-link handoff (opens
              the Wise app when installed) and the user's existing Wise session —
              SFSafariViewController is cookie isolated and would force them to
              log in again. */}
          <Card style={styles.linkCard}>
            <ListRow
              icon="open-outline"
              title="Create a free Wise account"
              subtitle="Opens Wise"
              onPress={() => Linking.openURL(WISE_REFERRAL_LINK)}
              accessibilityLabel="Create Wise account"
            />
          </Card>

          <Field
            testID="wise-setup-email-input"
            label="Your Wise email"
            icon="mail-outline"
            placeholder="email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={wiseSetupEmail}
            onChangeText={setWiseSetupEmail}
            editable={!savingEmail}
            accessibilityLabel="Wise email address"
          />

          {setupError !== '' ? <Banner tone="danger" body={setupError} /> : null}
          {!canWrite ? <Banner tone="warn" body="Reconnect with an active account to save your payout details." /> : null}

          <Button
            title="Save and continue"
            loading={savingEmail}
            disabled={!canWrite}
            onPress={handleSaveWiseEmail}
            accessibilityLabel="Continue to withdrawal"
          />
        </ScrollView>
      </SwipeSheet>

      {/* Cash out to Wise sheet */}
      <SwipeSheet testID="withdrawal-modal" visible={showModal} onClose={closeModal} dismissable={!submitting}>
        <ScrollView testID="wallet-withdraw-scroll" style={[styles.sheetScroll, { maxHeight: sheetMaxHeight }]} contentContainerStyle={styles.sheetStack}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.sheetHead}>
            <Text variant="title" accessibilityRole="header">
              Cash out to Wise
            </Text>
            <Text variant="label" weight="medium" tone="muted">
              {balance === null ? 'Balance unavailable' : `${peso(balance)} ready to cash out`}
            </Text>
          </View>

          {/* Amount card with quick picks */}
          <View style={[styles.amountCard, shadow.soft]}>
            <Text variant="label" tone="muted">
              Amount
            </Text>
            <View style={styles.amountRow}>
              <Text style={styles.amountPrefix}>₱</Text>
              <TextInput
                testID="amount-input"
                style={[styles.amountInput, { width: Math.min(Math.max(80, moneyTextUnits(form.amount || '0') * 40 * Math.max(1, fontScale) + 10), Math.max(80, width - 140)) }]}
                placeholder="0"
                placeholderTextColor={colors.ink3}
                selectionColor={colors.ink}
                keyboardType="numeric"
                value={form.amount}
                onChangeText={(v) => {
                  if (submitBusy.current) return;
                  setForm((f) => ({ ...f, amount: v }));
                  setFormError('');
                }}
                editable={!submitting}
                accessibilityLabel="Withdrawal amount"
              />
            </View>
            <View style={styles.picks}>
              {QUICK_PICKS.filter((p) => balance !== null && p < balance).map((p) => (
                <Pill
                  key={p}
                  style={styles.quickPick}
                  label={formatPeso(p)}
                  selected={form.amount === String(p)}
                  onPress={() => { if (!submitBusy.current) setForm((f) => ({ ...f, amount: String(p) })); }}
                  accessibilityLabel={`Cash out ${formatPeso(p)}`}
                />
              ))}
              <Pill
                style={styles.quickPick}
                label={`All · ${balance === null ? '—' : peso(balance)}`}
                selected={form.amount === String(balance)}
                onPress={() => { if (!submitBusy.current && balance !== null) setForm((f) => ({ ...f, amount: String(balance) })); }}
                accessibilityLabel={`Cash out all, ${balance === null ? 'unavailable' : peso(balance)}`}
              />
            </View>
          </View>

          <View style={styles.wiseField}>
            <View style={styles.emailHeading}>
              <Text variant="label" tone="muted">Your Wise email</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Change Wise email" disabled={submitting}
                onPress={() => wiseEmailInput.current?.focus()} hitSlop={10}>
                <Text variant="label" style={styles.linkText}>Change</Text>
              </Pressable>
            </View>
            <Field ref={wiseEmailInput} testID="wise-email-input" label="Your Wise email" hideLabel variant="outlined"
              icon="mail-outline" placeholder="email@example.com" keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false} value={form.wiseEmail}
              onChangeText={value => { if (!submitBusy.current) setForm(previous => ({ ...previous, wiseEmail: value })); }}
              editable={!submitting} accessibilityLabel="Wise email address"
              right={isValidEmail(form.wiseEmail.trim()) ? <Ionicons name="checkmark-circle-outline" size={20} color={colors.ink3} /> : undefined} />
          </View>

          <View style={styles.noteRow}>
            <Ionicons name="notifications-outline" size={22} color={colors.ink3} />
            <Text variant="label" weight="medium" tone="muted" style={styles.flex}>
              We send it to your Wise account and tell you when Wise completes it.
            </Text>
          </View>

          {formError !== '' ? <Banner tone="danger" body={formError} /> : null}
          {!canWrite ? <Banner tone="warn" body="Reconnect with an active account to cash out." /> : null}

          <View style={styles.sheetButtons}>
            <Button title={sendLabel} loading={submitting} disabled={!canWrite} onPress={handleSubmit} accessibilityLabel="Confirm withdrawal" />
            <Button title="Not now" variant="ghost" onPress={closeModal} disabled={submitting} />
          </View>
        </ScrollView>
      </SwipeSheet>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 14 },
  footer: { paddingHorizontal: 20, paddingTop: space.sm, paddingBottom: 14 },
  stack: { gap: space.sm },
  hero: { borderRadius: radius.card, padding: 14, gap: space.xs },
  balanceHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  historyButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm },
  statColumn: { flexDirection: 'column' },
  // Longhands let stacked cards return to content sizing in native Yoga.
  stat: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, borderRadius: radius.field, gap: space.xs, padding: space.md },
  statStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  linkCard: { paddingVertical: space.xs, paddingHorizontal: space.md },
  section: { gap: space.sm, marginTop: space.xs },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: space.md },
  sectionTitle: { color: colors.ink },
  historyLink: { minHeight: 28, justifyContent: 'center', paddingHorizontal: space.xs },
  linkText: { textDecorationLine: 'underline' },
  listCard: { paddingVertical: space.xs, paddingHorizontal: 10 },
  empty: { gap: space.xs },
  // Sheets
  sheetScroll: { flexShrink: 1 },
  sheetStack: { gap: space.md, paddingBottom: space.sm },
  sheetHead: { gap: space.xs },
  sheetButtons: { gap: space.md },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.xs },
  amountCard: {
    backgroundColor: colors.card,
    borderRadius: radius.cardLg,
    padding: space.md,
    gap: space.md,
    alignItems: 'center',
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  amountPrefix: { fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 48, color: colors.ink },
  amountInput: {
    flexShrink: 1,
    minWidth: 80,
    padding: 0,
    minHeight: 56,
    fontFamily: fonts.extrabold,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -1.2,
    color: colors.ink,
  },
  picks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  quickPick: { paddingHorizontal: 10 },
  wiseField: { gap: space.sm },
  emailHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
});
