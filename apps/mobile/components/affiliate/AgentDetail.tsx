import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { formatPHP } from '../../../../packages/shared/pricing';
import { Avatar, Card, EmptyState, Text } from '../v2';
import { colors } from '../../theme/v2';
import { AffiliateAccess, AffiliateLoading, type AffiliateAccessProps } from './Screen';
import { AffiliateToolFrame } from './AffiliateToolFrame';
import { AgentProgressTrack, agentProgress } from './Agents';
import { RECRUIT_SHARE_PERCENT, type AffiliatePortal, samplePortal } from './model';

export function AffiliateAgentDetailScreen({ agentId, month }: { agentId: string; month?: string }) {
  return <AffiliateAccess>{props => props.isPreview
    ? <AgentDetailContent {...props} portal={samplePortal} agentId={agentId} />
    : <LiveAgentDetail {...props} agentId={agentId} month={month} />}</AffiliateAccess>;
}

function LiveAgentDetail({ agentId, month, ...props }: AffiliateAccessProps & { agentId: string; month?: string }) {
  const portal = useQuery(api.affiliates.portal, props.isAuthenticated ? month ? { month } : {} : 'skip');
  return <AgentDetailContent {...props} portal={portal} agentId={agentId} />;
}

function dateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Manila' });
}

/** Look up only the signed-in creator's portal recruits; a route id cannot expose another creator's agent. */
export function AgentDetailContent({ account, isPreview, isOffline, portal, agentId }: AffiliateAccessProps & {
  portal: AffiliatePortal | undefined; agentId: string;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stack = width < 360 || fontScale > 1.2;
  const recruit = portal?.recruits.find(row => row._id === agentId);
  const progress = recruit ? agentProgress(recruit) : null;
  const creditedTotal = recruit?.creditedTotalEarned ?? (recruit?.totalEarned === 0 ? 0 : undefined);
  const amountUnits = [...(recruit?.monthEarned === undefined ? '—' : formatPHP(recruit.monthEarned))].reduce((sum, character) => sum + (/[.,]/.test(character) ? 0.34 : 0.7), 0);
  const amountSize = Math.max(16, Math.min(44, Math.floor((width - 88) / (amountUnits * Math.max(1, fontScale)))));
  return <AffiliateToolFrame title="Agent details" preview={isPreview} suspended={account.status !== 'active'} offline={isOffline}>
    {portal === undefined ? <AffiliateLoading inline label="Loading agent details" /> : !recruit || !progress
      ? <EmptyState icon="person-outline" title="Agent not found" body="This agent is not in your team." />
      : <>
        <View style={styles.profile}>
          <Avatar name={recruit.referredName} uri={recruit.photo ?? undefined} size={84} />
          <Text variant="display" align="center" accessibilityRole="header" style={styles.name}>{recruit.referredName}</Text>
          <Text variant="label" tone="muted" align="center">Recruited {dateLabel(recruit.createdAt)}</Text>
        </View>
        <Card style={styles.amountCard} testID="affiliate-agent-monthly-share">
          <Text variant="label" tone="muted" align="center">Your share · {portal.month ? new Date(portal.month.start).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' }) : 'This month'}</Text>
          <Text variant="hero" tabular align="center" style={[styles.amount, { fontSize: amountSize, lineHeight: Math.ceil(amountSize * 1.22) }]}
            accessibilityLabel={recruit.monthEarned === undefined ? 'Your monthly share, unavailable' : `Your monthly share, ${formatPHP(recruit.monthEarned)}`}>
            {recruit.monthEarned === undefined ? '—' : formatPHP(recruit.monthEarned)}
          </Text>
        </Card>
        <Card style={styles.details}>
          <View style={[styles.dataRow, stack && styles.stacked]}><Text variant="label" tone="muted" style={styles.label}>Your commission rate</Text><Text variant="label" weight="semibold" style={[styles.value, stack && styles.stackedValue]}>{RECRUIT_SHARE_PERCENT}%</Text></View>
          <View style={[styles.dataRow, stack && styles.stacked]}><Text variant="label" tone="muted" style={styles.label}>Earned through this agent</Text><Text variant="label" weight="semibold" tabular style={[styles.value, stack && styles.stackedValue]}>{creditedTotal === undefined ? 'Unavailable' : formatPHP(creditedTotal)}</Text></View>
          <View style={[styles.dataRow, stack && styles.stacked]}><Text variant="label" tone="muted" style={styles.label}>Commission {recruit.earning ? 'ends' : 'ended'}</Text><Text variant="label" weight="semibold" style={[styles.value, stack && styles.stackedValue]}>{dateLabel(recruit.endsAt)}</Text></View>
          <View style={styles.time}>
            <View style={[styles.timeLabels, stack && styles.stacked]}><Text variant="label" weight="semibold">{progress.months ? `${progress.months} ${progress.months === 1 ? 'month' : 'months'} left` : 'Period ended'}</Text><Text variant="label" tone="muted">of 12 months</Text></View>
            <AgentProgressTrack recruit={recruit} large />
          </View>
        </Card>
        <View style={styles.help}><Ionicons name="information-circle-outline" size={20} color={colors.ink3Text} /><Text variant="label" tone="muted" style={styles.helpText}>Commission is credited after the shop pays in full.</Text></View>
      </>}
  </AffiliateToolFrame>;
}

const styles = StyleSheet.create({
  profile: { alignItems: 'center', gap: 8, paddingTop: 5, paddingBottom: 8 },
  name: { fontSize: 28, lineHeight: 36, marginTop: 7 },
  amountCard: { borderRadius: 24, paddingVertical: 22, paddingHorizontal: 20 },
  amount: { fontSize: 44, lineHeight: 54, letterSpacing: -1.3, marginTop: 8 },
  details: { gap: 16, borderRadius: 24, padding: 20 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 15 },
  label: { flex: 1, minWidth: 0 },
  value: { maxWidth: '58%', textAlign: 'right' },
  stacked: { flexDirection: 'column', gap: 6 },
  stackedValue: { maxWidth: '100%', textAlign: 'left' },
  time: { gap: 9, marginTop: 4 },
  timeLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  help: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  helpText: { flex: 1, minWidth: 0 },
});
