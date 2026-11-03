import React, { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Button, Card, Field, ScreenShell, Text } from '../../../components/v2';
import { CaptureLocationPicker, type CaptureCoordinates } from '../../../components/field-agent/CaptureLocationPicker';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';
import { useCreateVisitRequest, useVisitOperation, validVisitPhone, validVisitPin } from '../../../lib/v2/visitRequests';
import { colors, radius, space } from '../../../theme/v2';

const WHEN = ['Today', 'Tomorrow', 'This week'] as const;
export default function BookVisit() {
  const scope = useOwnerScope();
  const params = useLocalSearchParams<{ submissionId?: string }>();
  const submissionId = typeof params.submissionId === 'string' ? params.submissionId : null;
  return <VisitForm key={`${scope.scopeKey}:${submissionId ?? 'new-visit'}`} scope={scope} submissionId={submissionId} />;
}
function VisitForm({ scope, submissionId }: { scope: ReturnType<typeof useOwnerScope>; submissionId: string | null }) {
  const router = useRouter();
  const create = useCreateVisitRequest();
  const operation = useVisitOperation(`${scope.scopeKey}:${submissionId ?? 'new-visit'}`);
  const selectedSite = submissionId && scope.id === submissionId && scope.site?.submissionId === submissionId
    && scope.me?.sites.some(site => site.submissionId === submissionId) ? scope.site : null;
  const [shopName, setShopName] = useState(selectedSite?.businessName ?? '');
  const [address, setAddress] = useState(''), [city, setCity] = useState('');
  const [coordinates, setCoordinates] = useState<CaptureCoordinates>();
  const [when, setWhen] = useState<(typeof WHEN)[number]>('Today');
  const [phone, setPhone] = useState(scope.me?.owner.phone ?? '');
  const [mapOpen, setMapOpen] = useState(false);
  const requestKey = useRef<string | null>(null);
  const valid = shopName.trim().length >= 2 && shopName.trim().length <= 120 && address.trim().length >= 3
    && address.trim().length <= 300 && city.trim().length >= 2 && city.trim().length <= 120 && validVisitPin(coordinates) && validVisitPhone(phone);
  const current = () => scope.isCurrent() && operation.isCurrent();
  const send = () => {
    if (!valid || !coordinates || mapOpen || !current() || scope.isOffline) return;
    Keyboard.dismiss();
    if (!requestKey.current) requestKey.current = Crypto.randomUUID();
    void operation.run(() => create({ requestKey: requestKey.current!, ...(selectedSite ? { submissionId: selectedSite.submissionId } : {}),
      shopName: shopName.trim(), ownerName: scope.me?.owner.name?.trim() || 'Shop owner', phone: phone.trim(), email: scope.me?.owner.email,
      address: address.trim(), city: city.trim(), coordinates, preferredWhen: when }), result => {
      if (current() && result.ownerId === scope.me?.owner._id) router.replace({ pathname: '/(owner)/agents/[visitId]', params: { visitId: result._id } } as never);
    });
  };
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenShell title="Request a shop visit" subtitle="Tell us where to visit. The team arranges a field agent and a proposed time."
      onBack={() => { if (!operation.busy) { Keyboard.dismiss(); router.back(); } }} contentStyle={styles.content} footer={<>
        {operation.error ? <Text tone="danger" accessibilityRole="alert">{operation.error}</Text> : null}
        <Button title="Send request" onPress={send} loading={operation.busy} disabled={scope.isOffline || !valid || mapOpen} />
      </>}>
      {selectedSite ? <Text variant="label" tone="muted">For this business</Text> : null}
      <Field label="Shop name" icon="storefront-outline" value={shopName} onChangeText={setShopName} maxLength={120}
        placeholder="Name of the shop to visit" autoCapitalize="words" editable={!operation.busy} />
      <Field label="Shop address" icon="location-outline" value={address} onChangeText={setAddress} maxLength={300}
        placeholder="Street, building or landmark" editable={!operation.busy} />
      <Field label="City or municipality" value={city} onChangeText={setCity} maxLength={120} autoCapitalize="words" editable={!operation.busy} />
      <Pressable accessibilityRole="button" accessibilityLabel={coordinates ? 'Adjust shop pin' : 'Choose shop pin'} disabled={operation.busy}
        style={styles.pin} onPress={() => { if (current()) { Keyboard.dismiss(); setMapOpen(true); } }}>
        <Ionicons name="map-outline" size={28} color={colors.ink} /><View style={styles.flex}>
          <Text weight="bold">{coordinates ? 'Shop pin added' : 'Pin the shop on the map'}</Text>
          <Text tone="muted">{coordinates ? 'Tap to adjust the exact location.' : 'Required so the field agent can find you.'}</Text>
        </View><Ionicons name="chevron-forward" size={20} color={colors.ink3Text} />
      </Pressable>
      {coordinates && !validVisitPin(coordinates) ? <Text tone="danger">Choose a shop location in the Philippines.</Text> : null}
      <Text variant="heading">When works for you?</Text>
      <View style={styles.days} accessibilityRole="radiogroup">{WHEN.map(day => <Pressable key={day} accessibilityRole="radio"
        accessibilityState={{ selected: day === when, disabled: operation.busy }} disabled={operation.busy} onPress={() => setWhen(day)}
        style={[styles.day, day === when && styles.selected]}><Ionicons name="calendar-outline" size={22} color={colors.ink} /><Text weight="bold">{day}</Text></Pressable>)}</View>
      <Field label="Your mobile number" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel"
        textContentType="telephoneNumber" editable={!operation.busy} helper="A Philippine mobile number." />
      <Banner title="A request, then a confirmation" body="Your preferred day is not a booking. The visit is confirmed after an assigned field agent accepts the proposed time." />
      {scope.isOffline ? <Text tone="muted">Reconnect to send your visit request.</Text> : null}
      <Card><Text tone="muted">Your address and contact details are shared with the Tendso team and the assigned field agent.</Text></Card>
    </ScreenShell>
    {mapOpen ? <CaptureLocationPicker coordinates={coordinates} address={address} city={city} isOffline={scope.isOffline} isCurrent={current}
      onClose={() => { if (current()) setMapOpen(false); }} onConfirm={location => {
        if (!current()) return; setCoordinates(location.coordinates); setAddress(location.address); setCity(location.city); setMapOpen(false);
      }} /> : null}
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ flex: { flex: 1, minWidth: 0 }, content: { gap: space.lg }, days: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  day: { minHeight: 56, borderRadius: radius.field, backgroundColor: colors.card, paddingHorizontal: space.md, flexDirection: 'row', gap: space.sm,
    alignItems: 'center', borderWidth: 2, borderColor: 'transparent' }, selected: { backgroundColor: colors.accentSoft, borderColor: colors.ink },
  pin: { flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.lg, backgroundColor: colors.card, borderRadius: radius.card } });
