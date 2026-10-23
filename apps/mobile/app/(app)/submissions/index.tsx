import React, { useCallback, useMemo, useState } from 'react';
import { BackHandler, Image, Pressable, StyleSheet, View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { GuardedLink } from '../../../components/GuardedLink';
import { openExternalUrl } from '../../../services/links';
import { colors, radius, shadow, space } from '../../../theme/v2';
import {
  Button,
  Chip,
  EmptyState,
  Loading,
  Pill,
  ScreenShell,
  Text,
  shortDate,
  submissionStatus,
} from '../../../components/v2';

// Statuses where the generated website is live and worth linking to (mirrors the
// submission detail screen's "Website" gate).
const WEBSITE_READY_STATUSES = [
  'deployed', 'pending_payment', 'paid', 'completed', 'website_generated',
];

type Filter = 'all' | 'live' | 'review' | 'draft';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'review', label: 'In review' },
  { key: 'draft', label: 'Drafts' },
];

/** Same draft / incomplete rule the screen has always used. */
function isDraftSubmission(sub: any): boolean {
  const isIncomplete =
    !sub.photos ||
    sub.photos.length === 0 ||
    (!sub.videoStorageId && !sub.audioStorageId);
  return sub.status === 'draft' || isIncomplete;
}

/** Approved and rejected win over "draft", as before. */
function showAsDraft(sub: any): boolean {
  return isDraftSubmission(sub) && sub.status !== 'approved' && sub.status !== 'rejected';
}

function matchesFilter(sub: any, filter: Filter): boolean {
  if (filter === 'all') return true;
  const draft = showAsDraft(sub);
  if (filter === 'draft') return draft;
  if (draft || sub.status === 'rejected') return false;
  if (filter === 'live') return WEBSITE_READY_STATUSES.includes(sub.status);
  return !WEBSITE_READY_STATUSES.includes(sub.status);
}

function SubThumb({ sub, draft }: { sub: any; draft: boolean }) {
  const firstPhoto: string | undefined = sub.photos?.[0];
  const urls = useQuery(
    api.files.getMultipleUrls,
    firstPhoto ? { storageIds: [firstPhoto] } : 'skip'
  );
  const url = urls?.[0];
  if (url && !url.startsWith('convex:')) {
    return <Image source={{ uri: url }} style={styles.thumb} resizeMode="cover" accessibilityIgnoresInvertColors />;
  }
  const rejected = sub.status === 'rejected';
  return (
    <View
      style={[
        styles.thumb,
        styles.thumbTile,
        { backgroundColor: rejected ? colors.dangerBg : draft ? colors.bg2 : colors.accentSoft },
      ]}
    >
      <Ionicons
        name={draft ? 'time-outline' : rejected ? 'alert-circle-outline' : 'storefront-outline'}
        size={28}
        color={rejected ? colors.danger : colors.ink}
      />
    </View>
  );
}

export default function SubmissionsScreen() {
  const router = useGuardedRouter();
  const { user, isLoaded } = useUser();
  const [filter, setFilter] = useState<Filter>('all');

  const creator = useQuery(
    api.creators.getByClerkId,
    user ? { clerkId: user.id } : 'skip'
  );

  const submissions = useQuery(
    api.submissions.getByCreatorId,
    creator?._id ? { creatorId: creator._id } : 'skip'
  );

  // Always go to dashboard when back button is pressed (prevents going back to submit flow)
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace('/(app)/dashboard');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        subscription.remove();
      };
    }, [router])
  );

  const visible = useMemo(
    () => (submissions ?? []).filter((sub: any) => matchesFilter(sub, filter)),
    [submissions, filter]
  );

  if (!isLoaded || creator === undefined || submissions === undefined) {
    return <Loading />;
  }

  const total = submissions ? submissions.length : 0;
  const needFix = (submissions ?? []).filter((s: any) => s.status === 'rejected').length;
  const countLine =
    total === 0
      ? undefined
      : `${total} ${total === 1 ? 'shop' : 'shops'}${needFix > 0 ? ` · ${needFix} ${needFix === 1 ? 'needs' : 'need'} a fix` : ''}`;

  const goBack = () => router.replace('/(app)/dashboard');

  if (total === 0) {
    return (
      <ScreenShell onBack={goBack} contentStyle={styles.emptyBody}>
        <EmptyState
          icon="storefront-outline"
          title="No shops yet"
          body="Visit a shop, take photos, and send it."
          actionLabel="Submit a new shop"
          onAction={() => router.push('/(app)/submit/info')}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Your submissions"
      subtitle={countLine}
      onBack={goBack}
      footer={
        <GuardedLink href="/(app)/submit/info" asChild>
          <Button title="Submit a new shop" />
        </GuardedLink>
      }
    >
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pill
            key={f.key}
            label={f.label}
            tone={filter === f.key ? 'ink' : 'neutral'}
            onPress={() => setFilter(f.key)}
            accessibilityLabel={filter === f.key ? `${f.label}, selected` : f.label}
          />
        ))}
      </View>

      {visible.length === 0 ? (
        <Text variant="bodyLg" tone="muted" align="center" style={styles.none}>
          Nothing here yet.
        </Text>
      ) : (
        <View style={styles.list}>
          {visible.map((sub: any) => {
            const draft = showAsDraft(sub);
            const status = submissionStatus(sub.status, draft);
            const hasSite = WEBSITE_READY_STATUSES.includes(sub.status) && !!sub.websiteUrl;

            return (
              <GuardedLink key={sub._id} href={`/(app)/submissions/${sub._id}`} asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${sub.businessName}, ${status.label}`}
                  cssInterop={false}
                  style={({ pressed }) => [styles.card, shadow.soft, pressed ? styles.pressed : null]}
                >
                  <View style={styles.top}>
                    <SubThumb sub={sub} draft={draft} />
                    <View style={styles.meta}>
                      <Text variant="bodyLg" weight="bold" numberOfLines={1}>
                        {sub.businessName}
                      </Text>
                      <Text variant="label" weight="medium" tone="muted" numberOfLines={1}>
                        {sub.businessType} · {sub.city}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bottom}>
                    <Chip label={status.label} tone={status.tone} />
                    <Text variant="label" weight="medium" tone="muted">
                      {shortDate(sub._creationTime)}
                    </Text>
                  </View>

                  {/* Finished website: links straight to the site. */}
                  {hasSite ? (
                    <Pressable
                      onPress={() => void openExternalUrl(sub.websiteUrl)}
                      hitSlop={6}
                      accessibilityRole="link"
                      accessibilityLabel={`View ${sub.businessName} website`}
                      style={styles.siteLink}
                    >
                      <Ionicons name="globe-outline" size={20} color={colors.ink} />
                      <Text variant="label" weight="bold" style={styles.siteLinkText}>
                        View website
                      </Text>
                      <Ionicons name="open-outline" size={18} color={colors.ink} />
                    </Pressable>
                  ) : null}
                </Pressable>
              </GuardedLink>
            );
          })}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  emptyBody: { flexGrow: 1, justifyContent: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  none: { paddingVertical: space.xxl },
  list: { gap: space.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  pressed: { transform: [{ scale: 0.99 }] },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 64, height: 64, borderRadius: radius.field, backgroundColor: colors.bg2 },
  thumbTile: { alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, gap: 2 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  siteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
    marginTop: -space.xs,
    paddingTop: space.xs,
  },
  siteLinkText: { flex: 1 },
});
