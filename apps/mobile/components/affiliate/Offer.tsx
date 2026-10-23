import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { commissionFor, creatorDiscount, formatPHP, WEBSITE_PRICE } from '../../../../packages/shared/pricing';
import { affiliatePhotoError, affiliateSocialLinkError } from '../../../../lib/affiliates';
import { Avatar, Button, Card, Chip, Text } from '../v2';
import { colors, radius, space } from '../../theme/v2';

/** List price struck through, the creator's price, and the percentage off. */
export function OfferPrice({ price, large = false }: { price: number; large?: boolean }) {
  const discount = creatorDiscount(price, WEBSITE_PRICE);
  return <View style={styles.priceRow}>
    {discount ? <Text testID="affiliate-list-price" variant="bodyLg" tone="muted" style={{ textDecorationLine: 'line-through' }}>{formatPHP(discount.listPrice)}</Text> : null}
    <Text variant={large ? 'hero' : 'title'} tabular>{formatPHP(price)}</Text>
    {discount ? <Text variant="label" tone="muted">{discount.percentOff}% off</Text> : null}
  </View>;
}

/**
 * What a shop owner sees on the creator's page (board `publicPage`): who sent it, "<name> saved you ₱X",
 * the code applied, the price, and one button. Preview only: the button does nothing here.
 */
export function OfferPreview({ photo, displayName, message, socialLink, price, code, commission = false }: { photo?: string; displayName: string; message?: string; socialLink?: string; price: number; code?: string; commission?: boolean }) {
  const safePhoto = photo && !affiliatePhotoError(photo) ? photo : undefined;
  const safeSocial = socialLink && !affiliateSocialLinkError(socialLink) ? socialLink.trim() : undefined;
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
      <Text variant="heading">{discount ? `${firstName} saved you ${formatPHP(discount.listPrice - discount.price)}` : 'A website for your shop'}</Text>
      {discount && code ? <Chip tone="ok" label={`Code ${code} applied`} /> : null}
      <OfferPrice price={price} large />
      <Text variant="label" tone="muted">One-time payment for your website.</Text>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.fakeButton}>
        <Text variant="button" tone="onAccent">Get my website</Text>
      </View>
      {safeSocial ? <Button title="Message on Facebook" variant="ghost" size="md" onPress={() => { void Linking.openURL(safeSocial).catch(() => {}); }} /> : null}
    </View>
    {commission ? <Text variant="label" tone="muted">You keep {formatPHP(commissionFor(price))} when this sells.</Text> : null}
  </Card>;
}

const styles = StyleSheet.create({
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: space.md },
  card: { gap: space.lg },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  whoText: { flex: 1, gap: 2 },
  offer: { gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.bg },
  fakeButton: { minHeight: 56, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
});
