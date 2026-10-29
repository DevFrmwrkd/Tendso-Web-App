import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { usePaginatedQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { formatPHP } from '../../../../packages/shared/pricing';
import { Button, Card, Chip, EmptyState, Text } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { AffiliateAccess, AffiliateLoading, type AffiliateAccessProps } from './Screen';
import { AffiliateToolFrame } from './AffiliateToolFrame';
import { type AffiliateSale, saleStatus, saleTone, sampleSales } from './model';

const PAGE_SIZE = 10;
type SalesFilter = 'all' | 'paid';

function selectedMonth(value: string | string[] | undefined) {
  const month = Array.isArray(value) ? value[0] : value;
  return month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined;
}

const monthLabel = (month?: string) => month
  ? new Date(`${month}-15T00:00:00+08:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', timeZone: 'Asia/Manila' })
  : 'All time';

const paidSale = (sale: AffiliateSale) => sale.status === 'paid' || sale.status === 'completed';

export function AffiliateSalesScreen() {
  const params = useLocalSearchParams?.<{ month?: string }>();
  const month = selectedMonth(params?.month);
  const [filter, setFilter] = useState<SalesFilter>('all');
  return <AffiliateAccess>{(props) => props.isPreview ? <SalesContent {...props} sales={sampleSales.filter(sale => !month || new Date(sale.createdAt).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Manila' }) === month)} month={month} filter={filter} onFilterChange={setFilter} /> : <LiveSales {...props} month={month} filter={filter} onFilterChange={setFilter} />}</AffiliateAccess>;
}

function LiveSales(props: AffiliateAccessProps & { month?: string; filter: SalesFilter; onFilterChange: (filter: SalesFilter) => void }) {
  // Filter before pagination so paid orders are never hidden behind an unpaid first page.
  const args = { ...(props.month ? { month: props.month } : {}), ...(props.filter === 'paid' ? { status: 'paid' as const } : {}) };
  const { results, status, loadMore } = usePaginatedQuery(api.affiliates.sales, props.isAuthenticated ? args : 'skip', { initialNumItems: PAGE_SIZE });
  return <SalesContent {...props} sales={results} loading={status === 'LoadingFirstPage'} more={status === 'CanLoadMore'} loadingMore={status === 'LoadingMore'} onMore={() => loadMore(PAGE_SIZE)} />;
}

const saleDate = (time: number) => new Date(time).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

export function SalesContent({ account, isPreview, isOffline, sales, month, filter: controlledFilter, onFilterChange, loading = false, more = false, loadingMore = false, onMore }: AffiliateAccessProps & { sales: AffiliateSale[]; month?: string; filter?: SalesFilter; onFilterChange?: (filter: SalesFilter) => void; loading?: boolean; more?: boolean; loadingMore?: boolean; onMore?: () => void }) {
  const [localFilter, setLocalFilter] = useState<SalesFilter>('all');
  const filter = controlledFilter ?? localFilter;
  const visible = filter === 'paid' ? sales.filter(paidSale) : sales;
  const changeFilter = (next: SalesFilter) => onFilterChange ? onFilterChange(next) : setLocalFilter(next);
  return <AffiliateToolFrame title="Your sales" preview={isPreview} suspended={account.status !== 'active'} offline={isOffline}>
    <View style={styles.heading}><Text variant="title" accessibilityRole="header">From your link</Text><Text variant="label" tone="muted">{monthLabel(month)}</Text></View>
    <View style={styles.filters}>
      {(['all', 'paid'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={value === 'all' ? 'All' : 'Paid'} accessibilityState={{ selected: filter === value }} onPress={() => changeFilter(value)} style={[styles.filter, filter === value && styles.activeFilter]}><Text variant="label" tone={filter === value ? 'onDark' : 'ink'}>{value === 'all' ? 'All' : 'Paid'}</Text></Pressable>)}
    </View>
    {loading ? <AffiliateLoading inline label="Loading your sales" /> : visible.length === 0
      ? <EmptyState icon="receipt-outline" title={filter === 'paid' ? 'No paid sales yet' : 'No sales yet'} body={month ? 'Orders from your page in this month show up here.' : 'Orders from your page show up here.'} />
      : visible.map((sale) => <Card key={sale._id} variant="lg" style={styles.card}>
        <View style={styles.top}>
          <View style={styles.shopIcon}><Ionicons name="storefront-outline" size={24} color={colors.ink} /></View>
          <View style={styles.name}>
            <Text variant="bodyLg" weight="bold">{sale.businessName}</Text>
            <Text variant="label" tone="muted">{saleDate(sale.createdAt)}</Text>
          </View>
        </View>
        <Chip label={saleStatus(sale.status)} tone={saleTone(sale.status)} />
        <View style={styles.money}>
          <View style={styles.moneyColumn}><Text variant="label" tone="muted">Website price</Text><Text variant="heading" tabular>{formatPHP(sale.price)}</Text></View>
          <View style={[styles.moneyColumn, styles.commission]}><Text variant="label" tone="muted" align="right">Your commission</Text><Text variant="heading" tabular>{formatPHP(sale.commission)}</Text>{!paidSale(sale) ? <Text variant="label" tone="muted" align="right">Not credited yet</Text> : null}</View>
        </View>
      </Card>)}
    {more || loadingMore ? <Button title="Show more sales" variant="ghost" size="md" loading={loadingMore} disabled={loadingMore || isOffline} onPress={onMore} /> : null}
  </AffiliateToolFrame>;
}

const styles = StyleSheet.create({
  heading: { gap: space.sm },
  filters: { flexDirection: 'row', gap: space.sm },
  filter: { minHeight: 48, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.bg2, justifyContent: 'center' },
  activeFilter: { backgroundColor: colors.ink },
  card: { gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  shopIcon: { width: 48, height: 48, backgroundColor: colors.bg2, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, gap: 2 },
  money: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule, paddingTop: space.lg },
  moneyColumn: { flex: 1, minWidth: 0, gap: space.xs },
  commission: { alignItems: 'flex-end' },
});
