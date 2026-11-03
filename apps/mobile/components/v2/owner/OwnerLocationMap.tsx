import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Banner, Button, Text } from '..';
import type { CaptureCoordinates } from '../../field-agent/CaptureLocationPicker';
import { validMapCoordinate, withLocationTimeout, type MapCoordinate } from '../../../services/workArea';
import { colors, radius, space } from '../../../theme/v2';

type Props = {
  coordinates?: CaptureCoordinates;
  disabled?: boolean;
  isOffline: boolean;
  isCurrent: () => boolean;
  required?: boolean;
  onChange: (coordinates: CaptureCoordinates) => void;
};
const FALLBACK = { latitude: 14.5995, longitude: 120.9842, latitudeDelta: 0.3, longitudeDelta: 0.3 };
const pointFor = (value?: CaptureCoordinates): MapCoordinate | null => value && validMapCoordinate({ latitude: value.lat, longitude: value.lng })
  ? { latitude: value.lat, longitude: value.lng } : null;
const regionFor = (point: MapCoordinate) => ({ ...point, latitudeDelta: 0.008, longitudeDelta: 0.008 });

/** A visible form field: a pin changes only location, never the owner's typed address. */
export function OwnerLocationMap(props: Props) {
  const initialPoint = pointFor(props.coordinates);
  const [initialRegion] = useState(() => initialPoint ? regionFor(initialPoint) : FALLBACK);
  const [locating, setLocating] = useState(false), [notice, setNotice] = useState('');
  const map = useRef<MapView>(null);
  const mounted = useRef(true), mapReady = useRef(false), touched = useRef(false), centered = useRef(!!initialPoint), gpsBusy = useRef(false), selectionVersion = useRef(0);
  const live = useRef(props); live.current = props;
  const current = useCallback(() => mounted.current && live.current.isCurrent() && !live.current.disabled, []);
  const point = pointFor(props.coordinates);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; selectionVersion.current += 1; }; }, []);
  const centerSavedPoint = useCallback(() => {
    // A saved draft can arrive after mount. Center it once, before the owner interacts.
    // Later taps and marker updates leave the owner's zoom and viewport alone.
    const saved = pointFor(live.current.coordinates);
    if (mapReady.current && !centered.current && !touched.current && saved && current()) {
      centered.current = true; map.current?.animateToRegion(regionFor(saved), 250);
    }
  }, [current]);
  useEffect(() => { centerSavedPoint(); }, [props.coordinates, centerSavedPoint]);
  const choose = (next: MapCoordinate) => {
    if (!current() || !validMapCoordinate(next)) return;
    Keyboard.dismiss(); touched.current = true; selectionVersion.current += 1; setNotice('');
    live.current.onChange({ lat: next.latitude, lng: next.longitude });
  };
  const locate = async () => {
    if (!current() || gpsBusy.current || live.current.isOffline) return;
    Keyboard.dismiss(); gpsBusy.current = true; setLocating(true); setNotice('');
    const version = selectionVersion.current;
    const stillCurrent = () => current() && !live.current.isOffline && selectionVersion.current === version;
    try {
      const permission = await withLocationTimeout(Location.requestForegroundPermissionsAsync());
      if (!stillCurrent()) return;
      if (permission.status !== 'granted') {
        setNotice('Location access is off. You can still tap the map to pin your shop.'); return;
      }
      const position = await withLocationTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
      if (!stillCurrent()) return;
      if (!validMapCoordinate(position.coords)) throw new Error('Invalid location');
      map.current?.animateToRegion(regionFor(position.coords), 250);
      choose({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      if (stillCurrent()) setNotice('Could not find your location. Tap the map to pin the shop instead.');
    } finally {
      gpsBusy.current = false;
      if (mounted.current) setLocating(false);
    }
  };
  return <View style={styles.card}>
    <View style={styles.heading}>
      <Text weight="bold">Shop location{props.required ? ' · Required' : ''}</Text>
      <Text variant="label" tone="muted">Tap the exact shop location. Drag the pin to adjust it.</Text>
    </View>
    <View style={styles.mapFrame}>
      <MapView ref={map} testID="owner-location-map" accessibilityLabel="Shop location map" style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined} initialRegion={initialRegion}
        scrollEnabled={!props.disabled} zoomEnabled={!props.disabled} rotateEnabled={false} pitchEnabled={false}
        showsUserLocation={false} showsMyLocationButton={false} onTouchStart={() => Keyboard.dismiss()}
        onMapReady={() => { mapReady.current = true; centerSavedPoint(); }}
        onPanDrag={() => { touched.current = true; selectionVersion.current += 1; Keyboard.dismiss(); }}
        onPress={event => choose(event.nativeEvent.coordinate)}>
        {point ? <Marker testID="owner-location-pin" coordinate={point} title="Your shop" draggable={!props.disabled}
          onDragEnd={event => choose(event.nativeEvent.coordinate)} /> : null}
      </MapView>
    </View>
    <View style={styles.actions}>
      <Text variant="label" tone="muted" accessibilityLiveRegion="polite">{point ? 'Shop pin added. Your written address stays unchanged.'
        : props.required ? 'Add a pin before sending your visit request.' : 'Add a pin to make your shop easier to find.'}</Text>
      <Button title="Use my current location" variant="ghost" size="md" disabled={props.disabled || props.isOffline}
        loading={locating} onPress={() => { void locate(); }} />
      {notice ? <Banner body={notice} /> : null}
      {props.isOffline ? <Text variant="label" tone="muted">Offline: map tiles may be unavailable. Your selected pin stays on this form.</Text> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.card },
  heading: { padding: space.md, gap: space.xs },
  mapFrame: { height: 250, backgroundColor: colors.bg2 }, map: { flex: 1 },
  actions: { padding: space.md, gap: space.sm },
});
