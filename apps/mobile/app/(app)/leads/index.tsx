import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  BackHandler,
  TextInput,
  Image,
  RefreshControl,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useAction, useConvexAuth } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, fonts, radius, shadow, space } from '../../../theme/v2';
import {
  Avatar,
  Button,
  Card,
  CheckRow,
  Chip,
  ChoiceChip,
  EmptyState,
  Field,
  Loading,
  Pill,
  ScreenShell,
  Text,
  TextLink,
  leadStatus,
} from '../../../components/v2';
import { openDirections, canOpenDirections, openExternalUrl } from '../../../services/links';

type StatusFilter = 'all' | 'reserved' | 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

const FILTER_KEYS: StatusFilter[] = ['all', 'reserved', 'new', 'contacted', 'qualified', 'converted', 'lost'];

/** Filter pill words: the same short words the status chips use. */
function filterLabel(key: StatusFilter): string {
  if (key === 'all') return 'All';
  if (key === 'reserved') return 'Reserved';
  return leadStatus(key).label;
}

/** Kinds of shop a field agent can look for. `query` is what Outscraper receives. */
const CATEGORY_CHOICES: { label: string; query: string }[] = [
  { label: 'Barbershop', query: 'barbershops' },
  { label: 'Mechanic', query: 'auto repair shops' },
  { label: 'Salon', query: 'hair salons' },
  { label: 'Tailor', query: 'tailors' },
  { label: 'Carpenter', query: 'carpenters' },
  { label: 'Florist', query: 'florists' },
  { label: 'Sari-sari', query: 'sari-sari stores' },
];

