import React, { useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../../hooks/useGuardedRouter';
import { useKnowledge } from '../../../../services/knowledge/KnowledgeProvider';
import { searchAll, terms } from '../../../../services/knowledge/search';
import { Highlight } from '../../../../components/knowledge/Highlight';
import { AnswerCard } from '../../../../components/knowledge/AnswerCard';
import { categoryIcon, hue } from '../../../../components/knowledge/kbTheme';
import { Card, ListRow, ScreenShell, SectionLabel, Text } from '../../../../components/v2';
import type { Article } from '../../../../services/knowledge/api';
import { colors, fonts, hit, radius, shadow, space, type as typeScale } from '../../../../theme/v2';

const KB = '/(app)/(tabs)/knowledge';

export default function KnowledgeSearch() {
  const router = useGuardedRouter();
  const { workspace, categories, articles, faqs } = useKnowledge();
  const [query, setQuery] = useState('');
  const [aiQuery, setAiQuery] = useState<string | null>(null);

  const hasTerms = terms(query).length > 0;
  const results = useMemo(
    () => (hasTerms ? searchAll(query, { articles, categories, faqs }) : { articles: [], categories: [], faqs: [] }),
    [query, hasTerms, articles, categories, faqs],
  );

  const openArticle = (a: Article) => router.push(`${KB}/article/${a.slug}` as any);

  const askAi = () => {
    if (!hasTerms) return;
    Keyboard.dismiss();
    setAiQuery(query.trim());
  };

  const popular = articles.filter((a) => a.popular).slice(0, 6);

  return (
    <ScreenShell onBack={() => router.back()} insetBottom={false} contentStyle={styles.content}>
      {/* Search bar */}
      <View style={[styles.bar, shadow.soft]}>
        <Ionicons name="search" size={22} color={colors.ink3} />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={askAi}
          returnKeyType="search"
          placeholder="Search or ask a question…"
          placeholderTextColor={colors.ink3}
          accessibilityLabel="Search or ask a question"
          style={styles.input}
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => {
              setQuery('');
              setAiQuery(null);
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={styles.clear}
          >
            <Ionicons name="close-circle" size={24} color={colors.ink3} />
          </Pressable>
        )}
      </View>

      {!hasTerms ? (
        popular.length > 0 ? (
          <View style={styles.group}>
            <SectionLabel>Popular</SectionLabel>
            <Card style={styles.listCard}>
              {popular.map((a, i) => (
                <ListRow
                  key={a._id}
                  icon="document-text-outline"
                  title={a.title}
                  onPress={() => openArticle(a)}
                  divider={i < popular.length - 1}
                />
              ))}
            </Card>
          </View>
        ) : null
      ) : (
        <View style={styles.results}>
          {/* Ask AI CTA / AnswerCard */}
          {aiQuery === query.trim() && aiQuery ? (
            <AnswerCard query={aiQuery} workspace={workspace} articles={articles} onOpenArticle={openArticle} />
          ) : (
            <Card
              variant="dark"
              onPress={askAi}
              accessibilityLabel={`Ask Tendso: ${query.trim()}`}
              style={styles.askCta}
            >
              <Text variant="body" weight="bold" tone="onDark" numberOfLines={2} style={styles.flex}>
                Ask Tendso: “{query.trim()}”
              </Text>
              <View style={styles.go}>
                <Ionicons name="arrow-forward" size={20} color={colors.onAccent} />
              </View>
            </Card>
          )}

          {/* Article results */}
          {results.articles.length > 0 && (
            <View style={styles.group}>
              <SectionLabel>Articles</SectionLabel>
              {results.articles.map((a) => (
                <Card
                  key={a._id}
                  onPress={() => openArticle(a)}
                  accessibilityLabel={`${a.title}. ${a.summary}`}
                  style={styles.resultCard}
                >
                  <Highlight text={a.title} query={query} style={styles.resultTitle} numberOfLines={2} />
                  <Highlight text={a.summary} query={query} style={styles.resultSub} numberOfLines={2} />
                </Card>
              ))}
            </View>
          )}

          {/* Category results */}
          {results.categories.length > 0 && (
            <View style={styles.group}>
              <SectionLabel>Topics</SectionLabel>
              <Card style={styles.listCard}>
                {results.categories.map((c, i) => {
                  const h = hue(c.hue);
                  return (
                    <ListRow
                      key={c._id}
                      title={c.title}
                      leading={
                        <View style={[styles.tile, { backgroundColor: h.bg }]}>
                          <Ionicons name={categoryIcon(c.icon)} size={22} color={h.ink} />
                        </View>
                      }
                      onPress={() => router.push(`${KB}/category/${c.slug}` as any)}
                      divider={i < results.categories.length - 1}
                    />
                  );
                })}
              </Card>
            </View>
          )}

          {/* FAQ results */}
          {results.faqs.length > 0 && (
            <View style={styles.group}>
              <SectionLabel>Questions</SectionLabel>
              {results.faqs.map((f) => (
                <Card key={f._id} style={styles.resultCard}>
                  <Highlight text={f.question} query={query} style={styles.resultTitle} />
                  <Text variant="body" tone="ink2" style={styles.answer}>
                    {f.answer}
                  </Text>
                </Card>
              ))}
            </View>
          )}

          {results.articles.length === 0 && results.categories.length === 0 && results.faqs.length === 0 && (
            <Text variant="bodyLg" tone="muted" align="center">
              No matches. Ask Tendso, it can answer in your own words.
            </Text>
          )}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.lg, paddingTop: space.md, paddingBottom: space.xxl },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md - 2,
    minHeight: hit.primary,
    paddingLeft: space.lg + 2,
    paddingRight: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    minHeight: hit.primary,
    fontFamily: fonts.medium,
    fontSize: typeScale.bodyLg.fontSize,
    color: colors.ink,
  },
  clear: { width: hit.min, height: hit.min, alignItems: 'center', justifyContent: 'center' },
  group: { gap: space.md },
  results: { gap: space.lg },
  listCard: { paddingVertical: space.xs, paddingHorizontal: space.md },
  askCta: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: 22 },
  go: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCard: { gap: space.xs, padding: space.lg },
  resultTitle: { fontFamily: fonts.bold, fontSize: typeScale.bodyLg.fontSize, lineHeight: 24, color: colors.ink },
  resultSub: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.ink3Text },
  answer: { lineHeight: 24, marginTop: space.xs },
  tile: { width: hit.icon, height: hit.icon, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
