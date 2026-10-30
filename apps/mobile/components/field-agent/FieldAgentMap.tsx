import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Linking, Modal, PanResponder, Platform, Pressable, ScrollView,
  StyleSheet, View, useWindowDimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type MapViewProps, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api, type Id } from '@tendso/convex-client';
import { commissionFor } from '@tendso/shared/pricing';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useWorkAreaLocation } from '../../hooks/useWorkAreaLocation';
import { useMobileAccount } from '../../hooks/useMobileAccount';
import { useNetwork } from '../../providers/NetworkProvider';
import { openDirections } from '../../services/links';
import { mapDistanceLabel, mapSearchArea, type WorkAreaAccount } from '../../services/workArea';
import {
  distanceKm, isInViewport, mergeMapShops, publicImage, shopPrefill, shopStatus, viewportBounds, type CommunityFind,
  type FieldAgentShop, type MapProspect,
} from '../../services/fieldAgentMap';
import { Avatar, Banner, Button, Text, TextLink, formatPeso } from '../v2';
import { ShopImage } from '../ShopImage';
import { colors, radius, shadow, space, type as typeScale } from '../../theme/v2';

interface MapCreator extends WorkAreaAccount {
  _id: string;
  clerkId?: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  certifiedAt?: number;
}

export interface FieldAgentMapProps {
  creator: MapCreator;
  userImage?: string | null;
  monthlyEarnings?: number;
  unreadCount: number;
  topNotice?: ReactNode;
}

const FALLBACK_REGION: Region = {
  latitude: 14.5995, longitude: 120.9842, latitudeDelta: 0.5, longitudeDelta: 0.5,
};
const EMPTY_PROSPECTS: MapProspect[] = [];
const regionForArea = (area: { latitude: number; longitude: number } | null): Region => area
  ? { latitude: area.latitude, longitude: area.longitude, latitudeDelta: 0.055, longitudeDelta: 0.055 } : FALLBACK_REGION;
const QUIET_MAP: NonNullable<MapViewProps['customMapStyle']> = [
  { elementType: 'geometry', stylers: [{ color: '#E9E9E3' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B6A63' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D3DCE3' }] },
];
type MapSheetPosition = 'collapsed' | 'preview' | 'expanded';
type MapSheetHeights = Record<MapSheetPosition, number>;

/** Only the header owns a drag gesture; the shop list owns its own scrolling. */
function useMapSheet(heights: MapSheetHeights, accountId: string) {
  const [position, setPosition] = useState<MapSheetPosition>('preview');
  const animatedHeight = useRef(new Animated.Value(heights.preview)).current;
  const actualHeight = useRef(heights.preview);
  const dragStart = useRef(heights.preview);
  const reduceMotion = useRef(false);
  const live = useRef({ heights, position });
  live.current = { heights, position };
  const snapTo = useCallback((next: MapSheetPosition, animate = true) => {
    setPosition(next);
    animatedHeight.stopAnimation();
    const target = live.current.heights[next];
    if (!animate || reduceMotion.current) animatedHeight.setValue(target);
    else Animated.timing(animatedHeight, { toValue: target, duration: 200, useNativeDriver: false }).start();
  }, [animatedHeight]);
  const snapRef = useRef(snapTo);
  snapRef.current = snapTo;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => {
      animatedHeight.stopAnimation();
      dragStart.current = actualHeight.current;
    },
    onPanResponderMove: (_, gesture) => {
      const bounds = live.current.heights;
      animatedHeight.setValue(Math.max(bounds.collapsed, Math.min(bounds.expanded, dragStart.current - gesture.dy)));
    },
    onPanResponderRelease: (_, gesture) => {
      const bounds = live.current.heights;
      const projected = dragStart.current - gesture.dy - gesture.vy * 100;
      const positions: MapSheetPosition[] = ['collapsed', 'preview', 'expanded'];
      const nearest = positions.reduce((best, next) => Math.abs(bounds[next] - projected) < Math.abs(bounds[best] - projected) ? next : best);
      snapRef.current(nearest);
    },
    onPanResponderTerminate: () => snapRef.current(live.current.position),
    onPanResponderTerminationRequest: () => false,
  }), [animatedHeight]);

  useEffect(() => {
    const listener = animatedHeight.addListener(({ value }) => { actualHeight.current = value; });
    return () => { animatedHeight.stopAnimation(); animatedHeight.removeListener(listener); };
  }, [animatedHeight]);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) reduceMotion.current = value; }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      reduceMotion.current = value;
      if (value) snapRef.current(live.current.position, false);
    });
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    snapRef.current(live.current.position, false);
  }, [heights.collapsed, heights.preview, heights.expanded]);
  useEffect(() => { snapRef.current('preview', false); }, [accountId]);
  return { position, snapTo, animatedHeight, panHandlers: pan.panHandlers };
}

