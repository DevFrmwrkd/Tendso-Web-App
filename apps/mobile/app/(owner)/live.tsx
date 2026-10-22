/**
 * After paying: waiting for the payment → going live → "Forge is online!" with the free
 * <shop>.sites.tendso.com address (copy / share) and an optional custom .com.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, ScreenShell, Text } from '../../components/v2';
import { Buddy } from '../../components/v2/owner/OwnerUI';
import { freeAddress, hostOf, slugGuess } from '../../lib/v2/ownerContent';
import { usePreview, useRequestDomain } from '../../lib/v2/ownerData';
import { STEP_ROUTE } from '../../lib/v2/ownerFlow';
import { useOwnerSite } from '../../lib/v2/useOwnerSite';
import { colors, radius, space } from '../../theme/v2';

export default function Live() {
  const router = useRouter();
  const { me, site, id } = useOwnerSite();
  const preview = usePreview(id);
  const requestDomain = useRequestDomain();
  const [copied, setCopied] = useState(false);
  const [domainAsked, setDomainAsked] = useState(false);
  const home = () => router.replace(STEP_ROUTE.home as never);

  const phase = site?.phase;
  const name = site?.businessName ?? 'Your shop';
  const address = hostOf(preview?.publishedUrl ?? site?.publishedUrl) ?? freeAddress(slugGuess(name));
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
    await Clipboard.setStringAsync(`https://${address}`);
    setCopied(true);
  };
  const share = () => Share.share({ message: `${name}: https://${address}` }).catch(() => {});
  const askDomain = () =>
    Alert.alert(`Get ${dotCom}?`, 'We check it is free and set it up with you.', [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Yes, please',
        onPress: async () => {
          try {
            await requestDomain({ name: me?.owner.name || name, email: me?.owner.email, phone: me?.owner.phone ?? undefined, shopName: name, domain: dotCom });
            setDomainAsked(true);
          } catch {
            Alert.alert('Please try again.');
          }
        },
      },
    ]);

  return (
    <ScreenShell title={`${name} is online!`} subtitle="Share it anywhere." footer={<Button title="Go to my home" onPress={home} />}>
      <Card variant="lg" style={{ gap: space.md }}>
        <Text variant="label" tone="muted">Your web address</Text>
        <Text variant="heading" selectable>{address}</Text>
        <View style={styles.acts}>
          <Pressable onPress={copy} accessibilityRole="button" style={[styles.pill, { backgroundColor: colors.bg2 }]}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={20} color={colors.ink} />
            <Text weight="bold">{copied ? 'Copied' : 'Copy'}</Text>
          </Pressable>
          <Pressable onPress={share} accessibilityRole="button" style={[styles.pill, { backgroundColor: colors.ink }]}>
            <Ionicons name="share-outline" size={20} color="#fff" />
            <Text weight="bold" tone="onDark">Share</Text>
          </Pressable>
        </View>
      </Card>
      <Pressable onPress={domainAsked ? undefined : askDomain} accessibilityRole="button" style={styles.dom}>
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
  acts: { flexDirection: 'row', gap: space.sm },
  pill: { flex: 1, minHeight: 52, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  dom: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 72, marginTop: space.lg, paddingHorizontal: space.lg, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)' },
});
