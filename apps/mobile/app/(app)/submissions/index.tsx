import React, { useCallback, useState } from 'react';
import { BackHandler, Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api, type Doc } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { useMobileAccount } from '../../../hooks/useMobileAccount';
import { GuardedLink } from '../../../components/GuardedLink';
import { colors, hit, radius, shadow, space } from '../../../theme/v2';
import { Banner, Button, Chip, EmptyState, Field, Loading, Pill, ScreenShell, Text, shortDate, submissionStatus } from '../../../components/v2';

type Submission = Doc<'submissions'>;
type Filter = 'all' | 'live' | 'review' | 'draft';
const WEBSITE_READY_STATUSES = ['deployed', 'pending_payment', 'paid', 'completed', 'website_generated'];
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'live', label: 'Live' },
  { key: 'review', label: 'In review' }, { key: 'draft', label: 'Drafts' },
];

function showAsDraft(sub: Submission): boolean {
  const incomplete = !sub.photos?.length || (!sub.videoStorageId && !sub.audioStorageId);
  return (sub.status === 'draft' || incomplete) && sub.status !== 'approved' && sub.status !== 'rejected';
}

function matchesFilter(sub: Submission, filter: Filter): boolean {
  if (filter === 'all') return true;
  const draft = showAsDraft(sub);
  if (filter === 'draft') return draft;
  if (draft || sub.status === 'rejected') return false;
  return filter === 'live' ? WEBSITE_READY_STATUSES.includes(sub.status) : !WEBSITE_READY_STATUSES.includes(sub.status);
}

function SubThumb({ sub, draft }: { sub: Submission; draft: boolean }) {
  const firstPhoto = sub.photos?.[0];
  const urls = useQuery(api.files.getMultipleUrls, firstPhoto ? { storageIds: [firstPhoto] } : 'skip');
  const url = urls?.[0];
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (url && !url.startsWith('convex:') && failedUri !== url) {
    return <Image source={{ uri: url }} style={styles.thumb} resizeMode="cover"
      onError={() => setFailedUri(url)} accessibilityIgnoresInvertColors />;
  }
  const rejected = sub.status === 'rejected';
  return <View style={[styles.thumb, styles.thumbTile, { backgroundColor: rejected ? colors.dangerBg : draft ? colors.bg2 : colors.accentSoft }]}>
    <Ionicons name={draft ? 'time-outline' : rejected ? 'alert-circle-outline' : 'storefront-outline'} size={24} color={rejected ? colors.danger : colors.ink} />
  </View>;
}

export default function SubmissionsScreen() {
  const router = useGuardedRouter();
  const { user, isLoaded } = useUser();
  const { account, isAuthenticated, isOffline, isBlocked, isPreview, isLoading } = useMobileAccount();
  const { width, fontScale } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ownAccount = account?.clerkId === user?.id && !isBlocked && !isPreview
    && (!account?.role || account.role === 'creator') ? account : null;
  const canRead = !!ownAccount && isAuthenticated && !isOffline;
  const raw = useQuery(api.submissions.getByCreatorId, canRead ? { creatorId: ownAccount._id } : 'skip');
  const submissions = canRead ? (raw ?? []).filter(sub => sub.creatorId === ownAccount._id) : [];
  const compact = width < 360 || fontScale > 1.3;

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { router.replace('/(app)/dashboard'); return true; });
    return () => subscription.remove();
  }, [router]));

  if (!isLoaded || isLoading || (canRead && raw === undefined)) return <Loading />;
  const goBack = () => router.replace('/(app)/dashboard');
  if (!canRead) return <ScreenShell title="Your submissions" onBack={goBack}>
    <Banner tone="warn" body={isOffline ? 'Reconnect to see your submissions.' : 'Open your submissions with your field-agent account.'} />
  </ScreenShell>;
  const query = search.trim().toLocaleLowerCase();
  const visible = submissions.filter(sub => matchesFilter(sub, filter) && (!query ||
    [sub.businessName, sub.businessType, sub.city].some(value => value?.toLocaleLowerCase().includes(query))));
  const needFix = submissions.filter(sub => sub.status === 'rejected').length;
  const countLine = submissions.length ? `${submissions.length} ${submissions.length === 1 ? 'shop' : 'shops'}${needFix ? ` · ${needFix} ${needFix === 1 ? 'needs' : 'need'} a fix` : ''}` : undefined;

  return <ScreenShell title="Your submissions" subtitle={countLine} onBack={goBack}
    headerRight={<Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={searchOpen ? 'Close submission search' : 'Search submissions'}
      accessibilityState={{ expanded: searchOpen }} style={styles.searchButton}
      onPress={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearch(''); }}>
      <Ionicons name={searchOpen ? 'close' : 'search'} size={22} color={colors.ink} />
    </Pressable>}
    footer={<GuardedLink href="/(app)/submit/info" asChild><Button title="Submit a new shop" /></GuardedLink>}>
    {searchOpen ? <Field label="Search submissions" hideLabel icon="search" value={search} onChangeText={setSearch}
      placeholder="Shop, type or city" autoCapitalize="none" autoCorrect={false} returnKeyType="search" accessibilityLabel="Search submissions" /> : null}
    <View style={styles.filters}>{FILTERS.map(f => <Pill key={f.key} label={f.label} tone={filter === f.key ? 'ink' : 'neutral'}
      onPress={() => setFilter(f.key)} accessibilityLabel={filter === f.key ? `${f.label}, selected` : f.label} />)}</View>
    {!submissions.length ? <EmptyState icon="storefront-outline" title="No shops yet" body="Visit a shop, take photos, and send it." />
      : !visible.length ? <EmptyState icon="search-outline" title="No matching shops" body="Try another search or status." />
      : <View style={styles.list}>{visible.map(sub => {
        const draft = showAsDraft(sub);
        const status = submissionStatus(sub.status, draft);
        return <GuardedLink key={sub._id} href={`/(app)/submissions/${sub._id}`} asChild>
          <Pressable cssInterop={false} accessibilityRole="button" accessibilityLabel={`${sub.businessName}, ${status.label}`}
            style={({ pressed }) => [styles.card, shadow.soft, pressed ? styles.pressed : null]}>
            <SubThumb sub={sub} draft={draft} />
            <View style={styles.meta}>
              <Text variant="body" weight="bold" numberOfLines={2}>{sub.businessName}</Text>
              <Text variant="label" tone="muted">{sub.businessType} · {sub.city}</Text>
              {compact ? <Chip label={status.label} tone={status.tone} /> : null}
              {compact ? <Text variant="label" tone="muted">{shortDate(sub._creationTime)}</Text> : null}
            </View>
            {!compact ? <View style={styles.trailing}>
              <Chip label={status.label} tone={status.tone} />
              <Text variant="label" tone="muted">{shortDate(sub._creationTime)}</Text>
            </View> : null}
          </Pressable>
        </GuardedLink>;
      })}</View>}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  searchButton: { width: hit.icon, height: hit.icon, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.md },
  list: { gap: space.sm },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.card, padding: space.md, gap: space.sm },
  pressed: { opacity: 0.85 },
  thumb: { width: 52, height: 58, borderRadius: radius.field, backgroundColor: colors.bg2 },
  thumbTile: { alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, minWidth: 0, gap: 3 },
  trailing: { alignItems: 'flex-end', gap: space.xs },
});
