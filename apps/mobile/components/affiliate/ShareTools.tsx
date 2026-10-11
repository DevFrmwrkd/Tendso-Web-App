import React, { useMemo, useRef, useState } from 'react';
import { Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path } from 'react-native-svg';
import qrcode from 'qrcode-generator';
import { Body, Card, Display, Door, Label } from '../ui/primitives';
import { colors, fonts } from '../../theme/tokens';
import { affiliateUrl } from './model';
import { Notice } from './Screen';
import { OfferPrice } from './Offer';

export function QrCode({ value, size = 192 }: { value: string; size?: number }) {
  const matrix = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    const pieces: string[] = [];
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) pieces.push(`M${col + 4},${row + 4}h1v1h-1z`);
    }
    return { path: pieces.join(''), count: count + 8 };
  }, [value]);
  return <Svg width={size} height={size} viewBox={`0 0 ${matrix.count} ${matrix.count}`} accessibilityLabel="QR code for your affiliate page" accessibilityRole="image">
    <Path d={`M0,0h${matrix.count}v${matrix.count}H0z`} fill="#ffffff" /><Path d={matrix.path} fill="#111111" />
  </Svg>;
}

export function CopyButton({ value, label, disabled = false }: { value: string; label: string; disabled?: boolean }) {
  const [message, setMessage] = useState('');
  async function copy() {
    if (disabled || !value) return;
    try { await Clipboard.setStringAsync(value); setMessage('Copied.'); }
    catch { setMessage('Could not copy. Please try again.'); }
  }
  return <View style={{ gap: 6 }}><Door variant="ghost" label={label} disabled={disabled || !value} onPress={copy} /><Text accessibilityLiveRegion="polite" style={{ color: colors.ink3, fontFamily: fonts.sans, fontSize: 12 }}>{message}</Text></View>;
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
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: poster ? 'Share printable affiliate poster' : 'Share your affiliate QR' });
    } catch { setError('Could not create the image. Please try again.'); }
    finally { setBusy(false); }
  }
  return <Card style={{ gap: 14 }}>
    <Display size="sm">Your link and QR</Display><Body size="sm">Sharing uses your saved page and price.</Body>
    <Text selectable style={{ fontFamily: fonts.sans, color: colors.ink }}>{url}</Text>
    <CopyButton value={url} label="Copy page link" disabled={disabled} />
    <Door label="Share page link" variant="ghost" disabled={disabled || busy} onPress={shareLink} />
    <View ref={qrRef} collapsable={false} style={{ alignSelf: 'center', backgroundColor: '#fff' }}><QrCode value={url} /></View>
    <Door label="Share QR PNG" variant="ghost" disabled={disabled || busy} loading={busy} onPress={() => shareImage(false)} />
    <View ref={posterRef} collapsable={false} style={{ backgroundColor: '#fff', padding: 14, gap: 6, width: '100%', maxWidth: 280, aspectRatio: 1240 / 1754, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
      <Label>Tendso</Label><Text numberOfLines={1} style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.ink }}>{displayName}</Text><Display size="sm" style={{ textAlign: 'center' }}>Your shop. Online.</Display>
      <OfferPrice price={price} /><Body size="xs">One-time payment</Body><QrCode value={url} size={136} />
      <Body size="xs" style={{ textAlign: 'center' }}>Scan to order your website</Body><Text numberOfLines={2} style={{ fontFamily: fonts.sans, fontSize: 9, textAlign: 'center', color: colors.ink }}>{url.replace('https://', '')}</Text>
    </View>
    <Door label="Share printable poster PNG" variant="ghost" disabled={disabled || busy} onPress={() => shareImage(true)} />
    <Body size="xs">The poster has A4 proportions. Save or share the image, then print it on A4 paper.</Body>
    {error ? <Notice error>{error}</Notice> : null}
  </Card>;
}
