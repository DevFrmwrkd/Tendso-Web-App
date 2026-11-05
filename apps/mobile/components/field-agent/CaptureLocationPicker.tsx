import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Banner, Button, Field, ScreenShell, Text } from '../v2';
import { colors, radius, space } from '../../theme/v2';
import { validMapCoordinate, withLocationTimeout, type MapCoordinate } from '../../services/workArea';

export type CaptureCoordinates = { lat: number; lng: number };
export type CaptureLocation = { coordinates: CaptureCoordinates; address: string; city: string };

export function validCaptureCoordinates(value: CaptureCoordinates | null | undefined): value is CaptureCoordinates {
  return !!value && validMapCoordinate({ latitude: value.lat, longitude: value.lng });
}

type Props = {
  coordinates?: CaptureCoordinates;
  address: string;
  city: string;
  isOffline: boolean;
  isCurrent: () => boolean;
  onConfirm: (location: CaptureLocation) => void;
  onClose: () => void;
};
const FALLBACK = { latitude: 14.5995, longitude: 120.9842, latitudeDelta: 0.3, longitudeDelta: 0.3 };
const region = (point: MapCoordinate) => ({ ...point, latitudeDelta: 0.008, longitudeDelta: 0.008 });

/** A pin sets this capture's location; it never changes the source find. */
export function CaptureLocationPicker(props: Props) {
  const [point, setPoint] = useState<MapCoordinate | null>(() => validCaptureCoordinates(props.coordinates)
    ? { latitude: props.coordinates.lat, longitude: props.coordinates.lng } : null);
  const [address, setAddress] = useState(props.address);
  const [city, setCity] = useState(props.city);
  const [locating, setLocating] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [notice, setNotice] = useState('');
  const map = useRef<MapView>(null);
  const mounted = useRef(true);
  const closed = useRef(false);
  const lookupVersion = useRef(0);
  const gpsBusy = useRef(false);
  const addressEdits = useRef(0);
  const cityEdits = useRef(0);
  const live = useRef(props);
  live.current = props;
  const current = () => mounted.current && !closed.current && live.current.isCurrent();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // Center the map near a typed address when the OS can look it up. The result
  // is only a viewport: an approximate address match is never a confirmed pin.
  useEffect(() => {
    if (point || props.isOffline || !props.address.trim()) return;
    let active = true;
    const version = lookupVersion.current;
    void (async () => {
      try {
        if (Platform.OS === 'android' && (await Location.getForegroundPermissionsAsync()).status !== 'granted') return;
        const matches = await withLocationTimeout(Location.geocodeAsync(`${props.address}, ${props.city}`), 8000);
        if (active && current() && version === lookupVersion.current && validMapCoordinate(matches[0]))
          map.current?.animateToRegion(region(matches[0]), 250);
      } catch { /* A typed address and a manual pin still work without geocoding. */ }
    })();
    return () => { active = false; };
  }, []);

  const choose = async (next: MapCoordinate) => {
    if (!current() || !validMapCoordinate(next)) return;
    const version = ++lookupVersion.current;
    const addressVersion = addressEdits.current;
    const cityVersion = cityEdits.current;
    setPoint(next); setNotice(''); setLookingUp(false); setLocating(false);
    if (live.current.isOffline) return;
    setLookingUp(true);
    try {
      // Map taps do not prompt for GPS access. Android's OS geocoder requires
      // foreground permission; without it the address remains manually editable.
      if (Platform.OS === 'android' && (await Location.getForegroundPermissionsAsync()).status !== 'granted') {
        if (current() && version === lookupVersion.current) setNotice('Pin selected. Check the address and city below.');
        return;
      }
      if (!current() || version !== lookupVersion.current) return;
      const [place] = await withLocationTimeout(Location.reverseGeocodeAsync(next), 8000);
      if (!current() || version !== lookupVersion.current) return;
      const street = [place?.streetNumber, place?.street].filter(Boolean).join(' ');
      const foundAddress = [street, place?.district].filter(Boolean).join(', ');
      const foundCity = place?.city || place?.subregion || '';
      if (foundAddress && addressVersion === addressEdits.current) setAddress(foundAddress);
      if (foundCity && cityVersion === cityEdits.current) setCity(foundCity);
      setNotice(foundAddress && foundCity ? 'Check the suggested address before confirming.'
        : 'Pin selected. Add or check the address and city below.');
    } catch {
      if (current() && version === lookupVersion.current) setNotice('Address lookup is unavailable. Your pin is selected; enter the address below.');
    } finally {
      if (current() && version === lookupVersion.current) setLookingUp(false);
    }
  };

  const locate = async () => {
    if (!current() || gpsBusy.current) return;
    gpsBusy.current = true; setLocating(true); setNotice('');
    const version = lookupVersion.current;
    try {
      const permission = await withLocationTimeout(Location.requestForegroundPermissionsAsync());
      if (!current() || version !== lookupVersion.current) return;
      if (permission.status !== 'granted') {
        setNotice('Location access is off. You can still tap the map to place the shop pin.'); return;
      }
      const location = await withLocationTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
      if (!current() || version !== lookupVersion.current) return;
      if (!validMapCoordinate(location.coords)) throw new Error('Invalid location');
      map.current?.animateToRegion(region(location.coords), 250);
      await choose({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    } catch {
      if (current() && version === lookupVersion.current) setNotice('Could not get your location. Tap the map to choose the shop instead.');
    } finally {
      gpsBusy.current = false;
      if (current()) setLocating(false);
    }
  };
  const close = () => {
    if (!current()) return;
    closed.current = true;
    live.current.onClose();
  };
  const confirm = () => {
    if (!current() || locating || lookingUp || !validMapCoordinate(point) || !address.trim() || !city.trim()) return;
    closed.current = true;
    live.current.onConfirm({ coordinates: { lat: point.latitude, lng: point.longitude }, address: address.trim(), city: city.trim() });
  };

  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenShell title="Shop location" subtitle="Tap the shop on the map. Hold and drag the pin to adjust it."
        onBack={close} contentStyle={styles.content}
        footer={<Button title="Use this location" onPress={confirm}
          disabled={!point || !address.trim() || !city.trim() || lookingUp || locating} />}>
        <View style={styles.mapFrame}>
          <MapView ref={map} testID="capture-location-map" style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={point ? region(point) : FALLBACK}
            onPress={(event) => { void choose(event.nativeEvent.coordinate); }}
            showsUserLocation={false} showsMyLocationButton={false}>
            {point ? <Marker testID="capture-location-pin" coordinate={point} title="Shop location" draggable
              onDragEnd={(event) => { void choose(event.nativeEvent.coordinate); }} /> : null}
          </MapView>
        </View>
        <Button title="Use my current location" variant="ghost" loading={locating} onPress={() => { void locate(); }} />
        {props.isOffline ? <Banner tone="warn" body="Offline: map tiles may be unavailable. Your pin and address will be saved on this phone." /> : null}
        {lookingUp ? <Text variant="label" tone="muted">Looking up the address…</Text> : null}
        {notice ? <Banner body={notice} /> : null}
        <Field label="Shop address" placeholder="Street and barangay" value={address} autoCapitalize="words"
          onChangeText={(value) => { addressEdits.current += 1; setAddress(value); }} />
        <Field label="Shop city" placeholder="City or municipality" value={city} autoCapitalize="words"
          onChangeText={(value) => { cityEdits.current += 1; setCity(value); }} />
        <Text variant="label" tone="muted">Keep or correct the address before using this pin.</Text>
      </ScreenShell>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.md },
  mapFrame: { height: 270, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.bg2 },
  map: { flex: 1 },
});
