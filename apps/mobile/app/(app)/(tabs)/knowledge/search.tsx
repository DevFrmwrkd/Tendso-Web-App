import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../../hooks/useGuardedRouter';
import { useKnowledge } from '../../../../services/knowledge/KnowledgeProvider';
import { searchAll, terms } from '../../../../services/knowledge/search';
import { Highlight } from '../../../../components/knowledge/Highlight';
import { AnswerCard } from '../../../../components/knowledge/AnswerCard';
import { categoryIcon, hue } from '../../../../components/knowledge/kbTheme';
import type { Article } from '../../../../services/knowledge/api';
import { colors, fonts, radius } from '../../../../theme/tokens';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      {/* Search bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Back"
          accessibilityRole="button"
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            backgroundColor: colors.paper3,
            borderWidth: 1,
            borderColor: colors.rule,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.ink} />
        </TouchableOpacity>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.paper3,
            borderColor: colors.rule,
            borderWidth: 1,
            borderRadius: radius.pill,
            paddingHorizontal: 14,
            height: 44,
          }}
        >
          <Ionicons name="search" size={16} color={colors.ink3} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={askAi}
            returnKeyType="search"
            placeholder="Search or ask a question…"
            placeholderTextColor={colors.ink3}
            style={{ flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.ink }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setAiQuery(null); }} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.ink3} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!hasTerms ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, letterSpacing: 1.6, color: colors.ink3, marginBottom: 12 }}>
              POPULAR
            </Text>
            <View style={{ gap: 8 }}>
              {popular.map((a) => (
                <TouchableOpacity
                  key={a._id}
                  activeOpacity={0.8}
                  onPress={() => openArticle(a)}
                  style={rowStyle}
                >
                  <Ionicons name="document-text-outline" size={16} color={colors.ink3} />
                  <Text style={{ flex: 1, fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }} numberOfLines={1}>
                    {a.title}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.ink3} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 8, gap: 16 }}>
            {/* Ask AI CTA / AnswerCard */}
            {aiQuery === query.trim() && aiQuery ? (
              <AnswerCard query={aiQuery} workspace={workspace} articles={articles} onOpenArticle={openArticle} />
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={askAi}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: colors.accentBg,
                  borderRadius: radius.md,
                  padding: 14,
                }}
              >
                <Ionicons name="sparkles" size={16} color={colors.accentInk} />
                <Text style={{ flex: 1, fontFamily: fonts.sansMed, fontSize: 14, color: colors.accentInk }} numberOfLines={1}>
                  Ask Tendso AI: “{query.trim()}”
                </Text>
                <Ionicons name="arrow-forward" size={15} color={colors.accentInk} />
              </TouchableOpacity>
            )}

            {/* Article results */}
            {results.articles.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={sectionLabel}>ARTICLES</Text>
                {results.articles.map((a) => (
                  <TouchableOpacity key={a._id} activeOpacity={0.8} onPress={() => openArticle(a)} style={colStyle}>
                    <Highlight
                      text={a.title}
                      query={query}
                      style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }}
                      numberOfLines={1}
                    />
                    <Highlight
                      text={a.summary}
                      query={query}
                      style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.ink3, marginTop: 2 }}
                      numberOfLines={2}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Category results */}
            {results.categories.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={sectionLabel}>TOPICS</Text>
                {results.categories.map((c) => {
                  const h = hue(c.hue);
                  return (
                    <TouchableOpacity
                      key={c._id}
                      activeOpacity={0.8}
                      onPress={() => router.push(`${KB}/category/${c.slug}` as any)}
                      style={rowStyle}
                    >
                      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: h.bg, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={categoryIcon(c.icon)} size={14} color={h.ink} />
                      </View>
                      <Text style={{ flex: 1, fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }} numberOfLines={1}>
                        {c.title}
                      </Text>
                      <Ionicons name="chevron-forward" size={15} color={colors.ink3} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* FAQ results */}
            {results.faqs.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={sectionLabel}>QUESTIONS</Text>
                {results.faqs.map((f) => (
                  <View key={f._id} style={colStyle}>
                    <Highlight text={f.question} query={query} style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }} />
                    <Text style={{ fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.ink2, marginTop: 4 }}>
                      {f.answer}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {results.articles.length === 0 &&
              results.categories.length === 0 &&
              results.faqs.length === 0 && (
                <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.ink3, textAlign: 'center', marginTop: 8 }}>
                  No matches — try the AI, it can answer in your own words.
                </Text>
              )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const sectionLabel = {
  fontFamily: fonts.monoMed,
  fontSize: 10,
  letterSpacing: 1.4,
  color: colors.ink3,
} as const;

const rowStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  backgroundColor: colors.paper3,
  borderColor: colors.rule,
  borderWidth: 1,
  borderRadius: radius.sm,
  paddingHorizontal: 14,
  paddingVertical: 12,
} as const;

const colStyle = {
  backgroundColor: colors.paper3,
  borderColor: colors.rule,
  borderWidth: 1,
  borderRadius: radius.sm,
  paddingHorizontal: 14,
  paddingVertical: 12,
} as const;
