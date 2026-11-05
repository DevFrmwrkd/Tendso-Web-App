import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../../hooks/useGuardedRouter';
import { useKnowledge } from '../../../../services/knowledge/KnowledgeProvider';
import { categoryIcon, hue } from '../../../../components/knowledge/kbTheme';
import { AskMark } from '../../../../components/knowledge/AskMark';
import { Banner, Card, EmptyState, ListRow, Loading, ScreenShell, SectionLabel, TextLink, Text } from '../../../../components/v2';
import type { Workspace } from '../../../../services/knowledge/api';
import { colors, hit, radius, shadow, space } from '../../../../theme/v2';

const KB = '/(app)/(tabs)/knowledge';

/** Two-option segment: Help center | Field wiki (mock `.cm-seg`). The wiki shows a lock until the account may open it. */
function WorkspaceToggle({
  workspace,
  onChange,
  canAccessWiki,
}: {
  workspace: Workspace;
  onChange: (w: Workspace) => void;
  canAccessWiki: boolean | undefined;
}) {
  const options: { w: Workspace; label: string; locked?: boolean }[] = [
    { w: 'help', label: 'Help center' },
    { w: 'wiki', label: 'Field wiki', locked: !canAccessWiki },
  ];
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {options.map(({ w, label, locked }) => {
        const active = workspace === w;
        return (
          <Pressable
            key={w}
            onPress={() => onChange(w)}
            accessibilityRole="tab"
            accessibilityLabel={locked ? `${label}, locked` : label}
            accessibilityState={{ selected: active }}
            style={[styles.segItem, active ? [styles.segOn, shadow.soft] : null]}
          >
            {locked ? <Ionicons name="lock-closed" size={16} color={active ? colors.ink : colors.ink3} /> : null}
            <Text variant="label" weight="bold" tone={active ? 'ink' : 'muted'}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function KnowledgeHome() {
  const router = useGuardedRouter();
  const { workspace, setWorkspace, canAccessWiki, categories, articles, faqs, loading,
    bookmarkedIds, bookmarksReady, bookmarkError, reloadBookmarks } = useKnowledge();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);

  const popular = articles.filter((a) => a.popular).slice(0, 5);
  const wikiBlocked = workspace === 'wiki' && canAccessWiki === false;
  // IDs alone never reveal an article outside the currently authorized workspace.
  const savedArticles = articles.filter(article => bookmarkedIds.includes(article._id));

  return (
    <ScreenShell title="How can we help?" insetBottom={false} contentStyle={styles.content}>
      <WorkspaceToggle workspace={workspace} onChange={setWorkspace} canAccessWiki={canAccessWiki} />

      {/* Search entry */}
      <Pressable
        onPress={() => router.push(`${KB}/search` as any)}
        accessibilityRole="search"
        accessibilityLabel="Search or ask a question"
        style={[styles.search, shadow.soft]}
      >
        <Ionicons name="search" size={22} color={colors.ink3} />
        <Text variant="body" weight="semibold" tone="muted" style={styles.flex} numberOfLines={1}>
          {workspace === 'wiki' ? 'Search the wiki' : 'Search the help center'}
        </Text>
      </Pressable>

      <TextLink label={savedOnly ? 'Browse all topics' : `Saved articles (${savedArticles.length})`}
        disabled={!bookmarksReady} onPress={() => setSavedOnly(value => !value)} align="left" />
      {bookmarkError ? <Banner tone="warn" body={bookmarkError} /> : null}
      {bookmarkError && !bookmarksReady ? <TextLink label="Retry saved articles" onPress={reloadBookmarks} align="left" /> : null}

      {/* Ask Tendso */}
      <Card variant="dark" onPress={() => router.push(`${KB}/ask` as any)} accessibilityLabel="Ask Tendso" style={styles.ask}>
        <AskMark size={44} />
        <View style={styles.flex}>
          <Text variant="bodyLg" weight="extrabold" tone="onDark">
            Ask Tendso
          </Text>
          <Text variant="label" weight="medium" style={styles.askSub} numberOfLines={2}>
            Answers with sources
          </Text>
        </View>
        <View style={styles.go}>
          <Ionicons name="arrow-forward" size={20} color={colors.onAccent} />
        </View>
      </Card>

      {loading ? (
        <Loading fill={false} />
      ) : wikiBlocked ? (
        <View style={styles.locked}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.ink3} />
          <Text variant="title" align="center" style={styles.lockedTitle}>
            Field wiki is locked
          </Text>
          <Text variant="bodyLg" tone="ink2" align="center">
            Finish your certification to open it.
          </Text>
        </View>
      ) : savedOnly ? (
        <View style={styles.section}>
          <SectionLabel>Saved articles</SectionLabel>
          {savedArticles.length ? <Card style={styles.listCard}>{savedArticles.map((article, index) =>
            <ListRow key={article._id} icon="bookmark" title={article.title}
              subtitle={`${article.readMin} min read`} divider={index < savedArticles.length - 1}
              onPress={() => router.push(`${KB}/article/${article.slug}` as never)} />)}</Card>
            : <EmptyState icon="bookmark-outline" title="No saved articles here" body="Tap the bookmark on an article to save it. Switch Help center or Field wiki to see that workspace’s saved articles." />}
        </View>
      ) : (
        <>
          {/* Topics */}
          {categories.length > 0 && (
            <View style={styles.section}>
              <SectionLabel>Topics</SectionLabel>
              <View style={styles.grid}>
                {categories.map((c) => {
                  const h = hue(c.hue);
                  return (
                    <Card
                      key={c._id}
                      onPress={() => router.push(`${KB}/category/${c.slug}` as any)}
                      accessibilityLabel={`${c.title}. ${c.description}`}
                      style={styles.topic}
                    >
                      <View style={[styles.tile, { backgroundColor: h.bg }]}>
                        <Ionicons name={categoryIcon(c.icon)} size={22} color={h.ink} />
                      </View>
                      <Text variant="bodyLg" weight="extrabold" numberOfLines={2}>
                        {c.title}
                      </Text>
                      <Text variant="label" weight="medium" tone="muted" numberOfLines={2}>
                        {c.description}
                      </Text>
                    </Card>
                  );
                })}
              </View>
            </View>
          )}

          {/* Popular articles */}
          {popular.length > 0 && (
            <View style={styles.section}>
              <SectionLabel>Popular articles</SectionLabel>
              <Card style={styles.listCard}>
                {popular.map((a, i) => (
                  <ListRow
                    key={a._id}
                    icon="document-text-outline"
                    title={a.title}
                    subtitle={`${a.readMin} min read`}
                    onPress={() => router.push(`${KB}/article/${a.slug}` as any)}
                    divider={i < popular.length - 1}
                  />
                ))}
              </Card>
            </View>
          )}

          {/* FAQ */}
          {faqs.length > 0 && (
            <View style={styles.section}>
              <SectionLabel>Frequently asked</SectionLabel>
              <Card style={styles.listCard}>
                {faqs.map((f, i) => {
                  const open = openFaq === f._id;
                  return (
                    <View key={f._id} style={[styles.faq, i < faqs.length - 1 ? styles.faqDivider : null]}>
                      <Pressable
                        onPress={() => setOpenFaq(open ? null : f._id)}
                        accessibilityRole="button"
                        accessibilityLabel={f.question}
                        accessibilityState={{ expanded: open }}
                        style={styles.faqHead}
                      >
                        <Text variant="bodyLg" weight="semibold" style={styles.flex}>
                          {f.question}
                        </Text>
                        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={open ? colors.ink : colors.ink3} />
                      </Pressable>
                      {open && (
                        <View style={styles.faqBody}>
                          <Text variant="body" tone="ink2" style={styles.faqText}>
                            {f.answer}
                          </Text>
                          {!!f.linkArticleSlug && (
                            <TextLink
                              label="Read more"
                              align="left"
                              onPress={() => router.push(`${KB}/article/${f.linkArticleSlug}` as any)}
                            />
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </Card>
            </View>
          )}

          {/* App-specific help — the mobile workflow FAQ (submitting, photos,
              drafts, payouts, troubleshooting). This content is hardcoded in
              the app and isn't in the web-managed KB, so it gets its own entry
              here now that Profile's "Help & FAQ" row was removed. */}
          <View style={styles.section}>
            <SectionLabel>Using the app</SectionLabel>
            <Card style={styles.listCard}>
              <ListRow
                icon="help-circle-outline"
                title="App help & FAQ"
                subtitle="Photos, payouts, fixes"
                onPress={() => router.push('/(app)/help-faq' as any)}
              />
            </Card>
          </View>

          {categories.length === 0 && popular.length === 0 && faqs.length === 0 && (
            <Text variant="bodyLg" tone="muted" align="center" style={styles.empty}>
              Nothing here yet.
            </Text>
          )}
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.md, paddingBottom: space.xxl },
  seg: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: colors.bg2 },
  segItem: {
    flex: 1,
    minHeight: hit.min,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.pill,
  },
  segOn: { backgroundColor: colors.card },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md - 2,
    minHeight: hit.primary,
    paddingHorizontal: space.lg + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  ask: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: 22 },
  askSub: { color: 'rgba(255,255,255,0.72)' },
  go: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locked: { alignItems: 'center', gap: space.sm, paddingTop: space.xxl, paddingHorizontal: space.lg },
  lockedTitle: { marginTop: space.sm },
  section: { gap: space.md, marginTop: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md - 2 },
  topic: { width: '48.5%', flexGrow: 1, gap: space.sm, padding: space.lg - 2, borderRadius: radius.card },
  tile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  listCard: { paddingVertical: space.xs, paddingHorizontal: space.md },
  faq: {},
  faqDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.md, paddingHorizontal: space.xs },
  faqBody: { paddingHorizontal: space.xs, paddingBottom: space.md },
  faqText: { lineHeight: 26 },
  empty: { paddingTop: space.xxl },
});
