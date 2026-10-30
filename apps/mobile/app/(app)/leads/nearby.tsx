import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  Linking,
  Platform,
  BackHandler,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { useWorkAreaLocation } from '../../../hooks/useWorkAreaLocation';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, type MapViewProps, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors, radius, shadow, space } from '../../../theme/v2';
import { Avatar, Banner, Button, Chip, Loading, Text, TextLink, leadStatus } from '../../../components/v2';
import { openDirections } from '../../../services/links';
import { mapDistanceLabel, validMapCoordinate } from '../../../services/workArea';
import { ShopImage } from '../../../components/ShopImage';

type GeocodedLead = {
  leadId: string;
  businessName: string;
  businessAddress: string | null;
  businessCity: string | null;
  ownerPhone: string | null;
  status: string;
  isHot: boolean;
  isMine: boolean;
  photoUrl: string | null;
  category: string | null;
  kind: string | null;
  submitterName: string | null;
  submitterImage: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  distanceLabel: string;
};

// Manila as a sensible fallback when GPS is unavailable
const FALLBACK_REGION: Region = {
  latitude: 14.5995,
  longitude: 120.9842,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

// Quiet map (mock `.cc-map`): land #E9E9E3, roads white, water #D3DCE3, no POI clutter.
// Applies to the Google provider (Android). iOS keeps Apple Maps with `mutedStandard`.
const QUIET_MAP_STYLE: NonNullable<MapViewProps['customMapStyle']> = [
  { elementType: 'geometry', stylers: [{ color: '#E9E9E3' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B6A63' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#E9E9E3' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D3DCE3' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6B6A63' }] },
];

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const v = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(v)));
}

function fullAddress(lead: { businessAddress: string | null; businessCity: string | null }): string | null {
  const parts = [lead.businessAddress, lead.businessCity].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(', ') : null;
}

/** Live (a built site) or yours = accent ring; everything else still needs a site = dashed ring. */
function isLiveOrYours(lead: { status: string; isMine: boolean }): boolean {
  return lead.status === 'converted' || lead.isMine;
}

/**
 * Custom map markers are snapshotted to a bitmap. Track view changes briefly (and again
 * when the photo arrives or the pin is selected), then stop so the map stays smooth.
 */
function useBriefTracking(key: string): boolean {
  const [track, setTrack] = useState(true);
  useEffect(() => {
    setTrack(true);
    const t = setTimeout(() => setTrack(false), 700);
    return () => clearTimeout(t);
  }, [key]);
  return track;
}

const PIN = 50;
const PIN_SELECTED = 64;
const LABEL_W = 220;
const LABEL_H = 36;
const HALO = 88;
const SEL_TOP = (HALO - PIN_SELECTED) / 2; // room for the halo above the pin
const SEL_H = SEL_TOP + PIN_SELECTED + SEL_TOP + 6 + LABEL_H;

