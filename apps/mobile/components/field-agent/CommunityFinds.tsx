import React, { useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useWorkAreaLocation } from '../../hooks/useWorkAreaLocation';
import { Avatar, Button, EmptyState, Loading, Pill, ScreenShell, Text } from '../v2';
import { colors, fonts, hit, radius, shadow, space } from '../../theme/v2';
import { DEFAULT_FIND_RADIUS_KM, FIND_RADII_KM, filterCommunityFinds, findWebsiteLabel, type FindFilter } from '../../services/fieldAgentFinds';
import { normalizeCommunityFind, publicImage, type CommunityFind } from '../../services/fieldAgentMap';
import { ShopImage } from '../ShopImage';

const FILTERS: { key: FindFilter; title: string }[] = [
  { key: 'all', title: 'All finds' }, { key: 'near', title: 'Near me' },
  { key: 'needs', title: 'Needs a site' }, { key: 'food', title: 'Food' },
  { key: 'beauty', title: 'Beauty' }, { key: 'repair', title: 'Repair' },
  { key: 'sari_sari', title: 'Sari-sari' }, { key: 'other', title: 'Other' },
];

export function CommunityFinds() {
  const router = useGuardedRouter();
  const { isAuthenticated } = useConvexAuth();
  const { area, requestCurrentLocation, isLocating } = useWorkAreaLocation();
  const data = useQuery(api.leads.listForMobileCRM, isAuthenticated ? { statusFilter: 'all' } : 'skip');
  const [filter, setFilter] = useState<FindFilter>(area ? 'near' : 'all');
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_FIND_RADIUS_KM);
  const [search, setSearch] = useState('');
  const leads: readonly CommunityFind[] = data?.leads ?? [];
  const rows = useMemo(() => filterCommunityFinds(leads, filter, search, area, radiusKm), [leads, filter, search, area, radiusKm]);
  const columns = [rows.filter((_, index) => index % 2 === 0), rows.filter((_, index) => index % 2 === 1)];
  const tools = () => Alert.alert('Find shops', 'More ways to find and manage shops.', [
    { text: 'Open map', onPress: () => router.replace('/(app)/(tabs)/' as never) },
    { text: 'Team CRM & search', onPress: () => router.push('/(app)/leads' as never) },
    { text: 'Cancel', style: 'cancel' },
  ]);
  return (
    <ScreenShell scroll={false} insetBottom={false} contentStyle={styles.frame}>
      <View style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text variant="display" accessibilityRole="header">Community finds</Text>
              <Text variant="label" tone="muted">{data ? `${leads.length} shops shared by the team` : 'Shops shared by field agents'}</Text>
            </View>
            <Pressable onPress={tools} accessibilityRole="button" accessibilityLabel="More find tools" style={styles.round}>
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.ink} />
            </Pressable>
          </View>
          <View style={[styles.search, shadow.soft]}>
            <Ionicons name="search-outline" size={22} color={colors.ink3} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search shops or agents"
              accessibilityLabel="Search community finds" style={styles.searchInput} placeholderTextColor={colors.ink3}
              autoCorrect={false} returnKeyType="search" onSubmitEditing={Keyboard.dismiss} />
            {search ? <Pressable onPress={() => setSearch('')} accessibilityLabel="Clear find search" accessibilityRole="button" style={styles.clear}>
              <Ionicons name="close-circle" size={22} color={colors.ink3} />
            </Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((item) => <Pill key={item.key} label={item.title} selected={filter === item.key}
              onPress={() => { Keyboard.dismiss(); setFilter(item.key); }} />)}
          </ScrollView>
          {filter === 'near' ? <View style={styles.range}>
            <Text variant="label" tone="muted" accessibilityLiveRegion="polite">{area
              ? `Within ${radiusKm} km of ${area.source === 'work' ? area.label : 'your location'}` : 'Search range'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeOptions}>
              {FIND_RADII_KM.map((km) => <Pill key={km} label={`${km} km`} accessibilityLabel={`Within ${km} km`}
                selected={radiusKm === km} style={styles.rangeOption}
                onPress={() => { Keyboard.dismiss(); setRadiusKm(km); }} />)}
            </ScrollView>
          </View> : null}
          {filter === 'near' && !area ? <EmptyState icon="location-outline" title="Choose your location"
            body={`Use your location to see finds within ${radiusKm} km. Your saved work city also works.`}
            actionLabel={isLocating ? 'Locating…' : 'Use my location'}
            onAction={() => { if (!isLocating) void requestCurrentLocation(); }} />
            : !data ? <Loading fill={false} />
              : rows.length === 0 ? <EmptyState icon="storefront-outline" title={search || filter !== 'all' ? 'No matching finds' : 'Be the first to spot a shop'}
                body={filter === 'near' ? `No matching finds within ${radiusKm} km. Increase the range or try another search.`
                  : search || filter !== 'all' ? 'Try another filter or search.' : 'Take a shop photo and share it with the team.'}
                actionLabel={search || filter !== 'all' ? 'Clear filters' : 'Spot a shop'}
                onAction={() => { if (search || filter !== 'all') { setFilter('all'); setSearch(''); } else router.push('/(app)/leads/spot' as never); }} />
                : <View style={styles.masonry}>
                  {columns.map((column, index) => <View key={index} style={styles.column}>
                    {column.map((lead, row) => <FindTile key={lead._id} lead={lead} imageHeight={(row + index) % 2 ? 170 : 214}
                      distanceLabel={normalizeCommunityFind(lead, area)?.distanceLabel}
                      onPress={() => router.push(`/(app)/leads/${lead._id}` as never)} />)}
                  </View>)}
                </View>}
        </ScrollView>
        <View style={styles.fab} pointerEvents="box-none">
          <Button title="Spot a shop" icon="camera-outline" size="md" fullWidth={false}
            style={styles.fabButton} onPress={() => router.push('/(app)/leads/spot' as never)} />
        </View>
      </View>
    </ScreenShell>
  );
}

