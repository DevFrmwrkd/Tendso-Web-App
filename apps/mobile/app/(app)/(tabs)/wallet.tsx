import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, TextInput, View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { useNetwork } from '../../../providers/NetworkProvider';
import { colors, fonts, radius, shadow, space } from '../../../theme/v2';
import {
  Banner,
  BigNumber,
  Button,
  Card,
  Chip,
  Field,
  ListRow,
  Loading,
  Pill,
  ScreenShell,
  SectionLabel,
  Text,
  formatPeso,
  type ChipTone,
} from '../../../components/v2';
import { SwipeSheet } from '../../../components/ui/SwipeSheet';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { PreviewWallet } from '../../../components/AccountPreview';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

/** "₱1,500" for whole pesos, "₱1,500.50" when there are centavos (so a balance is never rounded up). */
function peso(amount: number): string {
  if (Number.isInteger(amount)) return formatPeso(amount);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WITHDRAWAL_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  pending: { label: 'Pending', tone: 'warn' },
  processing: { label: 'Processing', tone: 'info' },
  completed: { label: 'Completed', tone: 'ok' },
  failed: { label: 'Failed', tone: 'danger' },
};

const EARNING_TITLE: Record<string, string> = {
  submission_approved: 'Site payout',
  referral_bonus: 'From your invites',
  creator_override: '5% team commission',
  lead_bonus: 'Lead bonus',
};

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="lg" style={styles.stat} accessible accessibilityLabel={`${label}, ${value}`}>
      <Text variant="title" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </Text>
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
  const { isPreview, account } = useMobileAccount();
  return isPreview ? <PreviewWallet /> : <PersonalWallet isAffiliate={account?.role === 'affiliate'} />;
}

