import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  BackHandler,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors, fonts, radius } from '../../../theme/tokens';
import { openDirections } from '../../../services/links';
import { Display, Body, Label, Door, Card, Rule } from '../../../components/ui/primitives';

const FALLBACK_REGION: Region = {
  latitude: 14.5995,
  longitude: 120.9842,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

type CategoryKey = 'barbershop' | 'restaurant' | 'sari-sari' | 'auto' | 'medical' | 'other';

const CATEGORY_STYLES: Record<CategoryKey, {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = {
  'barbershop': { label: 'Barbershop · Salon', color: '#7C3AED', icon: 'cut-outline' },
  'restaurant': { label: 'Restaurant · Cafe',  color: '#C68A12', icon: 'restaurant-outline' },
  'sari-sari':  { label: 'Sari-sari · Grocery', color: '#E4B05E', icon: 'storefront-outline' },
  'auto':       { label: 'Auto · Mechanic',     color: '#1F3654', icon: 'car-outline' },
  'medical':    { label: 'Pharmacy · Clinic',   color: '#B43A1F', icon: 'medkit-outline' },
  'other':      { label: 'Other',               color: '#3C3F4A', icon: 'business-outline' },
};

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

function formatDistance(km: number | null): string {
  if (km == null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
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

  const [permissionStatus, setPermissionStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

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
    userLocation
      ? {
          lat: userLocation.latitude,
          lng: userLocation.longitude,
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPermissionStatus('requesting');
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setPermissionStatus('denied');
          return;
        }
        setPermissionStatus('granted');
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch (err) {
        if (!cancelled) setPermissionStatus('denied');
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
      return directBusinesses
        .filter((b: any) =>
          typeof b.businessLatitude === 'number' &&
          typeof b.businessLongitude === 'number',
        )
        .map((b: any, idx: number) => ({
          leadId: b.placeId ?? `direct-${idx}`,
          source: 'direct' as const,
          businessName: b.businessName ?? 'Unnamed business',
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
          distanceKm: userLocation
            ? haversineKm(userLocation, { latitude: b.businessLatitude, longitude: b.businessLongitude })
            : null,
          scrapedAt: Date.now(),
        }))
        // Hard distance filter — the scrape can surface businesses beyond the
        // requested radius (Outscraper relevance ranking + Places returning
        // 20 nearest regardless of radius hint). Cap by the user's choice so
        // the header copy ("X businesses within Y km") is honest.
        // Only filter when we know user location AND the radius is set.
        .filter((b) => {
          if (!userLocation) return true;
          if (b.distanceKm == null) return true;
          return b.distanceKm <= radiusKm;
        })
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
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
          businessName: p.businessName ?? 'Unnamed business',
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
          distanceKm: userLocation ? haversineKm(userLocation, { latitude: p.latitude, longitude: p.longitude }) : null,
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
        businessName: l.businessName ?? 'Unnamed business',
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
        distanceKm: userLocation ? haversineKm(userLocation, { latitude: l.businessLatitude, longitude: l.businessLongitude }) : null,
        scrapedAt: l.scrapedAt ?? l.createdAt ?? 0,
      });
    }

    return Array.from(merged.values())
      // Hard distance filter — match the header copy. See note in direct
      // branch above. We deliberately do NOT drop pool prospects whose
      // distance is null (no user location) so the map still shows them.
      .filter((b) => {
        if (!userLocation) return true;
        if (b.distanceKm == null) return true;
        return b.distanceKm <= radiusKm;
      })
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }, [directBusinesses, scrapedLeads, poolProspects, userLocation, radiusKm]);

  // Categories actually present on the map (for the legend)
  const activeCategories = useMemo(() => {
    const set = new Set<CategoryKey>();
    pinned.forEach((p) => set.add(p.category));
    return Array.from(set);
  }, [pinned]);

  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.animateToRegion(
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      },
      400,
    );
  }, [userLocation]);

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
          'Not yet in pool',
          "This business hasn't been added to the prospect pool yet. Pool prospects appear here after a background scrape runs. Try opening Discover from the main Leads tab.",
        );
        return;
      }
      setReservingId(biz.leadId);
      try {
        await reserveProspect({ prospectId: biz.leadId as any });
        Alert.alert(
          "Reserved",
          `${biz.businessName} is yours for the next 24 hours. Tap Directions to go interview them.`,
        );
      } catch (err: any) {
        const msg = err?.message ?? "Could not reserve this prospect.";
        if (/Cannot reserve.*reserved/.test(msg)) {
          Alert.alert("Already taken", "Another creator reserved this prospect just now. Try a different one.");
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

  const initialRegion: Region = userLocation
    ? { latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }
    : FALLBACK_REGION;

  const activeLead = activeLeadId ? pinned.find((l) => l.leadId === activeLeadId) ?? null : null;
  // Loading only matters when we DON'T have direct data. If the scrape passed
  // businesses via URL params, we already have everything we need.
  const isLoading =
    permissionStatus === 'requesting' ||
    (directBusinesses.length === 0 && scrapedLeads === undefined);

  const headerSub = useMemo(() => {
    if (isLoading) return 'Loading nearby businesses to interview…';
    if (pinned.length === 0) return `No nearby businesses yet — try widening the radius or a different category.`;
    const cat = categoryQuery && categoryQuery !== 'businesses' ? ` ${categoryQuery}` : '';
    const radiusLabel = radiusKm < 1 ? `${Math.round(radiusKm * 1000)} m` : `${radiusKm} km`;
    return `${pinned.length}${cat} business${pinned.length === 1 ? '' : 'es'} within ${radiusLabel}. Pin colors show categories.`;
  }, [isLoading, pinned.length, categoryQuery, radiusKm]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      {/* Editorial header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => router.replace('/(app)/leads')}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: colors.paper3,
              borderWidth: 1, borderColor: colors.rule,
              alignItems: 'center', justifyContent: 'center',
            }}
            accessibilityLabel="Back to leads"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={18} color={colors.ink} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Label tracking={1.8}>NEARBY TO INTERVIEW</Label>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <Display size="md">Fresh finds </Display>
          <Display size="md" italic color={colors.accent}>around you.</Display>
        </View>
        <Body size="sm" color={colors.ink2} style={{ marginTop: 6 }}>
          {headerSub}
        </Body>
      </View>

      <Rule strong />

      {/* Map area */}
      <View style={{ width: '100%', height: 340, backgroundColor: colors.paper2 }}>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <>
            <MapView
              ref={(r) => { mapRef.current = r; }}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              style={{ width: '100%', height: '100%' }}
              initialRegion={initialRegion}
              showsUserLocation={permissionStatus === 'granted'}
              showsMyLocationButton={false}
            >
              {pinned.map((biz) => {
                const style = CATEGORY_STYLES[biz.category];
                return (
                  <Marker
                    key={biz.leadId}
                    coordinate={{ latitude: biz.latitude, longitude: biz.longitude }}
                    onPress={() => setActiveLeadId(biz.leadId)}
                    title={biz.businessName}
                    description={biz.businessCategory ?? undefined}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <View style={{
                        width: 34, height: 34, borderRadius: 17,
                        backgroundColor: style.color,
                        borderWidth: 2, borderColor: '#FFFFFF',
                        alignItems: 'center', justifyContent: 'center',
                        shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 2 },
                        elevation: 4,
                      }}>
                        <Ionicons name={style.icon} size={16} color="#FFFFFF" />
                      </View>
                      <View style={{
                        width: 0, height: 0,
                        borderLeftWidth: 6, borderRightWidth: 6,
                        borderTopWidth: 8,
                        borderLeftColor: 'transparent', borderRightColor: 'transparent',
                        borderTopColor: style.color,
                        marginTop: -2,
                      }} />
                    </View>
                  </Marker>
                );
              })}
            </MapView>

            {/* Sticky legend top-right */}
            {activeCategories.length > 0 && (
              <View style={{
                position: 'absolute', top: 12, right: 12,
                backgroundColor: 'rgba(252, 250, 245, 0.96)',
                borderColor: colors.rule, borderWidth: 1,
                borderRadius: radius.sm,
                paddingVertical: 8, paddingHorizontal: 10,
                maxWidth: 180,
              }}>
                <Text style={{
                  fontFamily: fonts.monoMed, fontSize: 9, letterSpacing: 1.2,
                  color: colors.ink3, textTransform: 'uppercase', marginBottom: 6,
                }}>
                  Categories
                </Text>
                {activeCategories.map((cat) => {
                  const s = CATEGORY_STYLES[cat];
                  return (
                    <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <View style={{
                        width: 14, height: 14, borderRadius: 7,
                        backgroundColor: s.color,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name={s.icon} size={8} color="#FFFFFF" />
                      </View>
                      <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink2, letterSpacing: 0.3 }} numberOfLines={1}>
                        {s.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>

      {/* Permission off banner */}
      {permissionStatus === 'denied' ? (
        <View style={{ marginHorizontal: 20, marginTop: 10 }}>
          <Door
            caption="LOCATION"
            label="Enable location to sort by distance"
            variant="ghost"
            onPress={() => Linking.openSettings()}
            rightIcon={<Ionicons name="settings-outline" size={18} color={colors.ink} style={{ marginLeft: 12 }} />}
          />
        </View>
      ) : null}

      {/* List below map */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <Label tracking={1.8}>{permissionStatus === 'granted' ? 'NEAREST FIRST' : 'ALL NEARBY'}</Label>
          {pinned.length > 0 ? (
            <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink3, letterSpacing: 0.6 }}>
              {pinned.length} pinned
            </Text>
          ) : null}
        </View>

        {!isLoading && pinned.length === 0 ? (
          <Card large style={{ padding: 22, alignItems: 'center' }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: colors.paper2,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons
                name={dataShape.outscraperRows > 0 ? 'alert-circle-outline' : 'search-outline'}
                size={26}
                color={dataShape.outscraperRows > 0 ? colors.warn : colors.ink3}
              />
            </View>
            <View style={{ marginTop: 10, alignItems: 'center' }}>
              {dataShape.outscraperRows > 0 && dataShape.withCoords === 0 ? (
                <>
                  <Display size="sm">Backend missing </Display>
                  <Display size="sm" italic color={colors.warn}>coordinates.</Display>
                </>
              ) : (
                <>
                  <Display size="sm">Nothing to interview </Display>
                  <Display size="sm" italic color={colors.accent}>yet.</Display>
                </>
              )}
            </View>
            <Body size="sm" color={colors.ink3} style={{ textAlign: 'center', marginTop: 6, maxWidth: 280 }}>
              {dataShape.outscraperRows > 0 && dataShape.withCoords === 0
                ? `The team found ${dataShape.outscraperRows} scraped business${dataShape.outscraperRows === 1 ? '' : 'es'}, but the backend isn't returning latitude/longitude fields. Ask the web team to restore the listScrapedLeads return shape.`
                : 'Tap Find Local Business again with a wider radius or a different category to add more pins here.'}
            </Body>
            <View style={{ marginTop: 14, alignSelf: 'stretch' }}>
              <Door
                caption="TRY AGAIN"
                label="Back to leads"
                variant="solid"
                onPress={() => router.replace('/(app)/leads')}
                rightIcon={<Ionicons name="arrow-back" size={16} color={colors.paper3} style={{ marginLeft: 8 }} />}
              />
            </View>
          </Card>
        ) : null}

        {(activeLead ? [activeLead, ...pinned.filter((l) => l.leadId !== activeLead.leadId)] : pinned).map((biz) => {
          const isActive = activeLeadId === biz.leadId;
          const style = CATEGORY_STYLES[biz.category];
          return (
            <TouchableOpacity
              key={biz.leadId}
              onPress={() => {
                setActiveLeadId(biz.leadId);
                mapRef.current?.animateToRegion(
                  { latitude: biz.latitude, longitude: biz.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
                  500,
                );
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${biz.businessName}, ${formatDistance(biz.distanceKm)} away`}
            >
              <Card padded={false} large style={{
                padding: 14,
                borderColor: isActive ? colors.ink : colors.rule,
                borderLeftWidth: isActive ? 3 : 1,
                borderLeftColor: isActive ? style.color : colors.rule,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: radius.sm,
                    backgroundColor: style.color,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={style.icon} size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Body size="md" weight="bold" color={colors.ink} numberOfLines={1}>
                      {biz.businessName}
                    </Body>
                    <Body size="xs" color={colors.ink3} numberOfLines={1} style={{ marginTop: 1 }}>
                      {[biz.businessCategory, biz.businessCity].filter(Boolean).join(' · ') || biz.businessAddress || '—'}
                    </Body>
                    {biz.businessRating != null ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name="star" size={11} color={colors.warn} />
                        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.ink2, letterSpacing: 0.3 }}>
                          {biz.businessRating.toFixed(1)}
                          {biz.businessReviewCount != null ? ` · ${biz.businessReviewCount}` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{
                      fontFamily: fonts.serif,
                      fontSize: 18,
                      color: colors.ink,
                      letterSpacing: -0.2,
                    }}>
                      {formatDistance(biz.distanceKm)}
                    </Text>
                    {biz.distanceKm == null ? (
                      <Text style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.ink3, letterSpacing: 0.6, marginTop: 2 }}>
                        DISTANCE OFF
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Inline actions when this row is active */}
                {isActive ? (
                  <>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Door
                          caption="GO"
                          label="Directions"
                          variant="solid"
                          onPress={() => goToDirections(biz)}
                          rightIcon={<Ionicons name="navigate" size={16} color={colors.paper3} style={{ marginLeft: 8 }} />}
                        />
                      </View>
                      {biz.businessPhone ? (
                        <View style={{ flex: 1 }}>
                          <Door
                            caption="CALL"
                            label="Phone"
                            variant="ghost"
                            onPress={() => callBusiness(biz)}
                            rightIcon={<Ionicons name="call-outline" size={16} color={colors.ink} style={{ marginLeft: 8 }} />}
                          />
                        </View>
                      ) : null}
                    </View>
                    {/* P2 — Reserve action. Renders for pool-backed prospects; URL-data
                       businesses get a hint that they need a pool entry to be reservable. */}
                    <View style={{ marginTop: 8 }}>
                      <Door
                        caption={reservingId === biz.leadId ? "RESERVING…" : "RESERVE"}
                        label="I'll interview this"
                        variant="accent"
                        loading={reservingId === biz.leadId}
                        disabled={reservingId === biz.leadId}
                        onPress={() => handleReserve(biz)}
                        rightIcon={<Ionicons name="bookmark-outline" size={16} color="#fff" style={{ marginLeft: 8 }} />}
                      />
                    </View>
                    {/* Start the interview with this business's scraped details
                       already filled in, instead of retyping them on a phone in
                       front of the owner. Legacy-leads rows also carry
                       prospectLeadId so the backend attaches the interview to
                       THIS record rather than inserting a duplicate lead. */}
                    <View style={{ marginTop: 8 }}>
                      <Door
                        caption="INTERVIEW"
                        label="Start with these details"
                        variant="ghost"
                        onPress={() => startInterview(biz)}
                        rightIcon={<Ionicons name="arrow-forward" size={16} color={colors.ink} style={{ marginLeft: 8 }} />}
                      />
                    </View>
                  </>
                ) : null}
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