/** Section 03: the map is home; the Finds tab remains a second view of real shops. */
export function FieldAgentMap({ creator, userImage, monthlyEarnings, unreadCount, topNotice }: FieldAgentMapProps) {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { isAuthenticated } = useConvexAuth();
  const { isConnected } = useNetwork();
  const { isAdmin } = useMobileAccount();
  const location = useWorkAreaLocation();
  const savedArea = useMemo(() => mapSearchArea(creator), [creator.workCity, creator.workLatitude, creator.workLongitude, creator.workLocationSource]);
  const [areaMode, setAreaMode] = useState<'saved' | 'device'>('saved');
  const area = areaMode === 'saved' && savedArea ? savedArea : location.area;
  const [settledViewport, setSettledViewport] = useState(() => ({ creatorId: creator._id, region: regionForArea(area) }));
  const viewport = settledViewport.creatorId === creator._id ? settledViewport.region : regionForArea(area);
  const bounds = useMemo(() => viewportBounds(viewport)!,
    [viewport.latitude, viewport.longitude, viewport.latitudeDelta, viewport.longitudeDelta]);
  const [areaMenu, setAreaMenu] = useState(false);
  const [filter, setFilter] = useState<'all' | 'needs' | 'mine'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visitingId, setVisitingId] = useState<string | null>(null);
  const [pendingShops, setPendingShops] = useState<Array<FieldAgentShop & { actorKey: string }>>([]);
  const [clockVersion, setClockVersion] = useState(0);
  const [mapHeight, setMapHeight] = useState(height);
  const map = useRef<MapView | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPool = useRef<{ actorKey: string; rows: MapProspect[] } | null>(null);
  const actorKey = `${creator._id}:${isAuthenticated}`;
  const actor = useRef(actorKey);
  actor.current = actorKey;
  const canAct = isAuthenticated && isConnected !== false && !!creator.certifiedAt;

  const crm = useQuery(api.leads.listForMobileCRM, isAuthenticated ? { statusFilter: 'all' } : 'skip');
  const viewportResult = useQuery(api.prospects.searchViewport, isAuthenticated
    ? { ...bounds, limit: 100 } : 'skip');
  if (isAuthenticated && viewportResult !== undefined) previousPool.current = { actorKey, rows: viewportResult.prospects };
  const prospects = viewportResult?.prospects
    ?? (previousPool.current?.actorKey === actorKey ? previousPool.current.rows : EMPTY_PROSPECTS);
  const reservations = useQuery(api.prospects.listMyReservations, isAuthenticated ? {} : 'skip');
  const pricing = useQuery(api.submissions.getPricingContext,
    isAuthenticated ? { creatorId: creator._id as Id<'creators'> } : 'skip');
  const reserve = useMutation(api.prospects.reserve);
  const visit = useMutation(api.leads.visitCommunityFind);

  const knownShops = useMemo(() => {
    const merged = mergeMapShops((prospects ?? []) as MapProspect[], (reservations ?? []) as MapProspect[],
      (crm?.leads ?? []) as CommunityFind[], area, null);
    // Keep a successful reservation visible during the two live-query updates.
    for (const pending of pendingShops) {
      if (pending.actorKey === actorKey && !merged.some((shop) => shop.id === pending.id && shop.source === pending.source)
        && pending.claimExpiresAt != null && pending.claimExpiresAt > Date.now()) {
        const distance = area ? distanceKm(area, pending) : null;
        merged.push({ ...pending, distanceKm: distance, distanceLabel: mapDistanceLabel(distance, area) });
      }
    }
    return merged;
  }, [prospects, reservations, crm?.leads, area, pendingShops, clockVersion, actorKey]);
  const shops = useMemo(() => knownShops.filter((shop) => isInViewport(shop, bounds)), [knownShops, bounds]);
  const visibleShops = shops.filter((shop) => filter === 'mine' ? shop.isMine
    : filter === 'needs' ? shop.needsWebsite === true && !shop.hasLiveWebsite : true);
  const selected = knownShops.find((shop) => `${shop.source}:${shop.id}` === selectedId) ?? null;
  const needsCount = shops.filter((shop) => shop.needsWebsite === true && !shop.hasLiveWebsite).length;
  const mineCount = shops.filter((shop) => shop.isMine).length;
  const refreshing = isAuthenticated && viewportResult === undefined;
  const loading = isAuthenticated && shops.length === 0 && (crm === undefined || viewportResult === undefined);
  const topInset = isAdmin ? space.sm : insets.top + space.sm;
  const expandedHeight = Math.max(180, mapHeight - topInset - 56);
  const sheet = useMapSheet({ collapsed: 56, expanded: expandedHeight,
    preview: Math.min(expandedHeight, selected ? Math.max(330, mapHeight * 0.58) : 350) }, creator._id);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => {
    if (viewportTimer.current) clearTimeout(viewportTimer.current);
    viewportTimer.current = null;
  }, [actorKey]);
  useEffect(() => {
    setAreaMode('saved'); setSelectedId(null); setPendingShops([]); setError(null); setVisitingId(null); busy.current = false;
  }, [creator._id]);
  useEffect(() => {
    setPendingShops([]); setSelectedId(null);
    if (viewportTimer.current) clearTimeout(viewportTimer.current);
    viewportTimer.current = null;
    const region = regionForArea(area);
    setSettledViewport({ creatorId: creator._id, region });
    map.current?.animateToRegion(region, 350);
  }, [area, creator._id]);
  useEffect(() => {
    if (selectedId && !selected && viewportResult !== undefined && crm !== undefined && reservations !== undefined && !busy.current)
      setSelectedId(null);
  }, [selectedId, selected, viewportResult, crm, reservations, visitingId]);
  useEffect(() => {
    const expiries = knownShops.map((shop) => shop.claimExpiresAt).filter((expiry): expiry is number => expiry != null && expiry > Date.now());
    if (!expiries.length) return;
    const timer = setTimeout(() => setClockVersion((value) => value + 1), Math.min(...expiries) - Date.now() + 50);
    return () => clearTimeout(timer);
  }, [knownShops]);
  useEffect(() => {
    if (!pendingShops.length) return;
    const remaining = pendingShops.filter((pending) => pending.source === 'pool'
      ? !(reservations ?? []).some((item) => String(item._id) === pending.id)
      : !(crm?.leads ?? []).some((item: CommunityFind) => String(item._id) === pending.id && item.claimedBy?.isMine));
    if (remaining.length !== pendingShops.length) setPendingShops(remaining);
  }, [pendingShops, reservations, crm?.leads]);

  const focus = (shop: FieldAgentShop) => {
    setSelectedId(`${shop.source}:${shop.id}`); setError(null);
    if (sheet.position === 'collapsed') sheet.snapTo('preview');
    map.current?.animateToRegion({ latitude: shop.latitude - 0.0035, longitude: shop.longitude,
      latitudeDelta: 0.018, longitudeDelta: 0.018 }, 350);
  };
  const startInterview = (shop: FieldAgentShop) => {
    if (!canAct || !shop.canInterview || busy.current) return;
    router.push({ pathname: '/(app)/submit/info', params: shopPrefill(shop) } as never);
  };
  const markVisiting = async (shop: FieldAgentShop) => {
    if (!canAct || !shop.canVisit || busy.current) return;
    busy.current = true; setVisitingId(shop.id); setError(null);
    const initiatingActor = actor.current;
    try {
      const expires = shop.source === 'pool'
        ? (await reserve({ prospectId: shop.id as Id<'prospects'> }), Date.now() + 24 * 60 * 60 * 1000)
        : (await visit({ leadId: shop.id as Id<'leads'> })).claimExpiresAt;
      if (!mounted.current || actor.current !== initiatingActor) return;
      setPendingShops((previous) => [...previous.filter((item) => item.id !== shop.id),
        { ...shop, actorKey: initiatingActor, isMine: true, canVisit: false, canInterview: true, claimExpiresAt: expires }]);
    } catch (cause) {
      if (mounted.current && actor.current === initiatingActor)
        setError(cause instanceof Error ? cause.message.replace(/^.*?Uncaught Error: /, '') : 'Could not reserve this shop. Please try again.');
    } finally {
      if (mounted.current && actor.current === initiatingActor) { busy.current = false; setVisitingId(null); }
    }
  };
  const chooseDevice = () => {
    setAreaMenu(false); setAreaMode('device'); setSelectedId(null);
    void location.requestCurrentLocation();
  };
  const settleViewport = useCallback((region: Region) => {
    if (!isAuthenticated || actor.current !== actorKey || !viewportBounds(region)) return;
    const nextRegion = { latitude: region.latitude, longitude: region.longitude,
      latitudeDelta: region.latitudeDelta, longitudeDelta: region.longitudeDelta };
    if (viewportTimer.current) clearTimeout(viewportTimer.current);
    const initiatingActor = actorKey;
    viewportTimer.current = setTimeout(() => {
      viewportTimer.current = null;
      if (!mounted.current || actor.current !== initiatingActor) return;
      setSettledViewport((current) => current.creatorId === creator._id
        && current.region.latitude === nextRegion.latitude && current.region.longitude === nextRegion.longitude
        && current.region.latitudeDelta === nextRegion.latitudeDelta && current.region.longitudeDelta === nextRegion.longitudeDelta
        ? current : { creatorId: creator._id, region: nextRegion });
    }, 350);
  }, [actorKey, creator._id, isAuthenticated]);
  const selectFilter = (next: typeof filter) => { setFilter(filter === next ? 'all' : next); setSelectedId(null); };

  return (
    <View style={styles.root} onLayout={(event) => setMapHeight(event.nativeEvent.layout.height)}>
      <MapView
        ref={(instance) => { map.current = instance; }} style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={regionForArea(area)} onRegionChangeComplete={settleViewport}
        customMapStyle={QUIET_MAP} mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        userInterfaceStyle="light" showsPointsOfInterest={false} showsBuildings={false}
        showsCompass={false} toolbarEnabled={false} showsMyLocationButton={false}
        showsUserLocation={!!location.currentLocation} onPress={() => setSelectedId(null)}
      >
        {visibleShops.map((shop) => <PhotoPin key={`${shop.source}:${shop.id}`} shop={shop}
          selected={selectedId === `${shop.source}:${shop.id}`} onPress={() => focus(shop)} />)}
      </MapView>

      <View style={[styles.chrome, { top: topInset }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open my profile" onPress={() => router.push('/(app)/(tabs)/profile')} style={styles.profileHit}>
            <Avatar uri={publicImage(creator.profileImage) || userImage} name={creator.firstName} size={48} ring />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={monthlyEarnings == null ? 'Open earnings' : `${formatPeso(monthlyEarnings)} earned this month. Open earnings`}
            onPress={() => router.push('/(app)/(tabs)/wallet')} style={[styles.earnings, shadow.soft]}>
            <Text variant="bodyLg" weight="bold" style={styles.earningsText}>{monthlyEarnings == null ? '—' : formatPeso(monthlyEarnings)}</Text>
            <Text variant="label" tone="muted" style={styles.earningsText}>this month</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            onPress={() => router.push('/(app)/notifications')} style={[styles.round, shadow.soft]}>
            <Ionicons name="notifications-outline" size={23} color={colors.ink} />
            {unreadCount > 0 ? <View style={styles.notificationDot} /> : null}
          </Pressable>
        </View>
        <View style={styles.filters}>
          <FilterPill label={`Needs a site · ${needsCount}`} on={filter === 'needs'} dashed onPress={() => selectFilter('needs')} />
          <FilterPill label={`Yours · ${mineCount}`} on={filter === 'mine'} onPress={() => selectFilter('mine')} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Map area: ${area?.label ?? 'Choose an area'}. Change area`}
          onPress={() => setAreaMenu(true)} style={[styles.area, shadow.soft]}>
          <Ionicons name="location-outline" size={19} color={colors.ink} />
          <Text variant="label" numberOfLines={1} style={styles.flex}>{area?.source === 'work' ? `Distances from ${area.label}` : area ? 'Distances from my location' : 'Choose map area'}</Text>
          {location.isLocating ? <ActivityIndicator size="small" color={colors.ink} /> : <Ionicons name="chevron-down" size={17} color={colors.ink} />}
        </Pressable>
        {topNotice}
        {areaMode === 'device' && (location.permissionStatus === 'denied' || location.permissionStatus === 'unavailable')
          ? <Banner tone="warn" body={savedArea ? `Current location is unavailable. Showing ${savedArea.label}.` : 'Current location is unavailable. You can still browse the shop list.'} /> : null}
        {isConnected === false ? <Banner tone="warn" body="You’re offline. Reconnect to visit a shop." /> : null}
        {refreshing ? <Text variant="label" tone="muted" style={styles.searchStatus} accessibilityLiveRegion="polite">Updating shops in this map area…</Text>
          : viewportResult?.truncated ? <Banner tone="info" body="Showing a limited set of saved shops. Zoom in to see more." /> : null}
      </View>

      <Animated.View style={[styles.sheet, { height: sheet.animatedHeight }]} testID="nearby-shops-sheet">
        <View {...sheet.panHandlers} testID="nearby-shops-sheet-header">
          <Pressable accessibilityRole="button"
            accessibilityLabel={sheet.position === 'collapsed' ? 'Show nearby shops' : sheet.position === 'expanded' ? 'Minimize nearby shops' : 'Show all nearby shops'}
            accessibilityHint="Drag up to see the full shop list or drag down to minimize it."
            accessibilityState={{ expanded: sheet.position === 'expanded' }}
            accessibilityValue={{ text: sheet.position === 'collapsed' ? 'Minimized' : sheet.position === 'expanded' ? 'Full list' : 'Preview' }}
            accessibilityActions={[{ name: 'expand', label: 'Show full shop list' }, { name: 'collapse', label: 'Minimize shops' }, { name: 'preview', label: 'Show shop preview' }]}
            onAccessibilityAction={(event) => {
              const action = event.nativeEvent.actionName;
              if (action === 'expand' || action === 'collapse' || action === 'preview')
                sheet.snapTo(action === 'expand' ? 'expanded' : action === 'collapse' ? 'collapsed' : 'preview');
            }}
            onPress={() => sheet.snapTo(sheet.position === 'collapsed' ? 'preview' : sheet.position === 'preview' ? 'expanded' : 'collapsed')}
            style={styles.grabHit}>
            <View style={styles.grab} />
            {sheet.position === 'collapsed' ? <Text variant="label" numberOfLines={1} style={styles.peekLabel}>{selected?.name ?? 'Nearby shops'}</Text> : null}
            <Ionicons name={sheet.position === 'expanded' ? 'chevron-down' : 'chevron-up'} size={20} color={colors.ink3Text} style={styles.sheetChevron} />
          </Pressable>
          {sheet.position !== 'collapsed' ? <View style={styles.sheetHead}>
            <Text variant="bodyLg" weight="bold" style={styles.flex}>{selected ? 'Shop details' : filter === 'mine' ? 'Your shops in view' : filter === 'needs' ? 'Shops needing a site' : 'Shops in view'}</Text>
            {selected ? <TextLink label="Close shop details" onPress={() => setSelectedId(null)} />
              : <TextLink label="See list" onPress={() => router.push('/(app)/(tabs)/finds' as never)} />}
          </View> : null}
        </View>
        <View style={styles.sheetBody} pointerEvents={sheet.position === 'collapsed' ? 'none' : 'auto'}
          accessibilityElementsHidden={sheet.position === 'collapsed'} importantForAccessibility={sheet.position === 'collapsed' ? 'no-hide-descendants' : 'auto'}>
        {selected ? (
          <ScrollView style={styles.flex} showsVerticalScrollIndicator={false} contentContainerStyle={styles.detail}>
            <View style={styles.detailTop}>
              <ShopPhoto shop={selected} width={110} height={140} />
              <View style={styles.detailText}>
                <Text variant="heading" numberOfLines={3}>{selected.name}</Text>
                <Text variant="label" tone="muted">{selected.distanceLabel}</Text>
                <Text variant="label">{shopStatus(selected)}</Text>
                {selected.spottedBy ? <View style={styles.attribution}>
                  <Avatar uri={selected.spottedBy.profileImage} name={selected.spottedBy.displayName} size={24} />
                  <Text variant="label" tone="muted" style={styles.flex}>Spotted by {selected.spottedBy.displayName}</Text>
                </View> : <Text variant="label" tone="muted">{selected.source === 'pool' ? 'From the shop directory' : 'From the community'}</Text>}
              </View>
            </View>
            {selected.address ? <View style={styles.address}>
              <Ionicons name="location-outline" size={20} color={colors.ink3Text} />
              <Text variant="label" tone="muted" style={styles.flex}>{[selected.address, selected.city].filter(Boolean).join(', ')}</Text>
            </View> : null}
            {selected.canVisit || selected.canInterview ? <View style={styles.priceCard}>
              <View style={styles.cashIcon}><Ionicons name="cash-outline" size={23} color={colors.ink} /></View>
              <View style={styles.flex}>
                <Text variant="body" weight="bold">{pricing ? `Earn up to ${formatPeso(commissionFor(pricing.priceCeiling))}` : 'Earn from every paid site'}</Text>
                <Text variant="label" tone="muted">{pricing
                  ? `${pricing.unlocked ? `Set the price, ${formatPeso(pricing.basePrice)}–${formatPeso(pricing.priceCeiling)}.` : `Site price: ${formatPeso(pricing.basePrice)}.`} You keep half when the owner pays.`
                  : 'Your commission is half the site price, paid after the owner pays.'}</Text>
              </View>
            </View> : null}
            {selected.isMine && selected.claimExpiresAt ? <Text variant="label" tone="muted">Reserved for you until {new Date(selected.claimExpiresAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.</Text> : null}
            {selected.claimedBy && !selected.claimedBy.isMine ? <Text variant="label" tone="muted">{selected.claimedBy.displayName} is visiting this shop.</Text> : null}
            {error ? <Banner tone="danger" body={error} /> : null}
            <View style={styles.actions}>
              {selected.canInterview ? <Button title="Start interview" size="md" style={styles.flex} disabled={!canAct || visitingId != null} onPress={() => startInterview(selected)} />
                : selected.canVisit ? <Button title="I’m visiting" size="md" style={styles.flex} loading={visitingId === selected.id}
                  disabled={!canAct || visitingId != null} onPress={() => { void markVisiting(selected); }} />
                  : selected.source !== 'pool' ? <Button title="View shop" size="md" style={styles.flex} onPress={() => router.push(`/(app)/leads/${selected.id}` as never)} /> : null}
              <Button title="Route" variant="ghost" size="md" fullWidth={false} icon="navigate-outline"
                onPress={() => { void openDirections({ latitude: selected.latitude, longitude: selected.longitude, label: selected.name, address: selected.address, placeId: selected.googlePlaceId }); }} />
            </View>
          </ScrollView>
        ) : (
          <>
            {loading ? <View style={styles.empty}><ActivityIndicator color={colors.ink} /><Text variant="label" tone="muted">Finding nearby shops…</Text></View>
              : visibleShops.length === 0 ? <View style={styles.empty}>
                <Text variant="body" weight="bold">{filter === 'mine' ? 'No reserved shops in view' : filter === 'needs' ? 'No shops confirmed to need a site' : 'No saved shops in view'}</Text>
                <Text variant="label" tone="muted">{filter === 'mine' ? 'Move the map, or choose a shop and tap I’m visiting.'
                  : filter === 'needs' ? 'Try another filter or move the map.' : 'Move the map or spot a local shop to share it with the team.'}</Text>
                <TextLink label="Spot a shop" onPress={() => router.push('/(app)/leads/spot' as never)} />
              </View>
                : sheet.position === 'expanded' ? <ScrollView style={styles.flex} testID="nearby-shops-full-list"
                  showsVerticalScrollIndicator contentContainerStyle={styles.fullList}>
                  {visibleShops.map((shop) => <Pressable key={`${shop.source}:${shop.id}`} onPress={() => focus(shop)}
                    accessibilityRole="button" accessibilityLabel={`${shop.name}, ${shop.distanceLabel}, ${shopStatus(shop)}`}
                    style={[styles.listShop, shadow.soft]}>
                    <ShopPhoto shop={shop} width={80} height={80} />
                    <View style={styles.listShopText}>
                      <Text variant="body" weight="bold" numberOfLines={2}>{shop.name}</Text>
                      <Text variant="label" tone="muted">{shop.distanceLabel}</Text>
                      <Text variant="label">{shopStatus(shop)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.ink3Text} />
                  </Pressable>)}
                </ScrollView>
                  : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
                  {visibleShops.slice(0, 30).map((shop) => <Pressable key={`${shop.source}:${shop.id}`} onPress={() => focus(shop)}
                    accessibilityRole="button" accessibilityLabel={`${shop.name}, ${shop.distanceLabel}, ${shopStatus(shop)}`}
                    style={[styles.shopCard, shadow.soft]}>
                    <ShopPhoto shop={shop} width={184} height={100} />
                    <Text variant="body" weight="bold" numberOfLines={1} style={styles.cardName}>{shop.name}</Text>
                    <Text variant="label" tone="muted" numberOfLines={1}>{shop.distanceLabel}</Text>
                    <Text variant="label" numberOfLines={1}>{shopStatus(shop)}</Text>
                  </Pressable>)}
                </ScrollView>}
          </>
        )}
        </View>
      </Animated.View>

      <Modal visible={areaMenu} transparent animationType="fade" onRequestClose={() => setAreaMenu(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close area selector" onPress={() => setAreaMenu(false)} />
          <View style={[styles.areaMenu, { paddingBottom: Math.max(insets.bottom, space.xl) }]} accessibilityViewIsModal>
            <Text variant="heading">Choose map area</Text>
            {savedArea ? <Button title={`Near ${savedArea.label}`} variant="ghost" icon="location-outline" onPress={() => { setAreaMode('saved'); setSelectedId(null); setAreaMenu(false); }} /> : null}
            <Button title="Use my current location" icon="locate-outline" onPress={chooseDevice} />
            {location.permissionStatus === 'denied' ? <TextLink label="Open location settings" onPress={() => { setAreaMenu(false); void Linking.openSettings(); }} /> : null}
            {location.permissionStatus === 'unavailable' ? <Text variant="label" tone="muted">Current location is unavailable. Try again or use your saved work area.</Text> : null}
            <TextLink label="Cancel" onPress={() => setAreaMenu(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ShopPhoto({ shop, width, height }: { shop: FieldAgentShop; width: number; height: number }) {
  return <ShopImage uri={shop.photoUrl} name={shop.name} category={shop.category} kind={shop.kind} width={width} height={height} decorative />;
}

function PhotoPin({ shop, selected, onPress }: { shop: FieldAgentShop; selected: boolean; onPress: () => void }) {
  const [tracking, setTracking] = useState(true);
  const [imageRevision, setImageRevision] = useState(0);
  const imageFinished = useCallback(() => setImageRevision(value => value + 1), []);
  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), 800);
    return () => clearTimeout(timer);
  }, [shop.photoUrl, shop.category, shop.kind, selected, shop.isMine, imageRevision]);
  const size = selected ? 60 : 48;
  return <Marker coordinate={{ latitude: shop.latitude, longitude: shop.longitude }}
    onPress={(event) => { event.stopPropagation(); onPress(); }}
    anchor={{ x: 0.5, y: selected ? 0.3 : 0.5 }} tracksViewChanges={tracking} zIndex={selected ? 3 : 2}
    accessibilityLabel={`${shop.name}, ${shopStatus(shop)}`}>
    <View style={styles.marker}>
      <View style={[styles.pin, { width: size, height: size, borderRadius: size / 2 },
        selected ? styles.pinSelected : shop.isMine || shop.hasLiveWebsite ? styles.pinYours : shop.needsWebsite === true ? styles.pinNeed : styles.pinUnknown]}>
        <View style={[styles.pinPhoto, { width: size - 10, height: size - 10, borderRadius: (size - 10) / 2 }]}>
          <ShopImage uri={shop.photoUrl} name={shop.name} category={shop.category} kind={shop.kind} width={size - 10} height={size - 10} borderRadius={0}
            decorative onLoad={imageFinished} onError={imageFinished} />
        </View>
      </View>
      {selected ? <View style={styles.pinLabel}><Text variant="label" tone="onDark" numberOfLines={1}>{shop.name}</Text></View> : null}
    </View>
  </Marker>;
}

function FilterPill({ label, on, dashed, onPress }: { label: string; on: boolean; dashed?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress}
    style={[styles.filter, shadow.soft, on ? styles.filterOn : null]}>
    <View style={[styles.filterDot, dashed ? styles.filterDashed : styles.filterMine,
      dashed && on ? { borderColor: colors.onDark } : null]} />
    <Text variant="label" tone={on ? 'onDark' : 'ink'}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E9E9E3' }, flex: { flex: 1, minWidth: 0 },
  chrome: { position: 'absolute', left: space.lg, right: space.lg, gap: space.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  profileHit: { minHeight: 48, minWidth: 48 },
  earnings: { flex: 1, backgroundColor: colors.card, minHeight: 52, paddingHorizontal: space.lg,
    paddingVertical: space.xs, borderRadius: radius.pill, flexDirection: 'row', flexWrap: 'wrap',
    alignItems: 'center', justifyContent: 'center', alignContent: 'center', gap: space.xs },
  earningsText: { textAlign: 'center', lineHeight: typeScale.bodyLg.lineHeight },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', right: 10, top: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.card },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  filter: { minHeight: 48, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.card, borderRadius: radius.pill },
  filterOn: { backgroundColor: colors.ink },
  filterDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.ink },
  filterDashed: { borderStyle: 'dashed' }, filterMine: { backgroundColor: colors.accent },
  area: { minHeight: 48, maxWidth: '90%', alignSelf: 'flex-start', paddingHorizontal: space.md,
    flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.card, borderRadius: radius.pill },
  searchStatus: { alignSelf: 'flex-start', backgroundColor: colors.card, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.card },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden', shadowColor: colors.ink, shadowOffset: { width: 0, height: -6 }, shadowRadius: 16, shadowOpacity: 0.12, elevation: 8 },
  sheetBody: { flex: 1, minHeight: 0 },
  grabHit: { height: 56, alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingHorizontal: 48 },
  grab: { height: 5, width: 40, borderRadius: 3, backgroundColor: colors.ruleStrong },
  peekLabel: { maxWidth: '100%' }, sheetChevron: { position: 'absolute', right: space.lg, top: 18 },
  sheetHead: { paddingHorizontal: space.lg, paddingBottom: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // The viewport grows while dragging; cards keep their natural content height.
  carousel: { alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.lg },
  fullList: { gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.lg },
  listShop: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.card, padding: space.md, borderRadius: radius.card },
  listShopText: { flex: 1, minWidth: 0, gap: space.xs },
  shopCard: { width: 200, borderRadius: radius.card, backgroundColor: colors.card, padding: space.sm, gap: space.xs },
  cardName: { marginTop: space.xs },
  empty: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.sm },
  detail: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  detailTop: { flexDirection: 'row', gap: space.md }, detailText: { flex: 1, gap: space.xs, minWidth: 0 },
  attribution: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  address: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  priceCard: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md },
  cashIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  marker: { alignItems: 'center', padding: 4 },
  pin: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, backgroundColor: colors.card },
  pinSelected: { borderWidth: 4, borderColor: colors.ink }, pinYours: { borderWidth: 4, borderColor: colors.accent },
  pinNeed: { borderColor: colors.ink, borderStyle: 'dashed' }, pinUnknown: { borderColor: colors.ruleStrong },
  pinPhoto: { overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  pinLabel: { marginTop: 4, maxWidth: 220, backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  areaMenu: { padding: space.xl, gap: space.md, backgroundColor: colors.bg, borderTopLeftRadius: radius.tile, borderTopRightRadius: radius.tile },
});
