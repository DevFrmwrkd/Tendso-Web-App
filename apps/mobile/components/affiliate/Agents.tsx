import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { formatPHP } from '../../../../packages/shared/pricing';
import { Avatar, Card, Chip, EmptyState, ListRow, SectionLabel, Text } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { AffiliateAccess, AffiliateFrame, AffiliateLoading, type AffiliateAccessProps } from './Screen';
import { affiliateUrl, type AffiliatePortal, samplePortal } from './model';

const PAGE_SIZE = 4;

type Recruit = AffiliatePortal['recruits'][number];

/** Invite labels wrap with system text size instead of truncating inside a fixed-height button. */
function InviteAction({ title, icon, disabled, busy = false, onPress, primary = false }: {
  title: string; icon: React.ComponentProps<typeof Ionicons>['name']; disabled: boolean; busy?: boolean; onPress: () => void; primary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || busy, busy }}
    disabled={disabled || busy} onPress={onPress} style={[styles.dialogAction, primary && styles.dialogPrimary, (disabled || busy) && styles.disabled]}>
    <Ionicons name={icon} size={22} color={primary ? colors.onAccent : colors.ink} />
    <Text variant="button" tone={primary ? 'onAccent' : 'ink'} style={styles.dialogActionText}>{busy ? 'Opening share options…' : title}</Text>
  </Pressable>;
}

function InviteCopyAction({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} hitSlop={2} style={[styles.dialogCopy, disabled && styles.disabled]}>
    <Ionicons name="copy-outline" size={21} color={colors.ink} />
  </Pressable>;
}

/** Demo metadata changes the illustrated track only, never the actual period or eligibility. */
export function agentProgress(recruit: Recruit) {
  const demo = recruit.demoMonthsLeft;
  const simulated = typeof demo === 'number' && Number.isFinite(demo) && Number.isInteger(demo) && demo >= 0 && demo <= 12;
  const months = simulated ? demo : Math.max(0, Math.min(12, recruit.monthsLeft ?? 0));
  return { months, simulated };
}

export function AgentProgressTrack({ recruit, large = false }: { recruit: Recruit; large?: boolean }) {
  const { months, simulated } = agentProgress(recruit);
  const until = recruit.earning ? `Until ${new Date(recruit.endsAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}` : 'Commission period ended';
  return <View style={[styles.track, large && styles.largeTrack]} testID={`affiliate-agent-track-${recruit._id}`} accessibilityRole="progressbar"
    accessibilityLabel={simulated
      ? `${recruit.referredName}, simulated progress, ${months} of 12 months remaining in this example`
      : `${recruit.referredName}, ${months} of 12 months remaining`}
    accessibilityHint={simulated ? 'Example progress only. The actual commission period and expiry date are unchanged.' : until}
    accessibilityValue={{ min: 0, max: 12, now: months }}>
    <View testID={`affiliate-agent-progress-${recruit._id}`} style={[styles.trackFill, { width: `${months / 12 * 100}%` }]} />
  </View>;
}

export function AffiliateAgentsScreen({ month }: { month?: string } = {}) {
  return <AffiliateAccess>{props => props.isPreview ? <AgentsContent {...props} portal={samplePortal} /> : <LiveAgents {...props} month={month} />}</AffiliateAccess>;
}

function LiveAgents({ month, ...props }: AffiliateAccessProps & { month?: string }) {
  const portal = useQuery(api.affiliates.portal, props.isAuthenticated ? month ? { month } : {} : 'skip');
  return <AgentsContent {...props} portal={portal} month={month} />;
}

