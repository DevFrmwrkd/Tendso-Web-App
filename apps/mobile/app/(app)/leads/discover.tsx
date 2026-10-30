import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  Linking,
  Platform,
  BackHandler,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { useWorkAreaLocation } from '../../../hooks/useWorkAreaLocation';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { colors, radius, shadow, space } from '../../../theme/v2';
import { openDirections } from '../../../services/links';
import { mapDistanceLabel, validMapCoordinate } from '../../../services/workArea';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Loading,
  ScreenShell,
  Text,
  TextLink,
} from '../../../components/v2';

const FALLBACK_REGION: Region = {
  latitude: 14.5995,
  longitude: 120.9842,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

type CategoryKey = 'barbershop' | 'restaurant' | 'sari-sari' | 'auto' | 'medical' | 'other';

// One ink icon per category. Pins are never colour-coded: the ring tells the state.
const CATEGORY_STYLES: Record<CategoryKey, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = {
  'barbershop': { label: 'Barber · Salon', icon: 'cut-outline' },
  'auto':       { label: 'Auto · Mechanic', icon: 'car-outline' },
  'sari-sari':  { label: 'Sari-sari · Store', icon: 'storefront-outline' },
  'medical':    { label: 'Pharmacy · Clinic', icon: 'medkit-outline' },
  'restaurant': { label: 'Restaurant · Cafe', icon: 'restaurant-outline' },
  'other':      { label: 'Shop', icon: 'business-outline' },
};

/** Quiet Google map: land #E9E9E3, white roads, water #D3DCE3, no points of interest. */
const QUIET_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#E9E9E3' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B6A63' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F6F6F3' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D3DCE3' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6B6A63' }] },
];

function categorize(categoryText: string | null | undefined): CategoryKey {
  const c = (categoryText ?? '').toLowerCase();
  if (/barbershop|salon|hair|beauty|nail/.test(c)) return 'barbershop';
  if (/restaurant|cafe|coffee|food|eatery|bakery|fastfood|carinderia|kakanin|lutong/.test(c)) return 'restaurant';
  if (/sari-?sari|convenience|grocery|mart|store/.test(c)) return 'sari-sari';
  if (/auto|mechanic|vulcanizing|repair|car ?wash|tire/.test(c)) return 'auto';
  if (/pharmacy|drugstore|clinic|dental|medical|hospital/.test(c)) return 'medical';
  return 'other';
}

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

type PinnedBiz = {
  leadId: string;
  /**
   * Which table `leadId` came from. Pool prospects and legacy leads BOTH yield
   * plain Convex ids, so the id shape cannot tell them apart — reserveProspect
   * wants a prospects id and prospectLeadId wants a leads id, and sending the
   * wrong one is a server-side validator error. Track it explicitly.
   */
  source: 'pool' | 'legacy' | 'direct';
  businessName: string;
  businessAddress: string | null;
  businessCity: string | null;
  businessCategory: string | null;
  businessPhone: string | null;
  businessWebsite: string | null;
  businessRating: number | null;
  businessReviewCount: number | null;
  latitude: number;
  longitude: number;
  category: CategoryKey;
  distanceKm: number | null;
  distanceLabel: string;
  scrapedAt: number;
};

