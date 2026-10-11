import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  BackHandler,
  TextInput,
  Image,
  RefreshControl,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useAction, useConvexAuth } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, fonts, radius } from '../../../theme/tokens';
import { Display, Body, Label, Pill, Card, Rule, Avatar, Door } from '../../../components/ui/primitives';
import { openDirections, canOpenDirections, openExternalUrl } from '../../../services/links';

type StatusFilter = 'all' | 'reserved' | 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

const STATUS_META: Record<string, { label: string; bg: string; ink: string }> = {
  new:       { label: 'New',       bg: colors.businessBg, ink: colors.business },
  contacted: { label: 'Contacted', bg: colors.warnBg,     ink: colors.warn },
  qualified: { label: 'Qualified', bg: '#EDE9FE',         ink: '#6D28D9' },
  converted: { label: 'Converted', bg: colors.accentBg,   ink: colors.accentInk },
  lost:      { label: 'Lost',      bg: colors.dangerBg,   ink: colors.danger },
};

const FILTER_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'reserved',  label: 'Reserved' },
  { key: 'new',       label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'converted', label: 'Converted' },
  { key: 'lost',      label: 'Lost' },
];

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function LeadsScreen() {
  const router = useGuardedRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Outscraper scrape-nearby modal state
  const [showScrape, setShowScrape] = useState(false);
  const [scrapeCategory, setScrapeCategory] = useState('');
  // Default to 1km — the user explicitly asked for hyper-local. Wider radii
  // are an option but rarely useful: Outscraper's relevance ranking surfaces
  // popular far-away businesses ahead of nearby informal ones at high radii.
  const [scrapeRadiusKm, setScrapeRadiusKm] = useState(1);
  const [scraping, setScraping] = useState(false);
  const [scrapePhase, setScrapePhase] = useState<ScrapePhase>('idle');
  const scrapeNearbyAction = useAction(api.outscraper.scrapeNearby);

  const handleScrape = useCallback(async () => {
    setScraping(true);
    setScrapePhase('locating');
    try {
      // Permission + GPS
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location needed',
          'Please grant location permission so we can search businesses near your current position.',
        );
        setScraping(false);
        setScrapePhase('idle');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

      setScrapePhase('searching');
      // Web's deployed outscraper.scrapeNearby uses Outscraper's query+location API,
      // not lat/lng directly. Convert: location = "lat,lng" coord string,
      // query = category (Outscraper requires a non-empty query, so fall back to "businesses").
      const result = await scrapeNearbyAction({
        location: `${pos.coords.latitude},${pos.coords.longitude}`,
        query: scrapeCategory.trim() || 'businesses',
        radiusKm: scrapeRadiusKm,
        limit: 20,
      });
      setScrapePhase('saving');
      // Tiny pause so the "saving" stage is perceptible — the action is already done,
      // but the user has been watching the screen and deserves to see the final stage.
      await new Promise((r) => setTimeout(r, 350));
      // No more "X businesses added to your interview list" Alert — route straight
      // to the discover map. The map shows every Outscraper-scraped business as
      // a pin so the creator can pick where to go next.
      setShowScrape(false);
      const catParam = scrapeCategory.trim() || 'businesses';
      const radiusParam = String(scrapeRadiusKm);
      setScrapeCategory('');

      // 2026-05-29 — pass the raw businesses directly to the discover map so
      // it doesn't have to query listScrapedLeads (which has returned empty in
      // prod for unknown reasons). The action now returns the array of
      // businesses with coords; we URL-encode the JSON so the discover screen
      // can render pins from in-memory data, completely bypassing the DB read
      // path. Falls back to the listScrapedLeads query if businesses aren't
      // present (e.g., if someone runs the discover route directly).
      const businessesJSON = encodeURIComponent(JSON.stringify((result as any).businesses ?? []));
      router.push(
        `/(app)/leads/discover?category=${encodeURIComponent(catParam)}&radiusKm=${radiusParam}&data=${businessesJSON}` as any,
      );
      return;
    } catch (err: any) {
      const msg = err?.message ?? 'Could not find businesses near you right now.';
      if (/not authenticated/i.test(msg)) {
        Alert.alert(
          'Please sign in again',
          'Your session has expired. Please log out and back in to use this feature.',
        );
      } else if (/forbidden|admin/i.test(msg)) {
        Alert.alert(
          'Not available yet',
          'This feature is being rolled out — your account isn\'t enabled for it yet. Check back soon.',
        );
      } else if (/OUTSCRAPER_API_KEY/i.test(msg)) {
        Alert.alert(
          'Temporarily unavailable',
          'The business-search service is offline right now. Please try again later.',
        );
      } else {
        Alert.alert('Search failed', msg);
      }
    } finally {
      setScraping(false);
      setScrapePhase('idle');
    }
  }, [scrapeCategory, scrapeRadiusKm, scrapeNearbyAction]);

  // When the user picks the Reserved chip we switch to a different data source —
  // reservations live in prospects (state="reserved"), not leads.
  // Both queries call requireAuth() server-side, which THROWS "Not
  // authenticated" (surfacing as a generic "Server Error" that trips the app
  // error boundary) if they run before Clerk's token reaches the Convex client
  // — or after it expires. Skip until Convex reports an authenticated session.
  const { isAuthenticated } = useConvexAuth();

  const reservedProspects = useQuery(
    api.prospects.listMyReservations,
    isAuthenticated && statusFilter === 'reserved' ? {} : 'skip',
  ) as Array<any> | undefined;

  const data = useQuery(
    api.leads.listForMobileCRM,
    !isAuthenticated || statusFilter === 'reserved'
      ? 'skip'
      : {
          search: search || undefined,
          statusFilter,
          onlyMine: onlyMine || undefined,
        },
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace('/(app)/(tabs)');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [router]),
  );

  const stats = data?.stats;
  const leads = data?.leads ?? [];
  const hotLeadCount = useMemo(
    () => leads.filter((l) => l.isHot).length,
    [leads],
  );

  const isReservedView = statusFilter === 'reserved';
  const reservedLoading = isReservedView && reservedProspects === undefined;
  const leadsLoading = !isReservedView && data === undefined;

  if (reservedLoading || leadsLoading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      {/* Editorial header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.replace('/(app)/(tabs)')}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: colors.paper3,
                borderWidth: 1, borderColor: colors.rule,
                alignItems: 'center', justifyContent: 'center',
              }}
              accessibilityLabel="Back to home"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={18} color={colors.ink} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Label tracking={1.8}>TEAM LEADS</Label>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <Display size="md">All leads, </Display>
          <Display size="md" italic color={colors.accent}>every interview.</Display>
        </View>
        <Body size="sm" color={colors.ink2} style={{ marginTop: 8, maxWidth: 320 }}>
          The whole team's hunt — including yours. {stats?.total ?? 0} leads · {hotLeadCount} hot.
        </Body>
      </View>

      <Rule strong />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 600);
            }}
            tintColor={colors.accent}
          />
        }
      >
        {/* Stats strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 14, gap: 10 }}
        >
          <StatTile label="Total"     value={stats?.total ?? 0}     tintBg={colors.businessBg} tintFg={colors.business} />
          <StatTile label="Yours"     value={stats?.mine ?? 0}      tintBg={colors.paper2}     tintFg={colors.ink2} />
          <StatTile label="Hot leads" value={hotLeadCount}          tintBg={colors.dangerBg}   tintFg={colors.danger}  hint="3+ interviews" />
          <StatTile label="Converted" value={stats?.converted ?? 0} tintBg={colors.accentBg}   tintFg={colors.accent} />
        </ScrollView>

        {/* Search bar */}
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.paper3,
            borderColor: colors.rule, borderWidth: 1,
            borderRadius: radius.sm,
            paddingHorizontal: 14, height: 48,
          }}>
            <Ionicons name="search" size={18} color={colors.ink3} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search lead, business, or creator…"
              placeholderTextColor={colors.ink3}
              style={{ flex: 1, marginLeft: 10, fontFamily: fonts.sans, fontSize: 14, color: colors.ink }}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Clear search" hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.ink3} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Business near me — opens the geocoded map view */}
        <View style={{ paddingHorizontal: 20, marginBottom: 8, gap: 8 }}>
          <Door
            caption="ON THE MAP"
            label="See Live Business"
            variant="accent"
            onPress={() => router.push('/(app)/leads/nearby' as any)}
            accessibilityLabel="See businesses on the map that have already been interviewed and have a live website"
            rightIcon={<Ionicons name="map" size={18} color="#fff" style={{ marginLeft: 12 }} />}
          />
          <Door
            caption="DISCOVER"
            label="Find Local Business"
            variant="ghost"
            onPress={() => setShowScrape(true)}
            accessibilityLabel="Find local businesses near you to interview"
            rightIcon={<Ionicons name="search-outline" size={18} color={colors.ink} style={{ marginLeft: 12 }} />}
          />
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          style={{ marginBottom: 14 }}
        >
          <Pill
            label={onlyMine ? '✓ Only mine' : 'Only mine'}
            active={onlyMine}
            onPress={() => setOnlyMine(!onlyMine)}
            accessibilityLabel="Toggle: only my leads"
          />
          {FILTER_CHIPS.map((chip) => (
            <Pill
              key={chip.key}
              label={chip.label}
              active={statusFilter === chip.key}
              onPress={() => setStatusFilter(chip.key)}
              accessibilityLabel={`Filter by ${chip.label}`}
            />
          ))}
        </ScrollView>

        {/* Reserved-prospects view (separate data source from leads) */}
        {isReservedView ? (
          (reservedProspects ?? []).length === 0 ? (
            <View style={{ paddingHorizontal: 28, paddingVertical: 48, alignItems: 'center' }}>
              <View style={{
                width: 60, height: 60, borderRadius: 30,
                backgroundColor: colors.paper2,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="bookmark-outline" size={28} color={colors.ink3} />
              </View>
              <View style={{ marginTop: 12, alignItems: 'center' }}>
                <Display size="sm">No active </Display>
                <Display size="sm" italic color={colors.accent}>reservations.</Display>
              </View>
              <Body size="sm" color={colors.ink3} style={{ textAlign: 'center', marginTop: 6, maxWidth: 280 }}>
                Tap "Find Local Business" then "I'll interview this" to reserve a business for 24 hours.
              </Body>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              {(reservedProspects ?? []).map((p: any) => (
                <ReservedCard
                  key={String(p._id)}
                  prospect={p}
                  onPress={() => {
                    // No detail page yet for reserved prospects — open the native maps app
                    void openDirections({
                      latitude: p.latitude,
                      longitude: p.longitude,
                      label: p.businessName,
                      address: p.address,
                      placeId: p.googlePlaceId,
                    });
                  }}
                />
              ))}
            </View>
          )
        ) : leads.length === 0 ? (
          <View style={{ paddingHorizontal: 28, paddingVertical: 48, alignItems: 'center' }}>
            <View style={{
              width: 60, height: 60, borderRadius: 30,
              backgroundColor: colors.paper2,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="briefcase-outline" size={28} color={colors.ink3} />
            </View>
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <Display size="sm">
                {search || statusFilter !== 'all' || onlyMine ? 'No matches' : 'No leads'}
              </Display>
              <Display size="sm" italic color={colors.accent}>yet.</Display>
            </View>
            <Body size="sm" color={colors.ink3} style={{ textAlign: 'center', marginTop: 6, maxWidth: 280 }}>
              {search || statusFilter !== 'all' || onlyMine
                ? 'Try clearing the search or filter.'
                : 'Customer inquiries on team business websites will appear here.'}
            </Body>
            {(search || statusFilter !== 'all' || onlyMine) && (
              <TouchableOpacity
                style={{ marginTop: 16 }}
                onPress={() => { setSearch(''); setStatusFilter('all'); setOnlyMine(false); }}
                accessibilityLabel="Clear filters"
                accessibilityRole="button"
              >
                <Body size="sm" weight="medium" color={colors.accent}>Clear filters →</Body>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            {leads.map((lead) =>
              lead.hasEnrichedContent ? (
                <SocialCard
                  key={String(lead._id)}
                  lead={lead}
                  onPress={() => router.push(`/(app)/leads/${lead._id}` as any)}
                  onLinkPress={() => {
                    if (lead.externalPreviewUrl) void openExternalUrl(lead.externalPreviewUrl);
                  }}
                />
              ) : (
                <CompactCard
                  key={String(lead._id)}
                  lead={lead}
                  onPress={() => router.push(`/(app)/leads/${lead._id}` as any)}
                />
              ),
            )}
          </View>
        )}
      </ScrollView>

      {/* === Scrape-nearby modal (admin-only Outscraper trigger) === */}
      <Modal
        visible={showScrape}
        transparent
        animationType="slide"
        onRequestClose={() => !scraping && setShowScrape(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={() => !scraping && setShowScrape(false)}
            accessibilityLabel="Close scrape modal"
            accessibilityRole="button"
          />
          <View style={{
            backgroundColor: colors.paper,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: 24,
            paddingBottom: 32,
          }}>
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: colors.rule, alignSelf: 'center', marginBottom: 18,
            }} />

            {scraping ? (
              <ScrapeProgressPanel
                phase={scrapePhase}
                category={scrapeCategory.trim() || 'businesses'}
                radiusKm={scrapeRadiusKm}
              />
            ) : (
              <>
                <Label tracking={1.8}>DISCOVER</Label>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', marginTop: 4, marginBottom: 12 }}>
                  <Display size="md">Find your next </Display>
                  <Display size="md" italic color={colors.accent}>interview.</Display>
                </View>
                <Body size="sm" color={colors.ink2} style={{ marginBottom: 18 }}>
                  Pick the kind of business you want to talk to. We'll use your GPS and pull up to 20 nearby spots that nobody on the team has interviewed yet — go knock on a door.
                </Body>

                {/* Category */}
                <View style={{ marginBottom: 12 }}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: colors.paper3,
                    borderColor: colors.rule, borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 14, height: 52,
                  }}>
                    <Ionicons name="storefront-outline" size={18} color={colors.ink3} />
                    <TextInput
                      value={scrapeCategory}
                      onChangeText={setScrapeCategory}
                      placeholder="restaurants, barbershops, sari-sari…"
                      placeholderTextColor={colors.ink3}
                      style={{ flex: 1, marginLeft: 10, fontFamily: fonts.sans, fontSize: 14, color: colors.ink }}
                      editable={!scraping}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
                    <Label>WHAT KIND OF BUSINESS?</Label>
                  </View>
                </View>

                {/* Radius pills */}
                <View style={{ marginBottom: 18 }}>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {[0.5, 1, 3, 5, 10].map((km) => (
                      <Pill
                        key={km}
                        label={km < 1 ? `${km * 1000} m` : `${km} km`}
                        active={scrapeRadiusKm === km}
                        onPress={() => setScrapeRadiusKm(km)}
                        accessibilityLabel={`Set radius to ${km < 1 ? `${km * 1000} meters` : `${km} kilometers`}`}
                      />
                    ))}
                  </View>
                  <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
                    <Label>RADIUS</Label>
                  </View>
                </View>
              </>
            )}

            <Door
              caption={scraping ? scrapePhaseCaption(scrapePhase) : 'FIND BUSINESSES'}
              label={scraping ? scrapePhaseLabel(scrapePhase) : 'Show me businesses to interview'}
              variant="solid"
              loading={scraping}
              disabled={scraping}
              onPress={handleScrape}
              accessibilityLabel="Find businesses to interview"
            />
            <TouchableOpacity
              onPress={() => !scraping && setShowScrape(false)}
              style={{ alignItems: 'center', marginTop: 14 }}
              accessibilityLabel="Cancel"
              accessibilityRole="button"
              disabled={scraping}
            >
              <Body size="sm" color={scraping ? colors.ink3 : colors.ink3}>
                {scraping ? 'Please don\'t close the app — this takes a few seconds.' : 'Cancel'}
              </Body>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function StatTile({
  label,
  value,
  tintBg,
  tintFg,
  hint,
}: {
  label: string;
  value: number;
  tintBg: string;
  tintFg: string;
  hint?: string;
}) {
  return (
    <View style={{
      backgroundColor: colors.paper3,
      borderColor: colors.rule, borderWidth: 1,
      borderRadius: radius.md,
      paddingVertical: 12, paddingHorizontal: 14,
      minWidth: 124,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tintFg }} />
        <Text style={{
          fontFamily: fonts.monoMed,
          fontSize: 10, letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: colors.ink3,
        }}>
          {label}
        </Text>
      </View>
      <Text style={{
        fontFamily: fonts.serif,
        fontSize: 26,
        lineHeight: 28,
        color: colors.ink,
        letterSpacing: -0.4,
      }}>
        {value}
      </Text>
      {hint && (
        <Text style={{
          fontFamily: fonts.mono,
          fontSize: 9, color: colors.ink3, marginTop: 2, letterSpacing: 0.6,
        }}>
          {hint}
        </Text>
      )}
    </View>
  );
}

function SubmittedByRow({
  submittedBy,
  isMine,
  timestamp,
}: {
  submittedBy: any;
  isMine: boolean;
  timestamp: number;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
      {submittedBy?.profileImage ? (
        <Image
          source={{ uri: submittedBy.profileImage }}
          style={{ width: 32, height: 32, borderRadius: 16 }}
        />
      ) : (
        <Avatar name={submittedBy?.displayName ?? '?'} size={32} bg={colors.accentBg} fg={colors.accentInk} />
      )}
      <View style={{ marginLeft: 10, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Body size="sm" weight="bold" color={colors.ink}>
            {submittedBy?.displayName ?? 'Unknown'}
          </Body>
          {isMine && (
            <View style={{
              backgroundColor: colors.ink,
              borderRadius: radius.pill,
              paddingHorizontal: 6, paddingVertical: 1,
            }}>
              <Text style={{
                fontFamily: fonts.monoMed,
                fontSize: 9, letterSpacing: 1.0,
                color: colors.paper3,
              }}>
                YOU
              </Text>
            </View>
          )}
        </View>
        <Text style={{
          fontFamily: fonts.mono,
          fontSize: 10, letterSpacing: 0.6,
          color: colors.ink3,
          marginTop: 1,
        }}>
          submitted this · {timeAgo(timestamp)}
        </Text>
      </View>
    </View>
  );
}

function HotBadge() {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: colors.dangerBg,
      borderRadius: radius.pill,
      paddingHorizontal: 8, paddingVertical: 2,
    }}>
      <Ionicons name="flame" size={10} color={colors.danger} />
      <Text style={{
        fontFamily: fonts.monoMed,
        fontSize: 9, letterSpacing: 1.0,
        color: colors.danger,
      }}>
        HOT
      </Text>
    </View>
  );
}

function StatusPill({ status }: { status: any }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: status.bg,
      borderRadius: radius.pill,
      paddingHorizontal: 9, paddingVertical: 3,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: status.ink }} />
      <Text style={{
        fontFamily: fonts.monoMed,
        fontSize: 10, letterSpacing: 1.0,
        color: status.ink,
        textTransform: 'uppercase',
      }}>
        {status.label}
      </Text>
    </View>
  );
}

