import React, { useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { formatPHP } from '../../../../packages/shared/pricing';
import { Avatar, Button, Card, Chip, EmptyState, ListRow, SectionLabel, Text } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { AffiliateAccess, AffiliateFrame, AffiliateLoading, type AffiliateAccessProps } from './Screen';
import { affiliateUrl, type AffiliatePortal, samplePortal } from './model';
import { CopyButton } from './ShareTools';

const PAGE_SIZE = 4;

export function AffiliateAgentsScreen() {
  return <AffiliateAccess>{props => props.isPreview ? <AgentsContent {...props} portal={samplePortal} /> : <LiveAgents {...props} />}</AffiliateAccess>;
}

function LiveAgents(props: AffiliateAccessProps) {
  const portal = useQuery(api.affiliates.portal, props.isAuthenticated ? {} : 'skip');
  return <AgentsContent {...props} portal={portal} />;
}

export function AgentsContent({ account, isPreview, isOffline, portal }: AffiliateAccessProps & { portal: AffiliatePortal | undefined }) {
  const { width, fontScale } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const sharing = useRef(false);
  const recruits = portal?.recruits ?? [];
  const pages = Math.max(1, Math.ceil(recruits.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const disabled = isPreview || account.status !== 'active';
  const invite = async () => {
    if (disabled || !account.affiliateHandle || sharing.current) return;
    sharing.current = true;
    setError('');
    try { await Share.share({ message: `Join me on Tendso as a field agent: ${affiliateUrl(account.affiliateHandle)}/earn` }); }
    catch { setError('Could not share your invite. Please try again.'); }
    finally { sharing.current = false; }
  };
  return <AffiliateFrame preview={isPreview}
    suspended={account.status !== 'active'} offline={isOffline}>
    <View style={styles.header}>
      <Text variant="display" accessibilityRole="header" style={styles.title}>My agents</Text>
      <Text tone="muted" style={styles.subtitle}>This month</Text>
    </View>
    {portal === undefined ? <AffiliateLoading inline label="Loading your agents" /> : recruits.length ? <>
      <Card style={styles.agentList} testID="affiliate-agent-list">
        {recruits.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((recruit, index) => {
          const months = Math.max(0, Math.min(12, recruit.monthsLeft ?? 0));
          const amount = recruit.monthEarned;
          const formatted = amount === undefined ? '—' : formatPHP(amount);
          const until = recruit.earning ? `Until ${new Date(recruit.endsAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Commission period ended';
          const stack = width < 360 || fontScale > 1.2 || formatted.length > 8;
          return <View key={recruit._id} testID={`affiliate-agent-row-${recruit._id}`} style={[styles.agent, index > 0 && styles.divider, stack && styles.stackedAgent]}>
            <View style={[styles.identity, stack && styles.stackedIdentity]}>
              <Avatar name={recruit.referredName} uri={recruit.photo ?? undefined} size={52} />
              <View style={styles.meta}>
                <Text variant="bodyLg" weight="bold" style={styles.name}>{recruit.referredName}</Text>
                <View style={styles.months} accessibilityRole="progressbar"
                  accessibilityLabel={`${recruit.referredName}, ${months} of 12 months remaining`}
                  accessibilityHint={until}
                  accessibilityValue={{ min: 0, max: 12, now: months }}>
                  {Array.from({ length: 12 }, (_, i) => <View key={i} testID={`affiliate-agent-month-${recruit._id}-${i}`} style={[styles.month, i < months && styles.monthOn]} />)}
                </View>
              </View>
            </View>
            <Text variant="bodyLg" weight="extrabold" tabular testID={`affiliate-agent-amount-${recruit._id}`}
              style={[styles.amount, stack && styles.stackedAmount]}>{formatted}</Text>
          </View>;
        })}
      </Card>
      {pages > 1 ? <View style={styles.pagination}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous agents" accessibilityState={{ disabled: currentPage === 0 }}
          disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)} style={[styles.pageButton, currentPage === 0 && styles.disabled]}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} /></Pressable>
        <Text variant="label" tone="muted" accessibilityLabel={`Page ${currentPage + 1} of ${pages}`}>{currentPage + 1} / {pages}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next agents" accessibilityState={{ disabled: currentPage === pages - 1 }}
          disabled={currentPage === pages - 1} onPress={() => setPage(currentPage + 1)} style={[styles.pageButton, currentPage === pages - 1 && styles.disabled]}>
          <Ionicons name="chevron-forward" size={24} color={colors.ink} /></Pressable>
      </View> : null}
      <Text variant="label" tone="muted">Your 5% share this month. Bars show time left out of 12 months.</Text>
    </> : <EmptyState icon="people-outline" title="Your team starts here"
      body="Field agents appear here after joining with your link or code." />}

    <Pressable accessibilityRole="button" accessibilityLabel="Invite field agents" accessibilityState={{ expanded: inviting }}
      accessibilityHint={inviting ? 'Hide your invitation tools' : 'Show your invitation code and share tools'}
      onPress={() => setInviting(value => !value)} style={styles.inviteToggle}>
      <Ionicons name="person-add-outline" size={24} color={colors.ink} />
      <Text weight="bold" style={styles.flex}>Invite field agents</Text>
      <Ionicons name={inviting ? 'chevron-up' : 'chevron-down'} size={22} color={colors.ink} />
    </Pressable>
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
  header: { gap: 4, marginBottom: 4 },
  title: { fontSize: 30, lineHeight: 36 },
  subtitle: { fontSize: 18, lineHeight: 26 },
  flex: { flex: 1, minWidth: 0 },
  agentList: { borderRadius: 24, paddingHorizontal: 18, paddingVertical: 4 },
  agent: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  identity: { flexGrow: 1, flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14 },
  meta: { flex: 1, minWidth: 0, gap: 9 },
  name: { fontSize: 18, lineHeight: 22 },
  amount: { flexShrink: 0, fontSize: 19, lineHeight: 24, textAlign: 'right' },
  stackedAgent: { flexDirection: 'column', alignItems: 'stretch', gap: space.sm },
  stackedIdentity: { flexGrow: 0, flexShrink: 0, width: '100%' },
  stackedAmount: { alignSelf: 'flex-end', maxWidth: '100%' },
  months: { flexDirection: 'row', gap: 3, height: 6, maxWidth: 150 },
  month: { flex: 1, borderRadius: radius.pill, backgroundColor: colors.bg2 },
  monthOn: { backgroundColor: colors.ink },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg },
  pageButton: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  inviteToggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.md, backgroundColor: colors.card, borderRadius: radius.card },
  invite: { gap: space.md },
});
