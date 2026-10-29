import React, { useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { formatPHP } from '../../../../packages/shared/pricing';
import { Avatar, Button, Card, Chip, EmptyState, ListRow, SectionLabel, Text } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { AffiliateAccess, AffiliateFrame, AffiliateLoading, type AffiliateAccessProps } from './Screen';
import { affiliateUrl, type AffiliatePortal, samplePortal } from './model';
import { CopyButton } from './ShareTools';

const PAGE_SIZE = 4;

type Recruit = AffiliatePortal['recruits'][number];

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

export function AgentsContent({ account, isPreview, isOffline, portal, month }: AffiliateAccessProps & { portal: AffiliatePortal | undefined; month?: string }) {
  const router = useGuardedRouter();
  const { width, fontScale } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [inviting, setInviting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'ended'>('all');
  const [error, setError] = useState('');
  const sharing = useRef(false);
  const recruits = portal?.recruits ?? [];
  const filtered = filter === 'ended' ? recruits.filter(recruit => !recruit.earning) : recruits;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const disabled = isPreview || account.status !== 'active';
  const portalMonth = portal?.month ? new Date(portal.month.start + 8 * 60 * 60 * 1000) : undefined;
  const resolvedMonth = month ?? (portalMonth ? `${portalMonth.getUTCFullYear()}-${String(portalMonth.getUTCMonth() + 1).padStart(2, '0')}` : undefined);
  const monthLabel = resolvedMonth ? new Date(`${resolvedMonth}-01T00:00:00Z`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'This month';
  const summaryUnits = [...(portal?.income?.teamThisMonth === undefined ? 'Loading…' : formatPHP(portal.income.teamThisMonth))].reduce((sum, character) => sum + (/[.,]/.test(character) ? 0.34 : 0.7), 0);
  const summarySize = Math.max(16, Math.min(38, Math.floor((width - 48) / (summaryUnits * Math.max(1, fontScale)))));
  const changeFilter = (next: 'all' | 'ended') => { setFilter(next); setPage(0); };
  const invite = async () => {
    if (disabled || !account.affiliateHandle || sharing.current) return;
    sharing.current = true;
    setError('');
    try { await Share.share({ message: `Join me on Tendso as a field agent: ${affiliateUrl(account.affiliateHandle)}/earn` }); }
    catch { setError('Could not share your invite. Please try again.'); }
    finally { sharing.current = false; }
  };
  return <AffiliateFrame preview={isPreview}
    suspended={account.status !== 'active'} offline={isOffline}
    footer={<Pressable accessibilityRole="button" accessibilityLabel="Invite field agents" accessibilityState={{ expanded: inviting }} onPress={() => setInviting(value => !value)} style={styles.inviteAction}><Ionicons name="people-outline" size={22} color={colors.ink} /><Text variant="button" style={styles.inviteActionText}>Invite a field agent</Text></Pressable>}>
    <View style={styles.header}>
      <Text variant="display" accessibilityRole="header" style={[styles.title, styles.flex]}>Your agents</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Invite an agent" accessibilityState={{ expanded: inviting }} onPress={() => setInviting(value => !value)} style={styles.round}>
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

    {inviting ? <Card variant="tint" style={styles.invite} testID="affiliate-agent-invite-tools">
      <SectionLabel>Invite field agents</SectionLabel>
      <Text tone="ink2">Earn 5% of their sales for 12 months, after each shop has paid in full.</Text>
      {account.referralCode ? <>
        <Text variant="title" selectable align="center">{account.referralCode}</Text>
        <CopyButton value={account.referralCode} label="Copy invitation code" disabled={disabled} />
      </> : <Text tone="muted">Your invitation code is not available yet.</Text>}
      <Button title="Share agent invite" variant="dark" icon="share-outline" onPress={invite} disabled={disabled || !account.affiliateHandle} />
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
    </Card> : null}

    {portal?.referrals.length ? <View style={styles.list}>
      <SectionLabel>{`Earlier ₱1,000 referrals · ${portal.referralStats.total}`}</SectionLabel>
      <Text variant="label" tone="muted">Earlier invitations keep their one-time bonus.</Text>
      <Card>{portal.referrals.map((row, i) => <ListRow key={row._id}
        leading={<Avatar name={row.referredName} size={48} />} title={row.referredName}
        subtitle={row.status === 'paid' ? `Bonus paid · ${formatPHP(row.bonusAmount)}` : row.status === 'qualified' ? 'First paid website done' : 'Waiting for their first paid website'}
        trailing={<Chip label={row.status === 'paid' ? 'Paid' : row.status === 'qualified' ? 'Qualified' : 'Joined'} tone={row.status === 'paid' ? 'ok' : 'muted'} />}
        divider={i < portal.referrals.length - 1} />)}</Card>
    </View> : null}
  </AffiliateFrame>;
}

const styles = StyleSheet.create({
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
  invite: { gap: space.md },
  inviteAction: { minHeight: 60, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  inviteActionText: { flexShrink: 1, textAlign: 'center' },
});
