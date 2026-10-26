import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useAction, useMutation } from 'convex/react';
import { api, type Doc } from '@tendso/convex-client';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { FieldAgentWorkspace } from '../../../components/field-agent/FieldAgentWorkspace';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { Banner, Button, ChoiceChip, Field, ScreenShell, Text, ToggleRow } from '../../../components/v2';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { useWorkAreaLocation } from '../../../hooks/useWorkAreaLocation';
import { validMapCoordinate, type MapCoordinate } from '../../../services/workArea';
import { colors, hit, radius, space } from '../../../theme/v2';
import type { FindKind } from '../../../services/fieldAgentMap';

const KINDS: { key: FindKind; label: string }[] = [
  { key: 'food', label: 'Food' }, { key: 'sari_sari', label: 'Sari-sari' },
  { key: 'beauty', label: 'Beauty' }, { key: 'repair', label: 'Repair' }, { key: 'other', label: 'Other' },
];

export default function SpotShopScreen() {
  return <FieldAgentWorkspace preserveDraftWhileDisconnected>{(creator) => <SpotShopForm creator={creator} />}</FieldAgentWorkspace>;
}

function SpotShopForm({ creator }: { creator: Doc<'creators'> }) {
  const router = useGuardedRouter();
  const { account, isAuthenticated, isOffline } = useMobileAccount();
  const { area, currentLocation, requestCurrentLocation, isLocating } = useWorkAreaLocation();
  const createFind = useMutation(api.leads.createCommunityFind);
  const uploadUrl = useAction(api.r2.generateUploadUrl);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FindKind | null>(null);
  const [needsWebsite, setNeedsWebsite] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [point, setPoint] = useState<MapCoordinate | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(creator.workCity ?? '');
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const pickerBusy = useRef(false);
  const mounted = useRef(true);
  const preferGPS = useRef(true);
  const requestId = useRef(`find-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  const uploaded = useRef<{ local: string; publicUrl: string } | null>(null);
  const live = useRef({ id: account?._id, authenticated: isAuthenticated, offline: isOffline });
  live.current = { id: account?._id, authenticated: isAuthenticated, offline: isOffline };
  const isCurrent = () => mounted.current && live.current.id === creator._id
    && live.current.authenticated && !live.current.offline;
  const canWrite = account?._id === creator._id && isAuthenticated && !isOffline;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (preferGPS.current && validMapCoordinate(currentLocation)) {
      preferGPS.current = false;
      setPoint(currentLocation);
    }
  }, [currentLocation]);

  const pick = async (camera: boolean) => {
    if (busy.current || pickerBusy.current || !isCurrent()) return;
    pickerBusy.current = true; setPicking(true); setError('');
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!isCurrent()) return;
      if (permission.status !== 'granted') {
        setError(camera ? 'Allow camera access to take a shop photo, or choose one from your library.' : 'Allow photo access to choose a shop photo.');
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!isCurrent() || result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const scale = Math.min(1, 1600 / Math.max(asset.width, asset.height));
      const normalized = await ImageManipulator.manipulate(asset.uri)
        .resize({ width: Math.max(1, Math.round(asset.width * scale)), height: Math.max(1, Math.round(asset.height * scale)) })
        .renderAsync();
      const output = await normalized.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      if (isCurrent()) { setPhoto(output.uri); uploaded.current = null; }
    } catch {
      if (isCurrent()) setError('Could not prepare that photo. Please try another photo.');
    } finally {
      pickerBusy.current = false;
      if (mounted.current) setPicking(false);
    }
  };
  const choosePhoto = () => Alert.alert(photo ? 'Change shop photo' : 'Shop photo', 'Show the shop clearly.', [
    { text: 'Take photo', onPress: () => { void pick(true); } },
    { text: 'Choose photo', onPress: () => { void pick(false); } },
    { text: 'Cancel', style: 'cancel' },
  ]);
  const save = async () => {
    if (busy.current || pickerBusy.current || !isCurrent()) return;
    if (!name.trim() || !kind || !photo || !validMapCoordinate(point)) {
      setError('Add a photo, shop name, kind and an exact map pin before saving.'); return;
    }
    busy.current = true; setSaving(true); setError('');
    try {
      let publicUrl = uploaded.current?.local === photo ? uploaded.current.publicUrl : null;
      if (!publicUrl) {
        const target = await uploadUrl({ folder: 'community', filename: `${requestId.current}.jpg`, contentType: 'image/jpeg' });
        if (!isCurrent()) return;
        const response = await fetch(photo);
        const body = await response.blob();
        if (!isCurrent()) return;
        const put = await fetch(target.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body });
        if (!put.ok) throw new Error('Photo upload failed. Please try again.');
        if (!isCurrent()) return;
        publicUrl = target.publicUrl;
        uploaded.current = { local: photo, publicUrl };
      }
      const leadId = await createFind({ businessName: name.trim(), kind, photoUrl: publicUrl,
        needsWebsite, ...point, address: address.trim() || undefined, city: city.trim() || undefined,
        clientRequestId: requestId.current });
      if (isCurrent()) router.replace(`/(app)/leads/${leadId}` as never);
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : 'Could not save this find. Please try again.');
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const center = point ?? area ?? { latitude: 14.5995, longitude: 120.9842 };
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScreenShell title="Spot a shop" subtitle="Take a photo and share it with the team." onBack={() => router.back()}
      contentStyle={styles.content} footer={<Button title="Save find" onPress={() => { void save(); }} loading={saving}
        disabled={saving || picking || !name.trim() || !kind || !photo || !point || !canWrite} />}>
      {isOffline ? <OfflineBanner /> : !canWrite ? (
        <Banner tone="neutral" title="Reconnecting your account" body="Your draft stays here. You can save when your account reconnects." />
      ) : null}
      {error ? <Banner tone="danger" body={error} /> : null}
      <Pressable onPress={choosePhoto} disabled={saving || picking || !canWrite} accessibilityRole="button"
        accessibilityLabel={photo ? 'Change shop photo' : 'Add shop photo'} style={styles.photo}>
        {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={styles.photoPrompt}><Ionicons name="camera-outline" size={40} color={colors.ink} /><Text variant="bodyLg" weight="bold">{picking ? 'Preparing photo…' : 'Add a shop photo'}</Text></View>}
        {photo ? <View style={styles.retake}><Ionicons name="camera-outline" size={20} color={colors.ink} /><Text variant="label">Change photo</Text></View> : null}
      </Pressable>
      <Field label="Shop name" icon="storefront-outline" placeholder="What is the shop called?" value={name} onChangeText={setName} maxLength={120} editable={!saving} />
      <Text variant="label" tone="muted">Kind of shop</Text>
      <View style={styles.kinds}>{KINDS.map((item) => <ChoiceChip key={item.key} label={item.label} selected={kind === item.key}
        onPress={() => { if (!saving) setKind(item.key); }} disabled={saving} />)}</View>
      <ToggleRow title="Needs a site" subtitle="No website, or only a social media page." value={needsWebsite} onValueChange={setNeedsWebsite} disabled={saving} />
      <Text variant="label" tone="muted">Pin the shop</Text>
      <Text variant="body" tone="ink2">Tap the map at the shop, or use your location while standing there.</Text>
      <MapView style={styles.map} provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        region={{ latitude: center.latitude, longitude: center.longitude, latitudeDelta: !point && !area ? 0.5 : 0.008, longitudeDelta: !point && !area ? 0.5 : 0.008 }}
        showsUserLocation={!!currentLocation} showsMyLocationButton={false}
        onPress={(event) => { if (!saving && validMapCoordinate(event.nativeEvent.coordinate)) { preferGPS.current = false; setPoint(event.nativeEvent.coordinate); } }}
        accessibilityLabel="Tap to pin the shop location">
        {point ? <Marker coordinate={point} title={name.trim() || 'Shop location'} /> : null}
      </MapView>
      <Button variant="ghost" size="md" icon="locate-outline" title={isLocating ? 'Finding your location…' : 'Use my location'}
        disabled={saving || isLocating || !canWrite} onPress={() => { preferGPS.current = true; void requestCurrentLocation(); }} />
      {point ? <Text variant="label" tone="ink2">Shop location pinned.</Text>
        : <Text variant="label" tone="ink2">Tap the map or use your location to set the shop pin.</Text>}
      <Field label="Address (optional)" value={address} onChangeText={setAddress} placeholder="Street or landmark" maxLength={240} editable={!saving} />
      <Field label="City (optional)" value={city} onChangeText={setCity} placeholder="City or municipality" maxLength={100} editable={!saving} />
    </ScreenShell>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { gap: space.md },
  photo: { height: 204, backgroundColor: colors.card, borderRadius: radius.cardLg, overflow: 'hidden' },
  photoPrompt: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.sm },
  retake: { position: 'absolute', right: space.md, bottom: space.md, minHeight: hit.min, paddingHorizontal: space.md,
    flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.card, borderRadius: radius.pill },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  map: { height: 180, borderRadius: radius.card },
});
