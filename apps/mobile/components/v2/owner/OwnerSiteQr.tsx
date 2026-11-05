import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Button, Card, Text } from '..';
import { QrCode } from '../QrCode';
import { publicSiteUrl } from './OwnerSiteSummary';
import { colors, radius, space } from '../../../theme/v2';

export function OwnerSiteQr({ name, url, isCurrent }: { name: string; url: string; isCurrent: () => boolean }) {
  const { width } = useWindowDimensions();
  const ref = useRef<View>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && isCurrent();
  const act = async (save: boolean) => {
    if (busy.current || !current() || !publicSiteUrl(url)) return;
    busy.current = true; setWorking(true); setMessage('');
    try {
      if (save) {
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (!current()) return;
        if (!permission.granted) { setMessage('Allow photo access to save your QR code.'); return; }
      } else if (!await Sharing.isAvailableAsync()) {
        if (current()) setMessage('Image sharing is not available on this device.');
        return;
      }
      if (!current()) return;
      const uri = await captureRef(ref, { format: 'png', quality: 1, width: 1000 });
      if (!current()) return;
      if (save) { await MediaLibrary.saveToLibraryAsync(uri); if (current()) setMessage('QR code saved to your photos.'); }
      else await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `Share ${name} QR code` });
    } catch { if (current()) setMessage('Could not create your QR image. Please try again.'); }
    finally { busy.current = false; if (current()) setWorking(false); }
  };
  return <Card style={styles.card}>
    <Text variant="heading">A QR for your counter</Text>
    <View ref={ref} collapsable={false} style={styles.artwork} testID="owner-site-qr-artwork">
      <Text variant="heading" align="center">{name}</Text>
      <QrCode value={url} size={Math.max(120, Math.min(224, width - 112))} accessibilityLabel={`QR code for ${name} website`} />
      <Text variant="label" align="center">Scan to visit our website</Text>
      <Text variant="label" align="center">{url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</Text>
    </View>
    <View style={styles.buttons}>
      <Button title="Save QR" variant="ghost" icon="download-outline" disabled={working} onPress={() => { void act(true); }} style={styles.button} />
      <Button title="Share QR" variant="ghost" icon="share-outline" disabled={working} onPress={() => { void act(false); }} style={styles.button} />
    </View>
    {message ? <Text variant="label" tone="muted" accessibilityLiveRegion="polite">{message}</Text> : null}
  </Card>;
}

const styles = StyleSheet.create({
  card: { gap: space.md, marginTop: space.lg },
  artwork: { alignSelf: 'center', width: '100%', maxWidth: 320, padding: space.md, alignItems: 'center', gap: space.sm, backgroundColor: colors.card, borderRadius: radius.field },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }, button: { flex: 1, minWidth: 120 },
});