function ShopPin({
  lead,
  selected,
  onPress,
}: {
  lead: GeocodedLead;
  selected: boolean;
  onPress: () => void;
}) {
  const [imageRevision, setImageRevision] = useState(0);
  const track = useBriefTracking(`${selected}-${lead.photoUrl ?? ''}-${lead.category ?? ''}-${lead.kind ?? ''}-${imageRevision}`);
  const imageFinished = useCallback(() => setImageRevision(value => value + 1), []);
  const live = isLiveOrYours(lead);
  const size = selected ? PIN_SELECTED : PIN;

  const photo = (box: number) => (
    <View style={[styles.photo, { width: box, height: box, borderRadius: box / 2 }]}>
      <ShopImage uri={lead.photoUrl} name={lead.businessName} category={lead.category} kind={lead.kind} width={box} height={box} borderRadius={box / 2}
        decorative onLoad={imageFinished} onError={imageFinished} />
    </View>
  );

  let circle: React.ReactNode;
  if (selected) {
    circle = (
      <View style={[styles.ringBase, { width: size, height: size, borderRadius: size / 2, borderWidth: 4, borderColor: colors.ink }]}>
        {photo(size - 8)}
      </View>
    );
  } else if (live) {
    // accent ring with an ink hairline outside
    circle = (
      <View style={[styles.ringBase, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.ink }]}>
        <View style={[styles.ringBase, { width: size - 3, height: size - 3, borderRadius: (size - 3) / 2, backgroundColor: colors.accent }]}>
          {photo(size - 11)}
        </View>
      </View>
    );
  } else {
    // dashed ink ring = needs a site
    circle = (
      <View
        style={[
          styles.ringBase,
          { width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderStyle: 'dashed', borderColor: colors.ink, backgroundColor: colors.card },
        ]}
      >
        {photo(size - 10)}
      </View>
    );
  }

  const label = `${lead.businessName}${lead.distanceKm != null ? ` · ${lead.distanceLabel}` : ''}`;

  return (
    <Marker
      coordinate={{ latitude: lead.latitude, longitude: lead.longitude }}
      onPress={onPress}
      anchor={selected ? { x: 0.5, y: (SEL_TOP + PIN_SELECTED / 2) / SEL_H } : { x: 0.5, y: 0.5 }}
      tracksViewChanges={track}
      zIndex={selected ? 3 : 2}
    >
      {selected ? (
        <View style={{ width: LABEL_W, height: SEL_H, alignItems: 'center' }}>
          <View style={[styles.halo, { top: 0, width: HALO, height: HALO, borderRadius: HALO / 2 }]} />
          <View style={{ marginTop: SEL_TOP }}>{circle}</View>
          <View style={styles.pinLabel}>
            <Text variant="label" weight="bold" tone="onDark" numberOfLines={1}>
              {label}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ width: size, height: size }}>{circle}</View>
      )}
    </Marker>
  );
}

/** Your location: ink dot, white edge, soft halo (mock `.cc-me`). */
function MeDot({ coordinate }: { coordinate: { latitude: number; longitude: number } }) {
  const track = useBriefTracking('me');
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={track} zIndex={1} tappable={false}>
      <View style={styles.meHalo}>
        <View style={styles.meDot} />
      </View>
    </Marker>
  );
}

