import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { createAffiliatePoster } from '../../../../lib/affiliatePoster';
import { QrCode as SharedQrCode } from '../v2/QrCode';
import { colors } from '../../theme/tokens';
import { Button, Card, Text as V2Text } from '../v2';
import { space } from '../../theme/v2';
import { Notice } from './Screen';
import { BoldOfferPoster, type BoldOfferPosterHandle } from './BoldOfferPoster';
import { cleanupPosterPng, persistPosterPng } from './posterExport';

export function QrCode({ value, size = 192 }: { value: string; size?: number }) {
  return <SharedQrCode value={value} size={size} accessibilityLabel="QR code for your creator page" />;
}

export function CopyButton({ value, label, disabled = false, compact = false }: { value: string; label: string; disabled?: boolean; compact?: boolean }) {
  const [message, setMessage] = useState('');
  async function copy() {
    if (disabled || !value) return;
    try { await Clipboard.setStringAsync(value); setMessage('Copied.'); }
    catch { setMessage('Could not copy. Please try again.'); }
  }
  return <View style={{ gap: 4 }}>
    {compact ? <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || !value }} disabled={disabled || !value} onPress={copy} style={styles.compactCopy}>
      <Ionicons name="copy-outline" size={20} color={colors.ink} />
    </Pressable> : <Button variant="ghost" size="md" icon="copy-outline" title={label} disabled={disabled || !value} onPress={copy} />}
    <V2Text variant="label" tone="muted" accessibilityLiveRegion="polite" style={message ? undefined : { height: 0 }}>{message}</V2Text>
  </View>;
}

export function ShareTools({ handle, displayName, photo, price, referralCode, disabled }: {
  handle: string; displayName: string; photo?: string | null; price: number; referralCode?: string | null; disabled: boolean;
}) {
  const model = useMemo(() => createAffiliatePoster({ handle, displayName, photo, price, referralCode }), [handle, displayName, photo, price, referralCode]);
  const url = model.url;
  const qrRef = useRef<View>(null);
  const posterRef = useRef<BoldOfferPosterHandle>(null);
  const mounted = useRef(true);
  const lock = useRef<object | null>(null);
  const actor = JSON.stringify({ model, disabled });
  const latestActor = useRef(actor);
  latestActor.current = actor;
  const [busy, setBusy] = useState<'link' | 'qr' | 'poster' | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function begin(action: 'link' | 'qr' | 'poster') {
    if (disabled || !handle.trim() || lock.current || !mounted.current) return null;
    const attempt = {};
    lock.current = attempt; setBusy(action); setError('');
    return attempt;
  }
  function current(attempt: object) { return mounted.current && lock.current === attempt && latestActor.current === actor; }
  function finish(attempt: object) {
    if (lock.current !== attempt) return;
    lock.current = null;
    if (mounted.current) setBusy(null);
  }
  async function shareLink() {
    const attempt = begin('link'); if (!attempt) return;
    try { await Share.share({ message: `${model.name} · Get a website for your shop: ${url}`, url }); }
    catch { if (current(attempt)) setError('Could not share your link. Please try again.'); }
    finally { finish(attempt); }
  }
  async function shareImage(poster: boolean) {
    const attempt = begin(poster ? 'poster' : 'qr'); if (!attempt) return;
    let posterUri: string | undefined;
    let qrUri: string | undefined;
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing unavailable');
      if (!current(attempt)) return;
      let uri: string;
      if (poster) {
        if (!posterRef.current) throw new Error('Poster unavailable');
        const base64 = await posterRef.current.exportPng();
        if (!current(attempt)) return;
        posterUri = await persistPosterPng(base64);
        if (!current(attempt)) return;
        uri = posterUri;
      } else {
        qrUri = await captureRef(qrRef, { format: 'png', quality: 1, width: 768, height: 768 });
        if (!current(attempt)) return;
        uri = qrUri;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: poster ? 'Share printable creator poster' : 'Share your creator QR' });
    } catch { if (current(attempt)) setError('Could not create the image. Please try again.'); }
    finally {
      await cleanupPosterPng(posterUri);
      try { if (qrUri) releaseCapture?.(qrUri); }
      catch { /* The OS may have already removed the temporary QR image. */ }
      finish(attempt);
    }
  }
  return <View style={{ gap: space.lg }}>
    <Card variant="lg" style={styles.card}>
      <V2Text variant="heading">Your link</V2Text>
      <V2Text selectable variant="bodyLg" weight="bold">{url}</V2Text>
      <CopyButton value={url} label="Copy page link" disabled={disabled} />
      <Button title="Share page link" variant="dark" size="md" icon="share-outline" disabled={disabled || !!busy} loading={busy === 'link'} onPress={shareLink} />
      <V2Text variant="label" tone="muted">Sharing uses your saved page and creator-code offer.</V2Text>
    </Card>
    <Card variant="lg" style={styles.card}>
      <V2Text variant="heading">QR code</V2Text>
      <View ref={qrRef} collapsable={false} style={{ alignSelf: 'center', backgroundColor: '#fff' }}><QrCode value={url} /></View>
      <Button title="Share QR PNG" variant="ghost" size="md" disabled={disabled || !!busy} loading={busy === 'qr'} onPress={() => shareImage(false)} />
    </Card>
    <Card variant="lg" style={styles.card}>
      <V2Text variant="heading">Printable poster</V2Text>
      <BoldOfferPoster ref={posterRef} model={model} />
      <Button title="Share printable poster PNG" variant="ghost" size="md" disabled={disabled || !!busy} loading={busy === 'poster'} onPress={() => shareImage(true)} />
      <V2Text variant="label" tone="muted">A4 size. Save the image, then print it.</V2Text>
    </Card>
    {error ? <Notice error>{error}</Notice> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  compactCopy: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