const RADIUS_CHOICES = [0.5, 1, 3, 5, 10];

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
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Outscraper scrape-nearby sheet state
  const [showScrape, setShowScrape] = useState(false);
  const [scrapeCategory, setScrapeCategory] = useState('');
  const [otherCategory, setOtherCategory] = useState(false);
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
      setOtherCategory(false);

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
  }, [scrapeCategory, scrapeRadiusKm, scrapeNearbyAction, router]);

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
    return <Loading />;
  }

  const hasFilters = !!search || statusFilter !== 'all' || onlyMine;
  const closeScrape = () => {
    if (!scraping) setShowScrape(false);
  };
  const summary = isReservedView
    ? `${(reservedProspects ?? []).length} reserved`
    : `${stats?.total ?? 0} shops · ${stats?.mine ?? 0} yours · ${hotLeadCount} hot`;

  return (
    <ScreenShell
      scroll={false}
      insetBottom={false}
      onBack={() => router.replace('/(app)/(tabs)')}
      headerRight={
        <Pressable
          onPress={() => router.push('/(app)/leads/nearby' as any)}
          accessibilityRole="button"
          accessibilityLabel="See businesses on the map that have already been interviewed and have a live website"
          style={[styles.roundBtn, shadow.soft]}
        >
          <Ionicons name="map-outline" size={22} color={colors.ink} />
        </Pressable>
      }
      contentStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}
      footer={
        <Button
          title="Find shops near me"
          icon="search"
          onPress={() => setShowScrape(true)}
          accessibilityLabel="Find local businesses near you to interview"
        />
      }
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 600);
            }}
            tintColor={colors.ink}
          />
        }
      >
        <View style={styles.gutter}>
          <Text variant="display" accessibilityRole="header">
            Finds
          </Text>
          <Text variant="label" tone="muted" style={styles.summary}>
            {summary}
          </Text>
        </View>

        {/* Search */}
        <View style={[styles.gutter, styles.block]}>
          <View style={[styles.search, shadow.soft]}>
            <Ionicons name="search" size={22} color={colors.ink3} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search a shop or an agent"
              placeholderTextColor={colors.ink3}
              selectionColor={colors.ink}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Search leads"
            />
            {search.length > 0 && (
              <Pressable
                onPress={() => setSearch('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={8}
                style={styles.clear}
              >
                <Ionicons name="close-circle" size={22} color={colors.ink3} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
          style={styles.block}
        >
          <Pill
            label="Only mine"
            selected={onlyMine}
            onPress={() => setOnlyMine(!onlyMine)}
            accessibilityLabel="Toggle: only my leads"
          />
          {FILTER_KEYS.map((key) => (
            <Pill
              key={key}
              label={filterLabel(key)}
              selected={statusFilter === key}
              onPress={() => setStatusFilter(key)}
              accessibilityLabel={`Filter by ${filterLabel(key)}`}
            />
          ))}
        </ScrollView>

        {/* Reserved-prospects view (separate data source from leads) */}
        {isReservedView ? (
          (reservedProspects ?? []).length === 0 ? (
            <EmptyState
              icon="bookmark-outline"
              title="No reserved shops"
              body="Reserve a shop in Find shops. It is yours for 24 hours."
            />
          ) : (
            <View style={[styles.gutter, styles.list]}>
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
          <EmptyState
            icon="storefront-outline"
            title={hasFilters ? 'No matches' : 'No finds yet'}
            body={hasFilters ? 'Try clearing the search or filter.' : 'Shops your team spots will show up here.'}
            actionLabel={hasFilters ? 'Clear filters' : undefined}
            onAction={
              hasFilters
                ? () => {
                    setSearch('');
                    setStatusFilter('all');
                    setOnlyMine(false);
                  }
                : undefined
            }
          />
        ) : (
          <View style={[styles.gutter, styles.list]}>
            {leads.map((lead) => (
              <LeadCard
                key={String(lead._id)}
                lead={lead}
                onPress={() => router.push(`/(app)/leads/${lead._id}` as any)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* === Find-shops sheet (Outscraper trigger) === */}
      <Modal visible={showScrape} transparent animationType="slide" onRequestClose={closeScrape}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalWrap}
        >
          <Pressable
            style={styles.scrim}
            onPress={closeScrape}
            accessibilityLabel="Close scrape modal"
            accessibilityRole="button"
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }]}>
            <View style={styles.grab} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetBody}
              bounces={false}
            >
              {scraping ? (
                <ScrapeProgressPanel
                  phase={scrapePhase}
                  category={scrapeCategory.trim() || 'shops'}
                  radiusKm={scrapeRadiusKm}
                />
              ) : (
                <>
                  <Text variant="title" accessibilityRole="header">
                    Find shops near me
                  </Text>
                  <Text variant="bodyLg" tone="ink2">
                    Pick a kind of shop. We look around you.
                  </Text>

                  <View style={styles.chips}>
                    {CATEGORY_CHOICES.map((c) => (
                      <ChoiceChip
                        key={c.label}
                        label={c.label}
                        selected={!otherCategory && scrapeCategory === c.query}
                        onPress={() => {
                          setOtherCategory(false);
                          setScrapeCategory(scrapeCategory === c.query ? '' : c.query);
                        }}
                      />
                    ))}
                    <ChoiceChip
                      label="Other"
                      selected={otherCategory}
                      onPress={() => {
                        if (!otherCategory) setScrapeCategory('');
                        setOtherCategory(!otherCategory);
                      }}
                    />
                  </View>

                  {otherCategory ? (
                    <Field
                      label="What kind of shop?"
                      icon="storefront-outline"
                      value={scrapeCategory}
                      onChangeText={setScrapeCategory}
                      placeholder="vulcanizing, bakery, sari-sari…"
                      autoCapitalize="none"
                      autoCorrect={false}
                      accessibilityLabel="What kind of business?"
                    />
                  ) : null}

                  <Text variant="label" weight="bold" tone="muted" style={styles.sectionGap}>
                    How far?
                  </Text>
                  <View style={styles.chips}>
                    {RADIUS_CHOICES.map((km) => (
                      <ChoiceChip
                        key={km}
                        label={km < 1 ? `${km * 1000} m` : `${km} km`}
                        selected={scrapeRadiusKm === km}
                        onPress={() => setScrapeRadiusKm(km)}
                      />
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.sheetFoot}>
              <Button
                title="Find shops"
                loading={scraping}
                disabled={scraping}
                onPress={handleScrape}
                accessibilityLabel="Find businesses to interview"
              />
              {scraping ? (
                <Text variant="label" tone="muted" align="center">
                  Please keep the app open.
                </Text>
              ) : (
                <TextLink label="Cancel" onPress={closeScrape} />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenShell>
  );
}

function PhotoTile({ uri, name, size = 76 }: { uri?: string | null; name: string; size?: number }) {
  const initial = (name ?? '').trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={[styles.tile, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text variant="heading">{initial}</Text>
      )}
    </View>
  );
}

function RoundAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.action, pressed ? { opacity: 0.7 } : null]}
    >
      <Ionicons name={icon} size={22} color={colors.ink} />
    </Pressable>
  );
}

function LeadCard({ lead, onPress }: { lead: any; onPress: () => void }) {
  const status = leadStatus(lead.status);

  // Phone/email may be missing on scraper-origin leads. Offer directions as a
  // fallback so the field agent can still locate the business in the world.
  // Coords win when we have them; otherwise the address, then business name +
  // city. Place ID is passed along as the most precise identifier.
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
  const title = lead.name || lead.businessName || 'Shop';
  // Show the separate business line only when it adds info beyond the title —
  // i.e. a real inquiry where `name` is a person distinct from the business. For
  // scraped prospects the title already IS the business name, so it's redundant.
  const showBusinessLine = !!lead.name && lead.name !== lead.businessName;
  const where = showBusinessLine
    ? `${lead.businessName ?? ''}${lead.businessCity ? ` · ${lead.businessCity}` : ''}`
    : lead.businessCity ?? '';
  const hasActions = !!(lead.phone || lead.email || hasDirections || lead.externalPreviewUrl);

  return (
    <Card style={styles.leadCard}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          lead.hasEnrichedContent
            ? `Lead post about ${lead.businessName}, ${status.label}`
            : `Lead from ${title}, ${status.label}`
        }
        style={({ pressed }) => [styles.leadMain, pressed ? { opacity: 0.85 } : null]}
      >
        <PhotoTile uri={lead.previewImageUrl} name={title} />
        <View style={styles.leadText}>
          <Text variant="bodyLg" weight="bold" numberOfLines={2}>
            {title}
          </Text>
          {where ? (
            <Text variant="label" weight="medium" tone="muted" numberOfLines={1}>
              {where}
            </Text>
          ) : null}
          <View style={styles.chipRow}>
            <Chip label={status.label} tone={status.tone} />
            {lead.isHot ? <Chip label="Hot" tone="danger" /> : null}
            {lead.interviewerCount > 1 ? <Chip label={`${lead.interviewerCount} field agents`} tone="muted" /> : null}
          </View>
        </View>
      </Pressable>

      {lead.adminDescription ? (
        <Text variant="body" tone="ink2" numberOfLines={2} style={styles.desc}>
          {lead.adminDescription}
        </Text>
      ) : null}

      <View style={styles.byRow}>
        <Avatar uri={lead.submittedBy?.profileImage} name={lead.submittedBy?.displayName ?? '?'} size={32} />
        <Text variant="label" weight="medium" tone="muted" numberOfLines={1} style={styles.flex}>
          {lead.isMine ? 'You' : lead.submittedBy?.displayName ?? 'Unknown'} · {timeAgo(lead.createdAt)}
        </Text>
      </View>

      {hasActions ? (
        <View style={styles.actions}>
          {lead.phone ? (
            <RoundAction
              icon="call-outline"
              label={`Call ${title}`}
              onPress={() => void Linking.openURL(`tel:${lead.phone}`).catch(() => {})}
            />
          ) : null}
          {lead.email ? (
            <RoundAction
              icon="mail-outline"
              label={`Email ${title}`}
              onPress={() => void Linking.openURL(`mailto:${lead.email}`).catch(() => {})}
            />
          ) : null}
          {hasDirections ? (
            <RoundAction
              icon="navigate-outline"
              label={`Show directions to ${lead.businessName}`}
              onPress={() => void openDirections(mapsTarget)}
            />
          ) : null}
          {lead.externalPreviewUrl ? (
            <RoundAction
              icon="globe-outline"
              label={`Open website preview for ${lead.businessName}`}
              onPress={() => void openExternalUrl(lead.externalPreviewUrl)}
            />
          ) : null}
        </View>
      ) : (
        <Text variant="label" tone="muted" style={styles.desc}>
          No contact yet
        </Text>
      )}
    </Card>
  );
}

function ReservedCard({ prospect, onPress }: { prospect: any; onPress: () => void }) {
  const expiresAt = typeof prospect.reservationExpiresAt === 'number' ? prospect.reservationExpiresAt : null;
  const msLeft = expiresAt ? Math.max(0, expiresAt - Date.now()) : 0;
  const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));
  const minutesLeft = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
  const timeLeftLabel = hoursLeft >= 1 ? `${hoursLeft}h ${minutesLeft}m left` : `${minutesLeft}m left`;
  const urgent = hoursLeft < 2;
  const reserved = leadStatus('reserved');

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Reserved: ${prospect.businessName}. ${timeLeftLabel}. Tap for directions.`}
      style={styles.leadCard}
    >
      <View style={styles.leadMain}>
        <PhotoTile name={prospect.businessName ?? 'Shop'} />
        <View style={styles.leadText}>
          <Text variant="bodyLg" weight="bold" numberOfLines={2}>
            {prospect.businessName}
          </Text>
          <Text variant="label" weight="medium" tone="muted" numberOfLines={1}>
            {prospect.category ?? 'Shop'}
            {prospect.city ? ` · ${prospect.city}` : ''}
          </Text>
          <View style={styles.chipRow}>
            <Chip label={reserved.label} tone={reserved.tone} />
            <Chip label={timeLeftLabel} tone={urgent ? 'danger' : 'muted'} />
          </View>
        </View>
        <View style={styles.go}>
          <Ionicons name="navigate" size={22} color={colors.onAccent} />
        </View>
      </View>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scrape progress — replaces the options once the search is in flight.
// Three stages are visible so the user can see the app is doing real work.
// ─────────────────────────────────────────────────────────────────────────────

type ScrapePhase = 'idle' | 'locating' | 'searching' | 'saving';

const PHASES: { key: Exclude<ScrapePhase, 'idle'>; title: string }[] = [
  { key: 'locating', title: 'Finding where you are' },
  { key: 'searching', title: 'Scanning the map' },
  { key: 'saving', title: 'Saving the shops' },
];

function ScrapeProgressPanel({
  phase,
  category,
  radiusKm,
}: {
  phase: ScrapePhase;
  category: string;
  radiusKm: number;
}) {
  const phaseIdx = PHASES.findIndex((x) => x.key === phase);
  return (
    <View style={styles.progress}>
      <Text variant="title" accessibilityRole="header">
        Looking for {category} within {radiusKm < 1 ? `${radiusKm * 1000} m` : `${radiusKm} km`}.
      </Text>
      <View style={styles.steps}>
        {PHASES.map((p, i) => (
          <CheckRow
            key={p.key}
            title={p.title}
            state={phaseIdx < 0 ? 'todo' : i < phaseIdx ? 'done' : i === phaseIdx ? 'now' : 'todo'}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gutter: { paddingHorizontal: space.gutter },
  block: { marginTop: space.lg },
  listContent: { paddingTop: space.sm, paddingBottom: space.xl },
  summary: { marginTop: space.xs },
  roundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    padding: 0,
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
  },
  clear: { width: 32, height: 48, alignItems: 'center', justifyContent: 'center' },
  pillRow: { paddingHorizontal: space.gutter, gap: space.sm, alignItems: 'center' },
  list: { gap: space.md, marginTop: space.lg },

  leadCard: { gap: space.md },
  leadMain: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  leadText: { flex: 1, gap: space.xs, minWidth: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  tile: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desc: { marginTop: 0 },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  action: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  go: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // sheet
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    shadowColor: '#0C0A08',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 8,
  },
  grab: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.ruleStrong,
    alignSelf: 'center',
    marginTop: 9,
  },
  sheetBody: { paddingHorizontal: space.gutter, paddingTop: space.lg, paddingBottom: space.md, gap: space.md },
  sheetFoot: { paddingHorizontal: space.gutter, paddingTop: space.sm, gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sectionGap: { marginTop: space.sm },
  progress: { gap: space.lg },
  steps: { gap: space.sm },
});