export default function DiscoverLeadsScreen() {
  const router = useGuardedRouter();
  const params = useLocalSearchParams<{ category?: string; radiusKm?: string; data?: string }>();
  const mapRef = useRef<MapView | null>(null);

  // 2026-05-29 — primary data path is the businesses array passed via URL
  // params from the scrape modal. This is what scrapeNearby returns directly.
  // The listScrapedLeads DB query is now a FALLBACK only, used when the user
  // navigates here without fresh scrape data (e.g., deep link). The DB path
  // has been unreliable in prod — the action returns success but rows never
  // appear in the leads table for unknown reasons, so we trust the action's
  // direct return as the canonical source.
  const directBusinesses = useMemo<any[]>(() => {
    const dataParam = Array.isArray(params.data) ? params.data[0] : params.data;
    if (!dataParam) return [];
    try {
      const parsed = JSON.parse(decodeURIComponent(dataParam));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [params.data]);

  // Only hit the DB if we have NO direct data. Avoids a wasted query when the
  // user just came from the scrape modal.
  const scrapedLeads = useQuery(
    api.outscraper.listScrapedLeads,
    directBusinesses.length > 0 ? "skip" : ({} as any),
  );

  const { area, currentLocation, permissionStatus, requestCurrentLocation, isLocating, isLoading: locationLoading } = useWorkAreaLocation();
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  // Pool rows you reserved this visit. The search hides reserved rows, so we remember them
  // here to keep the pin and the sheet on "Yours".
  const [reservedIds, setReservedIds] = useState<string[]>([]);

  const categoryQuery = (Array.isArray(params.category) ? params.category[0] : params.category) ?? '';
  const radiusKm = Number(Array.isArray(params.radiusKm) ? params.radiusKm[0] : params.radiusKm) || 5;

  // 2026-06-01 — P1 dual-read. In addition to URL-passed data (primary) and
  // the legacy outscraper.listScrapedLeads fallback, we ALSO read from the
  // new global prospect pool via prospects.searchNearby. Results from all
  // three sources are merged + deduped by Google Place ID at render time.
  //
  // The discover map will now show pool prospects even when the user navigates
  // here without a fresh scrape (e.g., deep-link), as long as the pool has
  // inventory in this geographic area. Pool inventory is populated by:
  //   - P1 backfill migration (one-shot, from existing outscraper-source leads)
  //   - P4 background replenishment cron (continuous, when inventory drops)
  // Function references and result types come from the canonical backend.
  const poolProspects = useQuery(
    api.prospects.searchNearby,
    area
      ? {
          lat: area.latitude,
          lng: area.longitude,
          radiusKm,
          limit: 100,
        }
      : "skip",
  );

  // P2 — Reservation mutation. The reserve button only renders
  // for pool-backed prospects (those with a Convex _id), not raw URL-data
  // businesses which don't yet exist as DB rows.
  const reserveProspect = useMutation(api.prospects.reserve);
  const [reservingId, setReservingId] = useState<string | null>(null);

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

  // Diagnostic snapshot — surfaces in the empty state so we can tell at a
  // glance whether the issue is upstream (Outscraper) or downstream (mobile).
  const dataShape = useMemo(() => {
    // Tri-source dataShape — primary URL data + legacy fallback + pool fallback
    const direct = directBusinesses.length;
    const directWithCoords = directBusinesses.filter((b: any) =>
      typeof b.businessLatitude === 'number' &&
      typeof b.businessLongitude === 'number',
    ).length;

    const legacyRows: any[] = Array.isArray(scrapedLeads)
      ? scrapedLeads
      : Array.isArray((scrapedLeads as any)?.leads)
        ? (scrapedLeads as any).leads
        : [];
    const legacy = legacyRows.filter((l: any) => l.source === 'outscraper').length;
    const legacyWithCoords = legacyRows.filter((l: any) =>
      l.source === 'outscraper' &&
      typeof l.businessLatitude === 'number' &&
      typeof l.businessLongitude === 'number',
    ).length;

    const pool = poolProspects ? poolProspects.length : 0;
    const poolWithCoords = poolProspects
      ? poolProspects.filter((p: any) =>
          typeof p.latitude === 'number' && typeof p.longitude === 'number',
        ).length
      : 0;

    return {
      // Primary diagnostics (kept for backwards compat with existing empty state)
      rowsTotal: direct + legacy + pool,
      outscraperRows: direct + legacy,
      withCoords: directWithCoords + legacyWithCoords + poolWithCoords,
      // Per-source breakdown for the debug strip
      direct,
      legacy,
      pool,
      source: directBusinesses.length > 0 ? ('direct' as const) : ('fallback' as const),
    };
  }, [directBusinesses, scrapedLeads, poolProspects]);

  const pinned: PinnedBiz[] = useMemo(() => {
    // Primary path: businesses passed directly from the scrape modal.
    // Render pins from these immediately, no DB query needed.
    if (directBusinesses.length > 0) {
      const directPins = directBusinesses
        .filter((b: any) =>
          typeof b.businessLatitude === 'number' &&
          typeof b.businessLongitude === 'number',
        )
        .map((b: any, idx: number) => ({
          leadId: b.placeId ?? `direct-${idx}`,
          source: 'direct' as const,
          businessName: b.businessName ?? 'Unnamed shop',
          businessAddress: b.businessAddress ?? null,
          businessCity: b.businessCity ?? null,
          businessCategory: b.businessCategory ?? null,
          businessPhone: b.businessPhone ?? null,
          businessWebsite: b.businessWebsite ?? null,
          businessRating: typeof b.businessRating === 'number' ? b.businessRating : null,
          businessReviewCount: typeof b.businessReviewCount === 'number' ? b.businessReviewCount : null,
          latitude: b.businessLatitude as number,
          longitude: b.businessLongitude as number,
          category: categorize(b.businessCategory),
          distanceKm: area
            ? haversineKm(area, { latitude: b.businessLatitude, longitude: b.businessLongitude })
            : null,
          distanceLabel: mapDistanceLabel(area ? haversineKm(area, { latitude: b.businessLatitude, longitude: b.businessLongitude }) : null, area),
          scrapedAt: Date.now(),
        }))
        // Hard distance filter — the scrape can surface businesses beyond the
        // requested radius (Outscraper relevance ranking + Places returning
        // 20 nearest regardless of radius hint). Cap by the user's choice so
        // the header copy ("X businesses within Y km") is honest.
        // The saved work area or explicitly requested GPS fix sets the origin.
        .filter((b) => {
          if (!area) return true;
          if (b.distanceKm == null) return true;
          return b.distanceKm <= radiusKm;
        })
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      // An explicit GPS recenter can move outside the original scrape area.
      // In that case show the prospect pool at the new center instead of
      // keeping an empty direct-data branch over valid nearby pool results.
      if (directPins.length > 0 || !currentLocation) return directPins;
    }

    // Fallback path: dual-read from pool prospects (preferred) + legacy
    // outscraper-source leads. Merge by Google Place ID; if both sources
    // have the same place, pool wins (it has qualityScore + cleaner data).
    const merged = new Map<string, PinnedBiz>();

    // Pool prospects (preferred — has qualityScore from server-side ranking)
    if (poolProspects) {
      for (const p of poolProspects as any[]) {
        if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') continue;
        const placeKey = p.googlePlaceId ?? `prospect-${String(p._id)}`;
        merged.set(placeKey, {
          leadId: String(p._id),
          source: 'pool' as const,
          businessName: p.businessName ?? 'Unnamed shop',
          businessAddress: p.address ?? null,
          businessCity: p.city ?? null,
          businessCategory: p.category ?? null,
          businessPhone: p.phone ?? null,
          businessWebsite: p.website ?? null,
          businessRating: typeof p.rating === 'number' ? p.rating : null,
          businessReviewCount: typeof p.reviewCount === 'number' ? p.reviewCount : null,
          latitude: p.latitude,
          longitude: p.longitude,
          category: categorize(p.category),
          distanceKm: area ? haversineKm(area, { latitude: p.latitude, longitude: p.longitude }) : null,
          distanceLabel: mapDistanceLabel(area ? haversineKm(area, { latitude: p.latitude, longitude: p.longitude }) : null, area),
          scrapedAt: p.scrapedAt ?? 0,
        });
      }
    }

    // Legacy fallback (only fills gaps the pool didn't cover)
    const legacyRows: any[] = Array.isArray(scrapedLeads)
      ? scrapedLeads
      : Array.isArray((scrapedLeads as any)?.leads)
        ? (scrapedLeads as any).leads
        : [];
    for (const l of legacyRows) {
      if (
        l.source !== 'outscraper' ||
        l.submissionId != null ||
        typeof l.businessLatitude !== 'number' ||
        typeof l.businessLongitude !== 'number'
      ) continue;
      const placeKey = l.businessGooglePlaceId ?? `lead-${String(l._id)}`;
      if (merged.has(placeKey)) continue; // pool already supplied this — skip
      merged.set(placeKey, {
        leadId: String(l._id),
        source: 'legacy' as const,
        businessName: l.businessName ?? 'Unnamed shop',
        businessAddress: l.businessAddress ?? null,
        businessCity: l.businessCity ?? null,
        businessCategory: l.businessCategory ?? null,
        businessPhone: l.businessPhone ?? l.phone ?? null,
        businessWebsite: l.businessWebsite ?? null,
        businessRating: typeof l.businessRating === 'number' ? l.businessRating : null,
        businessReviewCount: typeof l.businessReviewCount === 'number' ? l.businessReviewCount : null,
        latitude: l.businessLatitude,
        longitude: l.businessLongitude,
        category: categorize(l.businessCategory),
        distanceKm: area ? haversineKm(area, { latitude: l.businessLatitude, longitude: l.businessLongitude }) : null,
        distanceLabel: mapDistanceLabel(area ? haversineKm(area, { latitude: l.businessLatitude, longitude: l.businessLongitude }) : null, area),
        scrapedAt: l.scrapedAt ?? l.createdAt ?? 0,
      });
    }

    return Array.from(merged.values())
      // Hard distance filter — match the header copy. See note in direct
      // branch above. We deliberately do NOT drop pool prospects whose
      // distance is null (no user location) so the map still shows them.
      .filter((b) => {
        if (!area) return true;
        if (b.distanceKm == null) return true;
        return b.distanceKm <= radiusKm;
      })
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }, [directBusinesses, scrapedLeads, poolProspects, area, currentLocation, radiusKm]);

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

  const goToDirections = (biz: PinnedBiz) => {
    void openDirections({
      latitude: biz.latitude,
      longitude: biz.longitude,
      label: biz.businessName,
      address: biz.businessAddress,
    });
  };

  const callBusiness = (biz: PinnedBiz) => {
    if (!biz.businessPhone) return;
    Linking.openURL(`tel:${biz.businessPhone}`).catch(() => {});
  };

  /**
   * Open step 1 of the interview flow with this business already filled in.
   *
   * `prospectLeadId` is sent ONLY for legacy-leads rows, because the backend
   * types it `v.id('leads')` — a pool `prospects` id would fail the validator,
   * and a placeId/synthetic id from the scrape modal is not a Convex id at all.
   * Those still get the prefill; they just submit as a normal standalone lead,
   * which is exactly what happens today.
   */
  const startInterview = useCallback(
    (biz: PinnedBiz) => {
      router.push({
        pathname: '/(app)/submit/info',
        params: {
          ...(biz.source === 'legacy' ? { prospectLeadId: biz.leadId } : {}),
          businessName: biz.businessName ?? '',
          phone: biz.businessPhone ?? '',
          address: biz.businessAddress ?? '',
          city: biz.businessCity ?? '',
          category: biz.businessCategory ?? '',
          ...(validMapCoordinate(biz) ? { latitude: String(biz.latitude), longitude: String(biz.longitude) } : {}),
        },
      } as any);
    },
    [router],
  );

  // P2 — Reserve handler. Looks up the underlying prospect from the dual-read
  // sources, calls the reserve mutation, gives feedback. Skips silently for
  // URL-data businesses (no DB row to reserve).
  const handleReserve = useCallback(
    async (biz: PinnedBiz) => {
      if (!reserveProspect) return;
      // Only pool-backed prospects can be reserved. This used to regex-sniff
      // the id shape, which silently misfired on legacy leads: those are also
      // plain Convex ids, so they passed the check and were then rejected by
      // the v.id('prospects') validator as a generic "Couldn't reserve".
      if (biz.source !== 'pool') {
        Alert.alert(
          'Not reservable yet',
          "You can still interview this shop. Tap Start with these details.",
        );
        return;
      }
      setReservingId(biz.leadId);
      try {
        await reserveProspect({ prospectId: biz.leadId as any });
        setReservedIds((ids) => (ids.includes(biz.leadId) ? ids : [...ids, biz.leadId]));
        Alert.alert(
          "Reserved",
          `${biz.businessName} is yours for the next 24 hours. Tap Route to go interview them.`,
        );
      } catch (err: any) {
        const msg = err?.message ?? "Could not reserve this shop.";
        if (/Cannot reserve.*reserved/.test(msg)) {
          Alert.alert("Already taken", "Another field agent reserved this shop just now. Try a different one.");
        } else if (/not authenticated/i.test(msg)) {
          Alert.alert("Please sign in", "Your session expired — log out and back in.");
        } else {
          Alert.alert("Couldn't reserve", msg);
        }
      } finally {
        setReservingId(null);
      }
    },
    [reserveProspect],
  );

  const initialRegion: Region = area
    ? { latitude: area.latitude, longitude: area.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }
    : FALLBACK_REGION;

  const activeLead = activeLeadId ? pinned.find((l) => l.leadId === activeLeadId) ?? null : null;
  // Loading only matters when we DON'T have direct data. If the scrape passed
  // businesses via URL params, we already have everything we need.
  const isLoading =
    locationLoading ||
    (directBusinesses.length === 0 && scrapedLeads === undefined);

  const headerSub = useMemo(() => {
    if (isLoading) return 'Finding shops to interview…';
    if (pinned.length === 0) return 'No shops yet. Try a wider radius.';
    const cat = categoryQuery && categoryQuery !== 'businesses' ? ` ${categoryQuery}` : '';
    const radiusLabel = radiusKm < 1 ? `${Math.round(radiusKm * 1000)} m` : `${radiusKm} km`;
    return `${pinned.length}${cat} shop${pinned.length === 1 ? '' : 's'} within ${radiusLabel}${area?.source === 'work' ? ` of ${area.label}` : ''}.`;
  }, [isLoading, pinned.length, categoryQuery, radiusKm, area]);


  const insets = useSafeAreaInsets();
  const emptyCopy = useMemo(() => {
    if (dataShape.outscraperRows > 0 && dataShape.withCoords === 0) {
      return {
        icon: 'alert-circle-outline' as const,
        title: 'No pins yet',
        body: `We found ${dataShape.outscraperRows} shop${dataShape.outscraperRows === 1 ? '' : 's'}, but none has a map spot yet.`,
      };
    }
    return {
      icon: 'search-outline' as const,
      title: 'No shops yet',
      body: 'Go back and search again with a wider radius.',
    };
  }, [dataShape.outscraperRows, dataShape.withCoords]);

  const goBack = () => router.replace('/(app)/leads');

  const focusBiz = (biz: PinnedBiz) => {
    setActiveLeadId(biz.leadId);
    // Aim a little south of the shop so the pin sits above the bottom sheet.
    mapRef.current?.animateToRegion(
      { latitude: biz.latitude - 0.004, longitude: biz.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      500,
    );
  };

  const isYours = (biz: PinnedBiz) => reservedIds.includes(biz.leadId);
  const yoursCount = pinned.filter(isYours).length;
  const needsCount = pinned.length - yoursCount;
  const locationBanner =
    permissionStatus === 'denied' ? (
      <Banner
        tone="warn"
        icon="location-outline"
        title="Location is off"
        body={area?.source === 'work' ? `Showing shops near ${area.label}. Turn location on to use your current position.` : 'Turn it on to sort shops by distance.'}
        action={<TextLink label="Open settings" align="left" onPress={() => Linking.openSettings()} />}
      />
    ) : (
      <View style={[styles.legendPill, shadow.soft]}>
        <TextLink
          label={isLocating ? 'Finding your location…' : 'Use my location'}
          align="left"
          onPress={() => { void requestCurrentLocation(); }}
        />
      </View>
    );

  // ---- List view ----------------------------------------------------------
  if (view === 'list') {
    const ordered = activeLead ? [activeLead, ...pinned.filter((l) => l.leadId !== activeLead.leadId)] : pinned;
    return (
      <ScreenShell
        title={area?.source === 'work' ? `Shops near ${area.label}` : 'Shops near you'}
        subtitle={headerSub}
        onBack={goBack}
        headerRight={<ViewToggle label="Map" icon="map-outline" onPress={() => setView('map')} />}
      >
        <View style={styles.listGap}>
          {locationBanner}

          {!isLoading && pinned.length === 0 ? (
            <Card variant="lg">
              <EmptyState
                icon={emptyCopy.icon}
                title={emptyCopy.title}
                body={emptyCopy.body}
                actionLabel="Back to leads"
                onAction={goBack}
              />
            </Card>
          ) : null}

          {ordered.map((biz) => {
            const isActive = activeLeadId === biz.leadId;
            const style = CATEGORY_STYLES[biz.category];
            const yours = isYours(biz);
            return (
              <Card key={biz.leadId} style={[styles.listCard, isActive ? styles.listCardOn : null]}>
                <Pressable
                  onPress={() => focusBiz(biz)}
                  accessibilityRole="button"
                  accessibilityLabel={`${biz.businessName}, ${biz.distanceLabel}`}
                  accessibilityState={{ expanded: isActive }}
                  style={styles.listHead}
                >
                  <View style={[styles.listIcon, yours ? styles.listIconYours : null]}>
                    <Ionicons name={style.icon} size={24} color={colors.ink} />
                  </View>
                  <View style={styles.flex1}>
                    <Text variant="body" weight="bold" numberOfLines={1}>
                      {biz.businessName}
                    </Text>
                    <Text variant="label" tone="muted" weight="medium" numberOfLines={1}>
                      {[biz.businessCategory, biz.businessCity].filter(Boolean).join(' · ') || biz.businessAddress || style.label}
                    </Text>
                    {biz.businessRating != null ? (
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={16} color={colors.ink} />
                        <Text variant="label" tone="ink2">
                          {biz.businessRating.toFixed(1)}
                          {biz.businessReviewCount != null ? ` · ${biz.businessReviewCount}` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.listDist}>
                    <Text variant={area?.source === 'work' ? 'label' : 'bodyLg'} weight="bold">
                      {biz.distanceLabel}
                    </Text>
                    {yours ? <Chip label="Yours" tone="ok" /> : null}
                  </View>
                </Pressable>

                {isActive ? (
                  <View style={styles.listActions}>
                    {yours ? (
                      <Button title="Start interview" size="md" onPress={() => startInterview(biz)} accessibilityLabel="Start with these details" />
                    ) : (
                      <Button
                        title="I'll interview this"
                        size="md"
                        loading={reservingId === biz.leadId}
                        onPress={() => handleReserve(biz)}
                      />
                    )}
                    <View style={styles.rowGap}>
                      <Button
                        title="Route"
                        variant="ghost"
                        size="md"
                        icon="navigate"
                        style={styles.flex1}
                        onPress={() => goToDirections(biz)}
                        accessibilityLabel="Directions"
                      />
                      {biz.businessPhone ? (
                        <Button
                          title="Call"
                          variant="ghost"
                          size="md"
                          icon="call-outline"
                          style={styles.flex1}
                          onPress={() => callBusiness(biz)}
                          accessibilityLabel="Phone"
                        />
                      ) : null}
                    </View>
                    {!yours ? (
                      <TextLink label="Start with these details" onPress={() => startInterview(biz)} />
                    ) : null}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      </ScreenShell>
    );
  }

  // ---- Map view -----------------------------------------------------------
  const headerTitle = isLoading
    ? 'Finding shops…'
    : pinned.length === 0
      ? 'No shops yet'
      : `${pinned.length} shop${pinned.length === 1 ? '' : 's'} near ${area?.label ?? 'you'}`;

  return (
    <View style={styles.root}>
      {isLoading ? (
        <Loading label="Finding shops to interview…" />
      ) : (
        <MapView
          ref={(r) => { mapRef.current = r; }}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          customMapStyle={QUIET_MAP_STYLE}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          userInterfaceStyle="light"
          showsPointsOfInterest={false}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          showsUserLocation={!!currentLocation}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          onPress={() => setActiveLeadId(null)}
        >
          {pinned.map((biz) => (
            <Marker
              key={biz.leadId}
              coordinate={{ latitude: biz.latitude, longitude: biz.longitude }}
              onPress={() => focusBiz(biz)}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={activeLeadId === biz.leadId ? 2 : 1}
            >
              <ShopPin biz={biz} selected={activeLeadId === biz.leadId} yours={isYours(biz)} />
            </Marker>
          ))}
        </MapView>
      )}

      {/* Floating round back + white pill header + list toggle */}
      <View style={[styles.topBar, { top: insets.top + space.sm }]} pointerEvents="box-none">
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back to leads"
          style={[styles.round, shadow.soft]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={[styles.headerPill, shadow.soft]} accessibilityRole="header">
          <Text variant="body" weight="bold" numberOfLines={1}>
            {headerTitle}
          </Text>
        </View>
        <ViewToggle label="List" icon="list" onPress={() => setView('list')} />
      </View>

      {/* Legend (read-only) + location note */}
      <View style={[styles.floatCol, { top: insets.top + space.sm + 48 + space.md }]} pointerEvents="box-none">
        {!isLoading && pinned.length > 0 ? (
          <View style={styles.legend}>
            <View style={[styles.legendPill, shadow.soft, styles.legendOn]} accessible accessibilityLabel={`Needs a site, ${needsCount}`}>
              <View style={styles.legendRing} />
              <Text variant="chip" tone="onDark">{`Needs a site · ${needsCount}`}</Text>
            </View>
            <View style={[styles.legendPill, shadow.soft]} accessible accessibilityLabel={`Yours, ${yoursCount}`}>
              <View style={styles.legendDot} />
              <Text variant="chip">{`Yours · ${yoursCount}`}</Text>
            </View>
          </View>
        ) : null}
        {locationBanner}
      </View>

      {/* Bottom sheet: the selected shop, or the nearest ones, or nothing found */}
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }]}>
        {activeLead ? (
          <Pressable
            onPress={() => setActiveLeadId(null)}
            accessibilityRole="button"
            accessibilityLabel="Close shop details"
            hitSlop={12}
            style={styles.grabHit}
          >
            <View style={styles.grab} />
          </Pressable>
        ) : (
          <View style={styles.grabHit}>
            <View style={styles.grab} />
          </View>
        )}

        {activeLead ? (
          <View style={styles.sheetBody}>
            <View style={styles.sheetTop}>
              <View style={styles.flex1}>
                <Text variant="heading" numberOfLines={2}>
                  {activeLead.businessName}
                </Text>
                <Text variant="label" tone="muted" weight="medium" style={styles.sheetMeta}>
                  {`${activeLead.distanceLabel} · ${CATEGORY_STYLES[activeLead.category].label}`}
                </Text>
              </View>
              <Chip label={isYours(activeLead) ? 'Yours' : 'Needs a site'} tone={isYours(activeLead) ? 'ok' : 'info'} />
            </View>

            <View style={styles.whoRow}>
              <Ionicons name="location-outline" size={20} color={colors.ink3} />
              <Text variant="body" tone="ink2" numberOfLines={1} style={styles.flex1}>
                {[activeLead.businessCategory, activeLead.businessCity].filter(Boolean).join(' · ') ||
                  activeLead.businessAddress ||
                  'Spotted nearby'}
              </Text>
            </View>

            <Card style={styles.earnCard}>
              <View style={styles.earnIcon}>
                <Ionicons name="cash-outline" size={22} color={colors.onAccent} />
              </View>
              <View style={styles.flex1}>
                <Text variant="body" weight="bold">
                  Earn up to ₱2,500
                </Text>
                <Text variant="label" tone="muted" weight="medium">
                  You set the price, ₱999–₱4,999. You keep half.
                </Text>
              </View>
            </Card>

            <View style={styles.rowGap}>
              {isYours(activeLead) ? (
                <Button
                  title="Start interview"
                  size="md"
                  style={styles.flex1}
                  onPress={() => startInterview(activeLead)}
                  accessibilityLabel="Start with these details"
                />
              ) : (
                <Button
                  title="I'll interview this"
                  size="md"
                  style={[styles.flex1, styles.tightBtn]}
                  loading={reservingId === activeLead.leadId}
                  onPress={() => handleReserve(activeLead)}
                />
              )}
              <Button
                title="Route"
                variant="ghost"
                size="md"
                fullWidth={false}
                style={styles.tightBtn}
                onPress={() => goToDirections(activeLead)}
                accessibilityLabel="Directions"
              />
            </View>

            <View style={styles.linkRow}>
              {!isYours(activeLead) ? (
                <TextLink label="Start with these details" onPress={() => startInterview(activeLead)} />
              ) : null}
              {activeLead.businessPhone ? (
                <TextLink label="Call" onPress={() => callBusiness(activeLead)} accessibilityHint="Phone the shop" />
              ) : null}
            </View>
          </View>
        ) : !isLoading && pinned.length === 0 ? (
          <EmptyState
            icon={emptyCopy.icon}
            title={emptyCopy.title}
            body={emptyCopy.body}
            actionLabel="Back to leads"
            onAction={goBack}
          />
        ) : !isLoading ? (
          <View>
            <Text variant="body" weight="bold" style={styles.peekTitle}>
              {`Shops near ${area?.label ?? 'you'}`}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.peekRow}
            >
              {pinned.slice(0, 12).map((biz) => (
                <Pressable
                  key={biz.leadId}
                  onPress={() => focusBiz(biz)}
                  accessibilityRole="button"
                  accessibilityLabel={`${biz.businessName}, ${biz.distanceLabel}`}
                  style={[styles.peekCard, shadow.soft]}
                >
                  <View style={[styles.listIcon, isYours(biz) ? styles.listIconYours : null]}>
                    <Ionicons name={CATEGORY_STYLES[biz.category].icon} size={24} color={colors.ink} />
                  </View>
                  <Text variant="body" weight="bold" numberOfLines={1} style={styles.peekName}>
                    {biz.businessName}
                  </Text>
                  <Text variant="label" tone="muted" weight="medium" numberOfLines={1}>
                    {`${biz.distanceLabel} · ${isYours(biz) ? 'Yours' : 'Needs a site'}`}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** White round-pill toggle between the map and the list. */
function ViewToggle({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Show ${label.toLowerCase()}`}
      style={[styles.toggle, shadow.soft]}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
      <Text variant="chip">{label}</Text>
    </Pressable>
  );
}

/**
 * Map pin. Dashed ink ring = needs a site. Accent ring with an ink hairline = yours.
 * Selected = bigger solid ink ring with an ink label. Labels are only drawn for the
 * selected pin, so the map stays quiet.
 */
const PIN_LABEL_SPACE = 36;
function ShopPin({ biz, selected, yours }: { biz: PinnedBiz; selected: boolean; yours: boolean }) {
  const size = selected ? 60 : 46;
  const ring = selected
    ? { borderWidth: 4, borderColor: colors.ink }
    : yours
      ? { borderWidth: 4, borderColor: colors.accent }
      : { borderWidth: 3, borderColor: colors.ink, borderStyle: 'dashed' as const };
  const disc = (
    <View style={[styles.pinDisc, { width: size, height: size, borderRadius: size / 2 }, ring]}>
      <Ionicons name={CATEGORY_STYLES[biz.category].icon} size={selected ? 26 : 22} color={colors.ink} />
    </View>
  );
  return (
    <View style={styles.pinWrap}>
      {/* The spacer above mirrors the label below, so the disc stays on the coordinate. */}
      {selected ? <View style={{ height: PIN_LABEL_SPACE }} /> : null}
      {yours && !selected ? <View style={styles.pinHairline}>{disc}</View> : disc}
      {selected ? (
        <View style={[styles.pinLabel, { height: PIN_LABEL_SPACE }]}>
          <Text variant="chip" tone="onDark" numberOfLines={1} style={styles.pinLabelText}>
            {`${biz.businessName} · ${biz.distanceLabel}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex1: { flex: 1 },
  rowGap: { flexDirection: 'row', gap: space.md, alignItems: 'center' },

  // Map chrome
  topBar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPill: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  toggle: {
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  floatCol: { position: 'absolute', left: space.lg, right: space.lg, gap: space.sm },
  legend: { flexDirection: 'row', gap: space.sm },
  legendPill: {
    minHeight: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  legendOn: { backgroundColor: colors.ink },
  legendRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.onDark,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },

  // Pins
  pinWrap: { alignItems: 'center', padding: 4 },
  pinDisc: { backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  pinHairline: { borderWidth: 1.5, borderColor: colors.ink, borderRadius: 999, padding: 0 },
  pinLabel: { justifyContent: 'center', paddingTop: 6 },
  pinLabelText: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    overflow: 'hidden',
    maxWidth: 220,
  },

  // Bottom sheet
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: space.lg,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 12,
  },
  grabHit: { height: 28, alignItems: 'center', justifyContent: 'center' },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.ruleStrong },
  sheetBody: { gap: space.md },
  sheetTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  sheetMeta: { marginTop: 2 },
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  earnCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  earnIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tightBtn: { paddingHorizontal: space.lg },
  linkRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  peekTitle: { marginBottom: space.md, marginTop: space.xs },
  peekRow: { gap: space.md, paddingRight: space.lg },
  peekCard: {
    width: 196,
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: space.md,
    gap: space.xs,
  },
  peekName: { marginTop: space.sm },

  // List view
  listGap: { gap: space.md },
  listCard: { borderWidth: 2, borderColor: 'transparent' },
  listCardOn: { borderColor: colors.ink },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  listIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listIconYours: { backgroundColor: colors.accent },
  listDist: { alignItems: 'flex-end', gap: space.xs, maxWidth: 115, flexShrink: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 2 },
  listActions: { gap: space.sm, marginTop: space.md },
});
