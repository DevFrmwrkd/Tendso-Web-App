/** Book a visit: when + a number to reach you → a request in admin Leads (leads.create). */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, ScreenShell, Text } from '../../../components/v2';
import { Field, OptionRow } from '../../../components/v2/owner/OwnerUI';
import { useRequestVisit } from '../../../lib/v2/ownerData';
import { useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { colors, space } from '../../../theme/v2';

const WHEN = ['Today', 'Tomorrow', 'This week'] as const;

export default function BookVisit() {
  const router = useRouter();
  const { agent } = useLocalSearchParams<{ agent?: string }>();
  const { me, site } = useOwnerSite();
  const intake = useOwnerIntake();
  const request = useRequestVisit();
  const [when, setWhen] = useState<(typeof WHEN)[number]>('Today');
  const [phone, setPhone] = useState(me?.owner.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await request({
        name: me?.owner.name || intake.ownerName || 'Shop owner',
        phone: phone.trim(),
        email: me?.owner.email,
        shopName: site?.businessName ?? intake.businessName,
        when,
        agentName: agent,
      });
      setSent(true);
    } catch (e: any) {
      setError(e?.data ?? e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <ScreenShell scroll={false} footer={<Button title="OK" onPress={() => router.back()} />}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={52} color={colors.onAccent} />
          </View>
          <Text variant="display" align="center" accessibilityRole="header">Request sent.</Text>
          <Text variant="bodyLg" tone="ink2" align="center">We will call you to set a time.</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenShell
        title="When can we come?"
        onBack={() => router.back()}
        footer={
          <>
            {error ? <Text tone="danger" align="center">{error}</Text> : null}
            <Button title="Send request" onPress={send} loading={busy} disabled={phone.replace(/\D/g, '').length < 7} />
          </>
        }
      >
        <View style={{ gap: space.md }}>
          {WHEN.map((w) => (
            <OptionRow key={w} label={w} icon="calendar-outline" selected={when === w} onPress={() => setWhen(w)} />
          ))}
          <View style={{ height: space.sm }} />
          <Field label="Your mobile number" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
        </View>
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}