function FindTile({ lead, imageHeight, distanceLabel, onPress }: {
  lead: CommunityFind; imageHeight: number; distanceLabel?: string; onPress: () => void;
}) {
  const photo = publicImage(lead.photoUrl || lead.previewImageUrl);
  const person = lead.spottedBy ?? lead.submittedBy;
  const label = findWebsiteLabel(lead);
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${lead.businessName || 'Shop'}, ${label}${person ? `, spotted by ${person.displayName}` : ''}`}
      cssInterop={false} style={({ pressed }) => [styles.tile, pressed ? { opacity: 0.75 } : null]}>
      <View style={[styles.photo, { height: imageHeight }]}>
        <ShopImage uri={photo} name={lead.businessName || 'Shop'} width="100%" height="100%" borderRadius={0} decorative />
        <View style={styles.tags}>
          <View style={[styles.tag, lead.hasLiveWebsite ? styles.liveTag : null]}>
            <Text variant="label" weight="bold" style={styles.tagText}>{label}</Text>
          </View>
        </View>
      </View>
      <Text variant="bodyLg" weight="semibold" numberOfLines={2}>{lead.businessName || 'Unnamed shop'}</Text>
      {person ? <View style={styles.byline}><Avatar uri={person.profileImage} name={person.displayName} size={24} />
        <Text variant="label" tone="muted" style={styles.bylineText} numberOfLines={2}>{person.displayName}</Text></View> : null}
      {distanceLabel && distanceLabel !== 'Distance unavailable' ? <Text variant="label" tone="muted">{distanceLabel}</Text>
        : lead.businessCity ? <Text variant="label" tone="muted">{lead.businessCity}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, frame: { paddingHorizontal: 0, paddingTop: space.sm, paddingBottom: 0 },
  content: { gap: space.lg, paddingBottom: 112 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.gutter },
  heading: { flex: 1, gap: space.sm },
  round: { width: hit.icon, height: hit.icon, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: space.gutter, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, minHeight: 56, borderRadius: radius.pill, backgroundColor: colors.card },
  searchInput: { flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 16, color: colors.ink, minHeight: 48, paddingVertical: space.sm },
  clear: { minHeight: 48, minWidth: 32, alignItems: 'center', justifyContent: 'center' },
  filters: { paddingHorizontal: space.gutter, gap: space.sm, paddingVertical: space.xs },
  range: { marginHorizontal: space.gutter, gap: space.sm },
  rangeOptions: { gap: space.sm, paddingVertical: space.xs },
  rangeOption: { minHeight: hit.min, paddingHorizontal: space.md },
  masonry: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.gutter }, column: { flex: 1, minWidth: 0, gap: space.xl },
  tile: { gap: space.sm }, photo: { borderRadius: radius.card, backgroundColor: colors.bg2, overflow: 'hidden' },
  tags: { position: 'absolute', left: space.sm, right: space.sm, top: space.sm, alignItems: 'flex-start' },
  tag: { maxWidth: '100%', paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: colors.card },
  tagText: { textAlign: 'center' },
  liveTag: { backgroundColor: colors.accent }, byline: { flexDirection: 'row', alignItems: 'center', gap: space.xs }, bylineText: { flex: 1 },
  fab: { position: 'absolute', bottom: space.lg, right: space.gutter, alignItems: 'flex-end' },
  fabButton: { paddingHorizontal: space.lg, borderColor: colors.ink, ...shadow.object },
});
