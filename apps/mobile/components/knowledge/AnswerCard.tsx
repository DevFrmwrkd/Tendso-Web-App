import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAsk, type Article, type AskResult, type Workspace } from '../../services/knowledge/api';
import { colors, fonts, radius } from '../../theme/tokens';

/**
 * Grounded "Tendso AI" answer — calls the deployed knowledgeAI.ask RAG action
 * and shows the answer + tappable source articles (resolved from the loaded set).
 */
export function AnswerCard({
  query,
  workspace,
  articles,
  onOpenArticle,
}: {
  query: string;
  workspace: Workspace;
  articles: Article[];
  onOpenArticle: (a: Article) => void;
}) {
  const ask = useAsk();
  const [phase, setPhase] = useState<'thinking' | 'done' | 'error'>('thinking');
  const [result, setResult] = useState<AskResult | null>(null);
  const [err, setErr] = useState('');

  const bySlug = useMemo(() => new Map(articles.map((a) => [a.slug, a])), [articles]);

  useEffect(() => {
    let cancelled = false;
    setPhase('thinking');
    setResult(null);
    setErr('');
    ask({ query, workspace, source: 'web' })
      .then((res) => {
        if (!cancelled) {
          setResult(res);
          setPhase('done');
        }
      })
      .catch((e: any) => {
        if (!cancelled) {
          setErr(e?.message || 'Something went wrong.');
          setPhase('error');
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, workspace]);

  const paras = (result?.answer || '').split('\n\n').filter(Boolean);

  return (
    <View
      style={{
        backgroundColor: colors.paper3,
        borderWidth: 1,
        borderColor: colors.rule,
        borderRadius: radius.md,
        padding: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: colors.accentBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="sparkles" size={14} color={colors.accentInk} />
        </View>
        <Text style={{ fontFamily: fonts.serifIt, fontSize: 18, color: colors.ink }}>Tendso AI</Text>
      </View>

      {phase === 'thinking' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.ink3 }}>
            Searching {workspace === 'help' ? 'the Help Center' : 'the wiki'}…
          </Text>
        </View>
      ) : phase === 'error' ? (
        <Text style={{ fontFamily: fonts.sans, fontSize: 15, lineHeight: 24, color: colors.ink2 }}>
          I couldn&apos;t generate an answer right now. {err}
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {paras.map((p, i) => (
            <Text key={i} style={{ fontFamily: fonts.sans, fontSize: 15, lineHeight: 24, color: colors.ink2 }}>
              {p}
            </Text>
          ))}

          {result && result.sources.length > 0 && (
            <View style={{ marginTop: 6, gap: 8 }}>
              <Text
                style={{
                  fontFamily: fonts.monoMed,
                  fontSize: 10,
                  letterSpacing: 1.4,
                  color: colors.ink3,
                }}
              >
                SOURCES
              </Text>
              {result.sources.map((s, i) => {
                const article = bySlug.get(s.slug);
                return (
                  <TouchableOpacity
                    key={s.slug}
                    disabled={!article}
                    activeOpacity={0.7}
                    onPress={() => article && onOpenArticle(article)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: colors.paper2,
                      borderRadius: radius.sm,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      opacity: article ? 1 : 0.5,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, color: colors.accentInk }}>
                      {i + 1}
                    </Text>
                    <Text
                      style={{ flex: 1, fontFamily: fonts.sansMed, fontSize: 13, color: colors.ink }}
                      numberOfLines={1}
                    >
                      {s.title}
                    </Text>
                    {!!article && <Ionicons name="arrow-forward" size={14} color={colors.ink3} />}
                  </TouchableOpacity>
                );
              })}
              <Text
                style={{
                  flexDirection: 'row',
                  fontFamily: fonts.sans,
                  fontSize: 11,
                  color: colors.ink3,
                  marginTop: 2,
                }}
              >
                Generated from Tendso&apos;s published content. Always verify against the source.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
