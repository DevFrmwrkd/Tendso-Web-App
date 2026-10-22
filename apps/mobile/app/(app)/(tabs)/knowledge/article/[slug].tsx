import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../../../hooks/useGuardedRouter';
import { useKnowledge } from '../../../../../services/knowledge/KnowledgeProvider';
import { useRecordFeedback } from '../../../../../services/knowledge/api';
import { ArticleBody } from '../../../../../components/knowledge/Blocks';
import { categoryIcon, hue } from '../../../../../components/knowledge/kbTheme';
import { Card, EmptyState, ListRow, Loading, ScreenShell, SectionLabel, Text } from '../../../../../components/v2';
import { colors, hit, radius, shadow, space } from '../../../../../theme/v2';

const KB = '/(app)/(tabs)/knowledge';

export default function ArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useGuardedRouter();
  const { articles, categories, loading } = useKnowledge();
  const recordFeedback = useRecordFeedback();
  const [voted, setVoted] = useState<null | boolean>(null);

  const article = articles.find((a) => a.slug === slug) ?? null;
  const category = article ? categories.find((c) => c._id === article.categoryId) ?? null : null;
  const related = article
    ? articles.filter((a) => a.categoryId === article.categoryId && a.slug !== article.slug).slice(0, 3)
    : [];

  const vote = (helpful: boolean) => {
    if (voted !== null || !article) return;
    setVoted(helpful);
    recordFeedback({ slug: article.slug, helpful });
  };

  if (loading && !article) {
    return <Loading />;
  }

  if (!article) {
    return (
      <ScreenShell onBack={() => router.back()} insetBottom={false} scroll={false} contentStyle={styles.centered}>
        <EmptyState icon="document-outline" title="Article not found" />
      </ScreenShell>
    );
  }

  const h = hue(category?.hue);

  return (
    <ScreenShell onBack={() => router.back()} insetBottom={false} contentStyle={styles.content}>
      {/* Topic tag */}
      {category && (
        <Pressable
          onPress={() => router.push(`${KB}/category/${category.slug}` as any)}
          accessibilityRole="button"
          accessibilityLabel={`Topic: ${category.title}`}
          hitSlop={4}
          style={[styles.tag, { backgroundColor: h.bg }]}
        >
          <Ionicons name={categoryIcon(category.icon)} size={18} color={h.ink} />
          <Text variant="chip">{category.title}</Text>
        </Pressable>
      )}

      {/* Title + meta */}
      <Text variant="display" accessibilityRole="header">
        {article.title}
      </Text>
      <Text variant="label" weight="medium" tone="muted" style={styles.meta}>
        {article.author} · {article.readMin} min read
      </Text>

      {/* No separate summary dek — the article body already opens with the
          intro, and the web article page renders body-only. Rendering summary
          here made every article look like it repeated its opening. */}

      {/* Body */}
      <ArticleBody body={article.body} />

      {/* Helpful */}
      <Card style={styles.helpful}>
        {voted === null ? (
          <>
            <Text variant="heading" align="center">
              Was this helpful?
            </Text>
            <View style={styles.voteRow}>
              <Pressable
                onPress={() => vote(true)}
                accessibilityRole="button"
                accessibilityLabel="Yes, this was helpful"
                style={({ pressed }) => [styles.vote, pressed ? { opacity: 0.8 } : null]}
              >
                <Ionicons name="thumbs-up-outline" size={22} color={colors.ink} />
                <Text variant="chip">Yes</Text>
              </Pressable>
              <Pressable
                onPress={() => vote(false)}
                accessibilityRole="button"
                accessibilityLabel="No, this was not helpful"
                style={({ pressed }) => [styles.vote, pressed ? { opacity: 0.8 } : null]}
              >
                <Ionicons name="thumbs-down-outline" size={22} color={colors.ink} />
                <Text variant="chip">No</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text variant="bodyLg" tone="ink2" align="center">
            Thanks for the feedback.
          </Text>
        )}
      </Card>

      {/* Related */}
      {related.length > 0 && (
        <View style={styles.related}>
          <SectionLabel>Related</SectionLabel>
          <Card style={styles.listCard}>
            {related.map((a, i) => (
              <ListRow
                key={a._id}
                icon="document-text-outline"
                title={a.title}
                onPress={() => router.push(`${KB}/article/${a.slug}` as any)}
                divider={i < related.length - 1}
              />
            ))}
          </Card>
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingTop: space.md, paddingBottom: space.xxl },
  centered: { justifyContent: 'center' },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm - 2,
    minHeight: 40,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
  },
  meta: { marginTop: -space.xs },
  helpful: { marginTop: space.lg, alignItems: 'center', gap: space.md, padding: space.xl - 4 },
  voteRow: { flexDirection: 'row', gap: space.md },
  vote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: hit.primary,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.bg2,
  },
  related: { gap: space.md, marginTop: space.lg },
  listCard: { paddingVertical: space.xs, paddingHorizontal: space.md },
});
