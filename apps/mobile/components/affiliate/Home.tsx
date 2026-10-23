import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { BASE_PRICE, COMMISSION_RATE, REFERRAL_BONUS, formatPHP } from '../../../../packages/shared/pricing';
import { Avatar, BigNumber, Card, Chip, ListRow, SectionLabel, Text, type ChipTone } from '../v2';
import { colors, space } from '../../theme/v2';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { AffiliateAccess, AffiliateFrame, AffiliateLoading, type AffiliateAccessProps } from './Screen';
import { DEFAULT_CODE_DISCOUNT, DEFAULT_CODE_KEEP, DEFAULT_CODE_PRICE, RECRUIT_SHARE_PERCENT, type AffiliatePortal, samplePortal } from './model';
import { CopyButton } from './ShareTools';
import { AffiliateRecruits } from './Recruits';

export function AffiliateHomeScreen() {
  return <AffiliateAccess>{(props) => props.isPreview ? <HomeContent {...props} portal={samplePortal} /> : <LiveHome {...props} />}</AffiliateAccess>;
}

function LiveHome(props: AffiliateAccessProps) {
  const portal = useQuery(api.affiliates.portal, props.isAuthenticated ? {} : 'skip');
  return <HomeContent {...props} portal={portal} />;
}

/** The big figure: stays "Loading…" until the portal answers (a real zero shows ₱0). */
function Figure({ label, amount }: { label: string; amount: number | undefined }) {
  return <Card variant="lg" style={styles.figure}>
    {amount === undefined
      ? <View accessible accessibilityLabel={`${label}, loading`}><Text variant="number" tone="muted">Loading…</Text><Text variant="body" tone="muted">{label}</Text></View>
      : <BigNumber value={formatPHP(amount)} label={label} size="lg" />}
  </Card>;
}

function FigureRow({ label, amount, divider }: { label: string; amount: number | undefined; divider?: boolean }) {
  return <View accessible accessibilityLabel={amount === undefined ? `${label}, loading` : `${label}, ${formatPHP(amount)}`} style={[styles.figureRow, divider ? styles.divider : null]}>
    <Text variant="bodyLg" tone="ink2" style={styles.figureLabel}>{label}</Text>
    <Text variant="title" tabular numberOfLines={1} tone={amount === undefined ? 'muted' : 'ink'}>{amount === undefined ? 'Loading…' : formatPHP(amount)}</Text>
  </View>;
}

function referralLine(row: AffiliatePortal['referrals'][number]): { chip: string; tone: ChipTone; line: string } {
  if (row.status === 'paid') return { chip: 'Paid', tone: 'ok', line: `Bonus paid · ${formatPHP(row.bonusAmount)}` };
  if (row.status === 'qualified') return { chip: 'Qualified', tone: 'info', line: 'First paid website done' };
  return { chip: 'Joined', tone: 'muted', line: 'Waiting for their first paid website' };
}

export function HomeContent({ account, isPreview, isOffline, portal }: AffiliateAccessProps & { portal: AffiliatePortal | undefined }) {
  const router = useGuardedRouter();
  const suspended = account.status !== 'active';
  return <AffiliateFrame title={`Hi, ${account.firstName || 'creator'}`} preview={isPreview} suspended={suspended} offline={isOffline}>
    <Figure label="Available" amount={portal?.summary.balance} />
    <Card style={styles.rows}>
      <FigureRow label="Pending" amount={portal?.summary.pendingCommission} divider />
      <FigureRow label="Total earned" amount={portal?.summary.totalEarned} />
    </Card>
    <Text variant="label" tone="muted" style={styles.note}>Pending commission arrives after the shop owner pays.</Text>

    <Card style={styles.rows}>
      <ListRow icon="globe-outline" title="My page" subtitle="Your link and price" onPress={() => router.push('/(app)/(affiliate-tabs)/page')} divider />
      <ListRow icon="receipt-outline" title="Sales" subtitle="Orders from your page" onPress={() => router.push('/(app)/(affiliate-tabs)/sales')} divider />
      <ListRow icon="wallet-outline" title="Earn" subtitle="Your money and payouts" onPress={() => router.push('/(app)/(affiliate-tabs)/wallet')} />
    </Card>

    <Card variant="tint" style={styles.invite}>
      <Text variant="heading">How you earn</Text>
      <Text variant="body" tone="ink2">{`You keep ${Math.round(COMMISSION_RATE * 100)}% of each sale. At the default ${Math.round(DEFAULT_CODE_DISCOUNT * 100)}% off (${formatPHP(DEFAULT_CODE_PRICE)}) that is ${formatPHP(DEFAULT_CODE_KEEP)}. You can lower it to ${formatPHP(BASE_PRICE)}.`}</Text>
    </Card>

    <Card variant="lg" style={styles.invite}>
      <Text variant="heading">Invite field agents</Text>
      <Text variant="body" tone="ink2">{`Earn ${RECRUIT_SHARE_PERCENT}% of each sale by field agents who join with your code. For 12 months, paid when the shop has paid in full.`}</Text>
      {account.referralCode
        ? <>
          <View style={styles.code}>
            <Text variant="label" tone="muted">Your code</Text>
            <Text variant="title" style={styles.codeText} selectable>{account.referralCode}</Text>
          </View>
          <CopyButton value={account.referralCode} label="Copy code" disabled={isPreview || suspended} />
        </>
        : <Text variant="body" tone="muted">Your code is not available yet.</Text>}
      <Text variant="label" tone="muted">{`They enter it when they sign up in the app. Creators cannot be referred. Invites already pending keep the ${formatPHP(REFERRAL_BONUS)} bonus.`}</Text>
    </Card>

    {portal === undefined ? <AffiliateLoading inline label="Loading invited field agents" /> : <>
      <AffiliateRecruits portal={portal} />
      {portal.referrals.length > 0 ? <View style={styles.list}>
        <SectionLabel>{`Earlier ₱1,000 referrals · ${portal.referralStats.total}`}</SectionLabel>
        <Card style={styles.rows}>{portal.referrals.map((row, index) => {
          const info = referralLine(row);
          return <ListRow key={row._id} leading={<Avatar name={row.referredName} size={48} />} title={row.referredName} subtitle={info.line} trailing={<Chip label={info.chip} tone={info.tone} />} divider={index < portal.referrals.length - 1} />;
        })}</Card>
      </View> : null}
    </>}
  </AffiliateFrame>;
}

const styles = StyleSheet.create({
  figure: { gap: space.xs },
  figureRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingHorizontal: space.xs },
  figureLabel: { flex: 1 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  note: { paddingHorizontal: space.xs },
  rows: { paddingVertical: space.xs, paddingHorizontal: space.md },
  invite: { gap: space.md },
  code: { alignItems: 'center', gap: space.xs, paddingVertical: space.md, borderRadius: 16, backgroundColor: colors.bg },
  codeText: { letterSpacing: 2 },
  list: { gap: space.md },
});