function ShopTile({ uri, name, category, kind, width, height }: { uri: string | null; name: string; category: string | null; kind: string | null; width: number; height: number }) {
  return (
    <View
      style={[styles.tile, { width, height }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <ShopImage uri={uri} name={name} category={category} kind={kind} width="100%" height="100%" borderRadius={0} decorative />
    </View>
  );
}

export default function NearbyLeadsScreen() {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);

  // Skip until Convex has an authenticated session — listForMobileCRM calls
  // requireAuth(), which throws (as a generic "Server Error") otherwise.
  const { isAuthenticated } = useConvexAuth();
  const data = useQuery(
    api.leads.listForMobileCRM,
    isAuthenticated ? { statusFilter: 'all' } : 'skip',
  );

  const { area, currentLocation, permissionStatus, requestCurrentLocation, isLocating, isLoading: locationLoading } = useWorkAreaLocation();
  const [geocoded, setGeocoded] = useState<GeocodedLead[]>([]);
  const [geocodingProgress, setGeocodingProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace('/(app)/leads');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [router]),
  );

  // Step 2: geocode every lead's address (cached per-render keyed by lead ids)
  const leadsWithAddresses = useMemo(() => {
    if (!data?.leads) return [];
    return data.leads
      .map((l: any) => ({
        leadId: String(l._id),
        businessName: l.businessName ?? 'Unnamed business',
        businessAddress: l.businessAddress ?? null,
        businessCity: l.businessCity ?? null,
        ownerPhone: l.ownerPhone ?? null,
        status: l.status,
        isHot: !!l.isHot,
        isMine: !!l.isMine,
        photoUrl: (l.previewImageUrl as string | null | undefined) ?? null,
        category: l.businessCategory?.trim() || l.businessType?.trim() || null,
        kind: l.communityKind ?? null,
        submitterName: l.submittedBy?.displayName ?? null,
        submitterImage: l.submittedBy?.profileImage ?? null,
        addressString: fullAddress({ businessAddress: l.businessAddress, businessCity: l.businessCity }),
        coordinate: validMapCoordinate({ latitude: l.businessLatitude, longitude: l.businessLongitude })
          ? { latitude: l.businessLatitude, longitude: l.businessLongitude } : null,
      }))
      .filter((l) => !!l.addressString || !!l.coordinate) as Array<{
        leadId: string;
        businessName: string;
        businessAddress: string | null;
        businessCity: string | null;
        ownerPhone: string | null;
        status: string;
        isHot: boolean;
        isMine: boolean;
        photoUrl: string | null;
        category: string | null;
        kind: string | null;
        submitterName: string | null;
        submitterImage: string | null;
        addressString: string | null;
        coordinate: { latitude: number; longitude: number } | null;
      }>;
  }, [data?.leads]);

  useEffect(() => {
    if (leadsWithAddresses.length === 0) {
      setGeocoded([]);
      setGeocodingProgress({ done: 0, total: 0 });
      return;
    }
    let cancelled = false;
    setGeocodeError(null);
    setGeocodingProgress({ done: 0, total: leadsWithAddresses.length });
    const results: GeocodedLead[] = [];

    (async () => {
      for (const l of leadsWithAddresses) {
        if (cancelled) return;
        try {
          const matches = l.coordinate ? [l.coordinate] : await Location.geocodeAsync(l.addressString!);
          if (matches && matches[0]) {
            const m = matches[0];
            const distanceKm = area
              ? haversineKm(area, { latitude: m.latitude, longitude: m.longitude })
              : null;
            results.push({
              leadId: l.leadId,
              businessName: l.businessName,
              businessAddress: l.businessAddress,
              businessCity: l.businessCity,
              ownerPhone: l.ownerPhone,
              status: l.status,
              isHot: l.isHot,
              isMine: l.isMine,
              photoUrl: l.photoUrl,
              category: l.category,
              kind: l.kind,
              submitterName: l.submitterName,
              submitterImage: l.submitterImage,
              latitude: m.latitude,
              longitude: m.longitude,
              distanceKm,
              distanceLabel: mapDistanceLabel(distanceKm, area),
            });
          }
        } catch (err) {
          // Skip un-geocodable rows; surface a single banner if every row fails
        } finally {
          if (!cancelled) {
            setGeocodingProgress((p) => ({ done: p.done + 1, total: leadsWithAddresses.length }));
          }
        }
      }
      if (cancelled) return;
      results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      setGeocoded(results);
      if (results.length === 0 && leadsWithAddresses.length > 0) {
        setGeocodeError("Couldn't resolve any business addresses to map locations. The map shows your area only.");
      }
    })();

    return () => { cancelled = true; };
  }, [leadsWithAddresses, area]);

  // Center only when the work area or an explicitly requested GPS fix changes.
  useEffect(() => {
    if (!mapRef.current || !area) return;
    mapRef.current.animateToRegion(
      {
        latitude: area.latitude,
        longitude: area.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      },
      400,
    );
  }, [area]);

  const openInExternalMaps = (lead: GeocodedLead) => {
    void openDirections({
      latitude: lead.latitude,
      longitude: lead.longitude,
      label: lead.businessName,
      address: fullAddress(lead),
    });
  };

  const selectLead = (lead: GeocodedLead) => {
    setActiveLeadId(lead.leadId);
    // Shift the centre a little south so the pin sits above the bottom sheet.
    mapRef.current?.animateToRegion(
      { latitude: lead.latitude - 0.005, longitude: lead.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      500,
    );
  };

  const initialRegion: Region = area
    ? { latitude: area.latitude, longitude: area.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }
    : FALLBACK_REGION;

  const activeLead = activeLeadId ? geocoded.find((l) => l.leadId === activeLeadId) ?? null : null;
  const isLoading = data === undefined || locationLoading;
  const plotting = geocodingProgress.total > 0 && geocodingProgress.done < geocodingProgress.total;

  const headline =
    area?.source === 'work'
      ? `Near ${area.label}`
      : permissionStatus === 'denied'
      ? 'Location is off'
      : isLoading
        ? 'Finding you…'
        : `${geocoded.length} of ${leadsWithAddresses.length} shops on the map`;

  return (
    <View style={styles.root}>
      {isLoading ? (
        <Loading label="Finding your location…" />
      ) : (
        <MapView
          ref={(r) => { mapRef.current = r; }}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          customMapStyle={QUIET_MAP_STYLE}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsPointsOfInterest={false}
          showsBuildings={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {currentLocation ? <MeDot coordinate={currentLocation} /> : null}
          {geocoded.map((lead) => (
            <ShopPin
              key={lead.leadId}
              lead={lead}
              selected={activeLeadId === lead.leadId}
              onPress={() => selectLead(lead)}
            />
          ))}
        </MapView>
      )}

      {/* Floating header: round back button + white pill */}
      <View style={[styles.top, { top: insets.top + space.sm }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable
            onPress={() => router.replace('/(app)/leads')}
            accessibilityRole="button"
            accessibilityLabel="Back to leads"
            hitSlop={4}
            style={[styles.round, shadow.soft]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={[styles.titlePill, shadow.soft]} accessibilityRole="header">
            <Text variant="bodyLg" weight="bold" numberOfLines={1}>
              Live shops
            </Text>
            <Text variant="label" tone="muted" weight="medium" numberOfLines={1}>
              {headline}
            </Text>
          </View>
        </View>

        {permissionStatus === 'denied' ? (
          <Pressable
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="Enable location to sort by distance"
            style={[styles.floatBtn, shadow.soft]}
          >
            <Ionicons name="settings-outline" size={22} color={colors.ink} />
            <Text variant="label" weight="bold">
              Turn on location
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => { void requestCurrentLocation(); }}
            disabled={isLocating}
            accessibilityRole="button"
            accessibilityLabel="Use my current location"
            style={[styles.floatBtn, shadow.soft]}
          >
            {isLocating ? <ActivityIndicator size="small" color={colors.ink} /> : <Ionicons name="locate-outline" size={22} color={colors.ink} />}
            <Text variant="label" weight="bold">Use my location</Text>
          </Pressable>
        )}

        {plotting ? (
          <View style={[styles.floatBtn, shadow.soft]} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.ink} />
            <Text variant="label" weight="bold">
              Plotting {geocodingProgress.done} / {geocodingProgress.total}
            </Text>
          </View>
        ) : null}

        {geocodeError ? <Banner tone="warn" body={geocodeError} /> : null}
      </View>

      {/* Bottom sheet */}
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }]}>
        <View style={styles.grab} />
        {activeLead ? (
          <ActiveShop
            lead={activeLead}
            onView={() => router.push(`/(app)/leads/${activeLead.leadId}` as any)}
            onRoute={() => openInExternalMaps(activeLead)}
            onClose={() => setActiveLeadId(null)}
          />
        ) : (
          <>
            <View style={styles.sheetHead}>
              <Text variant="bodyLg" weight="bold">
                {area?.source === 'work' ? `Near ${area.label}` : currentLocation ? 'Nearest first' : 'All on the map'}
              </Text>
              {geocoded.length > 0 ? (
                <Text variant="label" tone="muted">
                  {geocoded.length} pinned
                </Text>
              ) : null}
            </View>
            {!isLoading && geocoded.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text variant="body" tone="ink2">
                  No shops with an address yet. They show up here once they do.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cards}
              >
                {geocoded.map((lead) => {
                  const st = isLiveOrYours(lead);
                  return (
                    <Pressable
                      key={lead.leadId}
                      onPress={() => selectLead(lead)}
                      accessibilityRole="button"
                      accessibilityLabel={`${lead.businessName}, ${lead.distanceLabel}`}
                      cssInterop={false}
                      style={({ pressed }) => [styles.scard, shadow.soft, pressed ? { opacity: 0.85 } : null]}
                    >
                      <ShopTile uri={lead.photoUrl} name={lead.businessName} category={lead.category} kind={lead.kind} width={184} height={104} />
                      <Text variant="body" weight="bold" numberOfLines={1} style={styles.scardTitle}>
                        {lead.businessName}
                      </Text>
                      <Text variant="label" weight="medium" tone="muted" numberOfLines={1} style={styles.scardMeta}>
                        {lead.distanceLabel} · {st ? 'Live' : 'Needs a site'}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function ActiveShop({
  lead,
  onView,
  onRoute,
  onClose,
}: {
  lead: GeocodedLead;
  onView: () => void;
  onRoute: () => void;
  onClose: () => void;
}) {
  const status = leadStatus(lead.status);
  return (
    <View style={styles.active}>
      <View style={styles.activeTop}>
        <ShopTile uri={lead.photoUrl} name={lead.businessName} category={lead.category} kind={lead.kind} width={104} height={128} />
        <View style={styles.activeText}>
          <Text variant="heading" numberOfLines={2}>
            {lead.businessName}
          </Text>
          <Text variant="label" weight="semibold" tone="muted" numberOfLines={2}>
            {lead.distanceLabel}
            {fullAddress(lead) ? ` · ${fullAddress(lead)}` : ''}
          </Text>
          <View style={styles.chipRow}>
            <Chip label={status.label} tone={status.tone} />
            {lead.isHot ? <Chip label="Hot" tone="danger" /> : null}
          </View>
          {lead.submitterName ? (
            <View style={styles.byRow}>
              <Avatar uri={lead.submitterImage} name={lead.submitterName} size={28} />
              <Text variant="label" weight="medium" tone="muted" numberOfLines={1} style={styles.flex}>
                Spotted by {lead.submitterName}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.activeBtns}>
        <Button
          title="View lead"
          size="md"
          fullWidth={false}
          style={styles.flex}
          onPress={onView}
          accessibilityLabel="View lead"
        />
        <Button
          title="Route"
          variant="ghost"
          size="md"
          fullWidth={false}
          icon="navigate"
          onPress={onRoute}
          accessibilityLabel="Open in Google Maps"
        />
      </View>
      <TextLink label="All shops" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E9E9E3' },
  flex: { flex: 1 },

  // pins
  ringBase: { alignItems: 'center', justifyContent: 'center' },
  photo: { overflow: 'hidden', backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: 'rgba(12,10,8,0.10)' },
  pinLabel: {
    marginTop: 6,
    height: LABEL_H,
    maxWidth: LABEL_W,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  meHalo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(12,10,8,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },

  // floating header
  top: { position: 'absolute', left: space.lg, right: space.lg, gap: space.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlePill: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs + 2,
    borderRadius: 26,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  floatBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },

  // bottom sheet
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#0C0A08',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 10,
  },
  grab: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.ruleStrong,
    alignSelf: 'center',
    marginTop: 9,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl - 4,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  emptyWrap: { paddingHorizontal: space.xl - 4, paddingBottom: space.sm },
  cards: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm + 2 },
  scard: {
    width: 200,
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: space.sm,
    paddingBottom: space.md,
  },
  scardTitle: { marginTop: space.sm + 1, marginHorizontal: space.xs },
  scardMeta: { marginHorizontal: space.xs, marginTop: 2 },
  tile: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // selected shop
  active: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md },
  activeTop: { flexDirection: 'row', gap: space.md },
  activeText: { flex: 1, gap: space.xs + 1, minWidth: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  activeBtns: { flexDirection: 'row', gap: space.sm },
});
