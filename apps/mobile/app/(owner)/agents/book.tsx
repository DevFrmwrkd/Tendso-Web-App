import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, ScreenShell, Text } from '../../../components/v2';
import { Field } from '../../../components/v2/owner/OwnerUI';
import { useRequestVisit } from '../../../lib/v2/ownerData';
import { useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { colors, radius, space } from '../../../theme/v2';

const WHEN = ['Today', 'Tomorrow', 'This week'] as const;
export default function BookVisit() {
  const scope = useOwnerScope();
  return <VisitForm key={scope.accountKey} scope={scope} />;
}
function VisitForm({ scope }: { scope: ReturnType<typeof useOwnerScope> }) {
  const router = useRouter();
  const { agent } = useLocalSearchParams<{ agent?: string }>();
  const intake = useOwnerIntake();
  const request = useRequestVisit();
  const [when, setWhen] = useState<(typeof WHEN)[number]>('Today');
  const [phone, setPhone] = useState(scope.me?.owner.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const shopName = scope.site?.businessName ?? intake.businessName;
  const send = async () => {
    if (inFlight.current || !scope.isAccountCurrent() || scope.isOffline || phone.replace(/\D/g, '').length < 7) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      await request({ name: scope.me?.owner.name || intake.ownerName || 'Shop owner', phone: phone.trim(), email: scope.me?.owner.email,
        shopName, when, agentName: typeof agent === 'string' ? agent : undefined });
      if (scope.isAccountCurrent()) setSent(true);
    } catch (cause) { if (scope.isAccountCurrent()) setError(cause instanceof Error ? cause.message : 'Could not send your request. Please try again.'); }
    finally { inFlight.current = false; if (scope.isAccountCurrent()) setBusy(false); }
  };
  if (sent) return <ScreenShell title="Your visit request is sent" subtitle="The team will call you to confirm an agent and time."
    contentStyle={styles.content} footer={<Button title="Back to home" onPress={() => router.replace(STEP_ROUTE.home as never)} />}>
    <View style={styles.success}><Ionicons name="checkmark" size={48} color={colors.ink} /></View>
    <Card style={styles.details}><Text variant="heading">Visit request</Text>
      {shopName ? <Text weight="bold">{shopName}</Text> : null}<Text tone="muted">Preferred: {when}</Text><Text tone="muted">We will call {phone}</Text>
      <Text tone="muted">A visit is confirmed after the team contacts you.</Text></Card>
  </ScreenShell>;
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenShell title="Request a shop visit" subtitle="A field agent takes photos and records your story with you."
      onBack={() => { if (!inFlight.current) router.back(); }} contentStyle={styles.content} footer={<>
        {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
        <Button title="Send request" onPress={() => { void send(); }} loading={busy} disabled={scope.isOffline || phone.replace(/\D/g, '').length < 7} />
      </>}>
      {shopName ? <Card style={styles.shop}><Ionicons name="storefront-outline" size={28} color={colors.ink} /><Text variant="heading" style={styles.flex}>{shopName}</Text></Card> : null}
      <Text variant="heading">When works for you?</Text>
      <View style={styles.days} accessibilityRole="radiogroup">{WHEN.map(day => <Pressable key={day} accessibilityRole="radio"
        accessibilityState={{ selected: day === when, disabled: busy }} disabled={busy} onPress={() => setWhen(day)}
        style={[styles.day, day === when && styles.selected]}><Ionicons name="calendar-outline" size={22} color={colors.ink} /><Text weight="bold">{day}</Text></Pressable>)}</View>
      <Field label="Your mobile number" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" editable={!busy} />
      <Card style={styles.details}>
        <View style={styles.fact}><Ionicons name="time-outline" size={24} color={colors.ink} /><Text style={styles.flex}>About 30 minutes at your shop</Text></View>
        <View style={styles.fact}><Ionicons name="call-outline" size={24} color={colors.ink} /><Text style={styles.flex}>The team confirms your agent and time</Text></View>
      </Card>
      {scope.isOffline ? <Text tone="muted">Reconnect to send your visit request.</Text> : null}
    </ScreenShell>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ flex: { flex: 1, minWidth: 0 }, content: { gap: space.lg },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }, day: { minHeight: 56, borderRadius: radius.field, backgroundColor: colors.card,
    paddingHorizontal: space.md, flexDirection: 'row', gap: space.sm, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  selected: { backgroundColor: colors.accentSoft, borderColor: colors.ink }, shop: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  details: { gap: space.md }, fact: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  success: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accent, alignSelf: 'center', justifyContent: 'center', alignItems: 'center' } });
