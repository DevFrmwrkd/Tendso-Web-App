/** Start 2/3 — the shop's name and where it is (mock owner board "q2"). Creates the draft. */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Button, ScreenShell, Text } from '../../../components/v2';
import { Field } from '../../../components/v2/owner/OwnerUI';
import { sellKind } from '../../../lib/v2/ownerContent';
import { useCreateDraft, useUpdateDraft } from '../../../lib/v2/ownerData';
import { ownerIntake, useOwnerIntake } from '../../../lib/v2/ownerIntake';
import { STEP_ROUTE, startProgress } from '../../../lib/v2/ownerFlow';
import { useOwnerSite } from '../../../lib/v2/useOwnerSite';
import { colors, radius, space } from '../../../theme/v2';

export default function PlaceScreen() {
  const router = useRouter();
  const intake = useOwnerIntake();
  const { site } = useOwnerSite();
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const [name, setName] = useState(intake.businessName ?? '');
  const [address, setAddress] = useState(intake.address ?? '');
  const [city, setCity] = useState(intake.city ?? '');
  const [coords, setCoords] = useState(intake.coordinates);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind = sellKind(intake.kind);

  const locate = async () => {
    setLocating(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setError('Type the address instead.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(c);
      const [place] = await Location.reverseGeocodeAsync({ latitude: c.lat, longitude: c.lng });
      if (place) {
        const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
        const line = [street || place.name, place.district].filter(Boolean).join(', ');
        if (line) setAddress(line);
        if (place.city || place.subregion) setCity(place.city || place.subregion || '');
      }
    } catch {
      setError('We could not find you. Type the address instead.');
    } finally {
      setLocating(false);
    }
  };

  const next = async () => {
    if (!kind) {
      router.replace(STEP_ROUTE.sell as never);
      return;
    }
    setBusy(true);
    setError(null);
    const fields = {
      businessType: kind.businessType,
      businessName: name.trim(),
      address: address.trim(),
      city: city.trim(),
      coordinates: coords,
      shotListKey: kind.shots,
    };
    try {
      let id = site?.phase === 'draft' ? site.submissionId : undefined;
      if (id) await updateDraft({ submissionId: id, ...fields });
      else id = await createDraft(fields);
      ownerIntake.set({ businessName: fields.businessName, address: fields.address, city: fields.city, coordinates: coords, submissionId: id });
      router.push(STEP_ROUTE.how as never);
    } catch (e: any) {
      setError(e?.data ?? e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenShell
        title="What's your shop called?"
        subtitle="And where is it?"
        progress={startProgress('place')}
        onBack={() => router.back()}
        footer={<Button title="Next" onPress={next} loading={busy} disabled={!name.trim() || (!address.trim() && !coords)} />}
      >
        <View style={{ gap: space.lg }}>
          <Field label="Shop name" icon="storefront-outline" value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="next" />
          <Field label="Address" icon="location-outline" value={address} onChangeText={setAddress} autoCapitalize="words" />
          <Pressable
            onPress={locate}
            accessibilityRole="button"
            accessibilityLabel="Use my location"
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.bg2 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name={coords ? 'checkmark-circle' : 'locate'} size={22} color={colors.ink} />
            <Text weight="bold">{locating ? 'Finding you…' : coords ? 'Location added' : 'Use my location'}</Text>
          </Pressable>
          {error ? <Text tone="danger">{error}</Text> : null}
        </View>
      </ScreenShell>
    </KeyboardAvoidingView>
  );
}
