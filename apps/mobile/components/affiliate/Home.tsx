import React from 'react';
import { View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { COMMISSION_RATE, REFERRAL_BONUS, formatPHP } from '../../../../packages/shared/pricing';
import { Body, Card, Display, Door, Label } from '../ui/primitives';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { AffiliateAccess, AffiliateFrame, AffiliateLoading, type AffiliateAccessProps, styles } from './Screen';
import { type AffiliatePortal, samplePortal } from './model';
import { CopyButton } from './ShareTools';

export function AffiliateHomeScreen() {
  return <AffiliateAccess>{(props) => props.isPreview ? <HomeContent {...props} portal={samplePortal} /> : <LiveHome {...props} />}</AffiliateAccess>;
}

function LiveHome(props: AffiliateAccessProps) {
  const portal = useQuery(api.affiliates.portal, props.isAuthenticated ? {} : 'skip');
  return <HomeContent {...props} portal={portal} />;
}

function Figure({ label, amount, note }: { label: string; amount: number | undefined; note: string }) {
  return <Card style={{ gap: 7 }}><Label>{label}</Label>{amount === undefined ? <Body>Loading…</Body> : <Display size="sm">{formatPHP(amount)}</Display>}<Body size="sm">{note}</Body></Card>;
}

export function HomeContent({ account, isPreview, isOffline, portal }: AffiliateAccessProps & { portal: AffiliatePortal | undefined }) {
  const router = useGuardedRouter();
  const suspended = account.status !== 'active';
  return <AffiliateFrame title={`Hi, ${account.firstName || 'affiliate'}`} sub="Your affiliate business at a glance." preview={isPreview} suspended={suspended} offline={isOffline}>
    <Figure label="Available in your wallet" amount={portal?.summary.balance} note="Money earned and available for a payout." />
    <Figure label="Pending commission" amount={portal?.summary.pendingCommission} note="Arrives after the shop owner pays." />
    <Figure label="Total earned" amount={portal?.summary.totalEarned} note="Your commissions and creator referral bonuses." />
    <Card style={{ gap: 14 }}><Display size="sm">Your page does the introduction.</Display><Body>Set your price, share your link, and earn {Math.round(COMMISSION_RATE * 100)}% of each website sale. Creators take photos and interview shop owners; you share your offer.</Body>
      <Door label="My page" onPress={() => router.push('/(app)/(affiliate-tabs)/page')} /><Door label="Sales" variant="ghost" onPress={() => router.push('/(app)/(affiliate-tabs)/sales')} /><Door label="Wallet" variant="ghost" onPress={() => router.push('/(app)/(affiliate-tabs)/wallet')} />
    </Card>
    <Card style={{ gap: 14 }}><Display size="sm">Invite creators</Display><Body>Earn {formatPHP(REFERRAL_BONUS)} when a creator you refer completes their first website paid for by its owner.</Body>
      {account.referralCode ? <><Label>Your creator referral code</Label><Display size="sm">{account.referralCode}</Display><CopyButton value={account.referralCode} label="Copy creator referral code" disabled={isPreview || suspended} /></> : <Body>Your referral code is not available yet.</Body>}
      <Body size="sm">Download the Tendso app and enter this code when signing up as a creator. Affiliate accounts cannot be referred.</Body>
      {portal === undefined ? <AffiliateLoading label="Loading invited creators" /> : <>
        <View style={styles.row}><Body>Creators invited</Body><Body weight="bold">{portal.referralStats.total}</Body></View>
        {portal.referrals.length === 0 ? <Body size="sm">Your invited creators appear here after they sign up with your code.</Body> : portal.referrals.map((row) => <View key={row._id} style={{ gap: 3 }}><Body weight="medium">{row.referredName}</Body><Body size="sm">{row.status === 'paid' ? `Bonus paid · ${formatPHP(row.bonusAmount)}` : row.status === 'qualified' ? 'Qualified for bonus' : 'Waiting for their first paid website'}</Body></View>)}
      </>}
    </Card>
  </AffiliateFrame>;
}
