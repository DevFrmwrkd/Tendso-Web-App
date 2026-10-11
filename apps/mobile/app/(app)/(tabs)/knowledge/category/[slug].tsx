import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../../../hooks/useGuardedRouter';
import { useKnowledge } from '../../../../../services/knowledge/KnowledgeProvider';
import { categoryIcon, hue } from '../../../../../components/knowledge/kbTheme';
import { colors, fonts, radius } from '../../../../../theme/tokens';

const KB = '/(app)/(tabs)/knowledge';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useGuardedRouter();
  const { articles, categories, loading } = useKnowledge();

  const category = categories.find((c) => c.slug === slug) ?? null;
  const list = category ? articles.filter((a) => a.categoryId === category._id) : [];
  const h = hue(category?.hue);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
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
      </View>

      {loading && !category ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : !category ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.ink }}>Topic not found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: h.bg,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 4,
            }}
          >
            <Ionicons name={categoryIcon(category.icon)} size={24} color={h.ink} />
          </View>
          <Text style={{ fontFamily: fonts.serif, fontSize: 30, color: colors.ink, marginTop: 14 }}>
            {category.title}
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.ink2, marginTop: 6 }}>
            {category.description}
          </Text>

          <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, letterSpacing: 1.6, color: colors.ink3, marginTop: 26, marginBottom: 12 }}>
            {list.length} {list.length === 1 ? 'ARTICLE' : 'ARTICLES'}
          </Text>

          <View style={{ gap: 8 }}>
            {list.map((a) => (
              <TouchableOpacity
                key={a._id}
                activeOpacity={0.8}
                onPress={() => router.push(`${KB}/article/${a.slug}` as any)}
                style={{
                  backgroundColor: colors.paper3,
                  borderColor: colors.rule,
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ flex: 1, fontFamily: fonts.sansMed, fontSize: 15, color: colors.ink }} numberOfLines={1}>
                    {a.title}
                  </Text>
                  {a.popular && <Ionicons name="star" size={12} color={colors.accent} />}
                </View>
                <Text style={{ fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.ink3, marginTop: 3 }} numberOfLines={2}>
                  {a.summary}
                </Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink3, marginTop: 6 }}>
                  {a.readMin} MIN READ
                </Text>
              </TouchableOpacity>
            ))}
            {list.length === 0 && (
              <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.ink3 }}>No articles here yet.</Text>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
