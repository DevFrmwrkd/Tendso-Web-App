import React from 'react';
import { StyleSheet, View } from 'react-native';
import { usePaginatedQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { formatPHP } from '../../../../packages/shared/pricing';
import { Button, Card, Chip, EmptyState, Text } from '../v2';
import { space } from '../../theme/v2';
import { AffiliateAccess, AffiliateFrame, AffiliateLoading, type AffiliateAccessProps } from './Screen';
import { type AffiliateSale, saleStatus, saleTone, sampleSales } from './model';

const PAGE_SIZE = 10;

export function AffiliateSalesScreen() {
  return <AffiliateAccess>{(props) => props.isPreview ? <SalesContent {...props} sales={sampleSales} /> : <LiveSales {...props} />}</AffiliateAccess>;
}

function LiveSales(props: AffiliateAccessProps) {
  const { results, status, loadMore } = usePaginatedQuery(api.affiliates.sales, props.isAuthenticated ? {} : 'skip', { initialNumItems: PAGE_SIZE });
  return <SalesContent {...props} sales={results} loading={status === 'LoadingFirstPage'} more={status === 'CanLoadMore'} loadingMore={status === 'LoadingMore'} onMore={() => loadMore(PAGE_SIZE)} />;
}

const saleDate = (time: number) => new Date(time).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

export function SalesContent({ account, isPreview, isOffline, sales, loading = false, more = false, loadingMore = false, onMore }: AffiliateAccessProps & { sales: AffiliateSale[]; loading?: boolean; more?: boolean; loadingMore?: boolean; onMore?: () => void }) {
  return <AffiliateFrame title="Your sales" preview={isPreview} suspended={account.status !== 'active'} offline={isOffline}>
    {loading ? <AffiliateLoading inline label="Loading your sales" /> : sales.length === 0
      ? <EmptyState icon="receipt-outline" title="No sales yet" body="Orders from your page show up here." />
      : sales.map((sale) => <Card key={sale._id} variant="lg" style={styles.card}>
        <View style={styles.top}>
          <View style={styles.name}>
            <Text variant="bodyLg" weight="bold" numberOfLines={1}>{sale.businessName}</Text>
            <Text variant="label" tone="muted">{saleDate(sale.createdAt)}</Text>
          </View>
          <Chip label={saleStatus(sale.status)} tone={saleTone(sale.status)} />
        </View>
        <View style={styles.money}>
          <Text variant="body" tone="ink2" tabular>{formatPHP(sale.price)}</Text>
          <Text variant="heading" tabular>{`+${formatPHP(sale.commission)}`}</Text>
        </View>
      </Card>)}
    {more || loadingMore ? <Button title="Show more sales" variant="ghost" size="md" loading={loadingMore} disabled={loadingMore || isOffline} onPress={onMore} /> : null}
  </AffiliateFrame>;
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  name: { flex: 1, gap: 2 },
  money: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
});
