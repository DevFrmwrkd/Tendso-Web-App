import React from 'react';
import { Image, Linking, Text, View } from 'react-native';
import { commissionFor, creatorDiscount, formatPHP, WEBSITE_PRICE } from '../../../../packages/shared/pricing';
import { affiliatePhotoError, affiliateSocialLinkError } from '../../../../lib/affiliates';
import { Body, Card, Display, Door, Label } from '../ui/primitives';
import { colors, fonts } from '../../theme/tokens';

export function OfferPrice({ price }: { price: number }) {
  const discount = creatorDiscount(price, WEBSITE_PRICE);
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 }}>
    {discount ? <Text testID="affiliate-list-price" style={{ textDecorationLine: 'line-through', color: colors.ink3, fontFamily: fonts.sans }}>{formatPHP(discount.listPrice)}</Text> : null}
    <Display size="sm">{formatPHP(price)}</Display>
    {discount ? <Body size="sm">{discount.percentOff}% off</Body> : null}
  </View>;
}

export function OfferPreview({ photo, displayName, message, socialLink, price, commission = false }: { photo?: string; displayName: string; message?: string; socialLink?: string; price: number; commission?: boolean }) {
  const safePhoto = photo && !affiliatePhotoError(photo) ? photo : undefined;
  const safeSocial = socialLink && !affiliateSocialLinkError(socialLink) ? socialLink.trim() : undefined;
  return <Card style={{ gap: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {safePhoto ? <Image source={{ uri: safePhoto }} accessibilityLabel="Affiliate page photo" style={{ width: 64, height: 64, borderRadius: 32 }} /> : <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentBg, justifyContent: 'center', alignItems: 'center' }}><Display size="sm">{displayName.slice(0, 1).toUpperCase()}</Display></View>}
      <View style={{ flex: 1, gap: 4 }}><Label>Your Tendso affiliate</Label><Body weight="bold">{displayName}</Body></View>
    </View>
    {message ? <Body>{message}</Body> : null}
    <Display size="sm">A website for your shop</Display><OfferPrice price={price} /><Body size="sm">One-time payment for your business website.</Body>
    {commission ? <Body weight="medium">Your commission: {formatPHP(commissionFor(price))}</Body> : null}
    {safeSocial ? <Door label="Message on Facebook" variant="ghost" onPress={() => { void Linking.openURL(safeSocial).catch(() => {}); }} /> : null}
  </Card>;
}
