import React, { useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
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
  const [page, setPage] = useState(0);
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
  return <AffiliateFrame title="My agents" sub={portal?.month?.label ?? 'This month'} preview={isPreview}
    suspended={account.status !== 'active'} offline={isOffline}>
    {portal === undefined ? <AffiliateLoading inline label="Loading your agents" /> : recruits.length ? <>
      <View style={styles.list}>
        {recruits.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(recruit => {
          const months = Math.max(0, Math.min(12, recruit.monthsLeft ?? 0));
          const amount = recruit.monthEarned;
          return <Card key={recruit._id} style={styles.agent}>
            <Avatar name={recruit.referredName} uri={recruit.photo ?? undefined} size={52} />
            <View style={styles.meta}>
              <Text variant="bodyLg" weight="bold">{recruit.referredName}</Text>
              <View style={styles.months} accessibilityRole="progressbar"
                accessibilityLabel={`${recruit.referredName}, ${months} of 12 months remaining`}
                accessibilityValue={{ min: 0, max: 12, now: months }}>
                {Array.from({ length: 12 }, (_, i) => <View key={i} style={[styles.month, i < months && styles.monthOn]} />)}
              </View>
              <Text variant="label" tone="muted">{recruit.earning ? `Until ${new Date(recruit.endsAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Commission period ended'}</Text>
            </View>
            <Text variant="bodyLg" weight="bold" tabular style={styles.amount}>{amount === undefined ? '—' : formatPHP(amount)}</Text>
          </Card>;
        })}
      </View>
      {pages > 1 ? <View style={styles.pagination}>
        <Button title="Previous agents" variant="ghost" size="md" fullWidth={false} disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)} />
        <Text variant="label" tone="muted">{currentPage + 1} / {pages}</Text>
        <Button title="Next agents" variant="ghost" size="md" fullWidth={false} disabled={currentPage === pages - 1} onPress={() => setPage(currentPage + 1)} />
      </View> : null}
      <Text variant="label" tone="muted">Your credited 5% share this month. The bar shows the time left in each agent’s 12-month period.</Text>
    </> : <EmptyState icon="people-outline" title="Your team starts here"
      body="Field agents appear here after joining with your link or code." />}

    <Card variant="tint" style={styles.invite}>
      <SectionLabel>Invite field agents</SectionLabel>
      <Text tone="ink2">Earn 5% of their sales for 12 months, after each shop has paid in full.</Text>
      {account.referralCode ? <>
        <Text variant="title" selectable align="center">{account.referralCode}</Text>
        <CopyButton value={account.referralCode} label="Copy invitation code" disabled={disabled} />
      </> : <Text tone="muted">Your invitation code is not available yet.</Text>}
      <Button title="Share agent invite" variant="dark" icon="share-outline" onPress={invite} disabled={disabled || !account.affiliateHandle} />
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
    </Card>

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
  agent: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  meta: { flex: 1, minWidth: 0, gap: space.sm },
  amount: { flexShrink: 1, maxWidth: '32%' },
  months: { flexDirection: 'row', gap: 3, height: 5, maxWidth: 190 },
  month: { flex: 1, borderRadius: radius.pill, backgroundColor: colors.bg2 },
  monthOn: { backgroundColor: colors.accent },
  pagination: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  invite: { gap: space.md },
});
