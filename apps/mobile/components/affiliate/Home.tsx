import React, { useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { formatPHP } from '../../../../packages/shared/pricing';
import { Avatar, Button, Card, Text, TextLink } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { AffiliateAccess, AffiliateFrame, type AffiliateAccessProps } from './Screen';
import { affiliateName, affiliateUrl, type AffiliatePortal, samplePortal } from './model';

export function AffiliateHomeScreen() {
  return <AffiliateAccess>{props => props.isPreview ? <HomeContent {...props} portal={samplePortal} /> : <LiveHome {...props} />}</AffiliateAccess>;
}

function LiveHome(props: AffiliateAccessProps) {
  const portal = useQuery(api.affiliates.portal, props.isAuthenticated ? {} : 'skip');
  return <HomeContent {...props} portal={portal} />;
}

function Income({ label, amount, team = false }: { label: string; amount: number | undefined; team?: boolean }) {
  return <Card style={styles.income}>
    <View style={[styles.icon, team && styles.teamIcon]}>
      <Ionicons name={team ? 'people-outline' : 'storefront-outline'} size={25} color={team ? colors.onDark : colors.ink} />
    </View>
    <Text variant="label" tone="muted">{label}</Text>
    <Text variant="number" tabular style={styles.amount}
      accessibilityLabel={amount === undefined ? `${label}, loading` : `${label}, ${formatPHP(amount)}`}>
      {amount === undefined ? 'Loading…' : formatPHP(amount)}
    </Text>
  </Card>;
}

/** Link sales and team commission are credited income for the same calendar month. */
export function HomeContent({ account, isPreview, isOffline, portal }: AffiliateAccessProps & { portal: AffiliatePortal | undefined }) {
  const router = useGuardedRouter();
  const { width, fontScale } = useWindowDimensions();
  const stackIncome = width < 360 || fontScale > 1.2 ||
    [portal?.income?.directThisMonth, portal?.income?.teamThisMonth].some(amount => amount !== undefined && formatPHP(amount).length > 7);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const suspended = account.status !== 'active';
  const url = account.affiliateHandle ? affiliateUrl(account.affiliateHandle) : null;
  const share = async () => {
    if (!url || isPreview || suspended || busy.current) return;
    busy.current = true; setError('');
    try { await Share.share({ message: `${affiliateName(account)} · Get a website for your shop: ${url}`, url }); }
    catch { setError('Could not share your link. Please try again.'); }
    finally { busy.current = false; }
  };
  return <AffiliateFrame preview={isPreview} suspended={suspended} offline={isOffline}
    footer={<>
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
      <Button title="Share my link" icon="share-outline" onPress={share} disabled={!url || isPreview || suspended} />
    </>}>
    <View style={styles.greeting}>
      <Pressable onPress={() => router.push('/(app)/(affiliate-tabs)/profile')} accessibilityRole="button" accessibilityLabel="Open my profile">
        <Avatar uri={account.affiliatePhoto || undefined} name={affiliateName(account)} size={56} />
      </Pressable>
      <Text variant="display" accessibilityRole="header" style={styles.flex}>Hi, {account.firstName || 'creator'}</Text>
    </View>
    <Text variant="label" tone="muted">{portal?.month?.label ?? 'This month'}</Text>
    <View style={[styles.incomes, stackIncome && styles.stackedIncomes]}>
      <Income label="From your link" amount={portal?.income?.directThisMonth} />
      <Income label="From your agents" amount={portal?.income?.teamThisMonth} team />
    </View>
    <Text variant="label" tone="muted">Credited earnings this month. Your available balance is in Money.</Text>
    <Pressable style={styles.link} onPress={() => router.push('/(app)/(affiliate-tabs)/page')}
      accessibilityRole="button" accessibilityLabel="Edit my creator page">
      <Ionicons name="link-outline" size={24} color={colors.ink} />
      <Text variant="bodyLg" weight="bold" selectable style={styles.flex}>{url?.replace(/^https?:\/\//, '') ?? 'Your page link is not available yet.'}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.ink3} />
    </Pressable>
    <View style={styles.shortcuts}>
      <TextLink label="My page" onPress={() => router.push('/(app)/(affiliate-tabs)/page')} />
      <TextLink label="Sales" onPress={() => router.push('/(app)/(affiliate-tabs)/sales')} />
      <TextLink label="Me" onPress={() => router.push('/(app)/(affiliate-tabs)/profile')} />
    </View>
  </AffiliateFrame>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  incomes: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm },
  stackedIncomes: { flexDirection: 'column' },
  income: { flex: 1, minWidth: 0, gap: space.sm, padding: space.md },
  amount: { fontSize: 28, lineHeight: 36 },
  icon: { width: 48, height: 48, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  teamIcon: { backgroundColor: colors.ink },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 64, paddingVertical: space.lg },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
});
