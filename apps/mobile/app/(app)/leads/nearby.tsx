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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors, fonts, radius } from '../../../theme/tokens';
import { Display, Body, Label, Door, Card, Rule, Avatar } from '../../../components/ui/primitives';
import { openDirections } from '../../../services/links';

type GeocodedLead = {
  leadId: string;
  businessName: string;
  businessAddress: string | null;
  businessCity: string | null;
  ownerPhone: string | null;
  status: string;
  isHot: boolean;
  submitterName: string | null;
  submitterImage: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
};

// Manila as a sensible fallback when GPS is unavailable
const FALLBACK_REGION: Region = {
  latitude: 14.5995,
  longitude: 120.9842,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

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

function fullAddress(lead: { businessAddress: string | null; businessCity: string | null }): string | null {
  const parts = [lead.businessAddress, lead.businessCity].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(', ') : null;
}

export default function NearbyLeadsScreen() {
  const router = useGuardedRouter();
  const mapRef = useRef<MapView | null>(null);

  // Skip until Convex has an authenticated session — listForMobileCRM calls
  // requireAuth(), which throws (as a generic "Server Error") otherwise.
  const { isAuthenticated } = useConvexAuth();
  const data = useQuery(
    api.leads.listForMobileCRM,
    isAuthenticated ? { statusFilter: 'all' } : 'skip',
  );

  const [permissionStatus, setPermissionStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
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

  // Step 1: ask for location permission, get current GPS once
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
        submitterName: l.submittedBy?.displayName ?? null,
        submitterImage: l.submittedBy?.profileImage ?? null,
        addressString: fullAddress({ businessAddress: l.businessAddress, businessCity: l.businessCity }),
      }))
      .filter((l) => !!l.addressString) as Array<{
        leadId: string;
        businessName: string;
        businessAddress: string | null;
        businessCity: string | null;
        ownerPhone: string | null;
        status: string;
        isHot: boolean;
        submitterName: string | null;
        submitterImage: string | null;
        addressString: string;
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
          const matches = await Location.geocodeAsync(l.addressString);
          if (matches && matches[0]) {
            const m = matches[0];
            const distanceKm = userLocation
              ? haversineKm(userLocation, { latitude: m.latitude, longitude: m.longitude })
              : null;
            results.push({
              leadId: l.leadId,
              businessName: l.businessName,
              businessAddress: l.businessAddress,
              businessCity: l.businessCity,
              ownerPhone: l.ownerPhone,
              status: l.status,
              isHot: l.isHot,
              submitterName: l.submitterName,
              submitterImage: l.submitterImage,
              latitude: m.latitude,
              longitude: m.longitude,
              distanceKm,
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
  }, [leadsWithAddresses, userLocation]);

  // Center map on user once GPS comes in
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

  const openInExternalMaps = (lead: GeocodedLead) => {
    void openDirections({
      latitude: lead.latitude,
      longitude: lead.longitude,
      label: lead.businessName,
      address: fullAddress(lead),
    });
  };

  const initialRegion: Region = userLocation
    ? { latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }
    : FALLBACK_REGION;

  const nearestThree = geocoded.slice(0, 3);
  const allWithDistance = geocoded;
  const activeLead = activeLeadId ? geocoded.find((l) => l.leadId === activeLeadId) ?? null : null;

  const isLoading = data === undefined || permissionStatus === 'requesting';

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
            <Label tracking={1.8}>LIVE BUSINESSES</Label>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <Display size="md">Already-interviewed </Display>
          <Display size="md" italic color={colors.accent}>and live.</Display>
        </View>
        <Body size="sm" color={colors.ink2} style={{ marginTop: 6 }}>
          {permissionStatus === 'denied'
            ? 'Location off — showing the map without your position.'
            : isLoading
              ? 'Finding your location and plotting team leads…'
              : `${geocoded.length} of ${leadsWithAddresses.length} mappable lead${leadsWithAddresses.length === 1 ? '' : 's'}.`}
        </Body>
      </View>

      <Rule strong />

      {/* Map area */}
      <View style={{ width: '100%', height: 320, backgroundColor: colors.paper2 }}>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <MapView
            ref={(r) => { mapRef.current = r; }}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={{ width: '100%', height: '100%' }}
            initialRegion={initialRegion}
            showsUserLocation={permissionStatus === 'granted'}
            showsMyLocationButton={false}
          >
            {geocoded.map((lead) => (
              <Marker
                key={lead.leadId}
                coordinate={{ latitude: lead.latitude, longitude: lead.longitude }}
                onPress={() => setActiveLeadId(lead.leadId)}
                pinColor={lead.isHot ? '#B43A1F' : '#1F3654'}
                title={lead.businessName}
                description={fullAddress(lead) ?? undefined}
              />
            ))}
          </MapView>
        )}
      </View>

      {/* Geocoding progress strip */}
      {geocodingProgress.total > 0 && geocodingProgress.done < geocodingProgress.total ? (
        <View style={{ paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.paper2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={{ fontFamily: fonts.monoMed, fontSize: 10, letterSpacing: 1.2, color: colors.ink2, textTransform: 'uppercase' }}>
            Plotting {geocodingProgress.done} / {geocodingProgress.total}
          </Text>
        </View>
      ) : null}

      {geocodeError ? (
        <View style={{
          marginHorizontal: 20, marginTop: 10, padding: 12,
          backgroundColor: colors.warnBg,
          borderColor: colors.warn, borderWidth: 1,
          borderRadius: radius.sm,
        }}>
          <Body size="sm" weight="medium" color={colors.warn}>{geocodeError}</Body>
        </View>
      ) : null}

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

      {/* Nearest list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <Label tracking={1.8}>{permissionStatus === 'granted' ? 'NEAREST FIRST' : 'ALL ON MAP'}</Label>
          {geocoded.length > 0 ? (
            <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink3, letterSpacing: 0.6 }}>
              {geocoded.length} pinned
            </Text>
          ) : null}
        </View>

        {!isLoading && geocoded.length === 0 ? (
          <Card large style={{ padding: 22, alignItems: 'center' }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: colors.paper2,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="map-outline" size={26} color={colors.ink3} />
            </View>
            <View style={{ marginTop: 10, alignItems: 'center' }}>
              <Display size="sm">Nothing to</Display>
              <Display size="sm" italic color={colors.accent}>show yet.</Display>
            </View>
            <Body size="sm" color={colors.ink3} style={{ textAlign: 'center', marginTop: 6, maxWidth: 280 }}>
              Once businesses with full addresses are submitted, they'll appear here on the map.
            </Body>
          </Card>
        ) : null}

        {(activeLead ? [activeLead, ...allWithDistance.filter((l) => l.leadId !== activeLead.leadId)] : allWithDistance).map((lead) => {
          const isActive = activeLeadId === lead.leadId;
          return (
            <TouchableOpacity
              key={lead.leadId}
              onPress={() => {
                setActiveLeadId(lead.leadId);
                mapRef.current?.animateToRegion(
                  { latitude: lead.latitude, longitude: lead.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
                  500,
                );
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${lead.businessName}, ${formatDistance(lead.distanceKm)} away`}
            >
              <Card padded={false} large style={{
                padding: 14,
                borderColor: isActive ? colors.ink : colors.rule,
                borderLeftWidth: isActive ? 3 : 1,
                borderLeftColor: isActive ? colors.accent : colors.rule,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: radius.sm,
                    backgroundColor: lead.isHot ? colors.dangerBg : colors.businessBg,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons
                      name={lead.isHot ? 'flame' : 'business-outline'}
                      size={20}
                      color={lead.isHot ? colors.danger : colors.business}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Body size="md" weight="bold" color={colors.ink} numberOfLines={1}>
                      {lead.businessName}
                    </Body>
                    <Body size="xs" color={colors.ink3} numberOfLines={1} style={{ marginTop: 1 }}>
                      {fullAddress(lead)}
                    </Body>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{
                      fontFamily: fonts.serif,
                      fontSize: 18,
                      color: colors.ink,
                      letterSpacing: -0.2,
                    }}>
                      {formatDistance(lead.distanceKm)}
                    </Text>
                    {lead.distanceKm == null ? (
                      <Text style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.ink3, letterSpacing: 0.6, marginTop: 2 }}>
                        DISTANCE OFF
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Submitter chip */}
                {lead.submitterName ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
                    {lead.submitterImage ? (
                      <Image source={{ uri: lead.submitterImage }} style={{ width: 22, height: 22, borderRadius: 11 }} />
                    ) : (
                      <Avatar name={lead.submitterName} size={22} bg={colors.accentBg} fg={colors.accentInk} />
                    )}
                    <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink3, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      Submitted by {lead.submitterName}
                    </Text>
                  </View>
                ) : null}

                {/* Inline actions when this row is active */}
                {isActive ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Door
                        caption="OPEN"
                        label="In Google Maps"
                        variant="solid"
                        onPress={() => openInExternalMaps(lead)}
                        rightIcon={<Ionicons name="navigate" size={16} color={colors.paper3} style={{ marginLeft: 8 }} />}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Door
                        caption="DETAIL"
                        label="View lead"
                        variant="ghost"
                        onPress={() => router.push(`/(app)/leads/${lead.leadId}` as any)}
                        rightIcon={<Ionicons name="arrow-forward" size={16} color={colors.ink} style={{ marginLeft: 8 }} />}
                      />
                    </View>
                  </View>
                ) : null}
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
