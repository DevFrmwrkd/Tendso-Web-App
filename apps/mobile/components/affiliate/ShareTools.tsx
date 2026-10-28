import React, { useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { QrCode as SharedQrCode } from '../v2/QrCode';
// Body / Display / Label are only used by the A4 poster artwork below (captured to a PNG, left as designed).
import { Body, Display, Label } from '../ui/primitives';
import { colors, fonts } from '../../theme/tokens';
import { Button, Card, Text as V2Text } from '../v2';
import { space } from '../../theme/v2';
import { affiliateUrl } from './model';
import { Notice } from './Screen';
import { OfferPrice } from './Offer';

export function QrCode({ value, size = 192 }: { value: string; size?: number }) {
  return <SharedQrCode value={value} size={size} accessibilityLabel="QR code for your creator page" />;
}

export function CopyButton({ value, label, disabled = false }: { value: string; label: string; disabled?: boolean }) {
  const [message, setMessage] = useState('');
  async function copy() {
    if (disabled || !value) return;
    try { await Clipboard.setStringAsync(value); setMessage('Copied.'); }
    catch { setMessage('Could not copy. Please try again.'); }
  }
  return <View style={{ gap: 4 }}>
    <Button variant="ghost" size="md" icon="copy-outline" title={label} disabled={disabled || !value} onPress={copy} />
    <V2Text variant="label" tone="muted" accessibilityLiveRegion="polite" style={message ? undefined : { height: 0 }}>{message}</V2Text>
  </View>;
}

export function ShareTools({ handle, displayName, price, disabled }: { handle: string; displayName: string; price: number; disabled: boolean }) {
  const url = affiliateUrl(handle);
  const qrRef = useRef<View>(null);
  const posterRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function shareLink() {
    if (disabled) return;
    setError('');
    try { await Share.share({ message: `${displayName} · Get a website for your shop: ${url}`, url }); }
    catch { setError('Could not share your link. Please try again.'); }
  }
  async function shareImage(poster: boolean) {
    if (disabled || busy) return;
    setBusy(true); setError('');
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing unavailable');
      const uri = await captureRef(poster ? posterRef : qrRef, { format: 'png', quality: 1, width: poster ? 1240 : 768, height: poster ? 1754 : 768 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: poster ? 'Share printable creator poster' : 'Share your creator QR' });
    } catch { setError('Could not create the image. Please try again.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: space.lg }}>
    <Card variant="lg" style={styles.card}>
      <V2Text variant="heading">Your link</V2Text>
      <V2Text selectable variant="bodyLg" weight="bold">{url}</V2Text>
      <CopyButton value={url} label="Copy page link" disabled={disabled} />
      <Button title="Share page link" variant="dark" size="md" icon="share-outline" disabled={disabled || busy} onPress={shareLink} />
      <V2Text variant="label" tone="muted">Sharing uses your saved page and price.</V2Text>
    </Card>
    <Card variant="lg" style={styles.card}>
      <V2Text variant="heading">QR code</V2Text>
      <View ref={qrRef} collapsable={false} style={{ alignSelf: 'center', backgroundColor: '#fff' }}><QrCode value={url} /></View>
      <Button title="Share QR PNG" variant="ghost" size="md" disabled={disabled || busy} loading={busy} onPress={() => shareImage(false)} />
    </Card>
    <Card variant="lg" style={styles.card}>
      <V2Text variant="heading">Printable poster</V2Text>
      <View ref={posterRef} collapsable={false} style={{ backgroundColor: '#fff', padding: 14, gap: 6, width: '100%', maxWidth: 280, aspectRatio: 1240 / 1754, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
        <Label>Tendso</Label><Text numberOfLines={1} style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.ink }}>{displayName}</Text><Display size="sm" style={{ textAlign: 'center' }}>Your shop. Online.</Display>
        <OfferPrice price={price} /><Body size="xs">One-time payment</Body><QrCode value={url} size={136} />
        <Body size="xs" style={{ textAlign: 'center' }}>Scan to order your website</Body><Text numberOfLines={2} style={{ fontFamily: fonts.sans, fontSize: 9, textAlign: 'center', color: colors.ink }}>{url.replace('https://', '')}</Text>
      </View>
      <Button title="Share printable poster PNG" variant="ghost" size="md" disabled={disabled || busy} onPress={() => shareImage(true)} />
      <V2Text variant="label" tone="muted">A4 size. Save the image, then print it.</V2Text>
    </Card>
    {error ? <Notice error>{error}</Notice> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: space.md },
});
