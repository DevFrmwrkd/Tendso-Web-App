import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from '../../../../hooks/useGuardedRouter';
import { useKnowledge } from '../../../../services/knowledge/KnowledgeProvider';
import { categoryIcon, hue } from '../../../../components/knowledge/kbTheme';
import type { Workspace } from '../../../../services/knowledge/api';
import { colors, fonts, radius } from '../../../../theme/tokens';

const KB = '/(app)/(tabs)/knowledge';

function WorkspaceToggle({
  workspace,
  onChange,
  canAccessWiki,
}: {
  workspace: Workspace;
  onChange: (w: Workspace) => void;
  canAccessWiki: boolean | undefined;
}) {
  const Tab = ({ w, label, locked }: { w: Workspace; label: string; locked?: boolean }) => {
    const active = workspace === w;
    return (
      <TouchableOpacity
        onPress={() => onChange(w)}
        activeOpacity={0.8}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          paddingVertical: 8,
          borderRadius: radius.pill,
          backgroundColor: active ? colors.ink : 'transparent',
        }}
      >
        {locked && <Ionicons name="lock-closed" size={11} color={active ? colors.paper3 : colors.ink3} />}
        <Text
          style={{
            fontFamily: fonts.monoMed,
            fontSize: 11,
            letterSpacing: 1,
            color: active ? colors.paper3 : colors.ink2,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.paper2,
        borderRadius: radius.pill,
        padding: 3,
        marginTop: 16,
      }}
    >
      <Tab w="help" label="HELP CENTER" />
      <Tab w="wiki" label="FIELD WIKI" locked={!canAccessWiki} />
    </View>
  );
}

export default function KnowledgeHome() {
  const router = useGuardedRouter();
  const { workspace, setWorkspace, canAccessWiki, categories, articles, faqs, loading } = useKnowledge();
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const popular = articles.filter((a) => a.popular).slice(0, 5);
  const wikiBlocked = workspace === 'wiki' && canAccessWiki === false;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: colors.ink3 }}>
            KNOWLEDGE
          </Text>
          <Text style={{ fontFamily: fonts.serif, fontSize: 34, color: colors.ink, marginTop: 4 }}>
            How can we{' '}
            <Text style={{ fontFamily: fonts.serifIt, color: colors.accent }}>help?</Text>
          </Text>

          <WorkspaceToggle workspace={workspace} onChange={setWorkspace} canAccessWiki={canAccessWiki} />

          {/* Search entry */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push(`${KB}/search` as any)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: colors.paper3,
              borderColor: colors.rule,
              borderWidth: 1,
              borderRadius: radius.md,
              paddingHorizontal: 16,
              height: 52,
              marginTop: 16,
            }}
          >
            <Ionicons name="search" size={18} color={colors.ink3} />
            <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.ink3 }}>
              Search or ask a question…
            </Text>
          </TouchableOpacity>

          {/* Ask Tendso AI */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`${KB}/ask` as any)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: colors.accentBg,
              borderRadius: radius.md,
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginTop: 10,
            }}
          >
            <Ionicons name="sparkles" size={16} color={colors.accentInk} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.accentInk }}>
                Ask Tendso AI
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.accentInk, opacity: 0.8 }}>
                Trained on the whole knowledge base
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.accentInk} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : wikiBlocked ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' }}>
            <Ionicons name="lock-closed-outline" size={40} color={colors.ink3} />
            <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.ink, marginTop: 12 }}>
              Field Wiki is locked
            </Text>
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 14,
                lineHeight: 22,
                color: colors.ink3,
                textAlign: 'center',
                marginTop: 6,
                maxWidth: 300,
              }}
            >
              The internal wiki is for certified field agents. Complete your certification to unlock it.
            </Text>
          </View>
        ) : (
          <>
            {/* Categories */}
            {categories.length > 0 && (
              <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, letterSpacing: 1.6, color: colors.ink3, marginBottom: 12 }}>
                  BROWSE BY TOPIC
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {categories.map((c) => {
                    const h = hue(c.hue);
                    return (
                      <TouchableOpacity
                        key={c._id}
                        activeOpacity={0.85}
                        onPress={() => router.push(`${KB}/category/${c.slug}` as any)}
                        style={{
                          width: '47%',
                          flexGrow: 1,
                          backgroundColor: colors.paper3,
                          borderColor: colors.rule,
                          borderWidth: 1,
                          borderRadius: radius.md,
                          padding: 14,
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: h.bg,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 10,
                          }}
                        >
                          <Ionicons name={categoryIcon(c.icon)} size={18} color={h.ink} />
                        </View>
                        <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }} numberOfLines={1}>
                          {c.title}
                        </Text>
                        <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.ink3, marginTop: 2 }} numberOfLines={2}>
                          {c.description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Popular articles */}
            {popular.length > 0 && (
              <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, letterSpacing: 1.6, color: colors.ink3, marginBottom: 12 }}>
                  POPULAR ARTICLES
                </Text>
                <View style={{ gap: 8 }}>
                  {popular.map((a) => (
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
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }} numberOfLines={1}>
                          {a.title}
                        </Text>
                        <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.ink3, marginTop: 2 }}>
                          {a.readMin} MIN READ
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* FAQ */}
            {faqs.length > 0 && (
              <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, letterSpacing: 1.6, color: colors.ink3, marginBottom: 12 }}>
                  FREQUENTLY ASKED
                </Text>
                <View style={{ backgroundColor: colors.paper3, borderColor: colors.rule, borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' }}>
                  {faqs.map((f, i) => {
                    const open = openFaq === f._id;
                    return (
                      <View key={f._id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.rule }}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => setOpenFaq(open ? null : f._id)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}
                        >
                          <Text style={{ flex: 1, fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }}>
                            {f.question}
                          </Text>
                          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.ink3} />
                        </TouchableOpacity>
                        {open && (
                          <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                            <Text style={{ fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: colors.ink2 }}>
                              {f.answer}
                            </Text>
                            {!!f.linkArticleSlug && (
                              <TouchableOpacity
                                onPress={() => router.push(`${KB}/article/${f.linkArticleSlug}` as any)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}
                              >
                                <Text style={{ fontFamily: fonts.sansMed, fontSize: 13, color: colors.accent }}>
                                  Read more
                                </Text>
                                <Ionicons name="arrow-forward" size={13} color={colors.accent} />
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* App-specific help — the mobile workflow FAQ (submitting, photos,
                drafts, payouts, troubleshooting). This content is hardcoded in
                the app and isn't in the web-managed KB, so it gets its own entry
                here now that Profile's "Help & FAQ" row was removed. */}
            <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
              <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, letterSpacing: 1.6, color: colors.ink3, marginBottom: 12 }}>
                USING THE APP
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/(app)/help-faq' as any)}
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
                <Ionicons name="help-circle-outline" size={18} color={colors.ink3} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sansMed, fontSize: 14, color: colors.ink }}>
                    App help &amp; FAQ
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.ink3, marginTop: 2 }}>
                    Submitting, photos, payouts, troubleshooting
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
              </TouchableOpacity>
            </View>

            {categories.length === 0 && popular.length === 0 && faqs.length === 0 && (
              <View style={{ paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.ink3 }}>
                  Nothing here yet.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