function PersonalWallet({ isAffiliate }: { isAffiliate: boolean }) {
  const router = useGuardedRouter();
  const { user } = useUser();
  const { isConnected } = useNetwork();
  const isOffline = isConnected === false;

  const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : 'skip');
  const creatorWithdrawals = useQuery(
    api.withdrawals.getByCreator,
    creator?._id && !isAffiliate ? { creatorId: creator._id } : 'skip'
  );
  const creatorEarnings = useQuery(
    api.earnings.getByCreator,
    creator?._id && !isAffiliate ? { creatorId: creator._id } : 'skip'
  );
  const portal = useQuery(api.affiliates.portal, isAffiliate ? {} : 'skip');
  const withdrawals = isAffiliate ? portal?.withdrawals : creatorWithdrawals;
  const earnings = isAffiliate ? portal?.earnings : creatorEarnings;

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

  if (!isOffline && (creator === undefined || (isAffiliate && portal === undefined))) {
    return (
      <View testID="activity-indicator" style={styles.flex}>
        <Loading />
      </View>
    );
  }

  const balance = creator?.balance ?? 0;
  const recentWithdrawals = withdrawals?.slice(0, 5) ?? [];
  const recentEarnings = earnings?.slice(0, 5) ?? [];
  const savedWiseEmail = (creator as any)?.wiseEmail as string | undefined;
  const suspended = creator?.status === 'suspended';

  function openWithdrawFlow() {
    if (creator?.status === 'suspended') return;
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
    if (submitting) return;
    setShowModal(false);
  }

  function closeWiseSetup() {
    if (savingEmail) return;
    setShowWiseSetup(false);
  }

  function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handleSaveWiseEmail() {
    setSetupError('');
    const email = wiseSetupEmail.trim();
    if (!email) { setSetupError('Please enter your Wise email address.'); return; }
    if (!isValidEmail(email)) { setSetupError('Please enter a valid email address.'); return; }
    if (!creator?._id || creator.status === 'suspended') return;

    setSavingEmail(true);
    try {
      await updateCreator({ id: creator._id, wiseEmail: email });
      setShowWiseSetup(false);
      setForm({ amount: String(balance), wiseEmail: email });
      setFormError('');
      setShowModal(true);
    } catch (err: any) {
      setSetupError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleSubmit() {
    setFormError('');

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { setFormError('Please enter a valid amount.'); return; }
    if (amount > balance) { setFormError('Amount exceeds your available balance.'); return; }
    if (!form.wiseEmail.trim()) { setFormError('Wise email is required.'); return; }
    if (!isValidEmail(form.wiseEmail.trim())) { setFormError('Please enter a valid email address.'); return; }
    if (!creator?._id || creator.status === 'suspended') return;

    setSubmitting(true);
    try {
      await createWithdrawal({
        creatorId: creator._id,
        amount,
        wiseEmail: form.wiseEmail.trim(),
      });
      setShowModal(false);
      Alert.alert(
        'Withdrawal submitted',
        `Your withdrawal of ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} is being sent to your Wise account. You will receive a notification once completed.`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      setFormError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const totalEarnings = (creator as any)?.totalEarnings ?? 0;
  const totalWithdrawn = (creator as any)?.totalWithdrawn ?? 0;

  const typedAmount = parseFloat(form.amount);
  const amountReady = !isNaN(typedAmount) && typedAmount > 0 && typedAmount <= balance;
  const sendLabel = amountReady ? `Send ${peso(typedAmount)} to Wise` : 'Send to Wise';

  return (
    <ScreenShell
      title="Earn"
      insetBottom={false}
      footer={
        <Button
          testID="withdraw-button"
          title={balance > 0 ? `Cash out ${peso(balance)} to Wise` : 'No balance available'}
          onPress={openWithdrawFlow}
          disabled={balance <= 0 || isOffline || suspended}
        />
      }
    >
      <View style={styles.stack}>
        {isOffline ? (
          <Banner tone="warn" icon="cloud-offline-outline" body="You're offline. Reconnect to cash out." />
        ) : null}
        {suspended ? (
          <Banner
            tone="warn"
            title="Cash out is paused"
            body={`Your ${isAffiliate ? 'creator' : 'field agent'} account is suspended. Your earnings and history stay here.`}
          />
        ) : null}

        {/* Available balance */}
        <Card variant="lg" style={styles.hero}>
          <BigNumber value={peso(balance)} label="Available to cash out" />
        </Card>

        <View style={styles.statRow}>
          <Stat label="Total earned" value={peso(totalEarnings)} />
          <Stat label="Withdrawn" value={peso(totalWithdrawn)} />
        </View>

        {/* Referrals live here because their earnings pay into this same balance. */}
        <Card style={styles.linkCard}>
          <ListRow
            icon="people-outline"
            title="Invite field agents"
            subtitle={isAffiliate ? 'Earn 5% of their sales' : 'Bring a friend to Tendso'}
            onPress={() => router.push('/(app)/referrals' as any)}
            accessibilityLabel="View your referrals"
          />
        </Card>

        {/* Recent earnings */}
        <View style={styles.section}>
          <SectionLabel>Recent earnings</SectionLabel>
          {recentEarnings.length === 0 ? (
            <EmptyRow
              title="No earnings yet"
              body={isAffiliate ? 'Your first sale shows up here.' : 'Your first paid site shows up here.'}
            />
          ) : (
            <Card style={styles.listCard}>
              {recentEarnings.map((earning: any, idx: number) => (
                <ListRow
                  key={earning._id}
                  icon="trending-up-outline"
                  title={EARNING_TITLE[earning.type] ?? 'Payout'}
                  subtitle={timeAgo(earning.createdAt ?? earning._creationTime ?? 0)}
                  divider={idx < recentEarnings.length - 1}
                  trailing={
                    <Text variant="bodyLg" weight="extrabold" tabular>
                      +{peso(earning.amount ?? 0)}
                    </Text>
                  }
                />
              ))}
            </Card>
          )}
        </View>

        {/* Withdrawal history */}
        <View style={styles.section}>
          <SectionLabel>Withdrawal history</SectionLabel>
          {recentWithdrawals.length === 0 ? (
            <EmptyRow title="Nothing here yet" body="Your withdrawal history will show up here once you cash out." />
          ) : (
            <Card style={styles.listCard}>
              {recentWithdrawals.map((w: any, idx: number) => {
                const status = WITHDRAWAL_STATUS[w.status] ?? { label: String(w.status), tone: 'muted' as ChipTone };
                const displayLabel = w.wiseEmail ? `Wise · ${w.wiseEmail}` : w.bankName ?? 'Wise transfer';
                return (
                  <View key={w._id} style={[styles.payRow, idx < recentWithdrawals.length - 1 ? styles.payDivider : null]}>
                    <View style={styles.payIcon}>
                      <Ionicons name="send-outline" size={22} color={colors.ink} />
                    </View>
                    <View style={styles.payBody}>
                      <Text variant="bodyLg" weight="semibold" numberOfLines={1}>
                        {displayLabel}
                      </Text>
                      <View style={styles.payMeta}>
                        <Chip label={status.label} tone={status.tone} />
                        <Text variant="bodyLg" weight="extrabold" tone="ink2" tabular>
                          −{peso(w.amount ?? 0)}
                        </Text>
                      </View>
                      <Text variant="label" weight="medium" tone="muted">
                        {timeAgo(w.createdAt ?? w._creationTime ?? 0)}
                      </Text>
                      {w.wiseTransferId ? (
                        <Text variant="label" weight="medium" tone="muted">
                          Wise #{w.wiseTransferId}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </Card>
          )}
        </View>
      </View>

      {/* Wise account setup sheet */}
      <SwipeSheet testID="wise-setup-modal" visible={showWiseSetup} onClose={closeWiseSetup} dismissable={!savingEmail}>
        <View style={styles.sheetStack}>
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

          <Button
            title="Save and continue"
            loading={savingEmail}
            onPress={handleSaveWiseEmail}
            accessibilityLabel="Continue to withdrawal"
          />
        </View>
      </SwipeSheet>

      {/* Cash out to Wise sheet */}
      <SwipeSheet testID="withdrawal-modal" visible={showModal} onClose={closeModal} dismissable={!submitting}>
        <View style={styles.sheetStack}>
          <View style={styles.sheetHead}>
            <Text variant="title" accessibilityRole="header">
              Cash out to Wise
            </Text>
            <Text variant="bodyLg" tone="muted">
              {peso(balance)} ready to cash out
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
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={colors.ink3}
                selectionColor={colors.ink}
                keyboardType="numeric"
                value={form.amount}
                onChangeText={(v) => {
                  const num = parseFloat(v);
                  if (v === '' || isNaN(num) || num <= balance) {
                    setForm((f) => ({ ...f, amount: v }));
                  }
                }}
                editable={!submitting}
                accessibilityLabel="Withdrawal amount"
              />
            </View>
            <View style={styles.picks}>
              {QUICK_PICKS.filter((p) => p < balance).map((p) => (
                <Pill
                  key={p}
                  label={formatPeso(p)}
                  selected={form.amount === String(p)}
                  onPress={() => setForm((f) => ({ ...f, amount: String(p) }))}
                  accessibilityLabel={`Cash out ${formatPeso(p)}`}
                />
              ))}
              <Pill
                label={`All · ${peso(balance)}`}
                selected={form.amount === String(balance)}
                onPress={() => setForm((f) => ({ ...f, amount: String(balance) }))}
                accessibilityLabel={`Cash out all, ${peso(balance)}`}
              />
            </View>
          </View>

          <Field
            testID="wise-email-input"
            label="Your Wise email"
            icon="mail-outline"
            placeholder="email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={form.wiseEmail}
            onChangeText={(v) => setForm((f) => ({ ...f, wiseEmail: v }))}
            editable={!submitting}
            accessibilityLabel="Wise email address"
            right={isValidEmail(form.wiseEmail.trim()) ? <Ionicons name="checkmark-circle" size={24} color={colors.ink} /> : undefined}
          />

          <View style={styles.noteRow}>
            <Ionicons name="notifications-outline" size={22} color={colors.ink3} />
            <Text variant="label" weight="medium" tone="muted" style={styles.flex}>
              We send it to your Wise account and tell you when Wise completes it.
            </Text>
          </View>

          {formError !== '' ? <Banner tone="danger" body={formError} /> : null}

          <View style={styles.sheetButtons}>
            <Button title={sendLabel} loading={submitting} onPress={handleSubmit} accessibilityLabel="Confirm withdrawal" />
            <Button title="Not now" variant="ghost" onPress={closeModal} disabled={submitting} />
          </View>
        </View>
      </SwipeSheet>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.lg },
  hero: { paddingVertical: space.xl },
  statRow: { flexDirection: 'row', gap: space.md },
  stat: { flex: 1, gap: space.xs, paddingHorizontal: space.lg },
  linkCard: { paddingVertical: space.xs, paddingHorizontal: space.md },
  section: { gap: space.md, marginTop: space.sm },
  listCard: { paddingVertical: space.xs, paddingHorizontal: space.md },
  empty: { gap: space.xs },
  payRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg - 2, paddingVertical: space.md, paddingHorizontal: space.xs },
  payDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  payIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBody: { flex: 1, gap: space.xs, minWidth: 0 },
  payMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Sheets
  sheetStack: { gap: space.lg },
  sheetHead: { gap: space.xs },
  sheetButtons: { gap: space.md },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.xs },
  amountCard: {
    backgroundColor: colors.card,
    borderRadius: radius.cardLg,
    padding: space.lg,
    gap: space.sm,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  amountPrefix: { fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 48, color: colors.ink3 },
  amountInput: {
    flex: 1,
    padding: 0,
    minHeight: 56,
    fontFamily: fonts.extrabold,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -1.2,
    color: colors.ink,
  },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
