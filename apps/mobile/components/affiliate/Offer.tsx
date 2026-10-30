import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { CREATOR_CODE_DISCOUNT, CREATOR_CODE_PRICE, commissionFor, creatorDiscount, formatPHP, WEBSITE_PRICE } from '../../../../packages/shared/pricing';
import { AFFILIATE_SOCIAL_LABELS, AFFILIATE_SOCIAL_PLATFORMS, affiliatePhotoError, getAffiliateSocialLinks, type AffiliateSocialLinks } from '../../../../lib/affiliates';
import { Avatar, Button, Card, Chip, Text } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { AffiliateAccess, type AffiliateAccessProps } from './Screen';
import { AffiliateToolFrame } from './AffiliateToolFrame';

export function AffiliateOfferScreen() {
  return <AffiliateAccess>{props => <PriceEditorContent {...props} />}</AffiliateAccess>;
}

/** Kept as a route-compatible name; creator-code offers are read-only. */
export function PriceEditorContent({ account, isPreview, isOffline }: AffiliateAccessProps) {
  return <AffiliateToolFrame title="Your offer" preview={isPreview} suspended={account.status !== 'active'} offline={isOffline}>
    <AffiliateOfferSummary code={account.referralCode} />
  </AffiliateToolFrame>;
}

export function AffiliateOfferSummary({ code }: { code?: string }) {
  return <View style={styles.card}>
    <Text variant="title" accessibilityRole="header">30% off with your creator code</Text>
    <Text variant="body" tone="muted">Your code gives shop owners {Math.round(CREATOR_CODE_DISCOUNT * 100)}% off the {formatPHP(WEBSITE_PRICE)} website price.</Text>
    <Card variant="lg" style={styles.priceEditor}>
      <Text variant="label" tone="muted">The shop pays</Text>
      <OfferPrice large />
      <Text variant="label" tone="muted">One-time website price. See it first. Pay to publish.</Text>
    </Card>
    <Card variant="lg" style={styles.priceEditor}>
      <View style={styles.summaryRow}><Text variant="label" tone="muted" style={styles.summaryLabel}>The shop saves</Text><Text variant="bodyLg" weight="bold" tabular>{formatPHP(WEBSITE_PRICE - CREATOR_CODE_PRICE)}</Text></View>
      <View style={styles.summaryRow}><Text variant="label" tone="muted" style={styles.summaryLabel}>Your share per paid website</Text><Text variant="bodyLg" weight="bold" tabular>{formatPHP(commissionFor(CREATOR_CODE_PRICE))}</Text></View>
    </Card>
    <Text variant="label" tone="muted">Your share is 50% of the discounted website price, credited after the shop pays in full.</Text>
    {code ? <Card variant="lg" style={styles.priceEditor}><Text variant="label" tone="muted">Creator code</Text><Text selectable variant="title">{code}</Text><Text variant="label" tone="muted">Shop owners enter this code before payment.</Text></Card> : null}
  </View>;
}
/** The fixed creator-code price and its 30% discount from the website price. */
export function OfferPrice({ large = false }: { price?: number; large?: boolean }) {
  const price = CREATOR_CODE_PRICE;
  const discount = creatorDiscount(price, WEBSITE_PRICE);
  return <View style={styles.priceRow}>
    {discount ? <Text testID="affiliate-list-price" variant="bodyLg" tone="muted" style={{ textDecorationLine: 'line-through' }}>{formatPHP(discount.listPrice)}</Text> : null}
    <Text variant={large ? 'hero' : 'title'} tabular>{formatPHP(price)}</Text>
    {discount ? <Text variant="label" tone="muted">{discount.percentOff}% off</Text> : null}
  </View>;
}

/**
 * Compact preview of the saved creator's offer, including the code visitors enter before paying.
 * The main action is decorative inside this editor preview.
 */
export function OfferPreview({ photo, displayName, message, socialLinks, socialLink, socialDisabled = false, code, commission = false }: { photo?: string; displayName: string; message?: string; socialLinks?: AffiliateSocialLinks; socialLink?: string; socialDisabled?: boolean; price?: number; code?: string; commission?: boolean }) {
  const price = CREATOR_CODE_PRICE;
  const safePhoto = photo && !affiliatePhotoError(photo) ? photo : undefined;
  const discount = creatorDiscount(price, WEBSITE_PRICE);
  const firstName = displayName.trim().split(/\s+/)[0] || displayName;
  return <Card variant="lg" style={styles.card}>
    <View style={styles.who}>
      <Avatar uri={safePhoto} name={displayName} size={64} />
      <View style={styles.whoText}>
        <Text variant="bodyLg" weight="bold" numberOfLines={1}>{displayName}</Text>
        <Text variant="label" tone="muted">Creator on Tendso</Text>
      </View>
    </View>
    {message ? <Text variant="body" tone="ink2">{message}</Text> : null}
    <View style={styles.offer}>
      <Text variant="heading">{discount ? `Save ${formatPHP(discount.listPrice - discount.price)} with ${firstName}'s code` : 'A website for your shop'}</Text>
      {code ? <Chip tone="ok" label={`Creator code: ${code}`} /> : null}
      <OfferPrice price={price} large />
      <Text variant="label" tone="muted">One-time payment for your website.</Text>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.fakeButton}>
        <Text variant="button" tone="onAccent">Get my website</Text>
      </View>
      <AffiliateSocialButtons socialLinks={socialLinks} socialLink={socialLink} disabled={socialDisabled} />
    </View>
    {commission ? <Text variant="label" tone="muted">You receive {formatPHP(commissionFor(price))} after the shop pays in full.</Text> : null}
  </Card>;
}

/** Each public profile keeps its own platform label; only validated public URLs can open. */
export function AffiliateSocialButtons({ socialLinks, socialLink, disabled = false }: { socialLinks?: AffiliateSocialLinks; socialLink?: string; disabled?: boolean }) {
  const links = getAffiliateSocialLinks(socialLinks, socialLink);
  const platforms = AFFILIATE_SOCIAL_PLATFORMS.filter(platform => !!links[platform]);
  if (!platforms.length) return null;
  return <View style={styles.socialButtons}>
    {platforms.map(platform => <Button key={platform} title={AFFILIATE_SOCIAL_LABELS[platform]} accessibilityHint={`Opens your ${AFFILIATE_SOCIAL_LABELS[platform]} link`} variant="ghost" size="md" icon="open-outline" disabled={disabled} onPress={() => {
      const url = links[platform];
      if (!disabled && url) void Linking.openURL(url).catch(() => {});
    }} />)}
  </View>;
}

const styles = StyleSheet.create({
  priceEditor: { gap: space.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.lg },
  summaryLabel: { flex: 1 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: space.md },
  card: { gap: space.lg },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  whoText: { flex: 1, gap: 2 },
  offer: { gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.bg },
  socialButtons: { gap: space.sm },
  fakeButton: { minHeight: 56, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
});
