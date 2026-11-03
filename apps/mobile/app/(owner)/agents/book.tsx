import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, ScreenShell, Text } from '../../../components/v2';
import { Field } from '../../../components/v2/owner/OwnerUI';
import { useRequestVisit } from '../../../lib/v2/ownerData';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';
import { STEP_ROUTE } from '../../../lib/v2/ownerFlow';
import { colors, radius, space } from '../../../theme/v2';

const WHEN = ['Today', 'Tomorrow', 'This week'] as const;
export default function BookVisit() {
  const scope = useOwnerScope();
  const params = useLocalSearchParams<{ agent?: string; submissionId?: string }>();
  const submissionId = typeof params.submissionId === 'string' ? params.submissionId : null;
  return <VisitForm key={`${scope.scopeKey}:${submissionId ?? 'new-visit'}`} scope={scope} submissionId={submissionId}
    agent={typeof params.agent === 'string' ? params.agent : undefined} />;
}
function VisitForm({ scope, submissionId, agent }: { scope: ReturnType<typeof useOwnerScope>; submissionId: string | null; agent: string | undefined }) {
  const router = useRouter();
  const request = useRequestVisit();
  const selectedSite = submissionId && scope.id === submissionId && scope.site?.submissionId === submissionId
    && scope.me?.sites.some(site => site.submissionId === submissionId) ? scope.site : null;
  const [shopName, setShopName] = useState(selectedSite?.businessName ?? '');
  const [when, setWhen] = useState<(typeof WHEN)[number]>('Today');
  const [phone, setPhone] = useState(scope.me?.owner.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const cleanName = shopName.trim();
  const validName = !!cleanName && cleanName.length <= 120;
  const send = async () => {
    if (inFlight.current || !scope.isCurrent() || scope.isOffline || !validName || phone.replace(/\D/g, '').length < 7) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      await request({ name: scope.me?.owner.name?.trim() || 'Shop owner', phone: phone.trim(), email: scope.me?.owner.email,
        shopName: cleanName, when, agentName: agent });
      if (scope.isCurrent()) setSent(true);
    } catch (cause) { if (scope.isCurrent()) setError(cause instanceof Error ? cause.message : 'Could not send your request. Please try again.'); }
    finally { inFlight.current = false; if (scope.isCurrent()) setBusy(false); }
  };
  if (sent) return <ScreenShell title="Your visit request is sent" subtitle="The team will call you to confirm an agent and time."
    contentStyle={styles.content} footer={<Button title="Back to home" onPress={() => router.replace(STEP_ROUTE.home as never)} />}>
    <View style={styles.success}><Ionicons name="checkmark" size={48} color={colors.ink} /></View>
    <Card style={styles.details}><Text variant="heading">Visit request</Text>
      <Text weight="bold">{cleanName}</Text><Text tone="muted">Preferred: {when}</Text><Text tone="muted">We will call {phone}</Text>
      <Text tone="muted">A visit is confirmed after the team contacts you.</Text></Card>
  </ScreenShell>;
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenShell title="Request a shop visit" subtitle="A field agent takes photos and records your story with you."
      onBack={() => { if (!inFlight.current) router.back(); }} contentStyle={styles.content} footer={<>
        {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
        <Button title="Send request" onPress={() => { void send(); }} loading={busy} disabled={scope.isOffline || !validName || phone.replace(/\D/g, '').length < 7} />
      </>}>
      <View style={styles.shopName}>
        {selectedSite ? <Text variant="label" tone="muted">For this business</Text> : null}
        <Field label="Shop name" icon="storefront-outline" value={shopName} onChangeText={setShopName} maxLength={120}
          placeholder="Name of the shop to visit" autoCapitalize="words" editable={!busy} />
      </View>
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
  selected: { backgroundColor: colors.accentSoft, borderColor: colors.ink }, shopName: { gap: space.sm },
  details: { gap: space.md }, fact: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  success: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accent, alignSelf: 'center', justifyContent: 'center', alignItems: 'center' } });
