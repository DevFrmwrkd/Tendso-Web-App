import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../../../providers/NetworkProvider';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { colors, fonts, radius, space } from '../../../theme/tokens';
import { Display, Body, Label, Door, Card, Rule } from '../../../components/ui/primitives';
import { SwipeSheet } from '../../../components/ui/SwipeSheet';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { PreviewWallet } from '../../../components/AccountPreview';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  === 1) return 'Yesterday';
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WITHDRAWAL_STATUS: Record<string, { label: string; ink: string; bg: string }> = {
  pending:    { label: 'Pending',    ink: colors.warn,       bg: colors.warnBg },
  processing: { label: 'Processing', ink: colors.business,   bg: colors.businessBg },
  completed:  { label: 'Completed',  ink: colors.accentInk,  bg: colors.accentBg },
  failed:     { label: 'Failed',     ink: colors.danger,     bg: colors.dangerBg },
};

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
// Screen
// ---------------------------------------------------------------------------

export default function WalletScreen() {
  const { isPreview, account } = useMobileAccount();
  return isPreview ? <PreviewWallet /> : <PersonalWallet isAffiliate={account?.role === 'affiliate'} />;
}

function PersonalWallet({ isAffiliate }: { isAffiliate: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useGuardedRouter();
  const { user } = useUser();
  const { isConnected } = useNetwork();
  const isOffline = isConnected === false;

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );
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

  const [showModal, setShowModal]             = useState(false);
  const [showWiseSetup, setShowWiseSetup]     = useState(false);
  const [wiseSetupEmail, setWiseSetupEmail]   = useState('');
  const [form, setForm]                       = useState<WithdrawalForm>(EMPTY_FORM);
  const [submitting, setSubmitting]           = useState(false);
  const [formError, setFormError]             = useState('');
  const [savingEmail, setSavingEmail]         = useState(false);
  const [setupError, setSetupError]           = useState('');

  if (!isOffline && (creator === undefined || (isAffiliate && portal === undefined))) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator testID="activity-indicator" size="large" color={colors.accent} />
      </View>
    );
  }

  const balance = creator?.balance ?? 0;
  const recentWithdrawals = withdrawals?.slice(0, 5) ?? [];
  const recentEarnings    = earnings?.slice(0, 5) ?? [];
  const savedWiseEmail = (creator as any)?.wiseEmail as string | undefined;

  function openWithdrawFlow() {
    if (creator?.status === 'suspended') return;
    if (savedWiseEmail) {
      setForm({ amount: '', wiseEmail: savedWiseEmail });
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
      setForm({ amount: '', wiseEmail: email });
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <OfflineBanner />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Editorial header */}
        <View style={{
          paddingTop: insets.top + 20,
          paddingBottom: 20,
          paddingHorizontal: 24,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Label tracking={1.8}>WALLET</Label>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <Display size="md">Your </Display>
            <Display size="md" italic color={colors.accent}>payouts.</Display>
          </View>
          <Body size="md" color={colors.ink2} style={{ marginTop: 10, maxWidth: 320 }}>
            Manage your earnings and withdrawals.
          </Body>
        </View>

        <Rule strong />

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 20 }}>
          {/* Balance — ink dark editorial block */}
          <View style={{
            backgroundColor: colors.ink,
            borderRadius: radius.lg,
            padding: 22,
            gap: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18,
            shadowRadius: 18,
            elevation: 6,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontFamily: fonts.monoMed,
                  fontSize: 11,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.55)',
                }}>
                  Available balance
                </Text>
                <Text style={{
                  fontFamily: fonts.serif,
                  fontSize: 44,
                  lineHeight: 48,
                  color: colors.paper3,
                  marginTop: 6,
                  letterSpacing: -0.6,
                }}>
                  ₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{
                width: 42, height: 42, borderRadius: 21,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                backgroundColor: 'rgba(255,255,255,0.04)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="wallet" size={20} color={colors.accentSolid} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: radius.sm,
                padding: 12,
              }}>
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 9, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                  Total earned
                </Text>
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.paper3, marginTop: 4 }}>
                  ₱{totalEarnings.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: radius.sm,
                padding: 12,
              }}>
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 9, letterSpacing: 1.4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                  Withdrawn
                </Text>
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.paper3, marginTop: 4 }}>
                  ₱{totalWithdrawn.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* Withdraw Door */}
            <Door
              testID="withdraw-button"
              caption="CASH OUT"
              label={balance > 0 ? 'Request withdrawal' : 'No balance available'}
              variant="accent"
              onPress={openWithdrawFlow}
              disabled={balance <= 0 || isOffline || creator?.status === 'suspended'}
              accessibilityLabel="Withdraw funds"
              containerStyle={{ marginTop: 4 }}
            />

            {isOffline && balance > 0 && (
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.warn, textAlign: 'center', letterSpacing: 1.0 }}>
                Offline — reconnect to withdraw
              </Text>
            )}
            {creator?.status === 'suspended' && <Body size="sm" color={colors.ink2}>Your affiliate account is suspended. Earned amounts and payout history remain visible; withdrawals are paused.</Body>}
          </View>

          {/* Referrals — lives in Wallet because referral bonuses pay into this
              same balance. (Moved out of the Profile menu; this is the only
              route to the Referrals screen.) */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(app)/referrals' as any)}
            accessibilityLabel="View your referrals"
            accessibilityRole="button"
          >
            <Card large style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.sm,
                    backgroundColor: colors.accentBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="people-outline" size={20} color={colors.accentInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <Body size="sm" weight="bold" color={colors.ink}>
                    Referrals
                  </Body>
                  <Body size="xs" color={colors.ink3} style={{ marginTop: 2 }}>
                    Earn a bonus for every creator you bring in
                  </Body>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.ink3} />
              </View>
            </Card>
          </TouchableOpacity>

          {/* Recent Earnings */}
          <View>
            <View style={{ marginBottom: 12 }}>
              <Display size="sm">Recent earnings</Display>
            </View>

            {recentEarnings.length === 0 ? (
              <Card large style={{ padding: 24, alignItems: 'center' }}>
                <View style={{
                  width: 50, height: 50, borderRadius: 25,
                  backgroundColor: colors.paper2,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="cash-outline" size={22} color={colors.ink3} />
                </View>
                <View style={{ marginTop: 10, alignItems: 'center' }}>
                  <Display size="sm">No earnings</Display>
                  <Display size="sm" italic color={colors.accent}>yet.</Display>
                </View>
                <Body size="sm" color={colors.ink3} style={{ textAlign: 'center', marginTop: 6 }}>
                  Complete your first submission to start earning.
                </Body>
              </Card>
            ) : (
              <Card padded={false} large style={{ overflow: 'hidden' }}>
                {recentEarnings.map((earning: any, idx: number) => (
                  <View key={earning._id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                      <View style={{
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: colors.accentBg,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name="trending-up-outline" size={18} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Body size="sm" weight="bold" color={colors.ink}>Submission payout</Body>
                        <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink3, letterSpacing: 1.0, marginTop: 2, textTransform: 'uppercase' }}>
                          {timeAgo(earning.createdAt ?? earning._creationTime ?? 0)}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: fonts.serif, fontSize: 17, color: colors.accent, letterSpacing: -0.2 }}>
                        +₱{(earning.amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                    {idx < recentEarnings.length - 1 && <Rule style={{ marginHorizontal: 14 }} />}
                  </View>
                ))}
              </Card>
            )}
          </View>

          {/* Withdrawal History */}
          <View>
            <View style={{ marginBottom: 12 }}>
              <Display size="sm">Withdrawal history</Display>
            </View>

            {recentWithdrawals.length === 0 ? (
              <Card large style={{ padding: 24, alignItems: 'center' }}>
                <View style={{
                  width: 50, height: 50, borderRadius: 25,
                  backgroundColor: colors.paper2,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="swap-vertical-outline" size={22} color={colors.ink3} />
                </View>
                <View style={{ marginTop: 10, alignItems: 'center' }}>
                  <Display size="sm">Nothing to</Display>
                  <Display size="sm" italic color={colors.accent}>show yet.</Display>
                </View>
                <Body size="sm" color={colors.ink3} style={{ textAlign: 'center', marginTop: 6 }}>
                  Your withdrawal history will show up here once you cash out.
                </Body>
              </Card>
            ) : (
              <Card padded={false} large style={{ overflow: 'hidden' }}>
                {recentWithdrawals.map((w: any, idx: number) => {
                  const status = WITHDRAWAL_STATUS[w.status] ?? { label: w.status, ink: colors.ink3, bg: colors.paper2 };
                  const displayLabel = w.wiseEmail ? `Wise · ${w.wiseEmail}` : w.bankName ?? 'Wise transfer';
                  return (
                    <View key={w._id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                        <View style={{
                          width: 40, height: 40, borderRadius: 20,
                          backgroundColor: colors.paper2,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Ionicons name="send-outline" size={17} color={colors.ink2} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Body size="sm" weight="bold" color={colors.ink} numberOfLines={1}>{displayLabel}</Body>
                          <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink3, letterSpacing: 1.0, marginTop: 2, textTransform: 'uppercase' }}>
                            {timeAgo(w.createdAt ?? w._creationTime ?? 0)}
                          </Text>
                          {w.wiseTransferId && (
                            <Text style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.ink3, marginTop: 1 }}>
                              Wise #{w.wiseTransferId}
                            </Text>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={{ fontFamily: fonts.serif, fontSize: 17, color: colors.danger, letterSpacing: -0.2 }}>
                            -₱{(w.amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </Text>
                          <View style={{
                            paddingHorizontal: 8, paddingVertical: 3,
                            borderRadius: radius.pill,
                            backgroundColor: status.bg,
                          }}>
                            <Text style={{
                              fontFamily: fonts.monoMed,
                              fontSize: 9,
                              letterSpacing: 1.0,
                              textTransform: 'uppercase',
                              color: status.ink,
                            }}>
                              {status.label}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {idx < recentWithdrawals.length - 1 && <Rule style={{ marginHorizontal: 14 }} />}
                    </View>
                  );
                })}
              </Card>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Wise Setup Modal */}
      <Modal
        testID="wise-setup-modal"
        visible={showWiseSetup}
        animationType="slide"
        transparent
        onRequestClose={() => !savingEmail && setShowWiseSetup(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={() => !savingEmail && setShowWiseSetup(false)}
            accessibilityLabel="Close Wise setup"
            accessibilityRole="button"
          />
          <View style={{
            backgroundColor: colors.paper,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: 24,
            paddingBottom: insets.bottom + 24,
          }}>
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: colors.rule, alignSelf: 'center', marginBottom: 20,
            }} />

            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: colors.accentBg,
                alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              }}>
                <Ionicons name="wallet-outline" size={26} color={colors.accent} />
              </View>
              <Display size="sm" style={{ textAlign: 'center' }}>Set up Wise</Display>
              <Body size="sm" color={colors.ink2} style={{ textAlign: 'center', marginTop: 8, maxWidth: 300 }}>
                To withdraw earnings you need a free Wise account. We send your payouts there, then you can move funds to your local bank.
              </Body>
            </View>

            <Card style={{ marginBottom: 14, padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ink,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontFamily: fonts.sansBold, color: colors.paper3, fontSize: 11 }}>1</Text>
                </View>
                <Body size="sm" weight="bold" color={colors.ink}>Create a free Wise account</Body>
              </View>
              <Door
                caption="OPEN"
                label="Set up Wise"
                variant="ghost"
                // Deliberately the SYSTEM browser, not the in-app one: this is
                // an account-creation flow, so we want iOS universal-link
                // handoff (opens the Wise app when installed) and the user's
                // existing Wise session — SFSafariViewController is cookie
                // isolated and would force them to log in again.
                onPress={() => Linking.openURL(WISE_REFERRAL_LINK)}
                accessibilityLabel="Create Wise account"
                rightIcon={<Ionicons name="open-outline" size={18} color={colors.ink} style={{ marginLeft: 12 }} />}
              />
            </Card>

            <Card style={{ marginBottom: 14, padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 24, height: 24, borderRadius: 12, backgroundColor: colors.business,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontFamily: fonts.sansBold, color: '#fff', fontSize: 11 }}>2</Text>
                </View>
                <Body size="sm" weight="bold" color={colors.ink}>Enter your Wise email</Body>
              </View>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: colors.paper3,
                borderColor: colors.rule, borderWidth: 1,
                borderRadius: radius.sm,
                paddingHorizontal: 14, height: 52,
              }}>
                <Ionicons name="mail-outline" size={18} color={colors.ink3} />
                <TextInput
                  testID="wise-setup-email-input"
                  style={{ flex: 1, marginLeft: 10, fontFamily: fonts.sans, fontSize: 15, color: colors.ink }}
                  placeholder="email@example.com"
                  placeholderTextColor={colors.ink3}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={wiseSetupEmail}
                  onChangeText={setWiseSetupEmail}
                  editable={!savingEmail}
                  accessibilityLabel="Wise email address"
                />
              </View>
            </Card>

            {setupError !== '' && (
              <View style={{
                backgroundColor: colors.dangerBg,
                borderColor: colors.danger, borderWidth: 1,
                borderRadius: radius.sm,
                padding: 12, marginBottom: 14,
              }}>
                <Body size="sm" weight="medium" color={colors.danger}>{setupError}</Body>
              </View>
            )}

            <Door
              testID={undefined as any}
              caption="CONTINUE"
              label={savingEmail ? 'Saving…' : 'Save and continue'}
              variant="solid"
              loading={savingEmail}
              disabled={savingEmail}
              onPress={handleSaveWiseEmail}
              accessibilityLabel="Continue to withdrawal"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Withdrawal Modal */}
      <SwipeSheet
        testID="withdrawal-modal"
        visible={showModal}
        onClose={closeModal}
        dismissable={!submitting}
      >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Label tracking={1.8}>WITHDRAW</Label>
                <Display size="sm" style={{ marginTop: 2 }}>Request a payout</Display>
                <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.ink3, marginTop: 4, letterSpacing: 0.4 }}>
                  Available: ₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: colors.paper2,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="send-outline" size={17} color={colors.ink2} />
              </View>
            </View>

            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: colors.accentBg,
              borderRadius: radius.sm,
              padding: 10, marginBottom: 18,
            }}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
              <Body size="sm" weight="medium" color={colors.accentInk}>
                Sent securely to your Wise account
              </Body>
            </View>

            {/* Amount */}
            <View style={{ marginBottom: 16 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: colors.paper3,
                borderColor: colors.rule, borderWidth: 1,
                borderRadius: radius.sm,
                paddingHorizontal: 14, height: 54,
              }}>
                <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.ink3, marginRight: 6 }}>₱</Text>
                <TextInput
                  testID="amount-input"
                  style={{ flex: 1, fontFamily: fonts.sans, fontSize: 16, color: colors.ink }}
                  placeholder="e.g. 1000"
                  placeholderTextColor={colors.ink3}
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
              <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
                <Label>AMOUNT</Label>
              </View>
            </View>

            {/* Wise email */}
            <View style={{ marginBottom: 16 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: colors.paper3,
                borderColor: colors.rule, borderWidth: 1,
                borderRadius: radius.sm,
                paddingHorizontal: 14, height: 54,
              }}>
                <Ionicons name="mail-outline" size={18} color={colors.ink3} />
                <TextInput
                  testID="wise-email-input"
                  style={{ flex: 1, marginLeft: 10, fontFamily: fonts.sans, fontSize: 15, color: colors.ink }}
                  placeholder="email@example.com"
                  placeholderTextColor={colors.ink3}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={form.wiseEmail}
                  onChangeText={(v) => setForm((f) => ({ ...f, wiseEmail: v }))}
                  editable={!submitting}
                  accessibilityLabel="Wise email address"
                />
              </View>
              <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
                <Label>WISE EMAIL</Label>
              </View>
            </View>

            {formError !== '' && (
              <View style={{
                backgroundColor: colors.dangerBg,
                borderColor: colors.danger, borderWidth: 1,
                borderRadius: radius.sm,
                padding: 12, marginBottom: 14,
              }}>
                <Body size="sm" weight="medium" color={colors.danger}>{formError}</Body>
              </View>
            )}

            <Door
              testID={undefined as any}
              caption="CONFIRM"
              label={submitting ? 'Submitting…' : 'Send withdrawal request'}
              variant="solid"
              loading={submitting}
              disabled={submitting}
              onPress={handleSubmit}
              accessibilityLabel="Confirm withdrawal"
            />
      </SwipeSheet>
    </View>
  );
}