function SocialCard({
  lead,
  onPress,
  onLinkPress,
}: {
  lead: any;
  onPress: () => void;
  onLinkPress: () => void;
}) {
  const status = STATUS_META[lead.status] ?? STATUS_META.new;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`Lead post about ${lead.businessName}, ${status.label}`}
    >
      <Card padded={false} large style={{ overflow: 'hidden' }}>
        {/* Header — submitting creator */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10,
        }}>
          <SubmittedByRow
            submittedBy={lead.submittedBy}
            isMine={lead.isMine}
            timestamp={lead.createdAt}
          />
          {lead.isHot && <HotBadge />}
        </View>

        {/* Admin description */}
        {lead.adminDescription && (
          <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
            <Body size="sm" color={colors.ink}>{lead.adminDescription}</Body>
          </View>
        )}

        {/* Hero image */}
        {lead.previewImageUrl && (
          <View style={{ width: '100%', backgroundColor: colors.paper2, aspectRatio: 16 / 9 }}>
            <Image
              source={{ uri: lead.previewImageUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </View>
        )}

        {/* External link */}
        {lead.externalPreviewUrl && (
          <TouchableOpacity
            onPress={onLinkPress}
            activeOpacity={0.7}
            style={{
              marginHorizontal: 14, marginTop: 10,
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.paper2,
              borderRadius: radius.sm,
              borderWidth: 1, borderColor: colors.rule,
              paddingHorizontal: 12, paddingVertical: 10,
            }}
          >
            <Ionicons name="link" size={14} color={colors.accent} />
            <Text style={{
              flex: 1, marginLeft: 8,
              fontFamily: fonts.sansMed,
              fontSize: 12, color: colors.accent,
            }} numberOfLines={1}>
              {lead.externalPreviewUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </Text>
            <Ionicons name="open-outline" size={14} color={colors.accent} />
          </TouchableOpacity>
        )}

        {/* Footer */}
        <View style={{
          marginTop: 10,
          paddingHorizontal: 14, paddingVertical: 12,
          borderTopWidth: 1, borderTopColor: colors.rule,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="business-outline" size={12} color={colors.ink3} />
            <Body size="sm" weight="medium" color={colors.ink2} style={{ marginLeft: 6, flex: 1 }} numberOfLines={1}>
              {lead.businessName}{lead.businessCity ? ` · ${lead.businessCity}` : ''}
            </Body>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <StatusPill status={status} />
              {lead.interviewerCount > 1 && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: colors.paper2,
                  borderRadius: radius.pill,
                  paddingHorizontal: 8, paddingVertical: 2,
                }}>
                  <Ionicons name="people" size={10} color={colors.ink2} />
                  <Text style={{ fontFamily: fonts.monoMed, fontSize: 9, color: colors.ink2, letterSpacing: 0.6 }}>
                    {lead.interviewerCount} creators
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function CompactCard({ lead, onPress }: { lead: any; onPress: () => void }) {
  const status = STATUS_META[lead.status] ?? STATUS_META.new;

  // Phone/email may be missing on scraper-origin leads. Offer directions as a
  // fallback CTA so the creator can still locate the business in the world.
  // Coords win when we have them; otherwise the address, then business name +
  // city. Place ID is passed along as the most precise identifier.
  const hasContact = !!(lead.phone || lead.email);
  const hasNamedBusiness = !!lead.businessName && lead.businessName !== '(business unavailable)';
  const mapsTarget = {
    latitude: lead.businessLatitude,
    longitude: lead.businessLongitude,
    label: hasNamedBusiness
      ? (lead.businessCity ? `${lead.businessName} ${lead.businessCity}` : lead.businessName)
      : null,
    address: hasNamedBusiness && lead.businessAddress
      ? (lead.businessCity ? `${lead.businessAddress}, ${lead.businessCity}` : lead.businessAddress)
      : null,
    placeId: lead.businessGooglePlaceId,
  };
  const hasDirections = canOpenDirections(mapsTarget);
  // Show the separate business line only when it adds info beyond the title —
  // i.e. a real inquiry where `name` is a person distinct from the business. For
  // scraped prospects the title already IS the business name, so it's redundant.
  const showBusinessLine = !!lead.name && lead.name !== lead.businessName;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Lead from ${lead.name || lead.businessName}, ${status.label}`}
    >
      <Card padded={false} large style={{ padding: 14 }}>
        {/* Submitter row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SubmittedByRow
            submittedBy={lead.submittedBy}
            isMine={lead.isMine}
            timestamp={lead.createdAt}
          />
          {lead.isHot && <HotBadge />}
        </View>

        {/* Identity — name + color-coded status pill (replaces the old text tag) */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Avatar name={lead.name || lead.businessName || '?'} size={40} bg={colors.paper2} fg={colors.ink2} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Body size="sm" weight="bold" color={colors.ink} numberOfLines={1}>
              {lead.name || lead.businessName}
            </Body>

            {hasContact && (
              <Text style={{
                fontFamily: fonts.mono,
                fontSize: 11, color: colors.ink3,
                marginTop: 3, letterSpacing: 0.4,
              }} numberOfLines={1}>
                {lead.phone}{lead.email ? ` · ${lead.email}` : ''}
              </Text>
            )}

            {/* Directions — always visible when we have a location, even with a phone */}
            {hasDirections && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  void openDirections(mapsTarget);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Show directions to ${lead.businessName}`}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  marginTop: 6, alignSelf: 'flex-start',
                  backgroundColor: colors.accentBg,
                  borderRadius: radius.pill,
                  paddingHorizontal: 10, paddingVertical: 4,
                }}
              >
                <Ionicons name="navigate" size={11} color={colors.accentInk} />
                <Text style={{
                  fontFamily: fonts.sans, fontSize: 11,
                  color: colors.accentInk, fontWeight: '600',
                }}>
                  Show directions
                </Text>
              </TouchableOpacity>
            )}

            {!hasContact && !hasDirections && (
              <Text style={{
                fontFamily: fonts.mono,
                fontSize: 11, color: colors.ink3,
                marginTop: 3, letterSpacing: 0.4, fontStyle: 'italic',
              }} numberOfLines={1}>
                no contact on file
              </Text>
            )}
          </View>
        </View>

        {/* Status + meta — kept below the title so it doesn't clutter the name */}
        <View style={{
          marginTop: 10, paddingTop: 10,
          borderTopWidth: 1, borderTopColor: colors.rule,
          gap: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <StatusPill status={status} />
            {lead.interviewerCount > 1 && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: colors.paper2,
                borderRadius: radius.pill,
                paddingHorizontal: 8, paddingVertical: 2,
              }}>
                <Ionicons name="people" size={10} color={colors.ink2} />
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 9, color: colors.ink2, letterSpacing: 0.6 }}>
                  {lead.interviewerCount} creators
                </Text>
              </View>
            )}
          </View>
          {showBusinessLine && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="business-outline" size={12} color={colors.ink3} />
              <Body size="sm" color={colors.ink2} style={{ marginLeft: 6, flex: 1 }} numberOfLines={1}>
                {lead.businessName}{lead.businessCity ? ` · ${lead.businessCity}` : ''}
              </Body>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function ReservedCard({ prospect, onPress }: { prospect: any; onPress: () => void }) {
  const expiresAt = typeof prospect.reservationExpiresAt === 'number' ? prospect.reservationExpiresAt : null;
  const msLeft = expiresAt ? Math.max(0, expiresAt - Date.now()) : 0;
  const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));
  const minutesLeft = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
  const timeLeftLabel = hoursLeft >= 1 ? `${hoursLeft}h ${minutesLeft}m left` : `${minutesLeft}m left`;
  const urgent = hoursLeft < 2;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Reserved: ${prospect.businessName}. ${timeLeftLabel}. Tap for directions.`}
    >
      <Card padded={false} large style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="bookmark" size={12} color={colors.accent} />
            <Label tracking={1.8} color={colors.accent}>RESERVED · YOURS</Label>
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: urgent ? colors.dangerBg : colors.paper2,
            borderRadius: radius.pill,
            paddingHorizontal: 8, paddingVertical: 2,
          }}>
            <Ionicons name="time-outline" size={11} color={urgent ? colors.danger : colors.ink2} />
            <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: urgent ? colors.danger : colors.ink2, letterSpacing: 0.4 }}>
              {timeLeftLabel}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{
            width: 40, height: 40, borderRadius: 8,
            backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="business" size={20} color={colors.paper} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Body size="md" weight="bold" color={colors.ink} numberOfLines={1}>
              {prospect.businessName}
            </Body>
            <Body size="sm" color={colors.ink2} numberOfLines={1} style={{ marginTop: 2 }}>
              {prospect.category ?? 'Business'}{prospect.city ? ` · ${prospect.city}` : ''}
            </Body>
            {prospect.phone && (
              <Text style={{
                fontFamily: fonts.mono, fontSize: 11, color: colors.ink3,
                marginTop: 4, letterSpacing: 0.4,
              }} numberOfLines={1}>
                {prospect.phone}
              </Text>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: colors.accent,
            borderRadius: radius.pill,
            paddingHorizontal: 10, paddingVertical: 4,
          }}>
            <Ionicons name="navigate" size={11} color="#fff" />
            <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: '#fff', fontWeight: '600' }}>
              Tap to open in Maps
            </Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scrape progress UI — replaces the input fields once the search is in flight.
// Three stages are visible so the user can see the app is doing real work,
// not just spinning. Each stage has a hint of what's happening + a soft pulse.
// ─────────────────────────────────────────────────────────────────────────────

type ScrapePhase = 'idle' | 'locating' | 'searching' | 'saving';

const PHASES: { key: Exclude<ScrapePhase, 'idle'>; title: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'locating',  title: 'Pinning your spot',     hint: 'Reading GPS so we search the right neighborhood.', icon: 'locate' },
  { key: 'searching', title: 'Scanning the map',      hint: 'Checking Google Maps for businesses around you.',  icon: 'search' },
  { key: 'saving',    title: 'Adding to your list',   hint: 'Saving the ones nobody on the team has met yet.',  icon: 'list' },
];

function scrapePhaseCaption(phase: ScrapePhase): string {
  switch (phase) {
    case 'locating':  return '1 OF 3';
    case 'searching': return '2 OF 3';
    case 'saving':    return '3 OF 3';
    default:          return 'SEARCHING…';
  }
}

function scrapePhaseLabel(phase: ScrapePhase): string {
  switch (phase) {
    case 'locating':  return 'Finding where you are…';
    case 'searching': return 'Looking for nearby businesses…';
    case 'saving':    return 'Almost ready — saving results…';
    default:          return 'Hang tight…';
  }
}

function ScrapeProgressPanel({
  phase,
  category,
  radiusKm,
}: {
  phase: ScrapePhase;
  category: string;
  radiusKm: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] });

  return (
    <View>
      <Label tracking={1.8}>HANG TIGHT</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', marginTop: 4, marginBottom: 10 }}>
        <Display size="md">Looking for </Display>
        <Display size="md" italic color={colors.accent}>{category}</Display>
        <Display size="md"> near you.</Display>
      </View>
      <Body size="sm" color={colors.ink2} style={{ marginBottom: 20 }}>
        Hold on — we're searching within {radiusKm} km. This usually takes 5–15 seconds depending on your area. Please don't close the app.
      </Body>

      {/* Animated halo with current-phase icon */}
      <View style={{ alignItems: 'center', marginBottom: 22 }}>
        <View style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={{
              position: 'absolute',
              width: 92, height: 92, borderRadius: 46,
              backgroundColor: colors.accentBg,
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            }}
          />
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.accent,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons
              name={(PHASES.find((p) => p.key === phase) ?? PHASES[0]).icon}
              size={28}
              color="#fff"
            />
          </View>
        </View>
      </View>

      {/* Step list */}
      <View style={{ gap: 10, marginBottom: 18 }}>
        {PHASES.map((p) => {
          const phaseIdx = PHASES.findIndex((x) => x.key === phase);
          const myIdx = PHASES.findIndex((x) => x.key === p.key);
          const state: 'done' | 'active' | 'pending' =
            phaseIdx < 0 ? 'pending' : myIdx < phaseIdx ? 'done' : myIdx === phaseIdx ? 'active' : 'pending';

          const bg =
            state === 'done' ? colors.accentBg
            : state === 'active' ? colors.paper3
            : colors.paper2;
          const fg =
            state === 'done' ? colors.accent
            : state === 'active' ? colors.ink
            : colors.ink3;
          const borderColor =
            state === 'active' ? colors.accent
            : colors.rule;

          return (
            <View
              key={p.key}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 14, paddingVertical: 12,
                backgroundColor: bg,
                borderColor, borderWidth: state === 'active' ? 1.5 : 1,
                borderRadius: radius.sm,
              }}
            >
              <View style={{
                width: 24, height: 24, borderRadius: 12,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: state === 'done' ? colors.accent : 'transparent',
                borderColor: state === 'done' ? colors.accent : colors.rule,
                borderWidth: 1,
                marginRight: 10,
              }}>
                {state === 'done' ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : state === 'active' ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={{
                    fontFamily: fonts.mono, fontSize: 10,
                    color: colors.ink3, letterSpacing: 0.4,
                  }}>
                    {myIdx + 1}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Body size="sm" weight="medium" color={fg}>{p.title}</Body>
                <Text style={{
                  fontFamily: fonts.mono, fontSize: 10,
                  color: colors.ink3, letterSpacing: 0.4, marginTop: 2,
                }}>
                  {p.hint}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
