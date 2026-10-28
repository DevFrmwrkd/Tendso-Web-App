/**
 * After paying: waiting for the payment → going live → "Forge is online!" with the free
 * <shop>.sites.tendso.com address (copy / share) and an optional custom .com.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, ScreenShell, Text } from '../../components/v2';
import { Buddy } from '../../components/v2/owner/OwnerUI';
import { OwnerSiteSummary, publicSiteUrl } from '../../components/v2/owner/OwnerSiteSummary';
import { OwnerSiteQr } from '../../components/v2/owner/OwnerSiteQr';
import { hostOf, slugGuess } from '../../lib/v2/ownerContent';
import { usePreview, useRequestDomain } from '../../lib/v2/ownerData';
import { STEP_ROUTE } from '../../lib/v2/ownerFlow';
import { useOwnerSite } from '../../lib/v2/useOwnerSite';
import { colors, radius, space } from '../../theme/v2';

export default function Live() {
  const router = useRouter();
  const { me, site, id } = useOwnerSite();
  const { userId } = useAuth();
  const preview = usePreview(id);
  const requestDomain = useRequestDomain();
  const [copied, setCopied] = useState(false);
  const [domainAsked, setDomainAsked] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [domainBusy, setDomainBusy] = useState(false);
  const domainSaving = useRef(false);
  const mounted = useRef(true);
  const actor = `${userId ?? ''}:${me?.owner._id ?? ''}:${id ?? ''}`;
  const currentActor = useRef(actor); currentActor.current = actor;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setCopied(false); setDomainAsked(false); setCopyError(''); }, [actor]);
  const current = () => mounted.current && currentActor.current === actor;
  const home = () => router.replace(STEP_ROUTE.home as never);

  const phase = site?.phase;
  const name = site?.businessName ?? 'Your shop';
  const url = publicSiteUrl(preview?.publishedUrl ?? site?.publishedUrl);
  const address = hostOf(url);
  const dotCom = `${slugGuess(name)}.com`;

  if (phase === 'awaiting_payment' || phase === 'ready_to_check') {
    return (
      <ScreenShell
        scroll={false}
        footer={
          <>
            <Button title="Pay again" onPress={() => router.replace(STEP_ROUTE.pay as never)} />
            <Button title="Back to home" variant="ghost" onPress={home} />
          </>
        }
      >
        <View style={styles.center}>
          <Buddy size={120} />
          <Text variant="display" align="center" accessibilityRole="header">Waiting for your payment</Text>
          <Text variant="bodyLg" tone="ink2" align="center">We publish as soon as it arrives.</Text>
        </View>
      </ScreenShell>
    );
  }

  if (phase !== 'live') {
    return (
      <ScreenShell scroll={false} footer={<Button title="Back to home" variant="ghost" onPress={home} />}>
        <View style={styles.center}>
          <Buddy size={120} />
          <Text variant="display" align="center" accessibilityRole="header">Going live…</Text>
          <ActivityIndicator color={colors.ink} style={{ marginTop: space.md }} />
        </View>
      </ScreenShell>
    );
  }

  const copy = async () => {
    if (!url || !current()) return;
    setCopyError('');
    try { await Clipboard.setStringAsync(url); if (current()) setCopied(true); }
    catch { if (current()) setCopyError('Could not copy your address. Please try again.'); }
  };
  const share = async () => {
    if (!url || !current()) return;
    setCopyError('');
    try { await Share.share({ message: `${name}: ${url}` }); }
    catch { if (current()) setCopyError('Could not share your address. Please try again.'); }
  };
  const askDomain = () =>
    Alert.alert(`Get ${dotCom}?`, 'We check it is free and set it up with you.', [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Yes, please',
        onPress: async () => {
          if (domainSaving.current || !current()) return;
          domainSaving.current = true; setDomainBusy(true);
          try {
            await requestDomain({ name: me?.owner.name || name, email: me?.owner.email, phone: me?.owner.phone ?? undefined, shopName: name, domain: dotCom });
            if (current()) setDomainAsked(true);
          } catch {
            if (current()) Alert.alert('Please try again.');
          } finally {
            domainSaving.current = false;
            if (mounted.current) setDomainBusy(false);
          }
        },
      },
    ]);

  return (
    <ScreenShell contentStyle={{ gap: space.lg }} footer={<Button title="Go to my home" onPress={home} />}>
      <View style={styles.hero}>
        <View style={styles.success}><Ionicons name="checkmark" size={42} color={colors.ink} /></View>
        <Text variant="display" align="center" accessibilityRole="header">{name} is online!</Text>
        <Text variant="bodyLg" tone="ink2" align="center">Share it anywhere.</Text>
      </View>
      <OwnerSiteSummary name={name} preview={preview} publishedUrl={url} />
      <Card variant="lg" style={{ gap: space.md }}>
        <Text variant="label" tone="muted">Your web address</Text>
        <Text variant="heading" selectable>{address ?? 'Getting your address ready…'}</Text>
        <View style={styles.acts}>
          <Pressable onPress={copy} accessibilityRole="button" disabled={!url} accessibilityState={{ disabled: !url }} style={[styles.pill, { backgroundColor: colors.bg2 }]}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={20} color={colors.ink} />
            <Text weight="bold">{copied ? 'Copied' : 'Copy'}</Text>
          </Pressable>
          <Pressable onPress={share} accessibilityRole="button" disabled={!url} accessibilityState={{ disabled: !url }} style={[styles.pill, { backgroundColor: colors.ink }]}>
            <Ionicons name="share-outline" size={20} color="#fff" />
            <Text weight="bold" tone="onDark">Share</Text>
          </Pressable>
        </View>
        {copyError ? <Text tone="danger" accessibilityRole="alert">{copyError}</Text> : null}
      </Card>
      {url ? <OwnerSiteQr key={`${actor}:${url}`} name={name} url={url} isCurrent={current} /> : null}
      <Pressable onPress={askDomain} disabled={domainAsked || domainBusy} accessibilityState={{ disabled: domainAsked || domainBusy }} accessibilityRole="button" style={styles.dom}>
        <Ionicons name="globe-outline" size={24} color={colors.ink} />
        <View style={{ flex: 1 }}>
          <Text weight="bold">{domainAsked ? 'We will call you' : `Want ${dotCom}?`}</Text>
          <Text variant="label" tone="muted">Optional</Text>
        </View>
        {domainAsked ? null : <Ionicons name="chevron-forward" size={22} color={colors.ink3} />}
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  hero: { alignItems: 'center', gap: space.md, marginBottom: space.xl },
  success: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  acts: { flexDirection: 'row', gap: space.sm },
  pill: { flex: 1, minHeight: 52, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  dom: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 72, marginTop: space.lg, paddingHorizontal: space.lg, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)' },
});
