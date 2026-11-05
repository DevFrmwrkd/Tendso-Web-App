import React from 'react';
import { StyleSheet, View } from 'react-native';
import { formatPHP } from '../../../../packages/shared/pricing';
import { Avatar, Card, Chip, ListRow, SectionLabel, Text } from '../v2';
import { space } from '../../theme/v2';
import type { AffiliatePortal } from './model';

/** New team commissions stay separate from earlier one-time referral bonuses. */
export function AffiliateRecruits({ portal }: { portal: Pick<AffiliatePortal, 'recruits' | 'recruitStats'> }) {
  // Older backends and cached portal responses do not have the additive fields yet.
  const recruits = portal.recruits ?? [];
  const stats = portal.recruitStats;
  return <View style={styles.section}>
    <SectionLabel>{`5% team commissions · ${stats?.total ?? recruits.length}`}</SectionLabel>
    <Text variant="body" tone="ink2">Earn 5% of each invited field agent’s sales for 12 months, paid when the shop has paid in full.</Text>
    {recruits.length === 0
      ? <Text variant="body" tone="muted">New field agents appear here after they sign up with your code.</Text>
      : <>
        <Text variant="body" tone="ink2">{`${stats?.earning ?? recruits.filter((row) => row.earning).length} within their 12-month window · ${formatPHP(stats?.totalEarned ?? 0)} team commission earned`}</Text>
        <Card style={styles.rows}>{recruits.map((row, index) => <ListRow
          key={row._id}
          leading={<Avatar name={row.referredName} size={48} />}
          title={row.referredName}
          subtitle={`${formatPHP(row.totalEarned)} earned · ${row.earning ? 'Until' : 'Ended'} ${new Date(row.endsAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`}
          trailing={<Chip label={row.earning ? '5% active' : 'Ended'} tone={row.earning ? 'ok' : 'muted'} />}
          divider={index < recruits.length - 1}
        />)}</Card>
      </>}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  rows: { paddingVertical: space.xs, paddingHorizontal: space.md },
});