export function AgentsContent({ account, isPreview, isOffline, isAuthenticated, portal, month }: AffiliateAccessProps & { portal: AffiliatePortal | undefined; month?: string }) {
  const router = useGuardedRouter();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const [inviteActor, setInviteActor] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'ended'>('all');
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [sharing, setSharing] = useState(false);
  const actor = `${account._id}:${account.clerkId}:${account.role}:${account.status}:${!!account.isDeleted}:${isPreview}:${isAuthenticated}:${account.affiliateHandle ?? ''}:${account.referralCode ?? ''}`;
  const latestActor = useRef(actor);
  latestActor.current = actor;
  const mounted = useRef(false);
  const openActor = useRef<string | null>(null);
  const generation = useRef(0);
  const shareAttempt = useRef<object | null>(null);
  const copyAttempt = useRef(0);
  const inviting = inviteActor === actor;
  const disabled = isPreview || account.status !== 'active' || account.role !== 'affiliate' || !!account.isDeleted || (!isAuthenticated && !isOffline);
  const inviteLink = account.affiliateHandle ? `${affiliateUrl(account.affiliateHandle)}/earn` : null;
  const modalPaddingTop = Math.max(insets.top, space.lg);
  const modalPaddingBottom = Math.max(insets.bottom, space.lg);
  const modalMaxHeight = Math.max(1, height - modalPaddingTop - modalPaddingBottom - space.lg * 2);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; openActor.current = null; generation.current += 1; };
  }, []);
  useEffect(() => {
    openActor.current = null; generation.current += 1; shareAttempt.current = null;
    setInviteActor(null); setError(''); setCopyStatus(''); setSharing(false);
  }, [actor]);
  function currentDialog(owner: string, version: number) {
    return mounted.current && latestActor.current === owner && openActor.current === owner && generation.current === version;
  }
  function openInvite() {
    generation.current += 1; openActor.current = actor; shareAttempt.current = null;
    setError(''); setCopyStatus(''); setSharing(false); setInviteActor(actor);
  }
  function closeInvite() {
    generation.current += 1; openActor.current = null; shareAttempt.current = null;
    setInviteActor(null); setError(''); setCopyStatus(''); setSharing(false);
  }
  async function copyInvite(value: string | undefined | null, kind: 'code' | 'link') {
    if (disabled || !value || !currentDialog(actor, generation.current)) return;
    const version = generation.current;
    const attempt = ++copyAttempt.current;
    setError(''); setCopyStatus('');
    try {
      await Clipboard.setStringAsync(value);
      if (currentDialog(actor, version) && copyAttempt.current === attempt) setCopyStatus(kind === 'code' ? 'Invitation code copied.' : 'Invite link copied.');
    } catch {
      if (currentDialog(actor, version) && copyAttempt.current === attempt) setError('Could not copy your invite. Please try again.');
    }
  }
  const recruits = portal?.recruits ?? [];
  const filtered = filter === 'ended' ? recruits.filter(recruit => !recruit.earning) : recruits;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const portalMonth = portal?.month ? new Date(portal.month.start + 8 * 60 * 60 * 1000) : undefined;
  const resolvedMonth = month ?? (portalMonth ? `${portalMonth.getUTCFullYear()}-${String(portalMonth.getUTCMonth() + 1).padStart(2, '0')}` : undefined);
  const monthLabel = resolvedMonth ? new Date(`${resolvedMonth}-01T00:00:00Z`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'This month';
  const summaryUnits = [...(portal?.income?.teamThisMonth === undefined ? 'Loading…' : formatPHP(portal.income.teamThisMonth))].reduce((sum, character) => sum + (/[.,]/.test(character) ? 0.34 : 0.7), 0);
  const summarySize = Math.max(16, Math.min(38, Math.floor((width - 48) / (summaryUnits * Math.max(1, fontScale)))));
  const changeFilter = (next: 'all' | 'ended') => { setFilter(next); setPage(0); };
  const invite = async () => {
    if (disabled || !inviteLink || shareAttempt.current || !currentDialog(actor, generation.current)) return;
    const version = generation.current;
    const attempt = {};
    shareAttempt.current = attempt; setSharing(true); setError(''); setCopyStatus('');
    try { await Share.share({ message: `Join me on Tendso as a field agent: ${inviteLink}` }); }
    catch { if (currentDialog(actor, version)) setError('Could not share your invite. Please try again.'); }
    finally {
      if (shareAttempt.current === attempt) {
        shareAttempt.current = null;
        if (currentDialog(actor, version)) setSharing(false);
      }
    }
  };
  return <><View style={styles.screen} accessibilityElementsHidden={inviting} importantForAccessibility={inviting ? 'no-hide-descendants' : 'auto'}><AffiliateFrame preview={isPreview}
    suspended={account.status !== 'active'} offline={isOffline}
    footer={<Pressable accessibilityRole="button" accessibilityLabel="Invite field agents" accessibilityState={{ expanded: inviting }} onPress={openInvite} style={styles.inviteAction}><Ionicons name="people-outline" size={22} color={colors.ink} /><Text variant="button" style={styles.inviteActionText}>Invite a field agent</Text></Pressable>}>
    <View style={styles.header}>
      <Text variant="display" accessibilityRole="header" style={[styles.title, styles.flex]}>Your agents</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Invite an agent" accessibilityState={{ expanded: inviting }} onPress={openInvite} style={styles.round}>
        <Ionicons name="add" size={25} color={colors.ink} />
      </Pressable>
    </View>
    <View style={[styles.summary, fontScale > 1.2 && styles.stackedAgent]}>
      <View style={styles.flex}><Text variant="label" tone="muted">Your 5% share · {monthLabel}</Text><Text variant="hero" tabular style={[styles.summaryAmount, { fontSize: summarySize, lineHeight: Math.ceil(summarySize * 1.22) }]} accessibilityLabel={portal?.income?.teamThisMonth === undefined ? 'Your monthly team share, loading' : `Your monthly team share, ${formatPHP(portal.income.teamThisMonth)}`}>{portal?.income?.teamThisMonth === undefined ? 'Loading…' : formatPHP(portal.income.teamThisMonth)}</Text></View>
      {portal ? <Text variant="label" tone="muted">{recruits.length} {recruits.length === 1 ? 'agent' : 'agents'}</Text> : null}
    </View>
    <View style={styles.filters}>
      <Pressable accessibilityRole="button" accessibilityLabel="All agents" accessibilityState={{ selected: filter === 'all' }} onPress={() => changeFilter('all')} style={[styles.filter, filter === 'all' && styles.filterOn]}><Text weight="semibold" tone={filter === 'all' ? 'onDark' : 'ink'}>All</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Agents whose period ended" accessibilityState={{ selected: filter === 'ended' }} onPress={() => changeFilter('ended')} style={[styles.filter, filter === 'ended' && styles.filterOn]}><Text weight="semibold" tone={filter === 'ended' ? 'onDark' : 'ink'}>Period ended</Text></Pressable>
    </View>
    {portal === undefined ? <AffiliateLoading inline label="Loading your agents" /> : recruits.length ? <>
      {filtered.length ? <Card style={styles.agentList} testID="affiliate-agent-list">
        {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((recruit, index) => {
          const { months, simulated } = agentProgress(recruit);
          const amount = recruit.monthEarned;
          const formatted = amount === undefined ? '—' : formatPHP(amount);
          const timeLabel = months ? `${months} ${months === 1 ? 'month' : 'months'} left` : 'Period ended';
          const stack = width < 360 || fontScale > 1.2 || formatted.length > 8;
          return <Pressable key={recruit._id} testID={`affiliate-agent-row-${recruit._id}`} accessibilityRole="button" accessibilityLabel={`View ${recruit.referredName}`}
            accessibilityHint={`${formatted} share for ${monthLabel}. ${simulated ? 'Simulated progress: ' : ''}${timeLabel}. Opens the actual commission period and earnings.`}
            onPress={() => router.push({ pathname: '/(app)/affiliate/agent/[agentId]', params: { agentId: recruit._id, ...(resolvedMonth ? { month: resolvedMonth } : {}) } })}
            style={[styles.agent, index > 0 && styles.divider]}>
            <View style={[styles.agentLine, stack && styles.stackedAgent]}>
              <View style={[styles.identity, stack && styles.stackedIdentity]}>
                <Avatar name={recruit.referredName} uri={recruit.photo ?? undefined} size={40} />
                <Text variant="bodyLg" weight="bold" style={[styles.name, styles.flex]}>{recruit.referredName}</Text>
              </View>
              <Text variant="bodyLg" weight="bold" tabular testID={`affiliate-agent-amount-${recruit._id}`}
                style={[styles.amount, stack && styles.stackedAmount]}>{formatted}</Text>
            </View>
            <View style={[styles.time, fontScale > 1.2 && styles.stackedTime]}><AgentProgressTrack recruit={recruit} large={fontScale > 1.2} /><Text variant="label" tone="muted">{timeLabel}</Text></View>
            {simulated ? <Text variant="label" tone="muted" style={styles.simulated}>Simulated progress</Text> : null}
          </Pressable>;
        })}
      </Card> : <EmptyState icon="checkmark-circle-outline" title="No ended periods" body="Your agents’ commission periods are still active." />}
      {pages > 1 ? <View style={styles.pagination}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous agents" accessibilityState={{ disabled: currentPage === 0 }}
          disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)} style={[styles.pageButton, currentPage === 0 && styles.disabled]}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} /></Pressable>
        <Text variant="label" tone="muted" accessibilityLabel={`Page ${currentPage + 1} of ${pages}`}>{currentPage + 1} / {pages}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next agents" accessibilityState={{ disabled: currentPage === pages - 1 }}
          disabled={currentPage === pages - 1} onPress={() => setPage(currentPage + 1)} style={[styles.pageButton, currentPage === pages - 1 && styles.disabled]}>
          <Ionicons name="chevron-forward" size={24} color={colors.ink} /></Pressable>
      </View> : null}
    </> : <EmptyState icon="people-outline" title="Your team starts here"
      body="Field agents appear here after joining with your link or code." />}

    {portal?.referrals.length ? <View style={styles.list}>
      <SectionLabel>{`Earlier ₱1,000 referrals · ${portal.referralStats.total}`}</SectionLabel>
      <Text variant="label" tone="muted">Earlier invitations keep their one-time bonus.</Text>
      <Card>{portal.referrals.map((row, i) => <ListRow key={row._id}
        leading={<Avatar name={row.referredName} size={48} />} title={row.referredName}
        subtitle={row.status === 'paid' ? `Bonus paid · ${formatPHP(row.bonusAmount)}` : row.status === 'qualified' ? 'First paid website done' : 'Waiting for their first paid website'}
        trailing={<Chip label={row.status === 'paid' ? 'Paid' : row.status === 'qualified' ? 'Qualified' : 'Joined'} tone={row.status === 'paid' ? 'ok' : 'muted'} />}
        divider={i < portal.referrals.length - 1} />)}</Card>
    </View> : null}
  </AffiliateFrame></View>
    <Modal testID="affiliate-agent-invite-modal" visible={inviting} transparent animationType="fade" onRequestClose={closeInvite}>
      <View testID="affiliate-agent-invite-modal-root" accessibilityViewIsModal style={[styles.modal, { paddingTop: modalPaddingTop, paddingBottom: modalPaddingBottom }]}>
        <Pressable style={styles.backdrop} accessibilityRole="button" accessibilityLabel="Dismiss agent invite" onPress={closeInvite} />
        <View testID="affiliate-agent-invite-tools" onAccessibilityEscape={closeInvite} style={[styles.dialog, { maxHeight: modalMaxHeight }]}>
          <View style={styles.dialogHeader}>
            <View style={styles.dialogPeople} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Ionicons name="people-outline" size={24} color={colors.onAccent} /></View>
            <Text variant="heading" accessibilityRole="header" style={styles.flex}>Invite a field agent</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close agent invite" onPress={closeInvite} style={styles.dialogClose}><Ionicons name="close" size={22} color={colors.ink} /></Pressable>
          </View>
          <ScrollView style={styles.dialogScroll} contentContainerStyle={styles.dialogContent} keyboardShouldPersistTaps="handled">
            <Text tone="ink2">Earn 5% of their sales for 12 months, after each shop has paid in full.</Text>
            {isPreview ? <Text variant="label" tone="muted">Preview only. Copying and sharing are disabled.</Text> : account.status !== 'active' ? <Text variant="label" tone="muted">Invitations are paused while your account is inactive.</Text> : null}
            <View style={styles.dialogDetail}>
              <View style={styles.dialogValue}>
                <Text variant="label" tone="muted">Your invite link</Text>
                <Text selectable>{inviteLink ?? 'Your invite link is not available yet.'}</Text>
              </View>
              <InviteCopyAction label="Copy invite link" disabled={disabled || !inviteLink} onPress={() => { void copyInvite(inviteLink, 'link'); }} />
            </View>
            <View style={styles.dialogCodeSection}>
              <View style={styles.dialogDetail}>
                <View style={styles.dialogValue}>
                  <Text variant="label" tone="muted">Your invitation code</Text>
                  <Text variant={account.referralCode ? 'title' : 'body'} selectable>{account.referralCode || 'Your invitation code is not available yet.'}</Text>
                </View>
                <InviteCopyAction label="Copy invitation code" disabled={disabled || !account.referralCode} onPress={() => { void copyInvite(account.referralCode, 'code'); }} />
              </View>
              <Text variant="label" tone="muted">They can enter this code when creating their account.</Text>
            </View>
            <InviteAction title="Share agent invite" icon="share-outline" primary disabled={disabled || !inviteLink} busy={sharing} onPress={invite} />
            {copyStatus ? <Text variant="label" tone="muted" accessibilityLiveRegion="polite">{copyStatus}</Text> : null}
            {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 28, lineHeight: 36 },
  round: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: -6 },
  summaryAmount: { fontSize: 38, lineHeight: 46, marginTop: 5 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filter: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.bg2, justifyContent: 'center' },
  filterOn: { backgroundColor: colors.ink },
  flex: { flex: 1, minWidth: 0 },
  agentList: { borderRadius: 24, paddingHorizontal: 17, paddingVertical: 0 },
  agent: { paddingVertical: 12 },
  agentLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stackedIdentity: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  name: { fontSize: 17, lineHeight: 23 },
  amount: { flexShrink: 0, fontSize: 20, lineHeight: 26, textAlign: 'right' },
  stackedAgent: { flexDirection: 'column', alignItems: 'stretch', gap: space.sm },
  stackedAmount: { alignSelf: 'flex-end', maxWidth: '100%' },
  time: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginLeft: 50 },
  stackedTime: { flexDirection: 'column', alignItems: 'stretch', gap: 8, marginLeft: 0 },
  track: { flex: 1, minWidth: 0, height: 5, borderRadius: radius.pill, backgroundColor: colors.ruleStrong, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.ink },
  largeTrack: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', height: 7, width: '100%' },
  simulated: { marginTop: 5, marginLeft: 50 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg },
  pageButton: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  modal: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  dialog: { width: '100%', maxWidth: 480, backgroundColor: colors.card, borderRadius: 28, overflow: 'hidden' },
  dialogScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  dialogContent: { padding: space.xl - 4, paddingTop: 0, gap: space.lg },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.xl - 4, flexShrink: 0 },
  dialogPeople: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent },
  dialogClose: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.bg2 },
  dialogDetail: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.rule, backgroundColor: colors.bg },
  dialogValue: { flex: 1, minWidth: 0, gap: space.xs },
  dialogCodeSection: { gap: space.sm },
  dialogCopy: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.card },
  dialogAction: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: colors.bg2 },
  dialogPrimary: { backgroundColor: colors.accent },
  dialogActionText: { flexShrink: 1, textAlign: 'center' },
  inviteAction: { minHeight: 60, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  inviteActionText: { flexShrink: 1, textAlign: 'center' },
});
