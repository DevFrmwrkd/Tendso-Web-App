import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../../../hooks/useGuardedRouter';
import { useKnowledge } from '../../../../../services/knowledge/KnowledgeProvider';
import { categoryIcon, hue } from '../../../../../components/knowledge/kbTheme';
import { Card, EmptyState, ListRow, Loading, ScreenShell, SectionLabel, Text } from '../../../../../components/v2';
import { space } from '../../../../../theme/v2';

const KB = '/(app)/(tabs)/knowledge';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useGuardedRouter();
  const { articles, categories, loading } = useKnowledge();

  const category = categories.find((c) => c.slug === slug) ?? null;
  const list = category ? articles.filter((a) => a.categoryId === category._id) : [];
  const h = hue(category?.hue);

  if (loading && !category) {
    return (
      <ScreenShell onBack={() => router.back()} insetBottom={false} scroll={false}>
        <Loading fill={false} />
      </ScreenShell>
    );
  }

  if (!category) {
    return (
      <ScreenShell onBack={() => router.back()} insetBottom={false} scroll={false} contentStyle={styles.centered}>
        <EmptyState icon="folder-open-outline" title="Topic not found" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell onBack={() => router.back()} insetBottom={false} contentStyle={styles.content}>
      <View style={[styles.tile, { backgroundColor: h.bg }]}>
        <Ionicons name={categoryIcon(category.icon)} size={28} color={h.ink} />
      </View>
      <Text variant="display" accessibilityRole="header">
        {category.title}
      </Text>
      <Text variant="bodyLg" tone="ink2">
        {category.description}
      </Text>

      <SectionLabel style={styles.count}>{`${list.length} ${list.length === 1 ? 'article' : 'articles'}`}</SectionLabel>

      {list.length > 0 ? (
        <Card style={styles.listCard}>
          {list.map((a, i) => (
            <ListRow
              key={a._id}
              icon={a.popular ? 'star-outline' : 'document-text-outline'}
              title={a.title}
              subtitle={a.summary}
              onPress={() => router.push(`${KB}/article/${a.slug}` as any)}
              divider={i < list.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Text variant="bodyLg" tone="muted">
          No articles here yet.
        </Text>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.md, paddingTop: space.md, paddingBottom: space.xxl },
  centered: { justifyContent: 'center' },
  tile: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  count: { marginTop: space.md },
  listCard: { paddingVertical: space.xs, paddingHorizontal: space.md },
});
