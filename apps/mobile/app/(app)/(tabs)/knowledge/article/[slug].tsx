import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../../../hooks/useGuardedRouter';
import { useKnowledge } from '../../../../../services/knowledge/KnowledgeProvider';
import { useRecordFeedback } from '../../../../../services/knowledge/api';
import { ArticleBody } from '../../../../../components/knowledge/Blocks';
import { categoryIcon, hue } from '../../../../../components/knowledge/kbTheme';
import { colors, fonts, radius } from '../../../../../theme/tokens';

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
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!article) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Ionicons name="document-outline" size={40} color={colors.ink3} />
          <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.ink, marginTop: 12 }}>Article not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const h = hue(category?.hue);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <Header onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Category chip */}
        {category && (
          <TouchableOpacity
            onPress={() => router.push(`${KB}/category/${category.slug}` as any)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4 }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: h.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={categoryIcon(category.icon)} size={12} color={h.ink} />
            </View>
            <Text style={{ fontFamily: fonts.monoMed, fontSize: 10, letterSpacing: 1.2, color: colors.ink3 }}>
              {category.title.toUpperCase()}
            </Text>
          </TouchableOpacity>
        )}

        {/* Title + meta */}
        <Text style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.ink, marginTop: 12 }}>
          {article.title}
        </Text>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.6, color: colors.ink3, marginTop: 8 }}>
          {article.author.toUpperCase()} · {article.readMin} MIN READ
        </Text>

        {/* No separate summary dek — the article body already opens with the
            intro, and the web article page renders body-only. Rendering summary
            here made every article look like it repeated its opening. */}
        <View style={{ height: 1, backgroundColor: colors.rule, marginTop: 18, marginBottom: 18 }} />

        {/* Body */}
        <ArticleBody body={article.body} />

        {/* Helpful */}
        <View
          style={{
            marginTop: 28,
            backgroundColor: colors.paper3,
            borderColor: colors.rule,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: 16,
            alignItems: 'center',
          }}
        >
          {voted === null ? (
            <>
              <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }}>Was this helpful?</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity onPress={() => vote(true)} style={voteBtn}>
                  <Ionicons name="thumbs-up-outline" size={16} color={colors.ink} />
                  <Text style={voteTxt}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => vote(false)} style={voteBtn}>
                  <Ionicons name="thumbs-down-outline" size={16} color={colors.ink} />
                  <Text style={voteTxt}>No</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.ink2 }}>
              Thanks for the feedback{voted ? ' 🎉' : ''}.
            </Text>
          )}
        </View>

        {/* Related */}
        {related.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, letterSpacing: 1.6, color: colors.ink3, marginBottom: 12 }}>
              RELATED
            </Text>
            <View style={{ gap: 8 }}>
              {related.map((a) => (
                <TouchableOpacity
                  key={a._id}
                  activeOpacity={0.8}
                  onPress={() => router.push(`${KB}/article/${a.slug}` as any)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: colors.paper3,
                    borderColor: colors.rule,
                    borderWidth: 1,
                    borderRadius: radius.sm,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
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
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
      <TouchableOpacity
        onPress={onBack}
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
    </View>
  );
}

const voteBtn = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  backgroundColor: colors.paper2,
  borderColor: colors.rule,
  borderWidth: 1,
  borderRadius: radius.pill,
  paddingHorizontal: 20,
  paddingVertical: 8,
} as const;

const voteTxt = { fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink } as const;
