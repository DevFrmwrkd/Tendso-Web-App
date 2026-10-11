import React from 'react';
import { View } from 'react-native';
import { usePaginatedQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { formatPHP } from '../../../../packages/shared/pricing';
import { Body, Card, Door, Label } from '../ui/primitives';
import { AffiliateAccess, AffiliateFrame, AffiliateLoading, type AffiliateAccessProps, styles } from './Screen';
import { type AffiliateSale, saleStatus, sampleSales } from './model';

const PAGE_SIZE = 10;

export function AffiliateSalesScreen() {
  return <AffiliateAccess>{(props) => props.isPreview ? <SalesContent {...props} sales={sampleSales} /> : <LiveSales {...props} />}</AffiliateAccess>;
}

function LiveSales(props: AffiliateAccessProps) {
  const { results, status, loadMore } = usePaginatedQuery(api.affiliates.sales, props.isAuthenticated ? {} : 'skip', { initialNumItems: PAGE_SIZE });
  return <SalesContent {...props} sales={results} loading={status === 'LoadingFirstPage'} more={status === 'CanLoadMore'} loadingMore={status === 'LoadingMore'} onMore={() => loadMore(PAGE_SIZE)} />;
}

export function SalesContent({ account, isPreview, isOffline, sales, loading = false, more = false, loadingMore = false, onMore }: AffiliateAccessProps & { sales: AffiliateSale[]; loading?: boolean; more?: boolean; loadingMore?: boolean; onMore?: () => void }) {
  return <AffiliateFrame title="Your sales" sub="Each order keeps the price and commission agreed at the time of sale." preview={isPreview} suspended={account.status !== 'active'} offline={isOffline}>
    {loading ? <AffiliateLoading label="Loading your sales" /> : sales.length === 0 ? <Card><Body>No sales yet. Orders from your affiliate page will appear here.</Body></Card> : sales.map((sale) => <Card key={sale._id} style={{ gap: 12 }}>
      <Body weight="bold">{sale.businessName}</Body><Body size="sm">{new Date(sale.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}</Body>
      <Label>{saleStatus(sale.status)}</Label><View style={styles.row}><Body size="sm">Sale price</Body><Body>{formatPHP(sale.price)}</Body></View><View style={styles.row}><Body size="sm">Commission</Body><Body weight="bold">{formatPHP(sale.commission)}</Body></View>
    </Card>)}
    {more || loadingMore ? <Door label="Show more sales" variant="ghost" loading={loadingMore} disabled={loadingMore || isOffline} onPress={onMore} /> : null}
  </AffiliateFrame>;
}
