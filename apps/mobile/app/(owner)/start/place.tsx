import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, ScreenShell, Text } from '../../../components/v2';
import { Field } from '../../../components/v2/owner/OwnerUI';
import { CaptureLocationPicker, validCaptureCoordinates } from '../../../components/field-agent/CaptureLocationPicker';
import { sellKind, sellKindFromServer } from '../../../lib/v2/ownerContent';
import { useCreateDraft, useOwnerSubmission, useUpdateDraft } from '../../../lib/v2/ownerData';
import { ownerIntake, useOwnerIntake, type OwnerIntake } from '../../../lib/v2/ownerIntake';
import { STEP_ROUTE, startProgress } from '../../../lib/v2/ownerFlow';
import { ownerSiteRoute } from '../../../lib/v2/ownerNavigation';
import { useOwnerScope } from '../../../lib/v2/useOwnerScope';
import { colors, radius, space } from '../../../theme/v2';

type DetailKey = 'businessName' | 'address' | 'city' | 'coordinates';

export default function PlaceScreen() {
  const scope = useOwnerScope();
  return <PlaceForm key={scope.scopeKey} scope={scope} />;
}
function PlaceForm({ scope }: { scope: ReturnType<typeof useOwnerScope> }) {
  const router = useRouter();
  const intake = useOwnerIntake();
  const sub = useOwnerSubmission(scope.id);
  const ownSub = sub?.submissionId === scope.id ? sub : undefined;
  const local: OwnerIntake = scope.isNewBusiness || !intake.submissionId || intake.submissionId === scope.id ? intake : {};
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const [name, setName] = useState(local.businessName ?? ownSub?.businessName ?? '');
  const [address, setAddress] = useState(local.address ?? ownSub?.address ?? '');
  const [city, setCity] = useState(local.city ?? ownSub?.city ?? '');
  const [coords, setCoords] = useState(local.coordinates ?? ownSub?.coordinates ?? undefined);
  const [mapOpen, setMapOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const edited = useRef(new Set<DetailKey>(Array.isArray(local.detailsDirty) ? local.detailsDirty : []));
  const offline = useRef(scope.isOffline); offline.current = scope.isOffline;
  const latestOwner = useRef({ accountKey: scope.accountKey, me: scope.me });
  latestOwner.current = { accountKey: scope.accountKey, me: scope.me };
  const kind = sellKind(local.kind) ?? (ownSub ? sellKindFromServer(ownSub.businessType, ownSub.shotListKey) : undefined);
  useEffect(() => {
    if (!ownSub) return;
    if (!edited.current.has('businessName')) setName(ownSub.businessName);
    if (!edited.current.has('address')) setAddress(ownSub.address);
    if (!edited.current.has('city')) setCity(ownSub.city);
    if (!edited.current.has('coordinates')) setCoords(ownSub.coordinates ?? undefined);
  }, [ownSub]);
  const persist = (patch: Partial<Pick<typeof intake, DetailKey>>, fields: DetailKey[]) => {
    if (!scope.isCurrent() || inFlight.current || (scope.site && scope.site.phase !== 'draft')) return false;
    fields.forEach(field => edited.current.add(field));
    ownerIntake.set({ ...patch, detailsDirty: [...edited.current] });
    return true;
  };
  const next = async () => {
    if (inFlight.current || !scope.isCurrent() || scope.isOffline || (scope.site && scope.site.phase !== 'draft')) return;
    if (scope.id && !ownSub) return;
    const creating = !scope.id;
    if (creating && !scope.isNewBusiness && (!scope.me || scope.me.sites.length > 0)) return;
    if (!kind) { router.replace(STEP_ROUTE.sell as never); return; }
    if (!name.trim() || !address.trim()) return;
    inFlight.current = true; setBusy(true); setError(null);
    const fields = { businessType: kind.businessType, businessName: name.trim(), address: address.trim(), city: city.trim(),
      coordinates: validCaptureCoordinates(coords) ? coords : undefined, shotListKey: kind.shots };
    const workspace = ownerIntake.scope();
    const current = () => scope.isCurrent() && ownerIntake.isCurrent(workspace) && !offline.current
      && (creating || scope.isDraftCurrent());
    try {
      await ownerIntake.flush();
      if (!current()) return;
      const id = scope.id ?? await createDraft({ ...fields, clientDraftKey: local.newBusinessKey });
      if (!current()) return;
      const recovered = creating && latestOwner.current.accountKey === scope.accountKey
        ? latestOwner.current.me?.sites.find(site => site.submissionId === id) : undefined;
      if (recovered && recovered.phase !== 'draft') {
        // This key may already have completed on another device. Adopt its
        // server identity without applying the unfinished form to that site.
        ownerIntake.set({ submissionId: id, businessName: recovered.businessName, kind: undefined,
          address: undefined, city: undefined, coordinates: undefined, shots: undefined, design: undefined,
          detailsDirty: undefined, howConfirmedFor: undefined });
        const attached = ownerIntake.scope();
        await ownerIntake.flush();
        if (scope.isActorCurrent() && ownerIntake.isCurrent(attached) && ownerIntake.get().submissionId === id
          && !ownerIntake.get().newBusiness) router.replace(ownerSiteRoute(recovered) as never);
        return;
      }
      // A retried create can recover an earlier successful request. Apply the
      // current details before attaching that id, including edits made on retry.
      await updateDraft({ submissionId: id, ...fields });
      if (!current()) return;
      edited.current.clear();
      setName(fields.businessName); setAddress(fields.address); setCity(fields.city); setCoords(fields.coordinates);
      ownerIntake.set({ kind: kind.id, businessName: fields.businessName, address: fields.address, city: fields.city,
        coordinates: fields.coordinates, submissionId: id, detailsDirty: undefined,
        ...(creating ? { shots: undefined, design: undefined } : {}) });
      const attached = ownerIntake.scope();
      await ownerIntake.flush();
      if (scope.isActorCurrent() && ownerIntake.isCurrent(attached) && ownerIntake.get().submissionId === id
        && !ownerIntake.get().newBusiness) router.push(STEP_ROUTE.how as never);
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : 'Could not save your shop. Please try again.');
    } finally { inFlight.current = false; if (current()) setBusy(false); }
  };
  const hasPin = validCaptureCoordinates(coords);
  const region = hasPin ? { latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }
    : { latitude: 14.5995, longitude: 120.9842, latitudeDelta: 0.3, longitudeDelta: 0.3 };
  if (scope.site && scope.site.phase !== 'draft') return <ScreenShell title="Your shop details are saved"
    subtitle="To update your website, send a change request to the team."
    footer={<Button title="View my site" onPress={() => router.replace('/(owner)/(tabs)/site' as never)} />} />;
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenShell title="What's your shop called?" subtitle="And where is it?" progress={startProgress('place')}
      onBack={() => { if (!inFlight.current && scope.isCurrent()) router.dismissTo(STEP_ROUTE.sell as never); }} contentStyle={styles.content}
      footer={<Button title="Next" onPress={() => { void next(); }} loading={busy} disabled={scope.isOffline || (!!scope.id && !ownSub) || !name.trim() || !address.trim()} />}>
      <Field label="Shop name" icon="storefront-outline" value={name} onChangeText={value => { if (persist({ businessName: value }, ['businessName'])) setName(value); }} autoCapitalize="words" editable={!busy} />
      <Field label="Address" icon="location-outline" value={address} onChangeText={value => { if (persist({ address: value }, ['address'])) setAddress(value); }} autoCapitalize="words" editable={!busy} />
      <Field label="City" value={city} onChangeText={value => { if (persist({ city: value }, ['city'])) setCity(value); }} autoCapitalize="words" editable={!busy} />
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
      isCurrent={scope.isCurrent} onClose={() => setMapOpen(false)} onConfirm={location => {
        if (!scope.isCurrent()) return;
        if (!persist({ coordinates: location.coordinates, address: location.address, city: location.city }, ['coordinates', 'address', 'city'])) return;
        setCoords(location.coordinates); setAddress(location.address); setCity(location.city); setMapOpen(false);
      }} /> : null}
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { gap: space.lg },
  mapCard: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.card },
  map: { height: 180, backgroundColor: colors.bg2 }, mapLabel: { padding: space.md, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.sm } });
