import React, { useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WEBSITE_PRICE, formatPHP } from '../../../../packages/shared/pricing';
import { affiliatePhotoError } from '../../../../lib/affiliates';
import { Avatar, Button, Card, Chip, ListRow, Text, TendsoMark } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { AffiliateAccess, Notice, type AffiliateAccessProps } from './Screen';
import { AffiliateToolFrame } from './AffiliateToolFrame';
import { affiliateDraft, affiliateName, affiliateUrl } from './model';
import { CopyButton, ShareTools } from './ShareTools';
import { AffiliateSocialButtons } from './Offer';

export function AffiliatePageScreen() {
  return <AffiliateAccess>{props => <PageOverviewContent {...props} />}</AffiliateAccess>;
}

export function AffiliateShareScreen() {
  return <AffiliateAccess>{({ account, isPreview, isOffline }) => <AffiliateToolFrame title="Share QR & poster" preview={isPreview} offline={isOffline} suspended={account.status !== 'active'}>
    {account.affiliateHandle ? <ShareTools handle={account.affiliateHandle} displayName={affiliateName(account)} price={Number(affiliateDraft(account).price)} disabled={isPreview || account.status !== 'active'} /> : <Notice tone="warn">Your page handle is unavailable. Contact Tendso support for help.</Notice>}
  </AffiliateToolFrame>}</AffiliateAccess>;
}

/** This overview reads only saved account values; draft edits stay in their own pushed tool. */
export function PageOverviewContent({ account, isPreview, isOffline }: AffiliateAccessProps) {
  const router = useGuardedRouter();
  const [error, setError] = useState('');
  const busy = useRef(false);
  const saved = affiliateDraft(account);
  const name = affiliateName(account);
  const price = Number(saved.price);
  const savings = Math.max(0, WEBSITE_PRICE - price);
  const safePhoto = saved.photo && !affiliatePhotoError(saved.photo) ? saved.photo : undefined;
  const url = account.affiliateHandle ? affiliateUrl(account.affiliateHandle) : null;
  const suspended = account.status !== 'active';
  const sharingDisabled = !url || isPreview || suspended;
  async function share() {
    if (sharingDisabled || !url || busy.current) return;
    busy.current = true; setError('');
    try { await Share.share({ message: `${name} · Get a website for your shop: ${url}`, url }); }
    catch { setError('Could not share your link. Please try again.'); }
    finally { busy.current = false; }
  }
  return <AffiliateToolFrame title="My creator page" preview={isPreview} offline={isOffline} suspended={suspended}
    footer={<>
      {error ? <Text variant="label" tone="danger" accessibilityRole="alert">{error}</Text> : null}
      <Button title="Share my shop link" icon="share-outline" disabled={sharingDisabled} onPress={share} />
    </>}>
    <Card variant="lg" style={styles.preview}>
      <View accessible={false} style={styles.cover}><TendsoMark size={42} /></View>
      <View style={styles.pageInfo}>
        <Avatar uri={safePhoto} name={name} size={64} ring style={styles.avatar} />
        <Text variant="heading" weight="bold">{name}</Text>
        {saved.message.trim() ? <Text variant="body" tone="muted">{saved.message.trim()}</Text> : null}
        <View style={styles.offer}>
          <View style={styles.price}>
            <Text variant="label" tone="muted">Website price</Text>
            <Text variant="display" tabular>{formatPHP(price)}</Text>
          </View>
          {savings > 0 ? <Chip label={`Save ${formatPHP(savings)}`} tone="ok" /> : null}
        </View>
        <AffiliateSocialButtons socialLinks={saved.socialLinks} disabled={isPreview || suspended} />
      </View>
    </Card>
    {url ? <View style={styles.link}>
      <Ionicons name="link-outline" size={20} color={colors.ink} />
      <Text selectable variant="label" style={styles.linkText}>{url.replace(/^https?:\/\//, '')}</Text>
      <CopyButton value={url} label="Copy creator page link" disabled={sharingDisabled} compact />
    </View> : <Notice tone="warn">Your page handle is unavailable. Contact Tendso support for help.</Notice>}
    <Card variant="lg" style={styles.menu}>
      <ListRow title="Edit page" titleNumberOfLines={0} icon="create-outline" onPress={() => router.push('/(app)/affiliate/page-edit')} divider />
      <ListRow title="Your price" titleNumberOfLines={0} icon="storefront-outline" onPress={() => router.push('/(app)/affiliate/offer')} divider />
      <ListRow title="Share QR & poster" titleNumberOfLines={0} icon="share-outline" onPress={() => router.push('/(app)/affiliate/share')} />
    </Card>
  </AffiliateToolFrame>;
}

const styles = StyleSheet.create({
  preview: { padding: 0, overflow: 'hidden' },
  cover: { height: 104, backgroundColor: colors.bg2, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: space.xl },
  pageInfo: { paddingHorizontal: space.xl - 4, paddingBottom: space.xl - 4, gap: space.xs },
  avatar: { marginTop: -32, marginBottom: space.sm },
  offer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md, marginTop: space.md },
  price: { gap: space.xs },
  link: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.field, borderWidth: 1, borderColor: colors.ruleStrong, paddingLeft: space.lg, paddingRight: space.sm },
  linkText: { flex: 1, minWidth: 0 },
  menu: { paddingVertical: space.xs, paddingHorizontal: space.lg },
});
