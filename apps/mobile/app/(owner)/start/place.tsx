import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, ScreenShell, Text } from '../../../components/v2';
import { Field } from '../../../components/v2/owner/OwnerUI';
import { CaptureLocationPicker, validCaptureCoordinates } from '../../../components/field-agent/CaptureLocationPicker';
import { sellKind } from '../../../lib/v2/ownerContent';
import { useCreateDraft, useUpdateDraft } from '../../../lib/v2/ownerData';
import { ownerIntake, useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { STEP_ROUTE, startProgress } from '../../../lib/v2/ownerFlow';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';
import { colors, radius, space } from '../../../theme/v2';

export default function PlaceScreen() {
  const scope = useOwnerScope();
  return <PlaceForm key={scope.accountKey} scope={scope} />;
}
function PlaceForm({ scope }: { scope: ReturnType<typeof useOwnerScope> }) {
  const router = useRouter();
  const intake = useOwnerIntake();
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const [name, setName] = useState(intake.businessName ?? '');
  const [address, setAddress] = useState(intake.address ?? '');
  const [city, setCity] = useState(intake.city ?? '');
  const [coords, setCoords] = useState(intake.coordinates);
  const [mapOpen, setMapOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const kind = sellKind(intake.kind);
  const next = async () => {
    if (inFlight.current || !scope.isAccountCurrent() || scope.isOffline || (scope.site && scope.site.phase !== 'draft')) return;
    if (!kind) { router.replace(STEP_ROUTE.sell as never); return; }
    if (!name.trim() || !address.trim()) return;
    inFlight.current = true; setBusy(true); setError(null);
    const fields = { businessType: kind.businessType, businessName: name.trim(), address: address.trim(), city: city.trim(),
      coordinates: validCaptureCoordinates(coords) ? coords : undefined, shotListKey: kind.shots };
    try {
      let id = scope.site?.phase === 'draft' ? scope.site.submissionId : undefined;
      if (id) await updateDraft({ submissionId: id, ...fields });
      else id = await createDraft(fields);
      if (!scope.isAccountCurrent()) return;
      ownerIntake.set({ businessName: fields.businessName, address: fields.address, city: fields.city, coordinates: fields.coordinates, submissionId: id,
        ...(intake.submissionId !== id ? { shots: undefined, design: undefined } : {}) });
      router.push(STEP_ROUTE.how as never);
    } catch (cause) {
      if (scope.isAccountCurrent()) setError(cause instanceof Error ? cause.message : 'Could not save your shop. Please try again.');
    } finally { inFlight.current = false; if (scope.isAccountCurrent()) setBusy(false); }
  };
  const hasPin = validCaptureCoordinates(coords);
  const region = hasPin ? { latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }
    : { latitude: 14.5995, longitude: 120.9842, latitudeDelta: 0.3, longitudeDelta: 0.3 };
  if (scope.site && scope.site.phase !== 'draft') return <ScreenShell title="Your shop details are saved"
    subtitle="To update your website, send a change request to the team."
    footer={<Button title="View my site" onPress={() => router.replace('/(owner)/(tabs)/site' as never)} />} />;
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenShell title="What's your shop called?" subtitle="And where is it?" progress={startProgress('place')}
      onBack={() => { if (!inFlight.current) router.back(); }} contentStyle={styles.content}
      footer={<Button title="Next" onPress={() => { void next(); }} loading={busy} disabled={scope.isOffline || !name.trim() || !address.trim()} />}>
      <Field label="Shop name" icon="storefront-outline" value={name} onChangeText={setName} autoCapitalize="words" editable={!busy} />
      <Field label="Address" icon="location-outline" value={address} onChangeText={setAddress} autoCapitalize="words" editable={!busy} />
      <Field label="City" value={city} onChangeText={setCity} autoCapitalize="words" editable={!busy} />
      <Pressable accessibilityRole="button" accessibilityLabel={hasPin ? 'Adjust shop location on map' : 'Choose shop location on map'}
        disabled={busy} onPress={() => setMapOpen(true)} style={styles.mapCard}>
        <View style={styles.map} pointerEvents="none">
          <MapView key={hasPin ? `${coords.lat}:${coords.lng}` : 'unplaced'} style={styles.flex} initialRegion={region}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined} scrollEnabled={false} zoomEnabled={false}
            rotateEnabled={false} pitchEnabled={false} showsUserLocation={false}>
            {hasPin ? <Marker coordinate={{ latitude: coords.lat, longitude: coords.lng }} title="Your shop" /> : null}
          </MapView>
        </View>
        <View style={styles.mapLabel}><Ionicons name="location-outline" size={22} color={colors.ink} />
          <Text weight="bold" style={styles.flex}>{hasPin ? 'Shop pin added · tap to adjust' : 'Tap the map to pin your shop'}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.ink3Text} /></View>
      </Pressable>
      {scope.isOffline ? <Text tone="muted">Reconnect to save your shop details.</Text> : null}
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
    </ScreenShell>
    {mapOpen ? <CaptureLocationPicker coordinates={coords} address={address} city={city} isOffline={scope.isOffline}
      isCurrent={scope.isAccountCurrent} onClose={() => setMapOpen(false)} onConfirm={location => {
        if (!scope.isAccountCurrent()) return;
        setCoords(location.coordinates); setAddress(location.address); setCity(location.city); setMapOpen(false);
      }} /> : null}
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { gap: space.lg },
  mapCard: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.card },
  map: { height: 180, backgroundColor: colors.bg2 }, mapLabel: { padding: space.md, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.sm } });
