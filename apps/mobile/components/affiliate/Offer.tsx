import React, { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '@tendso/convex-client';
import { BASE_PRICE, PRICE_CEILING, COMMISSION_RATE, clampSellPrice, commissionFor, creatorDiscount, formatPHP, WEBSITE_PRICE } from '../../../../packages/shared/pricing';
import { affiliatePhotoError, affiliateSocialLinkError } from '../../../../lib/affiliates';
import { Avatar, Button, Card, Chip, Field, Text } from '../v2';
import { PriceSlider } from '../PriceSlider';
import { colors, radius, space } from '../../theme/v2';
import { AffiliateAccess, Notice, type AffiliateAccessProps } from './Screen';
import { AffiliateToolFrame } from './AffiliateToolFrame';
import { affiliateDraft } from './model';

export function AffiliateOfferScreen() {
  return <AffiliateAccess>{props => props.isPreview || props.account.status !== 'active' || !props.isAuthenticated
    ? <PriceEditorContent {...props} /> : <LivePriceEditor {...props} />}</AffiliateAccess>;
}

function LivePriceEditor(props: AffiliateAccessProps) {
  const save = useMutation(api.affiliates.updatePage);
  return <PriceEditorContent {...props} onSave={price => save({ price })} />;
}

/** Price-only writes preserve saved page details and the frozen amounts on existing sales. */
export function PriceEditorContent({ account, isPreview, isOffline, onSave }: AffiliateAccessProps & { onSave?: (price: number) => Promise<unknown> }) {
  const incoming = affiliateDraft(account).price;
  const [seen, setSeen] = useState(incoming);
  const [draft, setDraft] = useState(incoming);
  const [baseline, setBaseline] = useState(incoming);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const priceInput = useRef(draft);
  priceInput.current = draft;
  const dirty = draft !== baseline;
  if (seen !== incoming) {
    setSeen(incoming); setBaseline(incoming);
    if (!dirty) setDraft(incoming);
  }
  const locked = isPreview || isOffline || account.status !== 'active' || !onSave || saving;
  const price = draft.trim() && Number.isFinite(Number(draft)) ? clampSellPrice(Number(draft)) : Number(baseline);
  const change = useCallback((value: string) => {
    if (priceInput.current === value) return;
    priceInput.current = value; setDraft(value); setSaved(false); setError('');
  }, []);
  const slide = useCallback((value: number) => change(String(value)), [change]);
  async function save() {
    if (locked || !dirty || !onSave) return;
    if (!draft.trim() || !Number.isFinite(Number(draft))) { setError('Enter your website price in whole pesos.'); return; }
    setSaving(true); setError('');
    try {
      await onSave(price); setDraft(String(price)); setBaseline(String(price)); setSaved(true);
    } catch (problem) {
      setError(problem instanceof ConvexError && typeof problem.data === 'string' ? problem.data : 'Your price was not saved. Please try again.');
    } finally { setSaving(false); }
  }
  return <AffiliateToolFrame avoidKeyboard title="Your price" preview={isPreview} suspended={account.status !== 'active'} offline={isOffline}
    footer={<>
      {saved && !dirty ? <Text variant="label" tone="muted" align="center" accessibilityLiveRegion="polite">Price saved.</Text> : dirty ? <Text variant="label" tone="muted" align="center">Unsaved changes. Sharing uses your saved price.</Text> : null}
      <Button title="Save price" loading={saving} disabled={locked || !dirty} onPress={save} />
    </>}>
    <Text variant="title" accessibilityRole="header">One price. Paid once.</Text>
    <Card variant="lg" style={styles.priceEditor}>
      <Field label="Website price in pesos" prefix="₱" value={draft} keyboardType="number-pad" maxLength={9} editable={!locked} onChangeText={change} onBlur={() => { if (draft.trim() && Number.isFinite(Number(draft))) change(String(price)); }} />
      <PriceSlider floor={BASE_PRICE} ceiling={PRICE_CEILING} anchor={WEBSITE_PRICE} commissionRate={COMMISSION_RATE} step={1} initialValue={price} disabled={locked} onChange={slide} showEarnings={false} />
    </Card>
    <View style={styles.quickPrices}>
      {[BASE_PRICE, 3499, PRICE_CEILING].map(amount => <Pressable key={amount} accessibilityRole="button" accessibilityLabel={`Set price to ${formatPHP(amount)}`} accessibilityState={{ selected: price === amount, disabled: locked }} disabled={locked} onPress={() => change(String(amount))} style={[styles.quickPrice, price === amount && styles.selectedPrice]}><Text variant="label">{formatPHP(amount)}</Text></Pressable>)}
    </View>
    <Card variant="lg" style={styles.priceEditor}>
      <View style={styles.summaryRow}><Text variant="label" tone="muted" style={styles.summaryLabel}>You earn per paid website</Text><Text variant="bodyLg" weight="bold" tabular>{formatPHP(commissionFor(price))}</Text></View>
      <View style={styles.summaryRow}><Text variant="label" tone="muted" style={styles.summaryLabel}>The shop saves</Text><Text variant="bodyLg" weight="bold" tabular>{formatPHP(Math.max(0, WEBSITE_PRICE - price))}</Text></View>
    </Card>
    <Text variant="label" tone="muted">{formatPHP(BASE_PRICE)}–{formatPHP(PRICE_CEILING)}. New prices apply to future orders only.</Text>
    {error ? <Notice error>{error}</Notice> : null}
  </AffiliateToolFrame>;
}

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
  priceEditor: { gap: space.lg },
  quickPrices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  quickPrice: { minHeight: 48, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: colors.bg2, borderWidth: 1, borderColor: 'transparent' },
  selectedPrice: { backgroundColor: colors.accent, borderColor: colors.ink },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.lg },
  summaryLabel: { flex: 1 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: space.md },
  card: { gap: space.lg },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  whoText: { flex: 1, gap: 2 },
  offer: { gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.bg },
  fakeButton: { minHeight: 56, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
});
