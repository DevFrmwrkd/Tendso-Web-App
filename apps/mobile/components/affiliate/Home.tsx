import React, { useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { formatPHP } from '../../../../packages/shared/pricing';
import { Avatar, Button, Card, Text, TextLink } from '../v2';
import { colors, radius } from '../../theme/v2';
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
      <Ionicons name={team ? 'calendar-outline' : 'storefront-outline'} size={22} color={team ? colors.onDark : colors.ink} />
    </View>
    <Text variant="label" tone="ink2" style={styles.incomeLabel}>{label}</Text>
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
  const month = portal?.month ? new Date(portal.month.start).toLocaleDateString('en-PH', { month: 'long', timeZone: 'Asia/Manila' }) : 'This month';
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
      <Button title="Share my link" onPress={share} disabled={!url || isPreview || suspended} style={{ minHeight: 58 }} />
    </>}>
    <View style={styles.greeting}>
      <Pressable onPress={() => router.push('/(app)/(affiliate-tabs)/profile')} accessibilityRole="button" accessibilityLabel="Open my profile">
        <Avatar uri={account.affiliatePhoto || undefined} name={affiliateName(account)} size={52} />
      </Pressable>
      <Text variant="title" accessibilityRole="header" style={[styles.flex, styles.greetingText]}>Hi, {account.firstName || 'creator'}</Text>
    </View>
    <View style={styles.overview}>
      <Text variant="bodyLg" tone="muted">{month}</Text>
      <View style={[styles.incomes, stackIncome && styles.stackedIncomes]}>
        <Income label="From your link" amount={portal?.income?.directThisMonth} />
        <Income label="From your agents" amount={portal?.income?.teamThisMonth} team />
      </View>
      <Card style={styles.link} onPress={() => router.push('/(app)/(affiliate-tabs)/page')}
        accessibilityLabel="Edit my creator page">
        <Ionicons name="link-outline" size={20} color={colors.ink3} />
        <Text variant="bodyLg" weight="bold" style={[styles.flex, styles.linkText]}>{url?.replace(/^https?:\/\//, '') ?? 'Your page link is not available yet.'}</Text>
      </Card>
    </View>
    {isPreview ? <TextLink label="Preview sales" onPress={() => router.push('/(app)/(affiliate-tabs)/sales')} /> : null}
  </AffiliateFrame>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  greetingText: { fontSize: 26, lineHeight: 32 },
  overview: { gap: 12, marginTop: 6 },
  incomes: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  stackedIncomes: { flexDirection: 'column' },
  income: { flex: 1, minWidth: 0, gap: 6, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 20, borderRadius: radius.cardLg },
  incomeLabel: { marginTop: 12 },
  amount: { fontSize: 29, lineHeight: 34, letterSpacing: -1, marginTop: 'auto' },
  icon: { width: 46, height: 46, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  teamIcon: { backgroundColor: colors.ink },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 20, paddingVertical: 16, borderRadius: 22 },
  linkText: { fontSize: 19, lineHeight: 24 },
});
